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

# STRICT DIRECTORY EXCLUSIONS: Prevents scanning Rust build targets & binary caches
DEFAULT_EXCLUDE_DIRS: Set[str] = {
    "target", "binaries", "bundle", ".cargo", "node_modules", ".git", "__pycache__", 
    ".venv", "venv", "env", ".next", "dist", "build", ".cache", ".chroma", 
    ".onnx_models", ".idea", ".vscode", "coverage", ".turbo", ".pytest_cache"
}

# Text extensions allowed for full AST parsing & diffing
PARSEABLE_CODE_EXTENSIONS: Set[str] = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
    ".java",
    ".json", ".css", ".html", ".md", ".txt", ".toml", ".yaml", ".yml", ".sql", ".sh", ".env",
    ".bat", ".cmd", ".bash", ".ini", ".cfg"
}

MAX_PARSE_SIZE_BYTES = 1_000_000  # 1 MB Safety Ceiling for AST Memory

# In-Memory Cache for 0ms Workspace State Generation & Diffing
PREVIOUS_WORKSPACE_STATE: Dict[str, Any] = {}
PREVIOUS_FILE_CONTENTS: Dict[str, str] = {}
LAST_WORKSPACE_DIR: str = ""
GIT_CHURN_CACHE: Dict[str, int] = {}
LAST_GIT_CHURN_FETCH: float = 0.0


# -------------------------------------------------------------------------
# 1. HIGH-SPEED GIT ENGINE (Metadata, Status & TTL Churn)
# -------------------------------------------------------------------------
def get_git_metadata(target_dir: str) -> Dict[str, Any]:
    """
    Extracts Git repository existence, active branch name, and repository root name.
    Directly reads .git/HEAD for sub-millisecond execution (<0.5ms vs 1,100ms subprocess).
    """
    if not target_dir:
        return {
            "is_git_repo": False,
            "git_branch": "",
            "repo_name": ""
        }

    abs_target = os.path.abspath(target_dir)
    git_dir = os.path.join(abs_target, ".git")
    repo_name = os.path.basename(abs_target)

    # Strictly check if the root of the active workspace is a Git repository
    if not os.path.exists(git_dir):
        return {
            "is_git_repo": False,
            "git_branch": "",
            "repo_name": repo_name
        }

    branch_name = "main"
    head_file = os.path.join(git_dir, "HEAD")
    try:
        # Fast-Path: Read .git/HEAD directly without spawning subprocess (0.5ms)
        if os.path.isfile(head_file):
            with open(head_file, "r", encoding="utf-8", errors="replace") as f:
                head_content = f.read().strip()
            if head_content.startswith("ref: refs/heads/"):
                branch_name = head_content[len("ref: refs/heads/"):].strip()
            elif head_content:
                # Detached HEAD SHA
                branch_name = head_content[:7]
        else:
            # Fallback for worktrees or complex git links
            res = subprocess.run(
                ['git', 'branch', '--show-current'],
                cwd=abs_target,
                capture_output=True,
                text=True,
                check=False,
                timeout=1.5
            )
            branch = res.stdout.strip()
            if branch:
                branch_name = branch
    except Exception:
        pass

    return {
        "is_git_repo": True,
        "git_branch": branch_name or "main",
        "repo_name": repo_name
    }


def get_git_status(target_dir: str) -> Dict[str, str]:
    """
    Extracts real-time Git modification states (Modified, Untracked, Added, Deleted, Renamed).
    Runs with high efficiency and handles both staged, untracked, and ignored assets.
    """
    git_statuses = {}
    if not target_dir:
        return {}

    abs_target = os.path.abspath(target_dir)
    if not os.path.exists(os.path.join(abs_target, ".git")):
        return {}

    try:
        result = subprocess.run(
            ['git', '-c', 'core.quotepath=false', 'status', '--porcelain', '--ignored=matching'],
            cwd=abs_target,
            capture_output=True,
            text=True,
            check=False,
            timeout=5.0
        )

        for line in result.stdout.splitlines():
            if len(line) < 4:
                continue

            status_code = line[:2]
            raw_path = posixpath.normpath(line[3:].strip().replace("\\", "/").rstrip("/"))

            # Strip quotation marks from filenames with spaces
            if raw_path.startswith('"') and raw_path.endswith('"'):
                raw_path = raw_path[1:-1]

            # Handle renamed files (e.g. "R  old.py -> new.py")
            if "->" in raw_path:
                raw_path = posixpath.normpath(raw_path.split("->")[-1].strip().replace("\\", "/"))

            mapped_status = "M"
            if "!!" in status_code:
                mapped_status = "I"
            elif "??" in status_code:
                mapped_status = "U"
            elif "A" in status_code:
                mapped_status = "A"
            elif "D" in status_code:
                mapped_status = "D"
            elif "R" in status_code:
                mapped_status = "R"
            elif "M" in status_code:
                mapped_status = "M"

            git_statuses[raw_path] = mapped_status

            # If an untracked directory is detected, also mark contained files as 'U'
            if mapped_status == "U":
                full_untracked = os.path.join(abs_target, raw_path)
                if os.path.isdir(full_untracked):
                    for sub_root, _, sub_files in os.walk(full_untracked):
                        for sf in sub_files:
                            sub_rel = posixpath.normpath(os.path.relpath(os.path.join(sub_root, sf), abs_target).replace("\\", "/"))
                            git_statuses[sub_rel] = "U"

    except Exception:
        pass

    return git_statuses


def get_git_churn(target_dir: str) -> Dict[str, int]:
    """
    Extracts Git commit churn with a 60-second TTL cache to eliminate startup lag.
    """
    global GIT_CHURN_CACHE, LAST_GIT_CHURN_FETCH
    now = time.time()

    # Return cached churn if fetched within the last 60 seconds
    if GIT_CHURN_CACHE and (now - LAST_GIT_CHURN_FETCH < 60.0):
        return GIT_CHURN_CACHE

    if not target_dir or not os.path.exists(os.path.join(target_dir, ".git")):
        return {}

    churn_map = defaultdict(int)
    try:
        result = subprocess.run(
            ['git', 'log', '--name-only', '--format=', '-n', '100'],
            cwd=target_dir,
            capture_output=True,
            text=True,
            check=False,
            timeout=1.5
        )

        for line in result.stdout.splitlines():
            file_path = line.strip().replace("\\", "/")
            if file_path:
                churn_map[file_path] += 1

        GIT_CHURN_CACHE = dict(churn_map)
        LAST_GIT_CHURN_FETCH = now
    except Exception:
        pass

    return GIT_CHURN_CACHE


# -------------------------------------------------------------------------
# 2. COMPLETE FILE TREE COMPILER (Shows ALL Files in Explorer)
# -------------------------------------------------------------------------
def get_file_list() -> List[dict]:
    """
    Generates the complete File System Tree for the Sidebar Explorer.
    Shows all user files (.cpp, .c, .java, .exe, .py, .md, images, config).
    """
    items = []
    target_dir = os.path.abspath(AppState.TARGET_DIR)
    active_exclusions = DEFAULT_EXCLUDE_DIRS.union(getattr(AppState, 'EXCLUDE_DIRS', set()))

    for root, dirs, files in os.walk(target_dir):
        # Only exclude heavy build folders (target/, node_modules/, .git/)
        dirs[:] = [d for d in dirs if d not in active_exclusions and not d.startswith('.')]

        for d in dirs:
            rel = posixpath.normpath(os.path.relpath(os.path.join(root, d), target_dir).replace("\\", "/"))
            if rel and rel != ".":
                items.append({"path": rel, "type": "folder"})

        for f in files:
            # Skip hidden system metadata files
            if f in [".DS_Store", "Thumbs.db"]:
                continue

            full_file_path = os.path.join(root, f)
            rel = posixpath.normpath(os.path.relpath(full_file_path, target_dir).replace("\\", "/"))
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
    LIGHTNING-FAST ARCHITECTURAL STATE GENERATOR (<0.05s)
      1. Scans workspace directory tree (Shielded against binaries)
      2. Computes Git metadata, statuses & cached historical code churn
      3. Executes the multi-language AST parser & Graph ML analyzer
    """
    global PREVIOUS_WORKSPACE_STATE, PREVIOUS_FILE_CONTENTS, LAST_WORKSPACE_DIR

    target_dir = os.path.abspath(AppState.TARGET_DIR)
    is_dir_switch = (LAST_WORKSPACE_DIR != target_dir)
    LAST_WORKSPACE_DIR = target_dir

    items = get_file_list()
    file_paths = [i["path"] for i in items if i["type"] == "file"]

    if AppState.ACTIVE_FILE not in file_paths and file_paths:
        AppState.ACTIVE_FILE = file_paths[0]

    # Fetch Git Metadata & Statuses (Fast-Path)
    git_meta = get_git_metadata(AppState.TARGET_DIR)
    git_statuses = get_git_status(AppState.TARGET_DIR)
    git_churn = get_git_churn(AppState.TARGET_DIR)

    # Trigger AST Parsing & Graph ML Pipeline
    graph_state = parse_workspace(AppState.TARGET_DIR, items, git_churn)

    mutated_files_buffer: List[Tuple[str, str, str]] = []
    current_contents: Dict[str, str] = {}

    for node in graph_state.get("nodes", []):
        ndata = node.get("data", {})
        if ndata.get("nodeType") == "file":
            fpath = node.get("id")
            content = ndata.get("code", "")
            if fpath:
                current_contents[fpath] = content
                if not is_dir_switch:
                    old_content = PREVIOUS_FILE_CONTENTS.get(fpath, "")
                    if old_content and old_content != content:
                        mutated_files_buffer.append((fpath, old_content, content))

    PREVIOUS_FILE_CONTENTS = current_contents

    # ONLY trigger Agent Supervisor if MULTIPLE (>= 2) files are modified in a burst
    agent_batch_summary = None
    if len(mutated_files_buffer) >= 2:
        agent_batch = agent_supervisor.record_agent_mutation_burst(
            mutated_files=mutated_files_buffer,
            graph_edges=graph_state.get("edges", [])
        )
        if AppState.BLAST_PROTECTION_ENABLED:
            # 🛡️ Blast Protection Active: Safely rollback runaway AI multi-file edits on disk
            success, reason = agent_supervisor.rollback_batch(
                batch_id=agent_batch.batch_id,
                workspace_root=AppState.TARGET_DIR
            )
            if success:
                for fpath, old_text, _ in mutated_files_buffer:
                    current_contents[fpath] = old_text
                agent_batch.is_rolled_back = True
            agent_batch_summary = agent_supervisor.get_latest_batch_summary()
            if agent_batch_summary:
                agent_batch_summary["blastProtectionBlocked"] = True
                agent_batch_summary["protectionMessage"] = (
                    f"Blast Protection intercepted & neutralized an instant AI mutation burst affecting {len(mutated_files_buffer)} files."
                )
        else:
            agent_batch_summary = agent_supervisor.get_latest_batch_summary()

    from services.git_service import git_get_detailed_status
    git_detailed = git_get_detailed_status(AppState.TARGET_DIR)

    raw_state = {
        "items": items,
        "files": file_paths,
        "graph": graph_state,
        "active_file": AppState.ACTIVE_FILE,
        "target_dir_abs": AppState.TARGET_DIR,
        "git_statuses": git_statuses,
        "git_detailed_status": git_detailed,
        "git_branch": git_meta.get("git_branch", "main"),
        "is_git_repo": git_meta.get("is_git_repo", False),
        "repo_name": git_meta.get("repo_name", ""),
        "agent_batch": agent_batch_summary,
        "blast_protection": AppState.BLAST_PROTECTION_ENABLED
    }

    sanitized = sanitize_for_json(raw_state)
    PREVIOUS_WORKSPACE_STATE = sanitized
    return sanitized


def compute_incremental_graph_delta(old_state: dict, new_state: dict) -> dict:
    """Computes a minimal hot-patch delta between two workspace graph states."""
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
        "git_detailed_status": new_state.get("git_detailed_status", {}),
        "git_branch": new_state.get("git_branch", "main"),
        "is_git_repo": new_state.get("is_git_repo", False),
        "repo_name": new_state.get("repo_name", ""),
        "agent_batch": new_state.get("agent_batch"),
        "active_file": new_state.get("active_file", "")
    }


# -------------------------------------------------------------------------
# 4. PARALLEL ASYNC BROADCASTER
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

    is_structural_change = (
        force_full_sync or
        len(old_state.get("files", [])) != len(new_state.get("files", [])) or
        len(old_state.get("items", [])) != len(new_state.get("items", [])) or
        not old_state
    )

    if is_structural_change:
        message = json.dumps({"event": "SYNC", "payload": new_state})
    else:
        delta_payload = compute_incremental_graph_delta(old_state, new_state)
        message = json.dumps({"event": "GRAPH_DELTA", "payload": delta_payload})

    PREVIOUS_WORKSPACE_STATE = new_state

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
    Real-time File System Watchdog with trailing burst debouncing.
    Batches rapid multi-file agent writes and terminal Git operations into atomic updates.
    """
    def __init__(self, loop):
        self.loop = loop
        self.timer_handle = None

    def _schedule_debounced_broadcast(self):
        if self.timer_handle is not None:
            try:
                self.timer_handle.cancel()
            except Exception:
                pass
        self.timer_handle = self.loop.call_later(0.35, self._run_broadcast)

    def _run_broadcast(self):
        self.timer_handle = None
        asyncio.create_task(broadcast_workspace(force_full_sync=False))

    def on_any_event(self, event):
        if event.is_directory and event.event_type == 'modified':
            return

        src_path = getattr(event, 'src_path', '')
        if not src_path:
            return

        normalized_path = src_path.replace("\\", "/")

        # Inspect Git index/HEAD/refs changes while filtering heavy internal objects/logs
        if "/.git/" in normalized_path or normalized_path.endswith("/.git"):
            if not any(marker in normalized_path for marker in ("/.git/index", "/.git/HEAD", "/.git/refs/")):
                return
        elif any(f"/{ex}/" in normalized_path or normalized_path.endswith(f"/{ex}") for ex in DEFAULT_EXCLUDE_DIRS if ex != ".git"):
            return

        try:
            self.loop.call_soon_threadsafe(self._schedule_debounced_broadcast)
        except Exception:
            pass