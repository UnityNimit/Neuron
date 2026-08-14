# backend/core/state.py
import os

class AppState:
    TARGET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "benchmark_repos", "sample_app"))
    ACTIVE_FILE = "server.py"
    CONNECTIONS = set()
    EXCLUDE_DIRS = {'.git', 'venv', 'node_modules', '__pycache__', 'dist', 'build', '.idea', '.vscode'}
    
    # CRITICAL FIX: Track running processes so they can be killed via Ctrl+C
    PROCESSES = {}