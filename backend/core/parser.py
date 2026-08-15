# backend/core/parser.py
import os
import re
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

# The ML Engine that processes the intelligence we extract here
from ml.analyzer import analyze_graph_ml 

def clean_text(text: str) -> str:
    """Removes newlines and excessive spaces for clean UI LOD rendering."""
    if not text: return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_workspace(target_dir: str, items: list, git_churn: dict = None):
    git_churn = git_churn or {}
    nodes = []
    edges = []
    created_nodes = set()
    global_functions = {}
    file_asts = {}
    
    # NEW: ML Knowledge Base for resolving cross-file Imports
    module_to_file = {}

    PY_LANGUAGE = Language(tspython.language())
    parser = Parser(PY_LANGUAGE)

    # 1. READ FILES & INGEST BYTES
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
                    
                    # Register module paths for the Semantic Import Resolver
                    mod_name = item["path"].replace("/", ".").replace(".py", "")
                    module_to_file[mod_name] = item["path"]
                    # Also register base filename (e.g., 'utils.py' -> 'utils')
                    base_name = item["path"].split('/')[-1].replace(".py", "")
                    if base_name not in module_to_file:
                        module_to_file[base_name] = item["path"]
                else:
                    file_asts[item["path"]] = {"content": content, "is_text_only": True}
            except Exception: pass

    # 2. BUILD STRUCTURAL HIERARCHY
    for filepath, ast_data in file_asts.items():
        parts = filepath.split("/")
        current_path = ""
        
        # Folder Nodes
        for i in range(len(parts) - 1):
            parent_path = current_path
            current_path = f"{current_path}/{parts[i]}" if current_path else parts[i]
            if current_path not in created_nodes:
                nodes.append({
                    "id": current_path, "type": "obsidianNode",
                    "data": {"label": parts[i], "nodeType": "folder"}
                })
                created_nodes.add(current_path)
            if parent_path:
                edge_id = f"hierarchy-{parent_path}-{current_path}"
                if edge_id not in created_nodes:
                    edges.append({"id": edge_id, "source": parent_path, "target": current_path, "type": "hierarchy"})
                    created_nodes.add(edge_id)
                
        # File Nodes
        parent_folder = current_path
        file_velocity = git_churn.get(filepath, 0)
        
        nodes.append({
            "id": filepath, "type": "obsidianNode",
            "data": {
                "label": parts[-1], 
                "filePath": filepath, 
                "nodeType": "file",
                "churn": file_velocity, # Passed to ML Engine
                "code": file_asts[filepath].get("content", "") # CRITICAL FIX: Restored for Monaco Editor!
            }
        })
        if parent_folder:
            edges.append({"id": f"hierarchy-{parent_folder}-{filepath}", "source": parent_folder, "target": filepath, "type": "hierarchy"})

        # 3. ADVANCED AST INTELLIGENCE EXTRACTION
        if "tree" not in ast_data: continue
        content_bytes = ast_data["bytes"]
        def get_text(n): return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""
        
        # Upgraded Cyclomatic Complexity Algorithm (Python 3.10+ Support)
        def calculate_complexity(node):
            score = 0
            complexity_triggers = {
                'if_statement', 'for_statement', 'while_statement', 'except_clause', 
                'with_item', 'boolean_operator', 'conditional_expression', 
                'match_statement', 'list_comprehension', 'dictionary_comprehension'
            }
            if node.type in complexity_triggers:
                score += 1
            for child in node.children:
                score += calculate_complexity(child)
            return score

        # NEW: Semantic Import Resolver
        # Draws massive neural pathways between files that import each other
        def extract_imports(node):
            if node.type == 'import_from_statement':
                module_name_node = node.child_by_field_name('module_name')
                if module_name_node:
                    mod_name = get_text(module_name_node)
                    if mod_name in module_to_file:
                        target_file = module_to_file[mod_name]
                        if target_file != filepath:
                            edge_id = f"import-{filepath}-{target_file}"
                            if edge_id not in created_nodes:
                                # We type it as 'call' so the ML engine weights it heavily and the UI draws it purple
                                edges.append({"id": edge_id, "source": filepath, "target": target_file, "type": "call"})
                                created_nodes.add(edge_id)
            for child in node.children:
                extract_imports(child)

        extract_imports(ast_data["tree"].root_node)

        def extract_defs(node, class_prefix=""):
            for child in node.children:
                if child.type == 'function_definition':
                    # Extract Identification
                    func_name = get_text(child.child_by_field_name('name'))
                    full_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                    node_id = f"{filepath}::{full_name}"
                    global_functions[func_name] = node_id 
                    
                    # Extract Physical Coordinates
                    start_line = child.start_point[0] + 1 
                    end_line = child.end_point[0] + 1
                    loc = (end_line - start_line) + 1
                    
                    # Extract AST Semantic Signature for Frontend Z-Level 2 LOD
                    params_node = child.child_by_field_name('parameters')
                    return_node = child.child_by_field_name('return_type')
                    
                    param_str = clean_text(get_text(params_node)) if params_node else "()"
                    return_str = clean_text(get_text(return_node)) if return_node else "?"
                    
                    semantic_signature = f"def {full_name}{param_str} -> {return_str}"
                    
                    # Extract ML Heuristics
                    body = child.child_by_field_name('body')
                    complexity = calculate_complexity(body) if body else 0
                    density = (complexity / loc) if loc > 0 else 0
                    raw_code = get_text(child)
                    
                    nodes.append({
                        "id": node_id, "type": "obsidianNode",
                        "data": {
                            "label": semantic_signature, 
                            "filePath": filepath, 
                            "line": start_line, 
                            "nodeType": "function",
                            "loc": loc,
                            "complexity": complexity, 
                            "density": density,
                            "churn": file_velocity, 
                            "code": raw_code        
                        }
                    })
                    
                    edges.append({"id": f"contain-{filepath}-{node_id}", "source": filepath, "target": node_id, "type": "hierarchy"})
                    
                    if body: extract_defs(body, full_name)
                    
                elif child.type == 'class_definition':
                    class_name = get_text(child.child_by_field_name('name'))
                    body = child.child_by_field_name('body')
                    if body: extract_defs(body, class_name)
                    
        extract_defs(ast_data["tree"].root_node)

    # 4. EXTRACT CROSS-FUNCTION NEURAL PATHWAYS
    for filepath, ast_data in file_asts.items():
        if "tree" not in ast_data: continue 
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
                                "id": f"call-{caller_id}-{target_id}", 
                                "source": caller_id, "target": target_id, "type": "call"
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
        analyze_defs(ast_data["tree"].root_node)

    # 5. EXECUTE THE HEAVY ML PIPELINE
    enriched_nodes = analyze_graph_ml(nodes, edges)

    return {"nodes": enriched_nodes, "edges": edges}