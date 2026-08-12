# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import sys
import time
import shutil
import asyncio
import subprocess
import tkinter as tk
from tkinter import filedialog
import networkx as nx
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from core.parser import parse_python_file
from core.mutator import update_function_in_file

app = FastAPI(title="Neuron Spatial IDE Backend")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

active_connections = set()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "benchmark_repos", "sample_app"))
os.makedirs(TARGET_DIR, exist_ok=True)

app_state = {"active_file": "server.py"}
EXCLUDE_DIRS = {'.git', 'venv', 'node_modules', '__pycache__', 'dist', 'build', '.idea', '.vscode'}

def get_file_list():
    """Recursively scans TARGET_DIR for all files AND empty folders using os.walk"""
    items = []
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for d in dirs:
            rel_path = os.path.relpath(os.path.join(root, d), TARGET_DIR).replace("\\", "/")
            items.append({"path": rel_path, "type": "folder"})
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), TARGET_DIR).replace("\\", "/")
            items.append({"path": rel_path, "type": "file"})
            
    # PERFECT VS CODE HIERARCHY SORTING
    def sort_key(item):
        parts = item["path"].split("/")
        key = []
        for i, part in enumerate(parts):
            is_last = (i == len(parts) - 1)
            # 0 for folder, 1 for file -> forces folders to appear before files at the SAME level
            is_file = 1 if (is_last and item["type"] == "file") else 0
            key.append((is_file, part.lower()))
        return key

    return sorted(items, key=sort_key)

def get_workspace_state(active_file: str):
    items = get_file_list()
    file_paths = [i["path"] for i in items if i["type"] == "file"]
    if active_file not in file_paths and file_paths:
        active_file = file_paths[0]

    graph_state = {"nodes": [], "edges": []}
    if active_file:
        file_path = os.path.join(TARGET_DIR, active_file)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                graph_state = parse_python_file(active_file, f.read())
                
    return {
        "items": items,
        "files": file_paths, 
        "graph": graph_state, 
        "active_file": active_file,
        "target_dir_abs": TARGET_DIR
    }

async def broadcast_workspace():
    state = get_workspace_state(app_state["active_file"])
    message = json.dumps({"event": "SYNC", "payload": state})
    for conn in list(active_connections):
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

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    observer = Observer()
    observer.schedule(CodeWatcher(loop), path=TARGET_DIR, recursive=True)
    observer.start()
    print("👀 Watchdog actively monitoring workspace...")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global TARGET_DIR
    
    await websocket.accept()
    active_connections.add(websocket)
    print("🟢 Frontend Connected to WebSockets!")
    
    if not os.path.exists(os.path.join(TARGET_DIR, "server.py")):
        with open(os.path.join(TARGET_DIR, "server.py"), "w") as f:
            f.write("def solve():\n    print('Hello from Neuron!')\n\nif __name__ == '__main__':\n    solve()")
    
    await websocket.send_json({"event": "INIT", "payload": get_workspace_state(app_state["active_file"])})
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            event_type = message.get("event")
            
            # --- PERFECT THREAD-SAFE SHELL EXECUTION (CMD / POWERSHELL / BASH) ---
            if event_type == "RUN_TERMINAL_COMMAND":
                session_id = message.get("session_id")
                command = message.get("command", "").strip()
                shell_type = message.get("shell_type", "powershell") # 'powershell', 'cmd', or 'bash'
                cwd = message.get("cwd", TARGET_DIR)
                
                def run_shell_command():
                    if sys.platform == "win32":
                        if shell_type == "cmd":
                            full_cmd = f'cd /d "{cwd}" && {command} && echo __NEURON_CWD__:%cd%'
                            args = ["cmd.exe", "/c", full_cmd]
                        else: # Default PowerShell
                            full_cmd = f'Set-Location -Path "{cwd}"; {command}; Write-Output "__NEURON_CWD__:" (Get-Location).Path'
                            args = ["powershell.exe", "-NoProfile", "-Command", full_cmd]
                    else: # Linux / Mac
                        full_cmd = f'cd "{cwd}" && {command} && echo "__NEURON_CWD__:"$(pwd)'
                        args = ["/bin/sh", "-c", full_cmd]

                    custom_env = os.environ.copy()
                    custom_env["PYTHONIOENCODING"] = "utf-8"

                    proc = subprocess.run(
                        args,
                        cwd=cwd,
                        capture_output=True,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                        env=custom_env,
                        timeout=60.0
                    )

                    stdout = proc.stdout
                    new_cwd = cwd

                    if "__NEURON_CWD__:" in stdout:
                        parts = stdout.split("__NEURON_CWD__:")
                        stdout = parts[0].rstrip()
                        new_cwd = parts[1].strip()

                    return stdout, proc.stderr, new_cwd

                try:
                    stdout, stderr, new_cwd = await asyncio.to_thread(run_shell_command)
                    await websocket.send_json({
                        "event": "TERMINAL_RESPONSE",
                        "session_id": session_id,
                        "command": command,
                        "stdout": stdout,
                        "stderr": stderr,
                        "new_cwd": new_cwd
                    })
                except Exception as e:
                    await websocket.send_json({
                        "event": "TERMINAL_RESPONSE",
                        "session_id": session_id,
                        "command": command,
                        "stdout": "",
                        "stderr": str(e),
                        "new_cwd": cwd
                    })

            # --- NATIVE OS FOLDER PICKER ---
            elif event_type == "OPEN_FOLDER_DIALOG":
                def pick_folder():
                    root = tk.Tk()
                    root.withdraw()
                    root.attributes('-topmost', True)
                    folder_selected = filedialog.askdirectory(initialdir=TARGET_DIR, title="Select Project Folder")
                    root.destroy()
                    return folder_selected

                try:
                    chosen_dir = await asyncio.to_thread(pick_folder)
                    if chosen_dir and os.path.exists(chosen_dir):
                        TARGET_DIR = os.path.abspath(chosen_dir)
                        app_state["active_file"] = ""
                        print(f"📁 Opened new workspace: {TARGET_DIR}")
                        await broadcast_workspace()
                except Exception as e: print(f"Folder picker error: {e}")

            elif event_type == "SWITCH_FILE":
                app_state["active_file"] = message.get("filename")
                await websocket.send_json({"event": "SYNC", "payload": get_workspace_state(app_state["active_file"])})

            # --- CREATE FILES OR FOLDERS ---
            elif event_type == "CREATE_ITEM":
                item_name = message.get("item_name")
                item_type = message.get("item_type")
                full_path = os.path.join(TARGET_DIR, item_name)
                if item_type == 'folder': os.makedirs(full_path, exist_ok=True)
                else:
                    os.makedirs(os.path.dirname(full_path), exist_ok=True)
                    if not os.path.exists(full_path):
                        with open(full_path, "w", encoding="utf-8") as f:
                            if full_path.endswith('.py'): f.write("def solve():\n    pass\n\nif __name__ == '__main__':\n    solve()")
                            else: f.write("")
                    app_state["active_file"] = item_name
                await broadcast_workspace()

            # --- RENAME FILE OR FOLDER ---
            elif event_type == "RENAME_ITEM":
                old_rel = message.get("old_path")
                new_rel = message.get("new_path")
                old_full = os.path.join(TARGET_DIR, old_rel)
                new_full = os.path.join(TARGET_DIR, new_rel)
                if os.path.exists(old_full):
                    os.makedirs(os.path.dirname(new_full), exist_ok=True)
                    os.rename(old_full, new_full)
                    if app_state["active_file"] == old_rel: app_state["active_file"] = new_rel
                await broadcast_workspace()

            # --- DRAG AND DROP MOVE ITEM ---
            elif event_type == "MOVE_ITEM":
                src_rel = message.get("src_path")
                dest_folder_rel = message.get("dest_folder")
                src_full = os.path.join(TARGET_DIR, src_rel)
                dest_full_folder = os.path.join(TARGET_DIR, dest_folder_rel) if dest_folder_rel else TARGET_DIR
                if os.path.exists(src_full) and os.path.exists(dest_full_folder):
                    dest_full = os.path.join(dest_full_folder, os.path.basename(src_full))
                    if src_full != dest_full: shutil.move(src_full, dest_full)
                await broadcast_workspace()

            # --- REVEAL IN WINDOWS EXPLORER / MAC FINDER ---
            elif event_type == "REVEAL_IN_EXPLORER":
                rel_path = message.get("path")
                full_path = os.path.join(TARGET_DIR, rel_path) if rel_path else TARGET_DIR
                if os.path.exists(full_path):
                    if sys.platform == "win32": subprocess.run(["explorer", "/select,", os.path.normpath(full_path)])
                    elif sys.platform == "darwin": subprocess.run(["open", "-R", full_path])
                    else: subprocess.run(["xdg-open", os.path.dirname(full_path)])

            # --- DELETE FILES OR FOLDERS ---
            elif event_type == "DELETE_FILE":
                del_filename = message.get("filename")
                del_filepath = os.path.join(TARGET_DIR, del_filename)
                if os.path.exists(del_filepath):
                    if os.path.isdir(del_filepath): shutil.rmtree(del_filepath)
                    else: os.remove(del_filepath)
                await broadcast_workspace()

            # --- TARGETED CODE EDITING (NO FILE RESET RACE CONDITIONS) ---
            elif event_type == "CODE_EDIT":
                node_id = message["node_id"]
                new_code = message["new_code"]
                target_file_name = message.get("filename", app_state["active_file"])
                for prefix in ["📝 ", "ƒ ", "📄 "]:
                    if target_file_name.startswith(prefix): target_file_name = target_file_name.replace(prefix, "")
                if " (Whole File)" in target_file_name: target_file_name = target_file_name.replace(" (Whole File)", "")
                file_path = os.path.join(TARGET_DIR, target_file_name)
                if node_id == target_file_name or node_id.endswith(target_file_name) or not target_file_name.endswith('.py'):
                    with open(file_path, "w", encoding="utf-8") as f: f.write(new_code)
                else: update_function_in_file(file_path, node_id, new_code)
                
            elif event_type == "IMPACT_ANALYSIS":
                node_id = message["node_id"]
                graph_state = get_workspace_state(app_state["active_file"])["graph"]
                G = nx.DiGraph() 
                for edge in graph_state["edges"]: G.add_edge(edge["source"], edge["target"])
                try:
                    impacted_nodes = list(nx.ancestors(G, node_id))
                    impacted_nodes.append(node_id) 
                except Exception: impacted_nodes = [node_id]
                await websocket.send_json({"event": "BLAST_RADIUS", "payload": impacted_nodes})

            elif event_type == "RUN_CODE":
                file_to_run = os.path.join(TARGET_DIR, app_state["active_file"])
                stdin_data = message.get("stdin", "")
                await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": f">>> Executing {app_state['active_file']}...\n"})
                
                def execute_code():
                    custom_env = os.environ.copy()
                    custom_env["PYTHONIOENCODING"] = "utf-8"
                    return subprocess.run(
                        [sys.executable, file_to_run],
                        cwd=TARGET_DIR, capture_output=True, text=True, encoding="utf-8", env=custom_env, timeout=15.0,
                        input=stdin_data
                    )
                
                try:
                    result = await asyncio.to_thread(execute_code)
                    if result.stdout: await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": result.stdout})
                    if result.stderr: await websocket.send_json({"event": "TERMINAL_ERROR", "payload": result.stderr})
                    await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": f"\n>>> Process finished with exit code {result.returncode}\n"})
                except subprocess.TimeoutExpired:
                    await websocket.send_json({"event": "TERMINAL_ERROR", "payload": "\n❌ ERROR: Execution Timed Out.\n"})
                except Exception as e:
                    await websocket.send_json({"event": "TERMINAL_ERROR", "payload": f"\n❌ System Error: {repr(e)}\n"})
                    
    except WebSocketDisconnect:
        if websocket in active_connections: active_connections.remove(websocket)