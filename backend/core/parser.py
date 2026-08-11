# backend/core/parser.py
import tree_sitter_python as tspython
from tree_sitter import Language, Parser
from ml.layout import calculate_ml_layout

def parse_python_file(filepath: str, file_content: str):
    # 1. Setup the 2026 Tree-Sitter API
    PY_LANGUAGE = Language(tspython.language())
    parser = Parser(PY_LANGUAGE)
    
    # Parse the code into a tree
    tree = parser.parse(bytes(file_content, "utf8"))
    root_node = tree.root_node

    nodes = []
    edges = []
    function_names = set()
    
    # Temporary Grid Layout Variables (Until we add UMAP ML in Sprint 3)
    x_pos = 100
    y_pos = 100

    # 2. Extract Functions
    for child in root_node.children:
        if child.type == 'function_definition':
            # Extract the function name
            name_node = child.child_by_field_name('name')
            func_name = file_content[name_node.start_byte:name_node.end_byte]
            
            # Extract the raw code of the function
            func_code = file_content[child.start_byte:child.end_byte]
            
            function_names.add(func_name)
            
            # Format for React Flow CodeNode
            nodes.append({
                "id": func_name,
                "type": "codeNode",
                "position": {"x": x_pos, "y": y_pos},
                "data": {
                    "fileName": filepath,
                    "code": func_code,
                    "risk": "normal"
                }
            })
            
            # Shift the next box down the screen
            y_pos += 400 

    # 3. Extract Function Calls (The Edges)
    # We do a simple tree traversal to find any function calling another function
    def traverse_for_calls(node, current_func_name):
        if node.type == 'call':
            func_called_node = node.child_by_field_name('function')
            if func_called_node:
                called_name = file_content[func_called_node.start_byte:func_called_node.end_byte]
                # Only draw a wire if it's calling a function we defined!
                if called_name in function_names:
                    edges.append({
                        "id": f"edge-{current_func_name}-{called_name}",
                        "source": current_func_name,
                        "target": called_name,
                        "animated": True,
                        "style": {"stroke": "#3b82f6", "strokeWidth": 2}
                    })
        
        for child in node.children:
            traverse_for_calls(child, current_func_name)

    # Run the traversal for every function body we found
    for child in root_node.children:
        if child.type == 'function_definition':
            name_node = child.child_by_field_name('name')
            func_name = file_content[name_node.start_byte:name_node.end_byte]
            body_node = child.child_by_field_name('body')
            traverse_for_calls(body_node, func_name)

    ml_positioned_nodes = calculate_ml_layout(nodes, edges)

    return {"nodes": ml_positioned_nodes, "edges": edges}