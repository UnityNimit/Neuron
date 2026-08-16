# backend/ml/analyzer.py
import math
from collections import Counter
from typing import Any, Dict, List, Tuple

import networkx as nx
import numpy as np
from networkx.algorithms.community import louvain_communities
from sklearn.ensemble import IsolationForest


def compute_shannon_entropy(code_str: str) -> float:
    """
    Calculates the Shannon Entropy H(X) over the character/token distribution of a code block.
    High entropy indicates highly compressed, obfuscated, or deeply dense algorithmic logic.
    H(X) = - sum( P(x) * log2(P(x)) )
    """
    if not code_str:
        return 0.0
    length = len(code_str)
    counts = Counter(code_str)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return float(round(entropy, 4))


def sanitize_for_json(obj: Any) -> Any:
    """
    🛡️ BULLETPROOF NUMPY TO JSON SANITIZER
    Recursively converts all NumPy types (np.bool_, np.int64, np.float64, np.ndarray)
    into native Python primitives to guarantee 100% JSON serializability over WebSockets.
    """
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, tuple):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def analyze_graph_ml(nodes: List[dict], edges: List[dict]) -> List[dict]:
    """
    The Ultimate Multi-Modal ML & Graph Theory Intelligence Pipeline.
    Combines:
      1. Weighted Louvain Modularity (Microservice & Full-Stack Community Discovery)
      2. Dual-Graph Centrality (PageRank Authority + Betweenness Bottlenecks)
      3. 10-Dimensional Continuous Feature Tensor Synthesis
      4. Scikit-Learn Isolation Forest (Unsupervised Anomaly Isolation)
      5. Ensemble Risk Classification & Architectural Code Smell Diagnosis
      6. Recursive JSON Sanitization for Zero WebSocket Serialization Failures
    """
    if not nodes or not edges:
        return nodes

    node_id_set = {n["id"] for n in nodes}

    # -------------------------------------------------------------------------
    # 1. BUILD DUAL GRAPHS (Undirected for Louvain, Directed for Flow/Authority)
    # -------------------------------------------------------------------------
    G = nx.Graph()
    DiG = nx.DiGraph()

    for n in nodes:
        G.add_node(n["id"])
        DiG.add_node(n["id"])

    for e in edges:
        src = e["source"]
        tgt = e["target"]
        if src != tgt and src in node_id_set and tgt in node_id_set:
            # 🚀 WEIGHTED BRIDGE LOGIC: Cross-stack APIs and function calls are 50x heavier than folder links
            edge_type = e.get("type", "hierarchy")
            if edge_type in ["network_bridge", "call"]:
                weight = 50.0
            elif edge_type == "import":
                weight = 25.0
            else:
                weight = 1.0  # Structural directory containment

            G.add_edge(src, tgt, weight=float(weight))
            DiG.add_edge(src, tgt, weight=float(weight))

    # -------------------------------------------------------------------------
    # 2. LOUVAIN COMMUNITY DETECTION (Cross-Stack Microservice Discovery)
    # -------------------------------------------------------------------------
    try:
        communities = louvain_communities(G, weight='weight', resolution=1.15, seed=42)
        community_map: Dict[str, int] = {}
        for cluster_idx, member_set in enumerate(communities):
            for node_id in member_set:
                community_map[node_id] = int(cluster_idx)

        for n in nodes:
            n["data"]["community"] = int(community_map.get(n["id"], 0))
    except Exception as e:
        print(f"⚠️ Louvain Clustering Fallback: {e}")
        for n in nodes:
            n["data"]["community"] = 0

    # -------------------------------------------------------------------------
    # 3. DUAL GRAPH CENTRALITY (PageRank Authority & Betweenness Bottlenecks)
    # -------------------------------------------------------------------------
    pagerank_scores: Dict[str, float] = {}
    betweenness_scores: Dict[str, float] = {}

    try:
        if len(DiG.edges) > 0:
            pagerank_scores = nx.pagerank(DiG, alpha=0.85, weight='weight')
        else:
            pagerank_scores = {nid: 1.0 / len(nodes) for nid in node_id_set}

        if len(G.edges) > 0:
            betweenness_scores = nx.betweenness_centrality(G, weight='weight', normalized=True)
        else:
            betweenness_scores = {nid: 0.0 for nid in node_id_set}
    except Exception as e:
        print(f"⚠️ Centrality Computation Fallback: {e}")
        pagerank_scores = {nid: 0.0 for nid in node_id_set}
        betweenness_scores = {nid: 0.0 for nid in node_id_set}

    pr_max = float(max(pagerank_scores.values())) if pagerank_scores else 1.0
    bw_max = float(max(betweenness_scores.values())) if betweenness_scores else 1.0

    for n in nodes:
        nid = n["id"]
        raw_pr = float(pagerank_scores.get(nid, 0.0))
        raw_bw = float(betweenness_scores.get(nid, 0.0))
        norm_pr = (raw_pr / pr_max) if pr_max > 0 else 0.0
        norm_bw = (raw_bw / bw_max) if bw_max > 0 else 0.0

        n["data"]["pagerank"] = float(round(norm_pr, 4))
        n["data"]["betweenness"] = float(round(norm_bw, 4))
        n["data"]["in_degree"] = int(DiG.in_degree(nid)) if nid in DiG else 0
        n["data"]["out_degree"] = int(DiG.out_degree(nid)) if nid in DiG else 0

    # -------------------------------------------------------------------------
    # 4. 10-DIMENSIONAL FEATURE TENSOR EXTRACTION (X in R^10)
    # -------------------------------------------------------------------------
    feature_rows = []
    target_node_indices = []

    for idx, n in enumerate(nodes):
        d = n["data"]
        # Extract and cast the 10 continuous dimensions
        x1_loc = float(d.get("loc", 1))
        x2_complexity = float(d.get("complexity", 0))
        x3_density = float(d.get("density", 0.0))
        x4_nesting = float(d.get("nesting", 1.0))
        x5_params = float(d.get("params", 0.0))
        x6_churn = float(d.get("churn", 0.0))
        x7_pr = float(d.get("pagerank", 0.0))
        x8_bw = float(d.get("betweenness", 0.0))
        
        in_deg = float(d.get("in_degree", 0))
        out_deg = float(d.get("out_degree", 0))
        x9_fan_ratio = float((in_deg + 1.0) / (out_deg + 1.0))
        
        x10_entropy = float(compute_shannon_entropy(d.get("code", "")))
        d["entropy"] = x10_entropy

        feature_vector = [
            x1_loc, x2_complexity, x3_density, x4_nesting, x5_params,
            x6_churn, x7_pr, x8_bw, x9_fan_ratio, x10_entropy
        ]
        feature_rows.append(feature_vector)
        target_node_indices.append(idx)

    # -------------------------------------------------------------------------
    # 5. UNSUPERVISED ANOMALY ISOLATION (Scikit-Learn Isolation Forest)
    # -------------------------------------------------------------------------
    anomaly_flags: Dict[str, bool] = {}
    if len(feature_rows) >= 5:
        try:
            X = np.array(feature_rows, dtype=np.float64)
            # Normalize tensor columns (Min-Max Scaling)
            x_min = X.min(axis=0)
            x_max = X.max(axis=0)
            ranges = np.where((x_max - x_min) == 0, 1.0, x_max - x_min)
            X_norm = (X - x_min) / ranges

            iso_forest = IsolationForest(
                n_estimators=100,
                contamination=0.08,  # Target top 8% most anomalous structures
                random_state=42
            )
            predictions = iso_forest.fit_predict(X_norm)  # -1 = Anomaly, 1 = Normal
            for row_idx, node_array_idx in enumerate(target_node_indices):
                node_id = nodes[node_array_idx]["id"]
                # 🚀 CRITICAL FIX: Cast numpy.bool_ explicitly to Python native bool
                anomaly_flags[node_id] = bool(predictions[row_idx] == -1)
        except Exception as e:
            print(f"⚠️ Isolation Forest Computation Fallback: {e}")

    # -------------------------------------------------------------------------
    # 6. ENSEMBLE RISK SCORING & ARCHITECTURAL CODE SMELL DIAGNOSIS
    # -------------------------------------------------------------------------
    for n in nodes:
        d = n["data"]
        nid = n["id"]

        loc = float(d.get("loc", 1))
        complexity = float(d.get("complexity", 0))
        density = float(d.get("density", 0.0))
        churn = float(d.get("churn", 0))
        pr = float(d.get("pagerank", 0.0))
        bw = float(d.get("betweenness", 0.0))
        entropy = float(d.get("entropy", 0.0))
        is_anomaly = bool(anomaly_flags.get(nid, False))
        node_type = str(d.get("nodeType", "function"))

        # Composite Mathematical Risk Equation
        risk_score = float(
            (complexity * 0.35) +
            (churn * 1.8) +
            (density * 12.0) +
            (bw * 6.0) +
            (1.5 if is_anomaly else 0.0)
        )

        ai_diagnosis: List[str] = []

        # Real-time Architectural Code Smell Classifiers
        if loc > 120 and pr > 0.75:
            ai_diagnosis.append("God Object (Monolithic Centrality)")
        if density > 0.35 or (entropy > 4.8 and loc < 20):
            ai_diagnosis.append("Spaghetti Logic (Excessive Density)")
        if churn >= 4 and complexity >= 4:
            ai_diagnosis.append("Fragile Hotspot (High Churn + Complex)")
        if bw > 0.7:
            ai_diagnosis.append("System Bottleneck (Bridge Node)")
        if is_anomaly and not ai_diagnosis:
            ai_diagnosis.append("Statistical Structural Anomaly")

        # Categorical Risk Classification
        if risk_score > 12.0 or (complexity >= 8 and churn >= 3) or len(ai_diagnosis) >= 2:
            risk_level = "high"
        elif risk_score > 5.5 or complexity >= 4 or is_anomaly:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Directory containment risk override
        if node_type == "folder":
            risk_level = "low"
            risk_score = 0.0

        d["risk"] = risk_level
        d["risk_score"] = float(round(risk_score, 2))
        d["is_anomaly"] = bool(is_anomaly)

        # Synthesize the Instant Semantic Diagnosis for Z-Level 3 Code Peek
        if ai_diagnosis:
            d["aiSummary"] = "CRITICAL SMELLS: " + " | ".join(ai_diagnosis)
        elif risk_level == "low" and not d.get("aiSummary"):
            d["aiSummary"] = "Code topology is mathematically stable."

    # 🛡️ 7. GLOBAL RECURSIVE SANITIZATION BEFORE JSON ENCODING
    return sanitize_for_json(nodes)