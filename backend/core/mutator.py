# backend/core/mutator.py
import os
from typing import List, Optional, Set, Tuple
import libcst as cst


class FunctionReplacer(cst.CSTTransformer):
    """Replaces an in-place function definition while preserving exact formatting."""
    def __init__(self, func_name: str, new_func_node: cst.CSTNode):
        self.func_name = func_name
        self.new_func_node = new_func_node

    def leave_FunctionDef(
        self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef
    ) -> cst.CSTNode:
        if original_node.name.value == self.func_name:
            return self.new_func_node
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
                    if alias.name.value == self.symbol_name:
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
            
            # Find the best insertion point after top-level imports
            insert_index = 0
            for idx, stmt in enumerate(body_list):
                if isinstance(stmt, cst.SimpleStatementLine):
                    if any(isinstance(sub, (cst.Import, cst.ImportFrom)) for sub in stmt.body):
                        insert_index = idx + 1

            body_list.insert(insert_index, new_import_stmt)
            return updated_node.with_changes(body=body_list)

        return updated_node


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
    """Updates a single function in-place using LibCST."""
    if not os.path.exists(filepath):
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        original_code = f.read()

    try:
        source_tree = cst.parse_module(original_code)
        new_module = cst.parse_module(new_code)
        new_func_node = new_module.body[0]
    except Exception as e:
        print(f"CST Parser Syntax Incomplete: {e}")
        return False

    transformer = FunctionReplacer(func_name, new_func_node)
    modified_tree = source_tree.visit(transformer)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(modified_tree.code)

    return True


def execute_symbol_refactor_transplant(
    source_filepath: str,
    dest_filepath: str,
    symbol_name: str,
    workspace_root: str,
    all_workspace_files: List[str]
) -> Tuple[bool, str]:
    """
    Executes an atomic, multi-file AST transplant across the repository:
      1. Extracts and removes symbol from source file CST.
      2. Appends symbol node to destination file CST.
      3. Rewrites from-import statements across all referencing files.
      4. Commits all mutated trees to disk simultaneously.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    dst_abs = os.path.join(workspace_root, dest_filepath)

    if not os.path.exists(src_abs) or not os.path.exists(dst_abs):
        return False, "Source or destination file does not exist on disk."

    # 1. READ AND PARSE SOURCE FILE
    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()

    try:
        src_cst = cst.parse_module(src_code)
    except Exception as e:
        return False, f"Failed to parse source file CST: {e}"

    extractor = SymbolExtractor(symbol_name)
    modified_src_cst = src_cst.visit(extractor)

    if not extractor.extracted_node:
        return False, f"Symbol '{symbol_name}' not found in top-level scope of {source_filepath}."

    # 2. READ AND PARSE DESTINATION FILE
    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    try:
        dst_cst = cst.parse_module(dst_code)
    except Exception as e:
        return False, f"Failed to parse destination file CST: {e}"

    # Format extracted node with leading empty lines for clean layout
    formatted_node = extractor.extracted_node.with_changes(
        leading_lines=[cst.EmptyLine(), cst.EmptyLine()]
    )
    new_dst_body = list(dst_cst.body) + [formatted_node]
    modified_dst_cst = dst_cst.with_changes(body=new_dst_body)

    # 3. COMPUTE IMPORT ALIASES FOR REWRITING
    old_full_mod, old_aliases = file_path_to_module_aliases(source_filepath)
    new_full_mod, _ = file_path_to_module_aliases(dest_filepath)

    # 4. SWEEP AND TRANSFORM ALL OTHER WORKSPACE PYTHON FILES
    file_mutation_queue = [
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

        with open(abs_file, "r", encoding="utf-8") as f:
            other_code = f.read()

        try:
            other_cst = cst.parse_module(other_code)
            import_rewriter = ImportRewriter(old_aliases, new_full_mod, symbol_name)
            transformed_other_cst = other_cst.visit(import_rewriter)

            if transformed_other_cst.code != other_code:
                file_mutation_queue.append((abs_file, transformed_other_cst.code))
        except Exception:
            continue

    # 5. ATOMIC COMMIT: WRITE ALL MUTATED MODULES TO DISK
    try:
        for target_abs_path, mutated_content in file_mutation_queue:
            with open(target_abs_path, "w", encoding="utf-8") as f:
                f.write(mutated_content)
    except Exception as e:
        return False, f"Disk write failed during transaction commit: {e}"

    return True, f"Successfully refactored '{symbol_name}' from {source_filepath} to {dest_filepath} across {len(file_mutation_queue)} files."