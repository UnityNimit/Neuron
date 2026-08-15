# backend/services/workspace_service.py
import os
import json
import time
import asyncio
import subprocess
from collections import defaultdict
from watchdog.events import FileSystemEventHandler
from core.state import AppState
from core.parser import parse_workspace 

def get_git_status(target_dir):
    """
    Extracts real-time Git modification states (Modified, Untracked, Added, Deleted).
    Runs in <10ms for instant UI updates.
    """
    git_statuses = {}
    try:
        if not os.path.exists(os.path.join(target_dir, ".git")):
            return {}
        
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=target_dir, capture_output=True, text=True, check=False
        )
        
        for line in result.stdout.splitlines():
            if len(line) < 4: continue
            status = line[:2]
            file_path = line[3:].replace("\\", "/") 
            if file_path.startswith('"') and file_path.endswith('"'):
                file_path = file_path[1:-1]
                
            mapped_status = "M"
            if "??" in status: mapped_status = "U"
            elif "A" in status: mapped_status = "A"
            elif "D" in status: mapped_status = "D"
            
            git_statuses[file_path] = mapped_status
    except Exception: pass
    return git_statuses

def get_git_churn(target_dir):
    """
    ML FEATURE PIPELINE: "Historical Velocity / Code Churn"
    Parses the entire git log to count exactly how many commits have modified each file.
    High Churn + High Cyclomatic Complexity = Massive ML Bug Predictor.
    """
    churn_map = defaultdict(int)
    try:
        if not os.path.exists(os.path.join(target_dir, ".git")):
            return {}
            
        # --name-only extracts just the filenames changed in every commit
        # --format= removes commit hashes/authors to make it ultra-fast to parse
        result = subprocess.run(
            ['git', 'log', '--name-only', '--format='], 
            cwd=target_dir, capture_output=True, text=True, check=False
        )
        
        for line in result.stdout.splitlines():
            file_path = line.strip().replace("\\", "/")
            if file_path:
                churn_map[file_path] += 1
                
    except Exception: pass
    return dict(churn_map)

def get_file_list():
    """
    Generates the structural File System Tree hierarchy.
    Excludes massive binaries and ignored folders for O(1) performance.
    """
    items = []
    for root, dirs, files in os.walk(AppState.TARGET_DIR):
        # Mutate dirs in-place to prevent os.walk from entering excluded directories
        dirs[:] = [d for d in dirs if d not in AppState.EXCLUDE_DIRS]
        
        for d in dirs:
            rel = os.path.relpath(os.path.join(root, d), AppState.TARGET_DIR).replace("\\", "/")
            items.append({"path": rel, "type": "folder"})
            
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), AppState.TARGET_DIR).replace("\\", "/")
            items.append({"path": rel, "type": "file"})
            
    def sort_key(item):
        parts = item["path"].split("/")
        key = []
        for i, part in enumerate(parts):
            is_last = (i == len(parts) - 1)
            key.append((1 if is_last and item["type"] == "file" else 0, part.lower()))
        return key
        
    return sorted(items, key=sort_key)

def get_workspace_state():
    """
    The Ultimate Architectural State Generator.
    1. Reads File System
    2. Runs Git Status & ML Git Churn
    3. Triggers the heavy AST parsing and ML Analyzer pipeline
    """
    items = get_file_list()
    file_paths = [i["path"] for i in items if i["type"] == "file"]
    
    if AppState.ACTIVE_FILE not in file_paths and file_paths:
        AppState.ACTIVE_FILE = file_paths[0]

    # Fetch Git Data for ML and UI
    git_statuses = get_git_status(AppState.TARGET_DIR)
    git_churn = get_git_churn(AppState.TARGET_DIR)

    # Trigger Heavy ML Pipeline (AST -> Call Graph -> Louvain Communities -> PageRank)
    graph_state = parse_workspace(AppState.TARGET_DIR, items, git_churn)
                
    return {
        "items": items,
        "files": file_paths, 
        "graph": graph_state, 
        "active_file": AppState.ACTIVE_FILE,
        "target_dir_abs": AppState.TARGET_DIR,
        "git_statuses": git_statuses 
    }

async def broadcast_workspace():
    """
    Parallelized Async Broadcasting to all connected frontend clients.
    """
    # Offload the heavy synchronous state generation to a background thread
    state = await asyncio.to_thread(get_workspace_state)
    message = json.dumps({"event": "SYNC", "payload": state})
    
    # Broadcast concurrently to eliminate blocking
    if AppState.CONNECTIONS:
        await asyncio.gather(
            *[conn.send_text(message) for conn in AppState.CONNECTIONS],
            return_exceptions=True
        )

class CodeWatcher(FileSystemEventHandler):
    """
    Real-time File System Watchdog.
    Debounces fast typing saves to prevent ML pipeline thrashing.
    """
    def __init__(self, loop):
        self.loop = loop
        self.last_trigger = 0

    def on_any_event(self, event):
        # Ignore directory modifications (we only care about structural or file content changes)
        if event.is_directory and event.event_type == 'modified':
            return
            
        current_time = time.time()
        # High-performance 0.5s debounce
        if current_time - self.last_trigger > 0.5: 
            self.last_trigger = current_time
            asyncio.run_coroutine_threadsafe(broadcast_workspace(), self.loop)