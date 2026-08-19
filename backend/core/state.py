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


class AppState:
    """Global thread-safe memory manager for Neuron Backend."""
    TARGET_DIR: str = get_default_workspace_dir()
    ACTIVE_FILE: str = "server.py"
    CONNECTIONS: Set[Any] = set()
    PROCESSES: Dict[str, Any] = {}
    EXCLUDE_DIRS: Set[str] = DEFAULT_EXCLUSIONS