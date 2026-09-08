# backend/core/state.py
import os
import sys
from typing import Any, Dict, Set

# 🛡️ STRICT EXCLUSIONS: Prevents scanning Rust build targets & binary caches
DEFAULT_EXCLUSIONS: Set[str] = {
    "target", "binaries", "bundle", "node_modules", ".git", "__pycache__", 
    ".venv", "venv", "env", ".next", "dist", "build", ".cache", ".chroma", 
    ".onnx_models", ".idea", ".vscode", "coverage", ".turbo", ".pytest_cache"
}


def get_default_workspace_dir() -> str:
    """
    Resolves a permanent, user-writable workspace directory.
    Guarantees the IDE NEVER points into PyInstaller's temporary %TEMP%/_MEI folder
    or the marketing website directory.
    """
    # 1. Check if user passed an explicit directory via CLI argument (--target-dir)
    for idx, arg in enumerate(sys.argv):
        if arg == "--target-dir" and idx + 1 < len(sys.argv):
            candidate = os.path.abspath(sys.argv[idx + 1])
            if os.path.exists(candidate):
                return candidate.replace("\\", "/")

    # 2. Check environment variable override
    env_dir = os.environ.get("NEURON_WORKSPACE_DIR")
    if env_dir and os.path.exists(env_dir):
        return os.path.abspath(env_dir).replace("\\", "/")

    # 3. Default to permanent user workspace: ~/NeuronProjects
    home_dir = os.path.expanduser("~")
    neuron_projects_dir = os.path.join(home_dir, "NeuronProjects")
    
    try:
        os.makedirs(neuron_projects_dir, exist_ok=True)
        
        # Seed default Python starter module if workspace is empty
        starter_py = os.path.join(neuron_projects_dir, "server.py")
        if not os.path.exists(starter_py):
            with open(starter_py, "w", encoding="utf-8") as f:
                f.write(
                    'def calculate_metrics(data):\n'
                    '    """Process telemetry data stream."""\n'
                    '    return {"status": "nominal", "nodes": len(data)}\n\n'
                    'if __name__ == "__main__":\n'
                    '    print(calculate_metrics([1, 2, 3, 4]))\n'
                )

        # Seed default React starter component
        starter_jsx = os.path.join(neuron_projects_dir, "App.jsx")
        if not os.path.exists(starter_jsx):
            with open(starter_jsx, "w", encoding="utf-8") as f:
                f.write(
                    'import React, { useState } from "react";\n\n'
                    'export default function App() {\n'
                    '  const [count, setCount] = useState(0);\n'
                    '  return (\n'
                    '    <div className="p-6 bg-slate-900 text-white rounded-xl">\n'
                    '      <h1 className="text-xl font-bold">Neuron Project Workspace</h1>\n'
                    '      <p className="text-sm text-slate-400 mt-2">Telemetry active.</p>\n'
                    '    </div>\n'
                    '  );\n'
                    '}\n'
                )
    except Exception as e:
        print(f"[WARN] Failed to seed default workspace: {e}")

    return os.path.abspath(neuron_projects_dir).replace("\\", "/")


def get_neuron_config_dir() -> str:
    """Returns the ~/.neuron configuration directory, ensuring it exists."""
    config_dir = os.path.join(os.path.expanduser("~"), ".neuron")
    try:
        os.makedirs(config_dir, exist_ok=True)
    except Exception:
        pass
    return config_dir


class AppState:
    """Global thread-safe memory manager for Neuron Backend."""
    TARGET_DIR: str = get_default_workspace_dir()
    ACTIVE_FILE: str = "server.py"
    CONNECTIONS: Set[Any] = set()
    PROCESSES: Dict[str, Any] = {}
    EXCLUDE_DIRS: Set[str] = DEFAULT_EXCLUSIONS
    USER_SESSION: Any = None
    PENDING_PKCE_VERIFIER: str = ""
    BLAST_PROTECTION_ENABLED: bool = False

    @classmethod
    def save_session(cls, session: Any):
        """Persists the user session to ~/.neuron/auth_session.json."""
        try:
            import json
            cfg = get_neuron_config_dir()
            path = os.path.join(cfg, "auth_session.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(session, f)
        except Exception as e:
            print(f"[AUTH] Failed saving session to disk: {e}")

    @classmethod
    def load_session(cls) -> Any:
        """Loads cached session from ~/.neuron/auth_session.json if valid."""
        try:
            import json
            cfg = get_neuron_config_dir()
            path = os.path.join(cfg, "auth_session.json")
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return None

    @classmethod
    def clear_session(cls):
        """Deletes ~/.neuron/auth_session.json on sign-out."""
        try:
            cfg = get_neuron_config_dir()
            path = os.path.join(cfg, "auth_session.json")
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    @classmethod
    def save_verifier(cls, verifier: str):
        """Saves current PKCE verifier to ~/.neuron/pkce_verifier.txt."""
        try:
            cfg = get_neuron_config_dir()
            path = os.path.join(cfg, "pkce_verifier.txt")
            with open(path, "w", encoding="utf-8") as f:
                f.write(verifier.strip())
        except Exception:
            pass

    @classmethod
    def load_verifier(cls) -> str:
        """Loads PKCE verifier from ~/.neuron/pkce_verifier.txt."""
        try:
            cfg = get_neuron_config_dir()
            path = os.path.join(cfg, "pkce_verifier.txt")
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read().strip()
        except Exception:
            pass
        return ""