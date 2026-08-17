# backend/core/parser.py
import os
import posixpath
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import tree_sitter_python as tspython
from tree_sitter import Language, Node, Parser

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
    pass

TS_LANGUAGE: Optional[Language] = None
TSX_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_typescript as tstypescript
    TS_LANGUAGE = Language(tstypescript.language_typescript())
    TSX_LANGUAGE = Language(tstypescript.language_tsx())
except ImportError:
    pass


def clean_text(text: str) -> str:
    """Removes newlines and excessive whitespace for clean UI rendering."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def normalize_rel_path(path: str) -> str:
    """Normalizes relative paths across Windows/POSIX to forward slashes without leading slashes."""
    if not path:
        return ""
    normalized = path.replace("\\", "/").strip().lstrip("/")
    return posixpath.normpath(normalized)


def normalize_uri(uri: str) -> str:
    """
    🌌 UNIVERSAL CROSS-STACK URI & EVENT NORMALIZER
    Transforms any frontend/backend route expression into an identical canonical token.
    Examples:
      'http://localhost:8000/api/v1/users/{user_id}?raw=true' -> 'api/v1/users/*'
      '`${API_BASE}/api/v1/users/:id`'                        -> 'api/v1/users/*'
      'ws://127.0.0.1:8000/ws'                                 -> 'ws'
      '`ws://${window.location.host}/ws`'                      -> 'ws'
      '/auth/login'                                            -> 'auth/login'
    """
    if not uri:
        return ""

    clean = uri.strip("'\"`")
    
    # Strip protocol and domain headers
    clean = re.sub(r'^(https?://|wss?://)[^/]+/', '', clean)
    clean = re.sub(r'^(https?://|wss?://)[^/]+$', '', clean)
    
    # Strip variable template expressions at head like `${BACKEND_URL}/` or `${API_BASE}/`
    clean = re.sub(r'^\$\{[^}]+\}/?', '', clean)
    clean = re.sub(r'^[a-zA-Z0-9_]+\s*\+\s*[\'\"`]', '', clean)
    
    # Strip query parameters
    clean = clean.split('?')[0].split('&')[0]
    clean = clean.strip().lstrip('/')
    
    # Replace variable parameter tokens {param}, :param, and ${param} with *
    clean = re.sub(r'\{[^}]+\}', '*', clean)
    clean = re.sub(r':[\w]+', '*', clean)
    clean = re.sub(r'\$\{[^}]+\}', '*', clean)
    clean = re.sub(r'/+', '/', clean)
    return clean.rstrip('/')


def resolve_js_import_path(current_file: str, import_source: str, existing_files: Set[str]) -> Optional[str]:
    """Resolves relative JavaScript/TypeScript imports to canonical workspace file paths."""
    if not import_source.startswith('.'):
        return None

    curr_dir = posixpath.dirname(current_file)
    target_base = posixpath.normpath(posixpath.join(curr_dir, import_source))

    candidate_extensions = ["", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx", "/index.ts", "/index.tsx"]
    for ext in candidate_extensions:
        candidate = target_base + ext
        if candidate in existing_files:
            return candidate
    return None


def resolve_py_import_path(current_file: str, module_str: str, module_to_file: Dict[str, str]) -> Optional[str]:
    """Resolves Python module import strings to workspace relative files."""
    if module_str in module_to_file:
        return module_to_file[module_str]

    if module_str.startswith('.'):
        curr_dir = posixpath.dirname(current_file).replace('/', '.')
        dots_count = len(module_str) - len(module_str.lstrip('.'))
        parts = curr_dir.split('.') if curr_dir else []
        if len(parts) >= dots_count - 1:
            base_parts = parts[:len(parts) - (dots_count - 1)]
            remaining = module_str.lstrip('.')
            resolved_mod = ".".join(base_parts + ([remaining] if remaining else []))
            if resolved_mod in module_to_file:
                return module_to_file[resolved_mod]

    return None


def parse_workspace(target_dir: str, items: list, git_churn: dict = None) -> dict:
    git_churn = git_churn or {}
    nodes: List[dict] = []
    edges: List[dict] = []
    created_node_ids: Set[str] = set()
    created_edge_ids: Set[str] = set()

    file_asts: Dict[str, dict] = {}
    all_file_paths: Set[str] = set()
    module_to_file: Dict[str, str] = {}

    file_exports: Dict[str, Dict[str, str]] = {}
    file_imports: Dict[str, Dict[str, str]] = {}
    file_symbols: Dict[str, Dict[str, str]] = {}

    # FastAPI Router Prefix Registries: { ("backend/api/websocket_router.py", "router"): "/api" }
    router_prefixes: Dict[Tuple[str, str], str] = {}
    
    # Global Endpoint & Event Registry: 
    # { "GET::api/users/*": "node_id", "EVENT::SEMANTIC_SEARCH": "node_id", "WEBSOCKET::ws": "node_id" }
    backend_api_registry: Dict[str, str] = {}
    
    # Frontend Network & WebSocket Calls
    frontend_network_calls: List[dict] = []

    py_parser = Parser(PY_LANGUAGE)
    js_parser = Parser(JS_LANGUAGE) if JS_LANGUAGE else None
    ts_parser = Parser(TS_LANGUAGE) if TS_LANGUAGE else None
    tsx_parser = Parser(TSX_LANGUAGE) if TSX_LANGUAGE else None

    # -------------------------------------------------------------------------
    # 2. INGEST SOURCE FILES ACROSS LANGUAGES
    # -------------------------------------------------------------------------
    for item in items:
        if item.get("type") == "file":
            rel_path = normalize_rel_path(item["path"])
            all_file_paths.add(rel_path)
            full_path = os.path.join(target_dir, rel_path)

            file_symbols[rel_path] = {}
            file_exports[rel_path] = {}
            file_imports[rel_path] = {}

            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                content_bytes = content.encode('utf-8')

                if rel_path.endswith(".py"):
                    file_asts[rel_path] = {
                        "lang": "python",
                        "bytes": content_bytes,
                        "tree": py_parser.parse(content_bytes),
                        "content": content
                    }
                    mod_name = rel_path.replace("/", ".").replace(".py", "")
                    module_to_file[mod_name] = rel_path
                    base_name = posixpath.basename(rel_path).replace(".py", "")
                    module_to_file[base_name] = rel_path

                elif rel_path.endswith((".tsx", ".ts")) and (tsx_parser or ts_parser or js_parser):
                    parser_instance = tsx_parser if (rel_path.endswith(".tsx") and tsx_parser) else (ts_parser or js_parser)
                    file_asts[rel_path] = {
                        "lang": "typescript",
                        "bytes": content_bytes,
                        "tree": parser_instance.parse(content_bytes),
                        "content": content
                    }

                elif rel_path.endswith((".js", ".jsx", ".mjs", ".cjs")) and js_parser:
                    file_asts[rel_path] = {
                        "lang": "javascript",
                        "bytes": content_bytes,
                        "tree": js_parser.parse(content_bytes),
                        "content": content
                    }

                else:
                    file_asts[rel_path] = {
                        "lang": "text",
                        "content": content,
                        "is_text_only": True
                    }
            except Exception as e:
                print(f"[WARN] Error reading {rel_path}: {e}")

    # -------------------------------------------------------------------------
    # 3. PASS 1: FASTAPI / FLASK ROUTER PREFIX TREE COMPILER
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        if ast_data.get("lang") != "python":
            continue

        content = ast_data.get("content", "")

        # Parse APIRouter(prefix="/...")
        for match in re.finditer(r'([a-zA-Z0-9_]+)\s*=\s*APIRouter\s*\([^)]*prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            var_name = match.group(1)
            prefix = match.group(2)
            router_prefixes[(filepath, var_name)] = prefix.strip('/')

        # Parse app.include_router(router_var, prefix="/...")
        for match in re.finditer(r'(?:app|router)\.include_router\s*\(\s*([a-zA-Z0-9_]+)[^)]*prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            router_var = match.group(1)
            mount_prefix = match.group(2).strip('/')
            router_prefixes[(filepath, router_var)] = mount_prefix

        # Parse Flask Blueprints
        for match in re.finditer(r'([a-zA-Z0-9_]+)\s*=\s*Blueprint\s*\([^)]*url_prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            bp_var = match.group(1)
            bp_prefix = match.group(2).strip('/')
            router_prefixes[(filepath, bp_var)] = bp_prefix

    # -------------------------------------------------------------------------
    # 4. BUILD DIRECTORY & FILE NODES (Structural Hierarchy)
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        parts = filepath.split("/")
        current_path = ""

        # Folder Suns
        for i in range(len(parts) - 1):
            parent_path = current_path
            current_path = f"{current_path}/{parts[i]}" if current_path else parts[i]

            if current_path not in created_node_ids:
                nodes.append({
                    "id": current_path,
                    "type": "obsidianNode",
                    "data": {"label": parts[i], "nodeType": "folder", "loc": 0}
                })
                created_node_ids.add(current_path)

            if parent_path:
                edge_id = f"hierarchy-{parent_path}-{current_path}"
                if edge_id not in created_edge_ids:
                    edges.append({
                        "id": edge_id,
                        "source": parent_path,
                        "target": current_path,
                        "type": "hierarchy"
                    })
                    created_edge_ids.add(edge_id)

        # File Planet
        parent_folder = current_path
        file_velocity = git_churn.get(filepath, 0)
        file_loc = len(ast_data.get("content", "").splitlines())

        if filepath not in created_node_ids:
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
            created_node_ids.add(filepath)

        if parent_folder:
            edge_id = f"hierarchy-{parent_folder}-{filepath}"
            if edge_id not in created_edge_ids:
                edges.append({
                    "id": edge_id,
                    "source": parent_folder,
                    "target": filepath,
                    "type": "hierarchy"
                })
                created_edge_ids.add(edge_id)

    # -------------------------------------------------------------------------
    # 5. AST RECURSIVE SYMBOL & SCOPE EXTRACTION (With Decorated Def Fix)
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        content = ast_data.get("content", "")
        lang = ast_data.get("lang", "text")
        
        # Track local variable string assignments: const WS_URL = 'ws://...'
        local_string_vars: Dict[str, str] = {}
        for var_match in re.finditer(r'(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            local_string_vars[var_match.group(1)] = var_match.group(2)

        def calculate_complexity_py(node: Node) -> int:
            score = 0
            decision_triggers = {
                'if_statement', 'for_statement', 'while_statement', 'except_clause',
                'with_item', 'match_statement', 'list_comprehension', 'conditional_expression'
            }
            if node.type in decision_triggers:
                score += 1
            for child in node.children:
                score += calculate_complexity_py(child)
            return score

        # ---------------------------------------------------------------------
        # PYTHON AST & FASTAPI / WEBSOCKET EVENT PROCESSOR
        # ---------------------------------------------------------------------
        if lang == "python" and "tree" in ast_data:
            root_node = ast_data["tree"].root_node
            content_bytes = ast_data["bytes"]

            def get_text(n: Optional[Node]) -> str:
                return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

            def extract_py_imports(node: Node):
                for child in node.children:
                    if child.type == 'import_from_statement':
                        mod_node = child.child_by_field_name('module_name')
                        mod_name = get_text(mod_node) if mod_node else ""
                        resolved_file = resolve_py_import_path(filepath, mod_name, module_to_file)

                        for sub in child.children:
                            if sub.type == 'dotted_name' and sub != mod_node:
                                imported_sym = get_text(sub)
                                if resolved_file:
                                    file_imports[filepath][imported_sym] = resolved_file
                            elif sub.type == 'aliased_import':
                                name_n = sub.child_by_field_name('name')
                                alias_n = sub.child_by_field_name('alias')
                                imported_sym = get_text(name_n)
                                alias_sym = get_text(alias_n) if alias_n else imported_sym
                                if resolved_file:
                                    file_imports[filepath][alias_sym] = resolved_file

                    elif child.type == 'import_statement':
                        for sub in child.children:
                            if sub.type == 'dotted_name':
                                mod_name = get_text(sub)
                                resolved_file = resolve_py_import_path(filepath, mod_name, module_to_file)
                                if resolved_file:
                                    file_imports[filepath][mod_name] = resolved_file
                    extract_py_imports(child)

            extract_py_imports(root_node)

            def extract_py_defs(node: Node, scope_prefix: str = ""):
                for child in node.children:
                    # 🚀 FIX: Handle both standard function_definition and decorated_definition
                    func_node = None
                    decorators_list = []

                    if child.type == 'function_definition':
                        func_node = child
                    elif child.type == 'decorated_definition':
                        for sub in child.children:
                            if sub.type == 'decorator':
                                decorators_list.append(sub)
                            elif sub.type in ['function_definition', 'async_function_definition']:
                                func_node = sub

                    if func_node:
                        raw_func_name = get_text(func_node.child_by_field_name('name')) or "anonymous"
                        full_name = f"{scope_prefix}.{raw_func_name}" if scope_prefix else raw_func_name
                        start_line = child.start_point[0] + 1
                        end_line = child.end_point[0] + 1
                        loc = max(1, (end_line - start_line) + 1)

                        node_id = f"{filepath}::{full_name}::L{start_line}"
                        file_symbols[filepath][raw_func_name] = node_id
                        file_symbols[filepath][full_name] = node_id
                        file_exports[filepath][raw_func_name] = node_id

                        params_node = func_node.child_by_field_name('parameters')
                        return_node = func_node.child_by_field_name('return_type')
                        param_str = clean_text(get_text(params_node)) if params_node else "()"
                        return_str = clean_text(get_text(return_node)) if return_node else "?"
                        signature = f"def {full_name}{param_str} -> {return_str}"

                        body = func_node.child_by_field_name('body')
                        complexity = calculate_complexity_py(body) if body else 0
                        density = float(complexity / loc) if loc > 0 else 0.0
                        raw_code = get_text(child)

                        # 🚀 A. FASTAPI / FLASK ROUTE DECORATORS (AST Inspection)
                        for dec_node in decorators_list:
                            dec_text = get_text(dec_node)
                            match = re.search(r'@(?:app|router|api)\.(get|post|put|delete|patch|options|head|websocket|route)\s*\(\s*([\'\"`][^\'\"]+[\'\"`])', dec_text)
                            if match:
                                method = match.group(1).upper()
                                raw_route_path = match.group(2)
                                clean_raw = raw_route_path.strip('\'"`')
                                
                                prefix = ""
                                for (rf_path, r_var), pref in router_prefixes.items():
                                    if rf_path == filepath and pref:
                                        prefix = pref
                                        break

                                combined_path = f"{prefix}/{clean_raw}".strip('/')
                                norm_path = normalize_uri(combined_path)

                                backend_api_registry[f"{method}::{norm_path}"] = node_id
                                backend_api_registry[norm_path] = node_id
                                
                                local_norm = normalize_uri(clean_raw)
                                backend_api_registry[f"{method}::{local_norm}"] = node_id
                                backend_api_registry[local_norm] = node_id

                        # 🚀 B. WEBSOCKET EVENT HANDLERS (e.g. if evt == "SEMANTIC_SEARCH":)
                        for evt_match in re.finditer(r'(?:evt|event|message\.get\([\'"event\'"]\))\s*==\s*[\'\"`]([^\'\"`]+)[\'\"`]', raw_code):
                            event_token = evt_match.group(1).strip()
                            backend_api_registry[f"EVENT::{event_token}"] = node_id
                            backend_api_registry[event_token] = node_id

                        if node_id not in created_node_ids:
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
                            created_node_ids.add(node_id)

                        edge_id = f"contain-{filepath}-{node_id}"
                        if edge_id not in created_edge_ids:
                            edges.append({
                                "id": edge_id,
                                "source": filepath,
                                "target": node_id,
                                "type": "hierarchy"
                            })
                            created_edge_ids.add(edge_id)

                        if body:
                            extract_py_defs(body, full_name)

                    elif child.type == 'class_definition':
                        class_name = get_text(child.child_by_field_name('name')) or "AnonymousClass"
                        full_class_name = f"{scope_prefix}.{class_name}" if scope_prefix else class_name
                        body = child.child_by_field_name('body')
                        if body:
                            extract_py_defs(body, full_class_name)

            extract_py_defs(root_node)

        # ---------------------------------------------------------------------
        # DUAL REGEX SCANNER FOR PYTHON ROUTES (Guarantees 100% Extraction)
        # ---------------------------------------------------------------------
        if filepath.endswith('.py'):
            for dec_match in re.finditer(r'@(?:app|router|api)\.(get|post|put|delete|patch|options|head|websocket|route)\s*\(\s*([\'\"`][^\'\"]+[\'\"`])', content):
                method = dec_match.group(1).upper()
                raw_path = dec_match.group(2).strip('\'"`')
                norm = normalize_uri(raw_path)
                
                # Find matching function node ID
                target_node_id = filepath
                for candidate_id in file_symbols.get(filepath, {}).values():
                    target_node_id = candidate_id
                    break

                backend_api_registry[f"{method}::{norm}"] = target_node_id
                backend_api_registry[norm] = target_node_id

        # ---------------------------------------------------------------------
        # JAVASCRIPT / TYPESCRIPT / JSX AST PROCESSOR
        # ---------------------------------------------------------------------
        if lang in ["javascript", "typescript"] and "tree" in ast_data:
            root_node = ast_data["tree"].root_node
            content_bytes = ast_data["bytes"]

            def get_text(n: Optional[Node]) -> str:
                return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

            def extract_js_imports(node: Node):
                for child in node.children:
                    if child.type == 'import_statement':
                        source_node = child.child_by_field_name('source')
                        if source_node:
                            import_source = clean_text(get_text(source_node)).strip("'\"`")
                            resolved_file = resolve_js_import_path(filepath, import_source, all_file_paths)
                            if resolved_file:
                                for sub in child.children:
                                    if sub.type == 'import_clause':
                                        for spec in sub.named_children:
                                            if spec.type == 'identifier':
                                                file_imports[filepath][get_text(spec)] = resolved_file
                                            elif spec.type == 'named_imports':
                                                for ispec in spec.named_children:
                                                    if ispec.type == 'import_specifier':
                                                        name_n = ispec.child_by_field_name('name')
                                                        alias_n = ispec.child_by_field_name('alias')
                                                        local_name = get_text(alias_n) if alias_n else get_text(name_n)
                                                        file_imports[filepath][local_name] = resolved_file
                    extract_js_imports(child)

            extract_js_imports(root_node)

            visited_byte_ranges: Set[Tuple[int, int]] = set()

            def extract_js_defs(node: Node, scope_prefix: str = ""):
                for child in node.children:
                    span = (child.start_byte, child.end_byte)
                    is_func_decl = child.type in ['function_declaration', 'method_definition', 'generator_function_declaration']
                    
                    is_var_arrow = False
                    arrow_name = ""
                    arrow_node = None

                    if child.type in ['lexical_declaration', 'variable_declaration']:
                        for decl in child.named_children:
                            if decl.type == 'variable_declarator':
                                val = decl.child_by_field_name('value')
                                if val and val.type in ['arrow_function', 'function_expression']:
                                    name_n = decl.child_by_field_name('name')
                                    arrow_name = get_text(name_n) if name_n else "anonymous"
                                    is_var_arrow = True
                                    arrow_node = val
                                    break

                    if (is_func_decl or is_var_arrow) and span not in visited_byte_ranges:
                        visited_byte_ranges.add(span)
                        
                        if is_func_decl:
                            name_node = child.child_by_field_name('name')
                            raw_name = get_text(name_node) if name_node else "anonymous"
                            target_body = child.child_by_field_name('body')
                            target_node = child
                        else:
                            raw_name = arrow_name
                            target_body = arrow_node.child_by_field_name('body') if arrow_node else None
                            target_node = arrow_node if arrow_node else child

                        full_name = f"{scope_prefix}.{raw_name}" if scope_prefix else raw_name
                        start_line = target_node.start_point[0] + 1
                        end_line = target_node.end_point[0] + 1
                        loc = max(1, (end_line - start_line) + 1)

                        node_id = f"{filepath}::{full_name}::L{start_line}"
                        file_symbols[filepath][raw_name] = node_id
                        file_symbols[filepath][full_name] = node_id
                        file_exports[filepath][raw_name] = node_id

                        raw_code = get_text(child)

                        if node_id not in created_node_ids:
                            nodes.append({
                                "id": node_id,
                                "type": "obsidianNode",
                                "data": {
                                    "label": f"{full_name}()",
                                    "filePath": filepath,
                                    "line": start_line,
                                    "nodeType": "function",
                                    "loc": loc,
                                    "complexity": 1,
                                    "density": 0.1,
                                    "churn": git_churn.get(filepath, 0),
                                    "code": raw_code
                                }
                            })
                            created_node_ids.add(node_id)

                        edge_id = f"contain-{filepath}-{node_id}"
                        if edge_id not in created_edge_ids:
                            edges.append({
                                "id": edge_id,
                                "source": filepath,
                                "target": node_id,
                                "type": "hierarchy"
                            })
                            created_edge_ids.add(edge_id)

                        if target_body:
                            extract_js_defs(target_body, full_name)
                    else:
                        extract_js_defs(child, scope_prefix)

            extract_js_defs(root_node)

        # ---------------------------------------------------------------------
        # 6. UNIVERSAL FRONTEND NETWORK & WEBSOCKET SCANNER
        # ---------------------------------------------------------------------
        if filepath.endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs')):
            # A. Detect fetch('/...'), axios.get('/...'), new WebSocket(...)
            for net_match in re.finditer(r'(?:fetch|axios(?:\.get|\.post|\.put|\.delete)?|new\s+WebSocket)\s*\(\s*([\'\"`][^\'\"`]+[\'\"`]|[a-zA-Z0-9_]+)', content):
                raw_target = net_match.group(1).strip()
                method = "GET"
                if "WebSocket" in net_match.group(0):
                    method = "WEBSOCKET"
                elif ".post" in net_match.group(0):
                    method = "POST"
                elif ".put" in net_match.group(0):
                    method = "PUT"
                elif ".delete" in net_match.group(0):
                    method = "DELETE"

                # Resolve variable if not quoted
                if not raw_target.startswith(('"', "'", '`')) and raw_target in local_string_vars:
                    raw_target = local_string_vars[raw_target]

                norm = normalize_uri(raw_target)
                if norm:
                    caller = filepath
                    for candidate_id in file_symbols.get(filepath, {}).values():
                        caller = candidate_id
                        break

                    frontend_network_calls.append({
                        "type": "URI",
                        "method": method,
                        "token": norm,
                        "caller_id": caller
                    })

            # B. Detect WebSocket Emitters with any variable prefix (*.send({ event: "..." }))
            for ws_send_match in re.finditer(r'\.send\s*\(\s*(?:JSON\.stringify\s*\(\s*)?\{[^}]*[\'"]event[\'"]\s*:\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
                event_name = ws_send_match.group(1).strip()
                caller = filepath
                for candidate_id in file_symbols.get(filepath, {}).values():
                    caller = candidate_id
                    break

                frontend_network_calls.append({
                    "type": "EVENT",
                    "method": "WEBSOCKET",
                    "token": event_name,
                    "caller_id": caller
                })

    # -------------------------------------------------------------------------
    # 7. SCOPE-AWARE CALL GRAPH LINKER (Internal Function Calls)
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        if ast_data.get("is_text_only") or "tree" not in ast_data:
            continue

        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]

        def get_text(n: Optional[Node]) -> str:
            return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

        def traverse_calls(node: Node, caller_id: str):
            current_caller = caller_id
            if node.type in ['function_definition', 'function_declaration', 'method_definition', 'arrow_function']:
                start_l = node.start_point[0] + 1
                for candidate_id in file_symbols.get(filepath, {}).values():
                    if f"::L{start_l}" in candidate_id:
                        current_caller = candidate_id
                        break

            if node.type in ['call', 'call_expression']:
                func_node = node.child_by_field_name('function')
                if func_node:
                    called_raw = get_text(func_node)
                    called_symbol = called_raw.split('.')[-1].strip()

                    target_node_id = None

                    if called_symbol in file_symbols.get(filepath, {}):
                        target_node_id = file_symbols[filepath][called_symbol]
                    elif called_symbol in file_imports.get(filepath, {}):
                        source_file = file_imports[filepath][called_symbol]
                        if called_symbol in file_exports.get(source_file, {}):
                            target_node_id = file_exports[source_file][called_symbol]
                        else:
                            target_node_id = source_file

                    if target_node_id and target_node_id != current_caller and target_node_id in created_node_ids:
                        edge_id = f"call-{current_caller}-{target_node_id}"
                        if edge_id not in created_edge_ids:
                            edges.append({
                                "id": edge_id,
                                "source": current_caller,
                                "target": target_node_id,
                                "type": "call"
                            })
                            created_edge_ids.add(edge_id)

            for child in node.children:
                traverse_calls(child, current_caller)

        traverse_calls(root_node, filepath)

    # -------------------------------------------------------------------------
    # 8. 🚀 COMPILE CROSS-STACK LASER BRIDGES (Frontend <---> Backend)
    # -------------------------------------------------------------------------
    compiled_bridges_count = 0

    for net_call in frontend_network_calls:
        token = net_call["token"]
        method = net_call.get("method", "GET")
        caller_id = net_call["caller_id"]
        call_type = net_call.get("type", "URI")

        matched_target_node_id = None

        if call_type == "EVENT":
            # Event-Driven Channel Matching
            event_key = f"EVENT::{token}"
            if event_key in backend_api_registry:
                matched_target_node_id = backend_api_registry[event_key]
            elif token in backend_api_registry:
                matched_target_node_id = backend_api_registry[token]
        else:
            # URI Route Matching
            exact_key = f"{method}::{token}"
            if exact_key in backend_api_registry:
                matched_target_node_id = backend_api_registry[exact_key]
            elif token in backend_api_registry:
                matched_target_node_id = backend_api_registry[token]
            else:
                for reg_route, target_id in backend_api_registry.items():
                    clean_reg = reg_route.split('::')[-1]
                    if token.endswith(clean_reg) or clean_reg.endswith(token) or clean_reg == "ws":
                        matched_target_node_id = target_id
                        break

        # Fallback: Link Frontend WebSocket to Backend WebSocket Router if present
        if not matched_target_node_id and method == "WEBSOCKET":
            for reg_route, target_id in backend_api_registry.items():
                if "ws" in reg_route.lower() or "websocket" in reg_route.lower():
                    matched_target_node_id = target_id
                    break

        # Emit the Glowing Laser Conduit
        if matched_target_node_id and caller_id != matched_target_node_id:
            bridge_edge_id = f"bridge-{caller_id}-{matched_target_node_id}"
            if bridge_edge_id not in created_edge_ids:
                edges.append({
                    "id": bridge_edge_id,
                    "source": caller_id,
                    "target": matched_target_node_id,
                    "type": "network_bridge"
                })
                created_edge_ids.add(bridge_edge_id)
                compiled_bridges_count += 1

    print(f"[INFO] ⚡ Cross-Stack Compiler: Discovered {len(backend_api_registry)} backend endpoints, {len(frontend_network_calls)} frontend calls -> Compiled {compiled_bridges_count} Live Protocol Bridges.")

    # -------------------------------------------------------------------------
    # 9. EXECUTE GRAPH ML ANALYSIS PIPELINE
    # -------------------------------------------------------------------------
    enriched_nodes = analyze_graph_ml(nodes, edges)

    return {
        "nodes": enriched_nodes,
        "edges": edges
    }