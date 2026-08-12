# backend/services/terminal_service.py
import os
import sys
import asyncio
import subprocess
import threading
from core.state import AppState

# NEW: A safe wrapper that prevents crashes if the user refreshes the browser
async def safe_send(websocket, data):
    try:
        await websocket.send_json(data)
    except Exception:
        pass # Silently ignore if the frontend is disconnected

async def stream_terminal_command(websocket, session_id, command, shell_type, cwd):
    await safe_send(websocket, {"event": "TERMINAL_STREAM_START", "session_id": session_id, "command": command, "cwd": cwd})

    if sys.platform == "win32":
        if shell_type == "cmd":
            full_cmd = f'cd /d "{cwd}" && {command} && echo __NEURON_CWD__:%cd%'
            args = ["cmd.exe", "/c", full_cmd]
        else: # PowerShell
            full_cmd = f'Set-Location -LiteralPath "{cwd}"; {command}; Write-Output "__NEURON_CWD__:$((Get-Location).Path)"'
            args = ["powershell.exe", "-NoProfile", "-Command", full_cmd]
    else: # Linux/Mac
        full_cmd = f'cd "{cwd}"; {command}; echo "__NEURON_CWD__:$PWD"'
        args = ["/bin/sh", "-c", full_cmd]

    custom_env = os.environ.copy()
    custom_env["PYTHONIOENCODING"] = "utf-8"
    custom_env["FORCE_COLOR"] = "1"
    
    # NEW: Create a new process group so we can send a proper Ctrl+C signal later
    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0

    try:
        loop = asyncio.get_running_loop()
        
        process = subprocess.Popen(
            args, 
            cwd=cwd, 
            stdin=subprocess.PIPE, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            env=custom_env,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace',
            creationflags=creation_flags
        )
        AppState.PROCESSES[session_id] = process

        def read_stream_thread(stream, is_err):
            for line in iter(stream.readline, ''):
                if not line: break
                text = line
                
                if "__NEURON_CWD__:" in text:
                    parts = text.split("__NEURON_CWD__:")
                    text = parts[0]
                    new_cwd = parts[1].strip()
                    if new_cwd:
                        asyncio.run_coroutine_threadsafe(
                            safe_send(websocket, {"event": "TERMINAL_CWD_UPDATE", "session_id": session_id, "cwd": new_cwd}),
                            loop
                        )
                    if not text.strip(): continue

                asyncio.run_coroutine_threadsafe(
                    safe_send(websocket, {"event": "TERMINAL_STREAM", "session_id": session_id, "text": text, "is_error": is_err}),
                    loop
                )

        t1 = threading.Thread(target=read_stream_thread, args=(process.stdout, False), daemon=True)
        t2 = threading.Thread(target=read_stream_thread, args=(process.stderr, True), daemon=True)
        t1.start()
        t2.start()

        await asyncio.to_thread(process.wait)
        
    except Exception as e:
        await safe_send(websocket, {"event": "TERMINAL_STREAM", "session_id": session_id, "text": f"\nSystem Error: {repr(e)}\n", "is_error": True})
    finally:
        AppState.PROCESSES.pop(session_id, None)
        await safe_send(websocket, {"event": "TERMINAL_STREAM_END", "session_id": session_id})

def kill_terminal_process(session_id):
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES[session_id]
        try:
            if sys.platform == "win32":
                import signal
                # 1. Send the native Windows Ctrl+C (Break) signal
                os.kill(proc.pid, signal.CTRL_BREAK_EVENT)
                # 2. Force-kill the tree just in case it ignores the signal
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                proc.kill()
        except Exception: 
            pass
        finally:
            AppState.PROCESSES.pop(session_id, None)

def run_python_script_sync(file_to_run, stdin_data):
    custom_env = os.environ.copy()
    custom_env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, file_to_run], cwd=AppState.TARGET_DIR, capture_output=True, text=True, 
        encoding="utf-8", env=custom_env, timeout=15.0, input=stdin_data
    )