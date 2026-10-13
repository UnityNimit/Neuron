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
        stype = (shell_type or "powershell").lower()
        if stype == "cmd":
            full_cmd = f"chcp 65001 >nul & {command} & echo __NEURON_CWD__:%cd%"
            args = ["cmd.exe", "/c", full_cmd]
        elif stype in ("bash", "sh", "zsh"):
            bash_exe = find_shell_interpreter() or "bash.exe"
            if os.path.isabs(bash_exe) and os.path.exists(bash_exe):
                bash_dir = os.path.dirname(bash_exe)
                git_root = os.path.dirname(bash_dir)
                extra_paths = [
                    os.path.join(git_root, "usr", "bin"),
                    os.path.join(git_root, "bin"),
                    bash_dir,
                ]
                existing_paths = [p for p in extra_paths if os.path.isdir(p)]
                if existing_paths:
                    env["PATH"] = os.pathsep.join(existing_paths) + os.pathsep + env.get("PATH", "")
            full_cmd = f'{command}; echo "__NEURON_CWD__:$(pwd -W 2>/dev/null || pwd)"'
            args = [bash_exe, "-c", full_cmd]
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
    """Finds bash or sh in Git for Windows install locations or system PATH."""
    if sys.platform == "win32":
        candidates = []
        git_exe = shutil.which("git")
        if git_exe and os.path.exists(git_exe):
            git_root = os.path.dirname(os.path.dirname(os.path.abspath(git_exe)))
            candidates.extend([
                os.path.join(git_root, "bin", "bash.exe"),
                os.path.join(git_root, "usr", "bin", "bash.exe"),
            ])

        candidates.extend([
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\bin\bash.exe"),
            r"C:\msys64\usr\bin\bash.exe",
        ])

        for c in candidates:
            if c and os.path.exists(c):
                return os.path.abspath(c)

        for name in ["bash", "sh"]:
            found = shutil.which(name)
            if found and os.path.exists(found):
                lower_found = found.lower()
                if "system32\\bash.exe" not in lower_found and "windowsapps\\bash.exe" not in lower_found:
                    return os.path.abspath(found)

        for name in ["bash", "sh"]:
            found = shutil.which(name)
            if found and os.path.exists(found):
                return os.path.abspath(found)

        return None

    for name in ["bash", "sh"]:
        found = shutil.which(name)
        if found and os.path.exists(found):
            return os.path.abspath(found)

    return None


# def find_java_runtime() -> Optional[str]:
    """Finds java executable in PATH, JAVA_HOME, or standard install locations."""
    for name in ["java"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        java_home = os.environ.get("JAVA_HOME")
        if java_home:
            cand = os.path.join(java_home, "bin", "java.exe")
            if is_valid_executable(cand):
                return os.path.abspath(cand)

        for pf_var in ["ProgramFiles", "ProgramFiles(x86)"]:
            pf = os.environ.get(pf_var, "")
            if pf and os.path.isdir(pf):
                for sub in ["Java", "Eclipse Adoptium", "Amazon Corretto", "BellSoft", "Zulu"]:
                    jdir = os.path.join(pf, sub)
                    if os.path.isdir(jdir):
                        try:
                            for entry in sorted(os.listdir(jdir), reverse=True):
                                cand = os.path.join(jdir, entry, "bin", "java.exe")
                                if is_valid_executable(cand):
                                    return os.path.abspath(cand)
                        except Exception:
                            pass
                cand_oracle = os.path.join(pf, "Common Files", "Oracle", "Java", "java8path", "java.exe")
                if is_valid_executable(cand_oracle):
                    return os.path.abspath(cand_oracle)
                cand_oracle_recent = os.path.join(pf, "Common Files", "Oracle", "Java", "javapath", "java.exe")
                if is_valid_executable(cand_oracle_recent):
                    return os.path.abspath(cand_oracle_recent)

    return None


def find_rust_compiler() -> Optional[str]:
    """Finds rustc in PATH or ~/.cargo/bin."""
    found = shutil.which("rustc")
    if is_valid_executable(found):
        return os.path.abspath(found)

    if sys.platform == "win32":
        user_profile = os.environ.get("USERPROFILE", "")
        if user_profile:
            cand = os.path.join(user_profile, ".cargo", "bin", "rustc.exe")
            if is_valid_executable(cand):
                return os.path.abspath(cand)
    else:
        home = os.environ.get("HOME", "")
        if home:
            cand = os.path.join(home, ".cargo", "bin", "rustc")
            if is_valid_executable(cand):
                return os.path.abspath(cand)

    return None


def find_go_compiler() -> Optional[str]:
    """Finds go in PATH or standard install locations."""
    found = shutil.which("go")
    if is_valid_executable(found):
        return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\Go\bin\go.exe",
            r"C:\Go\bin\go.exe",
            os.path.expandvars(r"%USERPROFILE%\go\bin\go.exe"),
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_node_runtime() -> Optional[str]:
    """Finds node, bun, or deno in PATH or standard install locations."""
    for name in ["node", "bun", "deno"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\nodejs\node.exe",
            r"C:\Program Files (x86)\nodejs\node.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\bun\bun.exe"),
            os.path.expandvars(r"%USERPROFILE%\.deno\bin\deno.exe"),
            os.path.expandvars(r"%APPDATA%\npm\node.exe"),
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_ts_runner() -> Optional[Tuple[str, List[str]]]:
    """Finds bun, tsx, ts-node, deno, or npx tsx."""
    for name in ["bun", "tsx", "ts-node", "deno"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            if "deno" in os.path.basename(found).lower():
                return (os.path.abspath(found), ["run", "-A"])
            return (os.path.abspath(found), [])

    if sys.platform == "win32":
        candidates = [
            os.path.expandvars(r"%APPDATA%\npm\tsx.cmd"),
            os.path.expandvars(r"%APPDATA%\npm\ts-node.cmd"),
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\bun\bun.exe"),
            os.path.expandvars(r"%USERPROFILE%\.deno\bin\deno.exe"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return (os.path.abspath(c), [])

    npx = shutil.which("npx")
    if is_valid_executable(npx):
        return (os.path.abspath(npx), ["tsx"])

    return None


def find_csharp_runner() -> Optional[str]:
    """Finds dotnet or csc in PATH or standard install paths."""
    for name in ["dotnet", "csc"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)

    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\dotnet\dotnet.exe",
            r"C:\Program Files (x86)\dotnet\dotnet.exe",
            r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
            r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_php_interpreter() -> Optional[str]:
    """Finds php in PATH or standard install locations."""
    found = shutil.which("php")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        candidates = [
            r"C:\php\php.exe",
            r"C:\xampp\php\php.exe",
            r"C:\wamp64\bin\php\php.exe",
            r"C:\tools\php\php.exe",
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_ruby_interpreter() -> Optional[str]:
    """Finds ruby in PATH or standard install locations."""
    found = shutil.which("ruby")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        for drive in ["C:\\"]:
            try:
                for entry in sorted(os.listdir(drive), reverse=True):
                    if entry.lower().startswith("ruby"):
                        cand = os.path.join(drive, entry, "bin", "ruby.exe")
                        if is_valid_executable(cand):
                            return os.path.abspath(cand)
            except Exception:
                pass
    return None


def find_kotlin_runner() -> Optional[str]:
    """Finds kotlin or kotlinc in PATH."""
    for name in ["kotlinc", "kotlin"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)
    return None


def find_swift_runner() -> Optional[str]:
    """Finds swift in PATH or standard install locations."""
    found = shutil.which("swift")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files\Swift\bin\swift.exe",
            r"C:\Library\Developer\Toolchains\unknown-Asserts-development.xctoolchain\usr\bin\swift.exe",
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_dart_runner() -> Optional[str]:
    """Finds dart in PATH or standard install locations."""
    found = shutil.which("dart")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        candidates = [
            r"C:\tools\dart-sdk\bin\dart.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Pub\Cache\bin\dart.exe"),
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


def find_r_runner() -> Optional[str]:
    """Finds Rscript in PATH or standard install locations."""
    found = shutil.which("Rscript")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        pf = os.environ.get("ProgramFiles", r"C:\Program Files")
        r_dir = os.path.join(pf, "R")
        if os.path.isdir(r_dir):
            try:
                for entry in sorted(os.listdir(r_dir), reverse=True):
                    cand = os.path.join(r_dir, entry, "bin", "Rscript.exe")
                    if is_valid_executable(cand):
                        return os.path.abspath(cand)
            except Exception:
                pass
    return None


def find_lua_runner() -> Optional[str]:
    """Finds lua or luajit in PATH."""
    for name in ["lua", "luajit", "lua54", "lua53"]:
        found = shutil.which(name)
        if is_valid_executable(found):
            return os.path.abspath(found)
    return None


def find_perl_runner() -> Optional[str]:
    """Finds perl in PATH or Strawberry Perl install path."""
    found = shutil.which("perl")
    if is_valid_executable(found):
        return os.path.abspath(found)
    if sys.platform == "win32":
        candidates = [
            r"C:\Strawberry\perl\bin\perl.exe",
            r"C:\Perl\bin\perl.exe",
            r"C:\Perl64\bin\perl.exe",
        ]
        for c in candidates:
            if is_valid_executable(c):
                return os.path.abspath(c)
    return None


# -------------------------------------------------------------------------
# 6. UNIVERSAL POLYGLOT EXECUTION PIPELINE RESOLVER
# -------------------------------------------------------------------------
def resolve_execution_pipeline(file_abs: str, target_dir: str) -> Dict[str, Any]:
    """
    Inspects source file extension and resolves appropriate compiler,
    arguments, runtime environment, and temporary binaries for ANY language.
    Guarantees non-Python files NEVER execute through Python.
    """
    file_dir = os.path.dirname(file_abs)
    ext = os.path.splitext(file_abs)[1].lower()
    clean_target = os.path.abspath(target_dir)

    env = os.environ.copy()
    env.pop("PYTHONHOME", None)
    env.pop("_MEIPASS2", None)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONUTF8"] = "1"
    env["FORCE_COLOR"] = "1"
    env["TERM"] = "xterm-256color"

    # Python import path: target_dir + file_dir
    pythonpath_entries = [clean_target, file_dir]
    if "PYTHONPATH" in env and env["PYTHONPATH"]:
        for p in env["PYTHONPATH"].split(os.pathsep):
            if "_MEI" not in p and p not in pythonpath_entries:
                pythonpath_entries.append(p)
    env["PYTHONPATH"] = os.pathsep.join(pythonpath_entries)

    # Node path: node_modules + target_dir + file_dir
    node_paths = [os.path.join(clean_target, "node_modules"), clean_target, file_dir]
    if "NODE_PATH" in env:
        node_paths.append(env["NODE_PATH"])
    env["NODE_PATH"] = os.pathsep.join(node_paths)

    # 1. PYTHON (.py, .pyw)
    if ext in [".py", ".pyw"]:
        py_exe = find_python_interpreter(clean_target, file_dir)
        if not py_exe:
            return {"error": "[Neuron Universal Runner] Python interpreter not found on system.\nPlease install Python from https://www.python.org/ or ensure 'python' is added to system PATH."}
        return {
            "compile_cmd": None,
            "run_cmd": [py_exe, "-u", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Python"
        }

    # 2. C++ (.cpp, .cc, .cxx, .c++, .hpp)
    elif ext in [".cpp", ".cc", ".cxx", ".c++", ".hpp"]:
        cpp_compiler = find_cpp_compiler()
        if not cpp_compiler:
            return {"error": "[Neuron Universal Runner] C++ compiler (g++ / clang++) not found in system PATH or MSYS2.\nPlease install MinGW-w64 (GCC) or LLVM Clang to compile and run C++ files."}
        run_uid = uuid.uuid4().hex[:8]
        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_{run_uid}{bin_ext}"
        is_gnu = "g++" in os.path.basename(cpp_compiler).lower()
        compile_cmd = [
            cpp_compiler,
            "-O2",
            "-std=c++20",
            f"-I{clean_target}",
            f"-I{file_dir}",
            file_abs,
            "-o",
            bin_path
        ]
        if is_gnu:
            compile_cmd.extend(["-static-libgcc", "-static-libstdc++"])
        run_env = env.copy()
        compiler_bin_dir = os.path.dirname(cpp_compiler)
        run_env["PATH"] = f"{compiler_bin_dir}{os.pathsep}{run_env.get('PATH', '')}"
        return {
            "compile_cmd": compile_cmd,
            "run_cmd": [bin_path],
            "run_cwd": file_dir,
            "run_env": run_env,
            "temp_bin": bin_path,
            "lang": "C++"
        }

    # 3. C (.c, .h)
    elif ext in [".c", ".h"]:
        c_compiler = find_c_compiler()
        if not c_compiler:
            return {"error": "[Neuron Universal Runner] C compiler (gcc / clang) not found in system PATH or MSYS2.\nPlease install MinGW-w64 (GCC) or LLVM Clang to compile and run C files."}
        run_uid = uuid.uuid4().hex[:8]
        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_{run_uid}{bin_ext}"
        is_gnu = "gcc" in os.path.basename(c_compiler).lower()
        compile_cmd = [
            c_compiler,
            "-O2",
            f"-I{clean_target}",
            f"-I{file_dir}",
            file_abs,
            "-o",
            bin_path
        ]
        if is_gnu:
            compile_cmd.append("-static-libgcc")
        run_env = env.copy()
        compiler_bin_dir = os.path.dirname(c_compiler)
        run_env["PATH"] = f"{compiler_bin_dir}{os.pathsep}{run_env.get('PATH', '')}"
        return {
            "compile_cmd": compile_cmd,
            "run_cmd": [bin_path],
            "run_cwd": file_dir,
            "run_env": run_env,
            "temp_bin": bin_path,
            "lang": "C"
        }

    # 4. RUST (.rs)
    elif ext == ".rs":
        rustc_cmd = find_rust_compiler()
        if not rustc_cmd:
            return {"error": "[Neuron Universal Runner] Rust compiler (rustc) not found in system PATH or ~/.cargo/bin.\nPlease install Rust via https://rustup.rs/ to compile and run Rust files."}
        run_uid = uuid.uuid4().hex[:8]
        bin_ext = ".exe" if sys.platform == "win32" else ""
        bin_path = os.path.splitext(file_abs)[0] + f"_neuron_{run_uid}{bin_ext}"
        compile_cmd = [rustc_cmd, "-O", file_abs, "-o", bin_path]
        return {
            "compile_cmd": compile_cmd,
            "run_cmd": [bin_path],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": bin_path,
            "lang": "Rust"
        }

    # 5. GO (.go)
    elif ext == ".go":
        go_cmd = find_go_compiler()
        if not go_cmd:
            return {"error": "[Neuron Universal Runner] Go compiler (go) not found in system PATH.\nPlease install Go from https://golang.org/ to run Go source files."}
        return {
            "compile_cmd": None,
            "run_cmd": [go_cmd, "run", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Go"
        }

    # 6. JAVA (.java)
    elif ext == ".java":
        java_cmd = find_java_runtime()
        if not java_cmd:
            return {"error": "[Neuron Universal Runner] Java Runtime (java / JDK) not found in system PATH or JAVA_HOME.\nPlease install OpenJDK or Oracle JDK to execute Java files."}
        classpath = f"{clean_target}{os.pathsep}{file_dir}"
        return {
            "compile_cmd": None,
            "run_cmd": [java_cmd, "-cp", classpath, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Java"
        }

    # 7. JAVASCRIPT (.js, .mjs, .cjs)
    elif ext in [".js", ".mjs", ".cjs"]:
        node_cmd = find_node_runtime()
        if not node_cmd:
            return {"error": "[Neuron Universal Runner] JavaScript runtime (node / bun / deno) not found in system PATH.\nPlease install Node.js from https://nodejs.org/ to execute JavaScript files."}
        return {
            "compile_cmd": None,
            "run_cmd": [node_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "JavaScript"
        }

    # 8. TYPESCRIPT (.ts, .mts, .cts)
    elif ext in [".ts", ".mts", ".cts"]:
        ts_res = find_ts_runner()
        if not ts_res:
            return {"error": "[Neuron Universal Runner] TypeScript runner (bun / tsx / ts-node / deno) not found.\nRun 'npm install -g tsx' to execute TypeScript files directly."}
        runner_bin, extra_args = ts_res
        return {
            "compile_cmd": None,
            "run_cmd": [runner_bin] + extra_args + [file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "TypeScript"
        }

    # 9. C# (.cs)
    elif ext == ".cs":
        cs_runner = find_csharp_runner()
        if not cs_runner:
            return {"error": "[Neuron Universal Runner] C# / .NET SDK (dotnet / csc) not found in system PATH.\nPlease install .NET SDK from https://dotnet.microsoft.com/ to execute C# files."}
        if "dotnet" in os.path.basename(cs_runner).lower():
            csproj_found = any(f.endswith(".csproj") for f in os.listdir(file_dir) if os.path.isfile(os.path.join(file_dir, f)))
            if csproj_found:
                run_cmd = [cs_runner, "run", "--project", file_dir]
            else:
                run_cmd = [cs_runner, "run", file_abs]
            return {
                "compile_cmd": None,
                "run_cmd": run_cmd,
                "run_cwd": file_dir,
                "run_env": env,
                "temp_bin": None,
                "lang": "C#"
            }
        else:
            run_uid = uuid.uuid4().hex[:8]
            bin_path = os.path.splitext(file_abs)[0] + f"_neuron_{run_uid}.exe"
            return {
                "compile_cmd": [cs_runner, f"/out:{bin_path}", file_abs],
                "run_cmd": [bin_path],
                "run_cwd": file_dir,
                "run_env": env,
                "temp_bin": bin_path,
                "lang": "C#"
            }

    # 10. PHP (.php)
    elif ext == ".php":
        php_cmd = find_php_interpreter()
        if not php_cmd:
            return {"error": "[Neuron Universal Runner] PHP interpreter (php) not found in system PATH.\nPlease install PHP from https://www.php.net/ to execute PHP files."}
        return {
            "compile_cmd": None,
            "run_cmd": [php_cmd, "-f", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "PHP"
        }

    # 11. RUBY (.rb)
    elif ext == ".rb":
        rb_cmd = find_ruby_interpreter()
        if not rb_cmd:
            return {"error": "[Neuron Universal Runner] Ruby interpreter (ruby) not found in system PATH.\nPlease install Ruby from https://www.ruby-lang.org/ to execute Ruby files."}
        return {
            "compile_cmd": None,
            "run_cmd": [rb_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Ruby"
        }

    # 12. KOTLIN (.kt, .kts)
    elif ext in [".kt", ".kts"]:
        kt_cmd = find_kotlin_runner()
        if not kt_cmd:
            return {"error": "[Neuron Universal Runner] Kotlin runner (kotlin / kotlinc) not found in system PATH.\nPlease install Kotlin from https://kotlinlang.org/ to execute Kotlin files."}
        if ext == ".kts" or "kotlinc" in os.path.basename(kt_cmd).lower():
            run_cmd = [kt_cmd, "-script", file_abs]
        else:
            run_cmd = [kt_cmd, file_abs]
        return {
            "compile_cmd": None,
            "run_cmd": run_cmd,
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Kotlin"
        }

    # 13. SWIFT (.swift)
    elif ext == ".swift":
        swift_cmd = find_swift_runner()
        if not swift_cmd:
            return {"error": "[Neuron Universal Runner] Swift compiler (swift) not found in system PATH.\nPlease install Swift from https://www.swift.org/ to execute Swift files."}
        return {
            "compile_cmd": None,
            "run_cmd": [swift_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Swift"
        }

    # 14. DART (.dart)
    elif ext == ".dart":
        dart_cmd = find_dart_runner()
        if not dart_cmd:
            return {"error": "[Neuron Universal Runner] Dart runtime (dart) not found in system PATH.\nPlease install Dart SDK from https://dart.dev/ to execute Dart files."}
        return {
            "compile_cmd": None,
            "run_cmd": [dart_cmd, "run", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Dart"
        }

    # 15. R (.r, .R)
    elif ext in [".r", ".R"]:
        r_cmd = find_r_runner()
        if not r_cmd:
            return {"error": "[Neuron Universal Runner] Rscript not found in system PATH.\nPlease install R from https://www.r-project.org/ to execute R files."}
        return {
            "compile_cmd": None,
            "run_cmd": [r_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "R"
        }

    # 16. LUA (.lua)
    elif ext == ".lua":
        lua_cmd = find_lua_runner()
        if not lua_cmd:
            return {"error": "[Neuron Universal Runner] Lua interpreter (lua / luajit) not found in system PATH.\nPlease install Lua from https://www.lua.org/ to execute Lua files."}
        return {
            "compile_cmd": None,
            "run_cmd": [lua_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Lua"
        }

    # 17. PERL (.pl, .pm)
    elif ext in [".pl", ".pm"]:
        perl_cmd = find_perl_runner()
        if not perl_cmd:
            return {"error": "[Neuron Universal Runner] Perl interpreter (perl) not found in system PATH.\nPlease install Perl from https://www.perl.org/ to execute Perl files."}
        return {
            "compile_cmd": None,
            "run_cmd": [perl_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Perl"
        }

    # 18. POWERSHELL (.ps1)
    elif ext == ".ps1":
        ps_cmd = shutil.which("pwsh") or shutil.which("powershell") or "powershell.exe"
        return {
            "compile_cmd": None,
            "run_cmd": [ps_cmd, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "PowerShell"
        }

    # 19. BASH / SHELL (.sh, .bash, .zsh)
    elif ext in [".sh", ".bash", ".zsh"]:
        bash_cmd = find_shell_interpreter()
        if not bash_cmd:
            return {"error": "[Neuron Universal Runner] Shell interpreter (bash / sh) not found.\nOn Windows, ensure Git for Windows is installed."}
        return {
            "compile_cmd": None,
            "run_cmd": [bash_cmd, file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Bash"
        }

    # 20. WINDOWS BATCH (.bat, .cmd)
    elif ext in [".bat", ".cmd"]:
        if sys.platform != "win32":
            return {"error": "[Neuron Universal Runner] Windows Batch scripts (.bat, .cmd) can only be executed on Windows systems."}
        return {
            "compile_cmd": None,
            "run_cmd": ["cmd.exe", "/c", file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Batch"
        }

    # 21. EXECUTABLE BINARY (.exe)
    elif ext == ".exe":
        return {
            "compile_cmd": None,
            "run_cmd": [file_abs],
            "run_cwd": file_dir,
            "run_env": env,
            "temp_bin": None,
            "lang": "Binary"
        }

    # 22. GENERIC POLYGLOT FALLBACK (tool name matching extension)
    clean_ext = ext.lstrip(".").lower()
    if clean_ext:
        custom_tool = shutil.which(clean_ext)
        if custom_tool and is_valid_executable(custom_tool):
            return {
                "compile_cmd": None,
                "run_cmd": [custom_tool, file_abs],
                "run_cwd": file_dir,
                "run_env": env,
                "temp_bin": None,
                "lang": clean_ext.upper()
            }

    return {
        "error": (
            f"[Neuron Universal Runner] No configured execution runtime for file extension '{ext}'.\n"
            "Supported languages:\n"
            "• Python (.py, .pyw)\n"
            "• C++ (.cpp, .cc, .cxx, .hpp)\n"
            "• C (.c, .h)\n"
            "• Java (.java)\n"
            "• Rust (.rs)\n"
            "• Go (.go)\n"
            "• JavaScript (.js, .mjs, .cjs)\n"
            "• TypeScript (.ts, .mts, .cts)\n"
            "• C# (.cs)\n"
            "• PHP (.php)\n"
            "• Ruby (.rb)\n"
            "• Kotlin (.kt, .kts)\n"
            "• Swift (.swift)\n"
            "• Dart (.dart)\n"
            "• R (.r, .R)\n"
            "• Lua (.lua)\n"
            "• Perl (.pl, .pm)\n"
            "• Shell (.sh, .bash, .zsh)\n"
            "• PowerShell (.ps1)\n"
            "• Batch (.bat, .cmd)\n"
            "• Executable (.exe)"
        )
    }


# -------------------------------------------------------------------------
# 7. UNBUFFERED REAL-TIME POLYGLOT STREAMING RUNNER
# -------------------------------------------------------------------------
async def stream_code_polyglot(
    websocket: Any,
    file_to_run: str,
    stdin_data: str = "",
    timeout: float = 30.0
) -> None:
    """
    Universal Polyglot Code Runner with unbuffered real-time stdout/stderr streaming
    and standard input pipe support.
    """
    target_dir = os.path.abspath(AppState.TARGET_DIR)

    # 1. Resolve target file path
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

    if not os.path.exists(file_abs):
        await safe_send(websocket, {
            "event": "TERMINAL_ERROR",
            "payload": f"[ERROR] Source file does not exist on disk:\n{file_abs}\nWorkspace Root: {target_dir}\n"
        })
        await safe_send(websocket, {
            "event": "TERMINAL_OUTPUT",
            "payload": "\n[Done] exited with code 1 in 0.00s\n"
        })
        return

    # 2. Resolve compilation and execution pipeline
    pipeline = resolve_execution_pipeline(file_abs, target_dir)
    if "error" in pipeline:
        await safe_send(websocket, {
            "event": "TERMINAL_ERROR",
            "payload": pipeline["error"] + "\n"
        })
        await safe_send(websocket, {
            "event": "TERMINAL_OUTPUT",
            "payload": "\n[Done] exited with code 1 in 0.00s\n"
        })
        return

    temp_bin = pipeline.get("temp_bin")
    file_dir = os.path.dirname(file_abs)
    file_name = os.path.basename(file_abs)
    start_time = asyncio.get_event_loop().time()
    loop = asyncio.get_running_loop()

    try:
        # 3. Handle compilation phase
        compile_cmd = pipeline.get("compile_cmd")
        if compile_cmd:
            await safe_send(websocket, {
                "event": "TERMINAL_OUTPUT",
                "payload": f"[Compiling] {file_name}...\n"
            })
            try:
                comp_res = await asyncio.to_thread(
                    subprocess.run,
                    compile_cmd,
                    cwd=file_dir,
                    capture_output=True,
                    text=True,
                    errors="replace",
                    timeout=20.0
                )
            except subprocess.TimeoutExpired:
                await safe_send(websocket, {
                    "event": "TERMINAL_ERROR",
                    "payload": "\n[Compilation Timeout] Compiler exceeded 20s limit.\n"
                })
                await safe_send(websocket, {
                    "event": "TERMINAL_OUTPUT",
                    "payload": "\n[Done] compilation timed out with code 124\n"
                })
                return

            if comp_res.returncode != 0:
                err_text = comp_res.stderr or comp_res.stdout or "Unknown compiler error."
                await safe_send(websocket, {
                    "event": "TERMINAL_ERROR",
                    "payload": f"\n[Compilation Error]\n{err_text}\n"
                })
                await safe_send(websocket, {
                    "event": "TERMINAL_OUTPUT",
                    "payload": f"\n[Done] compilation failed with code {comp_res.returncode}\n"
                })
                return

        # 4. Spawning execution process
        run_cmd = pipeline["run_cmd"]
        run_cwd = pipeline.get("run_cwd", file_dir)
        run_env = pipeline.get("run_env", os.environ.copy())

        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
        start_session = True if sys.platform != "win32" else False

        process = subprocess.Popen(
            run_cmd,
            cwd=run_cwd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=run_env,
            bufsize=0,
            creationflags=creation_flags,
            start_new_session=start_session
        )
        AppState.PROCESSES["output"] = process

        # 5. Pipe standard input immediately and close to send EOF
        if process.stdin and not process.stdin.closed:
            try:
                if stdin_data:
                    process.stdin.write(stdin_data.encode('utf-8', errors='replace'))
                    process.stdin.flush()
                process.stdin.close()
            except Exception:
                pass

        # 6. Stream stdout & stderr chunks in real time
        saw_eof_error = False

        def read_stream(stream, is_err: bool):
            nonlocal saw_eof_error
            try:
                decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
                fd = stream.fileno()
                while True:
                    raw = os.read(fd, 2048)
                    if not raw:
                        break
                    text = decoder.decode(raw)
                    if not text:
                        continue
                    if "EOFError" in text or "EOF when reading" in text:
                        saw_eof_error = True
                    event_name = "TERMINAL_ERROR" if is_err else "TERMINAL_OUTPUT"
                    asyncio.run_coroutine_threadsafe(
                        safe_send(websocket, {
                            "event": event_name,
                            "payload": text
                        }),
                        loop
                    )

                rem = decoder.decode(b"", final=True)
                if rem:
                    if "EOFError" in rem or "EOF when reading" in rem:
                        saw_eof_error = True
                    event_name = "TERMINAL_ERROR" if is_err else "TERMINAL_OUTPUT"
                    asyncio.run_coroutine_threadsafe(
                        safe_send(websocket, {
                            "event": event_name,
                            "payload": rem
                        }),
                        loop
                    )
            except Exception:
                pass

        t_out = threading.Thread(target=read_stream, args=(process.stdout, False), daemon=True)
        t_err = threading.Thread(target=read_stream, args=(process.stderr, True), daemon=True)
        t_out.start()
        t_err.start()

        # 7. Wait for completion with timeout guard
        try:
            return_code = await asyncio.wait_for(
                asyncio.to_thread(process.wait),
                timeout=timeout
            )
            elapsed = asyncio.get_event_loop().time() - start_time
            t_out.join(timeout=0.4)
            t_err.join(timeout=0.4)

            await safe_send(websocket, {
                "event": "TERMINAL_OUTPUT",
                "payload": f"\n[Done] exited with code {return_code} in {elapsed:.2f}s\n"
            })

            if return_code != 0 and saw_eof_error and not stdin_data.strip():
                await safe_send(websocket, {
                    "event": "TERMINAL_OUTPUT",
                    "payload": "[Tip] Program requested input but Stdin was empty. You can enter test cases in the Stdin panel on the right.\n"
                })

        except asyncio.TimeoutError:
            kill_terminal_process("output")
            await safe_send(websocket, {
                "event": "TERMINAL_ERROR",
                "payload": f"\n[Timeout] Execution exceeded {timeout:.0f}s limit.\n"
            })

    except Exception as run_err:
        await safe_send(websocket, {
            "event": "TERMINAL_ERROR",
            "payload": f"\n[Execution Error] {str(run_err)}\n"
        })
    finally:
        AppState.PROCESSES.pop("output", None)
        if temp_bin and os.path.exists(temp_bin):
            try:
                os.remove(temp_bin)
            except Exception:
                pass


# -------------------------------------------------------------------------
# 8. SYNCHRONOUS POLYGLOT RUNNER (Backward Compatibility Wrapper)
# -------------------------------------------------------------------------
def run_code_polyglot_sync(
    file_to_run: str,
    stdin_data: str = "",
    timeout: float = 30.0
) -> subprocess.CompletedProcess:
    """Synchronous execution wrapper using resolve_execution_pipeline."""
    target_dir = os.path.abspath(AppState.TARGET_DIR)
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

    def create_err(msg: str) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(args=[file_to_run], returncode=1, stdout="", stderr=msg)

    if not os.path.exists(file_abs):
        return create_err(f"[ERROR] Source file does not exist on disk:\n{file_abs}\nWorkspace Root: {target_dir}")

    pipeline = resolve_execution_pipeline(file_abs, target_dir)
    if "error" in pipeline:
        return create_err(pipeline["error"])

    temp_bin = pipeline.get("temp_bin")
    file_dir = os.path.dirname(file_abs)

    try:
        compile_cmd = pipeline.get("compile_cmd")
        if compile_cmd:
            comp_res = subprocess.run(compile_cmd, cwd=file_dir, capture_output=True, text=True, errors="replace", timeout=20.0)
            if comp_res.returncode != 0:
                return comp_res

        run_cmd = pipeline["run_cmd"]
        run_cwd = pipeline.get("run_cwd", file_dir)
        run_env = pipeline.get("run_env", os.environ.copy())

        return subprocess.run(
            run_cmd,
            cwd=run_cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=run_env,
            timeout=timeout,
            input=stdin_data
        )
    finally:
        if temp_bin and os.path.exists(temp_bin):
            try:
                os.remove(temp_bin)
            except Exception:
                pass


# Backward-compatible alias for WebSocket Router
run_python_script_sync = run_code_polyglot_sync