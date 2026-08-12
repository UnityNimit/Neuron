# backend/core/parser.py
import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from ml.layout import calculate_ml_layout

def parse_python_file(filepath: str, file_content: str):
    """
    Parses a Python file using Tree-Sitter, extracts functions, classes,
    and call-graph edges, and calculates a 2D ML spatial layout.
    """
    # 1. Setup the Tree-Sitter API
    PY_LANGUAGE = Language(tspython.language())
    parser = Parser(PY_LANGUAGE)
    
    # UTF-8 Byte-Offset Safe Conversion (Prevents emoji/non-ASCII slicing crashes)
    content_bytes = file_content.encode('utf-8')
    
    def get_node_text(node):
        if not node:
            return ""
        return content_bytes[node.start_byte:node.end_byte].decode('utf-8', errors='replace')

    # Parse the code into an AST
    tree = parser.parse(content_bytes)
    root_node = tree.root_node

    nodes = []
    edges = []
    function_names = set()

    # 2. ALWAYS ADD A "WHOLE FILE" NODE (For Codeforces / Global Script Scope)
    nodes.append({
        "id": filepath, # Node ID matches the filename for direct saving
        "type": "codeNode",
        "position": {"x": 0, "y": 0},
        "data": {
            "fileName": f"📝 {filepath} (Whole File)",
            "code": file_content,
            "risk": "normal"
        }
    })

    # Helper function to recursively find all function definitions (even inside classes)
    def extract_functions(node, class_prefix=""):
        for child in node.children:
            if child.type == 'function_definition':
                name_node = child.child_by_field_name('name')
                func_name = get_node_text(name_node)
                
                # Combine class name with method name if nested (e.g. User.login)
                full_func_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                func_code = get_node_text(child)
                
                function_names.add(full_func_name)
                function_names.add(func_name) # Also add raw name for call matching
                
                nodes.append({
                    "id": full_func_name,
                    "type": "codeNode",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "fileName": f"ƒ {full_func_name}()",
                        "code": func_code,
                        "risk": "normal"
                    }
                })
                
                # Recursively check function body for inner functions
                body_node = child.child_by_field_name('body')
                if body_node:
                    extract_functions(body_node, full_func_name)

            elif child.type == 'class_definition':
                class_name_node = child.child_by_field_name('name')
                class_name = get_node_text(class_name_node)
                body_node = child.child_by_field_name('body')
                if body_node:
                    extract_functions(body_node, class_name)

    # 3. Extract all Functions & Methods
    extract_functions(root_node)

    # 4. Extract Call-Graph Dependency Wires (Edges)
    def traverse_for_calls(node, current_func_name):
        if node.type == 'call':
            func_called_node = node.child_by_field_name('function')
            if func_called_node:
                called_name = get_node_text(func_called_node)
                
                # If Function A calls Function B, draw an animated wire!
                if called_name in function_names and called_name != current_func_name:
                    edges.append({
                        "id": f"edge-{current_func_name}-{called_name}",
                        "source": current_func_name,
                        "target": called_name,
                        "animated": True,
                        "style": {"stroke": "#3b82f6", "strokeWidth": 2}
                    })
        
        for child in node.children:
            traverse_for_calls(child, current_func_name)

    # Traverse bodies of extracted functions to map outgoing calls
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
                if body_node:
                    analyze_function_calls(body_node, class_name)

    analyze_function_calls(root_node)

    # 5. Calculate 2D Machine Learning Coordinates (Node2Vec + UMAP)
    ml_positioned_nodes = calculate_ml_layout(nodes, edges)

    return {"nodes": ml_positioned_nodes, "edges": edges}