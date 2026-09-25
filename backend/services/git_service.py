# backend/services/git_service.py
import os
import posixpath
import shutil
import subprocess
from typing import Any, Dict, List, Optional


def git_get_detailed_status(target_dir: str) -> Dict[str, Any]:
    """
    Returns separate lists of 'staged' and 'unstaged' changes, active branch,
    and whether the directory is a git repository.
    Executes in <30ms.
    """
    if not target_dir:
        return {"is_git_repo": False, "branch": "", "staged": [], "unstaged": []}

    abs_target = os.path.abspath(target_dir)
    if not os.path.exists(os.path.join(abs_target, ".git")):
        return {"is_git_repo": False, "branch": "", "staged": [], "unstaged": []}

    branch = "main"
    try:
        b_res = subprocess.run(
            ['git', 'branch', '--show-current'],
            cwd=abs_target,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=1.5
        )
        b_text = b_res.stdout.strip()
        if b_text:
            branch = b_text
        else:
            h_res = subprocess.run(
                ['git', 'rev-parse', '--short', 'HEAD'],
                cwd=abs_target,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=1.5
            )
            branch = h_res.stdout.strip() or "HEAD"
    except Exception:
        pass

    staged = []
    unstaged = []

    try:
        res = subprocess.run(
            ['git', '-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'],
            cwd=abs_target,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=5.0
        )

        for line in res.stdout.splitlines():
            if len(line) < 4:
                continue

            x = line[0]
            y = line[1]
            raw_path = line[3:].strip().replace('\\', '/').rstrip('/')
            if raw_path.startswith('"') and raw_path.endswith('"'):
                raw_path = raw_path[1:-1]
            if "->" in raw_path:
                raw_path = raw_path.split("->")[-1].strip().replace('\\', '/')

            raw_path = posixpath.normpath(raw_path)
            basename = posixpath.basename(raw_path)
            dirname = posixpath.dirname(raw_path).replace('/', '\\')

            # Staged file check
            if x in ['M', 'A', 'D', 'R', 'C']:
                staged.append({
                    'path': raw_path,
                    'name': basename,
                    'dir': dirname,
                    'status': x
                })

            # Unstaged / Untracked check
            if y in ['M', 'D'] or (x == '?' and y == '?'):
                stat = 'U' if (x == '?' and y == '?') else y
                unstaged.append({
                    'path': raw_path,
                    'name': basename,
                    'dir': dirname,
                    'status': stat
                })

                # If untracked folder, expand files
                if stat == 'U':
                    full_p = os.path.join(abs_target, raw_path)
                    if os.path.isdir(full_p):
                        for sub_root, _, sub_files in os.walk(full_p):
                            for sf in sub_files:
                                sub_rel = posixpath.normpath(
                                    os.path.relpath(os.path.join(sub_root, sf), abs_target).replace('\\', '/')
                                )
                                if not any(u['path'] == sub_rel for u in unstaged):
                                    unstaged.append({
                                        'path': sub_rel,
                                        'name': sf,
                                        'dir': posixpath.dirname(sub_rel).replace('/', '\\'),
                                        'status': 'U'
                                    })
    except Exception:
        pass

    return {
        "is_git_repo": True,
        "branch": branch,
        "staged": staged,
        "unstaged": unstaged
    }


def git_get_log_graph(target_dir: str, limit: int = 40) -> List[Dict[str, Any]]:
    """
    Parses git log with graph lines, commits, authors, dates, branches, and lane topology.
    """
    if not target_dir:
        return []

    abs_target = os.path.abspath(target_dir)
    if not os.path.exists(os.path.join(abs_target, ".git")):
        return []

    cmd = [
        'git', '-c', 'core.quotepath=false', 'log', '--graph', '--all',
        '--pretty=format:COMMIT_START%h%x09%p%x09%an%x09%cd%x09%cr%x09%d%x09%s',
        '--date=format:%d %b',
        '-n', str(limit)
    ]

    try:
        res = subprocess.run(
            cmd,
            cwd=abs_target,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=5.0
        )
        lines = (res.stdout or "").splitlines()

        graph_rows = []
        for line in lines:
            if "COMMIT_START" in line:
                graph_part, commit_part = line.split("COMMIT_START", 1)
                parts = commit_part.split('\t')
                if len(parts) >= 7:
                    h, parents, author, date, rel_date, deco, msg = parts[:7]

                    branch_names = []
                    has_cloud = "origin" in deco
                    is_head = "HEAD" in deco
                    clean_deco = deco.strip().strip('()')
                    if clean_deco:
                        for token in clean_deco.split(','):
                            token = token.strip()
                            if "->" in token:
                                token = token.split("->")[-1].strip()
                            if token.startswith("origin/"):
                                token = token.replace("origin/", "")
                            if token and token != "HEAD" and token not in branch_names:
                                branch_names.append(token)

                    # Determine lane index from graph_part:
                    # '*' at index 0 is lane 0 (main cyan spine), '*' at index >= 2 is lane 1 (yellow branch)
                    lane = 0
                    if "*" in graph_part:
                        star_idx = graph_part.find("*")
                        lane = 0 if star_idx <= 1 else 1

                    graph_rows.append({
                        "type": "commit",
                        "graph_chars": graph_part.rstrip(),
                        "hash": h,
                        "parents": parents.split(),
                        "author": author,
                        "date": date,
                        "relative_date": rel_date,
                        "decorations": deco.strip(),
                        "branch_names": branch_names,
                        "has_cloud": has_cloud,
                        "is_head": is_head,
                        "message": msg,
                        "lane": lane
                    })
            else:
                # Graph rail connector line (e.g. "|\", "|/", "| |")
                clean_line = line.rstrip()
                if clean_line:
                    graph_rows.append({
                        "type": "connector",
                        "graph_chars": clean_line
                    })

        return graph_rows
    except Exception:
        return []


def git_commit(target_dir: str, message: str, push: bool = False, amend: bool = False) -> Dict[str, Any]:
    """
    Commits changes. If no files are currently staged, stages all changes (git add -A)
    before committing. Supports amend and push options.
    """
    if not target_dir:
        return {"success": False, "error": "Invalid workspace directory."}
    if not amend and not message.strip():
        return {"success": False, "error": "Commit message cannot be empty."}

    abs_target = os.path.abspath(target_dir)

    # Check if any changes are staged
    staged_check = subprocess.run(
        ['git', 'diff', '--cached', '--quiet'],
        cwd=abs_target, check=False
    )
    if staged_check.returncode == 0 and not amend:
        # Nothing is staged; stage all tracked and untracked changes
        stage_res = subprocess.run(
            ['git', 'add', '-A'],
            cwd=abs_target, capture_output=True, text=True, check=False
        )
        if stage_res.returncode != 0:
            return {"success": False, "error": f"Failed to stage changes: {stage_res.stderr}"}

    # Execute commit or amend
    if amend:
        args = ['git', 'commit', '--amend', '--no-edit']
        if message and message.strip():
            args = ['git', 'commit', '--amend', '-m', message.strip()]
    else:
        args = ['git', 'commit', '-m', message.strip()]

    commit_res = subprocess.run(args, cwd=abs_target, capture_output=True, text=True, check=False)
    if commit_res.returncode != 0:
        return {"success": False, "error": commit_res.stderr.strip() or commit_res.stdout.strip()}

    push_output = ""
    if push:
        push_res = subprocess.run(['git', 'push'], cwd=abs_target, capture_output=True, text=True, check=False)
        if push_res.returncode != 0:
            return {"success": False, "error": f"Committed, but push failed: {push_res.stderr.strip() or push_res.stdout.strip()}"}
        push_output = push_res.stdout.strip()

    return {"success": True, "output": (commit_res.stdout.strip() + ("\n" + push_output if push_output else "")).strip()}


def git_push(target_dir: str) -> Dict[str, Any]:
    """Pushes committed changes to remote repository."""
    if not target_dir:
        return {"success": False, "error": "Invalid workspace directory."}
    abs_target = os.path.abspath(target_dir)
    push_res = subprocess.run(['git', 'push'], cwd=abs_target, capture_output=True, text=True, check=False)
    if push_res.returncode == 0:
        return {"success": True, "output": push_res.stdout.strip()}
    return {"success": False, "error": push_res.stderr.strip() or push_res.stdout.strip()}


def git_stage(target_dir: str, file_path: Optional[str] = None) -> Dict[str, Any]:
    """Stages a specific file or all files."""
    if not target_dir:
        return {"success": False, "error": "Invalid workspace directory."}

    abs_target = os.path.abspath(target_dir)
    args = ['git', 'add', file_path] if file_path and file_path != "all" else ['git', 'add', '-A']

    res = subprocess.run(args, cwd=abs_target, capture_output=True, text=True, check=False)
    return {"success": res.returncode == 0, "error": res.stderr.strip() if res.returncode != 0 else None}


def git_unstage(target_dir: str, file_path: Optional[str] = None) -> Dict[str, Any]:
    """Unstages a specific file or all files."""
    if not target_dir:
        return {"success": False, "error": "Invalid workspace directory."}

    abs_target = os.path.abspath(target_dir)
    args = ['git', 'restore', '--staged', file_path] if file_path and file_path != "all" else ['git', 'restore', '--staged', '.']

    res = subprocess.run(args, cwd=abs_target, capture_output=True, text=True, check=False)
    if res.returncode != 0:
        # Fallback for older git versions
        args_fb = ['git', 'reset', 'HEAD', file_path] if file_path and file_path != "all" else ['git', 'reset', 'HEAD']
        res = subprocess.run(args_fb, cwd=abs_target, capture_output=True, text=True, check=False)

    return {"success": res.returncode == 0, "error": res.stderr.strip() if res.returncode != 0 else None}


def git_discard(target_dir: str, file_path: Optional[str] = None) -> Dict[str, Any]:
    """Discards modifications or removes untracked files."""
    if not target_dir:
        return {"success": False, "error": "Invalid workspace directory."}

    abs_target = os.path.abspath(target_dir)

    if file_path and file_path != "all":
        full_path = os.path.join(abs_target, file_path)
        stat_res = subprocess.run(
            ['git', 'status', '--porcelain', file_path],
            cwd=abs_target, capture_output=True, text=True, check=False
        )
        out = stat_res.stdout.strip()
        if out.startswith("??"):
            if os.path.isdir(full_path):
                shutil.rmtree(full_path, ignore_errors=True)
            elif os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception:
                    pass
            return {"success": True}
        else:
            res = subprocess.run(
                ['git', 'restore', file_path],
                cwd=abs_target, capture_output=True, text=True, check=False
            )
            if res.returncode != 0:
                res = subprocess.run(
                    ['git', 'checkout', '--', file_path],
                    cwd=abs_target, capture_output=True, text=True, check=False
                )
            return {"success": res.returncode == 0}
    else:
        subprocess.run(['git', 'restore', '.'], cwd=abs_target, check=False)
        subprocess.run(['git', 'clean', '-fd'], cwd=abs_target, check=False)
        return {"success": True}
