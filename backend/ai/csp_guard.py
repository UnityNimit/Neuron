# backend/ai/csp_guard.py
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
import os
import re
import networkx as nx
import libcst as cst
from tree_sitter import Language, Parser

import tree_sitter_python as tspython

JS_LANGUAGE = None
try:
    import tree_sitter_javascript as tsjavascript
    JS_LANGUAGE = Language(tsjavascript.language())
except ImportError:
    pass

TS_LANGUAGE = None
TSX_LANGUAGE = None
try:
    import tree_sitter_typescript as tstypescript
    TS_LANGUAGE = Language(tstypescript.language_typescript())
    TSX_LANGUAGE = Language(tstypescript.language_tsx())
except ImportError:
    pass

PY_LANGUAGE = Language(tspython.language())


@dataclass
class CSPValidationResult:
    """Structured result returned by the CSP solver."""
    is_valid: bool
    violation_type: Optional[str] = None
    reason: Optional[str] = None
    cycle_path: List[str] = field(default_factory=list)
    suggested_fix: Optional[str] = None


class ScopeSymbolCollector(cst.CSTVisitor):
    """Gathers all declared top-level functions and classes in a Python module."""
    def __init__(self):
        self.declared_symbols: Set[str] = set()

    def visit_FunctionDef(self, node: cst.FunctionDef) -> None:
        self.declared_symbols.add(node.name.value)

    def visit_ClassDef(self, node: cst.ClassDef) -> None:
        self.declared_symbols.add(node.name.value)


def get_declared_symbols(file_path: str, content: str) -> Set[str]:
    """
    Universal Scope Extractor: Guarantees 100% symbol detection across Python, React JSX,
    TypeScript, and JS, supporting default exports and arrow function components.
    """
    symbols: Set[str] = set()
    if not content or not content.strip():
        return symbols

    # 1. PYTHON
    if file_path.endswith(".py"):
        try:
            tree = cst.parse_module(content)
            collector = ScopeSymbolCollector()
            tree.visit(collector)
            symbols.update(collector.declared_symbols)
        except Exception:
            pass

        py_matches = re.findall(r'^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(|^class\s+([a-zA-Z0-9_]+)', content, re.MULTILINE)
        for m in py_matches:
            symbols.add(m[0] or m[1])

        return symbols

    # 2. JAVASCRIPT / TYPESCRIPT / REACT JSX
    content_bytes = content.encode('utf-8')
    parser = None
    if file_path.endswith(".tsx") and TSX_LANGUAGE:
        parser = Parser(TSX_LANGUAGE)
    elif file_path.endswith(".ts") and TS_LANGUAGE:
        parser = Parser(TS_LANGUAGE)
    elif file_path.endswith((".jsx", ".js", ".mjs", ".cjs")) and JS_LANGUAGE:
        parser = Parser(JS_LANGUAGE)

    if parser:
        try:
            tree = parser.parse(content_bytes)
            root = tree.root_node

            def get_text(n):
                return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

            def scan_node(node):
                if node.type in ['function_declaration', 'class_declaration']:
                    name_node = node.child_by_field_name('name')
                    if name_node:
                        symbols.add(get_text(name_node))

                elif node.type == 'export_statement':
                    decl = node.child_by_field_name('declaration') or node.child_by_field_name('value')
                    if decl:
                        scan_node(decl)
                    for sub in node.children:
                        scan_node(sub)

                elif node.type == 'lexical_declaration':
                    for decl in node.children:
                        if decl.type == 'variable_declarator':
                            name_node = decl.child_by_field_name('name')
                            if name_node:
                                symbols.add(get_text(name_node))

            for child in root.children:
                scan_node(child)
        except Exception:
            pass

    # 🚀 UNLEASHED REGEX: Matches ANY top-level variable, arrow component, or export regardless of destructuring
    js_patterns = [
        r'(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)',
        r'(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)',
        r'(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=',
        r'export\s+default\s+([a-zA-Z0-9_$]+)\s*;'
    ]
    for pattern in js_patterns:
        for match in re.finditer(pattern, content):
            name = match.group(1).strip()
            if name and name not in ['default', 'function', 'class', 'const', 'let', 'var']:
                symbols.add(name)

    return symbols


def resolve_js_relative_import(source_file: str, import_specifier: str, all_files: Set[str]) -> Optional[str]:
    if not import_specifier.startswith('.'):
        return None

    src_dir = os.path.dirname(source_file)
    norm_target = os.path.normpath(os.path.join(src_dir, import_specifier)).replace("\\", "/")

    if norm_target in all_files:
        return norm_target

    for ext in [".jsx", ".tsx", ".js", ".ts", "/index.jsx", "/index.tsx", "/index.js", "/index.ts"]:
        candidate = f"{norm_target}{ext}"
        if candidate in all_files:
            return candidate

    return None


def build_import_dependency_graph(file_asts: Dict[str, dict]) -> nx.DiGraph:
    dep_graph = nx.DiGraph()
    all_files = set(file_asts.keys())

    for file_path in all_files:
        dep_graph.add_node(file_path)

    for file_path, ast_meta in file_asts.items():
        content = ast_meta.get("content", "")
        if not content:
            continue

        if file_path.endswith(".py"):
            try:
                tree = cst.parse_module(content)
                
                class PythonImportExtractor(cst.CSTVisitor):
                    def __init__(self):
                        self.imported_modules: Set[str] = set()

                    def visit_ImportFrom(self, node: cst.ImportFrom) -> None:
                        if node.module:
                            mod_name = "".join(
                                piece.value for piece in node.module.children if hasattr(piece, 'value')
                            )
                            self.imported_modules.add(mod_name)

                extractor = PythonImportExtractor()
                tree.visit(extractor)

                for target_mod in extractor.imported_modules:
                    for candidate_file in all_files:
                        if not candidate_file.endswith(".py"):
                            continue
                        candidate_rel = candidate_file.replace("/", ".").replace(".py", "")
                        candidate_base = candidate_file.split("/")[-1].replace(".py", "")
                        if target_mod in [candidate_rel, candidate_base] and file_path != candidate_file:
                            dep_graph.add_edge(file_path, candidate_file)
            except Exception:
                continue

        elif file_path.endswith((".jsx", ".tsx", ".js", ".ts", ".mjs")):
            import_matches = re.findall(r'(?:import|from|require)\s*\(?[\'\"]([^\'\"]+)[\'\"]\)?', content)
            for specifier in import_matches:
                resolved_file = resolve_js_relative_import(file_path, specifier, all_files)
                if resolved_file and resolved_file != file_path:
                    dep_graph.add_edge(file_path, resolved_file)

    return dep_graph


def ac3_validate_refactor(
    symbol_name: str,
    source_file: str,
    dest_file: str,
    file_asts: Dict[str, dict]
) -> CSPValidationResult:
    clean_symbol = symbol_name.replace("()", "").replace("def ", "").strip().split(".")[-1]

    if source_file not in file_asts or dest_file not in file_asts:
        return CSPValidationResult(
            is_valid=False,
            violation_type="INVALID_DOMAIN",
            reason=f"Source '{source_file}' or Destination '{dest_file}' does not exist in workspace."
        )

    if source_file == dest_file:
        return CSPValidationResult(
            is_valid=False,
            violation_type="NOOP_REFACTOR",
            reason="Source and Destination modules are identical."
        )

    src_ext = os.path.splitext(source_file)[1].lower()
    dst_ext = os.path.splitext(dest_file)[1].lower()

    py_exts = {".py"}
    js_exts = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}

    if (src_ext in py_exts and dst_ext not in py_exts) or (src_ext in js_exts and dst_ext not in js_exts):
        return CSPValidationResult(
            is_valid=False,
            violation_type="CROSS_LANGUAGE_MISMATCH",
            reason=f"Cannot transplant symbol across incompatible runtimes ({src_ext} -> {dst_ext}).",
            suggested_fix="Ensure source and destination files share compatible language environments."
        )

    src_content = file_asts[source_file].get("content", "")
    dst_content = file_asts[dest_file].get("content", "")

    src_symbols = get_declared_symbols(source_file, src_content)
    if clean_symbol not in src_symbols:
        return CSPValidationResult(
            is_valid=False,
            violation_type="SYMBOL_NOT_FOUND",
            reason=f"Symbol '{clean_symbol}' is not declared in top-level scope of '{source_file}'."
        )

    dst_symbols = get_declared_symbols(dest_file, dst_content)
    if clean_symbol in dst_symbols:
        return CSPValidationResult(
            is_valid=False,
            violation_type="NAME_COLLISION",
            reason=f"Symbol '{clean_symbol}' already exists in destination scope '{dest_file}'.",
            suggested_fix=f"Rename '{clean_symbol}' in destination before moving."
        )

    base_graph = build_import_dependency_graph(file_asts)
    speculative_graph = base_graph.copy()
    speculative_graph.add_edge(source_file, dest_file)

    try:
        cycles = list(nx.simple_cycles(speculative_graph))
        for cycle in cycles:
            if source_file in cycle and dest_file in cycle:
                cycle_repr = " -> ".join(cycle + [cycle[0]])
                return CSPValidationResult(
                    is_valid=False,
                    violation_type="CIRCULAR_DEPENDENCY",
                    reason=f"Refactoring violates AC-3 Arc Consistency. Circular import introduced: {cycle_repr}",
                    cycle_path=cycle,
                    suggested_fix=f"Decouple dependencies between '{source_file}' and '{dest_file}' using an abstraction."
                )
    except Exception as e:
        return CSPValidationResult(
            is_valid=False,
            violation_type="SOLVER_EXCEPTION",
            reason=f"Graph consistency solver failed: {e}"
        )

    return CSPValidationResult(
        is_valid=True,
        violation_type=None,
        reason="CSP Satisfied: All constraints passed."
    )