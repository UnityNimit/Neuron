# backend/services/ai_service.py
import ast
import asyncio
from datetime import datetime
import difflib
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import uuid
import httpx

try:
    import google.genai as genai
    from google.genai import types as genai_types
    GENAI_SDK_AVAILABLE = True
except ImportError:
    genai = None
    genai_types = None
    GENAI_SDK_AVAILABLE = False

# -------------------------------------------------------------------------
# 1. IN-MEMORY HASH CACHE (0ms Retrieval for Unmodified Code)
# -------------------------------------------------------------------------
SUMMARY_CACHE: Dict[str, str] = {}

OLLAMA_API_BASE = "http://127.0.0.1:11434"


async def get_available_ollama_models() -> List[str]:
    """Queries local Ollama /api/tags endpoint and ranks installed models dynamically."""
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            res = await client.get(f"{OLLAMA_API_BASE}/api/tags")
            if res.status_code == 200:
                tags = res.json()
                raw_models = tags.get("models", [])
                scored = []
                for m in raw_models:
                    name = (m.get("name") or "").strip()
                    if not name:
                        continue
                    n_lower = name.lower()
                    # Skip pure embedding models
                    if "embed" in n_lower:
                        continue
                    score = 0.0
                    details = m.get("details") or {}
                    family = (details.get("family") or "").lower()
                    if "coder" in n_lower or "code" in n_lower or "coder" in family:
                        score += 500.0
                    param_str = (details.get("parameter_size") or "").lower()
                    param_m = re.search(r'(\d+(?:\.\d+)?)b', param_str or n_lower)
                    if param_m:
                        try:
                            score += min(float(param_m.group(1)) * 10.0, 400.0)
                        except ValueError:
                            pass
                    size_bytes = float(m.get("size") or 0)
                    score += min(size_bytes / (1024 ** 3) * 5.0, 100.0)
                    scored.append((score, name))
                scored.sort(key=lambda x: x[0], reverse=True)
                return [name for _, name in scored]
    except Exception:
        pass
    return []


async def resolve_best_ollama_model() -> Optional[str]:
    """Returns the highest-ranked installed local model, or None if none installed."""
    models = await get_available_ollama_models()
    return models[0] if models else None


def compute_code_hash(code_string: str, context_str: str = "") -> str:
    """Generates a unique SHA-256 fingerprint of the code and its dependency context."""
    hasher = hashlib.sha256()
    hasher.update(code_string.encode('utf-8'))
    if context_str:
        hasher.update(context_str.encode('utf-8'))
    return hasher.hexdigest()


def ensure_complete_sentences(text: str) -> str:
    """
    Guarantees text never ends on an abrupt cut-off fragment.
    Prunes trailing incomplete clauses if truncated by token limits.
    """
    clean = text.strip()
    if not clean:
        return ""

    # If ending with standard terminal punctuation, return directly
    if clean.endswith(('.', '!', '?')):
        return clean

    # Find the last sentence-ending punctuation mark
    last_period = max(clean.rfind('.'), clean.rfind('!'), clean.rfind('?'))
    if last_period != -1 and last_period > len(clean) * 0.4:
        return clean[:last_period + 1].strip()

    return f"{clean}."


def build_graph_rag_prompt(
    node_id: str,
    code_string: str,
    connected_snippets: Optional[List[str]] = None,
    risk_level: str = "low"
) -> str:
    """
    Constructs an ultra-dense Graph-RAG prompt.
    Forces the LLM to deliver pure architectural insight without repeating the obvious function name.
    """
    pruned_code = code_string.strip()[:1600]
    
    dependency_context = ""
    if connected_snippets:
        combined_deps = "\n---\n".join(s.strip()[:400] for s in connected_snippets[:3])
        dependency_context = f"\nCONNECTED AST DEPENDENCY CONTEXT:\n{combined_deps}\n"

    risk_instruction = ""
    if risk_level == "high":
        risk_instruction = " Flag high architectural vulnerability, bridge bottlenecks, or state mutability risks."

    prompt = (
        f"[INST] You are a Principal Software Architect analyzing a code graph node.\n"
        f"TARGET NODE: {node_id}\n"
        f"SOURCE CODE:\n{pruned_code}\n"
        f"{dependency_context}\n"
        f"STRICT INSTRUCTIONS:\n"
        f"1. Explain the architectural core: data transformations, side effects, protocol contracts, or state mutations in EXACTLY two dense sentences.{risk_instruction}\n"
        f"2. DO NOT state the function's name or restate obvious syntax.\n"
        f"3. DO NOT output markdown headers, code blocks, greetings, or filler.\n"
        f"4. Ensure your final sentence is completely finished and grammatically closed. [/INST]"
    )
    return prompt


# -------------------------------------------------------------------------
# 2. SINGLE-SHOT AI SUMMARY FETCHER (With 0ms Cache Hit)
# -------------------------------------------------------------------------
async def fetch_ast_summary(
    code_string: str,
    node_id: str = "",
    connected_snippets: Optional[List[str]] = None,
    risk_level: str = "low"
) -> str:
    """
    Fetches a high-signal 2-sentence architectural summary using Graph-RAG context.
    Checks SHA-256 cache first. Falls back to static heuristics if Ollama is offline.
    """
    if not code_string or not code_string.strip():
        return "Empty code block."

    context_str = "".join(connected_snippets) if connected_snippets else ""
    cache_key = compute_code_hash(code_string, context_str)

    # $0\text{ms}$ CACHE HIT
    if cache_key in SUMMARY_CACHE:
        return SUMMARY_CACHE[cache_key]

    local_model = await resolve_best_ollama_model()
    if local_model:
        prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)
        payload = {
            "model": local_model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "10m",
            "options": {
                "temperature": 0.15,     # Low temperature for precise architectural accuracy
                "top_p": 0.9,
                "num_predict": 140,      # Generous token budget to prevent cut-offs
                "num_ctx": 2048
            }
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(f"{OLLAMA_API_BASE}/api/generate", json=payload)
                if response.status_code == 200:
                    raw_summary = response.json().get("response", "").strip()
                    
                    # Strip common conversational prefixes
                    clean_summary = re.sub(r'^(?:Here is a summary:?|Summary:?|This function|This module)\s*', '', raw_summary, flags=re.IGNORECASE).strip()
                    clean_summary = ensure_complete_sentences(clean_summary)

                    if clean_summary and len(clean_summary) > 15:
                        # Capitalize first letter
                        clean_summary = clean_summary[0].upper() + clean_summary[1:]
                        SUMMARY_CACHE[cache_key] = clean_summary
                        return clean_summary
        except httpx.ConnectError:
            pass
        except Exception as e:
            print(f"[DEBUG] LLM Inference fallback: {e}")

    # DETERMINISTIC STATIC HEURISTIC FALLBACK
    fallback = generate_heuristic_summary(code_string, node_id, risk_level)
    SUMMARY_CACHE[cache_key] = fallback
    return fallback


# -------------------------------------------------------------------------
# 3. 🚀 STREAMING TOKEN PIPELINE (Live Typewriter over WebSockets)
# -------------------------------------------------------------------------
async def stream_ast_summary(
    code_string: str,
    node_id: str = "",
    connected_snippets: Optional[List[str]] = None,
    risk_level: str = "low"
) -> AsyncGenerator[str, None]:
    """
    Streams generated tokens in real-time as they are emitted from the local LLM.
    """
    if not code_string or not code_string.strip():
        yield "Empty code block."
        return

    context_str = "".join(connected_snippets) if connected_snippets else ""
    cache_key = compute_code_hash(code_string, context_str)

    if cache_key in SUMMARY_CACHE:
        yield SUMMARY_CACHE[cache_key]
        return

    local_model = await resolve_best_ollama_model()
    if local_model:
        prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)
        payload = {
            "model": local_model,
            "prompt": prompt,
            "stream": True,
            "keep_alive": "10m",
            "options": {
                "temperature": 0.15,
                "num_predict": 140,
                "num_ctx": 2048
            }
        }

        full_tokens = []
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                async with client.stream("POST", f"{OLLAMA_API_BASE}/api/generate", json=payload) as response:
                    if response.status_code == 200:
                        async for line in response.aiter_lines():
                            if line:
                                chunk = json.loads(line)
                                token = chunk.get("response", "")
                                full_tokens.append(token)
                                yield token
                                if chunk.get("done", False):
                                    break
                        
                        complete = ensure_complete_sentences("".join(full_tokens).strip())
                        if complete:
                            SUMMARY_CACHE[cache_key] = complete
                        return
        except Exception as e:
            print(f"[DEBUG] Streaming LLM fallback: {e}")

    yield generate_heuristic_summary(code_string, node_id, risk_level)


# -------------------------------------------------------------------------
# 4. DEEP STATIC HEURISTIC CODE ANALYZER (High-Signal Offline Fallback)
# -------------------------------------------------------------------------
def generate_heuristic_summary(code_str: str, node_id: str, risk_level: str) -> str:
    """
    Generates a concise, high-signal architectural summary without reciting the function name.
    """
    code_lower = code_str.lower()
    
    insights = []
    
    # 1. State & React Lifecycles
    if "usestate" in code_lower or "usereducer" in code_lower:
        insights.append("manages local component state lifecycle")
    if "useeffect" in code_lower or "uselayouteffect" in code_lower:
        insights.append("synchronizes external side-effects with render updates")
    if "usememo" in code_lower or "usecallback" in code_lower:
        insights.append("optimizes dependency re-renders via memoization")
        
    # 2. WebSocket & Networking
    if "websocket" in code_lower or "send_json" in code_lower or ".send(" in code_lower:
        insights.append("handles bidirectional WebSocket packet streaming")
    elif "fetch(" in code_lower or "axios" in code_lower or "httpx" in code_lower:
        insights.append("orchestrates asynchronous HTTP client-server I/O")
        
    # 3. AST Mutation & Parsing
    if "libcst" in code_lower or "cstvisitor" in code_lower or "tree_sitter" in code_lower:
        insights.append("executes syntax tree traversals and lossless source code mutation")
        
    # 4. ML & Graph Algorithms
    if "networkx" in code_lower or "pagerank" in code_lower or "louvain" in code_lower or "isolationforest" in code_lower:
        insights.append("computes topological graph metrics and statistical anomaly isolation")
        
    # 5. Database & Security
    if "jwt" in code_lower or "auth" in code_lower or "hashlib" in code_lower or "password" in code_lower:
        insights.append("enforces cryptographic token validation and identity constraints")
    elif "select" in code_lower or "cursor" in code_lower or "db." in code_lower or "session" in code_lower:
        insights.append("manages transactional database persistence and query lifecycle")

    if not insights:
        if "async def" in code_lower or "async " in code_lower:
            insights.append("coordinates non-blocking asynchronous task execution")
        else:
            insights.append("executes deterministic computational logic and data transformation")

    primary_role = insights[0]
    secondary_role = f" and {insights[1]}" if len(insights) > 1 else ""

    sentence_one = f"Orchestrates {primary_role}{secondary_role} across the runtime pipeline."
    
    # Secondary sentence: stability or risk assessment
    if risk_level == "high":
        sentence_two = "Exhibits elevated structural coupling and cyclomatic branching requiring careful refactoring bounds."
    elif risk_level == "medium":
        sentence_two = "Maintains moderate dependency Fan-In and Fan-Out flow."
    else:
        sentence_two = "Maintains isolated topological scope with low architectural churn."

    return f"{sentence_one} {sentence_two}"


# -------------------------------------------------------------------------
# 5. AI MULTI-SESSION PERSISTENCE & HISTORY
# -------------------------------------------------------------------------
GLOBAL_CONVERSATIONS_FILE = os.path.expanduser("~/.neuron/conversations.json")


def get_conversations_path(target_dir: Optional[str] = None) -> str:
    """Returns the persistent JSON store path for conversation sessions."""
    if target_dir and os.path.isdir(target_dir):
        neuron_dir = os.path.join(target_dir, ".neuron")
        os.makedirs(neuron_dir, exist_ok=True)
        return os.path.join(neuron_dir, "conversations.json")
    os.makedirs(os.path.dirname(GLOBAL_CONVERSATIONS_FILE), exist_ok=True)
    return GLOBAL_CONVERSATIONS_FILE


def load_conversations(target_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """Loads all conversations from disk, auto-seeding a welcome thread if empty."""
    path = get_conversations_path(target_dir)
    project_name = os.path.basename(target_dir) if target_dir else "Neuron"

    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            print(f"[WARN] Error reading conversations from {path}: {e}")

    # Auto-seed default conversation for the active workspace
    default_conv = {
        "id": "conv_default",
        "title": "Welcome to AI",
        "project": project_name,
        "model": "auto",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "unread": False,
        "messages": [
            {
                "id": "msg_welcome",
                "role": "assistant",
                "content": (
                    "Welcome to **AI** in Neuron.\n\n"
                    "Configure your API keys with custom aliases in **Settings > AI** or use your local hardware engine. "
                    "Neuron automatically detects available models for your active key and selects the best model.\n\n"
                    "Ask architectural questions, request refactors, or inspect code dependencies in real time."
                ),
                "thoughts": "AI agent initialized with automatic model discovery.",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        ]
    }
    save_conversations([default_conv], target_dir)
    return [default_conv]


def save_conversations(convs: List[Dict[str, Any]], target_dir: Optional[str] = None) -> None:
    """Persists conversations atomically to disk."""
    path = get_conversations_path(target_dir)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        temp_path = f"{path}.tmp.{os.getpid()}"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(convs, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, path)
    except Exception as e:
        print(f"[ERROR] Failed writing conversations to {path}: {e}")


def get_conversation(conv_id: str, target_dir: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves a single conversation by ID."""
    convs = load_conversations(target_dir)
    for c in convs:
        if c.get("id") == conv_id:
            return c
    return None


def create_conversation(
    title: str = "New Conversation",
    project: str = "Neuron",
    model: str = "auto",
    target_dir: Optional[str] = None
) -> Dict[str, Any]:
    """Creates a new conversation session and prepends it to the history."""
    convs = load_conversations(target_dir)
    new_id = f"conv_{int(time.time() * 1000)}"
    new_conv = {
        "id": new_id,
        "title": title,
        "project": project or (os.path.basename(target_dir) if target_dir else "Neuron"),
        "model": model or "auto",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "unread": False,
        "messages": []
    }
    convs.insert(0, new_conv)
    save_conversations(convs, target_dir)
    return new_conv


def update_conversation(
    conv_id: str,
    messages: List[Dict[str, Any]],
    title: Optional[str] = None,
    model: Optional[str] = None,
    target_dir: Optional[str] = None
) -> Dict[str, Any]:
    """Updates messages, title, and timestamp of an existing conversation, or upserts it."""
    convs = load_conversations(target_dir)
    target = None
    for c in convs:
        if c.get("id") == conv_id:
            c["messages"] = messages
            c["updated_at"] = datetime.utcnow().isoformat() + "Z"
            if title:
                c["title"] = title
            if model:
                c["model"] = model
            target = c
            break
    if not target:
        project_name = os.path.basename(target_dir) if target_dir else "Neuron"
        target = {
            "id": conv_id,
            "title": title or "New Conversation",
            "project": project_name,
            "model": model or "auto",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "unread": False,
            "messages": messages
        }
        convs.insert(0, target)
    save_conversations(convs, target_dir)
    return target


def delete_conversation(conv_id: str, target_dir: Optional[str] = None) -> bool:
    """Removes a conversation from history."""
    convs = load_conversations(target_dir)
    filtered = [c for c in convs if c.get("id") != conv_id]
    if len(filtered) != len(convs):
        save_conversations(filtered, target_dir)
        return True
    return False


# -------------------------------------------------------------------------
# 5.5 WORKSPACE CONTEXT COLLECTOR
# -------------------------------------------------------------------------
def get_workspace_context(
    target_dir: Optional[str],
    active_file: Optional[str],
    context_code: Optional[str]
) -> tuple[str, List[str], str]:
    """
    Scans the workspace directory to provide grounded context for AI agents:
    - Root directory path & project name
    - Tree list of active project files (excluding ignored build/dependency dirs)
    - Active file name and its current in-memory content
    """
    if not target_dir or not os.path.isdir(target_dir):
        root_path = os.getcwd()
    else:
        root_path = os.path.abspath(target_dir)

    project_name = os.path.basename(root_path) or "Neuron Workspace"

    ignored_folders = {
        ".git", "node_modules", "target", "dist", "build",
        "__pycache__", ".venv", "venv", ".idea", ".vscode", "binaries"
    }

    files: List[str] = []
    if os.path.isdir(root_path):
        for root, dirs, filenames in os.walk(root_path):
            dirs[:] = [d for d in dirs if d not in ignored_folders and not d.startswith(".")]
            for f in filenames:
                if f.startswith("."):
                    continue
                rel = os.path.relpath(os.path.join(root, f), root_path).replace("\\", "/")
                files.append(rel)
                if len(files) >= 120:
                    break
            if len(files) >= 120:
                break

    file_list_str = "\n".join(f"- {f}" for f in files) if files else "- (Empty directory)"

    active_rel = active_file.replace("\\", "/").lstrip("/") if active_file else ""
    code_preview = (context_code or "").strip()[:6000]

    context_str = (
        f"[WORKSPACE CONTEXT]\n"
        f"Working Directory: {root_path}\n"
        f"Project Name: {project_name}\n"
        f"Workspace Files ({len(files)} total):\n"
        f"{file_list_str}\n"
    )

    if active_rel:
        context_str += (
            f"\nActive Open File: {active_rel}\n"
            f"Active File Content:\n"
            f"```\n{code_preview}\n```\n"
        )

    return context_str, files, project_name


# -------------------------------------------------------------------------
# 6. CODE REFACTOR PROPOSAL EXTRACTION ENGINE
# -------------------------------------------------------------------------
def extract_refactor_proposal(
    text: str,
    active_file: Optional[str] = None,
    target_dir: Optional[str] = None,
    user_prompt: Optional[str] = None,
    tools_executed: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Analyzes model output for code blocks intended as targeted file refactors.
    Extracts proposed file path, language, original code from disk, and proposed code.
    Strictly guards against:
      - Popping up refactors if autonomous tools already created or modified files.
      - Treating shell / CLI commands (e.g. 'python server.py', 'pip install ...') as code refactors.
      - Overwriting open files when user only asked to run, execute, or install.
      - Blindly assigning a new script's code to the currently active file.
    """
    if not text or tools_executed:
        return None

    prompt_lower = (user_prompt or "").strip().lower()

    # Guard 1: Ignore purely conversational or operational execution requests (run, execute, install, test)
    is_pure_question = bool(re.search(
        r"^(hi|hello|hey|who are you|what files|which folder|where are we|what is|tell me|explain|why|how does)\b",
        prompt_lower
    )) and not bool(re.search(
        r"\b(write|rewrite|modify|change|refactor|update|replace|fix|implement|create|add|remove|delete)\b",
        prompt_lower
    ))
    if is_pure_question:
        return None

    is_operational_only = bool(re.search(
        r"\b(run|execute|exec|start|launch|test|check|verify|install)\b",
        prompt_lower
    )) and not bool(re.search(
        r"\b(rewrite|refactor|modify|change|edit|replace code|create a file|write code to)\b",
        prompt_lower
    ))
    if is_operational_only:
        return None

    # Pattern: Fenced code block with optional filepath header (e.g. ```python:server.py or ```python filepath=server.py)
    fence_pattern = re.compile(
        r"```(?:(\w+)[ \t:]+(?:filepath=)?([^\n\r]+)|(\w+))?\r?\n(.*?)```",
        re.DOTALL
    )

    matches = list(fence_pattern.finditer(text))
    if not matches:
        return None

    # Find if any block has an explicit filepath tag
    explicit_match = None
    for m in matches:
        hdr_path = (m.group(2) or "").strip()
        code = m.group(4)
        if hdr_path:
            explicit_match = (m, hdr_path)
            break
        # Also check first 4 lines for filepath comment
        for line in code[:300].split("\n")[:4]:
            fp_m = re.search(r"(?:#|//|/\*|<!--)\s*(?:filepath|file):\s*([^\s\*]+)", line, re.IGNORECASE)
            if fp_m:
                explicit_match = (m, fp_m.group(1).strip())
                break
        if explicit_match:
            break

    best_match = None
    target_rel_path = ""

    if explicit_match:
        best_match, target_rel_path = explicit_match
    else:
        # If there are multiple code blocks (e.g. multi-step tutorial), do NOT guess
        if len(matches) > 1:
            return None

        # If only 1 code block: only treat as refactor if user explicitly asked for code changes
        is_code_request = bool(re.search(
            r"\b(write|rewrite|code|refactor|change|make|update|replace|fix|implement|create|modify|add|remove)\b",
            prompt_lower
        ))
        if not is_code_request and not active_file:
            return None

        best_match = matches[0]

        # Check if text right before the code block mentions a target filename (e.g. "saved in game.py" or "named game.py")
        prefix_text = text[:best_match.start()]
        file_hint_m = re.findall(
            r"(?:file named|filename|create|saved in|save in|named|file:?)\s+[`'\"]?([\w\.-]+\.(?:py|js|ts|tsx|jsx|html|css|json|rs|go|cpp|c|java))[`'\"]?",
            prefix_text,
            re.IGNORECASE
        )
        if file_hint_m:
            target_rel_path = file_hint_m[-1]
        elif active_file:
            target_rel_path = active_file.replace("\\", "/").lstrip("/")

    if not best_match:
        return None

    code_content = best_match.group(4).strip()
    if len(code_content) < 15:
        return None

    lang = (best_match.group(1) or best_match.group(3) or "text").strip().lower()

    # Guard 2: Never treat shell / terminal blocks as file refactors!
    if lang in {"bash", "sh", "shell", "zsh", "cmd", "powershell", "terminal", "console", "bat"}:
        return None

    # Guard 3: Never treat CLI command lines as file refactors!
    CLI_PREFIXES = (
        "python ", "python3 ", "py ", "pip ", "pip3 ", "npm ", "npx ", "node ", "yarn ", "pnpm ",
        "cargo ", "git ", "cd ", "ls ", "dir ", "cat ", "type ", "echo ", "powershell ", "sh ", "bash ",
        "curl ", "wget ", "uvicorn ", "docker ", "kubectl ", "source ", "pytest ", "go ", "make ", "java ",
        "dotnet ", "./", ".\\", "$ "
    )
    first_non_empty = ""
    for l in code_content.splitlines():
        if l.strip():
            first_non_empty = l.strip()
            break

    if any(first_non_empty.startswith(p) for p in CLI_PREFIXES):
        return None

    # Guard 4: Must contain actual structured code (not a single short expression)
    non_empty_lines = [l for l in code_content.splitlines() if l.strip()]
    if len(non_empty_lines) < 2 and not any(kw in code_content for kw in ["def ", "class ", "import ", "const ", "let ", "function ", "return "]):
        return None

    # Clean target relative path
    target_rel_path = target_rel_path.strip().replace("\\", "/").lstrip("/")
    if not target_rel_path and active_file:
        target_rel_path = active_file.replace("\\", "/").lstrip("/")

    if not target_rel_path:
        return None

    # Load original file content if present on disk
    original_code = ""
    if target_dir:
        disk_path = os.path.join(target_dir, target_rel_path)
        if os.path.exists(disk_path) and os.path.isfile(disk_path):
            try:
                with open(disk_path, "r", encoding="utf-8", errors="replace") as f:
                    original_code = f.read()
            except Exception:
                pass

    return {
        "filePath": target_rel_path,
        "language": lang,
        "proposedCode": code_content,
        "originalCode": original_code,
        "summary": f"Refactor proposal for {os.path.basename(target_rel_path)}"
    }


def apply_refactor_code(
    file_path: str,
    proposed_code: str,
    target_dir: Optional[str] = None
) -> Dict[str, Any]:
    """Writes approved refactored code atomically to the workspace filesystem."""
    clean_path = file_path.replace("\\", "/").lstrip("/")
    base_dir = target_dir or os.getcwd()
    full_path = os.path.abspath(os.path.join(base_dir, clean_path))

    # Security check: Ensure target path remains inside base workspace
    if not full_path.startswith(os.path.abspath(base_dir)):
        raise ValueError("Invalid target path outside workspace bounds.")

    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    temp_path = f"{full_path}.tmp.{os.getpid()}"
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(proposed_code)
    os.replace(temp_path, full_path)

    return {
        "success": True,
        "filePath": clean_path,
        "bytesWritten": len(proposed_code.encode("utf-8"))
    }


# -------------------------------------------------------------------------
# 6. LEGENDARY AUTONOMOUS AGENT TOOLS & RUNTIMES
# -------------------------------------------------------------------------
FILE_SNAPSHOTS: Dict[str, str] = {}
ACTIVE_AGENT_WORKSPACE: str = ""
CURRENT_CANCEL_CTX: Optional[Dict[str, Any]] = None


def discover_project_python(target_dir: Optional[str] = None) -> str:
    """Finds the workspace's local virtualenv python interpreter if present."""
    base = target_dir or ACTIVE_AGENT_WORKSPACE or os.getcwd()
    candidates = [
        os.path.join(base, ".venv", "Scripts", "python.exe"),
        os.path.join(base, "venv", "Scripts", "python.exe"),
        os.path.join(base, "env", "Scripts", "python.exe"),
        os.path.join(base, ".venv", "bin", "python"),
        os.path.join(base, "venv", "bin", "python"),
    ]
    for cand in candidates:
        if os.path.exists(cand) and os.path.isfile(cand):
            return cand
    return sys.executable


def tool_get_file_outline(file_path: str = "", path: Optional[str] = None) -> str:
    """
    Extracts an AST symbol outline (classes, functions, methods, parameters, and line spans)
    from a source code file. Provides immediate structural awareness of large files with zero token waste.
    Always use this tool before tool_view_file on large files!
    """
    target_path = file_path or path or ""
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    clean_path = target_path.replace("\\", "/").lstrip("/")
    full_path = os.path.abspath(os.path.join(base, clean_path))

    if not os.path.exists(full_path):
        return f"[Error: File '{clean_path}' does not exist in workspace]"
    if not os.path.isfile(full_path):
        return f"[Error: '{clean_path}' is a directory, not a file]"

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            code = f.read()
    except Exception as e:
        return f"[Error reading '{clean_path}': {e}]"

    ext = os.path.splitext(clean_path)[1].lower()
    outline = []

    # 1. Python AST parsing (classes, functions, async functions, args, docstrings)
    if ext == ".py":
        try:
            tree = ast.parse(code, filename=clean_path)
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    end_line = getattr(node, "end_lineno", node.lineno)
                    doc = ast.get_docstring(node)
                    doc_preview = f" - \"{doc.splitlines()[0][:60]}...\"" if doc else ""
                    outline.append(f"class {node.name} (lines {node.lineno}-{end_line}){doc_preview}:")
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            prefix = "async def" if isinstance(item, ast.AsyncFunctionDef) else "def"
                            args = [a.arg for a in item.args.args]
                            item_end = getattr(item, "end_lineno", item.lineno)
                            outline.append(f"    {prefix} {item.name}({', '.join(args)}) (lines {item.lineno}-{item_end})")
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
                    args = [a.arg for a in node.args.args]
                    end_line = getattr(node, "end_lineno", node.lineno)
                    doc = ast.get_docstring(node)
                    doc_preview = f" - \"{doc.splitlines()[0][:60]}...\"" if doc else ""
                    outline.append(f"{prefix} {node.name}({', '.join(args)}) (lines {node.lineno}-{end_line}){doc_preview}")
        except Exception:
            pass

    # 2. Universal Structural / Regex extraction for JS, TS, TSX, C, C++, Java, Rust, Go
    if not outline:
        lines = code.splitlines()
        for idx, line in enumerate(lines, 1):
            s = line.strip()
            if re.match(r'^(export\s+)?(default\s+)?(class|function|interface|type)\s+[A-Za-z0-9_]+', s):
                outline.append(f"L{idx}: {s[:90]}")
            elif re.match(r'^(export\s+)?const\s+[A-Za-z0-9_]+\s*=\s*(async\s+)?(\([^)]*\)|[A-Za-z0-9_]+)\s*=>', s):
                outline.append(f"L{idx}: {s[:90]}")
            elif s.startswith("def ") or s.startswith("class ") or s.startswith("async def "):
                outline.append(f"L{idx}: {s[:90]}")
            elif re.match(r'^(pub\s+)?(fn|struct|enum|impl|trait)\s+[A-Za-z0-9_]+', s):
                outline.append(f"L{idx}: {s[:90]}")
            elif re.match(r'^(public|private|protected|static|void|int|char|bool|float|double|auto)\s+[A-Za-z0-9_]+\s*\(', s):
                outline.append(f"L{idx}: {s[:90]}")

    total_lines = len(code.splitlines())
    if not outline:
        return f"[Outline for '{clean_path}' ({total_lines} lines)]: No top-level class or function declarations detected."

    return f"[AST Outline for '{clean_path}' ({total_lines} lines)]:\n" + "\n".join(outline[:120])


def tool_view_file(file_path: str = "", path: Optional[str] = None, start_line: int = 1, end_line: int = 120) -> str:
    """
    Reads specific lines from a file in the workspace.
    Use this for large files to inspect only the lines of interest without blowing context limits.
    Line numbers are 1-indexed.
    """
    target_path = file_path or path or ""
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    clean_path = target_path.replace("\\", "/").lstrip("/")
    full_path = os.path.abspath(os.path.join(base, clean_path))

    if not os.path.exists(full_path):
        return f"[Error: File '{clean_path}' does not exist in workspace]"
    if not os.path.isfile(full_path):
        return f"[Error: '{clean_path}' is a directory, not a file]"

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        total = len(lines)
        start = max(1, start_line)
        end = min(total, max(start, end_line))
        slice_lines = lines[start - 1 : end]
        formatted = "".join(f"L{start + i}: {line}" for i, line in enumerate(slice_lines))
        return f"[File: {clean_path} (Lines {start}-{end} of {total})]\n{formatted}"
    except Exception as e:
        return f"[Error reading {clean_path}: {e}]"


def tool_grep_search(query: str = "", search_path: str = "", q: Optional[str] = None, path: Optional[str] = None) -> str:
    """
    Searches for text or regex pattern across workspace files.
    Returns matching file paths, line numbers, and snippets.
    """
    effective_query = query or q or ""
    effective_path = search_path or path or ""
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    search_root = os.path.abspath(os.path.join(base, effective_path.replace("\\", "/").lstrip("/"))) if effective_path else base

    ignored = {".git", "node_modules", "dist", "target", "build", ".venv", "venv", "__pycache__", "binaries"}
    matches = []

    try:
        regex = re.compile(effective_query, re.IGNORECASE)
    except Exception:
        regex = re.compile(re.escape(effective_query), re.IGNORECASE)

    for root, dirs, files in os.walk(search_root):
        dirs[:] = [d for d in dirs if d not in ignored and not d.startswith(".")]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in {".exe", ".dll", ".bin", ".png", ".jpg", ".zip", ".pyc"}:
                continue
            full_file = os.path.join(root, file)
            rel_file = os.path.relpath(full_file, base).replace("\\", "/")
            try:
                with open(full_file, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, 1):
                        if regex.search(line):
                            matches.append(f"{rel_file}:{line_no}: {line.strip()[:140]}")
                            if len(matches) >= 30:
                                return f"[Found 30+ matches for '{effective_query}']:\n" + "\n".join(matches)
            except Exception:
                continue

    if not matches:
        return f"[No matches found for '{effective_query}']"
    return f"[Found {len(matches)} matches for '{effective_query}']:\n" + "\n".join(matches)


def tool_find_by_name(pattern: str = "", query: Optional[str] = None, name: Optional[str] = None) -> str:
    """
    Searches for files matching a glob pattern (e.g. *.py, *server*, *.json).
    Returns matching relative file paths.
    """
    pat = pattern or query or name or ""
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    ignored = {".git", "node_modules", "dist", "target", "build", ".venv", "venv", "__pycache__", "binaries"}
    matched = []

    pat_lower = pat.lower()
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in ignored and not d.startswith(".")]
        for file in files:
            if fnmatch.fnmatch(file.lower(), pat_lower) or fnmatch.fnmatch(file.lower(), f"*{pat_lower}*"):
                rel = os.path.relpath(os.path.join(root, file), base).replace("\\", "/")
                matched.append(rel)
                if len(matched) >= 40:
                    break
    if not matched:
        return f"[No files matching '{pat}']"
    return f"[Matching files for '{pat}']:\n" + "\n".join(matched)


def tool_write_to_file(
    file_path: str = "",
    content: str = "",
    path: Optional[str] = None,
    code_content: Optional[str] = None,
    code: Optional[str] = None,
    overwrite: bool = True
) -> str:
    """
    Creates a new file or overwrites an existing file with the provided content.
    Automatically creates parent directories. Snapshots the original file for instant rollback.
    Validates Python syntax via in-RAM AST parse before committing to disk.
    """
    target_path = file_path or path or ""
    effective_content = code_content if code_content is not None else (code if code is not None else content)
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    clean_path = target_path.replace("\\", "/").lstrip("/")
    full_path = os.path.abspath(os.path.join(base, clean_path))

    if not full_path.startswith(os.path.abspath(base)):
        return "[Error: Target path outside workspace bounds]"

    # Pre-Flight In-RAM AST Syntax Gate for Python files
    if clean_path.endswith(".py") and effective_content.strip():
        try:
            ast.parse(effective_content)
        except SyntaxError as syn_err:
            return (
                f"[Pre-Flight AST Syntax Gate Error in '{clean_path}']:\n"
                f"SyntaxError at line {syn_err.lineno}: {syn_err.msg}\n"
                f"Offending line: {syn_err.text or ''}\n"
                f"Please correct this syntax error before committing to disk."
            )

    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    if os.path.exists(full_path):
        if not overwrite:
            return f"[Error: File '{clean_path}' already exists and overwrite=False]"
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                FILE_SNAPSHOTS[clean_path] = f.read()
        except Exception:
            pass

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(effective_content)

    line_count = len(effective_content.splitlines())
    return f"[Successfully wrote '{clean_path}' ({line_count} lines, {len(effective_content.encode('utf-8'))} bytes)]"


def tool_replace_file_content(
    file_path: str = "",
    target_content: str = "",
    replacement_content: str = "",
    path: Optional[str] = None,
    target: Optional[str] = None,
    replacement: Optional[str] = None
) -> str:
    """
    Surgically replaces an exact or newline-normalized text block in an existing file.
    Snapshots original file before modification. Supports whole-file template fallback.
    """
    target_path = file_path or path or ""
    tgt = target_content if target_content else (target or "")
    rep = replacement_content if replacement_content is not None else (replacement or "")
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    clean_path = target_path.replace("\\", "/").lstrip("/")
    full_path = os.path.abspath(os.path.join(base, clean_path))

    if not os.path.exists(full_path):
        return f"[Error: File '{clean_path}' does not exist]"

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            original = f.read()

        # If target content is empty or matches whole file, route to tool_write_to_file directly
        if not tgt.strip() or tgt.strip() == original.strip():
            return tool_write_to_file(file_path=clean_path, content=rep, overwrite=True)

        updated = None
        match_found = False

        # 1. Exact character-sequence match
        if tgt in original:
            FILE_SNAPSHOTS[clean_path] = original
            updated = original.replace(tgt, rep, 1)
            match_found = True
        else:
            # 2. Line-ending normalized match (\r\n vs \n)
            orig_lf = original.replace("\r\n", "\n")
            tgt_lf = tgt.replace("\r\n", "\n")
            rep_lf = rep.replace("\r\n", "\n")
            if tgt_lf in orig_lf:
                FILE_SNAPSHOTS[clean_path] = original
                updated = orig_lf.replace(tgt_lf, rep_lf, 1)
                match_found = True
            else:
                # 3. Stripped line-by-line fuzzy match
                tgt_lines = [l.strip() for l in tgt.splitlines() if l.strip()]
                orig_lines = original.splitlines()
                if tgt_lines and len(tgt_lines) <= len(orig_lines):
                    for start_idx in range(len(orig_lines) - len(tgt_lines) + 1):
                        slice_lines = [l.strip() for l in orig_lines[start_idx : start_idx + len(tgt_lines)]]
                        if slice_lines == tgt_lines:
                            # Reconstruct replacement
                            before = "\n".join(orig_lines[:start_idx])
                            after = "\n".join(orig_lines[start_idx + len(tgt_lines):])
                            updated = (before + "\n" if before else "") + rep + ("\n" + after if after else "")
                            FILE_SNAPSHOTS[clean_path] = original
                            match_found = True
                            break

        if not match_found or updated is None:
            preview_lines = "\n".join(original.splitlines()[:20])
            return (
                f"[Error: Target content block not found in '{clean_path}']\n"
                f"Make sure target_content matches the file contents, or use tool_write_to_file to overwrite the file.\n"
                f"[Current File Preview ({clean_path})]:\n{preview_lines}"
            )

        # Pre-Flight In-RAM AST validation for Python files
        if clean_path.endswith(".py"):
            try:
                ast.parse(updated)
            except SyntaxError as syn_err:
                return (
                    f"[Pre-Flight AST Syntax Gate Error in '{clean_path}']:\n"
                    f"Applying replacement causes SyntaxError at line {syn_err.lineno}: {syn_err.msg}\n"
                    f"Please adjust replacement_content to maintain valid syntax."
                )

        with open(full_path, "w", encoding="utf-8") as f:
            f.write(updated)

        diff_lines = list(difflib.unified_diff(
            original.splitlines(keepends=True),
            updated.splitlines(keepends=True),
            fromfile=f"a/{clean_path}",
            tofile=f"b/{clean_path}",
            n=2
        ))
        diff_preview = "".join(diff_lines[:40]) if diff_lines else "(identical content)"

        return f"[Successfully updated '{clean_path}']\n[Unified Diff Preview]:\n{diff_preview}"
    except Exception as e:
        return f"[Error updating '{clean_path}': {e}]"


def tool_run_command(command: str = "", cmd: Optional[str] = None, cwd: str = "", timeout_seconds: int = 60) -> str:
    """
    Runs a terminal/shell command in the workspace.
    Automatically detects and activates the project's virtualenv Python/pip.
    Captures exit code, stdout, and stderr.
    """
    global CURRENT_CANCEL_CTX
    if CURRENT_CANCEL_CTX and CURRENT_CANCEL_CTX.get("is_cancelled"):
        return "[Execution cancelled by user]"

    raw_cmd = command if command else cmd
    if isinstance(raw_cmd, dict):
        raw_cmd = (
            raw_cmd.get("command")
            or raw_cmd.get("cmd")
            or raw_cmd.get("value")
            or (raw_cmd.get("description") if raw_cmd.get("description") != "The exact shell command line to run" else "")
            or ""
        )
    effective_cmd = str(raw_cmd or "").strip()
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    work_dir = os.path.abspath(os.path.join(base, cwd.replace("\\", "/").lstrip("/"))) if cwd else base

    py_exe = discover_project_python(base)
    resolved_cmd = effective_cmd

    # Virtual environment auto-substitution
    if resolved_cmd.startswith("python "):
        resolved_cmd = f'"{py_exe}" ' + resolved_cmd[7:]
    elif resolved_cmd.startswith("python3 "):
        resolved_cmd = f'"{py_exe}" ' + resolved_cmd[8:]
    elif resolved_cmd.startswith("pip ") or resolved_cmd.startswith("pip3 "):
        pkg_part = resolved_cmd.split(" ", 1)[1]
        resolved_cmd = f'"{py_exe}" -m pip ' + pkg_part
    elif resolved_cmd.startswith("pytest "):
        resolved_cmd = f'"{py_exe}" -m pytest ' + resolved_cmd[7:]
    elif (resolved_cmd.endswith(".py") or ".py " in resolved_cmd) and not resolved_cmd.startswith("python"):
        resolved_cmd = f'"{py_exe}" {resolved_cmd}'

    proc = None
    try:
        # Check if command launches a continuous GUI app or long-running web server
        is_daemon_or_gui = any(k in resolved_cmd.lower() for k in [
            "tkinter", "turtle", "pygame", "node ", "npm start", "npm run", "uvicorn", "flask", "http.server"
        ]) or ("game" in resolved_cmd.lower())

        proc = subprocess.Popen(
            resolved_cmd,
            shell=True,
            cwd=work_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if CURRENT_CANCEL_CTX is not None:
            CURRENT_CANCEL_CTX["proc"] = proc

        if is_daemon_or_gui:
            # Non-blocking health probe: Allow 2.5s for immediate crashes/tracebacks
            time.sleep(2.5)
            if proc.poll() is None:
                return (
                    f"[Command: {command}]\n"
                    f"[PID: {proc.pid}]\n"
                    f"[Exit Code: 0 (Active Daemon)]\n"
                    f"STDOUT:\nProcess started successfully and is running in background (PID {proc.pid})."
                )

        stdout, stderr = proc.communicate(timeout=timeout_seconds)
        code = proc.returncode

        out_summary = []
        if stdout:
            clean_out = stdout.strip()
            if len(clean_out) > 6000:
                clean_out = clean_out[:3000] + "\n...[truncated]...\n" + clean_out[-3000:]
            out_summary.append(f"STDOUT:\n{clean_out}")
        if stderr:
            clean_err = stderr.strip()
            if len(clean_err) > 6000:
                clean_err = clean_err[:3000] + "\n...[truncated]...\n" + clean_err[-3000:]
            out_summary.append(f"STDERR:\n{clean_err}")

        output_body = "\n".join(out_summary) if out_summary else "(No output)"
        return f"[Command: {command}]\n[Exit Code: {code}]\n{output_body}"
    except subprocess.TimeoutExpired:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        return f"[Command: {command}]\n[Error: Timed out after {timeout_seconds}s]"
    except Exception as e:
        return f"[Command: {command}]\n[Error: {e}]"
    finally:
        if CURRENT_CANCEL_CTX is not None and CURRENT_CANCEL_CTX.get("proc") == proc:
            CURRENT_CANCEL_CTX["proc"] = None


def tool_get_blast_radius(symbol_or_file: str) -> str:
    """
    Inspects workspace AST dependencies and callers to check what other files/functions break if symbol_or_file is modified.
    """
    res = tool_grep_search(symbol_or_file)
    return f"[Neuron AST Blast Radius Analysis for '{symbol_or_file}']:\n{res}"


def tool_update_memory(rule_name: str, instruction: str) -> str:
    """
    Persists a project convention, architectural rule, or developer preference to '.neuron/memory.md'.
    Future AI sessions across all models will automatically load and follow this guideline.
    """
    base = ACTIVE_AGENT_WORKSPACE or os.getcwd()
    neuron_dir = os.path.join(base, ".neuron")
    os.makedirs(neuron_dir, exist_ok=True)
    mem_path = os.path.join(neuron_dir, "memory.md")

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    entry = f"\n### [{rule_name}] (Added: {timestamp})\n{instruction.strip()}\n"

    try:
        with open(mem_path, "a", encoding="utf-8") as f:
            f.write(entry)
        return f"[Successfully persisted memory rule '{rule_name}' to .neuron/memory.md]"
    except Exception as e:
        return f"[Error updating memory: {e}]"


def read_project_rules(target_dir: Optional[str] = None) -> str:
    """Reads persistent project rules or developer instructions (.neuronrules, memory.md, CLAUDE.md, .cursorrules)."""
    base = target_dir or ACTIVE_AGENT_WORKSPACE or os.getcwd()
    rule_files = [".neuronrules", "CLAUDE.md", ".cursorrules", ".neuron/memory.md"]
    rules_collected = []
    for r in rule_files:
        p = os.path.join(base, r)
        if os.path.exists(p) and os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(4000).strip()
                    if content:
                        rules_collected.append(f"[PERSISTENT RULES from {r}]:\n{content}")
            except Exception:
                pass
    if rules_collected:
        return "\n\n" + "\n\n".join(rules_collected) + "\n"
    return ""


def rollback_all_snapshots(target_dir: Optional[str] = None) -> List[str]:
    """Rolls back all files modified in the current session."""
    base = target_dir or ACTIVE_AGENT_WORKSPACE or os.getcwd()
    restored = []
    for rel_path, original_code in list(FILE_SNAPSHOTS.items()):
        full_path = os.path.abspath(os.path.join(base, rel_path))
        try:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(original_code)
            restored.append(rel_path)
        except Exception:
            pass
    FILE_SNAPSHOTS.clear()
    return restored


TOOL_DISPATCH = {
    "tool_view_file": tool_view_file,
    "tool_get_file_outline": tool_get_file_outline,
    "tool_grep_search": tool_grep_search,
    "tool_find_by_name": tool_find_by_name,
    "tool_write_to_file": tool_write_to_file,
    "tool_replace_file_content": tool_replace_file_content,
    "tool_run_command": tool_run_command,
    "tool_get_blast_radius": tool_get_blast_radius,
    "tool_update_memory": tool_update_memory,
}


DISCOVERED_KEY_CACHE: Dict[str, Dict[str, Any]] = {}


def score_discovered_model(model_id: str, meta: Optional[Dict[str, Any]] = None) -> float:
    """
    Universally scores any discovered model using its live API metadata and structural version signals.
    Contains ZERO hardcoded model names.
    """
    meta = meta or {}
    m_lower = (model_id or "").lower().strip()
    score = 0.0

    # 1. Strip date stamps, build numbers, context sizes, and parameter counts before version extraction
    m_clean = re.sub(r'[-_]?20\d{2}[-_]\d{2}[-_]\d{2}', '', m_lower)
    m_clean = re.sub(r'[-_]?20\d{6}', '', m_clean)
    m_clean = re.sub(r'[-_](?:0[1-9]|1[0-2])[-_](?:0[1-9]|[12]\d|3[01])(?=[-_]|$)', '', m_clean)
    m_clean = re.sub(r'[-_]\d{3,6}(?=[-_]|$)', '', m_clean)
    m_clean = re.sub(r'(?:^|[-_/])\d+x\d+(?:\.\d+)?b(?=[-_/]|$)', '', m_clean)
    m_clean = re.sub(r'(?:^|[-_/])\d+(?:\.\d+)?[bkm](?=[-_/]|$)', '', m_clean)

    # Normalize hyphenated major-minor versions (e.g. -3-7- -> -3.7-)
    m_clean = re.sub(r'(?<=[-_a-z])([1-9])-(\d)(?=[-_]|$)', r'\1.\2', m_clean)

    ver_tokens = re.findall(r'(?:^|[-_/a-z])(\d+(?:\.\d+)?)(?=[-_/a-z]|$)', m_clean)
    valid_versions = []
    for vt in ver_tokens:
        if vt.startswith("0") and len(vt) > 1 and not vt.startswith("0."):
            continue
        try:
            val = float(vt)
            if 1.0 <= val < 20.0:
                valid_versions.append(val)
        except ValueError:
            pass

    if valid_versions:
        score += max(valid_versions) * 1000.0

    # 2. Parameter size signal (e.g., 70b, 405b)
    param_matches = re.findall(r'(?:^|[-_/x])(\d+(?:\.\d+)?)b(?=[-_/]|$)', m_lower)
    if param_matches:
        try:
            max_params = max(float(p) for p in param_matches)
            score += min(max_params * 2.0, 300.0)
        except ValueError:
            pass

    # 3. Token capacity from live API metadata
    out_limit = float(
        meta.get("outputTokenLimit")
        or meta.get("max_completion_tokens")
        or meta.get("max_output_tokens")
        or 0
    )
    in_limit = float(
        meta.get("inputTokenLimit")
        or meta.get("context_window")
        or meta.get("context_length")
        or 0
    )
    score += min(out_limit / 500.0, 150.0)
    score += min(in_limit / 50000.0, 100.0)

    # 4. Release timestamp from live API metadata
    created = meta.get("created")
    if isinstance(created, (int, float)) and created > 1500000000:
        score += min(max((created - 1700000000) / 500000.0, 0.0), 300.0)

    # 5. Structural tier modifiers (no model names hardcoded)
    if any(t in m_lower for t in ("flagship", "opus", "pro", "sonnet", "large", "versatile", "coder")):
        score += 220.0
    if "flash" in m_lower and "lite" not in m_lower and "8b" not in m_lower:
        score += 240.0

    if any(t in m_lower for t in ("lite", "nano", "mini", "haiku", "tiny", "micro", "instant", "small")):
        score -= 180.0
    if any(t in m_lower for t in ("exp", "preview", "beta", "test")):
        score -= 60.0
    if "latest" in m_lower:
        score += 25.0

    return score


async def _probe_google_models(api_key: str) -> Optional[Dict[str, Any]]:
    """Queries Google's live /v1beta/models endpoint to discover available models for this key."""
    excluded_terms = (
        "embedding", "imagen", "veo", "aqa", "tts", "whisper", "audio",
        "robotics", "learnlm", "bisect", "-vision", "computer-use", "image-generation"
    )
    scored_models = []
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                "https://generativelanguage.googleapis.com/v1beta/models",
                params={"key": api_key, "pageSize": 100}
            )
            if res.status_code == 200:
                data = res.json()
                for m in data.get("models", []):
                    raw_name = m.get("name", "") or ""
                    clean_id = raw_name.replace("models/", "").strip()
                    if not clean_id:
                        continue
                    methods = m.get("supportedGenerationMethods") or []
                    if methods and "generateContent" not in methods:
                        continue
                    c_lower = clean_id.lower()
                    if any(term in c_lower for term in excluded_terms):
                        continue
                    scored_models.append((score_discovered_model(clean_id, m), clean_id))
    except Exception as e:
        print(f"[DEBUG] Google HTTP model discovery error: {e}")

    if not scored_models and GENAI_SDK_AVAILABLE:
        try:
            g_client = genai.Client(api_key=api_key)
            for m in g_client.models.list():
                raw_name = getattr(m, "name", "") or ""
                clean_id = raw_name.replace("models/", "").strip()
                if not clean_id:
                    continue
                c_lower = clean_id.lower()
                if any(term in c_lower for term in excluded_terms):
                    continue
                scored_models.append((score_discovered_model(clean_id, {}), clean_id))
        except Exception as e:
            print(f"[DEBUG] Google SDK model discovery error: {e}")

    if scored_models:
        scored_models.sort(key=lambda x: x[0], reverse=True)
        ranked = []
        for _, mid in scored_models:
            if mid not in ranked:
                ranked.append(mid)
        return {
            "valid": True,
            "provider": "Google AI",
            "protocol": "google",
            "base_url": "https://generativelanguage.googleapis.com/v1beta",
            "models": ranked,
            "best_model": ranked[0]
        }
    return None


async def _probe_anthropic_models(api_key: str) -> Optional[Dict[str, Any]]:
    """Queries Anthropic's live /v1/models endpoint to discover available models for this key."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01"
                }
            )
            if res.status_code == 200:
                data = res.json()
                scored = []
                for m in data.get("data", []):
                    mid = (m.get("id") or "").strip()
                    if not mid:
                        continue
                    scored.append((score_discovered_model(mid, m), mid))
                if scored:
                    scored.sort(key=lambda x: x[0], reverse=True)
                    ranked = [mid for _, mid in scored]
                    return {
                        "valid": True,
                        "provider": "Anthropic",
                        "protocol": "anthropic",
                        "base_url": "https://api.anthropic.com/v1",
                        "models": ranked,
                        "best_model": ranked[0]
                    }
    except Exception:
        pass
    return None


async def _probe_openai_compat_models(
    api_key: str,
    provider_name: str,
    base_url: str,
    auth_verify_url: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Queries any OpenAI-compatible /models endpoint to discover available models for this key."""
    excluded_terms = (
        "embedding", "tts", "whisper", "dall-e", "moderation", "realtime",
        "audio", "transcribe", "guard", "babbage", "davinci", "canary",
        "search", "image", "vision-preview", "omni-moderation"
    )
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            if auth_verify_url:
                auth_res = await client.get(auth_verify_url, headers=headers)
                if auth_res.status_code != 200:
                    return None
                auth_json = auth_res.json()
                if not auth_json.get("data"):
                    return None

            res = await client.get(f"{base_url.rstrip('/')}/models", headers=headers)
            if res.status_code == 200:
                body = res.json()
                items = body.get("data") if isinstance(body, dict) and "data" in body else (body if isinstance(body, list) else [])
                scored = []
                for m in items:
                    if not isinstance(m, dict):
                        continue
                    mid = (m.get("id") or m.get("name") or "").strip()
                    if not mid:
                        continue
                    m_low = mid.lower()
                    if any(term in m_low for term in excluded_terms):
                        continue
                    scored.append((score_discovered_model(mid, m), mid))
                if scored:
                    scored.sort(key=lambda x: x[0], reverse=True)
                    ranked = []
                    for _, mid in scored:
                        if mid not in ranked:
                            ranked.append(mid)
                    return {
                        "valid": True,
                        "provider": provider_name,
                        "protocol": "openai_compat",
                        "base_url": base_url.rstrip("/"),
                        "models": ranked,
                        "best_model": ranked[0]
                    }
    except Exception:
        pass
    return None


async def discover_key_and_models(api_key: str, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Automatically detects which AI provider an API key belongs to by running live discovery requests,
    retrieves all available models for that key, and ranks them to select the best model automatically.
    Contains ZERO hardcoded model names.
    """
    clean_key = (api_key or "").strip()
    if not clean_key:
        return {
            "valid": False,
            "provider": None,
            "protocol": None,
            "base_url": None,
            "models": [],
            "best_model": None,
            "error": "Empty API key"
        }

    key_hash = hashlib.sha256(clean_key.encode("utf-8")).hexdigest()
    now = time.time()
    if not force_refresh and key_hash in DISCOVERED_KEY_CACHE:
        cached = DISCOVERED_KEY_CACHE[key_hash]
        if now - cached.get("timestamp", 0) < 600:
            return cached["data"]

    # 1. Fast prefix-prioritized probe
    result = None
    if clean_key.startswith("AIza"):
        result = await _probe_google_models(clean_key)
    elif clean_key.startswith("sk-ant-"):
        result = await _probe_anthropic_models(clean_key)
    elif clean_key.startswith("gsk_"):
        result = await _probe_openai_compat_models(clean_key, "Groq", "https://api.groq.com/openai/v1")
    elif clean_key.startswith("sk-or-"):
        result = await _probe_openai_compat_models(
            clean_key, "OpenRouter", "https://openrouter.ai/api/v1", "https://openrouter.ai/api/v1/auth/key"
        )
    elif clean_key.startswith("xai-"):
        result = await _probe_openai_compat_models(clean_key, "xAI", "https://api.x.ai/v1")
    elif clean_key.startswith("csk-"):
        result = await _probe_openai_compat_models(clean_key, "Cerebras", "https://api.cerebras.ai/v1")

    # 2. Universal parallel probe across all supported providers if prefix didn't resolve
    if not result:
        probes = [
            _probe_google_models(clean_key),
            _probe_openai_compat_models(clean_key, "OpenAI", "https://api.openai.com/v1"),
            _probe_anthropic_models(clean_key),
            _probe_openai_compat_models(clean_key, "Groq", "https://api.groq.com/openai/v1"),
            _probe_openai_compat_models(clean_key, "DeepSeek", "https://api.deepseek.com"),
            _probe_openai_compat_models(clean_key, "xAI", "https://api.x.ai/v1"),
            _probe_openai_compat_models(clean_key, "Mistral", "https://api.mistral.ai/v1"),
            _probe_openai_compat_models(clean_key, "Cerebras", "https://api.cerebras.ai/v1"),
            _probe_openai_compat_models(
                clean_key, "OpenRouter", "https://openrouter.ai/api/v1", "https://openrouter.ai/api/v1/auth/key"
            ),
        ]
        probe_results = await asyncio.gather(*probes, return_exceptions=True)
        for pr in probe_results:
            if isinstance(pr, dict) and pr.get("valid") and pr.get("models"):
                result = pr
                break

    if result and result.get("valid"):
        DISCOVERED_KEY_CACHE[key_hash] = {"timestamp": now, "data": result}
        return result

    return {
        "valid": False,
        "provider": None,
        "protocol": None,
        "base_url": None,
        "models": [],
        "best_model": None,
        "error": "Could not authenticate API key or no compatible models found for this key."
    }



OLLAMA_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "tool_run_command",
            "description": "Executes a terminal or shell command in the workspace directory (e.g. running scripts, unit tests, or test runners) and returns exit code, stdout, and stderr.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The exact shell command line to run"}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_write_to_file",
            "description": "Creates a new file or completely overwrites code to a file path in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Relative file path (e.g. 'game.py', 'src/app.py')"},
                    "code_content": {"type": "string", "description": "Complete content to write to the file"}
                },
                "required": ["file_path", "code_content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_replace_file_content",
            "description": "Surgically replaces a specific block of text in an existing file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Relative path of file to edit"},
                    "target_content": {"type": "string", "description": "Exact text chunk to replace"},
                    "replacement_content": {"type": "string", "description": "New replacement text"}
                },
                "required": ["file_path", "target_content", "replacement_content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_view_file",
            "description": "Reads specific lines of a file in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Relative path of file"},
                    "start_line": {"type": "integer", "description": "Starting line (1-indexed)"},
                    "end_line": {"type": "integer", "description": "Ending line (inclusive)"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_get_file_outline",
            "description": "Extracts AST outline (classes, functions, imports) in compact token form.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Relative path of file"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_grep_search",
            "description": "Searches for a regex pattern or symbol across workspace files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Pattern or symbol to search"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_find_by_name",
            "description": "Locates files in the workspace matching a name or glob pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "File name pattern (e.g. '*.py')"}
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tool_update_memory",
            "description": "Saves an architectural rule or developer preference to .neuron/memory.md.",
            "parameters": {
                "type": "object",
                "properties": {
                    "rule_name": {"type": "string", "description": "Name of the rule or convention"},
                    "instruction": {"type": "string", "description": "Rule instruction or guideline"}
                },
                "required": ["rule_name", "instruction"]
            }
        }
    }
]


def parse_tool_calls_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Extracts structured tool calls from model text output when models format actions as JSON code blocks or raw JSON.
    Uses balanced brace parsing so nested arguments (e.g. {"arguments": {"command": "..."}}) are never truncated.
    """
    calls = []
    if not text:
        return calls

    def unwrap_args(raw_args: Any) -> Dict[str, Any]:
        if not isinstance(raw_args, dict):
            return {}
        cleaned = {}
        for k, v in raw_args.items():
            if isinstance(v, str):
                s = v.strip()
                if s.startswith("{") and s.endswith("}"):
                    try:
                        import ast
                        parsed = ast.literal_eval(s)
                        if isinstance(parsed, dict):
                            v = parsed
                    except Exception:
                        m = re.search(r"['\"](?:description|value|command|cmd)['\"]\s*:\s*['\"]([^'\"]+)['\"]", s)
                        if m:
                            v = m.group(1).strip()
            if isinstance(v, dict):
                desc = v.get("description", "")
                if isinstance(desc, str) and desc.strip() and not desc.startswith("The exact shell") and not desc.startswith("Relative"):
                    cleaned[k] = desc.strip()
                elif "value" in v:
                    cleaned[k] = v["value"]
                elif "command" in v:
                    cleaned[k] = v["command"]
                elif "file_path" in v:
                    cleaned[k] = v["file_path"]
                elif "code_content" in v:
                    cleaned[k] = v["code_content"]
                elif "cmd" in v:
                    cleaned[k] = v["cmd"]
                elif len(v) == 1:
                    cleaned[k] = list(v.values())[0]
                else:
                    cleaned[k] = str(v)
            else:
                cleaned[k] = v
        return cleaned

    # 1. Look for ```json { ... } ``` code blocks
    json_blocks = re.findall(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    for jb in json_blocks:
        try:
            parsed = json.loads(jb)
            name = parsed.get("name") or parsed.get("tool")
            args = parsed.get("arguments") or parsed.get("parameters") or {}
            if name and (name in TOOL_DISPATCH or name.startswith("tool_")):
                calls.append({"name": name, "args": unwrap_args(args)})
        except Exception:
            pass

    # 2. Balanced brace scanner for bare or inline JSON objects
    if not calls:
        idx = 0
        while idx < len(text):
            start = text.find('{', idx)
            if start == -1:
                break
            brace_count = 0
            in_string = False
            escape = False
            end = -1
            for i in range(start, len(text)):
                c = text[i]
                if escape:
                    escape = False
                    continue
                if c == '\\':
                    escape = True
                    continue
                if c == '"':
                    in_string = not in_string
                    continue
                if not in_string:
                    if c == '{':
                        brace_count += 1
                    elif c == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end = i + 1
                            break
            if end != -1:
                candidate = text[start:end]
                try:
                    obj = json.loads(candidate)
                    if isinstance(obj, dict):
                        name = obj.get("name") or obj.get("tool")
                        args = obj.get("arguments") or obj.get("parameters") or {}
                        if name and (name in TOOL_DISPATCH or name.startswith("tool_")):
                            calls.append({"name": name, "args": unwrap_args(args)})
                            idx = end
                            continue
                except Exception:
                    pass
            idx = start + 1

    return calls



def classify_prompt_intent(prompt: str, active_file: Optional[str] = None) -> str:
    """
    Classifies user prompt into operational intents:
      - 'CONVERSE': Pure greetings, chitchat, thank you, pure math, or general theory without workspace changes.
      - 'INSPECT': Read-only queries about existing code, files, structure, symbols.
      - 'MUTATE': Modifying existing files, refactoring, fixing bugs, templates.
      - 'CREATE_AND_RUN': Creating a new script/app/game and running it.
      - 'EXECUTE': Running a command, executing a file, running tests.
    """
    p = (prompt or "").strip().lower()
    p_clean = re.sub(r"[^\w\s]", "", p).strip()

    # 1. Direct conversational greetings & courtesy expressions
    greetings = {
        "hi", "hello", "hey", "heyy", "yo", "sup", "howdy", "hola",
        "good morning", "good afternoon", "good evening", "good night",
        "say hello", "say hi", "greet me", "man are you good", "are you good",
        "are you ok", "how are you", "who are you", "what are you", "what can you do",
        "help", "help me", "thanks", "thank you", "bye", "goodbye", "cool", "nice",
        "awesome", "great", "ok", "okay"
    }
    if p_clean in greetings:
        return "CONVERSE"

    # Conversational questions starting with common chitchat patterns
    if re.match(r"^(hi|hello|hey|yo|howdy|who are you|how are you|man are you|can you hear me)\b", p):
        if not re.search(r"\b(write|create|make|run|build|modify|refactor|fix|edit|inspect|search|install|code|file|function)\b", p):
            return "CONVERSE"

    # Pure arithmetic expressions (e.g. "what is 12 * 12?", "2 + 2", "calculate 500 / 25")
    math_match = re.match(r"^(what is|calculate|solve|eval|compute)?\s*[\d\s\+\-\*\/\^\(\)\.]+\??$", p)
    if math_match and not any(ext in p for ext in [".py", ".js", "file", "function"]):
        return "CONVERSE"

    # 2. Multi-step: Create and Run
    has_create = bool(re.search(r"\b(create|make|write|implement|build|generate|add)\b", p))
    has_run = bool(re.search(r"\b(run|play|launch|execute|start|test)\b", p))
    if has_create and has_run:
        return "CREATE_AND_RUN"

    # 3. Code Mutation / Editing / Templates
    has_mutate = bool(re.search(r"\b(change|modify|replace|refactor|fix|update|rewrite|template|patch|debug)\b", p))
    if has_mutate:
        return "MUTATE"

    # 4. Pure Execution
    if has_run and not has_create:
        return "EXECUTE"

    # 5. Inspection / Read-only
    has_inspect = bool(re.search(r"\b(what|explain|how does|show|outline|find|search|where|list|view|read|inspect)\b", p))
    if has_inspect:
        return "INSPECT"

    if has_create:
        return "MUTATE"

    # Default fallback: short queries without code keywords are conversational
    code_indicators = [".py", ".js", ".ts", ".html", ".css", ".json", "def ", "class ", "function", "var ", "const "]
    if len(p.split()) <= 4 and not any(ind in p for ind in code_indicators):
        return "CONVERSE"

    return "INSPECT"


def infer_operational_tool_calls(
    prompt: str,
    response_text: str,
    active_file: Optional[str],
    target_dir: Optional[str],
    turn: int = 0,
    prev_failed: bool = False
) -> List[Dict[str, Any]]:
    """
    Autonomous fallback: If a local model generates tutorial text instead of direct tool calls,
    identifies operational execution intents (e.g. running scripts or creating games) and triggers real tools.
    Supports multi-turn self-correction auto-healing when a previous tool step encountered a failure.
    """
    calls = []
    p_lower = (prompt or "").strip().lower()

    # Zero-tool guarantee for conversational intent
    if classify_prompt_intent(prompt, active_file) == "CONVERSE":
        return []

    code_blocks = re.findall(r"```(?:python|javascript|typescript|html|css|json)?\r?\n([\s\S]*?)```", response_text)

    # Detect target filename from prompt or text
    target_file = None
    prompt_file_m = re.findall(r"[\w\.-]+\.(?:py|js|ts|html|css|json)", prompt, re.IGNORECASE)
    if prompt_file_m:
        target_file = prompt_file_m[0]
    else:
        file_hints = re.findall(
            r"(?:file named|saved in|save in|name it|named|file:?)\s+[`'\"]?([\w\.-]+\.(?:py|js|ts|html))[`'\"]?",
            response_text,
            re.IGNORECASE
        )
        if file_hints:
            target_file = file_hints[0]
        elif "snake" in p_lower:
            target_file = "snake.py"
        elif "game" in p_lower:
            target_file = "game.py"
        elif "calc" in p_lower:
            target_file = "calc.py"

    dest_file = target_file or active_file

    # 0. Autonomous Self-Correction Auto-Heal: Apply code fix and re-run to verify
    if prev_failed and code_blocks and dest_file:
        rel = dest_file.replace("\\", "/").lstrip("/")
        calls.append({"name": "tool_write_to_file", "args": {"file_path": rel, "code_content": code_blocks[0].strip(), "overwrite": True}})
        run_cmd = f"python {rel}" if rel.endswith(".py") else f"node {rel}"
        calls.append({"name": "tool_run_command", "args": {"command": run_cmd}})
        return calls

    has_create = bool(re.search(r"\b(make|create|write|implement|build|generate|add)\b", p_lower))
    has_run = bool(re.search(r"\b(run|play|launch|execute|start|test)\b", p_lower))

    # 1. Create file and optionally run it
    if (has_create or (code_blocks and target_file and not active_file)) and code_blocks and target_file:
        calls.append({"name": "tool_write_to_file", "args": {"file_path": target_file, "code_content": code_blocks[0].strip()}})
        if has_run:
            run_cmd = f"python {target_file}" if target_file.endswith(".py") else f"node {target_file}"
            calls.append({"name": "tool_run_command", "args": {"command": run_cmd}})
        return calls

    # 2. Template replacement or full rewrite of existing file
    has_template_or_rewrite = bool(re.search(r"\b(template|rewrite|change.*to|replace.*code|overwrite)\b", p_lower))
    if has_template_or_rewrite and code_blocks and dest_file:
        rel = dest_file.replace("\\", "/").lstrip("/")
        calls.append({"name": "tool_write_to_file", "args": {"file_path": rel, "code_content": code_blocks[0].strip(), "overwrite": True}})
        return calls

    # 3. Run a file or command
    if has_run:
        cmds = re.findall(r"```(?:bash|sh|cmd|powershell|text|python)?\r?\n(python[3]?\s+[^\n\r]+)```", response_text)
        if cmds:
            calls.append({"name": "tool_run_command", "args": {"command": cmds[0].strip()}})
        elif target_file:
            run_cmd = f"python {target_file}" if target_file.endswith(".py") else f"node {target_file}"
            calls.append({"name": "tool_run_command", "args": {"command": run_cmd}})
        elif active_file and re.search(r"\b(this file|the file|current file|server\.py)\b", p_lower):
            rel = active_file.replace("\\", "/").lstrip("/")
            cmd = f"python {rel}" if rel.endswith(".py") else f"node {rel}"
            calls.append({"name": "tool_run_command", "args": {"command": cmd}})

    return calls


# -------------------------------------------------------------------------
# 7. UNIVERSAL AUTONOMOUS AI AGENT STREAMING ENGINE
# -------------------------------------------------------------------------
async def stream_ai_chat(
    prompt: str,
    conversation_id: str,
    model: str = "auto",
    api_key: Optional[str] = None,
    context_code: Optional[str] = None,
    file_path: Optional[str] = None,
    target_dir: Optional[str] = None,
    cancel_ctx: Optional[Dict[str, Any]] = None,
    approval_mode: str = "auto",
    approval_handler: Optional[Any] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streams thoughts, autonomous tool execution steps, and response tokens in real-time.
    Automatically detects the provider and discovers all available models for any API key,
    selecting the best available model dynamically with zero hardcoded model names.
    """
    global ACTIVE_AGENT_WORKSPACE, CURRENT_CANCEL_CTX
    ACTIVE_AGENT_WORKSPACE = target_dir or os.getcwd()
    CURRENT_CANCEL_CTX = cancel_ctx

    effective_api_key = (
        api_key
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or ""
    ).strip()

    is_explicit_local = "ollama" in (model or "").lower() or "local" in (model or "").lower()
    intent = classify_prompt_intent(prompt, file_path)

    # Discover provider and live available models if an API key is active
    discovery: Optional[Dict[str, Any]] = None
    if effective_api_key and not is_explicit_local:
        yield {
            "type": "step",
            "step": "Auto-detecting API key & discovering available models...",
            "status": "running"
        }
        discovery = await discover_key_and_models(effective_api_key)
        if discovery.get("valid") and discovery.get("models"):
            prov = discovery.get("provider", "Cloud AI")
            best_m = discovery.get("best_model", "")
            m_count = len(discovery.get("models", []))
            yield {
                "type": "key_discovered",
                "provider": prov,
                "best_model": best_m,
                "model_count": m_count
            }
            yield {
                "type": "step",
                "step": f"Detected {prov} ({m_count} models available) · Selected {best_m}",
                "status": "done"
            }
        else:
            err_msg = (
                "### API Key Verification Failed\n\n"
                "Could not authenticate the configured API key or no compatible models were returned:\n\n"
                f"```\n{discovery.get('error', 'Authentication failed')}\n```\n\n"
                "Please check your API key in **Settings > AI** or switch to **Local AI**."
            )
            yield {"type": "token", "content": err_msg}
            yield {"type": "step", "step": "API Key Error", "status": "done"}
            yield {"type": "done", "content": err_msg, "refactor": None}
            return

    # =========================================================================
    # STAGE 0: ZERO-LATENCY COGNITIVE INTENT FIREWALL (CONVERSE)
    # =========================================================================
    if intent == "CONVERSE":
        conv_system = (
            "You are Neuron AI, the elite software engineer and coding assistant inside Neuron IDE. "
            "You are articulate, polite, concise, and helpful. "
            "Answer the user conversationally and directly in markdown. "
            "Do NOT run shell commands, file tools, or inspections for general conversation."
        )

        # Strategy A1: Cloud API Conversational Stream (Any Discovered Provider)
        if discovery and discovery.get("valid") and not is_explicit_local:
            protocol = discovery.get("protocol")
            base_url = discovery.get("base_url", "")
            candidate_models = discovery.get("models", [])

            for cand_model in candidate_models:
                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                    yield {"type": "done", "content": "[Execution stopped by user]", "refactor": None}
                    return
                try:
                    yield {
                        "type": "step",
                        "step": f"Synthesizing response ({cand_model})...",
                        "status": "running"
                    }
                    accumulated_text = ""

                    if protocol == "google" and GENAI_SDK_AVAILABLE:
                        client = genai.Client(api_key=effective_api_key)
                        config = genai_types.GenerateContentConfig(
                            system_instruction=conv_system,
                            temperature=0.7
                        )
                        stream_resp = await client.aio.models.generate_content_stream(
                            model=cand_model,
                            contents=prompt,
                            config=config
                        )
                        async for chunk in stream_resp:
                            if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                return
                            c_text = chunk.text or ""
                            if c_text:
                                accumulated_text += c_text
                                yield {"type": "token", "content": c_text}

                    elif protocol == "openai_compat":
                        headers = {
                            "Authorization": f"Bearer {effective_api_key}",
                            "Content-Type": "application/json"
                        }
                        payload = {
                            "model": cand_model,
                            "messages": [
                                {"role": "system", "content": conv_system},
                                {"role": "user", "content": prompt}
                            ],
                            "stream": True,
                            "temperature": 0.7
                        }
                        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=6.0)) as client:
                            async with client.stream("POST", f"{base_url}/chat/completions", headers=headers, json=payload) as resp:
                                if resp.status_code != 200:
                                    continue
                                async for line in resp.aiter_lines():
                                    if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                        yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                        yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                        return
                                    if not line or not line.startswith("data:"):
                                        continue
                                    data_str = line[5:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    try:
                                        chunk_obj = json.loads(data_str)
                                        choices = chunk_obj.get("choices") or []
                                        if choices:
                                            delta = choices[0].get("delta") or {}
                                            c_text = delta.get("content") or ""
                                            if c_text:
                                                accumulated_text += c_text
                                                yield {"type": "token", "content": c_text}
                                    except Exception:
                                        continue

                    elif protocol == "anthropic":
                        headers = {
                            "x-api-key": effective_api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        }
                        payload = {
                            "model": cand_model,
                            "max_tokens": 1024,
                            "system": conv_system,
                            "messages": [{"role": "user", "content": prompt}],
                            "stream": True
                        }
                        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=6.0)) as client:
                            async with client.stream("POST", f"{base_url}/messages", headers=headers, json=payload) as resp:
                                if resp.status_code != 200:
                                    continue
                                async for line in resp.aiter_lines():
                                    if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                        yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                        yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                        return
                                    if not line or not line.startswith("data:"):
                                        continue
                                    data_str = line[5:].strip()
                                    try:
                                        ev = json.loads(data_str)
                                        if ev.get("type") == "content_block_delta":
                                            c_text = (ev.get("delta") or {}).get("text") or ""
                                            if c_text:
                                                accumulated_text += c_text
                                                yield {"type": "token", "content": c_text}
                                    except Exception:
                                        continue

                    if accumulated_text.strip():
                        yield {"type": "step", "step": "Completed", "status": "done"}
                        yield {"type": "done", "content": accumulated_text.strip(), "refactor": None}
                        return
                except Exception as conv_err:
                    print(f"[DEBUG] Cloud converse candidate {cand_model} fallback: {conv_err}")
                    continue

        # Strategy B1: Pure Conversational Stream via Local Ollama
        ollama_model = await resolve_best_ollama_model()
        if ollama_model:
            yield {
                "type": "step",
                "step": f"Synthesizing response via local engine ({ollama_model})...",
                "status": "running"
            }

            conv_messages = [
                {"role": "system", "content": conv_system},
                {"role": "user", "content": prompt}
            ]
            ollama_payload = {
                "model": ollama_model,
                "messages": conv_messages,
                "stream": True,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 512
                }
            }

            accumulated_text = ""
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=5.0)) as client:
                    async with client.stream("POST", f"{OLLAMA_API_BASE}/api/chat", json=ollama_payload) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                    yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                    return
                                if line:
                                    try:
                                        chunk = json.loads(line)
                                        msg = chunk.get("message", {})
                                        c_part = msg.get("content", "")
                                        if c_part:
                                            accumulated_text += c_part
                                            yield {"type": "token", "content": c_part}
                                        if chunk.get("done", False):
                                            break
                                    except Exception:
                                        continue

                            yield {"type": "step", "step": "Completed", "status": "done"}
                            yield {"type": "done", "content": accumulated_text.strip(), "refactor": None}
                            return
            except Exception as ollama_err:
                print(f"[DEBUG] Ollama converse error: {ollama_err}")

        fallback_msg = "Hello! I am Neuron AI. How can I assist you with your code today?"
        yield {"type": "token", "content": fallback_msg}
        yield {"type": "step", "step": "Completed", "status": "done"}
        yield {"type": "done", "content": fallback_msg, "refactor": None}
        return

    # Discover and build grounded workspace context & developer rules for code tasks
    ws_context, files, project_name = get_workspace_context(target_dir, file_path, context_code)
    project_rules = read_project_rules(target_dir)

    # 1. Action Step: Analyzing workspace
    yield {
        "type": "step",
        "step": "Analyzing workspace context...",
        "status": "running"
    }
    await asyncio.sleep(0.01)
    yield {
        "type": "step",
        "step": f"Analyzed workspace ({len(files)} files, project: {project_name})",
        "status": "done"
    }

    if file_path:
        clean_name = os.path.basename(file_path)
        is_relevant = (
            clean_name.lower() in prompt.lower()
            or bool(re.search(r"\b(this file|the file|current file|here|this)\b", prompt, re.IGNORECASE))
            or intent in ("INSPECT", "MUTATE")
        )
        if is_relevant:
            yield {
                "type": "step",
                "step": f"Inspected {clean_name}",
                "status": "done"
            }

    full_prompt = f"{ws_context}\n{project_rules}\n\n[USER INSTRUCTION]\n{prompt}".strip()

    # Helper for cleaning tool arguments and generating step labels
    def clean_tool_arg(val: Any) -> Any:
        if isinstance(val, str):
            s = val.strip()
            if s.startswith("{") and s.endswith("}"):
                try:
                    parsed = ast.literal_eval(s)
                    if isinstance(parsed, dict):
                        return clean_tool_arg(parsed)
                except Exception:
                    m = re.search(r"['\"](?:description|value|command|cmd)['\"]\s*:\s*['\"]([^'\"]+)['\"]", s)
                    if m:
                        return m.group(1).strip()
            return val
        if isinstance(val, dict):
            desc = val.get("description", "")
            if isinstance(desc, str) and desc.strip() and not desc.startswith("The exact shell") and not desc.startswith("Relative"):
                return desc.strip()
            for k_cand in ("value", "command", "file_path", "code_content", "cmd"):
                if k_cand in val:
                    return clean_tool_arg(val[k_cand])
            if len(val) == 1:
                return clean_tool_arg(list(val.values())[0])
            return str(val)
        return val

    def describe_tool_step(fn_name: str, fn_args: Dict[str, Any]) -> str:
        def safe_str(val: Any, max_len: int = 50) -> str:
            if isinstance(val, dict):
                val = val.get("value") or val.get("command") or val.get("file_path") or str(val)
            elif not isinstance(val, str):
                val = str(val or "")
            return val[:max_len]

        if fn_name == "tool_run_command":
            return f"Running: {safe_str(fn_args.get('command') or fn_args.get('cmd'))}"
        elif fn_name == "tool_write_to_file":
            return f"Creating {safe_str(fn_args.get('file_path'))}"
        elif fn_name == "tool_replace_file_content":
            return f"Modifying {safe_str(fn_args.get('file_path'))}"
        elif fn_name == "tool_get_file_outline":
            return f"Outline of {safe_str(fn_args.get('file_path'))}"
        elif fn_name == "tool_view_file":
            return f"Reading {safe_str(fn_args.get('file_path'))}"
        elif fn_name == "tool_grep_search":
            return f"Searching for '{safe_str(fn_args.get('query'), 30)}'"
        elif fn_name == "tool_update_memory":
            return f"Saving memory: '{safe_str(fn_args.get('rule_name'), 30)}'"
        return f"Executing {fn_name}"

    # --- STRATEGY A: CLOUD API AUTONOMOUS AGENT (ANY DISCOVERED PROVIDER & LIVE MODELS) ---
    if discovery and discovery.get("valid") and not is_explicit_local:
        protocol = discovery.get("protocol")
        base_url = discovery.get("base_url", "")
        candidate_models = discovery.get("models", [])

        # A1: Google AI Protocol
        if protocol == "google" and GENAI_SDK_AVAILABLE:
            for cand_model in candidate_models:
                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                    yield {"type": "done", "content": "[Execution stopped by user]", "refactor": None}
                    return

                try:
                    yield {
                        "type": "step",
                        "step": f"Engaging autonomous agent ({cand_model})...",
                        "status": "running"
                    }

                    client = genai.Client(api_key=effective_api_key)
                    tools_list = [
                        tool_get_file_outline,
                        tool_view_file,
                        tool_grep_search,
                        tool_find_by_name,
                        tool_write_to_file,
                        tool_replace_file_content,
                        tool_run_command,
                        tool_get_blast_radius,
                        tool_update_memory
                    ]

                    system_inst = (
                        "You are Neuron AI, an elite autonomous software engineering assistant inside Neuron IDE. "
                        f"You are working in project '{project_name}' at '{target_dir or os.getcwd()}'. "
                        f"{project_rules}\n\n"
                        "AUTONOMOUS AGENT DIRECTIVES:\n"
                        "1. `tool_get_file_outline`: ALWAYS inspect the AST outline first before reading large files! Understand structure in 50-100 tokens.\n"
                        "2. `tool_view_file`: Read specific lines of files once you locate the relevant functions from the outline or search.\n"
                        "3. `tool_grep_search` / `tool_find_by_name`: Search codebase for symbols, functions, or files.\n"
                        "4. `tool_write_to_file`: Create new scripts, test files, or overwrite files.\n"
                        "5. `tool_replace_file_content`: Surgically edit specific code blocks with instant unified diffs.\n"
                        "6. `tool_run_command`: Run Python scripts, unit tests, or install packages in the virtual environment.\n"
                        "7. `tool_get_blast_radius`: Analyze AST dependency graph impact before modifying shared symbols.\n"
                        "8. `tool_update_memory`: Persist developer rules and architectural conventions to '.neuron/memory.md'.\n"
                        "9. SELF-CORRECTION MANDATE: When running tests or commands, if an error, traceback, or non-zero exit code occurs, "
                        "DO NOT stop and ask the user! Read the traceback, inspect the code, fix the issue, and re-run to verify!\n"
                        "10. Once satisfied, provide a clean architectural summary with code explanations."
                    )

                    config = genai_types.GenerateContentConfig(
                        system_instruction=system_inst,
                        temperature=0.2,
                        tools=tools_list,
                        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True)
                    )

                    chat = client.aio.chats.create(model=cand_model, config=config)
                    current_input: Any = full_prompt
                    accumulated_text = ""
                    max_turns = 10
                    tools_executed = False

                    for turn in range(max_turns):
                        if cancel_ctx and cancel_ctx.get("is_cancelled"):
                            yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                            yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                            return

                        stream_resp = await chat.send_message_stream(current_input)
                        turn_function_calls = []
                        turn_text_chunks = []

                        async for chunk in stream_resp:
                            if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                yield {"type": "done", "content": accumulated_text + "".join(turn_text_chunks) + "\n\n[Stopped by user]", "refactor": None}
                                return

                            chunk_text = ""
                            try:
                                chunk_text = chunk.text or ""
                            except Exception:
                                chunk_text = ""

                            if chunk_text:
                                turn_text_chunks.append(chunk_text)
                                accumulated_text += chunk_text
                                yield {"type": "token", "content": chunk_text}

                            calls = getattr(chunk, "function_calls", None)
                            if calls:
                                turn_function_calls.extend(calls)

                        if turn_function_calls:
                            tools_executed = True
                            tool_responses = []
                            for fc in turn_function_calls:
                                fn_name = fc.name
                                raw_args = dict(fc.args or {})
                                fn_args = {k: clean_tool_arg(v) for k, v in raw_args.items()}
                                step_desc = describe_tool_step(fn_name, fn_args)

                                mutating_tools = {"tool_run_command", "tool_write_to_file", "tool_replace_file_content"}
                                if approval_mode == "manual" and fn_name in mutating_tools and approval_handler:
                                    yield {"type": "step", "step": f"Awaiting approval for {step_desc}...", "status": "running"}
                                    try:
                                        approved, feedback = await approval_handler(conversation_id, fn_name, fn_args, step_desc)
                                    except Exception as err:
                                        approved, feedback = False, str(err)

                                    if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                        yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                        yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                        return

                                    if not approved:
                                        rejection_note = f"[Action rejected by user. Feedback: {feedback or 'User denied approval. Please provide an alternative plan.'}]"
                                        yield {"type": "step", "step": f"Rejected: {step_desc}", "status": "done"}
                                        tool_responses.append(
                                            genai_types.Part.from_function_response(
                                                name=fn_name,
                                                response={"result": rejection_note}
                                            )
                                        )
                                        continue

                                yield {"type": "step", "step": f"{step_desc}...", "status": "running"}

                                tool_fn = TOOL_DISPATCH.get(fn_name)
                                if tool_fn:
                                    raw_res = await asyncio.to_thread(tool_fn, **fn_args)
                                else:
                                    raw_res = f"[Error: Tool {fn_name} not found]"

                                is_failure = "Error" in str(raw_res) or "Exit Code: 1" in str(raw_res) or "Exit Code: 2" in str(raw_res)
                                completion_status = f"{step_desc} (Self-correcting...)" if is_failure else step_desc
                                yield {"type": "step", "step": completion_status, "status": "done"}

                                tool_responses.append(
                                    genai_types.Part.from_function_response(
                                        name=fn_name,
                                        response={"result": str(raw_res)}
                                    )
                                )

                            current_input = tool_responses
                        else:
                            break

                    refactor = extract_refactor_proposal(accumulated_text, file_path, target_dir, user_prompt=prompt, tools_executed=tools_executed)
                    yield {"type": "step", "step": "Completed", "status": "done"}
                    yield {"type": "done", "content": accumulated_text, "refactor": refactor}
                    return

                except Exception as genai_err:
                    print(f"[DEBUG] Google candidate {cand_model} exception: {genai_err}")
                    # Automatically try next discovered live model if quota/rate-limit/unsupported/not-found
                    continue

        # A2: OpenAI-Compatible & Anthropic Protocols (OpenAI, Groq, OpenRouter, DeepSeek, xAI, Mistral, Cerebras, Anthropic)
        elif protocol in ("openai_compat", "anthropic"):
            system_inst = (
                "You are Neuron AI, an elite autonomous software engineering assistant inside Neuron IDE. "
                f"You are working in project '{project_name}' at '{target_dir or os.getcwd()}'. "
                f"{project_rules}\n\n"
                "AUTONOMOUS AGENT DIRECTIVES:\n"
                "1. You have DIRECT EXECUTION TOOLS. Call the appropriate tool to inspect, create, edit, or run files.\n"
                "2. `tool_write_to_file`: Create new scripts or overwrite files on disk.\n"
                "3. `tool_run_command`: Run Python scripts, terminal commands, or install packages.\n"
                "4. `tool_replace_file_content`: Surgically edit specific code blocks.\n"
                "5. `tool_view_file` / `tool_get_file_outline`: Inspect files and code outlines.\n"
                "6. `tool_grep_search` / `tool_find_by_name`: Search codebase symbols and filenames.\n"
                "7. `tool_update_memory`: Save project conventions to .neuron/memory.md.\n"
                "8. FORMAT REQUIREMENT: To call a tool, respond with ONLY a JSON code block:\n"
                "```json\n"
                '{"name": "tool_name", "arguments": {"param_key": "param_value"}}\n'
                "```\n"
                "9. Once you receive tool observation output, analyze it and provide a clean architectural summary or explanation."
            )

            for cand_model in candidate_models:
                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                    yield {"type": "done", "content": "[Execution stopped by user]", "refactor": None}
                    return

                try:
                    yield {
                        "type": "step",
                        "step": f"Engaging autonomous agent ({cand_model})...",
                        "status": "running"
                    }

                    messages = [
                        {"role": "system", "content": system_inst},
                        {"role": "user", "content": full_prompt}
                    ]
                    accumulated_text = ""
                    tools_executed = False
                    prev_turn_failed = False
                    model_succeeded = False

                    for turn in range(8):
                        if cancel_ctx and cancel_ctx.get("is_cancelled"):
                            yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                            yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                            return

                        turn_content_chunks = []

                        if protocol == "openai_compat":
                            headers = {
                                "Authorization": f"Bearer {effective_api_key}",
                                "Content-Type": "application/json"
                            }
                            payload = {
                                "model": cand_model,
                                "messages": messages,
                                "stream": True,
                                "temperature": 0.2
                            }
                            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=6.0)) as client:
                                async with client.stream("POST", f"{base_url}/chat/completions", headers=headers, json=payload) as resp:
                                    if resp.status_code != 200:
                                        raise RuntimeError(f"HTTP {resp.status_code}")
                                    model_succeeded = True
                                    async for line in resp.aiter_lines():
                                        if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                            yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                            yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                            return
                                        if not line or not line.startswith("data:"):
                                            continue
                                        data_str = line[5:].strip()
                                        if data_str == "[DONE]":
                                            break
                                        try:
                                            chunk_obj = json.loads(data_str)
                                            choices = chunk_obj.get("choices") or []
                                            if choices:
                                                delta = choices[0].get("delta") or {}
                                                c_part = delta.get("content") or ""
                                                if c_part:
                                                    turn_content_chunks.append(c_part)
                                        except Exception:
                                            continue

                        elif protocol == "anthropic":
                            headers = {
                                "x-api-key": effective_api_key,
                                "anthropic-version": "2023-06-01",
                                "content-type": "application/json"
                            }
                            anth_messages = [m for m in messages if m["role"] != "system"]
                            payload = {
                                "model": cand_model,
                                "max_tokens": 4096,
                                "system": system_inst,
                                "messages": anth_messages,
                                "stream": True,
                                "temperature": 0.2
                            }
                            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=6.0)) as client:
                                async with client.stream("POST", f"{base_url}/messages", headers=headers, json=payload) as resp:
                                    if resp.status_code != 200:
                                        raise RuntimeError(f"HTTP {resp.status_code}")
                                    model_succeeded = True
                                    async for line in resp.aiter_lines():
                                        if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                            yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                            yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                            return
                                        if not line or not line.startswith("data:"):
                                            continue
                                        data_str = line[5:].strip()
                                        try:
                                            ev = json.loads(data_str)
                                            if ev.get("type") == "content_block_delta":
                                                c_part = (ev.get("delta") or {}).get("text") or ""
                                                if c_part:
                                                    turn_content_chunks.append(c_part)
                                        except Exception:
                                            continue

                        turn_text = "".join(turn_content_chunks)
                        detected_calls = extract_json_tool_calls(turn_text)
                        if not detected_calls:
                            detected_calls = infer_operational_tool_calls(
                                prompt, turn_text, file_path, target_dir, turn=turn, prev_failed=prev_turn_failed
                            )

                        if detected_calls:
                            tools_executed = True
                            for call in detected_calls:
                                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                    yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                    return

                                fn_name = call.get("name", "")
                                raw_fn_args = call.get("args") or {}
                                fn_args = {k: clean_tool_arg(v) for k, v in (raw_fn_args or {}).items()}
                                step_desc = describe_tool_step(fn_name, fn_args)

                                mutating_tools = {"tool_run_command", "tool_write_to_file", "tool_replace_file_content"}
                                if approval_mode == "manual" and fn_name in mutating_tools and approval_handler:
                                    yield {"type": "step", "step": f"Awaiting approval for {step_desc}...", "status": "running"}
                                    try:
                                        approved, feedback = await approval_handler(conversation_id, fn_name, fn_args, step_desc)
                                    except Exception as err:
                                        approved, feedback = False, str(err)

                                    if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                        yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                        yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                        return

                                    if not approved:
                                        rejection_note = f"[Action rejected by user. Feedback: {feedback or 'User denied approval. Please provide an alternative plan.'}]"
                                        yield {"type": "step", "step": f"Rejected: {step_desc}", "status": "done"}
                                        messages.append({"role": "assistant", "content": json.dumps({"name": fn_name, "arguments": fn_args})})
                                        messages.append({"role": "user", "content": rejection_note})
                                        continue

                                yield {"type": "step", "step": f"{step_desc}...", "status": "running"}
                                tool_fn = TOOL_DISPATCH.get(fn_name)
                                if tool_fn:
                                    raw_res = await asyncio.to_thread(tool_fn, **fn_args)
                                else:
                                    raw_res = f"[Error: Tool {fn_name} not found]"

                                is_failure = "Error" in str(raw_res) or "Exit Code: 1" in str(raw_res) or "Exit Code: 2" in str(raw_res)
                                prev_turn_failed = is_failure
                                completion_status = f"{step_desc} (Self-correcting...)" if is_failure else step_desc
                                yield {"type": "step", "step": completion_status, "status": "done"}

                                messages.append({"role": "assistant", "content": json.dumps({"name": fn_name, "arguments": fn_args})})
                                messages.append({
                                    "role": "user",
                                    "content": (
                                        f"[Observation from {fn_name} with arguments {json.dumps(fn_args)}]:\n"
                                        f"{raw_res}\n\n"
                                        "Analyze the execution result above. If an error occurred, diagnose and call the appropriate tool to fix it. "
                                        "If the operation succeeded, explain the output clearly and concisely to the user without calling further tools."
                                    )
                                })
                        else:
                            accumulated_text += turn_text
                            yield {"type": "token", "content": turn_text}
                            break

                    if model_succeeded:
                        final_text = accumulated_text.strip()
                        refactor = extract_refactor_proposal(final_text, file_path, target_dir, user_prompt=prompt, tools_executed=tools_executed)
                        yield {"type": "step", "step": "Completed", "status": "done"}
                        yield {"type": "done", "content": final_text, "refactor": refactor}
                        return
                except Exception as compat_err:
                    print(f"[DEBUG] Provider candidate {cand_model} exception: {compat_err}")
                    continue

    # --- STRATEGY B: LOCAL OLLAMA ENGINE (DYNAMICALLY DISCOVERED MODEL) ---
    ollama_model = await resolve_best_ollama_model()
    if ollama_model:
        system_inst = (
            "You are Neuron AI, an elite autonomous software engineering assistant inside Neuron IDE. "
            f"You are working in project '{project_name}' at '{target_dir or os.getcwd()}'. "
            f"{project_rules}\n\n"
            "AUTONOMOUS AGENT DIRECTIVES:\n"
            "1. You have DIRECT EXECUTION TOOLS. NEVER tell the user to run commands, create files, or open terminals manually. "
            "YOU MUST CALL THE APPROPRIATE TOOL YOURSELF!\n"
            "2. `tool_write_to_file`: Create new scripts, games, or test files on disk.\n"
            "3. `tool_run_command`: Run Python scripts, terminal commands, or install packages.\n"
            "4. `tool_replace_file_content`: Surgically edit specific code blocks.\n"
            "5. `tool_view_file` / `tool_get_file_outline`: Inspect files and code outlines.\n"
            "6. `tool_grep_search` / `tool_find_by_name`: Search codebase symbols and filenames.\n"
            "7. `tool_update_memory`: Save project conventions to .neuron/memory.md.\n"
            "8. FORMAT REQUIREMENT: To call a tool, respond with ONLY a JSON code block:\n"
            "```json\n"
            '{"name": "tool_name", "arguments": {"param_key": "param_value"}}\n'
            "```\n"
            "9. Once you receive tool observation output, analyze it and provide a clean architectural summary or explanation."
        )

        messages = [
            {"role": "system", "content": system_inst},
            {"role": "user", "content": full_prompt}
        ]
        accumulated_text = ""
        tools_executed = False
        prev_turn_failed = False
        max_turns = 8

        try:
            yield {
                "type": "step",
                "step": f"Synthesizing response via local engine ({ollama_model})...",
                "status": "running"
            }

            for turn in range(max_turns):
                if cancel_ctx and cancel_ctx.get("is_cancelled"):
                    yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                    yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                    return

                ollama_payload = {
                    "model": ollama_model,
                    "messages": messages,
                    "tools": OLLAMA_TOOLS,
                    "stream": True,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 1024
                    }
                }

                turn_content_chunks = []
                turn_tool_calls = []

                async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=5.0)) as client:
                    async with client.stream("POST", f"{OLLAMA_API_BASE}/api/chat", json=ollama_payload) as response:
                        if response.status_code != 200:
                            break
                        async for line in response.aiter_lines():
                            if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                return
                            if line:
                                try:
                                    chunk = json.loads(line)
                                    msg = chunk.get("message", {})
                                    c_part = msg.get("content", "")
                                    tc_part = msg.get("tool_calls", [])
                                    if tc_part:
                                        turn_tool_calls.extend(tc_part)
                                    if c_part:
                                        turn_content_chunks.append(c_part)
                                    if chunk.get("done", False):
                                        break
                                except Exception:
                                    continue

                turn_text = "".join(turn_content_chunks)

                detected_calls = []
                for tc in turn_tool_calls:
                    fn = tc.get("function", {})
                    name = fn.get("name")
                    args = fn.get("arguments", {})
                    if name:
                        detected_calls.append({"name": name, "args": args})

                if not detected_calls:
                    detected_calls = extract_json_tool_calls(turn_text)

                if not detected_calls:
                    detected_calls = infer_operational_tool_calls(
                        prompt, turn_text, file_path, target_dir, turn=turn, prev_failed=prev_turn_failed
                    )

                if detected_calls:
                    tools_executed = True
                    for call in detected_calls:
                        if cancel_ctx and cancel_ctx.get("is_cancelled"):
                            yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                            yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                            return

                        fn_name = call.get("name", "")
                        raw_fn_args = call.get("args") or {}
                        fn_args = {k: clean_tool_arg(v) for k, v in (raw_fn_args or {}).items()}
                        step_desc = describe_tool_step(fn_name, fn_args)

                        mutating_tools = {"tool_run_command", "tool_write_to_file", "tool_replace_file_content"}
                        if approval_mode == "manual" and fn_name in mutating_tools and approval_handler:
                            yield {"type": "step", "step": f"Awaiting approval for {step_desc}...", "status": "running"}
                            try:
                                approved, feedback = await approval_handler(conversation_id, fn_name, fn_args, step_desc)
                            except Exception as err:
                                approved, feedback = False, str(err)

                            if cancel_ctx and cancel_ctx.get("is_cancelled"):
                                yield {"type": "step", "step": "Execution stopped by user", "status": "done"}
                                yield {"type": "done", "content": accumulated_text + "\n\n[Stopped by user]", "refactor": None}
                                return

                            if not approved:
                                rejection_note = f"[Action rejected by user. Feedback: {feedback or 'User denied approval. Please provide an alternative plan.'}]"
                                yield {"type": "step", "step": f"Rejected: {step_desc}", "status": "done"}
                                messages.append({
                                    "role": "assistant",
                                    "content": json.dumps({"name": fn_name, "arguments": fn_args})
                                })
                                messages.append({
                                    "role": "user",
                                    "content": rejection_note
                                })
                                continue

                        yield {"type": "step", "step": f"{step_desc}...", "status": "running"}

                        tool_fn = TOOL_DISPATCH.get(fn_name)
                        if tool_fn:
                            raw_res = await asyncio.to_thread(tool_fn, **fn_args)
                        else:
                            raw_res = f"[Error: Tool {fn_name} not found]"

                        is_failure = "Error" in str(raw_res) or "Exit Code: 1" in str(raw_res) or "Exit Code: 2" in str(raw_res)
                        prev_turn_failed = is_failure
                        completion_status = f"{step_desc} (Self-correcting...)" if is_failure else step_desc
                        yield {"type": "step", "step": completion_status, "status": "done"}

                        messages.append({
                            "role": "assistant",
                            "content": json.dumps({"name": fn_name, "arguments": fn_args})
                        })
                        messages.append({
                            "role": "user",
                            "content": (
                                f"[Observation from {fn_name} with arguments {json.dumps(fn_args)}]:\n"
                                f"{raw_res}\n\n"
                                "Analyze the execution result above. If an error occurred, diagnose and call the appropriate tool to fix it. "
                                "If the operation succeeded, explain the output clearly and concisely to the user without calling further tools."
                            )
                        })
                else:
                    accumulated_text += turn_text
                    yield {"type": "token", "content": turn_text}
                    break

            final_text = accumulated_text.strip()
            refactor = extract_refactor_proposal(final_text, file_path, target_dir, user_prompt=prompt, tools_executed=tools_executed)
            yield {"type": "step", "step": "Completed", "status": "done"}
            yield {"type": "done", "content": final_text, "refactor": refactor}
            return
        except Exception as ollama_err:
            import traceback
            traceback.print_exc()
            print(f"[DEBUG] Local Ollama fallback error: {ollama_err}")

    # --- STRATEGY C: GRACEFUL DIAGNOSTIC GUIDANCE ---
    guidance = (
        "### AI Setup Required\n\n"
        "To enable autonomous AI execution, please add an **API Key** in **Settings > AI**.\n\n"
        "- Neuron automatically detects your key's provider and selects the best available model.\n"
        "- Alternatively, ensure your local **Ollama** server is running on `http://127.0.0.1:11434` with at least one model installed."
    )
    yield {"type": "token", "content": guidance}
    yield {"type": "step", "step": "Setup Required", "status": "done"}
    yield {"type": "done", "content": guidance, "refactor": None}

