# backend/services/terminal_service.py
import asyncio
import os
import posixpath
import re
import shutil
import signal
import subprocess
import sys
import threading
from typing import Any, Dict, List, Optional, Tuple

from core.state import AppState


# -------------------------------------------------------------------------
# 1. UTILITY: SAFE ASYNC WEBSOCKET DISPATCHER
# -------------------------------------------------------------------------
async def safe_send(websocket: Any, data: dict) -> None:
    """Safely dispatches a JSON packet to the client, suppressing dropped socket errors."""
    try:
        if websocket in AppState.CONNECTIONS:
            await websocket.send_json(data)
    except Exception:
        if websocket in AppState.CONNECTIONS:
            AppState.CONNECTIONS.remove(websocket)


# -------------------------------------------------------------------------
# 2. SHELL ENVIRONMENT & EXECUTABLE RESOLVER
# -------------------------------------------------------------------------
def resolve_shell_command(command: str, shell_type: str, cwd: str) -> Tuple[List[str], Dict[str, str]]:
    """
    Constructs the exact platform-specific shell arguments and injected environment
    to capture live stdout, stderr, and dynamic CWD changes.
    """
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    env["FORCE_COLOR"] = "1"
    env["CLICOLOR_FORCE"] = "1"
    env["COLORTERM"] = "truecolor"
    env["TERM"] = "xterm-256color"

    # WINDOWS
    if sys.platform == "win32":
        if shell_type.lower() == "cmd":
            full_cmd = f"{command} & echo __NEURON_CWD__:%cd%"
            args = ["cmd.exe", "/c", full_cmd]
        else:
            # Check for PowerShell Core (pwsh) or fallback to Windows PowerShell
            ps_exe = "pwsh.exe" if shutil.which("pwsh.exe") else "powershell.exe"
            full_cmd = f'{command}; Write-Output "__NEURON_CWD__:$((Get-Location).Path)"'
            args = [ps_exe, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", full_cmd]

    # MACOS & LINUX
    else:
        user_shell = env.get("SHELL") or "/bin/bash"
        if not os.path.exists(user_shell):
            user_shell = "/bin/sh"
        full_cmd = f'{command}; echo "__NEURON_CWD__:$PWD"'
        args = [user_shell, "-c", full_cmd]

    return args, env


# -------------------------------------------------------------------------
# 3. HIGH-SPEED INTERACTIVE TERMINAL EMULATION STREAMER
# -------------------------------------------------------------------------
async def stream_terminal_command(
    websocket: Any,
    session_id: str,
    command: str,
    shell_type: str = "powershell",
    cwd: Optional[str] = None
) -> None:
    """
    Spawns an interactive shell process and streams raw output chunks in real-time.
    Supports dynamic CWD updates and interactive input pipes.
    """
    effective_cwd = os.path.abspath(cwd or AppState.TARGET_DIR)
    if not os.path.exists(effective_cwd):
        effective_cwd = os.path.abspath(AppState.TARGET_DIR)

    await safe_send(websocket, {
        "event": "TERMINAL_STREAM_START",
        "session_id": session_id,
        "command": command,
        "cwd": effective_cwd.replace("\\", "/")
    })

    args, custom_env = resolve_shell_command(command, shell_type, effective_cwd)

    # Process Isolation Flags
    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    start_session = True if sys.platform != "win32" else False

    try:
        loop = asyncio.get_running_loop()
        process = subprocess.Popen(
            args,
            cwd=effective_cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=custom_env,
            text=True,
            bufsize=0,
            encoding='utf-8',
            errors='replace',
            creationflags=creation_flags,
            start_new_session=start_session
        )
        AppState.PROCESSES[session_id] = process

        def read_stream_chunks(stream, is_err: bool):
            """Reads unbuffered output chunks to ensure prompt lines (e.g. [y/N]?) stream immediately."""
            try:
                while True:
                    # Read in small 256-character chunks so interactive prompts without newlines don't hang
                    chunk = stream.read(256)
                    if not chunk:
                        break

                    text = chunk
                    # Intercept Dynamic CWD Update token
                    if "__NEURON_CWD__:" in text:
                        parts = text.split("__NEURON_CWD__:")
                        text = parts[0]
                        new_cwd = parts[1].splitlines()[0].strip().replace("\\", "/")
                        if new_cwd and os.path.exists(new_cwd):
                            asyncio.run_coroutine_threadsafe(
                                safe_send(websocket, {
                                    "event": "TERMINAL_CWD_UPDATE",
                                    "session_id": session_id,
                                    "cwd": new_cwd
                                }),
                                loop
                            )

                    if text:
                        asyncio.run_coroutine_threadsafe(
                            safe_send(websocket, {
                                "event": "TERMINAL_STREAM",
                                "session_id": session_id,
                                "text": text,
                                "is_error": is_err
                            }),
                            loop
                        )
            except Exception:
                pass

        t_out = threading.Thread(target=read_stream_chunks, args=(process.stdout, False), daemon=True)
        t_err = threading.Thread(target=read_stream_chunks, args=(process.stderr, True), daemon=True)
        t_out.start()
        t_err.start()

        # Await completion without blocking FastAPI event loop
        return_code = await asyncio.to_thread(process.wait)

        t_out.join(timeout=0.2)
        t_err.join(timeout=0.2)

        await safe_send(websocket, {
            "event": "TERMINAL_STREAM",
            "session_id": session_id,
            "text": f"\r\n[Process completed with exit code {return_code}]\r\n",
            "is_error": return_code != 0
        })

    except Exception as e:
        await safe_send(websocket, {
            "event": "TERMINAL_STREAM",
            "session_id": session_id,
            "text": f"\r\n[Terminal Error: {str(e)}]\r\n",
            "is_error": True
        })
    finally:
        AppState.PROCESSES.pop(session_id, None)
        await safe_send(websocket, {
            "event": "TERMINAL_STREAM_END",
            "session_id": session_id
        })


# -------------------------------------------------------------------------
# 4. INTERACTIVE STDIN PIPE & SUBPROCESS TREE TERMINATOR
# -------------------------------------------------------------------------
def write_terminal_stdin(session_id: str, input_text: str) -> bool:
    """Pipes user keystrokes / answers directly into an active terminal process."""
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES[session_id]
        if proc and proc.stdin and not proc.stdin.closed:
            try:
                proc.stdin.write(input_text)
                proc.stdin.flush()
                return True
            except Exception:
                pass
    return False


def kill_terminal_process(session_id: str) -> bool:
    """
    Terminates the entire process tree cleanly to guarantee zero orphaned background tasks.
    """
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES[session_id]
        if not proc:
            return False

        try:
            # WINDOWS: Tree-kill using Taskkill
            if sys.platform == "win32":
                try:
                    os.kill(proc.pid, signal.CTRL_BREAK_EVENT)
                except Exception:
                    pass
                subprocess.run(
                    ['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False
                )
            # MACOS & LINUX: Kill Process Group
            else:
                try:
                    pgid = os.getpgid(proc.pid)
                    os.killpg(pgid, signal.SIGTERM)
                except Exception:
                    proc.kill()
            return True
        except Exception:
            return False
        finally:
            AppState.PROCESSES.pop(session_id, None)

    return False


# -------------------------------------------------------------------------
# 5. SYNCHRONOUS PYTHON SCRIPT EXECUTOR
# -------------------------------------------------------------------------
def run_python_script_sync(
    file_to_run: str,
    stdin_data: str = "",
    timeout: float = 15.0
) -> subprocess.CompletedProcess:
    """
    Runs a standalone Python script synchronously with unbuffered I/O and timeout guards.
    """
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    
    target_dir = os.path.abspath(AppState.TARGET_DIR)

    return subprocess.run(
        [sys.executable, file_to_run],
        cwd=target_dir,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=timeout,
        input=stdin_data
    )