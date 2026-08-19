# backend/main.py
import argparse
import asyncio
from contextlib import asynccontextmanager
import multiprocessing
import os
import sys
import tempfile

# Force UTF-8 encoding across all Python I/O channels
os.environ["PYTHONIOENCODING"] = "utf-8"

try:
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


# -------------------------------------------------------------------------
# 0. HEADLESS STDOUT/STDERR CRASH SHIELD (Line 1 Protection)
# -------------------------------------------------------------------------
class SafeStreamWriter:
    """
    Prevents AttributeError / OSError when Python is spawned headlessly by Tauri
    with null or closed standard I/O handles. Writes logs safely to %TEMP%.
    """
    def __init__(self, fallback_name="neuron_backend_stdout.log"):
        self.log_path = os.path.join(tempfile.gettempdir(), fallback_name)

    def write(self, data):
        if not data:
            return
        try:
            with open(self.log_path, "a", encoding="utf-8", errors="replace") as f:
                f.write(str(data))
        except Exception:
            pass

    def flush(self):
        pass


# Ensure sys.stdout and sys.stderr always have valid write/flush methods
if sys.stdout is None or not hasattr(sys.stdout, "write"):
    sys.stdout = SafeStreamWriter("neuron_backend_stdout.log")

if sys.stderr is None or not hasattr(sys.stderr, "write"):
    sys.stderr = SafeStreamWriter("neuron_backend_stderr.log")


# -------------------------------------------------------------------------
# 1. IMPORTS & APPLICATION LIFECYCLE (Lifespan Context)
# -------------------------------------------------------------------------
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer

from api.websocket_router import router as ws_router
from core.state import AppState
from services.terminal_service import kill_terminal_process
from services.workspace_service import CodeWatcher


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Coordinates server initialization and graceful teardown.
    """
    # 1. Normalize workspace directory
    AppState.TARGET_DIR = os.path.abspath(AppState.TARGET_DIR or os.getcwd())
    if not os.path.exists(AppState.TARGET_DIR):
        os.makedirs(AppState.TARGET_DIR, exist_ok=True)

    # 2. Launch Watchdog File System Observer
    loop = asyncio.get_running_loop()
    observer = Observer()
    watcher = CodeWatcher(loop)
    observer.schedule(watcher, path=AppState.TARGET_DIR, recursive=True)
    observer.start()

    is_frozen = getattr(sys, "frozen", False)
    mode_label = "Production Desktop Sidecar" if is_frozen else "Local Development Engine"

    print("\n" + "=" * 65)
    print(f" [SYSTEM] NEURON SPATIAL CODE INTELLIGENCE ({mode_label})")
    print("=" * 65)
    print(f" [*] Workspace Path:    {AppState.TARGET_DIR}")
    print(f" [*] WebSocket Stream:  ws://127.0.0.1:8000/ws")
    print(f" [*] AC-3 Refactoring:  Active (Python LibCST + JS Tree-Sitter)")
    print(f" [*] Vector Omni-Search: Pure-RAM TF-IDF / AST N-Gram")
    print(f" [*] Process Mode:      Single-Instance (Fork-Bomb Protected)")
    print("=" * 65 + "\n")

    yield

    # Shutdown sequence
    print("\n[INFO] Shutting down Neuron Backend services...")

    try:
        observer.stop()
        observer.join(timeout=2.0)
    except Exception:
        pass

    active_sessions = list(AppState.PROCESSES.keys())
    for sid in active_sessions:
        kill_terminal_process(sid)

    for ws in list(AppState.CONNECTIONS):
        try:
            await ws.close()
        except Exception:
            pass
    AppState.CONNECTIONS.clear()
    
    print("[INFO] Cleanup complete. Offline.")


# -------------------------------------------------------------------------
# 2. FASTAPI SERVER INITIALIZATION
# -------------------------------------------------------------------------
app = FastAPI(
    title="Neuron Spatial IDE Backend",
    version="2.4.0",
    description="Full-Stack Spatial Code Intelligence, AST Mutation, and Graph ML Engine",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)


# -------------------------------------------------------------------------
# 3. HEALTH PROBES
# -------------------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "status": "online",
        "system": "Neuron Spatial IDE Engine",
        "version": "2.4.0",
        "workspace": AppState.TARGET_DIR,
        "active_file": AppState.ACTIVE_FILE
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "connections": len(AppState.CONNECTIONS),
        "processes": len(AppState.PROCESSES)
    }


# -------------------------------------------------------------------------
# 4. ENTRY POINT (With PyInstaller Multiprocessing Freeze Guard)
# -------------------------------------------------------------------------
if __name__ == "__main__":
    multiprocessing.freeze_support()

    parser = argparse.ArgumentParser(description="Neuron Backend Engine")
    parser.add_argument("--target-dir", type=str, default="", help="Initial project directory path")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")
    args, _ = parser.parse_known_args()

    if args.target_dir and os.path.exists(args.target_dir):
        AppState.TARGET_DIR = os.path.abspath(args.target_dir)

    is_frozen = getattr(sys, "frozen", False)

    import uvicorn

    if is_frozen:
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=args.port,
            log_level="warning",
            access_log=False,
            workers=1,
            reload=False
        )
    else:
        uvicorn.run(
            "main:app",
            host="127.0.0.1",
            port=args.port,
            reload=True
        )