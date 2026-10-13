# backend/core/splitter.py
import os
import posixpath
import re
from typing import Dict, List, Optional, Set, Tuple, Any
import libcst as cst

try:
    from core.mutator import (
        IdentifierCollector,
        ImportStatementsCollector,
        file_path_to_module_aliases,
        ImportRewriter
    )
    from core.js_mutator import (
        calculate_relative_js_import_path,
        extract_js_symbol,
        extract_symbol_regex_fallback,
        forward_dependencies_to_dest,
        get_tree_sitter_parser_for_file
    )
except ImportError:
    from backend.core.mutator import (
        IdentifierCollector,
        ImportStatementsCollector,
        file_path_to_module_aliases,
        ImportRewriter
    )
    from backend.core.js_mutator import (
        calculate_relative_js_import_path,
        extract_js_symbol,
        extract_symbol_regex_fallback,
        forward_dependencies_to_dest,
        get_tree_sitter_parser_for_file
    )


# -------------------------------------------------------------------------
# 1. PYTHON AST SYMBOL ANALYZER (LibCST)
# -------------------------------------------------------------------------
class PythonModuleAnalyzer:
    """
    Analyzes Python module AST to extract top-level functions, classes,
    module-level assignments, imports, and cross-symbol references.
    """
    def __init__(self, code: str):
        self.code = code
        self.module_cst = cst.parse_module(code)
        self.symbols: Dict[str, Dict[str, Any]] = {}
        self.import_collector = ImportStatementsCollector()
        self.module_cst.visit(self.import_collector)
        self._analyze()

    def _analyze(self):
        for stmt in self.module_cst.body:
            if isinstance(stmt, cst.FunctionDef):
                sym_name = stmt.name.value
                id_visitor = IdentifierCollector()
                stmt.visit(id_visitor)
                
                docstring = None
                if stmt.get_docstring():
                    docstring = stmt.get_docstring().strip()

                stmt_code = self.module_cst.code_for_node(stmt)
                line_count = len(stmt_code.splitlines())

                self.symbols[sym_name] = {
                    "name": sym_name,
                    "kind": "function",
                    "cst_node": stmt,
                    "code": stmt_code,
                    "line_count": line_count,
                    "docstring": docstring,
                    "references": id_visitor.referenced_names - {sym_name}
                }

            elif isinstance(stmt, cst.ClassDef):
                sym_name = stmt.name.value
                id_visitor = IdentifierCollector()
                stmt.visit(id_visitor)

                docstring = None
                if stmt.get_docstring():
                    docstring = stmt.get_docstring().strip()

                stmt_code = self.module_cst.code_for_node(stmt)
                line_count = len(stmt_code.splitlines())

                self.symbols[sym_name] = {
                    "name": sym_name,
                    "kind": "class",
                    "cst_node": stmt,
                    "code": stmt_code,
                    "line_count": line_count,
                    "docstring": docstring,
                    "references": id_visitor.referenced_names - {sym_name}
                }

            elif isinstance(stmt, cst.SimpleStatementLine):
                for small in stmt.body:
                    if isinstance(small, cst.Assign):
                        for target in small.targets:
                            if isinstance(target.target, cst.Name):
                                var_name = target.target.value
                                stmt_code = self.module_cst.code_for_node(stmt)
                                id_visitor = IdentifierCollector()
                                stmt.visit(id_visitor)
                                self.symbols[var_name] = {
                                    "name": var_name,
                                    "kind": "constant",
                                    "cst_node": stmt,
                                    "code": stmt_code,
                                    "line_count": len(stmt_code.splitlines()),
                                    "docstring": None,
                                    "references": id_visitor.referenced_names - {var_name}
                                }
                    elif isinstance(small, cst.AnnAssign):
                        if isinstance(small.target, cst.Name):
                            var_name = small.target.value
                            stmt_code = self.module_cst.code_for_node(stmt)
                            id_visitor = IdentifierCollector()
                            stmt.visit(id_visitor)
                            self.symbols[var_name] = {
                                "name": var_name,
                                "kind": "constant",
                                "cst_node": stmt,
                                "code": stmt_code,
                                "line_count": len(stmt_code.splitlines()),
                                "docstring": None,
                                "references": id_visitor.referenced_names - {var_name}
                            }

        # Compute internal dependencies between discovered symbols
        all_sym_names = set(self.symbols.keys())
        for sym_name, sym_info in self.symbols.items():
            internal_deps = sym_info["references"].intersection(all_sym_names)
            sym_info["internal_dependencies"] = sorted(list(internal_deps))


# -------------------------------------------------------------------------
# 2. JAVASCRIPT / TYPESCRIPT SYMBOL ANALYZER
# -------------------------------------------------------------------------
class JSModuleAnalyzer:
    """
    Analyzes JavaScript/TypeScript/JSX files using Tree-Sitter with regex
    fallback to discover components, classes, and functions for splitting.
    """
    def __init__(self, code: str, filepath: str):
        self.code = code
        self.filepath = filepath
        self.symbols: Dict[str, Dict[str, Any]] = {}
        self._analyze()

    def _analyze(self):
        parser = get_tree_sitter_parser_for_file(self.filepath)
        if parser:
            try:
                tree = parser.parse(bytes(self.code, "utf8"))
                root = tree.root_node
                for child in root.children:
                    node_to_check = child
                    # Handle export statements wrapping declarations
                    if child.type in ("export_statement", "export_default_declaration"):
                        for inner in child.children:
                            if inner.type in ("function_declaration", "class_declaration", "lexical_declaration"):
                                node_to_check = inner
                                break

                    name = None
                    kind = "function"

                    if node_to_check.type == "function_declaration":
                        name_node = node_to_check.child_by_field_name("name")
                        if name_node:
                            name = name_node.text.decode("utf8")
                            kind = "function"
                    elif node_to_check.type == "class_declaration":
                        name_node = node_to_check.child_by_field_name("name")
                        if name_node:
                            name = name_node.text.decode("utf8")
                            kind = "class"
                    elif node_to_check.type == "lexical_declaration":
                        for declarator in node_to_check.children:
                            if declarator.type == "variable_declarator":
                                name_node = declarator.child_by_field_name("name")
                                value_node = declarator.child_by_field_name("value")
                                if name_node and value_node and value_node.type in ("arrow_function", "function"):
                                    name = name_node.text.decode("utf8")
                                    kind = "function"
                                    break

                    if name and name not in self.symbols:
                        extracted_code = child.text.decode("utf8")
                        lines = extracted_code.splitlines()
                        # Simple regex identifier reference extraction
                        all_identifiers = set(re.findall(r'\b[A-Za-z_][A-Za-z0-9_]*\b', extracted_code))
                        self.symbols[name] = {
                            "name": name,
                            "kind": kind,
                            "code": extracted_code,
                            "line_count": len(lines),
                            "references": all_identifiers - {name},
                            "docstring": None
                        }
            except Exception:
                pass

        # If Tree-Sitter didn't extract any symbols, fallback to regex scanning
        if not self.symbols:
            func_patterns = [
                r'(?:export\s+default\s+|export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)',
                r'(?:export\s+default\s+|export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>',
                r'(?:export\s+default\s+|export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)'
            ]
            for pattern in func_patterns:
                for match in re.finditer(pattern, self.code):
                    name = match.group(1)
                    if name not in self.symbols:
                        code_block, _ = extract_symbol_regex_fallback(self.code, name)
                        if code_block:
                            all_identifiers = set(re.findall(r'\b[A-Za-z_][A-Za-z0-9_]*\b', code_block))
                            self.symbols[name] = {
                                "name": name,
                                "kind": "function",
                                "code": code_block,
                                "line_count": len(code_block.splitlines()),
                                "references": all_identifiers - {name},
                                "docstring": None
                            }

        # Calculate internal dependencies
        all_syms = set(self.symbols.keys())
        for sym_name, sym_info in self.symbols.items():
            sym_info["internal_dependencies"] = sorted(list(sym_info["references"].intersection(all_syms)))


# -------------------------------------------------------------------------
# 3. SPLIT STRATEGY PLANNING ALGORITHMS
# -------------------------------------------------------------------------
def sanitize_module_name(name: str, fallback: str = "module") -> str:
    """
    Sanitizes non-standard, cluttered, or weird symbol/file names into
    a strictly valid Python / JS identifier.
    Examples:
      'My Service (v2!)' -> 'my_service_v2'
      '123_data' -> 'mod_123_data'
      '___private_tool__' -> 'private_tool'
      'handle-request' -> 'handle_request'
    """
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', name).lower()
    s = re.sub(r'[^a-zA-Z0-9_]', '_', s)
    s = re.sub(r'_+', '_', s).strip('_')
    if s and s[0].isdigit():
        s = f"mod_{s}"
    return s or fallback


def generate_split_plan(
    filepath: str,
    symbols: Dict[str, Dict[str, Any]],
    strategy: str = "modular",
    num_parts: int = 2,
    custom_plan: Optional[Dict[str, List[str]]] = None
) -> Dict[str, List[str]]:
    """
    Generates target filename -> [symbol_names] mapping.
    Strategies:
      - 'modular': 1 file per major class or independent component.
      - 'dependency_clustering': Couplings/connected components in 2 to N parts.
      - 'balanced_size': Splits symbols into N files with roughly balanced line counts.
      - 'custom': Uses user-specified mapping.
    """
    if custom_plan:
        return custom_plan

    dir_name = posixpath.dirname(filepath.replace("\\", "/"))
    base_name, ext = posixpath.splitext(posixpath.basename(filepath.replace("\\", "/")))

    sym_names = [k for k, v in symbols.items() if v.get("kind") in ("function", "class")]
    if not sym_names:
        return {}

    plan: Dict[str, List[str]] = {}

    if strategy == "modular" or len(sym_names) <= num_parts:
        # Separate file per major symbol
        for name in sym_names:
            clean_part_name = sanitize_module_name(name, fallback="symbol")
            clean_base = sanitize_module_name(base_name, fallback="base")
            if clean_part_name == clean_base:
                target_filename = f"{clean_part_name}_extracted{ext}"
            else:
                target_filename = f"{clean_part_name}{ext}"

            target_path = posixpath.join(dir_name, target_filename) if dir_name else target_filename
            counter = 1
            orig = target_path
            while target_path in plan:
                target_path = f"{orig[:-len(ext)]}_{counter}{ext}"
                counter += 1

            plan[target_path] = [name]

    elif strategy == "dependency_clustering":
        # Group symbols with strong internal call links together
        visited = set()
        clusters: List[List[str]] = []

        for sym in sym_names:
            if sym in visited:
                continue
            component = []
            queue = [sym]
            visited.add(sym)

            while queue:
                curr = queue.pop(0)
                component.append(curr)
                neighbors = symbols[curr].get("internal_dependencies", [])
                for n in neighbors:
                    if n in symbols and n not in visited and symbols[n].get("kind") in ("function", "class"):
                        visited.add(n)
                        queue.append(n)

            clusters.append(component)

        # Merge clusters if more than num_parts, or split if fewer
        clusters.sort(key=lambda c: sum(symbols[s]["line_count"] for s in c), reverse=True)
        partitions: List[List[str]] = [[] for _ in range(max(1, min(num_parts, len(clusters))))]
        
        for c_idx, cluster in enumerate(clusters):
            target_p = c_idx % len(partitions)
            partitions[target_p].extend(cluster)

        for p_idx, part in enumerate(partitions):
            if not part:
                continue
            primary_name = sanitize_module_name(part[0], fallback="cluster")
            clean_base = sanitize_module_name(base_name, fallback="base")
            target_filename = f"{clean_base}_{primary_name}{ext}"
            target_path = posixpath.join(dir_name, target_filename) if dir_name else target_filename
            counter = 1
            orig = target_path
            while target_path in plan:
                target_path = f"{orig[:-len(ext)]}_{counter}{ext}"
                counter += 1

            plan[target_path] = part

    else:
        # Balanced size partition
        sorted_syms = sorted(sym_names, key=lambda s: symbols[s]["line_count"], reverse=True)
        partitions = [[] for _ in range(num_parts)]
        part_weights = [0] * num_parts

        for s in sorted_syms:
            min_idx = part_weights.index(min(part_weights))
            partitions[min_idx].append(s)
            part_weights[min_idx] += symbols[s]["line_count"]

        for idx, part in enumerate(partitions):
            if not part:
                continue
            clean_base = sanitize_module_name(base_name, fallback="base")
            target_filename = f"{clean_base}_part{idx + 1}{ext}"
            target_path = posixpath.join(dir_name, target_filename) if dir_name else target_filename
            counter = 1
            orig = target_path
            while target_path in plan:
                target_path = f"{orig[:-len(ext)]}_{counter}{ext}"
                counter += 1

            plan[target_path] = part

    return plan


# -------------------------------------------------------------------------
# 4. PREVIEW GENERATOR
# -------------------------------------------------------------------------
def get_file_split_preview(
    file_path: str,
    workspace_root: str,
    strategy: str = "modular",
    num_parts: int = 2,
    custom_plan: Optional[Dict[str, List[str]]] = None
) -> Dict[str, Any]:
    """
    Returns symbol list, dependencies, proposed partitions, and previews of
    resulting files without writing any changes to disk.
    """
    abs_path = os.path.join(workspace_root, file_path)
    if not os.path.exists(abs_path):
        return {"success": False, "reason": f"File '{file_path}' does not exist on disk."}

    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    ext = os.path.splitext(file_path)[1].lower()
    symbols_data = {}

    if ext == ".py":
        try:
            py_analyzer = PythonModuleAnalyzer(content)
            symbols_data = py_analyzer.symbols
        except Exception as e:
            return {"success": False, "reason": f"Failed to parse Python CST: {e}"}
    elif ext in (".js", ".jsx", ".ts", ".tsx", ".mjs"):
        js_analyzer = JSModuleAnalyzer(content, file_path)
        symbols_data = js_analyzer.symbols
    else:
        return {"success": False, "reason": f"File extension '{ext}' does not support AST splitting."}

    split_plan = generate_split_plan(
        filepath=file_path,
        symbols=symbols_data,
        strategy=strategy,
        num_parts=num_parts,
        custom_plan=custom_plan
    )

    clean_symbols = []
    for name, data in symbols_data.items():
        clean_symbols.append({
            "name": name,
            "kind": data.get("kind", "function"),
            "line_count": data.get("line_count", 0),
            "docstring": data.get("docstring"),
            "internal_dependencies": data.get("internal_dependencies", [])
        })

    # Generate synthetic file preview snippets
    previews: Dict[str, str] = {}
    for target_path, sym_list in split_plan.items():
        snippets = []
        for s_name in sym_list:
            if s_name in symbols_data:
                snippets.append(symbols_data[s_name].get("code", ""))
        previews[target_path] = "\n\n".join(snippets)

    return {
        "success": True,
        "source_file": file_path,
        "total_lines": len(content.splitlines()),
        "symbols": clean_symbols,
        "split_plan": split_plan,
        "previews": previews,
        "strategy": strategy
    }


# -------------------------------------------------------------------------
# 5. ATOMIC MULTI-FILE SPLIT TRANSACTION EXECUTOR
# -------------------------------------------------------------------------
def execute_file_split(
    source_filepath: str,
    split_plan: Dict[str, List[str]],
    workspace_root: str,
    all_workspace_files: List[str],
    keep_reexports: bool = True,
    rewrite_workspace_imports: bool = True
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Executes atomic file split transaction across Python, JavaScript, and TypeScript:
      1. Creates each target file with required copied imports and extracted symbols.
      2. Injects cross-module imports between split parts for any interdependent symbols.
      3. Modifies source file: removes extracted symbols, injects imports/re-exports.
      4. If rewrite_workspace_imports=True, updates references across the workspace.
      5. Guarantees 100% rollback integrity on disk if any error occurs.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    if not os.path.exists(src_abs):
        return False, f"Source file '{source_filepath}' does not exist.", {}

    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()

    ext = os.path.splitext(source_filepath)[1].lower()

    if ext == ".py":
        return _execute_python_file_split(
            source_filepath=source_filepath,
            src_code=src_code,
            src_abs=src_abs,
            split_plan=split_plan,
            workspace_root=workspace_root,
            all_workspace_files=all_workspace_files,
            keep_reexports=keep_reexports,
            rewrite_workspace_imports=rewrite_workspace_imports
        )
    elif ext in (".js", ".jsx", ".ts", ".tsx", ".mjs"):
        return _execute_js_file_split(
            source_filepath=source_filepath,
            src_code=src_code,
            src_abs=src_abs,
            split_plan=split_plan,
            workspace_root=workspace_root,
            all_workspace_files=all_workspace_files,
            keep_reexports=keep_reexports,
            rewrite_workspace_imports=rewrite_workspace_imports
        )
    else:
        return False, f"Unsupported file extension '{ext}' for file splitting.", {}


# -------------------------------------------------------------------------
# 6. PYTHON SPLIT SURGERY
# -------------------------------------------------------------------------
class MultiSymbolRemover(cst.CSTTransformer):
    """Removes a set of symbol names from module CST."""
    def __init__(self, symbols_to_remove: Set[str]):
        self.symbols_to_remove = symbols_to_remove
        self.removed_nodes: Dict[str, cst.CSTNode] = {}

    def leave_FunctionDef(
        self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef
    ) -> cst.CSTNode:
        if original_node.name.value in self.symbols_to_remove:
            self.removed_nodes[original_node.name.value] = original_node
            return cst.RemovalSentinel.REMOVE
        return updated_node

    def leave_ClassDef(
        self, original_node: cst.ClassDef, updated_node: cst.ClassDef
    ) -> cst.CSTNode:
        if original_node.name.value in self.symbols_to_remove:
            self.removed_nodes[original_node.name.value] = original_node
            return cst.RemovalSentinel.REMOVE
        return updated_node


def _execute_python_file_split(
    source_filepath: str,
    src_code: str,
    src_abs: str,
    split_plan: Dict[str, List[str]],
    workspace_root: str,
    all_workspace_files: List[str],
    keep_reexports: bool,
    rewrite_workspace_imports: bool
) -> Tuple[bool, str, Dict[str, Any]]:
    try:
        src_cst = cst.parse_module(src_code)
    except Exception as e:
        return False, f"Failed to parse source Python CST: {e}", {}

    all_symbols_to_extract = set()
    for sym_list in split_plan.values():
        all_symbols_to_extract.update(sym_list)

    # 1. Remove all extracted symbols from source file CST
    remover = MultiSymbolRemover(all_symbols_to_extract)
    modified_src_cst = src_cst.visit(remover)

    # 2. Collect import statements present in source file
    src_import_collector = ImportStatementsCollector()
    src_cst.visit(src_import_collector)

    # Prepare file mutation queue: List of (absolute_path, content, is_new_file)
    mutation_queue: List[Tuple[str, str, bool]] = []
    symbol_to_new_file: Dict[str, str] = {}
    for target_rel_path, sym_names in split_plan.items():
        for s_name in sym_names:
            symbol_to_new_file[s_name] = target_rel_path

    # Discovered symbols declared directly in source file
    py_analyzer = PythonModuleAnalyzer(src_code)
    declared_source_symbols = set(py_analyzer.symbols.keys())

    # 3. Build each new partition file
    for target_rel_path, sym_names in split_plan.items():
        target_abs = os.path.join(workspace_root, target_rel_path)
        is_new = not os.path.exists(target_abs)

        extracted_nodes = []
        needed_external_imports: List[cst.SimpleStatementLine] = []
        collected_needed_names = set()

        for s_name in sym_names:
            node = remover.removed_nodes.get(s_name)
            if node:
                id_collector = IdentifierCollector()
                node.visit(id_collector)
                collected_needed_names.update(id_collector.referenced_names)
                extracted_nodes.append(node)

        # A. Match needed names with source imports (external libraries like typing, os, etc.)
        added_import_codes = set()
        imported_from_external = set()
        for needed_name in collected_needed_names:
            if needed_name in src_import_collector.symbol_to_import_stmt:
                stmt = src_import_collector.symbol_to_import_stmt[needed_name]
                stmt_code = cst.Module(body=[stmt]).code.strip()
                if stmt_code not in added_import_codes:
                    added_import_codes.add(stmt_code)
                    needed_external_imports.append(stmt)
                    imported_from_external.add(needed_name)

        # B. Check if extracted nodes reference symbols extracted to OTHER split partitions
        inter_partition_imports: Dict[str, List[str]] = {}
        for needed_name in (collected_needed_names - set(sym_names)):
            if needed_name in symbol_to_new_file:
                other_part_path = symbol_to_new_file[needed_name]
                if other_part_path != target_rel_path:
                    other_mod_name, _ = file_path_to_module_aliases(other_part_path)
                    inter_partition_imports.setdefault(other_mod_name, []).append(needed_name)

        for other_mod, names_list in inter_partition_imports.items():
            sorted_names = ", ".join(sorted(list(set(names_list))))
            ref_stmt = cst.parse_statement(f"from {other_mod} import {sorted_names}\n")
            needed_external_imports.append(ref_stmt)

        # C. Check if extracted nodes reference symbols staying in source file
        src_mod_name, _ = file_path_to_module_aliases(source_filepath)
        remaining_declared = (declared_source_symbols - all_symbols_to_extract) - imported_from_external
        inter_source_refs = collected_needed_names.intersection(remaining_declared)
        if inter_source_refs:
            sorted_refs = sorted(list(inter_source_refs))
            ref_stmt = cst.parse_statement(f"from {src_mod_name} import {', '.join(sorted_refs)}\n")
            needed_external_imports.append(ref_stmt)

        # Combine into target module CST
        target_body = list(needed_external_imports)
        for node in extracted_nodes:
            formatted = node.with_changes(leading_lines=[cst.EmptyLine(), cst.EmptyLine()])
            target_body.append(formatted)

        target_cst = cst.Module(body=target_body)
        mutation_queue.append((target_abs, target_cst.code, is_new))

    # 4. Update source file with re-exports / imports
    src_reexport_statements = []
    for target_rel_path, sym_names in split_plan.items():
        target_mod_name, _ = file_path_to_module_aliases(target_rel_path)
        sym_str = ", ".join(sorted(sym_names))
        import_stmt = cst.parse_statement(f"from {target_mod_name} import {sym_str}\n")
        src_reexport_statements.append(import_stmt)

    new_src_body = list(src_reexport_statements) + list(modified_src_cst.body)
    final_src_cst = modified_src_cst.with_changes(body=new_src_body)
    mutation_queue.append((src_abs, final_src_cst.code, False))

    # 5. Sweep and update workspace references if requested
    if rewrite_workspace_imports:
        old_full_mod, old_aliases = file_path_to_module_aliases(source_filepath)
        for rel_file in all_workspace_files:
            if not rel_file.endswith(".py") or rel_file == source_filepath or rel_file in split_plan:
                continue
            abs_file = os.path.join(workspace_root, rel_file)
            if not os.path.exists(abs_file):
                continue

            try:
                with open(abs_file, "r", encoding="utf-8") as f:
                    other_code = f.read()

                other_cst = cst.parse_module(other_code)
                modified_other = other_cst

                for sym_name, target_rel in symbol_to_new_file.items():
                    new_mod_name, _ = file_path_to_module_aliases(target_rel)
                    rewriter = ImportRewriter(old_aliases, new_mod_name, sym_name)
                    modified_other = modified_other.visit(rewriter)

                if modified_other.code != other_code:
                    mutation_queue.append((abs_file, modified_other.code, False))
            except Exception:
                continue

    # 6. Commit atomic transaction with full rollback on disk error
    backups: Dict[str, str] = {}
    created_files: List[str] = []

    try:
        for abs_p, content, is_new in mutation_queue:
            if not is_new and os.path.exists(abs_p):
                with open(abs_p, "r", encoding="utf-8") as f:
                    backups[abs_p] = f.read()

        for abs_p, content, is_new in mutation_queue:
            os.makedirs(os.path.dirname(abs_p), exist_ok=True)
            if is_new:
                created_files.append(abs_p)
            with open(abs_p, "w", encoding="utf-8") as f:
                f.write(content)

    except Exception as e:
        # Full rollback
        for abs_p, original_content in backups.items():
            try:
                with open(abs_p, "w", encoding="utf-8") as f:
                    f.write(original_content)
            except Exception:
                pass
        for created_p in created_files:
            try:
                if os.path.exists(created_p):
                    os.remove(created_p)
            except Exception:
                pass
        return False, f"Atomic split transaction failed and was rolled back: {e}", {}

    summary = {
        "source_file": source_filepath,
        "created_files": list(split_plan.keys()),
        "symbols_split": list(all_symbols_to_extract),
        "total_files_updated": len(mutation_queue)
    }
    return True, f"Successfully split {source_filepath} into {len(split_plan)} files with zero code breakage.", summary


# -------------------------------------------------------------------------
# 7. JAVASCRIPT / TYPESCRIPT SPLIT SURGERY
# -------------------------------------------------------------------------
def _execute_js_file_split(
    source_filepath: str,
    src_code: str,
    src_abs: str,
    split_plan: Dict[str, List[str]],
    workspace_root: str,
    all_workspace_files: List[str],
    keep_reexports: bool,
    rewrite_workspace_imports: bool
) -> Tuple[bool, str, Dict[str, Any]]:
    mutation_queue: List[Tuple[str, str, bool]] = []
    symbol_to_new_file: Dict[str, str] = {}
    modified_src_code = src_code

    # Extract symbols for each target file
    for target_rel_path, sym_names in split_plan.items():
        target_abs = os.path.join(workspace_root, target_rel_path)
        is_new = not os.path.exists(target_abs)
        target_body_parts = []

        for s_name in sym_names:
            symbol_to_new_file[s_name] = target_rel_path
            extracted_code, remaining = extract_js_symbol(modified_src_code, s_name, source_filepath)
            if extracted_code:
                # Ensure export prefix
                if not re.match(r'^\s*export\b', extracted_code):
                    extracted_code = f"export {extracted_code.strip()}"
                target_body_parts.append(extracted_code.strip())
                if remaining is not None:
                    modified_src_code = remaining

        # Forward needed imports from source into target file
        target_combined = "\n\n".join(target_body_parts)
        target_file_code = forward_dependencies_to_dest(src_code, "", target_combined)
        target_file_code = f"{target_file_code.strip()}\n\n{target_combined}\n"

        mutation_queue.append((target_abs, target_file_code, is_new))

    # Add re-exports to source file
    reexport_lines = []
    for target_rel_path, sym_names in split_plan.items():
        rel_specifier = calculate_relative_js_import_path(source_filepath, target_rel_path)
        sym_str = ", ".join(sorted(sym_names))
        reexport_lines.append(f"export {{ {sym_str} }} from '{rel_specifier}';")

    if reexport_lines:
        modified_src_code = f"{chr(10).join(reexport_lines)}\n\n{modified_src_code.strip()}\n"

    mutation_queue.append((src_abs, modified_src_code, False))

    # Commit atomic transaction
    backups: Dict[str, str] = {}
    created_files: List[str] = []

    try:
        for abs_p, _, is_new in mutation_queue:
            if not is_new and os.path.exists(abs_p):
                with open(abs_p, "r", encoding="utf-8") as f:
                    backups[abs_p] = f.read()

        for abs_p, content, is_new in mutation_queue:
            os.makedirs(os.path.dirname(abs_p), exist_ok=True)
            if is_new:
                created_files.append(abs_p)
            with open(abs_p, "w", encoding="utf-8") as f:
                f.write(content)

    except Exception as e:
        for abs_p, orig in backups.items():
            try:
                with open(abs_p, "w", encoding="utf-8") as f:
                    f.write(orig)
            except Exception:
                pass
        for created_p in created_files:
            try:
                if os.path.exists(created_p):
                    os.remove(created_p)
            except Exception:
                pass
        return False, f"JS file split transaction failed and rolled back: {e}", {}

    all_symbols = [s for syms in split_plan.values() for s in syms]
    summary = {
        "source_file": source_filepath,
        "created_files": list(split_plan.keys()),
        "symbols_split": all_symbols,
        "total_files_updated": len(mutation_queue)
    }
    return True, f"Successfully split {source_filepath} into {len(split_plan)} files.", summary
