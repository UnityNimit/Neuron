# backend/core/parser.py
import os
import re
from typing import Dict, List, Optional, Tuple

import tree_sitter_python as tspython
from tree_sitter import Language, Parser

# The Heavy ML Intelligence Engine
from ml.analyzer import analyze_graph_ml 

# -------------------------------------------------------------------------
# 1. MULTI-LANGUAGE GRAMMAR LOADER (With Safe Fallbacks)
# -------------------------------------------------------------------------
PY_LANGUAGE = Language(tspython.language())

JS_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_javascript as tsjavascript
    JS_LANGUAGE = Language(tsjavascript.language())
except ImportError:
    print("⚠️ tree-sitter-javascript not installed. Run: pip install tree-sitter-javascript")

TS_LANGUAGE: Optional[Language] = None
TSX_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_typescript as tstypescript
    TS_LANGUAGE = Language(tstypescript.language_typescript())
    TSX_LANGUAGE = Language(tstypescript.language_tsx())
except ImportError:
    print("⚠️ tree-sitter-typescript not installed. Run: pip install tree-sitter-typescript")


def clean_text(text: str) -> str:
    """Removes newlines and excessive whitespace for clean UI rendering."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def normalize_uri(uri: str) -> str:
    """
    Normalizes divergent frontend/backend API route expressions into a canonical token.
    Example:
      '/api/v1/users/{user_id}'  --> 'api/v1/users/*'
      '/api/v1/users/:id'        --> 'api/v1/users/*'
      '`/api/v1/users/${id}`'    --> 'api/v1/users/*'
    """
    if not uri:
        return ""
    # Strip quotes, backticks, and protocols
    clean = uri.strip("'\"`")
    clean = re.sub(r'^(https?://|wss?://)[^/]+/', '', clean)
    clean = clean.lstrip('/')
    
    # Replace parameter patterns {param}, :param, and ${param} with *
    clean = re.sub(r'\{[^}]+\}', '*', clean)
    clean = re.sub(r':[\w]+', '*', clean)
    clean = re.sub(r'\$\{[^}]+\}', '*', clean)
    
    # Normalize trailing slash
    return clean.rstrip('/')


def parse_workspace(target_dir: str, items: list, git_churn: dict = None) -> dict:
    git_churn = git_churn or {}
    nodes = []
    edges = []
    created_nodes = set()
    global_functions: Dict[str, str] = {}
    file_asts = {}
    module_to_file = {}

    # Global Registry of API Endpoints: { "GET::api/v1/users/*": "backend/api/users.py::get_users" }
    backend_api_registry: Dict[str, str] = {}
    
    # Global Registry of Frontend Network Calls: [ {"method": "GET", "uri": "api/v1/users/*", "caller_id": "..."} ]
    frontend_network_calls: List[dict] = []

    py_parser = Parser(PY_LANGUAGE)
    js_parser = Parser(JS_LANGUAGE) if JS_LANGUAGE else None
    ts_parser = Parser(TS_LANGUAGE) if TS_LANGUAGE else None
    tsx_parser = Parser(TSX_LANGUAGE) if TSX_LANGUAGE else None

    # -------------------------------------------------------------------------
    # 2. INGEST SOURCE FILES ACROSS LANGUAGES
    # -------------------------------------------------------------------------
    for item in items:
        if item["type"] == "file":
            rel_path = item["path"]
            full_path = os.path.join(target_dir, rel_path)
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                content_bytes = content.encode('utf-8')

                # Python AST
                if rel_path.endswith(".py"):
                    file_asts[rel_path] = {
                        "lang": "python",
                        "bytes": content_bytes,
                        "tree": py_parser.parse(content_bytes),
                        "content": content
                    }
                    mod_name = rel_path.replace("/", ".").replace(".py", "")
                    module_to_file[mod_name] = rel_path
                    base_name = rel_path.split('/')[-1].replace(".py", "")
                    module_to_file[base_name] = rel_path

                # TypeScript / TSX AST
                elif rel_path.endswith((".tsx", ".ts")) and (tsx_parser or ts_parser or js_parser):
                    parser_instance = tsx_parser if (rel_path.endswith(".tsx") and tsx_parser) else (ts_parser or js_parser)
                    file_asts[rel_path] = {
                        "lang": "typescript",
                        "bytes": content_bytes,
                        "tree": parser_instance.parse(content_bytes),
                        "content": content
                    }
                    base_name = rel_path.split('/')[-1].rsplit('.', 1)[0]
                    module_to_file[base_name] = rel_path

                # JavaScript / JSX AST
                elif rel_path.endswith((".js", ".jsx", ".mjs", ".cjs")) and js_parser:
                    file_asts[rel_path] = {
                        "lang": "javascript",
                        "bytes": content_bytes,
                        "tree": js_parser.parse(content_bytes),
                        "content": content
                    }
                    base_name = rel_path.split('/')[-1].rsplit('.', 1)[0]
                    module_to_file[base_name] = rel_path

                # Plain Text / Config Files
                else:
                    file_asts[rel_path] = {
                        "lang": "text",
                        "content": content,
                        "is_text_only": True
                    }
            except Exception as e:
                print(f"Error reading {rel_path}: {e}")

    # -------------------------------------------------------------------------
    # 3. BUILD DIRECTORY & FILE NODES (Structural Hierarchy)
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        parts = filepath.split("/")
        current_path = ""
        
        # Directory Nodes (The Suns)
        for i in range(len(parts) - 1):
            parent_path = current_path
            current_path = f"{current_path}/{parts[i]}" if current_path else parts[i]
            
            if current_path not in created_nodes:
                nodes.append({
                    "id": current_path,
                    "type": "obsidianNode",
                    "data": {"label": parts[i], "nodeType": "folder", "loc": 0}
                })
                created_nodes.add(current_path)
                
            if parent_path:
                edge_id = f"hierarchy-{parent_path}-{current_path}"
                if edge_id not in created_nodes:
                    edges.append({
                        "id": edge_id,
                        "source": parent_path,
                        "target": current_path,
                        "type": "hierarchy"
                    })
                    created_nodes.add(edge_id)

        # File Nodes (The Planets)
        parent_folder = current_path
        file_velocity = git_churn.get(filepath, 0)
        file_loc = len(ast_data.get("content", "").splitlines())

        nodes.append({
            "id": filepath,
            "type": "obsidianNode",
            "data": {
                "label": parts[-1],
                "filePath": filepath,
                "nodeType": "file",
                "loc": file_loc,
                "churn": file_velocity,
                "code": ast_data.get("content", "")
            }
        })
        created_nodes.add(filepath)

        if parent_folder:
            edge_id = f"hierarchy-{parent_folder}-{filepath}"
            if edge_id not in created_nodes:
                edges.append({
                    "id": edge_id,
                    "source": parent_folder,
                    "target": filepath,
                    "type": "hierarchy"
                })
                created_nodes.add(edge_id)

    # -------------------------------------------------------------------------
    # 4. AST RECURSIVE SYMBOL & PROTOCOL EXTRACTION
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        if ast_data.get("is_text_only") or "tree" not in ast_data:
            continue

        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]
        lang = ast_data["lang"]

        def get_text(n) -> str:
            if not n:
                return ""
            return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace')

        # Cyclomatic Complexity Calculation Across Languages
        def calculate_complexity(node) -> int:
            score = 0
            decision_triggers = {
                # Python
                'if_statement', 'for_statement', 'while_statement', 'except_clause',
                'with_item', 'match_statement', 'list_comprehension', 'conditional_expression',
                # JS / TS
                'if_statement', 'for_in_statement', 'for_statement', 'while_statement',
                'catch_clause', 'switch_case', 'ternary_expression', 'augmented_assignment_expression'
            }
            if node.type in decision_triggers:
                score += 1
            for child in node.children:
                score += calculate_complexity(child)
            return score

        # ---------------------------------------------------------------------
        # PYTHON AST PROCESSOR (Extracts FastAPI/Flask Endpoints & Functions)
        # ---------------------------------------------------------------------
        if lang == "python":
            def extract_py_defs(node, class_prefix=""):
                for child in node.children:
                    if child.type == 'function_definition':
                        func_name = get_text(child.child_by_field_name('name'))
                        full_name = f"{class_prefix}.{func_name}" if class_prefix else func_name
                        node_id = f"{filepath}::{full_name}"
                        global_functions[func_name] = node_id

                        start_line = child.start_point[0] + 1
                        end_line = child.end_point[0] + 1
                        loc = (end_line - start_line) + 1

                        params_node = child.child_by_field_name('parameters')
                        return_node = child.child_by_field_name('return_type')
                        param_str = clean_text(get_text(params_node)) if params_node else "()"
                        return_str = clean_text(get_text(return_node)) if return_node else "?"
                        signature = f"def {full_name}{param_str} -> {return_str}"

                        body = child.child_by_field_name('body')
                        complexity = calculate_complexity(body) if body else 0
                        density = (complexity / loc) if loc > 0 else 0
                        raw_code = get_text(child)

                        # Check for API Route Decorators (@app.get, @router.websocket, etc.)
                        for sibling in child.children:
                            if sibling.type == 'decorator':
                                dec_text = get_text(sibling)
                                match = re.search(r'@(?:app|router)\.(get|post|put|delete|patch|websocket)\s*\(\s*([\'\"`][^\'\"]+[\'\"`])', dec_text)
                                if match:
                                    method = match.group(1).upper()
                                    raw_path = match.group(2)
                                    norm_path = normalize_uri(raw_path)
                                    route_key = f"{method}::{norm_path}"
                                    backend_api_registry[route_key] = node_id
                                    backend_api_registry[norm_path] = node_id  # Fallback URI key

                        nodes.append({
                            "id": node_id,
                            "type": "obsidianNode",
                            "data": {
                                "label": signature,
                                "filePath": filepath,
                                "line": start_line,
                                "nodeType": "function",
                                "loc": loc,
                                "complexity": complexity,
                                "density": density,
                                "churn": git_churn.get(filepath, 0),
                                "code": raw_code
                            }
                        })
                        created_nodes.add(node_id)
                        edges.append({
                            "id": f"contain-{filepath}-{node_id}",
                            "source": filepath,
                            "target": node_id,
                            "type": "hierarchy"
                        })

                        if body:
                            extract_py_defs(body, full_name)

                    elif child.type == 'class_definition':
                        class_name = get_text(child.child_by_field_name('name'))
                        body = child.child_by_field_name('body')
                        if body:
                            extract_py_defs(body, class_name)

            extract_py_defs(root_node)

        # ---------------------------------------------------------------------
        # JAVASCRIPT / TYPESCRIPT AST PROCESSOR (Functions & Network Callers)
        # ---------------------------------------------------------------------
        elif lang in ["javascript", "typescript"]:
            def extract_js_defs(node):
                for child in node.children:
                    is_func = child.type in ['function_declaration', 'method_definition']
                    is_var_arrow = (
                        child.type == 'lexical_declaration' and 
                        any(c.type == 'variable_declarator' and any(gc.type == 'arrow_function' for gc in c.children) for c in child.children)
                    )

                    if is_func or is_var_arrow:
                        func_name = "anonymous"
                        if is_func:
                            name_node = child.child_by_field_name('name')
                            func_name = get_text(name_node) if name_node else "anonymous"
                        elif is_var_arrow:
                            decl = next(c for c in child.children if c.type == 'variable_declarator')
                            name_node = decl.child_by_field_name('name')
                            func_name = get_text(name_node) if name_node else "arrow_fn"

                        node_id = f"{filepath}::{func_name}"
                        global_functions[func_name] = node_id

                        start_line = child.start_point[0] + 1
                        end_line = child.end_point[0] + 1
                        loc = (end_line - start_line) + 1
                        complexity = calculate_complexity(child)
                        density = (complexity / loc) if loc > 0 else 0
                        raw_code = get_text(child)

                        nodes.append({
                            "id": node_id,
                            "type": "obsidianNode",
                            "data": {
                                "label": f"{func_name}()",
                                "filePath": filepath,
                                "line": start_line,
                                "nodeType": "function",
                                "loc": loc,
                                "complexity": complexity,
                                "density": density,
                                "churn": git_churn.get(filepath, 0),
                                "code": raw_code
                            }
                        })
                        created_nodes.add(node_id)
                        edges.append({
                            "id": f"contain-{filepath}-{node_id}",
                            "source": filepath,
                            "target": node_id,
                            "type": "hierarchy"
                        })

                    # Traverse child trees
                    extract_js_defs(child)

            extract_js_defs(root_node)

            # Extract Client Network Fetch Calls: fetch(), axios.get(), new WebSocket()
            def extract_network_calls(node, caller_id: str):
                # fetch('/api/...') or axios.get('/api/...')
                if node.type == 'call_expression':
                    fn_node = node.child_by_field_name('function')
                    args_node = node.child_by_field_name('arguments')
                    fn_text = get_text(fn_node)

                    if fn_text in ['fetch', 'axios', 'axios.get', 'axios.post', 'axios.put', 'axios.delete', 'api.get', 'api.post'] and args_node:
                        first_arg = args_node.children[1] if len(args_node.children) > 1 else None
                        if first_arg:
                            raw_uri = get_text(first_arg)
                            norm_uri = normalize_uri(raw_uri)
                            if norm_uri:
                                frontend_network_calls.append({
                                    "uri": norm_uri,
                                    "caller_id": caller_id
                                })

                # new WebSocket('/ws')
                elif node.type == 'new_expression':
                    constructor_node = node.child_by_field_name('constructor')
                    args_node = node.child_by_field_name('arguments')
                    if get_text(constructor_node) == 'WebSocket' and args_node:
                        first_arg = args_node.children[1] if len(args_node.children) > 1 else None
                        if first_arg:
                            raw_uri = get_text(first_arg)
                            norm_uri = normalize_uri(raw_uri)
                            if norm_uri:
                                frontend_network_calls.append({
                                    "uri": norm_uri,
                                    "caller_id": caller_id
                                })

                for child in node.children:
                    extract_network_calls(child, caller_id)

            extract_network_calls(root_node, filepath)

    # -------------------------------------------------------------------------
    # 5. CROSS-FUNCTION AST CALL GRAPH (Neural Pathways)
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        if ast_data.get("is_text_only") or "tree" not in ast_data:
            continue

        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]
        def get_text(n) -> str:
            return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

        def traverse_calls(node, caller_id: str):
            if node.type in ['call', 'call_expression']:
                func_node = node.child_by_field_name('function')
                if func_node:
                    called_name = get_text(func_node).split('.')[-1]
                    if called_name in global_functions:
                        target_id = global_functions[called_name]
                        if target_id != caller_id and target_id in created_nodes:
                            edge_id = f"call-{caller_id}-{target_id}"
                            if edge_id not in created_nodes:
                                edges.append({
                                    "id": edge_id,
                                    "source": caller_id,
                                    "target": target_id,
                                    "type": "call"
                                })
                                created_nodes.add(edge_id)

            for child in node.children:
                traverse_calls(child, caller_id)

        traverse_calls(root_node, filepath)

    # -------------------------------------------------------------------------
    # 6. 🚀 CROSS-STACK PROTOCOL BRIDGE COMPILER (Frontend <---> Backend)
    # -------------------------------------------------------------------------
    for net_call in frontend_network_calls:
        target_uri = net_call["uri"]
        caller_id = net_call["caller_id"]

        # 1. Match Exact or Parameterized Route Token
        matched_target_node_id = None
        if target_uri in backend_api_registry:
            matched_target_node_id = backend_api_registry[target_uri]
        else:
            # Fuzzy Regex Matching for dynamic route templates
            for registered_route, target_node_id in backend_api_registry.items():
                pattern = "^" + registered_route.replace("*", "[^/]+") + "$"
                if re.match(pattern, target_uri):
                    matched_target_node_id = target_node_id
                    break

        # 2. Emit Cross-Stack Laser Conduit
        if matched_target_node_id and caller_id != matched_target_node_id:
            bridge_edge_id = f"bridge-{caller_id}-{matched_target_node_id}"
            if bridge_edge_id not in created_nodes:
                edges.append({
                    "id": bridge_edge_id,
                    "source": caller_id,
                    "target": matched_target_node_id,
                    "type": "network_bridge"
                })
                created_nodes.add(bridge_edge_id)

    # -------------------------------------------------------------------------
    # 7. EXECUTE ASYNCHRONOUS GRAPH ML PIPELINE
    # -------------------------------------------------------------------------
    enriched_nodes = analyze_graph_ml(nodes, edges)

    return {
        "nodes": enriched_nodes,
        "edges": edges
    }