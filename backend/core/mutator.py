# backend/core/mutator.py
import libcst as cst

class FunctionReplacer(cst.CSTTransformer):
    def __init__(self, func_name: str, new_func_node: cst.CSTNode):
        self.func_name = func_name
        self.new_func_node = new_func_node

    # This physically visits the AST and replaces only the matched function
    def leave_FunctionDef(self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef) -> cst.CSTNode:
        if original_node.name.value == self.func_name:
            return self.new_func_node
        return updated_node

def update_function_in_file(filepath: str, func_name: str, new_code: str):
    # 1. Read the current file from disk
    with open(filepath, "r", encoding="utf-8") as f:
        original_code = f.read()

    source_tree = cst.parse_module(original_code)
    
    # 2. Parse the new code from the UI
    try:
        new_module = cst.parse_module(new_code)
        new_func_node = new_module.body[0] # Grab the new function definition
    except Exception as e:
        print(f"⚠️ Syntax incomplete, skipping save until valid: {e}")
        return False

    # 3. Apply the AI Mutation
    transformer = FunctionReplacer(func_name, new_func_node)
    modified_tree = source_tree.visit(transformer)

    # 4. Write it safely back to disk
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(modified_tree.code)
        
    return True