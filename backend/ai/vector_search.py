# backend/ai/vector_search.py
import math
import os
import re
from typing import Any, Dict, List, Optional

# Engine A: ChromaDB Dense Vector Database
CHROMA_AVAILABLE = False
try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMA_AVAILABLE = True
except ImportError:
    pass

# Engine B: Scikit-Learn Sparse Vector Fallback
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class VectorSearchEngine:
    """
    Dual-Engine Semantic Search Pipeline:
      1. Primary: ChromaDB Dense Vector Embeddings (all-MiniLM-L6-v2)
      2. Fallback: Scikit-Learn TF-IDF N-Gram Cosine Similarity Matrix
    """
    def __init__(self):
        self.chroma_collection = None
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.indexed_nodes_cache: List[dict] = []
        self.node_id_map: Dict[str, dict] = {}
        
        self._init_chroma()

    def _init_chroma(self):
        if not CHROMA_AVAILABLE:
            return
        try:
            client = chromadb.Client()
            embed_fn = embedding_functions.DefaultEmbeddingFunction()
            self.chroma_collection = client.get_or_create_collection(
                name="neuron_semantic_index",
                embedding_function=embed_fn
            )
        except Exception as e:
            print(f"[WARN] ChromaDB initialization skipped, using TF-IDF: {e}")
            self.chroma_collection = None

    def index_nodes(self, nodes: List[dict]) -> None:
        """
        Indexes all function and file nodes into the vector search memory store.
        """
        if not nodes:
            return

        valid_nodes = [
            n for n in nodes 
            if n.get("id") and n.get("data", {}).get("nodeType") in ["function", "file"]
        ]
        
        self.indexed_nodes_cache = valid_nodes
        self.node_id_map = {n["id"]: n for n in valid_nodes}

        documents = []
        ids = []
        metadatas = []

        for n in valid_nodes:
            d = n.get("data", {})
            label = d.get("label", "")
            file_path = d.get("filePath", n["id"])
            code = d.get("code", "")
            node_type = d.get("nodeType", "function")

            # Synthesize high-density semantic search document
            doc_text = f"Identifier: {label}\nFile: {file_path}\nType: {node_type}\nSource:\n{code[:1000]}"
            documents.append(doc_text)
            ids.append(n["id"])
            metadatas.append({
                "label": label,
                "filePath": file_path,
                "nodeType": node_type,
                "line": int(d.get("line", 1))
            })

        # 1. Index into ChromaDB if active
        if self.chroma_collection and ids:
            try:
                self.chroma_collection.upsert(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas
                )
            except Exception as e:
                print(f"[WARN] ChromaDB indexing error: {e}")

        # 2. Index into TF-IDF Fallback Matrix
        if documents:
            try:
                self.tfidf_vectorizer = TfidfVectorizer(
                    ngram_range=(1, 2),
                    stop_words="english",
                    max_features=5000
                )
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(documents)
            except Exception as e:
                print(f"[WARN] TF-IDF indexing error: {e}")

    def query(self, query_text: str, top_k: int = 8) -> List[dict]:
        """
        Executes semantic vector search and returns ranked matching symbols with relevance scores.
        """
        if not query_text or not query_text.strip():
            return []

        clean_query = query_text.strip()

        # Strategy 1: ChromaDB Dense Vector Search
        if self.chroma_collection and len(self.indexed_nodes_cache) > 0:
            try:
                results = self.chroma_collection.query(
                    query_texts=[clean_query],
                    n_results=min(top_k, len(self.indexed_nodes_cache))
                )
                
                output = []
                if results and results.get("ids") and len(results["ids"][0]) > 0:
                    matched_ids = results["ids"][0]
                    distances = results["distances"][0] if "distances" in results and results["distances"] else [0.5] * len(matched_ids)

                    for nid, dist in zip(matched_ids, distances):
                        node = self.node_id_map.get(nid)
                        if node:
                            # Convert L2 distance to similarity percentage
                            similarity = max(0.0, min(100.0, (1.0 - (dist / 2.0)) * 100.0))
                            output.append({
                                "id": nid,
                                "label": node["data"].get("label", nid),
                                "filePath": node["data"].get("filePath", ""),
                                "nodeType": node["data"].get("nodeType", "function"),
                                "line": node["data"].get("line", 1),
                                "score": round(similarity, 1),
                                "code": node["data"].get("code", "")[:200]
                            })
                    return output
            except Exception as e:
                print(f"[WARN] ChromaDB query error, falling back to TF-IDF: {e}")

        # Strategy 2: TF-IDF Cosine Similarity Fallback
        if self.tfidf_vectorizer and self.tfidf_matrix is not None and len(self.indexed_nodes_cache) > 0:
            try:
                query_vec = self.tfidf_vectorizer.transform([clean_query])
                sim_scores = cosine_similarity(query_vec, self.tfidf_matrix).flatten()

                # Get top K indices with positive similarity
                top_indices = sim_scores.argsort()[::-1][:top_k]
                
                output = []
                for idx in top_indices:
                    score = float(sim_scores[idx])
                    if score > 0.01:
                        node = self.indexed_nodes_cache[idx]
                        output.append({
                            "id": node["id"],
                            "label": node["data"].get("label", node["id"]),
                            "filePath": node["data"].get("filePath", ""),
                            "nodeType": node["data"].get("nodeType", "function"),
                            "line": node["data"].get("line", 1),
                            "score": round(score * 100.0, 1),
                            "code": node["data"].get("code", "")[:200]
                        })
                return output
            except Exception as e:
                print(f"[WARN] TF-IDF query error: {e}")

        return []


# Global Singleton Vector Engine
vector_engine = VectorSearchEngine()