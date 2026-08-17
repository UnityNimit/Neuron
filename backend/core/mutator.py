# backend/core/mutator.py
import os
import posixpath
from typing import Dict, List, Optional, Set, Tuple
import libcst as cst


# -------------------------------------------------------------------------
# 1. CST VISITORS & TRANSFORMERS
# -------------------------------------------------------------------------
class FunctionReplacer(cst.CSTTransformer):
    """Replaces an in-place function or class definition while preserving exact formatting."""
    def __init__(self, func_name: str, new_node: cst.CSTNode):
        self.func_name = func_name
        self.new_node = new_node
        self.replaced = False

    def leave_FunctionDef(
        self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef
    ) -> cst.CSTNode:
        if original_node.name.value == self.func_name:
            self.replaced = True
            return self.new_node
        return updated_node

    def leave_ClassDef(
        self, original_node: cst.ClassDef, updated_node: cst.ClassDef
    ) -> cst.CSTNode:
        if original_node.name.value == self.func_name:
            self.replaced = True
            return self.new_node
        return updated_node


class SymbolExtractor(cst.CSTTransformer):
    """Extracts a top-level function or class CST node and removes it from the source tree."""
    def __init__(self, symbol_name: str):
        self.symbol_name = symbol_name
        self.extracted_node: Optional[cst.CSTNode] = None

    def leave_FunctionDef(
        self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef
    ) -> cst.CSTNode:
        if original_node.name.value == self.symbol_name:
            self.extracted_node = original_node
            return cst.RemovalSentinel.REMOVE
        return updated_node

    def leave_ClassDef(
        self, original_node: cst.ClassDef, updated_node: cst.ClassDef
    ) -> cst.CSTNode:
        if original_node.name.value == self.symbol_name:
            self.extracted_node = original_node
            return cst.RemovalSentinel.REMOVE
        return updated_node


class ReferenceChecker(cst.CSTVisitor):
    """Checks if a target symbol name is referenced anywhere in a CST tree."""
    def __init__(self, symbol_name: str):
        self.symbol_name = symbol_name
        self.is_referenced = False

    def visit_Name(self, node: cst.Name) -> None:
        if node.value == self.symbol_name:
            self.is_referenced = True


class IdentifierCollector(cst.CSTVisitor):
    """Collects all identifier names referenced inside a CST node."""
    def __init__(self):
        self.referenced_names: Set[str] = set()

    def visit_Name(self, node: cst.Name) -> None:
        self.referenced_names.add(node.value)


class ImportStatementsCollector(cst.CSTVisitor):
    """Collects all top-level import statements and maps imported symbols to their statements."""
    def __init__(self):
        # Map: symbol_name -> cst.SimpleStatementLine (the import statement)
        self.symbol_to_import_stmt: Dict[str, cst.SimpleStatementLine] = {}
        self.all_import_stmts: List[cst.SimpleStatementLine] = []

    def visit_SimpleStatementLine(self, node: cst.SimpleStatementLine) -> None:
        for small_stmt in node.body:
            if isinstance(small_stmt, cst.Import):
                self.all_import_stmts.append(node)
                for alias in small_stmt.names:
                    name = alias.asname.name.value if alias.asname else alias.name.value
                    self.symbol_to_import_stmt[name] = node
            elif isinstance(small_stmt, cst.ImportFrom):
                self.all_import_stmts.append(node)
                if isinstance(small_stmt.names, (list, tuple)):
                    for alias in small_stmt.names:
                        if isinstance(alias, cst.ImportAlias):
                            name = alias.asname.name.value if alias.asname else alias.name.value
                            self.symbol_to_import_stmt[name] = node


class ImportInjector(cst.CSTTransformer):
    """Cleanly injects an import statement after docstrings and __future__ imports."""
    def __init__(self, import_stmt: cst.SimpleStatementLine):
        self.import_stmt = import_stmt
        self.injected = False

    def leave_Module(
        self, original_node: cst.Module, updated_node: cst.Module
    ) -> cst.Module:
        body_list = list(updated_node.body)
        
        # Check if already imported
        new_import_code = cst.Module(body=[self.import_stmt]).code.strip()
        for stmt in body_list:
            if cst.Module(body=[stmt]).code.strip() == new_import_code:
                return updated_node  # Deduplicated

        insert_idx = 0
        for idx, stmt in enumerate(body_list):
            if isinstance(stmt, cst.SimpleStatementLine):
                # Place after existing imports
                if any(isinstance(sub, (cst.Import, cst.ImportFrom)) for sub in stmt.body):
                    insert_idx = idx + 1

        body_list.insert(insert_idx, self.import_stmt)
        return updated_node.with_changes(body=body_list)


class ImportRewriter(cst.CSTTransformer):
    """
    Scans and updates from-import statements across referencing files.
    Transforms:
      from old_module import moved_symbol, other_symbol
    Into:
      from old_module import other_symbol
      from new_module import moved_symbol
    """
    def __init__(self, old_mod_aliases: Set[str], new_mod_name: str, symbol_name: str):
        self.old_mod_aliases = old_mod_aliases
        self.new_mod_name = new_mod_name
        self.symbol_name = symbol_name
        self.needs_new_import_stmt = False

    def leave_ImportFrom(
        self, original_node: cst.ImportFrom, updated_node: cst.ImportFrom
    ) -> cst.CSTNode:
        if not original_node.module:
            return updated_node

        mod_repr = cst.Module(body=[]).code_for_node(original_node.module).strip()
        if mod_repr in self.old_mod_aliases:
            if isinstance(original_node.names, (list, tuple)):
                remaining_aliases = []
                matched = False

                for alias in original_node.names:
                    if isinstance(alias, cst.ImportAlias) and alias.name.value == self.symbol_name:
                        matched = True
                    else:
                        remaining_aliases.append(alias)

                if matched:
                    if len(remaining_aliases) == 0:
                        # Full replacement of the import line
                        return original_node.with_changes(
                            module=cst.parse_expression(self.new_mod_name),
                            names=[cst.ImportAlias(name=cst.Name(self.symbol_name))]
                        )
                    else:
                        # Partial extraction: remove symbol and mark to insert new import statement
                        self.needs_new_import_stmt = True
                        return original_node.with_changes(names=remaining_aliases)

        return updated_node

    def leave_Module(
        self, original_node: cst.Module, updated_node: cst.Module
    ) -> cst.Module:
        if self.needs_new_import_stmt:
            new_import_stmt = cst.parse_statement(
                f"from {self.new_mod_name} import {self.symbol_name}\n"
            )
            body_list = list(updated_node.body)
            
            insert_index = 0
            for idx, stmt in enumerate(body_list):
                if isinstance(stmt, cst.SimpleStatementLine):
                    if any(isinstance(sub, (cst.Import, cst.ImportFrom)) for sub in stmt.body):
                        insert_index = idx + 1

            body_list.insert(insert_index, new_import_stmt)
            return updated_node.with_changes(body=body_list)

        return updated_node


# -------------------------------------------------------------------------
# 2. HELPER FUNCTIONS
# -------------------------------------------------------------------------
def file_path_to_module_aliases(rel_path: str) -> Tuple[str, Set[str]]:
    """
    Converts a relative file path to valid Python import module strings.
    Example: 'src/utils/math_tools.py' -> ('src.utils.math_tools', {'src.utils.math_tools', 'utils.math_tools', 'math_tools'})
    """
    clean = rel_path.replace("\\", "/").lstrip("/")
    if clean.endswith(".py"):
        clean = clean[:-3]
    
    parts = clean.split("/")
    full_module = ".".join(parts)
    aliases = {full_module}
    
    for i in range(len(parts)):
        aliases.add(".".join(parts[i:]))
        
    return full_module, aliases


def update_function_in_file(filepath: str, func_name: str, new_code: str) -> bool:
    """Updates a single function or class in-place using LibCST."""
    if not os.path.exists(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        original_code = f.read()

    try:
        source_tree = cst.parse_module(original_code)
        new_module = cst.parse_module(new_code.strip())
        if not new_module.body:
            return False
        new_func_node = new_module.body[0]
    except Exception as e:
        print(f"[ERROR] CST Parser syntax error: {e}")
        return False

    transformer = FunctionReplacer(func_name, new_func_node)
    modified_tree = source_tree.visit(transformer)

    if not transformer.replaced:
        return False

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(modified_tree.code)

    return True


# -------------------------------------------------------------------------
# 3. ATOMIC SYMBOL REFRACTORING TRANSPLANT ENGINE
# -------------------------------------------------------------------------
def execute_symbol_refactor_transplant(
    source_filepath: str,
    dest_filepath: str,
    symbol_name: str,
    workspace_root: str,
    all_workspace_files: List[str]
) -> Tuple[bool, str]:
    """
    🚀 THE PYTHON AST SURGEON (Lossless Atomic Refactoring)
      1. Extracts and removes symbol from source file CST.
      2. Injects 'from new_module import symbol' into source file if other functions call it.
      3. Copies necessary dependency imports from source file into destination file.
      4. Appends extracted symbol to destination file CST.
      5. Rewrites from-import statements across all referencing workspace files.
      6. Commits all mutated trees to disk with automatic rollback on error.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    dst_abs = os.path.join(workspace_root, dest_filepath)

    if not os.path.exists(src_abs) or not os.path.exists(dst_abs):
        return False, "Source or destination file does not exist on disk."

    clean_symbol = symbol_name.replace("()", "").replace("def ", "").strip().split(".")[-1]

    # 1. READ & BACKUP SOURCE FILE
    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()

    try:
        src_cst = cst.parse_module(src_code)
    except Exception as e:
        return False, f"Failed to parse source file CST: {e}"

    # Extract symbol node and remove from source
    extractor = SymbolExtractor(clean_symbol)
    modified_src_cst = src_cst.visit(extractor)

    if not extractor.extracted_node:
        return False, f"Symbol '{clean_symbol}' not found in top-level scope of {source_filepath}."

    # Collect imports present in source file
    src_import_collector = ImportStatementsCollector()
    src_cst.visit(src_import_collector)

    # Collect identifiers needed by the extracted symbol
    id_collector = IdentifierCollector()
    extractor.extracted_node.visit(id_collector)

    # Compute import aliases
    old_full_mod, old_aliases = file_path_to_module_aliases(source_filepath)
    new_full_mod, _ = file_path_to_module_aliases(dest_filepath)

    # Check if remaining source file still calls clean_symbol
    ref_checker = ReferenceChecker(clean_symbol)
    modified_src_cst.visit(ref_checker)

    if ref_checker.is_referenced:
        # Source file still calls the moved symbol: inject import from new module!
        src_import_stmt = cst.parse_statement(f"from {new_full_mod} import {clean_symbol}\n")
        injector = ImportInjector(src_import_stmt)
        modified_src_cst = modified_src_cst.visit(injector)

    # 2. READ & PARSE DESTINATION FILE
    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    try:
        dst_cst = cst.parse_module(dst_code)
    except Exception as e:
        return False, f"Failed to parse destination file CST: {e}"

    # Copy needed imports into destination file
    modified_dst_cst = dst_cst
    for needed_name in id_collector.referenced_names:
        if needed_name in src_import_collector.symbol_to_import_stmt:
            needed_stmt = src_import_collector.symbol_to_import_stmt[needed_name]
            dst_injector = ImportInjector(needed_stmt)
            modified_dst_cst = modified_dst_cst.visit(dst_injector)

    # Format extracted node with leading empty lines for clean PEP-8 spacing
    formatted_node = extractor.extracted_node.with_changes(
        leading_lines=[cst.EmptyLine(), cst.EmptyLine()]
    )
    new_dst_body = list(modified_dst_cst.body) + [formatted_node]
    modified_dst_cst = modified_dst_cst.with_changes(body=new_dst_body)

    # 3. SWEEP & REWRITE IMPORTS ACROSS ALL REFERENCING WORKSPACE FILES
    file_mutation_queue: List[Tuple[str, str]] = [
        (src_abs, modified_src_cst.code),
        (dst_abs, modified_dst_cst.code)
    ]

    for rel_file in all_workspace_files:
        if not rel_file.endswith(".py"):
            continue
        if rel_file in [source_filepath, dest_filepath]:
            continue

        abs_file = os.path.join(workspace_root, rel_file)
        if not os.path.exists(abs_file):
            continue

        try:
            with open(abs_file, "r", encoding="utf-8") as f:
                other_code = f.read()

            other_cst = cst.parse_module(other_code)
            import_rewriter = ImportRewriter(old_aliases, new_full_mod, clean_symbol)
            transformed_other_cst = other_cst.visit(import_rewriter)

            if transformed_other_cst.code != other_code:
                file_mutation_queue.append((abs_file, transformed_other_cst.code))
        except Exception:
            continue

    # 4. ATOMIC TRANSACTION COMMIT (With In-Memory Rollback on Disk Error)
    backups: Dict[str, str] = {}
    try:
        # Create in-memory backups
        for target_abs, _ in file_mutation_queue:
            with open(target_abs, "r", encoding="utf-8") as f:
                backups[target_abs] = f.read()

        # Atomic commit
        for target_abs, mutated_code in file_mutation_queue:
            with open(target_abs, "w", encoding="utf-8") as f:
                f.write(mutated_code)

    except Exception as e:
        # Rollback all modified files to original state
        for target_abs, original_text in backups.items():
            try:
                with open(target_abs, "w", encoding="utf-8") as f:
                    f.write(original_text)
            except Exception:
                pass
        return False, f"Atomic transaction aborted and rolled back: {e}"

    return True, f"Successfully refactored '{clean_symbol}' from {source_filepath} to {dest_filepath} across {len(file_mutation_queue)} files."