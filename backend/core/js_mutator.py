# backend/core/js_mutator.py
import os
import re
from typing import Dict, List, Optional, Set, Tuple
from tree_sitter import Language, Parser

import tree_sitter_python as tspython

# Multi-Language Grammar Loaders
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


def get_tree_sitter_parser_for_file(filepath: str) -> Optional[Parser]:
    """Returns the optimal Tree-Sitter parser instance for a given file extension."""
    if filepath.endswith(".tsx") and TSX_LANGUAGE:
        return Parser(TSX_LANGUAGE)
    elif filepath.endswith(".ts") and TS_LANGUAGE:
        return Parser(TS_LANGUAGE)
    elif filepath.endswith((".jsx", ".js", ".mjs", ".cjs")) and JS_LANGUAGE:
        return Parser(JS_LANGUAGE)
    elif JS_LANGUAGE:
        return Parser(JS_LANGUAGE)
    return None


def calculate_relative_js_import_path(importer_rel_path: str, target_rel_path: str) -> str:
    """
    Calculates the exact relative ES6 import module specifier between two files.
    Example:
      importer: 'src/pages/Docs.jsx'
      target:   'src/components/GlassPanel.jsx'
      Output:   '../components/GlassPanel'
    """
    importer_dir = os.path.dirname(importer_rel_path)
    target_dir = os.path.dirname(target_rel_path)
    
    rel_dir = os.path.relpath(target_dir, importer_dir).replace("\\", "/")
    
    # Strip extension for standard JS/TS import conventions
    target_base = os.path.splitext(os.path.basename(target_rel_path))[0]
    if target_base == "index":
        target_import = rel_dir
    else:
        target_import = os.path.join(rel_dir, target_base).replace("\\", "/")
        
    if not target_import.startswith("."):
        target_import = f"./{target_import}"
        
    return target_import


def extract_symbol_regex_fallback(content: str, symbol_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Deterministic bracket-counting fallback extractor for complex JSX/TSX patterns.
    """
    patterns = [
        rf'(?:export\s+default\s+)?(?:export\s+)?(?:async\s+)?function\s+{re.escape(symbol_name)}\s*\(',
        rf'(?:export\s+default\s+)?(?:export\s+)?(?:const|let|var)\s+{re.escape(symbol_name)}\s*=',
        rf'(?:export\s+default\s+)?(?:export\s+)?class\s+{re.escape(symbol_name)}\b'
    ]

    start_idx = -1
    for p in patterns:
        m = re.search(p, content)
        if m:
            start_idx = m.start()
            break

    if start_idx == -1:
        return None, None

    # Track nested braces to find exact closing boundary
    brace_depth = 0
    in_block = False
    end_idx = len(content)

    for i in range(start_idx, len(content)):
        char = content[i]
        if char == '{':
            brace_depth += 1
            in_block = True
        elif char == '}':
            brace_depth -= 1
            if in_block and brace_depth == 0:
                end_idx = i + 1
                # Consume optional trailing semicolon
                if end_idx < len(content) and content[end_idx] == ';':
                    end_idx += 1
                break

    extracted = content[start_idx:end_idx].strip()
    remaining = (content[:start_idx] + content[end_idx:]).strip() + "\n"
    remaining = re.sub(r"\n{3,}", "\n\n", remaining)

    if not extracted.startswith("export "):
        extracted = f"export {extracted}"

    return extracted, remaining


def extract_js_symbol(
    content: str, symbol_name: str, filepath: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts a top-level function, arrow component, or class from JS/JSX/TSX code
    using Tree-Sitter AST with automatic regex fallback.
    """
    parser = get_tree_sitter_parser_for_file(filepath)
    if not parser or not content.strip():
        return extract_symbol_regex_fallback(content, symbol_name)

    content_bytes = content.encode("utf-8")
    try:
        tree = parser.parse(content_bytes)
        root = tree.root_node
    except Exception:
        return extract_symbol_regex_fallback(content, symbol_name)

    def get_text(n) -> str:
        return content_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace") if n else ""

    target_byte_range: Optional[Tuple[int, int]] = None
    extracted_text: Optional[str] = None

    for child in root.children:
        # 1. function myFunc() {} or class MyClass {}
        if child.type in ["function_declaration", "class_declaration"]:
            name_node = child.child_by_field_name("name")
            if name_node and get_text(name_node) == symbol_name:
                target_byte_range = (child.start_byte, child.end_byte)
                extracted_text = get_text(child)
                break

        # 2. export default function / export function / export const
        elif child.type == "export_statement":
            decl = child.child_by_field_name("declaration") or child.child_by_field_name("value")
            if decl:
                if decl.type in ["function_declaration", "class_declaration"]:
                    name_node = decl.child_by_field_name("name")
                    if name_node and get_text(name_node) == symbol_name:
                        target_byte_range = (child.start_byte, child.end_byte)
                        extracted_text = get_text(child)
                        break
                elif decl.type == "lexical_declaration":
                    for d in decl.children:
                        if d.type == "variable_declarator":
                            name_node = d.child_by_field_name("name")
                            if name_node and get_text(name_node) == symbol_name:
                                target_byte_range = (child.start_byte, child.end_byte)
                                extracted_text = get_text(child)
                                break

            # Check sub-children directly
            for sub in child.children:
                if sub.type in ["function_declaration", "class_declaration"]:
                    name_node = sub.child_by_field_name("name")
                    if name_node and get_text(name_node) == symbol_name:
                        target_byte_range = (child.start_byte, child.end_byte)
                        extracted_text = get_text(child)
                        break
                elif sub.type == "lexical_declaration":
                    for d in sub.children:
                        if d.type == "variable_declarator":
                            name_node = d.child_by_field_name("name")
                            if name_node and get_text(name_node) == symbol_name:
                                target_byte_range = (child.start_byte, child.end_byte)
                                extracted_text = get_text(child)
                                break

        # 3. const MyComponent = () => {}
        elif child.type == "lexical_declaration":
            for decl in child.children:
                if decl.type == "variable_declarator":
                    name_node = decl.child_by_field_name("name")
                    if name_node and get_text(name_node) == symbol_name:
                        target_byte_range = (child.start_byte, child.end_byte)
                        extracted_text = get_text(child)
                        break

        if target_byte_range:
            break

    if not target_byte_range or not extracted_text:
        return extract_symbol_regex_fallback(content, symbol_name)

    start_b, end_b = target_byte_range
    new_bytes = content_bytes[:start_b] + content_bytes[end_b:]
    remaining_code = new_bytes.decode("utf-8", errors="replace")
    remaining_code = re.sub(r"\n{3,}", "\n\n", remaining_code).strip() + "\n"

    clean_extracted = extracted_text.strip()
    if not clean_extracted.startswith("export "):
        clean_extracted = f"export {clean_extracted}"

    return clean_extracted, remaining_code


def inject_js_symbol(dest_content: str, symbol_code: str) -> str:
    """Appends an extracted symbol to destination JS/TS module with clean spacing."""
    clean_dst = dest_content.strip()
    if not clean_dst:
        return f"{symbol_code.strip()}\n"
    return f"{clean_dst}\n\n{symbol_code.strip()}\n"


def rewrite_js_imports_in_content(
    file_content: str,
    symbol_name: str,
    old_target_file: str,
    new_target_file: str,
    current_file_path: str
) -> str:
    """
    Surgically rewrites named and default imports across files.
    """
    if not file_content.strip():
        return file_content

    curr_dir = os.path.dirname(current_file_path)
    old_target_norm = os.path.normpath(old_target_file).replace("\\", "/")
    old_target_no_ext = os.path.splitext(old_target_norm)[0]

    updated_content = file_content
    needs_new_import = False

    # 1. Regex Sweep for Named Imports: import { A, symbol_name, B } from './old'
    import_named_pattern = re.compile(r'import\s+\{([^}]+)\}\s+from\s+[\'\"]([^\'\"]+)[\'\"]\s*;?', re.MULTILINE)
    
    def replace_named_import(match):
        nonlocal needs_new_import
        symbols_str = match.group(1)
        specifier = match.group(2)
        
        resolved = os.path.normpath(os.path.join(curr_dir, specifier)).replace("\\", "/")
        resolved_no_ext = os.path.splitext(resolved)[0]

        if resolved_no_ext == old_target_no_ext or resolved == old_target_norm:
            symbols = [s.strip() for s in symbols_str.split(",") if s.strip()]
            if symbol_name in symbols:
                needs_new_import = True
                remaining = [s for s in symbols if s != symbol_name]
                if not remaining:
                    return ""  # Remove empty import line completely
                return f"import {{ {', '.join(remaining)} }} from '{specifier}';"
        return match.group(0)

    updated_content = import_named_pattern.sub(replace_named_import, updated_content)

    # 2. Regex Sweep for Default Imports: import symbol_name from './old'
    import_default_pattern = re.compile(rf'import\s+{re.escape(symbol_name)}\s+from\s+[\'\"]([^\'\"]+)[\'\"]\s*;?', re.MULTILINE)

    def replace_default_import(match):
        nonlocal needs_new_import
        specifier = match.group(1)
        resolved = os.path.normpath(os.path.join(curr_dir, specifier)).replace("\\", "/")
        resolved_no_ext = os.path.splitext(resolved)[0]

        if resolved_no_ext == old_target_no_ext or resolved == old_target_norm:
            needs_new_import = True
            return ""  # Remove old import line
        return match.group(0)

    updated_content = import_default_pattern.sub(replace_default_import, updated_content)

    # 3. Append New Import if required
    if needs_new_import:
        new_rel_specifier = calculate_relative_js_import_path(current_file_path, new_target_file)
        new_import_line = f"import {{ {symbol_name} }} from '{new_rel_specifier}';\n"

        lines = updated_content.splitlines(keepends=True)
        insert_idx = 0
        for idx, line in enumerate(lines):
            if line.strip().startswith("import "):
                insert_idx = idx + 1

        lines.insert(insert_idx, new_import_line)
        updated_content = "".join(lines)

    return re.sub(r"\n{3,}", "\n\n", updated_content).strip() + "\n"


def execute_js_symbol_refactor_transplant(
    source_filepath: str,
    dest_filepath: str,
    symbol_name: str,
    workspace_root: str,
    all_workspace_files: List[str]
) -> Tuple[bool, str]:
    """
    Executes atomic multi-file AST symbol transplant across JS/TS/React modules.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    dst_abs = os.path.join(workspace_root, dest_filepath)

    if not os.path.exists(src_abs) or not os.path.exists(dst_abs):
        return False, "[ERROR] Source or destination file does not exist on disk."

    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()

    extracted_code, remaining_src_code = extract_js_symbol(src_code, symbol_name, source_filepath)
    if not extracted_code or remaining_src_code is None:
        return False, f"[ERROR] Symbol '{symbol_name}' could not be extracted from AST of {source_filepath}."

    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    updated_dst_code = inject_js_symbol(dst_code, extracted_code)

    file_mutation_queue = [
        (src_abs, remaining_src_code),
        (dst_abs, updated_dst_code)
    ]

    js_exts = (".js", ".jsx", ".ts", ".tsx", ".mjs")
    for rel_file in all_workspace_files:
        if not rel_file.endswith(js_exts):
            continue
        if rel_file in [source_filepath, dest_filepath]:
            continue

        abs_file = os.path.join(workspace_root, rel_file)
        if not os.path.exists(abs_file):
            continue

        with open(abs_file, "r", encoding="utf-8") as f:
            other_code = f.read()

        try:
            updated_other = rewrite_js_imports_in_content(
                file_content=other_code,
                symbol_name=symbol_name,
                old_target_file=source_filepath,
                new_target_file=dest_filepath,
                current_file_path=rel_file
            )

            if updated_other != other_code:
                file_mutation_queue.append((abs_file, updated_other))
        except Exception:
            continue

    try:
        for target_path, mutated_content in file_mutation_queue:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(mutated_content)
    except Exception as e:
        return False, f"[ERROR] Disk transaction failed during write: {e}"

    return True, f"[INFO] Successfully refactored '{symbol_name}' from {source_filepath} to {dest_filepath} across {len(file_mutation_queue)} files."


def execute_js_file_merge(
    source_filepath: str,
    dest_filepath: str,
    workspace_root: str,
    all_workspace_files: List[str]
) -> Tuple[bool, str]:
    """
    Merges an entire JavaScript/React file into another destination file:
      1. Combines and deduplicates imports.
      2. Appends body statements.
      3. Rewrites all workspace imports pointing to source_file to point to dest_file.
      4. Deletes source_file from disk.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    dst_abs = os.path.join(workspace_root, dest_filepath)

    if not os.path.exists(src_abs) or not os.path.exists(dst_abs):
        return False, "[ERROR] Source or destination file does not exist."

    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()
    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    # Append non-empty body
    merged_dst_code = f"{dst_code.strip()}\n\n// --- MERGED FROM {source_filepath} ---\n{src_code.strip()}\n"

    file_mutation_queue = [(dst_abs, merged_dst_code)]

    # Update all workspace files importing from source_filepath
    js_exts = (".js", ".jsx", ".ts", ".tsx", ".mjs")
    for rel_file in all_workspace_files:
        if not rel_file.endswith(js_exts) or rel_file in [source_filepath, dest_filepath]:
            continue

        abs_file = os.path.join(workspace_root, rel_file)
        if not os.path.exists(abs_file):
            continue

        with open(abs_file, "r", encoding="utf-8") as f:
            other_code = f.read()

        new_rel_specifier = calculate_relative_js_import_path(rel_file, dest_filepath)
        old_rel_specifier = calculate_relative_js_import_path(rel_file, source_filepath)

        updated_other = other_code.replace(f"'{old_rel_specifier}'", f"'{new_rel_specifier}'")
        updated_other = updated_other.replace(f'"{old_rel_specifier}"', f'"{new_rel_specifier}"')

        if updated_other != other_code:
            file_mutation_queue.append((abs_file, updated_other))

    try:
        # Commit updates
        for target_path, content in file_mutation_queue:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(content)
        # Delete merged source file
        os.remove(src_abs)
    except Exception as e:
        return False, f"[ERROR] Merge transaction failed: {e}"

    return True, f"[INFO] Merged {source_filepath} into {dest_filepath} and updated imports across {len(file_mutation_queue)} files."