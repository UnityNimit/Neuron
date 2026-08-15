# backend/ml/analyzer.py
import networkx as nx
from networkx.algorithms.community import louvain_communities

def analyze_graph_ml(nodes, edges):
    if not nodes or not edges: return nodes

    G = nx.Graph()   
    DiG = nx.DiGraph()
    
    for n in nodes: 
        G.add_node(n["id"])
        DiG.add_node(n["id"])
        
    for e in edges:
        if e["source"] != e["target"]:
            # ML WEIGHTING: Force the AI to group by Business Logic, not folders!
            weight = 50.0 if e.get("type") == "call" else 1.0
            
            G.add_edge(e["source"], e["target"], weight=weight)
            DiG.add_edge(e["source"], e["target"], weight=weight)

    # 2. LOUVAIN COMMUNITY DETECTION (Now logic-aware!)
    try:
        # Uses the new weights to prioritize functional coupling over folder location
        communities = louvain_communities(G, weight='weight', resolution=1.0, seed=42)
        community_map = {}
        for idx, comm in enumerate(communities):
            for node_id in comm: community_map[node_id] = idx
        for n in nodes:
            n["data"]["community"] = community_map.get(n["id"], 0)
    except Exception as e: pass

    # 3. GRAPH THEORY METRICS
    try:
        pagerank_scores = nx.pagerank(DiG, alpha=0.85, weight='weight')
        betweenness_scores = nx.betweenness_centrality(G, weight='weight')
        
        pr_max = max(pagerank_scores.values()) if pagerank_scores else 1
        bw_max = max(betweenness_scores.values()) if betweenness_scores else 1
        
        for n in nodes:
            n_id = n["id"]
            n["data"]["pagerank"] = pagerank_scores.get(n_id, 0) / pr_max if pr_max > 0 else 0
            n["data"]["betweenness"] = betweenness_scores.get(n_id, 0) / bw_max if bw_max > 0 else 0
    except Exception as e: pass

    # 4. ENSEMBLE RISK HEURISTIC & CODE SMELL DETECTION
    for n in nodes:
        d = n["data"]
        complexity = d.get("complexity", 0)
        loc = d.get("loc", 0)
        density = d.get("density", 0)
        churn = d.get("churn", 0)
        pr = d.get("pagerank", 0)
        bw = d.get("betweenness", 0)

        risk_score = (complexity * 0.3) + (churn * 1.5) + (density * 10.0) + (bw * 5.0)
        risk_level = "low"
        ai_diagnosis = []

        if loc > 150 and pr > 0.8: ai_diagnosis.append("God Object (Monolithic)")
        if density > 0.3: ai_diagnosis.append("Spaghetti Logic (High Density)")
        if churn > 5 and complexity > 5: ai_diagnosis.append("Fragile Hotspot (High Churn + Complex)")
        if bw > 0.8: ai_diagnosis.append("System Bottleneck")

        if risk_score > 12 or (complexity > 8 and churn > 3) or len(ai_diagnosis) >= 2: risk_level = "high"
        elif risk_score > 6 or complexity > 4 or len(ai_diagnosis) == 1: risk_level = "medium"

        d["risk"] = risk_level
        d["risk_score"] = round(risk_score, 2)
        
        if ai_diagnosis and not d.get("aiSummary"):
            d["aiSummary"] = "CRITICAL SMELLS: " + " | ".join(ai_diagnosis)
        elif not d.get("aiSummary") and risk_level == "low":
            d["aiSummary"] = "Code appears structurally stable."

    return nodes