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
    Constructs platform-specific shell arguments and injected environment
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
            """Reads unbuffered output chunks so prompts without newlines stream immediately."""
            try:
                while True:
                    chunk = stream.read(256)
                    if not chunk:
                        break

                    text = chunk
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
# 4. INTERACTIVE STDIN PIPE & PROCESS TREE TERMINATOR
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
    """Terminates the entire process tree cleanly without zombie tasks."""
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES[session_id]
        if not proc:
            return False

        try:
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
# 5. UNIVERSAL POLYGLOT CODE RUNNER (Subfolder & Multi-Language Engine)
# -------------------------------------------------------------------------
def run_code_polyglot_sync(
    file_to_run: str,
    stdin_data: str = "",
    timeout: float = 15.0
) -> subprocess.CompletedProcess:
    """
    Universal Polyglot Compiler & Execution Engine.
    Handles files in arbitrary subfolders with full PYTHONPATH, Header, and Classpath resolution.
    """
    target_dir = os.path.abspath(AppState.TARGET_DIR)
    
    # 🚀 1. ABSOLUTE & SUBFOLDER PATH NORMALIZATION
    clean_file_path = file_to_run.replace("\\", "/").lstrip("/")
    if os.path.isabs(file_to_run) and os.path.exists(file_to_run):
        file_abs = os.path.abspath(file_to_run)
    else:
        file_abs = os.path.abspath(os.path.join(target_dir, clean_file_path))

    if not os.path.exists(file_abs):
        return subprocess.CompletedProcess(
            args=[file_to_run],
            returncode=1,
            stdout="",
            stderr=f"[ERROR] Source file does not exist on disk:\n{file_abs}\nWorkspace Root: {target_dir}"
        )

    file_dir = os.path.dirname(file_abs)
    ext = os.path.splitext(file_abs)[1].lower()

    # 🚀 2. INJECT ROOT & SUBFOLDER INTO RUNTIME ENVIRONMENTS
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    
    # Python Import Path: Includes Workspace Root + Subfolder Directory
    pythonpath_entries = [target_dir, file_dir]
    if "PYTHONPATH" in env:
        pythonpath_entries.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_entries)

    def create_error_result(msg: str) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=[file_abs],
            returncode=1,
            stdout="",
            stderr=msg
        )

    # -------------------------------------------------------------------------
    # A. PYTHON (.py)
    # -------------------------------------------------------------------------
    if ext == ".py":
        return subprocess.run(
            [sys.executable, file_abs],
            cwd=file_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=timeout,
            input=stdin_data
        )

    # -------------------------------------------------------------------------
    # B. C++ (.cpp, .cc, .cxx)
    # -------------------------------------------------------------------------
    elif ext in [".cpp", ".cc", ".cxx"]:
        cpp_compiler = shutil.which("g++") or shutil.which("clang++")
        if not cpp_compiler:
            return create_error_result(
                "[ERROR] C++ compiler (g++ / clang++) not found in system PATH.\n"
                "Please install MinGW-w64 (GCC) or LLVM Clang to compile C++ files."
            )

        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_bin{bin_ext}"

        # Compile with -I for Root and Subfolder headers
        compile_cmd = [
            cpp_compiler, 
            "-O2", 
            "-std=c++20", 
            f"-I{target_dir}", 
            f"-I{file_dir}", 
            file_abs, 
            "-o", 
            bin_path
        ]
        comp_res = subprocess.run(compile_cmd, cwd=file_dir, capture_output=True, text=True, errors="replace")

        if comp_res.returncode != 0:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=comp_res.returncode,
                stdout="",
                stderr=f"[C++ Compilation Error]\n{comp_res.stderr}"
            )

        try:
            return subprocess.run(
                [bin_path],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                input=stdin_data
            )
        finally:
            if os.path.exists(bin_path):
                try:
                    os.remove(bin_path)
                except Exception:
                    pass

    # -------------------------------------------------------------------------
    # C. C (.c)
    # -------------------------------------------------------------------------
    elif ext == ".c":
        c_compiler = shutil.which("gcc") or shutil.which("clang")
        if not c_compiler:
            return create_error_result(
                "[ERROR] C compiler (gcc / clang) not found in system PATH.\n"
                "Please install MinGW-w64 (GCC) or LLVM Clang to compile C files."
            )

        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_bin{bin_ext}"

        compile_cmd = [
            c_compiler, 
            "-O2", 
            f"-I{target_dir}", 
            f"-I{file_dir}", 
            file_abs, 
            "-o", 
            bin_path
        ]
        comp_res = subprocess.run(compile_cmd, cwd=file_dir, capture_output=True, text=True, errors="replace")

        if comp_res.returncode != 0:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=comp_res.returncode,
                stdout="",
                stderr=f"[C Compilation Error]\n{comp_res.stderr}"
            )

        try:
            return subprocess.run(
                [bin_path],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                input=stdin_data
            )
        finally:
            if os.path.exists(bin_path):
                try:
                    os.remove(bin_path)
                except Exception:
                    pass

    # -------------------------------------------------------------------------
    # D. JAVA (.java)
    # -------------------------------------------------------------------------
    elif ext == ".java":
        java_cmd = shutil.which("java")
        if not java_cmd:
            return create_error_result(
                "[ERROR] Java Runtime (java / JDK) not found in system PATH.\n"
                "Please install OpenJDK or Oracle JDK to execute Java files."
            )

        # Inject Classpath for Root and Subfolder package resolution
        classpath = f"{target_dir}{os.pathsep}{file_dir}"
        return subprocess.run(
            [java_cmd, "-cp", classpath, file_abs],
            cwd=file_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            input=stdin_data
        )

    # -------------------------------------------------------------------------
    # E. JAVASCRIPT / NODE (.js, .mjs)
    # -------------------------------------------------------------------------
    elif ext in [".js", ".mjs"]:
        node_cmd = shutil.which("node")
        if not node_cmd:
            return create_error_result(
                "[ERROR] Node.js runtime (node) not found in system PATH."
            )

        node_env = env.copy()
        node_paths = [os.path.join(target_dir, "node_modules"), target_dir, file_dir]
        if "NODE_PATH" in node_env:
            node_paths.append(node_env["NODE_PATH"])
        node_env["NODE_PATH"] = os.pathsep.join(node_paths)

        return subprocess.run(
            [node_cmd, file_abs],
            cwd=file_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=node_env,
            timeout=timeout,
            input=stdin_data
        )

    # -------------------------------------------------------------------------
    # F. UNSUPPORTED RUNTIME
    # -------------------------------------------------------------------------
    else:
        return create_error_result(
            f"[ERROR] Direct execution runner for '{ext}' is not configured.\n"
            "Supported languages: Python (.py), C++ (.cpp), C (.c), Java (.java), Node.js (.js)."
        )


# Backward-compatible alias for WebSocket Router
run_python_script_sync = run_code_polyglot_sync