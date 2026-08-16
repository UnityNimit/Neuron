# backend/services/file_service.py
import os
import sys
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple
import tkinter as tk
from tkinter import filedialog

from core.state import AppState
from core.mutator import update_function_in_file, execute_symbol_refactor_transplant
from core.js_mutator import execute_js_symbol_refactor_transplant
from ai.csp_guard import ac3_validate_refactor, CSPValidationResult


def pick_folder_sync() -> str:
    """Opens a native modal folder picker dialog."""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    folder = filedialog.askdirectory(initialdir=AppState.TARGET_DIR, title="Select Project Folder")
    root.destroy()
    return folder


def collect_workspace_file_asts() -> Dict[str, dict]:
    """
    Collects live memory snapshots of all source files in the active workspace
    for static analysis, constraint satisfaction solving, and import sweeping.
    """
    file_asts = {}
    for root, dirs, files in os.walk(AppState.TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in AppState.EXCLUDE_DIRS]
        for f in files:
            rel_path = os.path.relpath(os.path.join(root, f), AppState.TARGET_DIR).replace("\\", "/")
            full_path = os.path.join(AppState.TARGET_DIR, rel_path)
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as file_obj:
                    file_asts[rel_path] = {"content": file_obj.read()}
            except Exception:
                continue
    return file_asts


def refactor_symbol_move_service(
    source_file: str,
    dest_file: str,
    symbol_name: str
) -> Dict[str, Any]:
    """
    Orchestrates the Universal Multi-Language AI Refactoring Pipeline:
      1. Solves CSP Triplet (X, D, C) via AC-3 Arc Consistency across Python and JS/TS.
      2. If violations occur (cycles, collisions, scope mismatch), aborts transaction.
      3. If verified, routes execution to:
         - Python (.py) -> LibCST Lossless AST Engine
         - React / JS / TS (.jsx, .js, .tsx, .ts) -> Tree-Sitter Byte Surgery Engine
      4. Automatically rewrites all referencing imports across the repository.
    """
    file_asts = collect_workspace_file_asts()

    # 1. SOLVE CSP VIA AC-3 ARC CONSISTENCY
    csp_result: CSPValidationResult = ac3_validate_refactor(
        symbol_name=symbol_name,
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

    # 2. ROUTE TO SPECIALIZED AST TRANSPLANT ENGINE
    if src_ext == ".py" and dst_ext == ".py":
        success, message = execute_symbol_refactor_transplant(
            source_filepath=source_file,
            dest_filepath=dest_file,
            symbol_name=symbol_name,
            workspace_root=AppState.TARGET_DIR,
            all_workspace_files=all_files
        )
    elif src_ext in js_exts and dst_ext in js_exts:
        success, message = execute_js_symbol_refactor_transplant(
            source_filepath=source_file,
            dest_filepath=dest_file,
            symbol_name=symbol_name,
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
        "message": message if success else "Refactoring completed successfully."
    }


def create_item(item_name: str, item_type: str) -> None:
    """Creates a new file or directory, initializing Python modules with entrypoint boilerplate."""
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
                    f.write("import React from 'react';\n\nexport default function Component() {\n  return <div>Component</div>;\n}\n")
                else:
                    f.write("")
        AppState.ACTIVE_FILE = clean_name


def rename_item(old_rel: str, new_rel: str) -> None:
    """Atomically renames a file or directory on disk."""
    old_full = os.path.join(AppState.TARGET_DIR, old_rel.replace("\\", "/").lstrip("/"))
    new_full = os.path.join(AppState.TARGET_DIR, new_rel.replace("\\", "/").lstrip("/"))

    if os.path.exists(old_full):
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        os.rename(old_full, new_full)
        if AppState.ACTIVE_FILE == old_rel:
            AppState.ACTIVE_FILE = new_rel


def move_item(src_rel: str, dest_folder_rel: str) -> None:
    """Moves a file or directory into a target folder path."""
    src_full = os.path.join(AppState.TARGET_DIR, src_rel.replace("\\", "/").lstrip("/"))
    dest_full_folder = os.path.join(AppState.TARGET_DIR, dest_folder_rel.replace("\\", "/").lstrip()) if dest_folder_rel else AppState.TARGET_DIR

    if os.path.exists(src_full) and os.path.exists(dest_full_folder):
        dest_full = os.path.join(dest_full_folder, os.path.basename(src_full))
        if src_full != dest_full:
            shutil.move(src_full, dest_full)


def delete_item(filename: str) -> None:
    """Recursively deletes an item from disk."""
    del_filepath = os.path.join(AppState.TARGET_DIR, filename.replace("\\", "/").lstrip("/"))
    if os.path.exists(del_filepath):
        if os.path.isdir(del_filepath):
            shutil.rmtree(del_filepath)
        else:
            os.remove(del_filepath)


def reveal_in_explorer(rel_path: str) -> None:
    """Opens the native OS file manager focused on the target path."""
    full_path = os.path.join(AppState.TARGET_DIR, rel_path.replace("\\", "/").lstrip()) if rel_path else AppState.TARGET_DIR
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
    LibCST in-place function node replacement for Python files.
    """
    clean_file_name = target_file_name.strip()
    for prefix in ["📝 ", "ƒ ", "📄 "]:
        if clean_file_name.startswith(prefix):
            clean_file_name = clean_file_name.replace(prefix, "")
    if " (Whole File)" in clean_file_name:
        clean_file_name = clean_file_name.replace(" (Whole File)", "")
    clean_file_name = clean_file_name.replace("\\", "/").lstrip("/")

    file_path = os.path.join(AppState.TARGET_DIR, clean_file_name)

    # Whole-file write vs targeted function modification
    if node_id == clean_file_name or node_id.endswith(clean_file_name) or not clean_file_name.endswith('.py'):
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_code)
        return True
    else:
        func_name = node_id.split("::")[-1].replace("()", "") if "::" in node_id else node_id
        return update_function_in_file(file_path, func_name, new_code)