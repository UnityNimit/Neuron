# backend/services/ai_service.py
import asyncio
import hashlib
import json
import re
from typing import AsyncGenerator, Dict, List, Optional
import httpx

# -------------------------------------------------------------------------
# 1. 🚀 IN-MEMORY HASH CACHE (0ms Retrieval for Unmodified Code)
# -------------------------------------------------------------------------
SUMMARY_CACHE: Dict[str, str] = {}

OLLAMA_API_BASE = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen2.5-coder:3b"


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

    # 🚀 $0\text{ms}$ CACHE HIT
    if cache_key in SUMMARY_CACHE:
        return SUMMARY_CACHE[cache_key]

    prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)

    payload = {
        "model": DEFAULT_MODEL,
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

    # 🛡️ DETERMINISTIC STATIC HEURISTIC FALLBACK
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

    prompt = build_graph_rag_prompt(node_id, code_string, connected_snippets, risk_level)

    payload = {
        "model": DEFAULT_MODEL,
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