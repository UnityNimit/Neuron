# backend/core/parser.py
import os
import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from ml.layout import calculate_ml_layout

def parse_workspace(target_dir: str, items: list):
    nodes = []
    edges = []
    created_folders = set()
    global_functions = {}
    file_asts = {}

    PY_LANGUAGE = Language(tspython.language())
    parser = Parser(PY_LANGUAGE)

    # 1. READ ALL FILES (Python + Any other text file)
    for item in items:
        if item["type"] == "file":
            full_path = os.path.join(target_dir, item["path"])
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                
                if item["path"].endswith(".py"):
                    content_bytes = content.encode('utf-8')
                    file_asts[item["path"]] = {
                        "bytes": content_bytes, 
                        "tree": parser.parse(content_bytes), 
                        "content": content
                    }
                else:
                    # Normal text file (JS, JSON, TXT, etc.)
                    file_asts[item["path"]] = {
                        "content": content, 
                        "is_text_only": True
                    }
            except Exception: 
                pass

    folder_children_counts = {}
    file_heights = {}

    # 2. EXTRACT FUNCTIONS AS SLEEK SPATIAL CARDS
    for filepath, ast_data in file_asts.items():
        if "tree" not in ast_data:
            # If it's not a Python file, just give the file card a default height
            file_heights[filepath] = 150
            continue
            
        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]
        
        def get_text(n): return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""
        
        child_y_offset = 50 
        
        def extract_defs(node, class_prefix=""):
            nonlocal child_y_offset
            for child in node.children:
                if child.type == 'function_definition':
                    func_name = get_text(child.child_by_field_name('name'))
                    full_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                    node_id = f"{filepath}::{full_name}"
                    
                    global_functions[func_name] = node_id 
                    line_num = child.start_point[0] + 1 
                    
                    nodes.append({
                        "id": node_id, 
                        "type": "spatialNode",
                        "parentId": filepath,
                        "position": {"x": 20, "y": child_y_offset},
                        "style": {"width": 300, "height": 60},
                        "data": {"fileName": f"ƒ {full_name}()", "filePath": filepath, "line": line_num, "risk": "normal"}
                    })
                    child_y_offset += 80 
                    
                    body = child.child_by_field_name('body')
                    if body: extract_defs(body, full_name)
                    
                elif child.type == 'class_definition':
                    class_name = get_text(child.child_by_field_name('name'))
                    body = child.child_by_field_name('body')
                    if body: extract_defs(body, class_name)
                    
        extract_defs(root_node)
        file_heights[filepath] = max(child_y_offset + 20, 150)

    # 3. BUILD FOLDERS & FILES HIERARCHY
    for filepath in file_asts.keys():
        parts = filepath.split("/")
        
        current_path = ""
        for i in range(len(parts) - 1):
            parent_path = current_path
            current_path = f"{current_path}/{parts[i]}" if current_path else parts[i]
            
            if current_path not in created_folders:
                folder_children_counts[current_path] = 0
                node = {
                    "id": current_path, "type": "folderGroup",
                    "position": {"x": 0, "y": 0}, "data": {"label": parts[i]},
                    "style": {"width": 380, "height": 200}
                }
                if parent_path: node["parentId"] = parent_path
                nodes.append(node)
                created_folders.add(current_path)
                
        parent_folder = current_path
        if parent_folder:
            folder_children_counts[parent_folder] = folder_children_counts.get(parent_folder, 0) + 1
            file_y = (folder_children_counts[parent_folder] - 1) * 400 + 60
        else:
            file_y = 0

        # Create the file card (Safeguarded with .get() to prevent KeyErrors)
        file_node = {
            "id": filepath, "type": "fileGroup", "position": {"x": 20, "y": file_y},
            "style": {"width": 340, "height": file_heights.get(filepath, 150)},
            "data": {"label": parts[-1], "filePath": filepath, "code": file_asts[filepath].get("content", "")}
        }
        if parent_folder: file_node["parentId"] = parent_folder
        nodes.append(file_node)

    # Calculate Folder Heights bottom-up
    for n in nodes:
        if n["type"] == "folderGroup":
            child_files = [fn for fn in nodes if fn.get("parentId") == n["id"] and fn["type"] == "fileGroup"]
            if child_files:
                max_h = max([fn["position"]["y"] + fn.get("style", {}).get("height", 200) for fn in child_files]) + 40
                n["style"]["height"] = max_h

    # 4. EXTRACT CROSS-FILE CALL GRAPH
    for filepath, ast_data in file_asts.items():
        if "tree" not in ast_data: 
            continue # Skip AST logic for text files
        
        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]
        def get_text(n): return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""
            
        def traverse_calls(node, caller_id):
            if node.type == 'call':
                func_node = node.child_by_field_name('function')
                if func_node:
                    called_name = get_text(func_node).split('.')[-1] 
                    if called_name in global_functions:
                        target_id = global_functions[called_name]
                        if target_id != caller_id:
                            edges.append({
                                "id": f"edge-{caller_id}-{target_id}", "source": caller_id, "target": target_id,
                                "animated": True, "style": {"stroke": "#3b82f6", "strokeWidth": 2}
                            })
            for child in node.children: traverse_calls(child, caller_id)

        def analyze_defs(node, class_prefix=""):
            for child in node.children:
                if child.type == 'function_definition':
                    func_name = get_text(child.child_by_field_name('name'))
                    full_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                    caller_id = f"{filepath}::{full_name}"
                    body = child.child_by_field_name('body')
                    if body: 
                        traverse_calls(body, caller_id)
                        analyze_defs(body, full_name)
                elif child.type == 'class_definition':
                    class_name = get_text(child.child_by_field_name('name'))
                    body = child.child_by_field_name('body')
                    if body: analyze_defs(body, class_name)
        analyze_defs(root_node)

    # 5. UMAP LAYOUT ON ROOTS
    root_nodes = [n for n in nodes if "parentId" not in n]
    child_nodes = [n for n in nodes if "parentId" in n]
    
    positioned_roots = calculate_ml_layout(root_nodes, edges)

    return {"nodes": positioned_roots + child_nodes, "edges": edges}