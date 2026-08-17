# backend/main.py
import asyncio
from contextlib import asynccontextmanager
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer

from api.websocket_router import router as ws_router
from core.state import AppState
from services.terminal_service import kill_terminal_process
from services.workspace_service import CodeWatcher


# -------------------------------------------------------------------------
# 1. APPLICATION LIFECYCLE MANAGEMENT (Lifespan Context)
# -------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Coordinates server initialization and graceful teardown:
      - Startup: Normalizes target directory & launches real-time Watchdog daemon.
      - Shutdown: Terminates subprocesses, stops observer, and closes sockets.
    """
    # 🚀 STARTUP SEQUENCE
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

    print("\n" + "=" * 65)
    print(" 🌌  NEURON SPATIAL CODE INTELLIGENCE ENGINE (v2.4 Core) ")
    print("=" * 65)
    print(f" 📂 Workspace Path:    {AppState.TARGET_DIR}")
    print(f" ⚡ WebSocket Stream:  ws://127.0.0.1:8000/ws")
    print(f" 🛡️  AC-3 Refactoring:  Active (Python LibCST + JS Tree-Sitter)")
    print(f" 🔍 Vector Omni-Search: Pure-RAM TF-IDF / ChromaDB Hybrid")
    print("=" * 65 + "\n")

    yield

    # 🛑 GRACEFUL SHUTDOWN SEQUENCE
    print("\n[INFO] Shutting down Neuron Backend services...")

    # 1. Stop Watchdog Observer
    try:
        observer.stop()
        observer.join(timeout=2.0)
    except Exception:
        pass

    # 2. Terminate all running terminal subprocesses
    active_sessions = list(AppState.PROCESSES.keys())
    for sid in active_sessions:
        kill_terminal_process(sid)

    # 3. Disconnect remaining WebSockets
    for ws in list(AppState.CONNECTIONS):
        try:
            await ws.close()
        except Exception:
            pass
    AppState.CONNECTIONS.clear()
    
    print("[INFO] Cleanup complete. Offline.")


# -------------------------------------------------------------------------
# 2. FASTAPI INITIALIZATION & CORS CONFIGURATION
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

# Mount WebSocket Router
app.include_router(ws_router)


# -------------------------------------------------------------------------
# 3. HTTP HEALTH PROBES & DIAGNOSTICS
# -------------------------------------------------------------------------
@app.get("/")
async def root():
    """Root metadata probe."""
    return {
        "status": "online",
        "system": "Neuron Spatial IDE Engine",
        "version": "2.4.0",
        "workspace": AppState.TARGET_DIR,
        "active_file": AppState.ACTIVE_FILE
    }


@app.get("/health")
async def health_check():
    """Lightweight HTTP health probe for Tauri 2.0 / Native wrappers."""
    return {
        "status": "healthy",
        "connections": len(AppState.CONNECTIONS),
        "processes": len(AppState.PROCESSES)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)