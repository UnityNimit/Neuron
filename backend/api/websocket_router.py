# backend/api/websocket_router.py
import asyncio
import json
import os
import subprocess
from typing import List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import networkx as nx

from core.state import AppState
from services.workspace_service import get_workspace_state, broadcast_workspace
from services.file_service import (
    pick_folder_sync, create_item, rename_item, move_item, 
    delete_item, reveal_in_explorer, edit_code
)
from services.terminal_service import (
    stream_terminal_command, kill_terminal_process, run_python_script_sync
)
from services.ai_service import fetch_ast_summary
from ml.analyzer import sanitize_for_json

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    AppState.CONNECTIONS.add(websocket)
    print("🟢 Frontend Connected to WebSockets!")

    # Auto-seed default server.py if workspace is empty
    server_file = os.path.join(AppState.TARGET_DIR, "server.py")
    if not os.path.exists(server_file) and not os.path.exists(AppState.TARGET_DIR):
        try:
            create_item("server.py", "file")
        except Exception:
            pass

    # 1. EMIT SANITIZED INITIAL WORKSPACE STATE
    initial_state = sanitize_for_json(get_workspace_state())
    await websocket.send_json({"event": "INIT", "payload": initial_state})

    try:
        while True:
            raw_data = await websocket.receive_text()
            message = json.loads(raw_data)
            evt = message.get("event")

            # -----------------------------------------------------------------
            # 1. MULTI-TAB INTERACTIVE TERMINAL EMULATION
            # -----------------------------------------------------------------
            if evt == "RUN_TERMINAL_COMMAND":
                asyncio.create_task(stream_terminal_command(
                    websocket, 
                    message["session_id"], 
                    message["command"],
                    message.get("shell_type", "powershell"), 
                    message.get("cwd", AppState.TARGET_DIR)
                ))

            elif evt == "KILL_TERMINAL_PROCESS":
                kill_terminal_process(message["session_id"])

            # -----------------------------------------------------------------
            # 2. WORKSPACE DIRECTORY & FILE MANAGEMENT
            # -----------------------------------------------------------------
            elif evt == "OPEN_FOLDER_DIALOG":
                chosen_dir = await asyncio.to_thread(pick_folder_sync)
                if chosen_dir and os.path.exists(chosen_dir):
                    AppState.TARGET_DIR = os.path.abspath(chosen_dir)
                    AppState.ACTIVE_FILE = ""
                    await broadcast_workspace()

            elif evt == "SWITCH_FILE":
                AppState.ACTIVE_FILE = message.get("filename", "")
                synced_state = sanitize_for_json(get_workspace_state())
                await websocket.send_json({"event": "SYNC", "payload": synced_state})

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
                target_file = message.get("filename", AppState.ACTIVE_FILE)
                edit_code(message["node_id"], message["new_code"], target_file)

            # -----------------------------------------------------------------
            # 3. GRAPH-RAG LOCAL LLM INTELLIGENCE PIPELINE
            # -----------------------------------------------------------------
            elif evt == "REQUEST_LLM_SUMMARY":
                node_id = message.get("node_id")
                raw_code = message.get("code", "")

                async def process_llm_summary():
                    try:
                        # Extract live Subgraph Context (Graph-RAG)
                        state = get_workspace_state()
                        graph_nodes = state.get("graph", {}).get("nodes", [])
                        graph_edges = state.get("graph", {}).get("edges", [])

                        node_map = {n["id"]: n for n in graph_nodes}
                        target_node = node_map.get(node_id, {})
                        target_risk = target_node.get("data", {}).get("risk", "low")

                        # Harvest connected code snippets across calls and network bridges
                        connected_snippets = []
                        for edge in graph_edges:
                            edge_type = edge.get("type", "")
                            if edge_type in ["call", "network_bridge"]:
                                src = edge.get("source")
                                tgt = edge.get("target")

                                if src == node_id and tgt in node_map:
                                    peer_code = node_map[tgt].get("data", {}).get("code")
                                    if peer_code:
                                        connected_snippets.append(peer_code)
                                elif tgt == node_id and src in node_map:
                                    peer_code = node_map[src].get("data", {}).get("code")
                                    if peer_code:
                                        connected_snippets.append(peer_code)

                        # Invoke Graph-RAG Service (0ms on cache hit, async LLM otherwise)
                        summary = await fetch_ast_summary(
                            code_string=raw_code,
                            node_id=node_id,
                            connected_snippets=connected_snippets,
                            risk_level=target_risk
                        )

                        await websocket.send_json({
                            "event": "LLM_SUMMARY_READY",
                            "node_id": node_id,
                            "summary": summary
                        })
                    except Exception as err:
                        print(f"⚠️ Error generating LLM summary for {node_id}: {err}")

                asyncio.create_task(process_llm_summary())

            # -----------------------------------------------------------------
            # 4. DEEP GRAPH IMPACT ANALYSIS (Bidirectional Blast Radius)
            # -----------------------------------------------------------------
            elif evt == "IMPACT_ANALYSIS":
                node_id = message["node_id"]
                state = get_workspace_state()
                edges = state.get("graph", {}).get("edges", [])
                
                DiG = nx.DiGraph()
                for edge in edges:
                    if edge.get("type") in ["call", "network_bridge", "hierarchy"]:
                        DiG.add_edge(edge["source"], edge["target"])

                try:
                    # Upstream callers (what will break) + Downstream dependencies
                    dependents = list(nx.ancestors(DiG, node_id)) if node_id in DiG else []
                    dependencies = list(nx.descendants(DiG, node_id)) if node_id in DiG else []
                    impacted_nodes = list(set([node_id] + dependents + dependencies))
                except Exception:
                    impacted_nodes = [node_id]

                await websocket.send_json({
                    "event": "BLAST_RADIUS",
                    "payload": impacted_nodes
                })

            # -----------------------------------------------------------------
            # 5. CODE EXECUTION (Local Python Subprocess Runner)
            # -----------------------------------------------------------------
            elif evt == "RUN_CODE":
                file_to_run = os.path.join(AppState.TARGET_DIR, AppState.ACTIVE_FILE)
                await websocket.send_json({
                    "event": "TERMINAL_OUTPUT", 
                    "payload": f"Executing {AppState.ACTIVE_FILE}...\n"
                })
                try:
                    res = await asyncio.to_thread(
                        run_python_script_sync, 
                        file_to_run, 
                        message.get("stdin", "")
                    )
                    if res.stdout:
                        await websocket.send_json({"event": "TERMINAL_OUTPUT", "payload": res.stdout})
                    if res.stderr:
                        await websocket.send_json({"event": "TERMINAL_ERROR", "payload": res.stderr})
                    await websocket.send_json({
                        "event": "TERMINAL_OUTPUT", 
                        "payload": f"\nProcess exited with code {res.returncode}\n"
                    })
                except subprocess.TimeoutExpired:
                    await websocket.send_json({
                        "event": "TERMINAL_ERROR", 
                        "payload": "\nExecution Timed Out (15s limit).\n"
                    })

    except WebSocketDisconnect:
        if websocket in AppState.CONNECTIONS:
            AppState.CONNECTIONS.remove(websocket)
            print("🔴 Frontend Disconnected from WebSockets")