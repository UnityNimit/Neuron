# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import sys
import time
import asyncio
import subprocess
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

# FIX: Global state to prevent Watchdog from defaulting to server.py
app_state = {"active_file": "server.py"}

def get_file_list():
    return [f for f in os.listdir(TARGET_DIR) if f.endswith(".py")]

def get_workspace_state(active_file: str):
    files = get_file_list()
    if active_file not in files:
        active_file = files[0] if files else None

    graph_state = {"nodes": [], "edges": []}
    if active_file:
        file_path = os.path.join(TARGET_DIR, active_file)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                graph_state = parse_python_file(active_file, f.read())
                
    return {"files": files, "graph": graph_state, "active_file": active_file}

async def broadcast_workspace():
    # Now perfectly tracks your current tab!
    state = get_workspace_state(app_state["active_file"])
    message = json.dumps({"event": "SYNC", "payload": state})
    for conn in active_connections:
        try:
            await conn.send_text(message)
        except Exception:
            pass

class CodeWatcher(FileSystemEventHandler):
    def __init__(self, loop):
        self.loop = loop
        self.last_trigger = 0

    def on_modified(self, event):
        if event.src_path.endswith(".py"):
            current_time = time.time()
            if current_time - self.last_trigger > 0.5: 
                self.last_trigger = current_time
                asyncio.run_coroutine_threadsafe(broadcast_workspace(), self.loop)

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    observer = Observer()
    observer.schedule(CodeWatcher(loop), path=TARGET_DIR, recursive=False)
    observer.start()
    print("👀 Watchdog is actively monitoring the workspace...")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
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
            
            if event_type == "SWITCH_FILE":
                app_state["active_file"] = message.get("filename")
                await websocket.send_json({"event": "SYNC", "payload": get_workspace_state(app_state["active_file"])})

            elif event_type == "CREATE_FILE":
                new_filename = message.get("filename")
                if not new_filename.endswith(".py"): new_filename += ".py"
                new_filepath = os.path.join(TARGET_DIR, new_filename)
                if not os.path.exists(new_filepath):
                    with open(new_filepath, "w", encoding="utf-8") as f:
                        f.write(f"def solve():\n    pass\n\nif __name__ == '__main__':\n    solve()")
                app_state["active_file"] = new_filename
                await broadcast_workspace()

            elif event_type == "DELETE_FILE":
                del_filename = message.get("filename")
                del_filepath = os.path.join(TARGET_DIR, del_filename)
                if os.path.exists(del_filepath):
                    os.remove(del_filepath)
                await broadcast_workspace()

            elif event_type == "CODE_EDIT":
                node_id = message["node_id"]
                new_code = message["new_code"]
                file_path = os.path.join(TARGET_DIR, app_state["active_file"])
                update_function_in_file(file_path, node_id, new_code)
                
            elif event_type == "IMPACT_ANALYSIS":
                node_id = message["node_id"]
                graph_state = get_workspace_state(app_state["active_file"])["graph"]
                G = nx.DiGraph() 
                for edge in graph_state["edges"]:
                    G.add_edge(edge["source"], edge["target"])
                try:
                    impacted_nodes = list(nx.ancestors(G, node_id))
                    impacted_nodes.append(node_id) 
                except Exception:
                    impacted_nodes = [node_id]
                await websocket.send_json({"event": "BLAST_RADIUS", "payload": impacted_nodes})

            
                    
    except WebSocketDisconnect:
        active_connections.remove(websocket)