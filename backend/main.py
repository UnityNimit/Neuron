# backend/main.py
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from watchdog.observers import Observer

from core.state import AppState
from services.workspace_service import CodeWatcher
from api.websocket_router import router as ws_router

app = FastAPI(title="Neuron Spatial IDE Backend")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

app.include_router(ws_router)

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    observer = Observer()
    observer.schedule(CodeWatcher(loop), path=AppState.TARGET_DIR, recursive=True)
    observer.start()
    print(f"👀 Watchdog actively monitoring workspace at: {AppState.TARGET_DIR}")