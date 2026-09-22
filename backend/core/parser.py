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
# 1. MULTI-LANGUAGE GRAMMAR LOADERS (Python, JS, TS, C, C++, Java)
# -------------------------------------------------------------------------
PY_LANGUAGE: Optional[Language] = None
try:
    PY_LANGUAGE = Language(tspython.language())
except Exception as e:
    print(f"[WARN] Failed to load Python grammar: {e}")

JS_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_javascript as tsjavascript
    JS_LANGUAGE = Language(tsjavascript.language())
except Exception:
    pass

TS_LANGUAGE: Optional[Language] = None
TSX_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_typescript as tstypescript
    TS_LANGUAGE = Language(tstypescript.language_typescript())
    TSX_LANGUAGE = Language(tstypescript.language_tsx())
except Exception:
    pass

C_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_c as tsc
    C_LANGUAGE = Language(tsc.language())
except Exception:
    pass

CPP_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_cpp as tscpp
    CPP_LANGUAGE = Language(tscpp.language())
except Exception:
    pass

JAVA_LANGUAGE: Optional[Language] = None
try:
    import tree_sitter_java as tsjava
    JAVA_LANGUAGE = Language(tsjava.language())
except Exception:
    pass

# Persistent Global Parsers (instantiated once, reused across calls)
GLOBAL_PARSERS: Dict[str, Optional[Parser]] = {
    "py": Parser(PY_LANGUAGE) if PY_LANGUAGE else None,
    "js": Parser(JS_LANGUAGE) if JS_LANGUAGE else None,
    "ts": Parser(TS_LANGUAGE) if TS_LANGUAGE else None,
    "tsx": Parser(TSX_LANGUAGE) if TSX_LANGUAGE else None,
    "c": Parser(C_LANGUAGE) if C_LANGUAGE else None,
    "cpp": Parser(CPP_LANGUAGE) if CPP_LANGUAGE else None,
    "java": Parser(JAVA_LANGUAGE) if JAVA_LANGUAGE else None,
}

# Incremental AST Cache: (rel_path, abs_target) -> (mtime, file_size, cached_ast_data)
_AST_CACHE: Dict[Tuple[str, str], Tuple[float, int, dict]] = {}

# STRICT SOURCE CODE WHITELIST: Includes C, C++, Java, Python, JS, TS, Web
VALID_SOURCE_EXTENSIONS: Set[str] = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
    ".java",
    ".json", ".css", ".html", ".md", ".txt", ".toml", ".yaml", ".yml",
    ".bat", ".cmd", ".sh", ".bash", ".sql", ".env", ".ini", ".cfg"
}

MAX_FILE_SIZE_BYTES = 1_000_000  # 1 MB Safety Ceiling

# Fast AST Decision Triggers (reused across all AST traversals without re-allocating sets)
DECISION_TRIGGERS: Set[str] = {
    'if_statement', 'for_statement', 'while_statement', 'except_clause',
    'with_item', 'match_statement', 'list_comprehension', 'conditional_expression',
    'for_in_statement', 'for_range_loop', 'catch_clause', 'switch_case', 'case_statement',
    'do_statement', 'ternary_expression', 'try_statement'
}


def calculate_complexity(node: Optional[Node]) -> int:
    """Iterative AST complexity counter using constant-time decision lookup."""
    if not node:
        return 0
    score = 0
    stack = [node]
    while stack:
        curr = stack.pop()
        if curr.type in DECISION_TRIGGERS:
            score += 1
        stack.extend(curr.children)
    return score


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
    UNIVERSAL CROSS-STACK URI & EVENT NORMALIZER
    Transforms any frontend/backend route expression into an identical canonical token.
    """
    if not uri:
        return ""

    clean = uri.strip("'\"`")
    
    clean = re.sub(r'^(https?://|wss?://)[^/]+/', '', clean)
    clean = re.sub(r'^(https?://|wss?://)[^/]+$', '', clean)
    
    clean = re.sub(r'^\$\{[^}]+\}/?', '', clean)
    clean = re.sub(r'^[a-zA-Z0-9_]+\s*\+\s*[\'\"`]', '', clean)
    
    clean = clean.split('?')[0].split('&')[0]
    clean = clean.strip().lstrip('/')
    
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


def resolve_cpp_include_path(current_file: str, include_str: str, existing_files: Set[str]) -> Optional[str]:
    """Resolves C/C++ #include "header.h" or #include <header.h> to workspace files."""
    clean_inc = include_str.strip('<>"\'')
    
    # 1. Check relative to current file directory
    curr_dir = posixpath.dirname(current_file)
    candidate_rel = posixpath.normpath(posixpath.join(curr_dir, clean_inc))
    if candidate_rel in existing_files:
        return candidate_rel

    # 2. Check root include search
    if clean_inc in existing_files:
        return clean_inc

    for f in existing_files:
        if f.endswith(f"/{clean_inc}") or f == clean_inc:
            return f

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

    router_prefixes: Dict[Tuple[str, str], str] = {}
    backend_api_registry: Dict[str, str] = {}
    frontend_network_calls: List[dict] = []

    # Parsers Reference (reusing persistent global instances)
    py_parser = GLOBAL_PARSERS.get("py")
    js_parser = GLOBAL_PARSERS.get("js")
    ts_parser = GLOBAL_PARSERS.get("ts")
    tsx_parser = GLOBAL_PARSERS.get("tsx")
    c_parser = GLOBAL_PARSERS.get("c")
    cpp_parser = GLOBAL_PARSERS.get("cpp")
    java_parser = GLOBAL_PARSERS.get("java")

    # -------------------------------------------------------------------------
    # 2. INGEST SOURCE FILES (Python, JS, TS, C, C++, Java, Text)
    # -------------------------------------------------------------------------
    for item in items:
        if item.get("type") == "file":
            rel_path = normalize_rel_path(item["path"])
            ext = posixpath.splitext(rel_path)[1].lower()

            if ext not in VALID_SOURCE_EXTENSIONS:
                continue

            full_path = os.path.join(target_dir, rel_path)
            try:
                st = os.stat(full_path)
                file_size = st.st_size
                mtime = st.st_mtime
                if file_size > MAX_FILE_SIZE_BYTES:
                    continue
            except Exception:
                continue

            all_file_paths.add(rel_path)
            file_symbols[rel_path] = {}
            file_exports[rel_path] = {}
            file_imports[rel_path] = {}

            # 🚀 HIGH-SPEED INCREMENTAL AST CACHE CHECK (0.001ms hit)
            cache_key = (rel_path, target_dir)
            cached = _AST_CACHE.get(cache_key)
            if cached and cached[0] == mtime and cached[1] == file_size:
                file_asts[rel_path] = cached[2]
                if rel_path.endswith(".py"):
                    mod_name = rel_path.replace("/", ".").replace(".py", "")
                    module_to_file[mod_name] = rel_path
                    base_name = posixpath.basename(rel_path).replace(".py", "")
                    module_to_file[base_name] = rel_path
                continue

            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                content_bytes = content.encode('utf-8')

                # Python
                if rel_path.endswith(".py") and py_parser:
                    ast_entry = {
                        "lang": "python",
                        "bytes": content_bytes,
                        "tree": py_parser.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry
                    mod_name = rel_path.replace("/", ".").replace(".py", "")
                    module_to_file[mod_name] = rel_path
                    base_name = posixpath.basename(rel_path).replace(".py", "")
                    module_to_file[base_name] = rel_path

                # TypeScript / TSX
                elif rel_path.endswith((".tsx", ".ts")) and (tsx_parser or ts_parser or js_parser):
                    parser_instance = tsx_parser if (rel_path.endswith(".tsx") and tsx_parser) else (ts_parser or js_parser)
                    ast_entry = {
                        "lang": "typescript",
                        "bytes": content_bytes,
                        "tree": parser_instance.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry

                # JavaScript / JSX
                elif rel_path.endswith((".js", ".jsx", ".mjs", ".cjs")) and js_parser:
                    ast_entry = {
                        "lang": "javascript",
                        "bytes": content_bytes,
                        "tree": js_parser.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry

                # C++
                elif rel_path.endswith((".cpp", ".hpp", ".cc", ".cxx")) and (cpp_parser or c_parser):
                    parser_instance = cpp_parser if cpp_parser else c_parser
                    ast_entry = {
                        "lang": "cpp",
                        "bytes": content_bytes,
                        "tree": parser_instance.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry

                # C
                elif rel_path.endswith((".c", ".h")) and (c_parser or cpp_parser):
                    parser_instance = c_parser if c_parser else cpp_parser
                    ast_entry = {
                        "lang": "c",
                        "bytes": content_bytes,
                        "tree": parser_instance.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry

                # Java
                elif rel_path.endswith(".java") and java_parser:
                    ast_entry = {
                        "lang": "java",
                        "bytes": content_bytes,
                        "tree": java_parser.parse(content_bytes),
                        "content": content
                    }
                    file_asts[rel_path] = ast_entry

                # Plain Text / Config
                else:
                    ast_entry = {
                        "lang": "text",
                        "content": content,
                        "is_text_only": True
                    }
                    file_asts[rel_path] = ast_entry

                # Store into persistent AST cache
                _AST_CACHE[cache_key] = (mtime, file_size, ast_entry)

            except Exception as e:
                print(f"[WARN] Error reading {rel_path}: {e}")

    # -------------------------------------------------------------------------
    # 3. PASS 1: FASTAPI / FLASK ROUTER PREFIX TREE COMPILER
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        if ast_data.get("lang") != "python":
            continue

        content = ast_data.get("content", "")

        for match in re.finditer(r'([a-zA-Z0-9_]+)\s*=\s*APIRouter\s*\([^)]*prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            var_name = match.group(1)
            prefix = match.group(2)
            router_prefixes[(filepath, var_name)] = prefix.strip('/')

        for match in re.finditer(r'(?:app|router)\.include_router\s*\(\s*([a-zA-Z0-9_]+)[^)]*prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            router_var = match.group(1)
            mount_prefix = match.group(2).strip('/')
            router_prefixes[(filepath, router_var)] = mount_prefix

        for match in re.finditer(r'([a-zA-Z0-9_]+)\s*=\s*Blueprint\s*\([^)]*url_prefix\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            bp_var = match.group(1)
            bp_prefix = match.group(2).strip('/')
            router_prefixes[(filepath, bp_var)] = bp_prefix

    # -------------------------------------------------------------------------
    # 4. BUILD DIRECTORY & FILE NODES (Structural Planets)
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
    # 4b. ENSURE EXPLICIT FOLDERS IN ITEMS ARE REPRESENTED
    # -------------------------------------------------------------------------
    for item in items:
        if item.get("type") == "folder":
            folder_path = normalize_rel_path(item.get("path", ""))
            if not folder_path or folder_path == ".":
                continue
            parts = folder_path.split("/")
            cur = ""
            for i, p in enumerate(parts):
                parent_p = cur
                cur = f"{cur}/{p}" if cur else p
                if cur not in created_node_ids:
                    nodes.append({
                        "id": cur,
                        "type": "obsidianNode",
                        "data": {"label": p, "nodeType": "folder", "loc": 0}
                    })
                    created_node_ids.add(cur)
                if parent_p:
                    edge_id = f"hierarchy-{parent_p}-{cur}"
                    if edge_id not in created_edge_ids:
                        edges.append({
                            "id": edge_id,
                            "source": parent_p,
                            "target": cur,
                            "type": "hierarchy"
                        })
                        created_edge_ids.add(edge_id)

    # -------------------------------------------------------------------------
    # 4c. CELESTIAL ROOT WORKSPACE NODE FOR EMPTY WORKSPACES
    # -------------------------------------------------------------------------
    if not nodes:
        project_name = os.path.basename(os.path.abspath(target_dir)) or "Workspace"
        nodes.append({
            "id": project_name,
            "type": "obsidianNode",
            "position": {"x": 0, "y": 0},
            "data": {
                "label": project_name,
                "nodeType": "folder",
                "loc": 0,
                "isRoot": True
            }
        })
        created_node_ids.add(project_name)

    # -------------------------------------------------------------------------
    # 5. AST RECURSIVE SYMBOL & SCOPE EXTRACTION ACROSS LANGUAGES
    # -------------------------------------------------------------------------
    for filepath, ast_data in file_asts.items():
        content = ast_data.get("content", "")
        lang = ast_data.get("lang", "text")
        
        local_string_vars: Dict[str, str] = {}
        for var_match in re.finditer(r'(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*[\'\"`]([^\'\"`]+)[\'\"`]', content):
            local_string_vars[var_match.group(1)] = var_match.group(2)

        if "tree" not in ast_data:
            continue

        root_node = ast_data["tree"].root_node
        content_bytes = ast_data["bytes"]

        def get_text(n: Optional[Node]) -> str:
            return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

        # ---------------------------------------------------------------------
        # A. PYTHON AST PROCESSOR
        # ---------------------------------------------------------------------
        if lang == "python":
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
                        complexity = calculate_complexity(body) if body else 0
                        density = float(complexity / loc) if loc > 0 else 0.0
                        raw_code = get_text(child)

                        # Fast API Route Decorators
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
        # B. JAVASCRIPT / TYPESCRIPT / JSX AST PROCESSOR
        # ---------------------------------------------------------------------
        elif lang in ["javascript", "typescript"]:
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
        # C. C & C++ AST PROCESSOR (Functions, Methods, Classes, #include)
        # ---------------------------------------------------------------------
        elif lang in ["c", "cpp"]:
            def extract_cpp_includes(node: Node):
                for child in node.children:
                    if child.type == 'preproc_include':
                        path_node = child.child_by_field_name('path')
                        if path_node:
                            inc_text = get_text(path_node)
                            resolved_header = resolve_cpp_include_path(filepath, inc_text, all_file_paths)
                            if resolved_header and resolved_header != filepath:
                                inc_edge_id = f"include-{filepath}-{resolved_header}"
                                if inc_edge_id not in created_edge_ids:
                                    edges.append({
                                        "id": inc_edge_id,
                                        "source": filepath,
                                        "target": resolved_header,
                                        "type": "import"
                                    })
                                    created_edge_ids.add(inc_edge_id)
                    extract_cpp_includes(child)

            extract_cpp_includes(root_node)

            def extract_cpp_defs(node: Node, scope_prefix: str = ""):
                for child in node.children:
                    # 1. Functions & Methods: int solve() { ... }
                    if child.type == 'function_definition':
                        decl_node = child.child_by_field_name('declarator')
                        func_name = "func"
                        if decl_node:
                            # Extract identifier from declarator tree
                            fn_id_match = re.search(r'([a-zA-Z0-9_]+)\s*\(', get_text(decl_node))
                            func_name = fn_id_match.group(1) if fn_id_match else get_text(decl_node).split('(')[0].strip()

                        full_name = f"{scope_prefix}::{func_name}" if scope_prefix else func_name
                        start_line = child.start_point[0] + 1
                        end_line = child.end_point[0] + 1
                        loc = max(1, (end_line - start_line) + 1)

                        node_id = f"{filepath}::{full_name}::L{start_line}"
                        file_symbols[filepath][func_name] = node_id
                        file_symbols[filepath][full_name] = node_id
                        file_exports[filepath][func_name] = node_id

                        type_node = child.child_by_field_name('type')
                        ret_type = get_text(type_node) if type_node else "auto"
                        signature = f"{ret_type} {full_name}()"

                        body = child.child_by_field_name('body')
                        complexity = calculate_complexity(body) if body else 0
                        density = float(complexity / loc) if loc > 0 else 0.0
                        raw_code = get_text(child)

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

                    # 2. Classes, Structs & Namespaces
                    elif child.type in ['class_specifier', 'struct_specifier', 'namespace_definition']:
                        name_node = child.child_by_field_name('name')
                        spec_name = get_text(name_node) if name_node else "AnonymousType"
                        full_spec_name = f"{scope_prefix}::{spec_name}" if scope_prefix else spec_name
                        body = child.child_by_field_name('body')
                        if body:
                            extract_cpp_defs(body, full_spec_name)
                    else:
                        extract_cpp_defs(child, scope_prefix)

            extract_cpp_defs(root_node)

        # ---------------------------------------------------------------------
        # D. JAVA AST PROCESSOR (Classes, Methods, Packages, Imports)
        # ---------------------------------------------------------------------
        elif lang == "java":
            def extract_java_imports(node: Node):
                for child in node.children:
                    if child.type == 'import_declaration':
                        imp_text = get_text(child)
                        imported_class = imp_text.replace("import", "").replace("static", "").replace(";", "").strip().split(".")[-1]
                        # Map to possible workspace java files
                        for candidate_f in all_file_paths:
                            if candidate_f.endswith(f"/{imported_class}.java") or candidate_f == f"{imported_class}.java":
                                file_imports[filepath][imported_class] = candidate_f
                                imp_edge = f"import-{filepath}-{candidate_f}"
                                if imp_edge not in created_edge_ids:
                                    edges.append({
                                        "id": imp_edge,
                                        "source": filepath,
                                        "target": candidate_f,
                                        "type": "import"
                                    })
                                    created_edge_ids.add(imp_edge)
                    extract_java_imports(child)

            extract_java_imports(root_node)

            def extract_java_defs(node: Node, scope_prefix: str = ""):
                for child in node.children:
                    # 1. Methods & Constructors: public void solve() { ... }
                    if child.type in ['method_declaration', 'constructor_declaration']:
                        name_node = child.child_by_field_name('name')
                        method_name = get_text(name_node) if name_node else "method"
                        full_name = f"{scope_prefix}.{method_name}" if scope_prefix else method_name
                        start_line = child.start_point[0] + 1
                        end_line = child.end_point[0] + 1
                        loc = max(1, (end_line - start_line) + 1)

                        node_id = f"{filepath}::{full_name}::L{start_line}"
                        file_symbols[filepath][method_name] = node_id
                        file_symbols[filepath][full_name] = node_id
                        file_exports[filepath][method_name] = node_id

                        type_node = child.child_by_field_name('type')
                        ret_type = get_text(type_node) if type_node else "void"
                        signature = f"{ret_type} {full_name}()"

                        body = child.child_by_field_name('body')
                        complexity = calculate_complexity(body) if body else 0
                        density = float(complexity / loc) if loc > 0 else 0.0
                        raw_code = get_text(child)

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

                    # 2. Classes, Interfaces & Enums
                    elif child.type in ['class_declaration', 'interface_declaration', 'enum_declaration']:
                        name_node = child.child_by_field_name('name')
                        class_name = get_text(name_node) if name_node else "AnonymousClass"
                        full_class_name = f"{scope_prefix}.{class_name}" if scope_prefix else class_name
                        body = child.child_by_field_name('body')
                        if body:
                            extract_java_defs(body, full_class_name)
                    else:
                        extract_java_defs(child, scope_prefix)

            extract_java_defs(root_node)

        # ---------------------------------------------------------------------
        # 6. UNIVERSAL FRONTEND NETWORK & WEBSOCKET SCANNER
        # -------------------------------------------------------------------------
        if filepath.endswith(('.js', '.jsx', '.ts', '.tsx', '.mjs')):
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
    # 7. SCOPE-AWARE CALL GRAPH LINKER (Python, JS, C, C++, Java)
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
            if node.type in [
                'function_definition', 'function_declaration', 'method_definition', 
                'arrow_function', 'method_declaration', 'constructor_declaration'
            ]:
                start_l = node.start_point[0] + 1
                for candidate_id in file_symbols.get(filepath, {}).values():
                    if f"::L{start_l}" in candidate_id:
                        current_caller = candidate_id
                        break

            # Cross-language function & method calls
            if node.type in ['call', 'call_expression', 'method_invocation']:
                func_node = node.child_by_field_name('function') or node.child_by_field_name('name')
                if func_node:
                    called_raw = get_text(func_node)
                    called_symbol = called_raw.split('.')[-1].split('::')[-1].strip()

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
    # 8. COMPILE CROSS-STACK LASER BRIDGES (Frontend <---> Backend)
    # -------------------------------------------------------------------------
    compiled_bridges_count = 0

    for net_call in frontend_network_calls:
        token = net_call["token"]
        method = net_call.get("method", "GET")
        caller_id = net_call["caller_id"]
        call_type = net_call.get("type", "URI")

        matched_target_node_id = None

        if call_type == "EVENT":
            event_key = f"EVENT::{token}"
            if event_key in backend_api_registry:
                matched_target_node_id = backend_api_registry[event_key]
            elif token in backend_api_registry:
                matched_target_node_id = backend_api_registry[token]
        else:
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

        if not matched_target_node_id and method == "WEBSOCKET":
            for reg_route, target_id in backend_api_registry.items():
                if "ws" in reg_route.lower() or "websocket" in reg_route.lower():
                    matched_target_node_id = target_id
                    break

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

    print(f"[INFO] [CROSS-STACK] Discovered {len(backend_api_registry)} backend endpoints, {len(frontend_network_calls)} frontend calls -> Compiled {compiled_bridges_count} Live Protocol Bridges.")

    # -------------------------------------------------------------------------
    # 9. EXECUTE GRAPH ML ANALYSIS PIPELINE
    # -------------------------------------------------------------------------
    enriched_nodes = analyze_graph_ml(nodes, edges)

    return {
        "nodes": enriched_nodes,
        "edges": edges
    }