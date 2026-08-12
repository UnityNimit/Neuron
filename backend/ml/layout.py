# backend/ml/layout.py
import networkx as nx
from node2vec import Node2Vec
import umap.umap_ as umap
import numpy as np

def calculate_ml_layout(nodes, edges):
    """
    Takes raw nodes and edges, runs them through Node2Vec and UMAP,
    and returns exact (X, Y) pixel coordinates for the React Canvas.
    """
    # FIX 1: If there are fewer than 3 nodes, assign simple grid positions!
    # UMAP requires at least 3 nodes to perform 2D dimensionality reduction safely.
    if len(nodes) < 3:
        for i, node in enumerate(nodes):
            node["position"] = {"x": 250 + (i * 500), "y": 150}
        return nodes

    # 1. Build the NetworkX Graph
    G = nx.Graph()
    for node in nodes:
        G.add_node(node["id"])
    for edge in edges:
        G.add_edge(edge["source"], edge["target"])

    # 2. Node2Vec Neural Network Embeddings
    node2vec = Node2Vec(G, dimensions=64, walk_length=10, num_walks=50, workers=1, quiet=True)
    model = node2vec.fit(window=5, min_count=1, batch_words=4)
    
    node_ids = list(G.nodes())
    embeddings = np.array([model.wv[node_id] for node_id in node_ids])

    # 3. UMAP Dimensionality Reduction
    # FIX 2: Force n_neighbors to always be at least 2 so UMAP never raises ValueError
    n_neighbors = max(2, min(len(nodes) - 1, 15))
    
    reducer = umap.UMAP(
        n_neighbors=n_neighbors, 
        min_dist=0.5, 
        n_components=2, 
        random_state=42,
        init='random' 
    )
    layout_2d = reducer.fit_transform(embeddings)

    # 4. Scale the UMAP output to React Flow pixel coordinates
    SPREAD_FACTOR = 600
    
    for i, node_id in enumerate(node_ids):
        x_coord = float(layout_2d[i][0]) * SPREAD_FACTOR
        y_coord = float(layout_2d[i][1]) * SPREAD_FACTOR
        
        for n in nodes:
            if n["id"] == node_id:
                n["position"] = {"x": x_coord, "y": y_coord}
                break

    return nodes