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
import base64
import hashlib
import html
import secrets
from typing import Optional
import urllib.parse

import mimetypes

from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
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
    # 1. Normalize workspace directory and load cached auth session
    AppState.TARGET_DIR = os.path.abspath(AppState.TARGET_DIR or os.getcwd())
    if not os.path.exists(AppState.TARGET_DIR):
        os.makedirs(AppState.TARGET_DIR, exist_ok=True)

    cached_session = AppState.load_session()
    if cached_session:
        AppState.USER_SESSION = cached_session

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
    version="1.0.0",
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
        "version": "1.0.0",
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


@app.get("/api/supabase/ping")
async def ping_supabase():
    """
    Pings Supabase Auth and PostgREST endpoints to verify connectivity
    and keep the cloud project active.
    """
    results = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Ping Auth Gateway Health
        try:
            r_auth = await client.get(
                f"{SUPABASE_URL}/auth/v1/health",
                headers={"apikey": SUPABASE_ANON_KEY}
            )
            results["auth_gateway"] = {
                "status_code": r_auth.status_code,
                "ok": r_auth.status_code == 200,
                "data": r_auth.json() if r_auth.status_code == 200 else r_auth.text[:100]
            }
        except Exception as e:
            results["auth_gateway"] = {"error": str(e)}

        # 2. Ping Database RPC (executes real SQL to prevent 7-day pause)
        try:
            r_db = await client.get(
                f"{SUPABASE_URL}/rest/v1/rpc/ping",
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}
            )
            results["database_rpc"] = {
                "status_code": r_db.status_code,
                "ok": r_db.status_code == 200,
                "data": r_db.json() if r_db.status_code == 200 else r_db.text[:120]
            }
        except Exception as e:
            results["database_rpc"] = {"error": str(e)}

    return {
        "status": "ok",
        "supabase_url": SUPABASE_URL,
        "results": results
    }


# -------------------------------------------------------------------------
# 3.5 RAW STATIC FILE SERVING (Images, Media, Binary Assets)
# -------------------------------------------------------------------------
@app.get("/api/file/raw")
async def get_raw_file(path: str = Query(...)):
    """
    Safely serves a raw file (images, binaries, media) from disk.
    Accepts workspace-relative or absolute paths.
    """
    if not path:
        return JSONResponse({"status": "error", "reason": "Path is required"}, status_code=400)

    clean_path = path.replace("\\", "/").strip()
    if os.path.isabs(clean_path):
        target_file = os.path.abspath(clean_path)
    else:
        target_file = os.path.abspath(os.path.join(AppState.TARGET_DIR, clean_path.lstrip("/")))

    if not os.path.exists(target_file) or not os.path.isfile(target_file):
        return JSONResponse({"status": "error", "reason": f"File not found: {clean_path}"}, status_code=404)

    mime_type, _ = mimetypes.guess_type(target_file)
    if not mime_type:
        ext = os.path.splitext(target_file)[1].lower()
        mime_map = {
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".webp": "image/webp",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".avif": "image/avif",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")

    return FileResponse(
        target_file,
        media_type=mime_type,
        filename=os.path.basename(target_file)
    )


@app.get("/api/file/info")
async def get_file_info(path: str = Query(...)):
    """
    Returns file metadata (size in bytes, formatted size, modified timestamp).
    """
    if not path:
        return JSONResponse({"status": "error", "reason": "Path is required"}, status_code=400)

    clean_path = path.replace("\\", "/").strip()
    if os.path.isabs(clean_path):
        target_file = os.path.abspath(clean_path)
    else:
        target_file = os.path.abspath(os.path.join(AppState.TARGET_DIR, clean_path.lstrip("/")))

    if not os.path.exists(target_file) or not os.path.isfile(target_file):
        return JSONResponse({"status": "error", "reason": "File not found"}, status_code=404)

    stat = os.stat(target_file)
    size_bytes = stat.st_size

    def format_size(bytes_val: int) -> str:
        if bytes_val < 1024:
            return f"{bytes_val} B"
        elif bytes_val < 1024 * 1024:
            return f"{bytes_val / 1024:.1f} KB"
        elif bytes_val < 1024 * 1024 * 1024:
            return f"{bytes_val / (1024 * 1024):.1f} MB"
        else:
            return f"{bytes_val / (1024 * 1024 * 1024):.2f} GB"

    return {
        "status": "ok",
        "name": os.path.basename(target_file),
        "size_bytes": size_bytes,
        "size_formatted": format_size(size_bytes),
        "modified": stat.st_mtime
    }


# -------------------------------------------------------------------------
# 4. REAL GOOGLE OAUTH FLOW (Via Supabase) & SESSION SYNC
# -------------------------------------------------------------------------
SUPABASE_URL = "https://dmrtbxgvzugcumndtgdu.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcnRieGd2enVnY3VtbmR0Z2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5NDUsImV4cCI6MjEwMjA0Mzk0NX0."
    "Pmp0CeNjp-z7ZNZQiFWqFDEI6JIq5s3HxQxUOZZmo7I"
)


def generate_pkce_pair():
    """Generates a cryptographically secure PKCE verifier and SHA-256 challenge."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


@app.get("/auth")
async def auth_start():
    """
    Direct entry point for Google OAuth.
    Generates PKCE verifier/challenge, persists verifier to AppState and disk,
    and 307-redirects browser directly to Supabase Google OAuth consent screen.
    """
    verifier, challenge = generate_pkce_pair()
    AppState.PENDING_PKCE_VERIFIER = verifier
    AppState.save_verifier(verifier)

    params = {
        "provider": "google",
        "code_challenge": challenge,
        "code_challenge_method": "s256",
        "redirect_to": "http://127.0.0.1:8000/auth/callback",
        "prompt": "select_account",
    }
    target_url = f"{SUPABASE_URL}/auth/v1/authorize?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=target_url, status_code=307)


@app.get("/auth/callback", response_class=HTMLResponse)
async def auth_callback(
    code: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """
    Callback endpoint for Google OAuth via Supabase.
    Exchanges PKCE authorization code directly with Supabase server-to-server.
    Broadcasts session update to IDE via WebSocket and renders a minimal plain-text page.
    """
    # 1. Error returned by OAuth provider or Supabase
    if error:
        err_text = error_description or error
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Neuron</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background-color: #121314;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div>
    <p>Sign-in incomplete: {html.escape(err_text)}</p>
    <p>Please try again from Neuron.</p>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html_content, status_code=400)

    # 2. PKCE Authorization Code received
    if code:
        verifier = AppState.PENDING_PKCE_VERIFIER or AppState.load_verifier()
        session_obj = None
        err_detail = None

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                token_resp = await client.post(
                    f"{SUPABASE_URL}/auth/v1/token?grant_type=pkce",
                    headers={
                        "apikey": SUPABASE_ANON_KEY,
                        "Content-Type": "application/json",
                    },
                    json={
                        "auth_code": code,
                        "code_verifier": verifier,
                    },
                )
                if token_resp.status_code == 200:
                    session_obj = token_resp.json()
                else:
                    try:
                        err_json = token_resp.json()
                        err_detail = err_json.get("msg") or err_json.get("error_description") or token_resp.text
                    except Exception:
                        err_detail = token_resp.text
        except Exception as e:
            err_detail = str(e)

        if session_obj and session_obj.get("user"):
            AppState.USER_SESSION = session_obj
            AppState.save_session(session_obj)

            # Broadcast session to all connected IDE webview instances
            for ws in list(AppState.CONNECTIONS):
                try:
                    await ws.send_json({
                        "event": "AUTH_SESSION_UPDATE",
                        "session": session_obj
                    })
                except Exception:
                    pass

            html_success = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Neuron</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #121314;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
    }
  </style>
</head>
<body>
  <div>
    <p>Authenticated. You can close this tab.</p>
  </div>
  <script>
    setTimeout(() => {
      window.close();
    }, 1200);
  </script>
</body>
</html>"""
            return HTMLResponse(content=html_success)

        # Token exchange error
        err_msg = err_detail or "Failed to exchange authorization code."
        html_error = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Neuron</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background-color: #121314;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
    }}
  </style>
</head>
<body>
  <div>
    <p>Sign-in incomplete: {html.escape(err_msg)}</p>
    <p>Please try again from Neuron.</p>
  </div>
</body>
</html>"""
        return HTMLResponse(content=html_error, status_code=400)

    # 3. Fallback for client-side hash fragment (#access_token=...)
    html_hash_fallback = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Neuron</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #121314;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1.6;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="status">
    <p>Authenticating...</p>
  </div>
  <script>
    (async function() {
      try {
        if (window.location.hash) {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token) {
            const resp = await fetch('/auth/session_tokens', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token, refresh_token })
            });
            if (resp.ok) {
              document.getElementById('status').innerHTML = '<p>Authenticated. You can close this tab.</p>';
              setTimeout(() => window.close(), 1200);
              return;
            }
          }
        }
        document.getElementById('status').innerHTML = '<p>Sign-in incomplete.</p><p>Please try again from Neuron.</p>';
      } catch (e) {
        document.getElementById('status').innerHTML = '<p>Sign-in incomplete.</p><p>Please try again from Neuron.</p>';
      }
    })();
  </script>
</body>
</html>"""
    return HTMLResponse(content=html_hash_fallback)


@app.post("/auth/session_tokens")
async def handle_session_tokens(request: Request):
    """
    Exchanges implicit access token for Supabase user profile.
    """
    try:
        data = await request.json()
        access_token = data.get("access_token")
        refresh_token = data.get("refresh_token")
        if not access_token:
            return JSONResponse({"status": "error", "reason": "Missing access_token"}, status_code=400)

        async with httpx.AsyncClient(timeout=10.0) as client:
            user_resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {access_token}",
                },
            )
            if user_resp.status_code == 200:
                user_data = user_resp.json()
                session_obj = {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "user": user_data,
                }
                AppState.USER_SESSION = session_obj
                AppState.save_session(session_obj)

                for ws in list(AppState.CONNECTIONS):
                    try:
                        await ws.send_json({
                            "event": "AUTH_SESSION_UPDATE",
                            "session": session_obj,
                        })
                    except Exception:
                        pass
                return {"status": "ok"}
    except Exception as e:
        return JSONResponse({"status": "error", "reason": str(e)}, status_code=500)
    return JSONResponse({"status": "error", "reason": "Failed to validate user"}, status_code=400)


@app.post("/auth/session")
async def update_auth_session(request: Request):
    try:
        data = await request.json()
        session_obj = data.get("session") if (isinstance(data, dict) and "session" in data) else data
        AppState.USER_SESSION = session_obj
        if session_obj:
            AppState.save_session(session_obj)
        
        # Broadcast real-time auth update to all connected IDE instances
        for ws in list(AppState.CONNECTIONS):
            try:
                await ws.send_json({
                    "event": "AUTH_SESSION_UPDATE",
                    "session": session_obj
                })
            except Exception:
                pass
        return {"status": "ok", "session": session_obj}
    except Exception as e:
        return JSONResponse({"status": "error", "reason": str(e)}, status_code=400)


@app.get("/auth/session")
async def get_auth_session():
    return {"session": AppState.USER_SESSION}


@app.post("/auth/logout")
async def logout_auth_session():
    AppState.USER_SESSION = None
    AppState.clear_session()
    for ws in list(AppState.CONNECTIONS):
        try:
            await ws.send_json({"event": "AUTH_LOGOUT"})
        except Exception:
            pass
    return {"status": "ok"}


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

    import socket

    def is_port_in_use(port: int) -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.4)
                return s.connect_ex(("127.0.0.1", port)) == 0
        except Exception:
            return False

    if is_port_in_use(args.port):
        print(f"[NEURON BACKEND] Port {args.port} is already active and serving. Existing daemon running. Exiting cleanly.")
        sys.exit(0)

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
            app,
            host="127.0.0.1",
            port=args.port,
            log_level="info"
        )