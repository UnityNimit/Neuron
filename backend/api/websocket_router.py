# backend/api/websocket_router.py
import asyncio
import json
import os
import subprocess
from typing import Any, Dict, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import networkx as nx

from core.state import AppState
from services.workspace_service import get_workspace_state, broadcast_workspace
from services.file_service import (
    pick_folder_sync, create_item, rename_item, move_item, 
    delete_item, reveal_in_explorer, edit_code, refactor_symbol_move_service
)
from services.terminal_service import (
    stream_terminal_command, kill_terminal_process, run_python_script_sync
)
from services.ai_service import fetch_ast_summary
from ai.vector_search import vector_engine
from core.js_mutator import execute_js_file_merge
from ml.analyzer import sanitize_for_json

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    AppState.CONNECTIONS.add(websocket)
    print("[INFO] Frontend connected via WebSockets")

    # Auto-seed default server.py if workspace is completely uninitialized
    server_file = os.path.join(AppState.TARGET_DIR, "server.py")
    if not os.path.exists(server_file) and not os.path.exists(AppState.TARGET_DIR):
        try:
            create_item("server.py", "file")
        except Exception:
            pass

    # 1. EMIT SANITIZED INITIAL WORKSPACE STATE
    initial_state = sanitize_for_json(get_workspace_state())
    await websocket.send_json({"event": "INIT", "payload": initial_state})

    # 2. 🚀 ASYNC VECTOR INDEXING (Indexes workspace in background on boot)
    nodes_to_index = initial_state.get("graph", {}).get("nodes", [])
    if nodes_to_index:
        asyncio.create_task(asyncio.to_thread(vector_engine.index_nodes, nodes_to_index))

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
            # 3. 🚀 NATURAL LANGUAGE SEMANTIC VECTOR SEARCH (ChromaDB)
            # -----------------------------------------------------------------
            elif evt == "SEMANTIC_SEARCH":
                query_str = message.get("query", "")
                top_k = int(message.get("top_k", 8))

                async def process_semantic_search():
                    try:
                        results = await asyncio.to_thread(vector_engine.query, query_str, top_k)
                        await websocket.send_json({
                            "event": "SEMANTIC_SEARCH_RESULTS",
                            "query": query_str,
                            "results": sanitize_for_json(results)
                        })
                    except Exception as err:
                        print(f"[WARN] Error during semantic search: {err}")

                asyncio.create_task(process_semantic_search())

            # -----------------------------------------------------------------
            # 4. AI REFACTORING GUARD & LIBCST TRANSPLANT (CSP Solver)
            # -----------------------------------------------------------------
            elif evt == "REFACTOR_SYMBOL_MOVE":
                symbol_name = message.get("symbol_name")
                source_file = message.get("source_file")
                dest_file = message.get("dest_file")

                async def handle_refactor():
                    try:
                        result = await asyncio.to_thread(
                            refactor_symbol_move_service,
                            source_file=source_file,
                            dest_file=dest_file,
                            symbol_name=symbol_name
                        )

                        if not result.get("success", False):
                            await websocket.send_json({
                                "event": "REFACTOR_CSP_VIOLATION",
                                "payload": sanitize_for_json(result)
                            })
                        else:
                            await websocket.send_json({
                                "event": "REFACTOR_SUCCESS",
                                "payload": sanitize_for_json(result)
                            })
                            await broadcast_workspace()

                    except Exception as err:
                        print(f"[ERROR] Refactoring transaction failed: {err}")
                        await websocket.send_json({
                            "event": "REFACTOR_ERROR",
                            "payload": {"success": False, "reason": str(err)}
                        })

                asyncio.create_task(handle_refactor())

            # -----------------------------------------------------------------
            # 5. FILE-TO-FILE FUSION / MERGE
            # -----------------------------------------------------------------
            elif evt == "REFACTOR_FILE_MERGE":
                source_file = message.get("source_file")
                dest_file = message.get("dest_file")

                async def handle_file_merge():
                    try:
                        all_files = list(get_workspace_state().get("files", []))
                        src_ext = os.path.splitext(source_file)[1].lower()
                        dst_ext = os.path.splitext(dest_file)[1].lower()

                        js_exts = {".js", ".jsx", ".ts", ".tsx", ".mjs"}
                        if src_ext in js_exts and dst_ext in js_exts:
                            success, msg = await asyncio.to_thread(
                                execute_js_file_merge, source_file, dest_file, AppState.TARGET_DIR, all_files
                            )
                        else:
                            success, msg = False, "[WARN] Python module merging will be executed via AST symbol transplant."

                        if success:
                            await websocket.send_json({"event": "REFACTOR_FILE_MERGE_SUCCESS", "message": msg})
                            await broadcast_workspace()
                        else:
                            await websocket.send_json({"event": "REFACTOR_FILE_MERGE_ERROR", "reason": msg})
                    except Exception as err:
                        print(f"[ERROR] File merge failed: {err}")
                        await websocket.send_json({"event": "REFACTOR_FILE_MERGE_ERROR", "reason": str(err)})

                asyncio.create_task(handle_file_merge())

            # -----------------------------------------------------------------
            # 6. GRAPH-RAG LOCAL LLM INTELLIGENCE PIPELINE
            # -----------------------------------------------------------------
            elif evt == "REQUEST_LLM_SUMMARY":
                node_id = message.get("node_id")
                raw_code = message.get("code", "")

                async def process_llm_summary():
                    try:
                        state = get_workspace_state()
                        graph_nodes = state.get("graph", {}).get("nodes", [])
                        graph_edges = state.get("graph", {}).get("edges", [])

                        node_map = {n["id"]: n for n in graph_nodes}
                        target_node = node_map.get(node_id, {})
                        target_risk = target_node.get("data", {}).get("risk", "low")

                        connected_snippets: List[str] = []
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
                        print(f"[WARN] Error generating LLM summary for {node_id}: {err}")

                asyncio.create_task(process_llm_summary())

            # -----------------------------------------------------------------
            # 7. DEEP GRAPH IMPACT ANALYSIS (Bidirectional Blast Radius)
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
            # 8. CODE EXECUTION (Local Python Subprocess Runner)
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
            print("[INFO] Frontend disconnected from WebSockets")