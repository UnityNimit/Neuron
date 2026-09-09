# backend/ml/analyzer.py
import math
from collections import Counter
from typing import Any, Dict, List, Optional, Set, Tuple

import networkx as nx
import numpy as np
from networkx.algorithms.community import louvain_communities

IsolationForest = None
try:
    from sklearn.ensemble import IsolationForest
except Exception:
    pass


def compute_shannon_entropy(code_str: str) -> float:
    """
    Calculates the Shannon Entropy H(X) over the character distribution of a code block.
    High entropy (>4.8) indicates dense algorithmic logic, obfuscation, or high cognitive load.
    Formula: H(X) = - sum( P(x) * log2(P(x)) )
    """
    if not code_str or not code_str.strip():
        return 0.0
    clean_code = code_str.strip()
    length = len(clean_code)
    counts = Counter(clean_code)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        if p > 0:
            entropy -= p * math.log2(p)
    return float(round(entropy, 4))


def sanitize_for_json(obj: Any) -> Any:
    """
     BULLETPROOF NUMPY & GRAPH TO JSON SANITIZER
    Recursively converts all NumPy types (np.bool_, np.int64, np.float64, np.ndarray),
    sets, NaN, and Infinity into native Python primitives to guarantee 100% JSON serializability.
    """
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, (set, frozenset)):
        return [sanitize_for_json(v) for v in list(obj)]
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32, np.float16)):
        val = float(obj)
        if math.isnan(val) or math.isinf(val):
            return 0.0
        return val
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return obj
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    return obj


# In-Memory Cache for Graph Topology ML analysis (avoids repeating Louvain, PageRank, Betweenness & IsolationForest on unchanged topology)
_TOPOLOGY_ML_CACHE: Dict[int, Dict[str, Any]] = {}


def analyze_graph_ml(nodes: List[dict], edges: List[dict]) -> List[dict]:
    """
     THE ULTIMATE MULTI-MODAL ML & GRAPH THEORY INTELLIGENCE PIPELINE
    Calculates:
      1. Weighted Louvain Modularity (Microservice Community Clusters for Nebula VFX)
      2. Dual-Graph Centrality (PageRank Authority + Betweenness Bottlenecks)
      3. In/Out Degree Ratios (Fan-In / Fan-Out Dependency Flow)
      4. 10-Dimensional Continuous Feature Tensor Synthesis
      5. Single-Threaded Scikit-Learn Isolation Forest (Zero-Fork Anomaly Isolation)
      6. Multi-Factor Risk Scoring & Architectural Code Smell Diagnosis
      7. Recursive JSON Sanitization for Zero-Failure WebSocket Transmissions
    """
    if not nodes:
        return []

    node_id_set = {str(n["id"]) for n in nodes if n.get("id")}
    if not edges:
        # Default baseline metadata if edges are empty
        for n in nodes:
            d = n.setdefault("data", {})
            d["community"] = 0
            d["pagerank"] = 0.0
            d["betweenness"] = 0.0
            d["in_degree"] = 0
            d["out_degree"] = 0
            d["risk"] = "low"
            d["risk_score"] = 0.0
            d["is_anomaly"] = False
            d["entropy"] = compute_shannon_entropy(d.get("code", ""))
        return sanitize_for_json(nodes)

    # 🚀 HIGH-SPEED TOPOLOGY HASH CHECK (<0.01ms cache hit)
    node_keys = tuple(sorted(str(n["id"]) for n in nodes if n.get("id")))
    edge_keys = tuple(sorted(f"{e.get('source')}->{e.get('target')}:{e.get('type')}" for e in edges))
    topo_hash = hash((node_keys, edge_keys))

    cached_ml = _TOPOLOGY_ML_CACHE.get(topo_hash)
    if cached_ml is not None:
        community_map = cached_ml["community_map"]
        centrality_map = cached_ml["centrality_map"]
        anomaly_flags = cached_ml["anomaly_flags"]
        for n in nodes:
            nid = str(n["id"])
            d = n.setdefault("data", {})
            d["community"] = int(community_map.get(nid, 0))
            norm_pr, norm_bw, in_deg, out_deg = centrality_map.get(nid, (0.0, 0.0, 0, 0))
            d["pagerank"] = norm_pr
            d["betweenness"] = norm_bw
            d["in_degree"] = in_deg
            d["out_degree"] = out_deg
            d["entropy"] = float(compute_shannon_entropy(str(d.get("code", ""))))
    else:
        # -------------------------------------------------------------------------
        # 1. BUILD DUAL GRAPHS (Undirected for Louvain, Directed for Flow/Authority)
        # -------------------------------------------------------------------------
        G = nx.Graph()
        DiG = nx.DiGraph()

        for n in nodes:
            nid = str(n["id"])
            G.add_node(nid)
            DiG.add_node(nid)

        seen_edge_pairs: Set[Tuple[str, str]] = set()

        for e in edges:
            src = str(e.get("source", ""))
            tgt = str(e.get("target", ""))
            
            if src and tgt and src != tgt and src in node_id_set and tgt in node_id_set:
                pair = (src, tgt)
                if pair in seen_edge_pairs:
                    continue
                seen_edge_pairs.add(pair)

                # Weighted semantic topology
                edge_type = e.get("type", "hierarchy")
                if edge_type == "network_bridge":
                    weight = 60.0  # Laser Frontend-Backend Conduit
                elif edge_type == "call":
                    weight = 40.0  # Dynamic AST Function Call
                elif edge_type == "import":
                    weight = 20.0  # Module Dependency
                else:
                    weight = 1.0   # Structural Directory Containment

                G.add_edge(src, tgt, weight=float(weight))
                DiG.add_edge(src, tgt, weight=float(weight))

        # -------------------------------------------------------------------------
        # 2. ADAPTIVE LOUVAIN COMMUNITY DETECTION (Nebula Galaxy Clusters)
        # -------------------------------------------------------------------------
        community_map: Dict[str, int] = {}
        try:
            graph_size = len(nodes)
            dynamic_res = 1.2 if graph_size > 100 else 1.05
            communities = louvain_communities(G, weight='weight', resolution=dynamic_res, seed=42)
            
            for cluster_idx, member_set in enumerate(communities):
                for node_id in member_set:
                    community_map[node_id] = int(cluster_idx)

            for n in nodes:
                n.setdefault("data", {})["community"] = int(community_map.get(str(n["id"]), 0))
        except Exception:
            for n in nodes:
                n.setdefault("data", {})["community"] = 0

        # -------------------------------------------------------------------------
        # 3. DUAL GRAPH CENTRALITY (PageRank Authority & Betweenness Bottlenecks)
        # -------------------------------------------------------------------------
        pagerank_scores: Dict[str, float] = {}
        betweenness_scores: Dict[str, float] = {}

        try:
            if len(DiG.edges) > 0:
                pagerank_scores = nx.pagerank(DiG, alpha=0.85, weight='weight', max_iter=500, tol=1e-5)
            else:
                pagerank_scores = {nid: 1.0 / max(1, len(nodes)) for nid in node_id_set}

            if len(G.edges) > 0:
                if len(G) > 80:
                    betweenness_scores = nx.betweenness_centrality(G, k=min(60, len(G)), weight='weight', normalized=True, seed=42)
                else:
                    betweenness_scores = nx.betweenness_centrality(G, weight='weight', normalized=True)
            else:
                betweenness_scores = {nid: 0.0 for nid in node_id_set}
        except Exception:
            pagerank_scores = {nid: 0.0 for nid in node_id_set}
            betweenness_scores = {nid: 0.0 for nid in node_id_set}

        pr_values = list(pagerank_scores.values())
        bw_values = list(betweenness_scores.values())
        pr_max = float(max(pr_values)) if pr_values else 1.0
        bw_max = float(max(bw_values)) if bw_values else 1.0

        for n in nodes:
            nid = str(n["id"])
            d = n.setdefault("data", {})
            
            raw_pr = float(pagerank_scores.get(nid, 0.0))
            raw_bw = float(betweenness_scores.get(nid, 0.0))
            
            norm_pr = float(raw_pr / pr_max) if pr_max > 0 else 0.0
            norm_bw = float(raw_bw / bw_max) if bw_max > 0 else 0.0

            d["pagerank"] = float(round(norm_pr, 4))
            d["betweenness"] = float(round(norm_bw, 4))
            d["in_degree"] = int(DiG.in_degree(nid)) if nid in DiG else 0
            d["out_degree"] = int(DiG.out_degree(nid)) if nid in DiG else 0

        # -------------------------------------------------------------------------
        # 4. 10-DIMENSIONAL CONTINUOUS FEATURE TENSOR (X in R^10)
        # -------------------------------------------------------------------------
        feature_rows = []
        target_node_indices = []

        for idx, n in enumerate(nodes):
            d = n.setdefault("data", {})
            
            x1_loc = float(d.get("loc", 1) or 1)
            x2_complexity = float(d.get("complexity", 0) or 0)
            x3_density = float(d.get("density", 0.0) or 0.0)
            x4_nesting = float(d.get("nesting", 1.0) or 1.0)
            x5_params = float(d.get("params", 0.0) or 0.0)
            x6_churn = float(d.get("churn", 0.0) or 0.0)
            x7_pr = float(d.get("pagerank", 0.0) or 0.0)
            x8_bw = float(d.get("betweenness", 0.0) or 0.0)
            
            in_deg = float(d.get("in_degree", 0))
            out_deg = float(d.get("out_degree", 0))
            x9_fan_ratio = float((in_deg + 1.0) / (out_deg + 1.0))
            
            x10_entropy = float(compute_shannon_entropy(str(d.get("code", ""))))
            d["entropy"] = x10_entropy

            feature_vector = [
                x1_loc, x2_complexity, x3_density, x4_nesting, x5_params,
                x6_churn, x7_pr, x8_bw, x9_fan_ratio, x10_entropy
            ]
            feature_rows.append(feature_vector)
            target_node_indices.append(idx)

        # -------------------------------------------------------------------------
        # 5. UNSUPERVISED ANOMALY ISOLATION (Single-Threaded n_jobs=1)
        # -------------------------------------------------------------------------
        anomaly_flags: Dict[str, bool] = {}
        
        if len(feature_rows) >= 6:
            try:
                X = np.array(feature_rows, dtype=np.float64)
                X = np.nan_to_num(X, nan=0.0, posinf=1.0, neginf=0.0)

                # Min-Max Feature Normalization
                x_min = X.min(axis=0)
                x_max = X.max(axis=0)
                ranges = np.where((x_max - x_min) == 0, 1.0, x_max - x_min)
                X_norm = (X - x_min) / ranges
                X_norm = np.nan_to_num(X_norm, nan=0.0, posinf=1.0, neginf=0.0)

                contamination = max(0.02, min(0.12, 6.0 / len(feature_rows)))
                
                if IsolationForest is not None:
                    try:
                        iso_forest = IsolationForest(
                            n_estimators=80,
                            contamination=contamination,
                            random_state=42,
                            n_jobs=1
                        )
                        predictions = iso_forest.fit_predict(X_norm)
                        
                        for row_idx, node_array_idx in enumerate(target_node_indices):
                            node_id = str(nodes[node_array_idx]["id"])
                            anomaly_flags[node_id] = bool(predictions[row_idx] == -1)
                    except Exception:
                        pass

                # High-Speed Pure NumPy Robust Outlier Detection Fallback (Zero SciPy/Sklearn Bloat)
                if not anomaly_flags and len(feature_rows) >= 6:
                    try:
                        dist = np.linalg.norm(X_norm - np.median(X_norm, axis=0), axis=1)
                        cutoff = np.percentile(dist, (1.0 - contamination) * 100)
                        for row_idx, node_array_idx in enumerate(target_node_indices):
                            node_id = str(nodes[node_array_idx]["id"])
                            anomaly_flags[node_id] = bool(dist[row_idx] > cutoff)
                    except Exception:
                        pass
            except Exception:
                pass

        # Save to Topology ML Cache
        centrality_map: Dict[str, Tuple[float, float, int, int]] = {}
        for n in nodes:
            nid = str(n["id"])
            d = n.get("data", {})
            centrality_map[nid] = (
                d.get("pagerank", 0.0),
                d.get("betweenness", 0.0),
                d.get("in_degree", 0),
                d.get("out_degree", 0)
            )

        if len(_TOPOLOGY_ML_CACHE) > 8:
            _TOPOLOGY_ML_CACHE.clear()

        _TOPOLOGY_ML_CACHE[topo_hash] = {
            "community_map": community_map,
            "centrality_map": centrality_map,
            "anomaly_flags": anomaly_flags
        }

    # -------------------------------------------------------------------------
    # 6. RISK SCORING & ARCHITECTURAL CODE SMELL DIAGNOSIS
    # -------------------------------------------------------------------------
    for n in nodes:
        d = n.setdefault("data", {})
        nid = str(n["id"])

        loc = float(d.get("loc", 1) or 1)
        complexity = float(d.get("complexity", 0) or 0)
        density = float(d.get("density", 0.0) or 0.0)
        churn = float(d.get("churn", 0) or 0)
        pr = float(d.get("pagerank", 0.0) or 0.0)
        bw = float(d.get("betweenness", 0.0) or 0.0)
        entropy = float(d.get("entropy", 0.0) or 0.0)
        in_deg = int(d.get("in_degree", 0))
        out_deg = int(d.get("out_degree", 0))
        is_anomaly = bool(anomaly_flags.get(nid, False))
        node_type = str(d.get("nodeType", "function"))

        risk_score = float(
            (complexity * 0.35) +
            (churn * 1.8) +
            (density * 12.0) +
            (bw * 6.0) +
            (1.5 if is_anomaly else 0.0)
        )

        ai_diagnosis: List[str] = []

        if loc > 120 and pr > 0.70:
            ai_diagnosis.append("God Object (Monolithic Centrality)")
        if density > 0.35 or (entropy > 4.85 and loc < 25):
            ai_diagnosis.append("Spaghetti Logic (Excessive Density)")
        if churn >= 3 and complexity >= 4:
            ai_diagnosis.append("Fragile Hotspot (High Churn + Complex)")
        if bw > 0.65:
            ai_diagnosis.append("System Bottleneck (Bridge Node)")
        if node_type == "function" and in_deg == 0 and out_deg == 0 and loc > 10:
            ai_diagnosis.append("Dead Code Candidate (Isolated Symbol)")
        if is_anomaly and not ai_diagnosis:
            ai_diagnosis.append("Statistical Structural Anomaly")

        if risk_score > 11.5 or (complexity >= 8 and churn >= 3) or len(ai_diagnosis) >= 2:
            risk_level = "high"
        elif risk_score > 5.0 or complexity >= 4 or is_anomaly:
            risk_level = "medium"
        else:
            risk_level = "low"

        if node_type == "folder":
            risk_level = "low"
            risk_score = 0.0

        d["risk"] = risk_level
        d["risk_score"] = float(round(risk_score, 2))
        d["is_anomaly"] = bool(is_anomaly)

        if ai_diagnosis:
            d["aiSummary"] = "CRITICAL SMELLS: " + " | ".join(ai_diagnosis)
        elif risk_level == "low" and not d.get("aiSummary"):
            d["aiSummary"] = "Code topology is mathematically stable."

    #  7. RECURSIVE SANITIZATION FOR ZERO WEBSOCKET FAILS
    return sanitize_for_json(nodes)