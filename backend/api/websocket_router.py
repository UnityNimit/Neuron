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
    kill_terminal_process, run_code_polyglot_sync, run_python_script_sync, 
    stream_terminal_command, write_terminal_stdin
)
from services.git_service import (
    git_commit, git_push, git_stage, git_unstage, git_discard,
    git_get_detailed_status, git_get_log_graph
)
from services.workspace_service import broadcast_workspace, get_workspace_state, reset_workspace_mutation_tracker

router = APIRouter()
_RECENT_SAVE_TIMESTAMPS: list = []


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


async def safe_send_to_active(websocket: WebSocket, payload: dict) -> bool:
    """
    Tries sending to the originating websocket; if disconnected, falls back to broadcasting
    to any active connection in AppState.CONNECTIONS so results are never dropped.
    """
    sent = await safe_send_json(websocket, payload)
    if not sent and AppState.CONNECTIONS:
        await broadcast_to_all(payload)
        return True
    return sent


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
        async def run_indexing():
            state = await asyncio.to_thread(get_workspace_state)
            nodes = state.get("graph", {}).get("nodes", [])
            if nodes:
                await asyncio.to_thread(vector_engine.index_nodes, nodes)
        asyncio.create_task(run_indexing())
    except Exception as e:
        print(f"[WARN] Background vector indexing trigger failed: {e}")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # SUB-2MS NON-BLOCKING HANDSHAKE
    await websocket.accept()
    AppState.CONNECTIONS.add(websocket)
    print(f"[INFO] Client connected. Active connections: {len(AppState.CONNECTIONS)}")

    # Auto-seed default server.py if workspace is completely empty
    server_file = os.path.join(AppState.TARGET_DIR, "server.py")
    if not os.path.exists(server_file) and not os.path.exists(AppState.TARGET_DIR):
        try:
            create_item("server.py", "file")
        except Exception:
            pass

    # Reset mutation tracker and clear any lingering agent supervisor batches on connect
    reset_workspace_mutation_tracker()

    # 1. EMIT INITIAL WORKSPACE STATE ASYNCHRONOUSLY
    initial_state = await asyncio.to_thread(get_workspace_state, True)
    if AppState.USER_SESSION:
        initial_state["user_session"] = AppState.USER_SESSION
    graph = await asyncio.to_thread(git_get_log_graph, AppState.TARGET_DIR, 40)
    initial_state["git_graph"] = graph
    await safe_send_json(websocket, {"event": "INIT", "payload": initial_state})

    # 2. ASYNC VECTOR INDEXING (Zero blocking on main loop)
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

            if evt == "LOGOUT":
                AppState.USER_SESSION = None
                for ws in list(AppState.CONNECTIONS):
                    await safe_send_json(ws, {"event": "AUTH_LOGOUT"})
                continue

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
                target = message.get("target_dir") or message.get("path")
                if target and os.path.exists(target):
                    chosen_dir = target
                else:
                    chosen_dir = await asyncio.to_thread(pick_folder_sync)
                if chosen_dir and os.path.exists(chosen_dir):
                    AppState.TARGET_DIR = os.path.abspath(chosen_dir)
                    AppState.ACTIVE_FILE = ""
                    reset_workspace_mutation_tracker()
                    # 🚀 Instantly notify frontend to display the minimalist loading screen
                    await broadcast_to_all({
                        "event": "WORKSPACE_LOADING",
                        "target_dir": AppState.TARGET_DIR
                    })
                    await broadcast_workspace(force_full_sync=True)
                    trigger_background_indexing()
                else:
                    await safe_send_json(websocket, {
                        "event": "FOLDER_PICK_CANCELLED"
                    })

            elif evt == "OPEN_FOLDER":
                folder_path = message.get("path") or message.get("target_dir", "")
                if folder_path and os.path.exists(folder_path):
                    AppState.TARGET_DIR = os.path.abspath(folder_path)
                    AppState.ACTIVE_FILE = ""
                    reset_workspace_mutation_tracker()
                    # 🚀 Instantly notify frontend to display the minimalist loading screen
                    await broadcast_to_all({
                        "event": "WORKSPACE_LOADING",
                        "target_dir": AppState.TARGET_DIR
                    })
                    await broadcast_workspace(force_full_sync=True)
                    trigger_background_indexing()

            elif evt == "SWITCH_FILE":
                new_file = message.get("filename", "")
                AppState.ACTIVE_FILE = new_file

                # Fast path: Read file directly in <1ms without full AST re-parse
                file_content = ""
                if new_file:
                    clean_path = new_file.replace("\\", "/").strip().lstrip("/")
                    full_path = os.path.join(AppState.TARGET_DIR, clean_path)
                    if os.path.exists(full_path) and os.path.isfile(full_path):
                        ext = os.path.splitext(clean_path)[1].lower()
                        binary_exts = {
                            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".avif",
                            ".exe", ".dll", ".so", ".dylib", ".bin", ".iso", ".zip", ".tar",
                            ".gz", ".7z", ".rar", ".mp4", ".mkv", ".avi", ".mov", ".webm",
                            ".mp3", ".wav", ".pdf"
                        }
                        if ext not in binary_exts:
                            try:
                                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                                    file_content = f.read()
                            except Exception:
                                pass

                await safe_send_json(websocket, {
                    "event": "FILE_SWITCH_ACK",
                    "active_file": new_file,
                    "content": file_content
                })

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

            # 🚀 DIRECT WHOLE-FILE ATOMIC SAVE (VS Code Standard)
            elif evt == "SAVE_FILE":
                target_file = message.get("filename", AppState.ACTIVE_FILE)
                new_content = message.get("content", "")

                async def handle_save_file():
                    try:
                        if AppState.BLAST_PROTECTION_ENABLED:
                            now = time.time()
                            global _RECENT_SAVE_TIMESTAMPS
                            _RECENT_SAVE_TIMESTAMPS = [t for t in _RECENT_SAVE_TIMESTAMPS if now - t < 1.0]
                            _RECENT_SAVE_TIMESTAMPS.append(now)
                            if len(_RECENT_SAVE_TIMESTAMPS) > 6:
                                await safe_send_json(websocket, {
                                    "event": "SAVE_FILE_ERROR",
                                    "filename": target_file,
                                    "reason": "Blast Protection Active: Throttled rapid automated save flood (>6 saves/sec)."
                                })
                                return

                        clean_path = target_file.replace("\\", "/").lstrip("/")
                        full_path = os.path.abspath(os.path.join(AppState.TARGET_DIR, clean_path))
                        
                        os.makedirs(os.path.dirname(full_path), exist_ok=True)
                        with open(full_path, "w", encoding="utf-8") as f:
                            f.write(new_content)

                        await safe_send_json(websocket, {
                            "event": "SAVE_FILE_SUCCESS",
                            "filename": target_file
                        })
                        await broadcast_workspace(force_full_sync=False)
                        trigger_background_indexing()
                    except Exception as err:
                        print(f"[ERROR] Failed saving {target_file}: {err}")
                        await safe_send_json(websocket, {
                            "event": "SAVE_FILE_ERROR",
                            "filename": target_file,
                            "reason": str(err)
                        })

                asyncio.create_task(handle_save_file())

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
            # 3. NATURAL LANGUAGE SEMANTIC VECTOR SEARCH (TF-IDF + Lexical)
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
            # 4. HORIZON 3: AI AGENT SUPERVISOR & 1-CLICK ROLLBACKS
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

            elif evt == "AGENT_APPROVE_BATCH":
                batch_id = message.get("batch_id")
                if batch_id in agent_supervisor.active_batches:
                    batch = agent_supervisor.active_batches[batch_id]
                    if batch.is_rolled_back:
                        await asyncio.to_thread(
                            agent_supervisor.reapply_batch,
                            batch_id=batch_id,
                            workspace_root=AppState.TARGET_DIR
                        )
                        await broadcast_workspace(force_full_sync=True)
                    else:
                        batch.is_committed = True
                await safe_send_json(websocket, {
                    "event": "AGENT_APPROVE_SUCCESS", 
                    "batch_id": batch_id
                })

            elif evt == "SET_BLAST_PROTECTION":
                enabled = bool(message.get("enabled", False))
                AppState.BLAST_PROTECTION_ENABLED = enabled
                if not enabled:
                    agent_supervisor.active_batches.clear()
                    agent_supervisor.current_burst_id = None
                    agent_supervisor.file_content_snapshots.clear()
                await broadcast_to_all({
                    "event": "BLAST_PROTECTION_CHANGED",
                    "enabled": enabled
                })

            elif evt == "GET_AGENT_BATCH_DETAILS":
                summary = agent_supervisor.get_latest_batch_summary()
                await safe_send_json(websocket, {
                    "event": "AGENT_BATCH_DETAILS",
                    "payload": summary
                })

            # -----------------------------------------------------------------
            # 5. AI REFACTORING GUARD & LIBCST TRANSPLANT
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
                        print(f"[ERROR] Refactoring symbol move failed: {err}")
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
                        state = await asyncio.to_thread(get_workspace_state)
                        all_files = list(state.get("files", []))
                        src_ext = os.path.splitext(source_file)[1].lower()
                        dst_ext = os.path.splitext(dest_file)[1].lower()

                        js_exts = {".js", ".jsx", ".ts", ".tsx", ".mjs"}
                        if src_ext in js_exts and dst_ext in js_exts:
                            success, msg = await asyncio.to_thread(
                                execute_js_file_merge, source_file, dest_file, AppState.TARGET_DIR, all_files
                            )
                        else:
                            success, msg = False, "Cross-language module merging must be performed via symbol move."

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

            elif evt == "REFACTOR_UNDO":
                latest_batch_id = list(agent_supervisor.active_batches.keys())[-1] if agent_supervisor.active_batches else None
                if latest_batch_id:
                    success, reason = await asyncio.to_thread(
                        agent_supervisor.rollback_batch,
                        batch_id=latest_batch_id,
                        workspace_root=AppState.TARGET_DIR
                    )
                    if success:
                        await broadcast_workspace(force_full_sync=True)
                        await safe_send_json(websocket, {"event": "REFACTOR_UNDO_SUCCESS", "message": reason})
                    else:
                        await safe_send_json(websocket, {"event": "REFACTOR_UNDO_ERROR", "reason": reason})

            # -----------------------------------------------------------------
            # 6. GRAPH-RAG LOCAL LLM INTELLIGENCE PIPELINE
            # -----------------------------------------------------------------
            elif evt == "REQUEST_LLM_SUMMARY":
                node_id = message.get("node_id")
                raw_code = message.get("code", "")

                async def process_llm_summary():
                    try:
                        state = await asyncio.to_thread(get_workspace_state)
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
                state = await asyncio.to_thread(get_workspace_state)
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
            # 8. SUBPROCESS CODE EXECUTION (Universal Polyglot Runner)
            # -----------------------------------------------------------------
            elif evt == "RUN_CODE":
                target_file = message.get("filename") or AppState.ACTIVE_FILE
                if not target_file:
                    await safe_send_to_active(websocket, {
                        "event": "TERMINAL_ERROR",
                        "payload": "[ERROR] No active file selected to execute.\n"
                    })
                    continue

                # Resolve file path with fallbacks
                if os.path.isabs(target_file) and os.path.exists(target_file):
                    file_to_run = os.path.abspath(target_file)
                else:
                    clean_path = target_file.replace("\\", "/").lstrip("/")
                    candidates = [
                        os.path.abspath(os.path.join(AppState.TARGET_DIR, clean_path)),
                        os.path.abspath(os.path.join(AppState.TARGET_DIR, target_file)),
                        os.path.abspath(target_file)
                    ]
                    file_to_run = candidates[0]
                    for cand in candidates:
                        if os.path.exists(cand):
                            file_to_run = cand
                            break

                start_time = asyncio.get_event_loop().time()
                try:
                    res = await asyncio.to_thread(
                        run_code_polyglot_sync, 
                        file_to_run, 
                        message.get("stdin", ""),
                        30.0
                    )
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if res.stdout:
                        stdout_payload = res.stdout
                        if len(stdout_payload) > 250000:
                            stdout_payload = stdout_payload[:250000] + "\n\n[Warning: Output buffer exceeded 250KB and was safely truncated]\n"
                        await safe_send_to_active(websocket, {"event": "TERMINAL_OUTPUT", "payload": stdout_payload})
                    if res.stderr:
                        stderr_payload = res.stderr
                        if len(stderr_payload) > 50000:
                            stderr_payload = stderr_payload[:50000] + "\n\n[Warning: Error buffer exceeded 50KB and was safely truncated]\n"
                        await safe_send_to_active(websocket, {"event": "TERMINAL_ERROR", "payload": stderr_payload})
                    await safe_send_to_active(websocket, {
                        "event": "TERMINAL_OUTPUT", 
                        "payload": f"\n[Done] exited with code {res.returncode} in {elapsed:.2f}s\n"
                    })
                except subprocess.TimeoutExpired:
                    await safe_send_to_active(websocket, {
                        "event": "TERMINAL_ERROR", 
                        "payload": "\n[Timeout] Execution exceeded 30s limit.\n"
                    })
                except Exception as run_err:
                    await safe_send_to_active(websocket, {
                        "event": "TERMINAL_ERROR", 
                        "payload": f"\n[Execution Error] {run_err}\n"
                    })

            # -----------------------------------------------------------------
            # 9. GIT SOURCE CONTROL OPERATIONS
            # -----------------------------------------------------------------
            elif evt == "GIT_COMMIT":
                commit_msg = message.get("message", "")
                push = bool(message.get("push", False))
                amend = bool(message.get("amend", False))
                res = await asyncio.to_thread(git_commit, AppState.TARGET_DIR, commit_msg, push, amend)
                if res.get("success"):
                    await safe_send_json(websocket, {"event": "GIT_COMMIT_SUCCESS", "output": res.get("output", "")})
                    asyncio.create_task(broadcast_workspace(force_full_sync=False))
                    graph = await asyncio.to_thread(git_get_log_graph, AppState.TARGET_DIR, 40)
                    await broadcast_to_all({"event": "GIT_GRAPH_DATA", "payload": graph})
                else:
                    await safe_send_json(websocket, {"event": "GIT_COMMIT_ERROR", "error": res.get("error", "Commit failed")})

            elif evt == "GIT_PUSH":
                res = await asyncio.to_thread(git_push, AppState.TARGET_DIR)
                if res.get("success"):
                    await safe_send_json(websocket, {"event": "GIT_PUSH_SUCCESS", "output": res.get("output", "")})
                    graph = await asyncio.to_thread(git_get_log_graph, AppState.TARGET_DIR, 40)
                    await broadcast_to_all({"event": "GIT_GRAPH_DATA", "payload": graph})
                else:
                    await safe_send_json(websocket, {"event": "GIT_PUSH_ERROR", "error": res.get("error", "Push failed")})

            elif evt == "GIT_STAGE_FILE":
                file_p = message.get("path")
                await asyncio.to_thread(git_stage, AppState.TARGET_DIR, file_p)
                asyncio.create_task(broadcast_workspace(force_full_sync=False))

            elif evt == "GIT_UNSTAGE_FILE":
                file_p = message.get("path")
                await asyncio.to_thread(git_unstage, AppState.TARGET_DIR, file_p)
                asyncio.create_task(broadcast_workspace(force_full_sync=False))

            elif evt == "GIT_DISCARD_FILE":
                file_p = message.get("path")
                await asyncio.to_thread(git_discard, AppState.TARGET_DIR, file_p)
                asyncio.create_task(broadcast_workspace(force_full_sync=False))

            elif evt == "GIT_STAGE_ALL":
                await asyncio.to_thread(git_stage, AppState.TARGET_DIR, "all")
                asyncio.create_task(broadcast_workspace(force_full_sync=False))

            elif evt == "GIT_DISCARD_ALL":
                await asyncio.to_thread(git_discard, AppState.TARGET_DIR, "all")
                asyncio.create_task(broadcast_workspace(force_full_sync=False))

            elif evt == "GIT_FETCH_GRAPH":
                graph = await asyncio.to_thread(git_get_log_graph, AppState.TARGET_DIR, 40)
                await safe_send_json(websocket, {"event": "GIT_GRAPH_DATA", "payload": graph})

            elif evt == "GIT_FETCH_STATUS":
                detailed = await asyncio.to_thread(git_get_detailed_status, AppState.TARGET_DIR)
                graph = await asyncio.to_thread(git_get_log_graph, AppState.TARGET_DIR, 40)
                await safe_send_json(websocket, {"event": "GIT_DETAILED_STATUS", "payload": detailed})
                await safe_send_json(websocket, {"event": "GIT_GRAPH_DATA", "payload": graph})

    except WebSocketDisconnect:
        AppState.CONNECTIONS.discard(websocket)
        print(f"[INFO] Client disconnected. Active connections: {len(AppState.CONNECTIONS)}")
    except Exception as e:
        AppState.CONNECTIONS.discard(websocket)
        print(f"[WARN] WebSocket handler error: {e}")