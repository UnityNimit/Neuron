# backend/core/js_mutator.py
import os
import posixpath
import re
from typing import Dict, List, Optional, Set, Tuple
from tree_sitter import Language, Node, Parser

# -------------------------------------------------------------------------
# 1. MULTI-LANGUAGE GRAMMAR INITIALIZATION
# -------------------------------------------------------------------------
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
    importer_dir = posixpath.dirname(importer_rel_path)
    target_dir = posixpath.dirname(target_rel_path)
    
    rel_dir = posixpath.relpath(target_dir, importer_dir).replace("\\", "/")
    
    target_base = os.path.splitext(posixpath.basename(target_rel_path))[0]
    if target_base == "index":
        target_import = rel_dir
    else:
        target_import = posixpath.join(rel_dir, target_base).replace("\\", "/")
        
    if not target_import.startswith("."):
        target_import = f"./{target_import}"
        
    return target_import


# -------------------------------------------------------------------------
# 2. SYMBOL EXTRACTION ENGINES (Tree-Sitter + Bracket Counting Fallback)
# -------------------------------------------------------------------------
def extract_symbol_regex_fallback(content: str, symbol_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Deterministic bracket-counting fallback extractor for complex JSX/TSX component declarations.
    """
    escaped_sym = re.escape(symbol_name)
    patterns = [
        r'(?:export\s+default\s+)?(?:export\s+)?(?:async\s+)?function\s+' + escaped_sym + r'\s*\(',
        r'(?:export\s+default\s+)?(?:export\s+)?(?:const|let|var)\s+' + escaped_sym + r'\s*=',
        r'(?:export\s+default\s+)?(?:export\s+)?class\s+' + escaped_sym + r'\b'
    ]

    start_idx = -1
    for p in patterns:
        m = re.search(p, content)
        if m:
            start_idx = m.start()
            break

    if start_idx == -1:
        return None, None

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
                if end_idx < len(content) and content[end_idx] == ';':
                    end_idx += 1
                break

    extracted = content[start_idx:end_idx].strip()
    remaining = (content[:start_idx] + content[end_idx:]).strip() + "\n"

    # Clean up trailing export default symbol_name; if present
    remaining = re.sub(r'export\s+default\s+' + escaped_sym + r'\s*;?', '', remaining)
    remaining = re.sub(r"\n{3,}", "\n\n", remaining).strip() + "\n"

    # Guarantee exported component
    if not extracted.startswith("export "):
        extracted = f"export {extracted}"

    return extracted, remaining


def extract_js_symbol(
    content: str, symbol_name: str, filepath: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts a top-level function, React arrow component, or class from JS/JSX/TSX code
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

    def get_text(n: Optional[Node]) -> str:
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
                elif decl.type in ["lexical_declaration", "variable_declaration"]:
                    for d in decl.named_children:
                        if d.type == "variable_declarator":
                            name_node = d.child_by_field_name("name")
                            if name_node and get_text(name_node) == symbol_name:
                                target_byte_range = (child.start_byte, child.end_byte)
                                extracted_text = get_text(child)
                                break

            for sub in child.children:
                if sub.type in ["function_declaration", "class_declaration"]:
                    name_node = sub.child_by_field_name("name")
                    if name_node and get_text(name_node) == symbol_name:
                        target_byte_range = (child.start_byte, child.end_byte)
                        extracted_text = get_text(child)
                        break
                elif sub.type in ["lexical_declaration", "variable_declaration"]:
                    for d in sub.named_children:
                        if d.type == "variable_declarator":
                            name_node = d.child_by_field_name("name")
                            if name_node and get_text(name_node) == symbol_name:
                                target_byte_range = (child.start_byte, child.end_byte)
                                extracted_text = get_text(child)
                                break

        # 3. const MyComponent = () => {}
        elif child.type in ["lexical_declaration", "variable_declaration"]:
            for decl in child.named_children:
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
    
    escaped_sym = re.escape(symbol_name)
    remaining_code = re.sub(r'export\s+default\s+' + escaped_sym + r'\s*;?', '', remaining_code)
    remaining_code = re.sub(r"\n{3,}", "\n\n", remaining_code).strip() + "\n"

    clean_extracted = extracted_text.strip()
    if not clean_extracted.startswith("export "):
        clean_extracted = f"export {clean_extracted}"

    return clean_extracted, remaining_code


# -------------------------------------------------------------------------
# 3. IMPORT INJECTION & MERGING ENGINE
# -------------------------------------------------------------------------
def inject_js_import(file_content: str, symbol_name: str, import_specifier: str) -> str:
    """
    Injects or merges an ES6 import statement cleanly at the top of a JS/TS file.
    """
    lines = file_content.splitlines(keepends=True)
    clean_spec = import_specifier.strip("'\"`")
    escaped_spec = re.escape(clean_spec)

    # 1. Check if an import from this specifier already exists -> merge named token
    existing_pattern = re.compile(
        r'import\s+\{([^}]+)\}\s+from\s+[\'"]' + escaped_spec + r'[\'"]\s*;?'
    )
    match = existing_pattern.search(file_content)

    if match:
        existing_tokens = [t.strip() for t in match.group(1).split(",") if t.strip()]
        if symbol_name not in existing_tokens:
            existing_tokens.append(symbol_name)
            new_import_stmt = f"import {{ {', '.join(existing_tokens)} }} from '{clean_spec}';"
            return file_content[:match.start()] + new_import_stmt + file_content[match.end():]
        return file_content

    # 2. Check if already imported via default or wildcard
    escaped_sym = re.escape(symbol_name)
    if re.search(r'import\s+' + escaped_sym + r'\s+from\s+[\'"]' + escaped_spec + r'[\'"]', file_content):
        return file_content

    # 3. Insert new import line after existing imports
    new_import_line = f"import {{ {symbol_name} }} from '{clean_spec}';\n"
    insert_idx = 0
    for idx, line in enumerate(lines):
        if line.strip().startswith("import ") or line.strip().startswith("import{"):
            insert_idx = idx + 1

    lines.insert(insert_idx, new_import_line)
    return "".join(lines)


def forward_dependencies_to_dest(source_content: str, dest_content: str, symbol_code: str) -> str:
    """
    Inspects imports in source_file used by the transplanted symbol and injects them into dest_file.
    """
    import_lines = re.findall(r'(import\s+[^;]+;)', source_content)
    updated_dst = dest_content

    for imp_line in import_lines:
        named_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'\"]([^\'\"]+)[\'\"]', imp_line)
        default_match = re.search(r'import\s+([a-zA-Z0-9_$]+)\s+from\s+[\'\"]([^\'\"]+)[\'\"]', imp_line)

        if named_match:
            tokens = [t.strip() for t in named_match.group(1).split(",") if t.strip()]
            specifier = named_match.group(2)
            for token in tokens:
                if re.search(r'\b' + re.escape(token) + r'\b', symbol_code):
                    updated_dst = inject_js_import(updated_dst, token, specifier)

        elif default_match:
            token = default_match.group(1).strip()
            specifier = default_match.group(2)
            if re.search(r'\b' + re.escape(token) + r'\b', symbol_code):
                escaped_token = re.escape(token)
                escaped_spec = re.escape(specifier)
                if not re.search(r'import\s+.*\b' + escaped_token + r'\b.*from\s+[\'"]' + escaped_spec + r'[\'"]', updated_dst):
                    lines = updated_dst.splitlines(keepends=True)
                    insert_idx = 0
                    for idx, line in enumerate(lines):
                        if line.strip().startswith("import "):
                            insert_idx = idx + 1
                    lines.insert(insert_idx, f"import {token} from '{specifier}';\n")
                    updated_dst = "".join(lines)

    return updated_dst


def is_symbol_referenced(content: str, symbol_name: str) -> bool:
    """Checks if a symbol or JSX tag is referenced in the code."""
    escaped_sym = re.escape(symbol_name)
    patterns = [
        r'<' + escaped_sym + r'[\s/>]',
        r'\b' + escaped_sym + r'\s*\(',
        r'\b' + escaped_sym + r'\.'
    ]
    return any(re.search(p, content) for p in patterns)


def rewrite_js_imports_in_content(
    file_content: str,
    symbol_name: str,
    old_target_file: str,
    new_target_file: str,
    current_file_path: str
) -> str:
    """Surgically rewrites named and default ES6 imports across referencing files."""
    if not file_content.strip():
        return file_content

    curr_dir = posixpath.dirname(current_file_path)
    old_target_norm = posixpath.normpath(old_target_file).replace("\\", "/")
    old_target_no_ext = posixpath.splitext(old_target_norm)[0]

    updated_content = file_content
    needs_new_import = False

    # 1. Rewrite Named Imports: import { A, symbol_name, B } from './old'
    import_named_pattern = re.compile(r'import\s+\{([^}]+)\}\s+from\s+[\'\"]([^\'\"]+)[\'\"]\s*;?', re.MULTILINE)
    
    def replace_named_import(match):
        nonlocal needs_new_import
        symbols_str = match.group(1)
        specifier = match.group(2)
        
        resolved = posixpath.normpath(posixpath.join(curr_dir, specifier)).replace("\\", "/")
        resolved_no_ext = posixpath.splitext(resolved)[0]

        if resolved_no_ext == old_target_no_ext or resolved == old_target_norm:
            symbols = [s.strip() for s in symbols_str.split(",") if s.strip()]
            if symbol_name in symbols:
                needs_new_import = True
                remaining = [s for s in symbols if s != symbol_name]
                if not remaining:
                    return ""
                return f"import {{ {', '.join(remaining)} }} from '{specifier}';"
        return match.group(0)

    updated_content = import_named_pattern.sub(replace_named_import, updated_content)

    # 2. Rewrite Default Imports: import symbol_name from './old'
    escaped_sym = re.escape(symbol_name)
    import_default_pattern = re.compile(
        r'import\s+' + escaped_sym + r'\s+from\s+[\'"]([^\'"]+)[\'"]\s*;?', 
        re.MULTILINE
    )

    def replace_default_import(match):
        nonlocal needs_new_import
        specifier = match.group(1)
        resolved = posixpath.normpath(posixpath.join(curr_dir, specifier)).replace("\\", "/")
        resolved_no_ext = posixpath.splitext(resolved)[0]

        if resolved_no_ext == old_target_no_ext or resolved == old_target_norm:
            needs_new_import = True
            return ""
        return match.group(0)

    updated_content = import_default_pattern.sub(replace_default_import, updated_content)

    # 3. Inject New Relative Import if removed from old location
    if needs_new_import:
        new_rel_specifier = calculate_relative_js_import_path(current_file_path, new_target_file)
        updated_content = inject_js_import(updated_content, symbol_name, new_rel_specifier)

    return re.sub(r"\n{3,}", "\n\n", updated_content).strip() + "\n"


# -------------------------------------------------------------------------
# 4. ATOMIC JS/REACT TRANSPLANT & MERGE DISPATCHERS
# -------------------------------------------------------------------------
def execute_js_symbol_refactor_transplant(
    source_filepath: str,
    dest_filepath: str,
    symbol_name: str,
    workspace_root: str,
    all_workspace_files: List[str]
) -> Tuple[bool, str]:
    """
    🚀 THE JS / REACT AST SURGEON (Lossless Atomic Refactoring)
      1. Extracts symbol from source file AST.
      2. Injects import from destination into source file if source still references it.
      3. Forwards needed package/hook imports from source file into destination file.
      4. Appends extracted symbol to destination file.
      5. Rewrites ES6 imports across all referencing workspace files.
      6. Commits all mutated modules atomically with rollback safety.
    """
    src_abs = os.path.join(workspace_root, source_filepath)
    dst_abs = os.path.join(workspace_root, dest_filepath)

    if not os.path.exists(src_abs) or not os.path.exists(dst_abs):
        return False, "Source or destination file does not exist on disk."

    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()

    extracted_code, remaining_src_code = extract_js_symbol(src_code, symbol_name, source_filepath)
    if not extracted_code or remaining_src_code is None:
        return False, f"Symbol '{symbol_name}' could not be extracted from AST of {source_filepath}."

    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    # Forward necessary dependencies (e.g. useState, lucide-react) to dest
    updated_dst_code = forward_dependencies_to_dest(src_code, dst_code, extracted_code)
    
    # Append symbol to destination
    clean_dst = updated_dst_code.strip()
    updated_dst_code = f"{clean_dst}\n\n{extracted_code.strip()}\n" if clean_dst else f"{extracted_code.strip()}\n"

    # Auto-inject import into source if remaining source code still references the moved component
    if is_symbol_referenced(remaining_src_code, symbol_name):
        src_to_dst_rel = calculate_relative_js_import_path(source_filepath, dest_filepath)
        remaining_src_code = inject_js_import(remaining_src_code, symbol_name, src_to_dst_rel)

    file_mutation_queue = [
        (src_abs, remaining_src_code),
        (dst_abs, updated_dst_code)
    ]

    # Sweep all other workspace JS/TS/JSX files
    js_exts = (".js", ".jsx", ".ts", ".tsx", ".mjs")
    for rel_file in all_workspace_files:
        if not rel_file.endswith(js_exts) or rel_file in [source_filepath, dest_filepath]:
            continue

        abs_file = os.path.join(workspace_root, rel_file)
        if not os.path.exists(abs_file):
            continue

        try:
            with open(abs_file, "r", encoding="utf-8") as f:
                other_code = f.read()

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

    # Commit Transaction with In-Memory Rollback
    backups: Dict[str, str] = {}
    try:
        for target_path, _ in file_mutation_queue:
            with open(target_path, "r", encoding="utf-8") as f:
                backups[target_path] = f.read()

        for target_path, mutated_content in file_mutation_queue:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(mutated_content)
    except Exception as e:
        for target_path, original_content in backups.items():
            try:
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(original_content)
            except Exception:
                pass
        return False, f"JS Refactoring transaction failed and rolled back: {e}"

    return True, f"Successfully refactored '{symbol_name}' from {source_filepath} to {dest_filepath} across {len(file_mutation_queue)} files."


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
        return False, "Source or destination file does not exist."

    with open(src_abs, "r", encoding="utf-8") as f:
        src_code = f.read()
    with open(dst_abs, "r", encoding="utf-8") as f:
        dst_code = f.read()

    # Forward imports from source into dest
    merged_dst_code = forward_dependencies_to_dest(src_code, dst_code, src_code)

    # Strip import statements from source body before appending
    src_body = re.sub(r'import\s+[^;]+;\n?', '', src_code).strip()
    
    # Strip duplicate export defaults from source to avoid syntax error in dest
    src_body = re.sub(r'export\s+default\s+', 'export ', src_body)

    merged_dst_code = f"{merged_dst_code.strip()}\n\n// --- MERGED FROM {source_filepath} ---\n{src_body}\n"

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
        for target_path, content in file_mutation_queue:
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(content)
        os.remove(src_abs)
    except Exception as e:
        return False, f"Merge transaction failed: {e}"

    return True, f"Merged {source_filepath} into {dest_filepath} and updated imports across {len(file_mutation_queue)} files."