# backend/services/terminal_service.py
import asyncio
import codecs
import os
import posixpath
import re
import shutil
import signal
import subprocess
import sys
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple

from core.state import AppState


# -------------------------------------------------------------------------
# 1. UTILITY: SAFE ASYNC WEBSOCKET DISPATCHER
# -------------------------------------------------------------------------
async def safe_send(websocket: Any, data: dict) -> None:
    """
    Safely dispatches a JSON packet to the client.
    If the originating websocket disconnected (e.g. during PC sleep/wake),
    seamlessly broadcasts to any active connection in AppState.CONNECTIONS
    so stream chunks and exit signals are never lost.
    """
    from ml.analyzer import sanitize_for_json
    sanitized = sanitize_for_json(data)
    sent = False
    if websocket and websocket in AppState.CONNECTIONS:
        try:
            await websocket.send_json(sanitized)
            sent = True
        except Exception:
            AppState.CONNECTIONS.discard(websocket)

    if not sent and AppState.CONNECTIONS:
        disconnected = set()
        for ws in list(AppState.CONNECTIONS):
            try:
                await ws.send_json(sanitized)
            except Exception:
                disconnected.add(ws)
        for ws in disconnected:
            AppState.CONNECTIONS.discard(ws)


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
    env["PYTHONUTF8"] = "1"
    env["PYTHONLEGACYWINDOWSSTDIO"] = "0"
    env["FORCE_COLOR"] = "1"
    env["CLICOLOR_FORCE"] = "1"
    env["COLORTERM"] = "truecolor"
    env["TERM"] = "xterm-256color"

    # WINDOWS
    if sys.platform == "win32":
        if shell_type.lower() == "cmd":
            full_cmd = f"chcp 65001 >nul & {command} & echo __NEURON_CWD__:%cd%"
            args = ["cmd.exe", "/c", full_cmd]
        else:
            ps_exe = "pwsh.exe" if shutil.which("pwsh.exe") else "powershell.exe"
            ps_utf8_init = (
                "$OutputEncoding = [System.Text.Encoding]::UTF8; "
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
                "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; "
            )
            full_cmd = f'{ps_utf8_init}{command}; Write-Output "__NEURON_CWD__:$((Get-Location).Path)"'
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
            bufsize=0,
            creationflags=creation_flags,
            start_new_session=start_session
        )
        AppState.PROCESSES[session_id] = process

        def read_stream_chunks(stream, is_err: bool):
            """Reads unbuffered raw chunks via low-level os.read so data streams immediately without waiting for EOF."""
            try:
                decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                fd = stream.fileno()
                while True:
                    raw = os.read(fd, 4096)
                    if not raw:
                        break

                    text = decoder.decode(raw)
                    if not text:
                        continue

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

                # Flush any remaining decoded text at EOF
                remainder = decoder.decode(b"", final=True)
                if remainder:
                    asyncio.run_coroutine_threadsafe(
                        safe_send(websocket, {
                            "event": "TERMINAL_STREAM",
                            "session_id": session_id,
                            "text": remainder,
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

        t_out.join(timeout=0.5)
        t_err.join(timeout=0.5)

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
        try:
            from services.workspace_service import broadcast_workspace
            asyncio.create_task(broadcast_workspace(force_full_sync=False))
        except Exception:
            pass


# -------------------------------------------------------------------------
# 4. INTERACTIVE STDIN PIPE & PROCESS TREE TERMINATOR
# -------------------------------------------------------------------------
def write_terminal_stdin(session_id: str, input_text: str) -> bool:
    """Pipes user keystrokes / answers directly into an active terminal process."""
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES[session_id]
        if proc and proc.stdin and not proc.stdin.closed:
            try:
                if isinstance(input_text, str):
                    proc.stdin.write(input_text.encode('utf-8', errors='replace'))
                else:
                    proc.stdin.write(input_text)
                proc.stdin.flush()
                return True
            except Exception:
                pass
    return False


def kill_terminal_process(session_id: str) -> bool:
    """Terminates the entire process tree cleanly without zombie tasks."""
    if session_id in AppState.PROCESSES:
        proc = AppState.PROCESSES.get(session_id)
        if not proc:
            AppState.PROCESSES.pop(session_id, None)
            return False

        try:
            # 1. Close stdin immediately to unblock any waiting readline/pipes
            if proc.stdin and not proc.stdin.closed:
                try:
                    proc.stdin.close()
                except Exception:
                    pass

            # 2. Terminate the process tree
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
                try:
                    proc.kill()
                except Exception:
                    pass
            else:
                try:
                    pgid = os.getpgid(proc.pid)
                    os.killpg(pgid, signal.SIGKILL)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
            return True
        except Exception as e:
            print(f"[WARN] Error killing terminal process {session_id}: {e}")
            try:
                proc.kill()
            except Exception:
                pass
            return False
        finally:
            AppState.PROCESSES.pop(session_id, None)

    return False


def kill_all_terminal_processes() -> int:
    """Terminates all running terminal processes across all sessions."""
    killed_count = 0
    session_ids = list(AppState.PROCESSES.keys())
    for s_id in session_ids:
        if kill_terminal_process(s_id):
            killed_count += 1
    return killed_count


# -------------------------------------------------------------------------
# 5. EXECUTABLE & COMPILER LOCATORS (PyInstaller Frozen-Proof)
# -------------------------------------------------------------------------
def is_valid_executable(path: Optional[str]) -> bool:
    """Checks if path exists, is a file, and is NOT PyInstaller's frozen neuron-backend."""
    if not path or not os.path.isfile(path):
        return False
    base = os.path.basename(path).lower()
    if "neuron-backend" in base:
        return False
    if getattr(sys, "frozen", False) and os.path.abspath(path) == os.path.abspath(sys.executable):
        return False
    return True


def find_python_interpreter(target_dir: str, file_dir: str) -> Optional[str]:
    """
    Locates the best available Python interpreter on the host system.
    Prioritizes project virtual environments, then system PATH, then standard OS install paths.
    Guarantees that PyInstaller's frozen neuron-backend executable is NEVER selected.
    """
    # 1. Project-level virtual environments
    check_dirs = [file_dir, target_dir]
    curr = file_dir
    while curr and curr != target_dir:
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        if parent not in check_dirs:
            check_dirs.append(parent)
        curr = parent

    venv_names = [".venv", "venv", "env", ".env"]
    for d in check_dirs:
        for v in venv_names:
            venv_path = os.path.join(d, v)
            if os.path.isdir(venv_path):
                if sys.platform == "win32":
                    candidates = [
                        os.path.join(venv_path, "Scripts", "python.exe"),
                        os.path.join(venv_path, "python.exe"),
                    ]
                else:
                    candidates = [
                        os.path.join(venv_path, "bin", "python"),
                        os.path.join(venv_path, "bin", "python3"),
                    ]
                for c in candidates:
                    if is_valid_executable(c):
                        return os.path.abspath(c)

    # 2. System PATH lookup (python, py launcher, python3)
    for name in ["python", "py", "python3"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)

    # 3. Windows well-known installation paths
    if sys.platform == "win32":
        # LocalAppData Programs Python (e.g. C:\Users\<user>\AppData\Local\Programs\Python\Python311\python.exe)
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            programs_py = os.path.join(local_app_data, "Programs", "Python")
            if os.path.isdir(programs_py):
                try:
                    for entry in sorted(os.listdir(programs_py), reverse=True):
                        cand = os.path.join(programs_py, entry, "python.exe")
                        if is_valid_executable(cand):
                            return os.path.abspath(cand)
                except Exception:
                    pass

        # Root Python directories (C:\Python*, D:\Python*)
        for drive in ["C:\\", "D:\\"]:
            try:
                if os.path.exists(drive):
                    for entry in sorted(os.listdir(drive), reverse=True):
                        if entry.lower().startswith("python"):
                            cand = os.path.join(drive, entry, "python.exe")
                            if is_valid_executable(cand):
                                return os.path.abspath(cand)
            except Exception:
                pass

        # Program Files Python directories
        for pf_var in ["ProgramFiles", "ProgramFiles(x86)"]:
            pf = os.environ.get(pf_var, "")
            if pf and os.path.isdir(pf):
                pf_py = os.path.join(pf, "Python")
                if os.path.isdir(pf_py):
                    try:
                        for entry in sorted(os.listdir(pf_py), reverse=True):
                            cand = os.path.join(pf_py, entry, "python.exe")
                            if is_valid_executable(cand):
                                return os.path.abspath(cand)
                    except Exception:
                        pass

    # 4. Local non-frozen development fallback
    if not getattr(sys, "frozen", False) and is_valid_executable(sys.executable):
        base = os.path.basename(sys.executable).lower()
        if base.startswith("python"):
            return os.path.abspath(sys.executable)

    return None


def find_cpp_compiler() -> Optional[str]:
    """Finds g++, clang++, or cl in PATH or well-known Windows locations."""
    for name in ["g++", "clang++"]:
        found = shutil.which(name)
        if found and os.path.exists(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\msys64\ucrt64\bin\g++.exe",
            r"C:\msys64\mingw64\bin\g++.exe",
            r"C:\msys64\clang64\bin\clang++.exe",
            r"C:\msys64\usr\bin\g++.exe",
            r"C:\MinGW\bin\g++.exe",
            r"C:\TDM-GCC-64\bin\g++.exe",
            r"C:\w64devkit\bin\g++.exe",
            r"C:\Program Files\LLVM\bin\clang++.exe",
            r"C:\Program Files (x86)\Dev-Cpp\MinGW64\bin\g++.exe",
            r"C:\Strawberry\c\bin\g++.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\w64devkit\bin\g++.exe"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c

    return None


def find_c_compiler() -> Optional[str]:
    """Finds gcc or clang in PATH or well-known Windows locations."""
    for name in ["gcc", "clang"]:
        found = shutil.which(name)
        if found and os.path.exists(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\msys64\ucrt64\bin\gcc.exe",
            r"C:\msys64\mingw64\bin\gcc.exe",
            r"C:\msys64\clang64\bin\clang.exe",
            r"C:\msys64\usr\bin\gcc.exe",
            r"C:\MinGW\bin\gcc.exe",
            r"C:\TDM-GCC-64\bin\gcc.exe",
            r"C:\w64devkit\bin\gcc.exe",
            r"C:\Program Files\LLVM\bin\clang.exe",
            r"C:\Program Files (x86)\Dev-Cpp\MinGW64\bin\gcc.exe",
            r"C:\Strawberry\c\bin\gcc.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\w64devkit\bin\gcc.exe"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c

    return None


def find_shell_interpreter() -> Optional[str]:
    """Finds bash or sh in PATH or Git for Windows install locations."""
    for name in ["bash", "sh"]:
        found = shutil.which(name)
        if found and os.path.exists(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
            r"C:\msys64\usr\bin\bash.exe",
        ]
        for c in candidates:
            if os.path.exists(c):
                return c

    return None


# -------------------------------------------------------------------------
# 6. UNIVERSAL POLYGLOT CODE RUNNER (Subfolder & Multi-Language Engine)
# -------------------------------------------------------------------------
def run_code_polyglot_sync(
    file_to_run: str,
    stdin_data: str = "",
    timeout: float = 30.0
) -> subprocess.CompletedProcess:
    """
    Universal Polyglot Compiler & Execution Engine.
    Handles files across arbitrary projects and subfolders with full PYTHONPATH,
    header includes, classpath, and shell script emulation.
    Supports Python, C++, C, BAT, CMD, PowerShell, Bash, JavaScript, TypeScript, Java, Rust, Go.
    """
    target_dir = os.path.abspath(AppState.TARGET_DIR)
    
    # 🚀 1. ABSOLUTE & SUBFOLDER PATH RESOLUTION
    if os.path.isabs(file_to_run) and os.path.exists(file_to_run):
        file_abs = os.path.abspath(file_to_run)
    else:
        clean_file_path = file_to_run.replace("\\", "/").lstrip("/")
        candidates = [
            os.path.abspath(os.path.join(target_dir, clean_file_path)),
            os.path.abspath(os.path.join(target_dir, file_to_run)),
            os.path.abspath(file_to_run)
        ]
        file_abs = None
        for cand in candidates:
            if os.path.exists(cand):
                file_abs = cand
                break
        if not file_abs:
            file_abs = candidates[0]

    def create_error_result(msg: str) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=[file_to_run],
            returncode=1,
            stdout="",
            stderr=msg
        )

    if not os.path.exists(file_abs):
        return create_error_result(
            f"[ERROR] Source file does not exist on disk:\n{file_abs}\nWorkspace Root: {target_dir}"
        )

    file_dir = os.path.dirname(file_abs)
    ext = os.path.splitext(file_abs)[1].lower()

    # 🚀 2. INJECT ROOT & SUBFOLDER INTO CLEAN RUNTIME ENVIRONMENTS
    env = os.environ.copy()
    # Strip PyInstaller frozen artifacts to prevent runtime contamination
    env.pop("PYTHONHOME", None)
    env.pop("_MEIPASS2", None)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    
    # Python Import Path: Includes Workspace Root + Subfolder Directory
    pythonpath_entries = [target_dir, file_dir]
    if "PYTHONPATH" in env and env["PYTHONPATH"]:
        for p in env["PYTHONPATH"].split(os.pathsep):
            if "_MEI" not in p and p not in pythonpath_entries:
                pythonpath_entries.append(p)
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_entries)

    # -------------------------------------------------------------------------
    # A. PYTHON (.py, .pyw)
    # -------------------------------------------------------------------------
    if ext in [".py", ".pyw"]:
        py_exe = find_python_interpreter(target_dir, file_dir)
        if not py_exe:
            return create_error_result(
                "[ERROR] Python interpreter not found on system.\n"
                "Please install Python from https://www.python.org/ or ensure 'python' is added to system PATH."
            )

        return subprocess.run(
            [py_exe, "-u", file_abs],
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
    # B. C++ (.cpp, .cc, .cxx, .c++)
    # -------------------------------------------------------------------------
    elif ext in [".cpp", ".cc", ".cxx", ".c++"]:
        cpp_compiler = find_cpp_compiler()
        if not cpp_compiler:
            return create_error_result(
                "[ERROR] C++ compiler (g++ / clang++) not found in system PATH or MSYS2/MinGW.\n"
                "Please install MinGW-w64 (GCC) or LLVM Clang to compile C++ files."
            )

        run_uid = uuid.uuid4().hex[:8]
        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_bin_{run_uid}{bin_ext}"

        is_gnu = "g++" in os.path.basename(cpp_compiler).lower()
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
        if is_gnu:
            compile_cmd.extend(["-static-libgcc", "-static-libstdc++"])

        try:
            comp_res = subprocess.run(
                compile_cmd, 
                cwd=file_dir, 
                capture_output=True, 
                text=True, 
                errors="replace",
                timeout=20.0
            )
        except subprocess.TimeoutExpired:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=124,
                stdout="",
                stderr="[C++ Compilation Timeout] Compiler exceeded 20s limit.\n"
            )

        if comp_res.returncode != 0:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=comp_res.returncode,
                stdout="",
                stderr=f"[C++ Compilation Error]\n{comp_res.stderr}"
            )

        run_env = env.copy()
        compiler_bin_dir = os.path.dirname(cpp_compiler)
        run_env["PATH"] = f"{compiler_bin_dir}{os.pathsep}{run_env.get('PATH', '')}"

        try:
            return subprocess.run(
                [bin_path],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=run_env,
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
        c_compiler = find_c_compiler()
        if not c_compiler:
            return create_error_result(
                "[ERROR] C compiler (gcc / clang) not found in system PATH or MSYS2/MinGW.\n"
                "Please install MinGW-w64 (GCC) or LLVM Clang to compile C files."
            )

        run_uid = uuid.uuid4().hex[:8]
        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_bin_{run_uid}{bin_ext}"

        is_gnu = "gcc" in os.path.basename(c_compiler).lower()
        compile_cmd = [
            c_compiler, 
            "-O2", 
            f"-I{target_dir}", 
            f"-I{file_dir}", 
            file_abs, 
            "-o", 
            bin_path
        ]
        if is_gnu:
            compile_cmd.append("-static-libgcc")

        try:
            comp_res = subprocess.run(
                compile_cmd, 
                cwd=file_dir, 
                capture_output=True, 
                text=True, 
                errors="replace",
                timeout=20.0
            )
        except subprocess.TimeoutExpired:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=124,
                stdout="",
                stderr="[C Compilation Timeout] Compiler exceeded 20s limit.\n"
            )

        if comp_res.returncode != 0:
            return subprocess.CompletedProcess(
                args=compile_cmd,
                returncode=comp_res.returncode,
                stdout="",
                stderr=f"[C Compilation Error]\n{comp_res.stderr}"
            )

        run_env = env.copy()
        compiler_bin_dir = os.path.dirname(c_compiler)
        run_env["PATH"] = f"{compiler_bin_dir}{os.pathsep}{run_env.get('PATH', '')}"

        try:
            return subprocess.run(
                [bin_path],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=run_env,
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
    # D. WINDOWS BATCH / COMMAND SCRIPTS (.bat, .cmd)
    # -------------------------------------------------------------------------
    elif ext in [".bat", ".cmd"]:
        if sys.platform == "win32":
            return subprocess.run(
                ["cmd.exe", "/c", file_abs],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                timeout=timeout,
                input=stdin_data
            )
        else:
            return create_error_result(
                "[ERROR] Windows Batch scripts (.bat, .cmd) can only be executed on Windows systems."
            )

    # -------------------------------------------------------------------------
    # E. POWERSHELL SCRIPTS (.ps1)
    # -------------------------------------------------------------------------
    elif ext == ".ps1":
        ps_cmd = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
        return subprocess.run(
            [ps_cmd, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file_abs],
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
    # F. BASH / SHELL SCRIPTS (.sh, .bash, .zsh)
    # -------------------------------------------------------------------------
    elif ext in [".sh", ".bash", ".zsh"]:
        bash_cmd = find_shell_interpreter()
        if not bash_cmd:
            return create_error_result(
                "[ERROR] Shell interpreter (bash / sh) not found.\n"
                "On Windows, ensure Git for Windows (Git Bash) is installed."
            )
        return subprocess.run(
            [bash_cmd, file_abs],
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
    # G. JAVASCRIPT (.js, .mjs, .cjs)
    # -------------------------------------------------------------------------
    elif ext in [".js", ".mjs", ".cjs"]:
        node_cmd = shutil.which("node") or shutil.which("bun") or shutil.which("deno")
        if not node_cmd:
            return create_error_result(
                "[ERROR] JavaScript runtime (node / bun / deno) not found in system PATH."
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
    # H. TYPESCRIPT (.ts, .mts, .cts)
    # -------------------------------------------------------------------------
    elif ext in [".ts", ".mts", ".cts"]:
        ts_runner = shutil.which("bun") or shutil.which("tsx") or shutil.which("ts-node") or shutil.which("deno")
        if ts_runner:
            if "deno" in os.path.basename(ts_runner).lower():
                cmd = [ts_runner, "run", "-A", file_abs]
            else:
                cmd = [ts_runner, file_abs]
            return subprocess.run(
                cmd,
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                timeout=timeout,
                input=stdin_data
            )
        
        # Check npx fallback
        npx_cmd = shutil.which("npx")
        if npx_cmd:
            return subprocess.run(
                [npx_cmd, "tsx", file_abs],
                cwd=file_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=env,
                timeout=timeout,
                input=stdin_data
            )

        return create_error_result(
            "[ERROR] TypeScript runner (bun / tsx / ts-node / deno) not found in system PATH.\n"
            "Run 'npm install -g tsx' to execute TypeScript files directly."
        )

    # -------------------------------------------------------------------------
    # I. JAVA (.java)
    # -------------------------------------------------------------------------
    elif ext == ".java":
        java_cmd = shutil.which("java")
        if not java_cmd and sys.platform == "win32":
            java_home = os.environ.get("JAVA_HOME")
            if java_home and os.path.exists(os.path.join(java_home, "bin", "java.exe")):
                java_cmd = os.path.join(java_home, "bin", "java.exe")

        if not java_cmd:
            return create_error_result(
                "[ERROR] Java Runtime (java / JDK) not found in system PATH or JAVA_HOME.\n"
                "Please install OpenJDK or Oracle JDK to execute Java files."
            )

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
    # J. RUST (.rs)
    # -------------------------------------------------------------------------
    elif ext == ".rs":
        rustc_cmd = shutil.which("rustc")
        if not rustc_cmd:
            return create_error_result(
                "[ERROR] Rust compiler (rustc) not found in system PATH.\n"
                "Install Rust via https://rustup.rs/ to compile and run Rust files."
            )

        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_bin{bin_ext}"

        comp_res = subprocess.run([rustc_cmd, "-O", file_abs, "-o", bin_path], cwd=file_dir, capture_output=True, text=True, errors="replace")
        if comp_res.returncode != 0:
            return subprocess.CompletedProcess(
                args=[rustc_cmd, file_abs],
                returncode=comp_res.returncode,
                stdout="",
                stderr=f"[Rust Compilation Error]\n{comp_res.stderr}"
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
    # K. GO (.go)
    # -------------------------------------------------------------------------
    elif ext == ".go":
        go_cmd = shutil.which("go")
        if not go_cmd:
            return create_error_result(
                "[ERROR] Go compiler (go) not found in system PATH.\n"
                "Install Go from https://golang.org/ to run Go source files."
            )

        return subprocess.run(
            [go_cmd, "run", file_abs],
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
    # L. EXECUTABLE BINARY (.exe)
    # -------------------------------------------------------------------------
    elif ext == ".exe" and sys.platform == "win32":
        return subprocess.run(
            [file_abs],
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
    # M. UNSUPPORTED RUNTIME
    # -------------------------------------------------------------------------
    else:
        return create_error_result(
            f"[ERROR] Direct execution runner for '{ext}' is not configured.\n"
            "Supported languages:\n"
            "• Python (.py, .pyw)\n"
            "• C++ (.cpp, .cc, .cxx)\n"
            "• C (.c)\n"
            "• Windows Batch (.bat, .cmd)\n"
            "• PowerShell (.ps1)\n"
            "• Shell Scripts (.sh, .bash)\n"
            "• JavaScript (.js, .mjs)\n"
            "• TypeScript (.ts)\n"
            "• Java (.java)\n"
            "• Rust (.rs)\n"
            "• Go (.go)\n"
            "• Executable (.exe)"
        )


# Backward-compatible alias for WebSocket Router
run_python_script_sync = run_code_polyglot_sync