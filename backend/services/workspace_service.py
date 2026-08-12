# backend/services/workspace_service.py
import os
import json
import time
import asyncio
from watchdog.events import FileSystemEventHandler
from core.state import AppState
from core.parser import parse_python_file

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

    graph_state = {"nodes": [], "edges": []}
    if AppState.ACTIVE_FILE:
        file_path = os.path.join(AppState.TARGET_DIR, AppState.ACTIVE_FILE)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                graph_state = parse_python_file(AppState.ACTIVE_FILE, f.read())
                
    return {
        "items": items,
        "files": file_paths, 
        "graph": graph_state, 
        "active_file": AppState.ACTIVE_FILE,
        "target_dir_abs": AppState.TARGET_DIR
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