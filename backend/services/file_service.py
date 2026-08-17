# backend/services/file_service.py
import os
import posixpath
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

from ai.csp_guard import ac3_validate_refactor, CSPValidationResult
from core.js_mutator import execute_js_symbol_refactor_transplant
from core.mutator import execute_symbol_refactor_transplant, update_function_in_file
from core.state import AppState

# Excluded folders to preserve sub-millisecond AST memory snapshot performance
DEFAULT_EXCLUSIONS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    ".next", "dist", "build", ".cache", ".chroma", ".onnx_models",
    ".idea", ".vscode", "coverage"
}


# -------------------------------------------------------------------------
# 1. NATIVE MULTI-PLATFORM FOLDER PICKER DIALOG
# -------------------------------------------------------------------------
def pick_folder_sync() -> str:
    """
    Opens a native modal folder picker dialog with cross-platform fallback handling.
    Supports Windows PowerShell, macOS AppleScript, Linux Zenity, and Tkinter.
    """
    # Strategy A: Windows Native PowerShell Folder Picker
    if sys.platform == "win32":
        try:
            ps_cmd = (
                "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null; "
                "$f = New-Object System.Windows.Forms.FolderBrowserDialog; "
                f"$f.SelectedPath = '{os.path.abspath(AppState.TARGET_DIR)}'; "
                "$f.Description = 'Select Neuron Project Directory'; "
                "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Host $f.SelectedPath }"
            )
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            selected = res.stdout.strip().replace("\\", "/")
            if selected and os.path.isdir(selected):
                return selected
        except Exception:
            pass

    # Strategy B: macOS AppleScript Folder Picker
    elif sys.platform == "darwin":
        try:
            script = 'POSIX path of (choose folder with prompt "Select Neuron Project Directory:")'
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            selected = res.stdout.strip()
            if selected and os.path.isdir(selected):
                return selected
        except Exception:
            pass

    # Strategy C: Linux Zenity / KDialog Folder Picker
    elif sys.platform.startswith("linux"):
        try:
            res = subprocess.run(
                ["zenity", "--file-selection", "--directory", "--title=Select Project Folder"],
                capture_output=True,
                text=True,
                check=False,
                timeout=30
            )
            selected = res.stdout.strip()
            if selected and os.path.isdir(selected):
                return selected
        except Exception:
            pass

    # Strategy D: Tkinter Universal Fallback
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(initialdir=AppState.TARGET_DIR, title="Select Project Folder")
        root.destroy()
        if folder and os.path.isdir(folder):
            return folder.replace("\\", "/")
    except Exception:
        pass

    return AppState.TARGET_DIR


# -------------------------------------------------------------------------
# 2. WORKSPACE MEMORY SNAPSHOT FOR AC-3 CSP ENGINE
# -------------------------------------------------------------------------
def collect_workspace_file_asts() -> Dict[str, dict]:
    """
    Collects live memory snapshots of all source files in the active workspace
    for static analysis, constraint satisfaction solving, and import sweeping.
    """
    file_asts = {}
    target_dir = os.path.abspath(AppState.TARGET_DIR)
    
    active_exclusions = DEFAULT_EXCLUSIONS.union(getattr(AppState, 'EXCLUDE_DIRS', set()))

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in active_exclusions and not d.startswith('.')]

        for f in files:
            if f.startswith('.') or f.endswith(('.pyc', '.pyo', '.lock', '.log', '.png', '.jpg', '.svg', '.ico')):
                continue

            rel_path = posixpath.normpath(os.path.relpath(os.path.join(root, f), target_dir).replace("\\", "/"))
            full_path = os.path.join(target_dir, rel_path)

            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as file_obj:
                    file_asts[rel_path] = {"content": file_obj.read()}
            except Exception:
                continue

    return file_asts


# -------------------------------------------------------------------------
# 3. HORIZON 1: REFACTORING SYMBOL MOVE ORCHESTRATOR
# -------------------------------------------------------------------------
def refactor_symbol_move_service(
    source_file: str,
    dest_file: str,
    symbol_name: str
) -> Dict[str, Any]:
    """
    🌌 UNIVERSAL MULTI-LANGUAGE AI REFACTORING PIPELINE
      1. Validates Arc Consistency (AC-3) across Python, JS, TS, and React JSX.
      2. If violations occur (cycles, collisions, scope mismatch), aborts transaction.
      3. If verified, routes execution to:
         - Python (.py) -> LibCST Lossless AST Engine
         - React / JS / TS (.jsx, .js, .tsx, .ts) -> Tree-Sitter AST Surgery Engine
      4. Automatically rewrites all referencing imports across the repository.
    """
    clean_sym = symbol_name.replace("()", "").replace("def ", "").strip().split(".")[-1]
    file_asts = collect_workspace_file_asts()

    # 1. SOLVE CSP VIA AC-3 ARC CONSISTENCY
    csp_result: CSPValidationResult = ac3_validate_refactor(
        symbol_name=clean_sym,
        source_file=source_file,
        dest_file=dest_file,
        file_asts=file_asts
    )

    if not csp_result.is_valid:
        return {
            "success": False,
            "violation_type": csp_result.violation_type,
            "reason": csp_result.reason,
            "cycle_path": csp_result.cycle_path,
            "suggested_fix": csp_result.suggested_fix
        }

    all_files = list(file_asts.keys())
    src_ext = os.path.splitext(source_file)[1].lower()
    dst_ext = os.path.splitext(dest_file)[1].lower()

    js_exts = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

    # 2. ROUTE TO SPECIALIZED AST TRANSPLANT SURGEON
    if src_ext == ".py" and dst_ext == ".py":
        success, message = execute_symbol_refactor_transplant(
            source_filepath=source_file,
            dest_filepath=dest_file,
            symbol_name=clean_sym,
            workspace_root=AppState.TARGET_DIR,
            all_workspace_files=all_files
        )
    elif src_ext in js_exts and dst_ext in js_exts:
        success, message = execute_js_symbol_refactor_transplant(
            source_filepath=source_file,
            dest_filepath=dest_file,
            symbol_name=clean_sym,
            workspace_root=AppState.TARGET_DIR,
            all_workspace_files=all_files
        )
    else:
        return {
            "success": False,
            "violation_type": "CROSS_LANGUAGE_UNSUPPORTED",
            "reason": f"Transplanting symbols across incompatible language boundaries ({src_ext} -> {dst_ext}) is not supported.",
            "suggested_fix": "Ensure source and destination files share compatible runtimes."
        }

    return {
        "success": success,
        "reason": message if not success else None,
        "message": message if success else f"Successfully refactored '{clean_sym}'."
    }


# -------------------------------------------------------------------------
# 4. OS FILE SYSTEM OPERATIONS
# -------------------------------------------------------------------------
def create_item(item_name: str, item_type: str) -> None:
    """Creates a new file or directory, initializing with modern language boilerplates."""
    clean_name = item_name.replace("\\", "/").lstrip("/")
    full_path = os.path.join(AppState.TARGET_DIR, clean_name)

    if item_type == 'folder':
        os.makedirs(full_path, exist_ok=True)
    else:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, "w", encoding="utf-8") as f:
                if full_path.endswith('.py'):
                    f.write("def solve():\n    pass\n\nif __name__ == '__main__':\n    solve()\n")
                elif full_path.endswith(('.jsx', '.tsx')):
                    comp_name = os.path.splitext(os.path.basename(clean_name))[0]
                    comp_name = comp_name[0].upper() + comp_name[1:]
                    f.write(f"import React from 'react';\n\nexport default function {comp_name}() {{\n  return (\n    <div className=\"p-4 text-slate-200\">\n      <h1>{comp_name}</h1>\n    </div>\n  );\n}}\n")
                elif full_path.endswith(('.js', '.ts')):
                    f.write("export const init = () => {\n  console.log('Module initialized');\n};\n")
                elif full_path.endswith('.json'):
                    f.write("{\n  \n}\n")
                elif full_path.endswith('.css'):
                    f.write("/* Custom Styles */\n")
                elif full_path.endswith('.md'):
                    f.write(f"# {os.path.basename(clean_name)}\n\nProject documentation.\n")
                else:
                    f.write("")
        AppState.ACTIVE_FILE = clean_name


def rename_item(old_rel: str, new_rel: str) -> None:
    """Atomically renames a file or directory on disk."""
    old_clean = old_rel.replace("\\", "/").lstrip("/")
    new_clean = new_rel.replace("\\", "/").lstrip("/")
    old_full = os.path.join(AppState.TARGET_DIR, old_clean)
    new_full = os.path.join(AppState.TARGET_DIR, new_clean)

    if os.path.exists(old_full):
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        os.rename(old_full, new_full)
        if AppState.ACTIVE_FILE == old_clean:
            AppState.ACTIVE_FILE = new_clean


def move_item(src_rel: str, dest_folder_rel: str) -> None:
    """Moves a file or directory into a target folder path."""
    src_clean = src_rel.replace("\\", "/").lstrip("/")
    dest_clean = dest_folder_rel.replace("\\", "/").lstrip() if dest_folder_rel else ""

    src_full = os.path.join(AppState.TARGET_DIR, src_clean)
    dest_full_folder = os.path.join(AppState.TARGET_DIR, dest_clean) if dest_clean else AppState.TARGET_DIR

    if os.path.exists(src_full) and os.path.exists(dest_full_folder):
        dest_full = os.path.join(dest_full_folder, os.path.basename(src_full))
        if src_full != dest_full:
            shutil.move(src_full, dest_full)


def delete_item(filename: str) -> None:
    """Recursively deletes an item from disk."""
    clean_path = filename.replace("\\", "/").lstrip("/")
    del_filepath = os.path.join(AppState.TARGET_DIR, clean_path)
    if os.path.exists(del_filepath):
        if os.path.isdir(del_filepath):
            shutil.rmtree(del_filepath)
        else:
            os.remove(del_filepath)


def reveal_in_explorer(rel_path: str) -> None:
    """Opens the native OS file manager focused on the target path."""
    clean_path = rel_path.replace("\\", "/").lstrip() if rel_path else ""
    full_path = os.path.join(AppState.TARGET_DIR, clean_path) if clean_path else AppState.TARGET_DIR
    
    if os.path.exists(full_path):
        if sys.platform == "win32":
            subprocess.run(["explorer", "/select,", os.path.normpath(full_path)])
        elif sys.platform == "darwin":
            subprocess.run(["open", "-R", full_path])
        else:
            subprocess.run(["xdg-open", os.path.dirname(full_path)])


def edit_code(node_id: str, new_code: str, target_file_name: str) -> bool:
    """
    Routes code modifications to either a whole-file disk write or a targeted
    LibCST in-place function node replacement. Decodes scoped node IDs properly.
    """
    clean_file_name = target_file_name.strip()
    for prefix in ["📝 ", "ƒ ", "📄 "]:
        if clean_file_name.startswith(prefix):
            clean_file_name = clean_file_name.replace(prefix, "")
    if " (Whole File)" in clean_file_name:
        clean_file_name = clean_file_name.replace(" (Whole File)", "")
    clean_file_name = clean_file_name.replace("\\", "/").lstrip("/")

    file_path = os.path.join(AppState.TARGET_DIR, clean_file_name)

    # 1. Whole-file write vs targeted function modification
    is_whole_file = (
        node_id == clean_file_name or 
        node_id.endswith(clean_file_name) or 
        not clean_file_name.endswith('.py') or
        "::" not in node_id
    )

    if is_whole_file:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_code)
        return True
    else:
        # 🚀 Decode Scoped Node ID: filepath::scope_symbol::L<line>
        parts = node_id.split("::")
        # Extract symbol name, ignoring line identifier like L45
        symbol_candidate = parts[-1]
        if symbol_candidate.startswith("L") and symbol_candidate[1:].isdigit() and len(parts) > 2:
            symbol_candidate = parts[-2]

        func_name = symbol_candidate.replace("()", "").replace("def ", "").strip().split(".")[-1]
        return update_function_in_file(file_path, func_name, new_code)