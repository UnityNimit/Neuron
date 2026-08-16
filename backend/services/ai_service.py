# backend/services/ai_service.py
import asyncio
import hashlib
import json
from typing import AsyncGenerator, Dict, List, Optional
import httpx

# -------------------------------------------------------------------------
# 1. 🚀 IN-MEMORY HASH CACHE (0ms Response for Unmodified Nodes)
# -------------------------------------------------------------------------
SUMMARY_CACHE: Dict[str, str] = {}

# Preferred local models in order of speed and coding accuracy
OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_MODEL = "qwen2.5-coder:3b"


def compute_code_hash(code_string: str, context_str: str = "") -> str:
    """Generates a unique SHA-256 fingerprint of the code and its dependency context."""
    hasher = hashlib.sha256()
    hasher.update(code_string.encode('utf-8'))
    if context_str:
        hasher.update(context_str.encode('utf-8'))
    return hasher.hexdigest()


def build_graph_rag_prompt(
    node_id: str,
    code_string: str,
    connected_snippets: Optional[List[str]] = None,
    risk_level: str = "low"
) -> str:
    """
    Constructs an optimized high-density Graph-RAG prompt.
    Injects AST Call Dependencies so the LLM understands cross-file business logic.
    """
    pruned_code = code_string.strip()[:1500]
    
    dependency_context = ""
    if connected_snippets:
        combined_deps = "\n---\n".join(s.strip()[:400] for s in connected_snippets[:3])
        dependency_context = f"\nCONNECTED AST CALL DEPENDENCIES:\n{combined_deps}\n"

    risk_instruction = ""
    if risk_level == "high":
        risk_instruction = " This function has high architectural risk. Explicitly state potential failure points."

    prompt = (
        f"[INST] You are an expert compiler and software architect.\n"
        f"Analyze this target function and its connected execution dependencies.{risk_instruction}\n\n"
        f"TARGET NODE: {node_id}\n"
        f"SOURCE CODE:\n{pruned_code}\n"
        f"{dependency_context}\n"
        f"TASK: Provide a concise architectural summary of this function's business logic role in exactly two clear sentences. "
        f"Do NOT output markdown headers, code blocks, greetings, or filler phrases. Start directly with the explanation. [/INST]"
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
    Fetches a semantic 2-sentence summary using Graph-RAG context.
    Checks SHA-256 cache first. Falls back to deterministic heuristics if Ollama is offline.
    """
    if not code_string or not code_string.strip():
        return "Empty code block."

    context_str = "".join(connected_snippets) if connected_snippets else ""
    cache_key = compute_code_hash(code_string, context_str)

    # 🚀 $0\text{ms}$ CACHE HIT
    if cache_key in SUMMARY_CACHE:
        return SUMMARY_CACHE[cache_key]

    prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)

    payload = {
        "model": DEFAULT_MODEL,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.1,      # Low temperature for deterministic architectural accuracy
            "top_p": 0.9,
            "num_predict": 70,       # Capped for sub-second inference
            "num_ctx": 2048          # Caps context window to preserve 6GB VRAM for 300 FPS WebGPU
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(OLLAMA_API_URL, json=payload)
            if response.status_code == 200:
                summary = response.json().get("response", "").strip()
                # Clean up any leftover conversational artifacts
                summary = summary.replace("Here is a summary:", "").replace("Summary:", "").strip()
                if summary:
                    SUMMARY_CACHE[cache_key] = summary
                    return summary
    except httpx.ConnectError:
        print("ℹ️ Local Ollama daemon offline (http://127.0.0.1:11434).")
    except Exception as e:
        print(f"⚠️ LLM Generation Exception: {repr(e)}")

    # 🛡️ DETERMINISTIC HEURISTIC FALLBACK (Zero UI Disruption)
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
    Enables live sci-fi typewriter rendering on the frontend canvas HUD.
    """
    if not code_string or not code_string.strip():
        yield "Empty code block."
        return

    context_str = "".join(connected_snippets) if connected_snippets else ""
    cache_key = compute_code_hash(code_string, context_str)

    if cache_key in SUMMARY_CACHE:
        yield SUMMARY_CACHE[cache_key]
        return

    prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)

    payload = {
        "model": DEFAULT_MODEL,
        "prompt": prompt,
        "stream": True,
        "keep_alive": "5m",
        "options": {
            "temperature": 0.1,
            "num_predict": 70,
            "num_ctx": 2048
        }
    }

    full_response = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            async with client.stream("POST", OLLAMA_API_URL, json=payload) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            full_response.append(token)
                            yield token
                            if chunk.get("done", False):
                                break
                    
                    complete_summary = "".join(full_response).strip()
                    if complete_summary:
                        SUMMARY_CACHE[cache_key] = complete_summary
                    return
    except Exception as e:
        print(f"⚠️ Streaming LLM Exception: {repr(e)}")

    yield generate_heuristic_summary(code_string, node_id, risk_level)


# -------------------------------------------------------------------------
# 4. HEURISTIC STATIC CODE DIGESTION (Instant Offline Analyzer)
# -------------------------------------------------------------------------
def generate_heuristic_summary(code_str: str, node_id: str, risk_level: str) -> str:
    """Fast rule-based AST summarizer when Ollama is not active."""
    func_name = node_id.split("::")[-1].replace("()", "") if "::" in node_id else "module"
    
    has_async = "async def" in code_str or "async " in code_str
    has_db = any(k in code_str.lower() for k in ["query", "select", "insert", "db", "session", "commit"])
    has_net = any(k in code_str.lower() for k in ["fetch", "http", "request", "response", "get", "post"])
    has_auth = any(k in code_str.lower() for k in ["token", "jwt", "auth", "password", "crypto"])

    roles = []
    if has_auth:
        roles.append("authentication/security validation")
    if has_db:
        roles.append("database operations and persistence")
    if has_net:
        roles.append("network I/O handling")
    if has_async:
        roles.append("non-blocking concurrent execution")

    role_desc = ", ".join(roles) if roles else "core computational logic"
    
    warning = " Contains high branching complexity." if risk_level == "high" else ""
    return f"Executes {role_desc} for '{func_name}'.{warning}"