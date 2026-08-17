# backend/ai/vector_search.py
import math
import os
import re
import threading
from typing import Any, Dict, List, Optional, Set, Tuple

# -------------------------------------------------------------------------
# 1. ENGINE A: CHROMADB DENSE VECTOR EMBEDDINGS
# -------------------------------------------------------------------------
CHROMA_AVAILABLE = False
try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    pass

# -------------------------------------------------------------------------
# 2. ENGINE B: SCIKIT-LEARN SPARSE TF-IDF FALLBACK
# -------------------------------------------------------------------------
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def sanitize_meta_value(val: Any) -> Any:
    """Guarantees metadata values conform to ChromaDB's strict primitive requirements."""
    if val is None:
        return ""
    if isinstance(val, (str, int, float, bool)):
        return val
    return str(val)


class VectorSearchEngine:
    """
    🌌 HYBRID MULTI-MODAL VECTOR SEARCH ENGINE
      1. Primary: ChromaDB Dense Vector Embeddings (MiniLM-L6-v2)
      2. Secondary: Scikit-Learn Sublinear TF-IDF (1-3 N-Grams)
      3. Booster: Exact Lexical AST Identifier Matcher
      4. Concurrency: Thread-Safe RLock Architecture
    """
    def __init__(self):
        self._lock = threading.RLock()
        self.chroma_client = None
        self.chroma_collection = None
        self.embed_fn = None
        
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        
        self.indexed_nodes_cache: List[dict] = []
        self.node_id_map: Dict[str, dict] = {}
        
        self._init_chroma()

    def _init_chroma(self):
        if not CHROMA_AVAILABLE:
            print("[INFO] ChromaDB not installed. Operating on Scikit-Learn TF-IDF High-Speed Engine.")
            return
        try:
            self.chroma_client = chromadb.Client(Settings(
                anonymized_telemetry=False,
                is_persistent=False
            ))
            self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name="neuron_semantic_mesh",
                embedding_function=self.embed_fn,
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            print(f"[WARN] ChromaDB initialization failed, falling back to TF-IDF: {e}")
            self.chroma_collection = None

    def index_nodes(self, nodes: List[dict]) -> None:
        """
        Deduplicates, sanitizes, and indexes function and file nodes into both vector stores.
        Guaranteed zero duplicate ID collisions during upsert.
        """
        if not nodes:
            return

        with self._lock:
            # 1. Filter valid target nodes
            candidate_nodes = [
                n for n in nodes 
                if isinstance(n, dict) and n.get("id") and n.get("data", {}).get("nodeType") in ["function", "file"]
            ]

            # 2. Defensive Deduplication Pass (Guarantees Unique UIDs)
            seen_ids: Set[str] = set()
            unique_nodes: List[dict] = []

            for n in candidate_nodes:
                nid = str(n["id"]).strip()
                if nid and nid not in seen_ids:
                    seen_ids.add(nid)
                    unique_nodes.append(n)

            self.indexed_nodes_cache = unique_nodes
            self.node_id_map = {n["id"]: n for n in unique_nodes}

            if not unique_nodes:
                return

            documents: List[str] = []
            ids: List[str] = []
            metadatas: List[Dict[str, Any]] = []

            for n in unique_nodes:
                d = n.get("data", {})
                label = str(d.get("label", ""))
                file_path = str(d.get("filePath", n["id"]))
                code = str(d.get("code", ""))
                node_type = str(d.get("nodeType", "function"))
                line = int(d.get("line", 1) or 1)
                complexity = int(d.get("complexity", 0) or 0)
                risk = str(d.get("risk", "low"))

                # Synthesize high-density contextual embedding document
                doc_text = (
                    f"Symbol: {label}\n"
                    f"File: {file_path}\n"
                    f"Type: {node_type}\n"
                    f"Line: {line}\n"
                    f"Complexity: {complexity}\n"
                    f"Risk: {risk}\n"
                    f"Source Snippet:\n{code[:1200]}"
                )

                documents.append(doc_text)
                ids.append(n["id"])
                metadatas.append({
                    "label": sanitize_meta_value(label),
                    "filePath": sanitize_meta_value(file_path),
                    "nodeType": sanitize_meta_value(node_type),
                    "line": line,
                    "risk": sanitize_meta_value(risk)
                })

            # 3. Batch Chunk Upsert to ChromaDB
            if self.chroma_collection and ids:
                try:
                    # Chroma batch chunking (max 500 per batch for memory stability)
                    batch_size = 500
                    for i in range(0, len(ids), batch_size):
                        batch_ids = ids[i:i + batch_size]
                        batch_docs = documents[i:i + batch_size]
                        batch_meta = metadatas[i:i + batch_size]

                        self.chroma_collection.upsert(
                            ids=batch_ids,
                            documents=batch_docs,
                            metadatas=batch_meta
                        )
                except Exception as e:
                    print(f"[WARN] ChromaDB upsert failed, continuing with TF-IDF fallback: {e}")

            # 4. Fit Scikit-Learn TF-IDF N-Gram Matrix
            if documents:
                try:
                    self.tfidf_vectorizer = TfidfVectorizer(
                        ngram_range=(1, 3),
                        sublinear_tf=True,
                        stop_words="english",
                        token_pattern=r'(?u)\b\w+\b|[a-zA-Z_][a-zA-Z0-9_]*',
                        max_features=10000
                    )
                    self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(documents)
                except Exception as e:
                    print(f"[WARN] TF-IDF matrix fitting failed: {e}")

    def query(self, query_text: str, top_k: int = 8) -> List[dict]:
        """
        Executes hybrid semantic vector search with lexical AST boosting and returns ranked matches.
        """
        if not query_text or not query_text.strip():
            return []

        clean_query = query_text.strip()
        query_tokens = [tok.lower() for tok in re.findall(r'[a-zA-Z0-9_]+', clean_query) if len(tok) > 1]

        with self._lock:
            if not self.indexed_nodes_cache:
                return []

            candidate_scores: Dict[str, float] = {}

            # -----------------------------------------------------------------
            # 1. CHROMADB DENSE VECTOR RETRIEVAL
            # -----------------------------------------------------------------
            if self.chroma_collection and len(self.indexed_nodes_cache) > 0:
                try:
                    limit = min(top_k * 3, len(self.indexed_nodes_cache))
                    results = self.chroma_collection.query(
                        query_texts=[clean_query],
                        n_results=limit
                    )

                    if results and results.get("ids") and len(results["ids"][0]) > 0:
                        matched_ids = results["ids"][0]
                        distances = results["distances"][0] if "distances" in results and results["distances"] else [0.5] * len(matched_ids)

                        for nid, dist in zip(matched_ids, distances):
                            # Convert Cosine distance (0.0=identical, 2.0=opposite) to normalized similarity
                            sim_score = max(0.0, min(100.0, (1.0 - (float(dist) / 2.0)) * 100.0))
                            candidate_scores[nid] = candidate_scores.get(nid, 0.0) + (sim_score * 0.65)
                except Exception as e:
                    print(f"[WARN] ChromaDB query error: {e}")

            # -----------------------------------------------------------------
            # 2. TF-IDF SPARSE COSINE SIMILARITY RETRIEVAL
            # -----------------------------------------------------------------
            if self.tfidf_vectorizer and self.tfidf_matrix is not None:
                try:
                    query_vec = self.tfidf_vectorizer.transform([clean_query])
                    tfidf_sims = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
                    top_indices = tfidf_sims.argsort()[::-1][:top_k * 3]

                    for idx in top_indices:
                        score = float(tfidf_sims[idx])
                        if score > 0.005:
                            node = self.indexed_nodes_cache[idx]
                            nid = node["id"]
                            tfidf_score = score * 100.0
                            candidate_scores[nid] = candidate_scores.get(nid, 0.0) + (tfidf_score * 0.35)
                except Exception as e:
                    print(f"[WARN] TF-IDF query error: {e}")

            # -----------------------------------------------------------------
            # 3. EXACT LEXICAL & AST IDENTIFIER BOOSTING
            # -----------------------------------------------------------------
            for node in self.indexed_nodes_cache:
                nid = node["id"]
                label = node["data"].get("label", "").lower()
                filepath = node["data"].get("filePath", "").lower()
                code = node["data"].get("code", "").lower()

                boost = 0.0
                clean_q_lower = clean_query.lower()

                # Exact symbol name match
                if clean_q_lower in label:
                    boost += 35.0
                # Exact file name match
                if clean_q_lower in filepath:
                    boost += 20.0

                # Token containment matches
                for tok in query_tokens:
                    if tok in label:
                        boost += 15.0
                    elif tok in filepath:
                        boost += 8.0
                    elif tok in code:
                        boost += 2.0

                if boost > 0:
                    candidate_scores[nid] = candidate_scores.get(nid, 0.0) + boost

            # -----------------------------------------------------------------
            # 4. RANKING & COMPILATION
            # -----------------------------------------------------------------
            ranked_results = sorted(candidate_scores.items(), key=lambda item: item[1], reverse=True)
            output: List[dict] = []

            for nid, raw_score in ranked_results[:top_k]:
                node = self.node_id_map.get(nid)
                if not node:
                    continue

                d = node.get("data", {})
                final_score = float(round(min(100.0, max(5.0, raw_score)), 1))

                output.append({
                    "id": nid,
                    "label": d.get("label", nid),
                    "filePath": d.get("filePath", ""),
                    "nodeType": d.get("nodeType", "function"),
                    "line": int(d.get("line", 1) or 1),
                    "score": final_score,
                    "code": d.get("code", "")[:250],
                    "risk": d.get("risk", "low"),
                    "aiSummary": d.get("aiSummary", "")
                })

            return output


# Global Singleton Vector Engine
vector_engine = VectorSearchEngine()