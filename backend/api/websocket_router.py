# backend/api/websocket_router.py
import asyncio
import json
import os
import subprocess
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import networkx as nx

from ai.agent_supervisor import agent_supervisor
from ai.vector_search import vector_engine
from core.js_mutator import execute_js_file_merge
from core.state import AppState
from ml.analyzer import sanitize_for_json
from services.ai_service import fetch_ast_summary
from services.file_service import (
    create_item, delete_item, edit_code, move_item, 
    pick_folder_sync, refactor_symbol_move_service, 
    rename_item, reveal_in_explorer
)
from services.terminal_service import (
    kill_terminal_process, run_python_script_sync, 
    stream_terminal_command, write_terminal_stdin
)
from services.workspace_service import broadcast_workspace, get_workspace_state

router = APIRouter()


async def safe_send_json(websocket: WebSocket, payload: dict) -> bool:
    """
    Safely sends JSON over a WebSocket connection, suppressing runtime errors if disconnected.
    """
    try:
        if websocket in AppState.CONNECTIONS:
            sanitized = sanitize_for_json(payload)
            await websocket.send_json(sanitized)
            return True
    except Exception as e:
        print(f"[DEBUG] WebSocket send suppressed (Client disconnected): {e}")
        if websocket in AppState.CONNECTIONS:
            AppState.CONNECTIONS.remove(websocket)
    return False


async def broadcast_to_all(payload: dict) -> None:
    """
    Broadcasts a sanitized message to all active WebSocket connections simultaneously.
    """
    if not AppState.CONNECTIONS:
        return
    sanitized = sanitize_for_json(payload)
    disconnected = set()
    for ws in list(AppState.CONNECTIONS):
        try:
            await ws.send_json(sanitized)
        except Exception:
            disconnected.add(ws)
    for ws in disconnected:
        AppState.CONNECTIONS.discard(ws)


def trigger_background_indexing() -> None:
    """Spawns an asynchronous background thread to update the vector search memory store."""
    try:
        state = get_workspace_state()
        nodes = state.get("graph", {}).get("nodes", [])
        if nodes:
            asyncio.create_task(asyncio.to_thread(vector_engine.index_nodes, nodes))
    except Exception as e:
        print(f"[WARN] Background vector indexing trigger failed: {e}")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    AppState.CONNECTIONS.add(websocket)
    print(f"[INFO] Client connected. Total active connections: {len(AppState.CONNECTIONS)}")

    # Auto-seed default server.py if workspace is completely empty
    server_file = os.path.join(AppState.TARGET_DIR, "server.py")
    if not os.path.exists(server_file) and not os.path.exists(AppState.TARGET_DIR):
        try:
            create_item("server.py", "file")
        except Exception:
            pass

    # 1. EMIT SANITIZED INITIAL WORKSPACE STATE
    initial_state = get_workspace_state()
    await safe_send_json(websocket, {"event": "INIT", "payload": initial_state})

    # 2. 🚀 ASYNC VECTOR INDEXING ON CONNECT
    nodes_to_index = initial_state.get("graph", {}).get("nodes", [])
    if nodes_to_index:
        asyncio.create_task(asyncio.to_thread(vector_engine.index_nodes, nodes_to_index))

    try:
        while True:
            raw_data = await websocket.receive_text()
            if not raw_data or not raw_data.strip():
                continue

            message = json.loads(raw_data)
            evt = message.get("event")

            # -----------------------------------------------------------------
            # 0. HEARTBEAT PROTOCOL (Ping / Pong Latency)
            # -----------------------------------------------------------------
            if evt == "PING":
                await safe_send_json(websocket, {"event": "PONG"})

            # -----------------------------------------------------------------
            # 1. MULTI-TAB INTERACTIVE TERMINAL EMULATION
            # -----------------------------------------------------------------
            elif evt == "RUN_TERMINAL_COMMAND":
                session_id = message.get("session_id", "default")
                cmd = message.get("command", "")
                shell = message.get("shell_type", "powershell")
                cwd = message.get("cwd", AppState.TARGET_DIR)
                
                asyncio.create_task(stream_terminal_command(
                    websocket, session_id, cmd, shell, cwd
                ))

            elif evt == "TERMINAL_STDIN":
                session_id = message.get("session_id", "default")
                input_text = message.get("input", "")
                write_terminal_stdin(session_id, input_text)

            elif evt == "KILL_TERMINAL_PROCESS":
                session_id = message.get("session_id", "default")
                kill_terminal_process(session_id)

            # -----------------------------------------------------------------
            # 2. WORKSPACE DIRECTORY & FILE OPERATIONS
            # -----------------------------------------------------------------
            elif evt == "OPEN_FOLDER_DIALOG":
                chosen_dir = await asyncio.to_thread(pick_folder_sync)
                if chosen_dir and os.path.exists(chosen_dir):
                    AppState.TARGET_DIR = os.path.abspath(chosen_dir)
                    AppState.ACTIVE_FILE = ""
                    await broadcast_workspace(force_full_sync=True)
                    trigger_background_indexing()

            elif evt == "SWITCH_FILE":
                AppState.ACTIVE_FILE = message.get("filename", "")
                synced_state = get_workspace_state()
                await safe_send_json(websocket, {"event": "SYNC", "payload": synced_state})

            elif evt == "CREATE_ITEM":
                create_item(message.get("item_name", ""), message.get("item_type", "file"))
                await broadcast_workspace(force_full_sync=True)
                trigger_background_indexing()

            elif evt == "RENAME_ITEM":
                rename_item(message.get("old_path", ""), message.get("new_path", ""))
                await broadcast_workspace(force_full_sync=True)
                trigger_background_indexing()

            elif evt == "MOVE_ITEM":
                move_item(message.get("src_path", ""), message.get("dest_folder", ""))
                await broadcast_workspace(force_full_sync=True)
                trigger_background_indexing()

            elif evt == "DELETE_FILE":
                delete_item(message.get("filename", ""))
                await broadcast_workspace(force_full_sync=True)
                trigger_background_indexing()

            elif evt == "REVEAL_IN_EXPLORER":
                reveal_in_explorer(message.get("path", AppState.TARGET_DIR))

            elif evt == "CODE_EDIT":
                target_file = message.get("filename", AppState.ACTIVE_FILE)
                node_id = message.get("node_id", target_file)
                new_code = message.get("new_code", "")
                edit_code(node_id, new_code, target_file)
                trigger_background_indexing()

            elif evt == "NODE_MOVE":
                node_id = message.get("node_id")
                pos = message.get("position", {})

            # -----------------------------------------------------------------
            # 3. 🚀 NATURAL LANGUAGE SEMANTIC VECTOR SEARCH (ChromaDB + TF-IDF)
            # -----------------------------------------------------------------
            elif evt == "SEMANTIC_SEARCH":
                query_str = message.get("query", "")
                top_k = int(message.get("top_k", 8))

                async def process_semantic_search():
                    try:
                        results = await asyncio.to_thread(vector_engine.query, query_str, top_k)
                        await safe_send_json(websocket, {
                            "event": "SEMANTIC_SEARCH_RESULTS",
                            "query": query_str,
                            "results": results
                        })
                    except Exception as err:
                        print(f"[WARN] Error during semantic search for '{query_str}': {err}")

                asyncio.create_task(process_semantic_search())

            # -----------------------------------------------------------------
            # 4. HORIZON 3: AI AGENT SUPERVISOR (Live PR Blast Radius & Rollbacks)
            # -----------------------------------------------------------------
            elif evt == "AGENT_ROLLBACK_BATCH":
                batch_id = message.get("batch_id")

                async def handle_agent_rollback():
                    try:
                        success, reason = await asyncio.to_thread(
                            agent_supervisor.rollback_batch,
                            batch_id=batch_id,
                            workspace_root=AppState.TARGET_DIR
                        )
                        if success:
                            await broadcast_workspace(force_full_sync=True)
                            await safe_send_json(websocket, {
                                "event": "AGENT_ROLLBACK_SUCCESS",
                                "batch_id": batch_id,
                                "message": reason
                            })
                        else:
                            await safe_send_json(websocket, {
                                "event": "AGENT_ROLLBACK_ERROR",
                                "batch_id": batch_id,
                                "reason": reason
                            })
                    except Exception as err:
                        print(f"[ERROR] Agent rollback failed: {err}")

                asyncio.create_task(handle_agent_rollback())

            elif evt == "GET_AGENT_BATCH_DETAILS":
                summary = agent_supervisor.get_latest_batch_summary()
                await safe_send_json(websocket, {
                    "event": "AGENT_BATCH_DETAILS",
                    "payload": summary
                })

            # -----------------------------------------------------------------
            # 5. AI REFACTORING GUARD & AST SURGERY (AC-3 CSP Verification)
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
                            await safe_send_json(websocket, {
                                "event": "REFACTOR_CSP_VIOLATION",
                                "payload": result
                            })
                        else:
                            await safe_send_json(websocket, {
                                "event": "REFACTOR_SUCCESS",
                                "payload": result
                            })
                            await broadcast_workspace(force_full_sync=False)
                            trigger_background_indexing()

                    except Exception as err:
                        print(f"[ERROR] Refactoring symbol move transaction failed: {err}")
                        await safe_send_json(websocket, {
                            "event": "REFACTOR_ERROR",
                            "payload": {"success": False, "reason": str(err)}
                        })

                asyncio.create_task(handle_refactor())

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
                            success, msg = False, "Cross-language or Python module merging must be performed via symbol move."

                        if success:
                            await safe_send_json(websocket, {"event": "REFACTOR_FILE_MERGE_SUCCESS", "message": msg})
                            await broadcast_workspace(force_full_sync=True)
                            trigger_background_indexing()
                        else:
                            await safe_send_json(websocket, {"event": "REFACTOR_FILE_MERGE_ERROR", "reason": msg})
                    except Exception as err:
                        print(f"[ERROR] File merge failed: {err}")
                        await safe_send_json(websocket, {"event": "REFACTOR_FILE_MERGE_ERROR", "reason": str(err)})

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

                        node_map = {str(n["id"]): n for n in graph_nodes if n.get("id")}
                        target_node = node_map.get(str(node_id), {})
                        target_risk = target_node.get("data", {}).get("risk", "low")

                        connected_snippets: List[str] = []
                        for edge in graph_edges:
                            edge_type = edge.get("type", "")
                            if edge_type in ["call", "network_bridge", "import"]:
                                src = str(edge.get("source"))
                                tgt = str(edge.get("target"))

                                if src == str(node_id) and tgt in node_map:
                                    peer_code = node_map[tgt].get("data", {}).get("code")
                                    if peer_code:
                                        connected_snippets.append(peer_code)
                                elif tgt == str(node_id) and src in node_map:
                                    peer_code = node_map[src].get("data", {}).get("code")
                                    if peer_code:
                                        connected_snippets.append(peer_code)

                        summary = await fetch_ast_summary(
                            code_string=raw_code,
                            node_id=str(node_id),
                            connected_snippets=connected_snippets,
                            risk_level=target_risk
                        )

                        await safe_send_json(websocket, {
                            "event": "LLM_SUMMARY_READY",
                            "node_id": node_id,
                            "summary": summary
                        })
                    except Exception as err:
                        print(f"[WARN] Error generating Graph-RAG LLM summary for {node_id}: {err}")

                asyncio.create_task(process_llm_summary())

            # -----------------------------------------------------------------
            # 7. GRAPH IMPACT ANALYSIS (Bidirectional Blast Radius)
            # -----------------------------------------------------------------
            elif evt == "IMPACT_ANALYSIS":
                node_id = str(message.get("node_id", ""))
                state = get_workspace_state()
                edges = state.get("graph", {}).get("edges", [])
                
                DiG = nx.DiGraph()
                for edge in edges:
                    src = str(edge.get("source", ""))
                    tgt = str(edge.get("target", ""))
                    if src and tgt:
                        DiG.add_edge(src, tgt)

                try:
                    dependents = list(nx.ancestors(DiG, node_id)) if node_id in DiG else []
                    dependencies = list(nx.descendants(DiG, node_id)) if node_id in DiG else []
                    impacted_nodes = list(set([node_id] + dependents + dependencies))
                except Exception:
                    impacted_nodes = [node_id]

                await safe_send_json(websocket, {
                    "event": "BLAST_RADIUS",
                    "payload": impacted_nodes
                })

            # -----------------------------------------------------------------
            # 8. SUBPROCESS CODE EXECUTION
            # -----------------------------------------------------------------
            elif evt == "RUN_CODE":
                file_to_run = os.path.join(AppState.TARGET_DIR, AppState.ACTIVE_FILE)
                await safe_send_json(websocket, {
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
                        await safe_send_json(websocket, {"event": "TERMINAL_OUTPUT", "payload": res.stdout})
                    if res.stderr:
                        await safe_send_json(websocket, {"event": "TERMINAL_ERROR", "payload": res.stderr})
                    await safe_send_json(websocket, {
                        "event": "TERMINAL_OUTPUT", 
                        "payload": f"\nProcess exited with code {res.returncode}\n"
                    })
                except subprocess.TimeoutExpired:
                    await safe_send_json(websocket, {
                        "event": "TERMINAL_ERROR", 
                        "payload": "\nExecution Timed Out (15s limit).\n"
                    })

    except WebSocketDisconnect:
        AppState.CONNECTIONS.discard(websocket)
        print(f"[INFO] Client disconnected. Remaining active connections: {len(AppState.CONNECTIONS)}")
    except Exception as e:
        AppState.CONNECTIONS.discard(websocket)
        print(f"[WARN] WebSocket handler error: {e}")