import subprocess
import sys
import os

print("Running Neuron ML Full Pipeline (NASA JM1 & Semantic Code Vulnerabilities)...")
script_dir = os.path.dirname(os.path.abspath(__file__))
build_script = os.path.join(script_dir, "build_notebook.py")

result = subprocess.run([sys.executable, build_script], cwd=script_dir)
if result.returncode == 0:
    print("\n[SUCCESS] Pipeline executed successfully. Notebook and outputs are up to date.")
else:
    print(f"\n[ERROR] Pipeline failed with return code {result.returncode}")
    sys.exit(result.returncode)
