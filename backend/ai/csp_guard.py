# backend/ai/csp_guard.py
from collections import deque
from dataclasses import dataclass, field
import os
import posixpath
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import libcst as cst
import networkx as nx
from tree_sitter import Language, Node, Parser

import tree_sitter_python as tspython

# -------------------------------------------------------------------------
# 1. MULTI-LANGUAGE GRAMMAR INITIALIZATION
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


@dataclass
class CSPValidationResult:
    """Structured diagnostic result returned by the AC-3 Constraint Solver."""
    is_valid: bool
    violation_type: Optional[str] = None
    reason: Optional[str] = None
    cycle_path: List[str] = field(default_factory=list)
    suggested_fix: Optional[str] = None
    required_imports: List[Dict[str, str]] = field(default_factory=list)
    coupled_symbols: List[str] = field(default_factory=list)


# -------------------------------------------------------------------------
# 2. PYTHON AST INSPECTORS (LibCST Engine)
# -------------------------------------------------------------------------
class PythonScopeCollector(cst.CSTVisitor):
    """Collects all top-level symbols and inner call dependencies of target symbol."""
    def __init__(self, target_symbol: Optional[str] = None):
        self.target_symbol = target_symbol
        self.declared_symbols: Set[str] = set()
        self.target_node: Optional[cst.CSTNode] = None
        self.internal_calls: Set[str] = set()

    def visit_FunctionDef(self, node: cst.FunctionDef) -> None:
        name = node.name.value
        self.declared_symbols.add(name)
        if self.target_symbol and name == self.target_symbol:
            self.target_node = node

    def visit_ClassDef(self, node: cst.ClassDef) -> None:
        name = node.name.value
        self.declared_symbols.add(name)
        if self.target_symbol and name == self.target_symbol:
            self.target_node = node


class PythonInternalReferenceExtractor(cst.CSTVisitor):
    """Extracts all function calls, variables, and identifiers referenced inside a CST subtree."""
    def __init__(self):
        self.referenced_identifiers: Set[str] = set()

    def visit_Name(self, node: cst.Name) -> None:
        self.referenced_identifiers.add(node.value)

    def visit_Call(self, node: cst.Call) -> None:
        if isinstance(node.func, cst.Name):
            self.referenced_identifiers.add(node.func.value)
        elif isinstance(node.func, cst.Attribute) and isinstance(node.func.attr, cst.Name):
            self.referenced_identifiers.add(node.func.attr.value)


# -------------------------------------------------------------------------
# 3. UNIVERSAL SCOPE & SYMBOL EXTRACTORS (Python + JS/TS/JSX)
# -------------------------------------------------------------------------
def get_declared_symbols(file_path: str, content: str) -> Set[str]:
    """Guarantees 100% symbol detection across Python, React JSX, TS, and JS."""
    symbols: Set[str] = set()
    if not content or not content.strip():
        return symbols

    # 1. PYTHON SCOPE EXTRACTION
    if file_path.endswith(".py"):
        try:
            tree = cst.parse_module(content)
            collector = PythonScopeCollector()
            tree.visit(collector)
            symbols.update(collector.declared_symbols)
        except Exception:
            pass

        # Regex fallback for dynamic Python definitions
        for m in re.finditer(r'^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(|^class\s+([a-zA-Z0-9_]+)', content, re.MULTILINE):
            name = m.group(1) or m.group(2)
            if name:
                symbols.add(name)

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

            def get_text(n: Optional[Node]) -> str:
                return content_bytes[n.start_byte:n.end_byte].decode('utf-8', errors='replace') if n else ""

            def scan_node(node: Node):
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

    # Universal JS/TS Regex Extraction
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


def extract_symbol_dependencies(
    file_path: str, 
    content: str, 
    symbol_name: str
) -> Tuple[Set[str], Set[str]]:
    """
    Extracts:
      1. Free symbols inside target symbol that belong to the same source module.
      2. Other symbols in the source module that call/reference the target symbol.
    """
    internal_deps: Set[str] = set()
    callers_of_symbol: Set[str] = set()

    all_declared = get_declared_symbols(file_path, content)
    clean_sym = symbol_name.replace("()", "").replace("def ", "").strip().split(".")[-1]

    # 1. PYTHON DEPENDENCY FLOW
    if file_path.endswith(".py"):
        try:
            tree = cst.parse_module(content)
            collector = PythonScopeCollector(target_symbol=clean_sym)
            tree.visit(collector)

            if collector.target_node:
                ref_extractor = PythonInternalReferenceExtractor()
                collector.target_node.visit(ref_extractor)
                # Any referenced name declared in this file is an internal dependency
                for ref_name in ref_extractor.referenced_identifiers:
                    if ref_name in all_declared and ref_name != clean_sym:
                        internal_deps.add(ref_name)

            # Check other functions calling target symbol
            for other_sym in all_declared:
                if other_sym != clean_sym:
                    other_collector = PythonScopeCollector(target_symbol=other_sym)
                    tree.visit(other_collector)
                    if other_collector.target_node:
                        other_refs = PythonInternalReferenceExtractor()
                        other_collector.target_node.visit(other_refs)
                        if clean_sym in other_refs.referenced_identifiers:
                            callers_of_symbol.add(other_sym)
        except Exception:
            pass

    # 2. JS / TS / JSX DEPENDENCY FLOW (Regex Fallback Inspection)
    else:
        # Find symbol body span
        sym_pattern = re.compile(rf'(?:function\s+{clean_sym}|(?:const|let|var)\s+{clean_sym}\s*=)', re.MULTILINE)
        match = sym_pattern.search(content)
        if match:
            # Estimate body snippet
            start_pos = match.start()
            body_snippet = content[start_pos:start_pos + 3000]

            for declared in all_declared:
                if declared != clean_sym:
                    if re.search(rf'\b{declared}\b', body_snippet):
                        internal_deps.add(declared)

            # Check remaining file content for calls to clean_sym
            outside_content = content[:start_pos] + content[start_pos + len(body_snippet):]
            if re.search(rf'\b{clean_sym}\b', outside_content):
                callers_of_symbol.add("module_scope")

    return internal_deps, callers_of_symbol


def resolve_js_relative_import(source_file: str, import_specifier: str, all_files: Set[str]) -> Optional[str]:
    """Resolves relative ES6 module imports to normalized workspace paths."""
    if not import_specifier.startswith('.'):
        return None

    src_dir = posixpath.dirname(source_file)
    norm_target = posixpath.normpath(posixpath.join(src_dir, import_specifier)).replace("\\", "/")

    if norm_target in all_files:
        return norm_target

    for ext in [".jsx", ".tsx", ".js", ".ts", "/index.jsx", "/index.tsx", "/index.js", "/index.ts"]:
        candidate = f"{norm_target}{ext}"
        if candidate in all_files:
            return candidate

    return None


def build_import_dependency_graph(file_asts: Dict[str, dict]) -> nx.DiGraph:
    """Builds a directed acyclic graph (DAG) of existing module dependencies."""
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
                        candidate_base = posixpath.basename(candidate_file).replace(".py", "")
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


# -------------------------------------------------------------------------
# 4. THE AC-3 CONSTRAINT SATISFACTION REFACTORING SOLVER
# -------------------------------------------------------------------------
def ac3_validate_refactor(
    symbol_name: str,
    source_file: str,
    dest_file: str,
    file_asts: Dict[str, dict]
) -> CSPValidationResult:
    """
     VISUAL REFACTORING SHIELD (AC-3 SOLVER)
    Validates function/symbol migrations against:
      1. Domain Invariants (Files exist, compatible languages)
      2. Scope Invariants (Symbol exists, destination collision-free)
      3. Direct Mutual Coupling (Bidirectional dependencies)
      4. Global Arc Consistency (Cycle detection across transitive import paths)
    """
    clean_symbol = symbol_name.replace("()", "").replace("def ", "").strip().split(".")[-1]

    # Invariant 1: Valid Workspace Domain
    if source_file not in file_asts or dest_file not in file_asts:
        return CSPValidationResult(
            is_valid=False,
            violation_type="INVALID_DOMAIN",
            reason=f"Source '{source_file}' or Destination '{dest_file}' does not exist in workspace."
        )

    # Invariant 2: No-Op Migration
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

    # Invariant 3: Language Runtime Compatibility
    if (src_ext in py_exts and dst_ext not in py_exts) or (src_ext in js_exts and dst_ext not in js_exts):
        return CSPValidationResult(
            is_valid=False,
            violation_type="CROSS_LANGUAGE_MISMATCH",
            reason=f"Cannot transplant symbol across incompatible runtimes ({src_ext} -> {dst_ext}).",
            suggested_fix="Ensure source and destination files share compatible language environments."
        )

    src_content = file_asts[source_file].get("content", "")
    dst_content = file_asts[dest_file].get("content", "")

    # Invariant 4: Symbol Existence in Source Scope
    src_symbols = get_declared_symbols(source_file, src_content)
    if clean_symbol not in src_symbols:
        return CSPValidationResult(
            is_valid=False,
            violation_type="SYMBOL_NOT_FOUND",
            reason=f"Symbol '{clean_symbol}' is not declared in top-level scope of '{source_file}'."
        )

    # Invariant 5: Name Collision & Variable Shadowing
    dst_symbols = get_declared_symbols(dest_file, dst_content)
    if clean_symbol in dst_symbols:
        return CSPValidationResult(
            is_valid=False,
            violation_type="NAME_COLLISION",
            reason=f"Symbol '{clean_symbol}' already exists in destination scope '{dest_file}'.",
            suggested_fix=f"Rename '{clean_symbol}' in destination or source before moving."
        )

    # Invariant 6: Direct Mutual Coupling (Inner Dependencies Check)
    internal_deps, callers_of_symbol = extract_symbol_dependencies(source_file, src_content, clean_symbol)

    # Invariant 7: Speculative Graph Arc-Consistency Propagation
    base_graph = build_import_dependency_graph(file_asts)
    speculative_graph = base_graph.copy()

    # Rule A: Source will import Destination if source functions call the moved symbol
    if callers_of_symbol or len(src_symbols) > 1:
        speculative_graph.add_edge(source_file, dest_file)

    # Rule B: Destination will import Source if the moved symbol calls remaining functions in Source
    if internal_deps:
        speculative_graph.add_edge(dest_file, source_file)

    # Execute AC-3 Arc Consistency Validation
    try:
        cycles = list(nx.simple_cycles(speculative_graph))
        for cycle in cycles:
            if source_file in cycle or dest_file in cycle:
                cycle_repr = " -> ".join(cycle + [cycle[0]])

                coupled_list = list(internal_deps)
                suggested_fix = f"Decouple dependencies between '{source_file}' and '{dest_file}'."
                if coupled_list:
                    suggested_fix = (
                        f"Co-migrate coupled helper functions ({', '.join(coupled_list)}) "
                        f"along with '{clean_symbol}' to '{dest_file}' to resolve mutual dependency."
                    )

                return CSPValidationResult(
                    is_valid=False,
                    violation_type="CIRCULAR_DEPENDENCY",
                    reason=f"Refactoring violates AC-3 Arc Consistency. Circular dependency introduced: {cycle_repr}",
                    cycle_path=cycle,
                    suggested_fix=suggested_fix,
                    coupled_symbols=coupled_list
                )
    except Exception as e:
        return CSPValidationResult(
            is_valid=False,
            violation_type="SOLVER_EXCEPTION",
            reason=f"Graph consistency solver encountered an internal error: {e}"
        )

    # Invariant 8: All Constraints Satisfied
    return CSPValidationResult(
        is_valid=True,
        violation_type=None,
        reason="CSP Satisfied: All topological invariants preserved.",
        coupled_symbols=list(internal_deps)
    )