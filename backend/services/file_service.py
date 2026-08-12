# backend/services/file_service.py
import os
import sys
import shutil
import subprocess
import tkinter as tk
from tkinter import filedialog
from core.state import AppState
from core.mutator import update_function_in_file

def pick_folder_sync():
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    folder = filedialog.askdirectory(initialdir=AppState.TARGET_DIR, title="Select Project Folder")
    root.destroy()
    return folder

def create_item(item_name, item_type):
    full_path = os.path.join(AppState.TARGET_DIR, item_name)
    if item_type == 'folder': 
        os.makedirs(full_path, exist_ok=True)
    else:
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        if not os.path.exists(full_path):
            with open(full_path, "w", encoding="utf-8") as f:
                if full_path.endswith('.py'): f.write("def solve():\n    pass\n\nif __name__ == '__main__':\n    solve()")
                else: f.write("")
        AppState.ACTIVE_FILE = item_name

def rename_item(old_rel, new_rel):
    old_full = os.path.join(AppState.TARGET_DIR, old_rel)
    new_full = os.path.join(AppState.TARGET_DIR, new_rel)
    if os.path.exists(old_full):
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        os.rename(old_full, new_full)
        if AppState.ACTIVE_FILE == old_rel: 
            AppState.ACTIVE_FILE = new_rel

def move_item(src_rel, dest_folder_rel):
    src_full = os.path.join(AppState.TARGET_DIR, src_rel)
    dest_full_folder = os.path.join(AppState.TARGET_DIR, dest_folder_rel) if dest_folder_rel else AppState.TARGET_DIR
    if os.path.exists(src_full) and os.path.exists(dest_full_folder):
        dest_full = os.path.join(dest_full_folder, os.path.basename(src_full))
        if src_full != dest_full: 
            shutil.move(src_full, dest_full)

def delete_item(filename):
    del_filepath = os.path.join(AppState.TARGET_DIR, filename)
    if os.path.exists(del_filepath):
        if os.path.isdir(del_filepath): shutil.rmtree(del_filepath)
        else: os.remove(del_filepath)

def reveal_in_explorer(rel_path):
    full_path = os.path.join(AppState.TARGET_DIR, rel_path) if rel_path else AppState.TARGET_DIR
    if os.path.exists(full_path):
        if sys.platform == "win32": subprocess.run(["explorer", "/select,", os.path.normpath(full_path)])
        elif sys.platform == "darwin": subprocess.run(["open", "-R", full_path])
        else: subprocess.run(["xdg-open", os.path.dirname(full_path)])

def edit_code(node_id, new_code, target_file_name):
    for prefix in ["📝 ", "ƒ ", "📄 "]:
        if target_file_name.startswith(prefix): target_file_name = target_file_name.replace(prefix, "")
    if " (Whole File)" in target_file_name: target_file_name = target_file_name.replace(" (Whole File)", "")
    
    file_path = os.path.join(AppState.TARGET_DIR, target_file_name)
    if node_id == target_file_name or node_id.endswith(target_file_name) or not target_file_name.endswith('.py'):
        with open(file_path, "w", encoding="utf-8") as f: f.write(new_code)
    else: 
        update_function_in_file(file_path, node_id, new_code)