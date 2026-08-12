# backend/core/parser.py
import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from ml.layout import calculate_ml_layout

def parse_python_file(filepath: str, file_content: str):
    if not filepath.endswith(".py"):
        return {
            "nodes": [{
                "id": filepath,
                "type": "codeNode",
                "position": {"x": 250, "y": 150},
                "data": {
                    "fileName": f"📄 {filepath}",
                    "filePath": filepath, # CLEAN PATH FOR DISK SAVES
                    "code": file_content,
                    "risk": "normal"
                }
            }],
            "edges": []
        }

    PY_LANGUAGE = Language(tspython.language())
    parser = Parser(PY_LANGUAGE)
    content_bytes = file_content.encode('utf-8')
    
    def get_node_text(node):
        if not node: return ""
        return content_bytes[node.start_byte:node.end_byte].decode('utf-8', errors='replace')

    tree = parser.parse(content_bytes)
    root_node = tree.root_node

    nodes = []
    edges = []
    function_names = set()

    # Whole File Node
    nodes.append({
        "id": filepath,
        "type": "codeNode",
        "position": {"x": 0, "y": 0},
        "data": {
            "fileName": f"📝 {filepath} (Whole File)",
            "filePath": filepath, # CLEAN PATH FOR DISK SAVES
            "code": file_content,
            "risk": "normal"
        }
    })

    def extract_functions(node, class_prefix=""):
        for child in node.children:
            if child.type == 'function_definition':
                name_node = child.child_by_field_name('name')
                func_name = get_node_text(name_node)
                full_func_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                func_code = get_node_text(child)
                
                function_names.add(full_func_name)
                function_names.add(func_name)
                
                nodes.append({
                    "id": full_func_name,
                    "type": "codeNode",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "fileName": f"ƒ {full_func_name}()",
                        "filePath": filepath, # CLEAN PATH FOR DISK SAVES
                        "code": func_code,
                        "risk": "normal"
                    }
                })
                
                body_node = child.child_by_field_name('body')
                if body_node: extract_functions(body_node, full_func_name)

            elif child.type == 'class_definition':
                class_name_node = child.child_by_field_name('name')
                class_name = get_node_text(class_name_node)
                body_node = child.child_by_field_name('body')
                if body_node: extract_functions(body_node, class_name)

    extract_functions(root_node)

    def traverse_for_calls(node, current_func_name):
        if node.type == 'call':
            func_called_node = node.child_by_field_name('function')
            if func_called_node:
                called_name = get_node_text(func_called_node)
                if called_name in function_names and called_name != current_func_name:
                    edges.append({
                        "id": f"edge-{current_func_name}-{called_name}",
                        "source": current_func_name,
                        "target": called_name,
                        "animated": True,
                        "style": {"stroke": "#3b82f6", "strokeWidth": 2}
                    })
        for child in node.children: traverse_for_calls(child, current_func_name)

    def analyze_function_calls(node, class_prefix=""):
        for child in node.children:
            if child.type == 'function_definition':
                name_node = child.child_by_field_name('name')
                func_name = get_node_text(name_node)
                full_func_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                body_node = child.child_by_field_name('body')
                if body_node:
                    traverse_for_calls(body_node, full_func_name)
                    analyze_function_calls(body_node, full_func_name)
            elif child.type == 'class_definition':
                class_name_node = child.child_by_field_name('name')
                class_name = get_node_text(class_name_node)
                body_node = child.child_by_field_name('body')
                if body_node: analyze_function_calls(body_node, class_name)

    analyze_function_calls(root_node)

    ml_positioned_nodes = calculate_ml_layout(nodes, edges)
    return {"nodes": ml_positioned_nodes, "edges": edges}