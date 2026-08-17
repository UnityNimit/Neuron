# backend/services/workspace_service.py
import asyncio
from collections import defaultdict
import json
import os
import posixpath
import subprocess
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from watchdog.events import FileSystemEventHandler

from ai.agent_supervisor import agent_supervisor
from core.parser import parse_workspace
from core.state import AppState
from ml.analyzer import sanitize_for_json

# Default excluded directories to maintain O(1) file system performance
DEFAULT_EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    ".next", "dist", "build", ".cache", ".chroma", ".onnx_models",
    ".idea", ".vscode", "coverage", ".turbo", ".pytest_cache"
}

# In-Memory Cache for Incremental Graph Diffing
PREVIOUS_WORKSPACE_STATE: Dict[str, Any] = {}
PREVIOUS_FILE_CONTENTS: Dict[str, str] = {}


# -------------------------------------------------------------------------
# 1. GIT ENGINE & HISTORICAL CHURN METRICS
# -------------------------------------------------------------------------
def get_git_status(target_dir: str) -> Dict[str, str]:
    """
    Extracts real-time Git modification states (Modified, Untracked, Added, Deleted, Renamed).
    Runs in <10ms for instantaneous HUD updates.
    """
    git_statuses = {}
    if not target_dir or not os.path.exists(os.path.join(target_dir, ".git")):
        return {}

    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain', '-uall'],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            timeout=3
        )

        for line in result.stdout.splitlines():
            if len(line) < 4:
                continue

            status_code = line[:2].strip()
            raw_path = line[3:].strip().replace("\\", "/")

            # Strip quotation marks from filenames with spaces
            if raw_path.startswith('"') and raw_path.endswith('"'):
                raw_path = raw_path[1:-1]

            # Handle renamed files (e.g. "R  old.py -> new.py")
            if "->" in raw_path:
                raw_path = raw_path.split("->")[-1].strip()

            mapped_status = "M"
            if "??" in status_code:
                mapped_status = "U"
            elif "A" in status_code:
                mapped_status = "A"
            elif "D" in status_code:
                mapped_status = "D"
            elif "R" in status_code:
                mapped_status = "R"

            git_statuses[raw_path] = mapped_status

    except Exception:
        pass

    return git_statuses


def get_git_churn(target_dir: str) -> Dict[str, int]:
    """
    ML FEATURE PIPELINE: "Historical Code Churn"
    Parses the Git log to count commit frequency per file.
    High Churn + High Complexity = Statistically High Bug Hotspot.
    """
    churn_map = defaultdict(int)
    if not target_dir or not os.path.exists(os.path.join(target_dir, ".git")):
        return {}

    try:
        result = subprocess.run(
            ['git', 'log', '--name-only', '--format=', '-n', '300'],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            timeout=3
        )

        for line in result.stdout.splitlines():
            file_path = line.strip().replace("\\", "/")
            if file_path:
                churn_map[file_path] += 1

    except Exception:
        pass

    return dict(churn_map)


# -------------------------------------------------------------------------
# 2. FILE TREE STRUCTURE COMPILER
# -------------------------------------------------------------------------
def get_file_list() -> List[dict]:
    """
    Generates the structural File System Tree hierarchy.
    Excludes massive build directories and binary folders for high-speed scanning.
    """
    items = []
    target_dir = os.path.abspath(AppState.TARGET_DIR)
    
    active_exclusions = DEFAULT_EXCLUDE_DIRS.union(getattr(AppState, 'EXCLUDE_DIRS', set()))

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in active_exclusions and not d.startswith('.')]

        for d in dirs:
            rel = posixpath.normpath(os.path.relpath(os.path.join(root, d), target_dir).replace("\\", "/"))
            if rel and rel != ".":
                items.append({"path": rel, "type": "folder"})

        for f in files:
            if f.startswith('.') or f.endswith(('.pyc', '.pyo', '.lock', '.log', '.png', '.jpg', '.svg', '.ico')):
                continue
            rel = posixpath.normpath(os.path.relpath(os.path.join(root, f), target_dir).replace("\\", "/"))
            if rel and rel != ".":
                items.append({"path": rel, "type": "file"})

    def sort_key(item):
        parts = item["path"].split("/")
        key = []
        for i, part in enumerate(parts):
            is_last = (i == len(parts) - 1)
            key.append((1 if is_last and item["type"] == "file" else 0, part.lower()))
        return key

    return sorted(items, key=sort_key)


# -------------------------------------------------------------------------
# 3. WORKSPACE STATE & INCREMENTAL DELTA GENERATOR
# -------------------------------------------------------------------------
def get_workspace_state() -> dict:
    """
    🌌 THE ULTIMATE ARCHITECTURAL STATE GENERATOR
      1. Scans workspace directory tree
      2. Computes Git statuses & historical code churn
      3. Executes the multi-language AST parser & Graph ML analyzer
    """
    global PREVIOUS_WORKSPACE_STATE, PREVIOUS_FILE_CONTENTS

    items = get_file_list()
    file_paths = [i["path"] for i in items if i["type"] == "file"]

    if AppState.ACTIVE_FILE not in file_paths and file_paths:
        AppState.ACTIVE_FILE = file_paths[0]

    # Fetch Git Data for ML and UI
    git_statuses = get_git_status(AppState.TARGET_DIR)
    git_churn = get_git_churn(AppState.TARGET_DIR)

    # Trigger AST Parsing & Graph ML Pipeline
    graph_state = parse_workspace(AppState.TARGET_DIR, items, git_churn)

    # Track file content changes for Horizon 3 Agent Supervisor
    mutated_files_buffer: List[Tuple[str, str, str]] = []
    current_contents: Dict[str, str] = {}

    for fpath in file_paths:
        full_path = os.path.join(AppState.TARGET_DIR, fpath)
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            current_contents[fpath] = content

            old_content = PREVIOUS_FILE_CONTENTS.get(fpath, "")
            if old_content and old_content != content:
                mutated_files_buffer.append((fpath, old_content, content))
        except Exception:
            pass

    PREVIOUS_FILE_CONTENTS = current_contents

    # If multi-file mutations detected, record burst in Agent Supervisor
    agent_batch_summary = None
    if mutated_files_buffer:
        agent_batch = agent_supervisor.record_agent_mutation_burst(
            mutated_files=mutated_files_buffer,
            graph_edges=graph_state.get("edges", [])
        )
        agent_batch_summary = agent_supervisor.get_latest_batch_summary()

    raw_state = {
        "items": items,
        "files": file_paths,
        "graph": graph_state,
        "active_file": AppState.ACTIVE_FILE,
        "target_dir_abs": AppState.TARGET_DIR,
        "git_statuses": git_statuses,
        "agent_batch": agent_batch_summary
    }

    sanitized = sanitize_for_json(raw_state)
    PREVIOUS_WORKSPACE_STATE = sanitized
    return sanitized


def compute_incremental_graph_delta(old_state: dict, new_state: dict) -> dict:
    """
    Computes a minimal hot-patch delta between two workspace graph states.
    Allows the WebGPU canvas to update without resetting physics positions.
    """
    old_nodes = {n["id"]: n for n in old_state.get("graph", {}).get("nodes", [])}
    new_nodes = {n["id"]: n for n in new_state.get("graph", {}).get("nodes", [])}

    old_edges = {e["id"]: e for e in old_state.get("graph", {}).get("edges", [])}
    new_edges = {e["id"]: e for e in new_state.get("graph", {}).get("edges", [])}

    # Node Deltas
    nodes_upsert = [n for nid, n in new_nodes.items() if nid not in old_nodes or old_nodes[nid] != n]
    nodes_remove = [nid for nid in old_nodes if nid not in new_nodes]

    # Edge Deltas
    edges_upsert = [e for eid, e in new_edges.items() if eid not in old_edges or old_edges[eid] != e]
    edges_remove = [eid for eid in old_edges if eid not in new_edges]

    return {
        "nodes_upsert": nodes_upsert,
        "nodes_remove": nodes_remove,
        "edges_upsert": edges_upsert,
        "edges_remove": edges_remove,
        "git_statuses": new_state.get("git_statuses", {}),
        "agent_batch": new_state.get("agent_batch"),
        "active_file": new_state.get("active_file", "")
    }


# -------------------------------------------------------------------------
# 4. BROADCASTING & HOT-PATCH PIPELINE
# -------------------------------------------------------------------------
async def broadcast_workspace(force_full_sync: bool = False):
    """
    Parallelized async broadcasting to all connected frontend WebSockets.
    Uses lightweight GRAPH_DELTA for code edits, and SYNC for structural changes.
    """
    global PREVIOUS_WORKSPACE_STATE

    if not AppState.CONNECTIONS:
        return

    old_state = dict(PREVIOUS_WORKSPACE_STATE)
    new_state = await asyncio.to_thread(get_workspace_state)

    # Determine if structural layout changed (files/folders added/deleted)
    is_structural_change = (
        force_full_sync or
        len(old_state.get("files", [])) != len(new_state.get("files", [])) or
        len(old_state.get("items", [])) != len(new_state.get("items", [])) or
        not old_state
    )

    if is_structural_change:
        message = json.dumps({"event": "SYNC", "payload": new_state})
    else:
        # 🚀 EMIT HOT-PATCH GRAPH DELTA (Zero Canvas Flash / Full Reload)
        delta_payload = compute_incremental_graph_delta(old_state, new_state)
        message = json.dumps({"event": "GRAPH_DELTA", "payload": delta_payload})

    disconnected = set()
    for ws in list(AppState.CONNECTIONS):
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)

    for dead_ws in disconnected:
        AppState.CONNECTIONS.discard(dead_ws)


# -------------------------------------------------------------------------
# 5. REAL-TIME FILE SYSTEM WATCHDOG DAEMON
# -------------------------------------------------------------------------
class CodeWatcher(FileSystemEventHandler):
    """
    Real-time File System Watchdog with burst debouncing.
    Batches rapid multi-file agent writes into a single atomic graph update.
    """
    def __init__(self, loop):
        self.loop = loop
        self.last_trigger = 0
        self.pending_paths: Set[str] = set()

    def on_any_event(self, event):
        if event.is_directory and event.event_type == 'modified':
            return

        src_path = getattr(event, 'src_path', '')
        if not src_path:
            return

        normalized_path = src_path.replace("\\", "/")
        
        # Ignore changes in excluded folders
        if any(f"/{ex}/" in normalized_path or normalized_path.endswith(f"/{ex}") for ex in DEFAULT_EXCLUDE_DIRS):
            return

        self.pending_paths.add(normalized_path)

        current_time = time.time()
        # High-performance 0.35s burst debounce
        if current_time - self.last_trigger > 0.35:
            self.last_trigger = current_time
            self.pending_paths.clear()
            asyncio.run_coroutine_threadsafe(broadcast_workspace(force_full_sync=False), self.loop)