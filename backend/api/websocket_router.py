# backend/api/websocket_router.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import os
import asyncio
import networkx as nx
import subprocess  # CRITICAL FIX: Required for subprocess.TimeoutExpired

from core.state import AppState
from services.workspace_service import get_workspace_state, broadcast_workspace
from services.file_service import (pick_folder_sync, create_item, rename_item, move_item, delete_item, reveal_in_explorer, edit_code)
from services.terminal_service import stream_terminal_command, kill_terminal_process, run_python_script_sync

# NEW: Import the headless AI service
from services.ai_service import fetch_ast_summary 

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    AppState.CONNECTIONS.add(websocket)
    print("🟢 Frontend Connected to WebSockets!")
    
    if not os.path.exists(os.path.join(AppState.TARGET_DIR, "server.py")):
        create_item("server.py", "file")
        
    await websocket.send_json({"event": "INIT", "payload": get_workspace_state()})
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            evt = message.get("event")
            
            if evt == "RUN_TERMINAL_COMMAND":
                asyncio.create_task(stream_terminal_command(
                    websocket, message["session_id"], message["command"], 
                    message.get("shell_type", "powershell"), message.get("cwd", AppState.TARGET_DIR)
                ))

            elif evt == "KILL_TERMINAL_PROCESS":
                kill_terminal_process(message["session_id"])

            elif evt == "OPEN_FOLDER_DIALOG":
                chosen_dir = await asyncio.to_thread(pick_folder_sync)
                if chosen_dir and os.path.exists(chosen_dir):
                    AppState.TARGET_DIR = os.path.abspath(chosen_dir)
                    AppState.ACTIVE_FILE = ""
                    await broadcast_workspace()

            elif evt == "SWITCH_FILE":
                AppState.ACTIVE_FILE = message.get("filename")
                await websocket.send_json({"event": "SYNC", "payload": get_workspace_state()})

            elif evt == "CREATE_ITEM":
                create_item(message["item_name"], message["item_type"])
                await broadcast_workspace()

            elif evt == "RENAME_ITEM":
                rename_item(message["old_path"], message["new_path"])
                await broadcast_workspace()

            elif evt == "MOVE_ITEM":
                move_item(message["src_path"], message["dest_folder"])
                await broadcast_workspace()

            elif evt == "DELETE_FILE":
                delete_item(message["filename"])
                await broadcast_workspace()

            elif evt == "REVEAL_IN_EXPLORER":
                reveal_in_explorer(message.get("path"))

            elif evt == "CODE_EDIT":
                edit_code(message["node_id"], message["new_code"], message.get("filename", AppState.ACTIVE_FILE))

            elif evt == "IMPACT_ANALYSIS":
                node_id = message["node_id"]
                edges = get_workspace_state()["graph"]["edges"]
                G = nx.DiGraph() 
                for edge in edges: G.add_edge(edge["source"], edge["target"])
                try:
                    impacted_nodes = list(nx.ancestors(G, node_id))
                    impacted_nodes.append(node_id) 
                except Exception: impacted_nodes = [node_id]
                await websocket.send_json({"event": "BLAST_RADIUS", "payload": impacted_nodes})

            elif evt == "RUN_CODE":
                file_to_run = os.path.join(AppState.TARGET_DIR, AppState.ACTIVE_FILE)
                await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": f">>> Executing {AppState.ACTIVE_FILE}...\n"})
                try:
                    res = await asyncio.to_thread(run_python_script_sync, file_to_run, message.get("stdin", ""))
                    if res.stdout: await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": res.stdout})
                    if res.stderr: await websocket.send_json({"event": "TERMINAL_ERROR", "payload": res.stderr})
                    await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": f"\n>>> Process finished with exit code {res.returncode}\n"})
                except subprocess.TimeoutExpired:
                    await websocket.send_json({"event": "TERMINAL_ERROR", "payload": "\n❌ ERROR: Execution Timed Out.\n"})

            # --- NEW ASYNC AI INTEGRATION ---
            elif evt == "REQUEST_LLM_SUMMARY":
                node_id = message["node_id"]
                code_payload = message["code"]
                print(f"🟡 2. Backend received LLM request for {node_id}")
                
                async def process_summary():
                    summary = await fetch_ast_summary(code_payload)
                    # Safety check: Ensure the client hasn't disconnected during inference
                    if websocket in AppState.CONNECTIONS:
                        try:
                            await websocket.send_json({
                                "event": "LLM_SUMMARY_READY",
                                "node_id": node_id,
                                "summary": summary
                            })
                        except Exception:
                            pass
                            
                # Fire and forget: protect the main WebSocket event loop
                asyncio.create_task(process_summary())
                    
    except WebSocketDisconnect:
        if websocket in AppState.CONNECTIONS: 
            AppState.CONNECTIONS.remove(websocket)