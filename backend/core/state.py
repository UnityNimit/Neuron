# backend/core/state.py
import os

class AppState:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    TARGET_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "benchmark_repos", "sample_app"))
    ACTIVE_FILE = "server.py"
    
    CONNECTIONS = set()
    PROCESSES = {}
    EXCLUDE_DIRS = {'.git', 'venv', 'node_modules', '__pycache__', 'dist', 'build', '.idea', '.vscode'}

os.makedirs(AppState.TARGET_DIR, exist_ok=True)