# backend/build_sidecar.py
import os
import platform
import shutil
import subprocess
import sys


def get_target_triple() -> str:
    """
    Resolves the exact LLVM target triple required by Tauri 2.0 sidecar naming conventions.
    Example output on 64-bit Windows: 'x86_64-pc-windows-msvc'
    """
    try:
        out = subprocess.check_output(["rustc", "-vV"], text=True)
        for line in out.splitlines():
            if line.startswith("host:"):
                return line.split(":")[1].strip()
    except Exception:
        pass

    machine = platform.machine().lower()
    if machine in ["amd64", "x86_64"]:
        arch = "x86_64"
    elif machine in ["arm64", "aarch64"]:
        arch = "aarch64"
    elif machine in ["i386", "i686", "x86"]:
        arch = "i686"
    else:
        arch = machine

    system = platform.system().lower()
    if system == "windows":
        return f"{arch}-pc-windows-msvc"
    elif system == "darwin":
        return f"{arch}-apple-darwin"
    elif system == "linux":
        return f"{arch}-unknown-linux-gnu"

    return f"{arch}-unknown-{system}"


def build_sidecar():
    """
    Compiles the complete Python FastAPI backend with all AST, ML, and server dependencies
    and deploys it directly into frontend/src-tauri/binaries/.
    """
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    main_py_path = os.path.join(backend_dir, "main.py")
    
    tauri_binaries_dir = os.path.abspath(
        os.path.join(backend_dir, "..", "frontend", "src-tauri", "binaries")
    )
    os.makedirs(tauri_binaries_dir, exist_ok=True)

    target_triple = get_target_triple()
    ext = ".exe" if sys.platform == "win32" else ""
    target_binary_name = f"neuron-backend-{target_triple}{ext}"
    final_output_path = os.path.join(tauri_binaries_dir, target_binary_name)

    print("\n" + "=" * 65)
    print("   NEURON PYTHON SIDECAR COMPILER (Fixed NumPy & SciPy Engine)")
    print("=" * 65)
    print(f"  Backend Source:     {main_py_path}")
    print(f"  Target Triple:      {target_triple}")
    print(f"  Output Destination: {final_output_path}")
    print("=" * 65 + "\n")

    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "neuron-backend",
        "--noconfirm",
        "--clean",
        "--log-level=WARN",
        # 1. Server, Networking & Async I/O
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--collect-all", "starlette",
        "--collect-all", "websockets",
        "--collect-all", "httpx",
        # 2. Multi-Language AST Parsing & Lossless Surgery
        "--collect-all", "tree_sitter",
        "--collect-all", "tree_sitter_python",
        "--collect-all", "tree_sitter_javascript",
        "--collect-all", "tree_sitter_typescript",
        "--collect-all", "libcst",
        # 3. Graph Intelligence & ML Mathematics
        "--collect-all", "networkx",
        "--collect-all", "sklearn",
        "--collect-all", "scipy",
        "--collect-all", "numpy",
        "--collect-all", "watchdog",
        # 4. Explicit Hidden Imports
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespans.on",
        "--hidden-import", "anyio",
        "--hidden-import", "sniffio",
        "--hidden-import", "pydantic",
        # 5. Exclude Truly Unused Heavy Libraries (Kept unittest for numpy.testing)
        "--exclude-module", "matplotlib",
        "--exclude-module", "torch",
        "--exclude-module", "pandas",
        "--exclude-module", "IPython",
        "--exclude-module", "jupyter",
        "--exclude-module", "PIL",
        "--exclude-module", "pytest",
        main_py_path
    ]

    print("[INFO] Compiling backend sidecar with PyInstaller...")
    result = subprocess.run(pyinstaller_cmd, cwd=backend_dir)

    if result.returncode != 0:
        print("\n [ERROR] PyInstaller compilation failed.")
        sys.exit(result.returncode)

    generated_bin = os.path.join(backend_dir, "dist", f"neuron-backend{ext}")
    if not os.path.exists(generated_bin):
        print(f"\n [ERROR] Compiled binary not found at {generated_bin}")
        sys.exit(1)

    if os.path.exists(final_output_path):
        try:
            os.remove(final_output_path)
        except PermissionError:
            print(f"\n [WARNING] Destination file {final_output_path} is currently locked by a running process.")
            print("Please close any running instances of Neuron or Task Manager, then rebuild.")
            sys.exit(1)
        except Exception:
            pass

    print(f"\n[INFO] Deploying sidecar binary to {final_output_path}...")
    shutil.copy2(generated_bin, final_output_path)

    if sys.platform != "win32":
        os.chmod(final_output_path, 0o755)

    size_mb = os.path.getsize(final_output_path) / (1024 * 1024)
    print(f"[INFO] Backend sidecar packaged ({size_mb:.1f} MB).")

    # Cleanup temporary build artifacts
    shutil.rmtree(os.path.join(backend_dir, "build"), ignore_errors=True)
    shutil.rmtree(os.path.join(backend_dir, "dist"), ignore_errors=True)
    spec_file = os.path.join(backend_dir, "neuron-backend.spec")
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print("\n" + "=" * 65)
    print(" PYTHON SIDECAR COMPILED & DEPLOYED SUCCESSFULLY! ")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    build_sidecar()