# backend/build_sidecar.py
import os
import platform
import shutil
import subprocess
import sys


def get_target_triple() -> str:
    """
    Resolves the exact LLVM target triple required by Tauri 2.0 sidecar naming conventions.
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
    Purges all old spec/build caches and compiles a 100% self-contained single binary.
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
    direct_binary_path = os.path.join(tauri_binaries_dir, f"neuron-backend{ext}")

    print("\n" + "=" * 65)
    print(" [COMPILER] NEURON PYTHON PURGED BUILD (Guaranteed Embedded DLLs)")
    print("=" * 65)
    print(f" [*] Source:        {main_py_path}")
    print(f" [*] Target Triple: {target_triple}")
    print(f" [*] Destination:   {final_output_path}")
    print("=" * 65 + "\n")

    # 🚀 STEP 1: PRE-BUILD PURGE (Wipe old spec/build caches so PyInstaller never reuses --onedir)
    print("[INFO] Purging old build caches, spec files, and destination binaries...")
    shutil.rmtree(os.path.join(backend_dir, "build"), ignore_errors=True)
    shutil.rmtree(os.path.join(backend_dir, "dist"), ignore_errors=True)
    spec_file = os.path.join(backend_dir, "neuron-backend.spec")
    if os.path.exists(spec_file):
        try:
            os.remove(spec_file)
        except Exception:
            pass

    # Wipe destination binaries folder
    for f in [final_output_path, direct_binary_path]:
        if os.path.exists(f):
            try:
                os.remove(f)
            except Exception:
                pass

    # 🚀 STEP 2: COMPILE FRESH --onefile BINARY
    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "neuron-backend",
        "--noconfirm",
        "--clean",
        "--log-level=WARN",
        # 1. Server & Networking
        "--collect-all", "uvicorn",
        "--collect-all", "fastapi",
        "--collect-all", "starlette",
        "--collect-all", "websockets",
        "--collect-all", "httpx",
        # 2. Multi-Language AST Parsing
        "--collect-all", "tree_sitter",
        "--collect-all", "tree_sitter_python",
        "--collect-all", "tree_sitter_javascript",
        "--collect-all", "tree_sitter_typescript",
        "--collect-all", "tree_sitter_c",
        "--collect-all", "tree_sitter_cpp",
        "--collect-all", "tree_sitter_java",
        "--collect-all", "libcst",
        # 3. Graph ML & Mathematics (Lean & Fast, Zero Bloat)
        "--collect-all", "networkx",
        "--collect-all", "numpy",
        "--collect-all", "watchdog",
        # 4. Hidden Imports
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespans.on",
        "--hidden-import", "anyio",
        "--hidden-import", "sniffio",
        "--hidden-import", "pydantic",
        # 5. Exclude Heavy Third-Party Bloat (SciPy & Sklearn ~45MB saved, zero cyutility crash)
        "--exclude-module", "scipy",
        "--exclude-module", "sklearn",
        "--exclude-module", "scikit-learn",
        "--exclude-module", "matplotlib",
        "--exclude-module", "torch",
        "--exclude-module", "pandas",
        "--exclude-module", "IPython",
        "--exclude-module", "jupyter",
        "--exclude-module", "PIL",
        "--exclude-module", "pytest",
        "--exclude-module", "transformers",
        "--exclude-module", "sentence_transformers",
        "--exclude-module", "chromadb",
        "--exclude-module", "chromadb_rust_bindings",
        "--exclude-module", "onnxruntime",
        "--exclude-module", "kubernetes",
        "--exclude-module", "sympy",
        "--exclude-module", "gensim",
        "--exclude-module", "llvmlite",
        "--exclude-module", "numba",
        "--exclude-module", "grpc",
        "--exclude-module", "grpcio",
        "--exclude-module", "opentelemetry",
        "--exclude-module", "pynndescent",
        "--exclude-module", "umap",
        main_py_path
    ]

    print("[INFO] Invoking fresh PyInstaller compilation...")
    result = subprocess.run(pyinstaller_cmd, cwd=backend_dir)

    if result.returncode != 0:
        print("\n[ERROR] PyInstaller compilation failed.")
        sys.exit(result.returncode)

    generated_bin = os.path.join(backend_dir, "dist", f"neuron-backend{ext}")
    if not os.path.exists(generated_bin):
        print(f"\n[ERROR] Compiled binary not found at {generated_bin}")
        sys.exit(1)

    print(f"\n[INFO] Deploying clean binary to {final_output_path}...")
    shutil.copy2(generated_bin, final_output_path)
    shutil.copy2(generated_bin, direct_binary_path)

    if sys.platform != "win32":
        os.chmod(final_output_path, 0o755)
        os.chmod(direct_binary_path, 0o755)

    size_mb = os.path.getsize(final_output_path) / (1024 * 1024)
    print(f"[INFO] Fresh binary deployed ({size_mb:.1f} MB).")

    # Post-build cleanup
    shutil.rmtree(os.path.join(backend_dir, "build"), ignore_errors=True)
    shutil.rmtree(os.path.join(backend_dir, "dist"), ignore_errors=True)
    if os.path.exists(spec_file):
        os.remove(spec_file)

    print("\n" + "=" * 65)
    print(" [SUCCESS] FRESH STANDALONE BINARY CREATED! ")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    build_sidecar()