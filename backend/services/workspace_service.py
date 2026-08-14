# backend/services/workspace_service.py
import os
import json
import time
import asyncio
import subprocess
from watchdog.events import FileSystemEventHandler
from core.state import AppState
from core.parser import parse_workspace 

def get_git_status(target_dir):
    git_statuses = {}
    try:
        # Check if it is actually a git repository
        if not os.path.exists(os.path.join(target_dir, ".git")):
            return {}
        
        # Run standard VS Code git command
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=target_dir, capture_output=True, text=True, check=False
        )
        for line in result.stdout.splitlines():
            if len(line) < 4: continue
            status = line[:2]
            file_path = line[3:].replace("\\", "/") # Normalize path
            if file_path.startswith('"') and file_path.endswith('"'):
                file_path = file_path[1:-1]
                
            # Map Git Codes to VS Code UI Codes
            mapped_status = "M"
            if "??" in status: mapped_status = "U"
            elif "A" in status: mapped_status = "A"
            elif "D" in status: mapped_status = "D"
            
            git_statuses[file_path] = mapped_status
    except Exception: pass
    return git_statuses

def get_file_list():
    items = []
    for root, dirs, files in os.walk(AppState.TARGET_DIR):
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
    items = get_file_list()
    file_paths = [i["path"] for i in items if i["type"] == "file"]
    
    if AppState.ACTIVE_FILE not in file_paths and file_paths:
        AppState.ACTIVE_FILE = file_paths[0]

    graph_state = parse_workspace(AppState.TARGET_DIR, items)
    
    # FETCH GIT STATUSES
    git_statuses = get_git_status(AppState.TARGET_DIR)
                
    return {
        "items": items,
        "files": file_paths, 
        "graph": graph_state, 
        "active_file": AppState.ACTIVE_FILE,
        "target_dir_abs": AppState.TARGET_DIR,
        "git_statuses": git_statuses # ADDED TO PAYLOAD
    }

async def broadcast_workspace():
    state = get_workspace_state()
    message = json.dumps({"event": "SYNC", "payload": state})
    for conn in list(AppState.CONNECTIONS):
        try: await conn.send_text(message)
        except Exception: pass

class CodeWatcher(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop
        self.last_trigger = 0

    def on_any_event(self, event):
        current_time = time.time()
        if current_time - self.last_trigger > 0.5: 
            self.last_trigger = current_time
            asyncio.run_coroutine_threadsafe(broadcast_workspace(), self.loop)