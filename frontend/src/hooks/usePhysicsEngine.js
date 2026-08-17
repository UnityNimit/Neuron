// frontend/src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

// 🪐 PERPETUAL COSMIC CONSTANTS
const RESTING_ALPHA_TARGET = 0.018;  // Keeps the universe floating continuously
const DRAGGING_ALPHA_TARGET = 0.25;  // High responsiveness during dragging
const MIN_ALPHA_THRESHOLD = 0.001;

// Coordinate Sanity Guard
const sanitizeCoordinate = (val, fallback = 0) => {
  return typeof val === 'number' && isFinite(val) && !isNaN(val) ? val : fallback;
};

export function usePhysicsEngine(nodes = [], edges = [], wsRef, isGraphLoaded, centerView) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);
  const spawnTimerRef = useRef(null);

  // 🚀 MASTER RAM CACHE (Direct Zero-Copy Access for WebGL Canvas)
  const simDataRef = useRef({
    nodes: [],
    edges: [],
    superNodes: [],
    activeNodeCount: 0,
    isSpawningComplete: false
  });

  // 🛡️ TOPOLOGY FINGERPRINTS: Detects link reconnections even if total counts remain identical
  const nodeTopologyKey = useMemo(() => {
    return (nodes || []).map(n => n.id).join('|');
  }, [nodes]);

  const edgeTopologyKey = useMemo(() => {
    return (edges || []).map(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      return `${e.id || 'edge'}:${s}->${t}`;
    }).join('|');
  }, [edges]);

  useEffect(() => {
    if (!isGraphLoaded || !nodes || nodes.length === 0) return;

    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }

    // 1. DEFENSIVE NODE DEDUPLICATION PASS
    const uniqueIncomingNodesMap = new Map();
    nodes.forEach(n => {
      if (n && n.id && !uniqueIncomingNodesMap.has(n.id)) {
        uniqueIncomingNodesMap.set(n.id, n);
      }
    });
    const sanitizedIncomingNodes = Array.from(uniqueIncomingNodesMap.values());

    // 2. IMMUTABLE HIERARCHY TREE
    const parentMap = new Map();
    const childrenMap = new Map();

    (edges || []).forEach(e => {
      const srcId = typeof e.source === 'object' ? e.source.id : e.source;
      const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
      if (srcId && tgtId && (e.type === 'hierarchy' || !e.type)) {
        parentMap.set(tgtId, srcId);
        if (!childrenMap.has(srcId)) childrenMap.set(srcId, []);
        childrenMap.get(srcId).push(tgtId);
      }
    });

    const existingMap = new Map(simDataRef.current.nodes.map(n => [n.id, n]));

    // 3. COMPILE CELESTIAL NODE GRAPH WITH ANTI-NAN GUARDS
    const rawNodes = sanitizedIncomingNodes.map((n, idx) => {
      const existing = existingMap.get(n.id);
      const nodeType = n.data?.nodeType || 'function';
      const tier = nodeType === 'folder' ? 0 : nodeType === 'file' ? 1 : 2;

      // Safe initial coordinate assignment
      const fallbackX = (Math.cos(idx) * (30 + idx * 8));
      const fallbackY = (Math.sin(idx) * (30 + idx * 8));

      const rawX = existing?.x ?? n.position?.x ?? fallbackX;
      const rawY = existing?.y ?? n.position?.y ?? fallbackY;

      return {
        ...n,
        id: String(n.id),
        nodeType,
        tier,
        x: sanitizeCoordinate(rawX, fallbackX),
        y: sanitizeCoordinate(rawY, fallbackY),
        vx: sanitizeCoordinate(existing?.vx, 0),
        vy: sanitizeCoordinate(existing?.vy, 0),
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
        spawnProgress: existing ? 1 : 0,
        isSpawned: !!existing
      };
    });

    const nodeLookup = new Map(rawNodes.map(n => [n.id, n]));
    const validNodeIdSet = new Set(rawNodes.map(n => n.id));

    // 4. SANITIZE & DEDUPLICATE EDGES
    const seenEdgeKeys = new Set();
    const allEdges = (edges || [])
      .filter(e => {
        const srcId = typeof e.source === 'object' ? String(e.source.id) : String(e.source);
        const tgtId = typeof e.target === 'object' ? String(e.target.id) : String(e.target);
        const edgeKey = `${srcId}->${tgtId}`;
        
        if (srcId && tgtId && srcId !== tgtId && validNodeIdSet.has(srcId) && validNodeIdSet.has(tgtId) && !seenEdgeKeys.has(edgeKey)) {
          seenEdgeKeys.add(edgeKey);
          return true;
        }
        return false;
      })
      .map(e => ({
        id: e.id || `edge-${e.source}-${e.target}`,
        source: typeof e.source === 'object' ? String(e.source.id) : String(e.source),
        target: typeof e.target === 'object' ? String(e.target.id) : String(e.target),
        type: e.type || 'hierarchy'
      }));

    // 5. SUPER-NODES FOR MACRO LOD (Zoom < 0.2)
    const clusterMap = new Map();
    rawNodes.forEach(node => {
      const clusterKey = node.data?.filePath?.split('/')[0] || node.id.split('/')[0] || 'root';
      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, {
          id: `super-${clusterKey}`,
          clusterKey,
          label: clusterKey,
          nodeType: 'superNode',
          totalNodes: 0,
          totalLOC: 0,
          childIds: [],
          x: 0, 
          y: 0
        });
      }
      const cluster = clusterMap.get(clusterKey);
      cluster.totalNodes += 1;
      cluster.totalLOC += Number(node.data?.loc || 10);
      cluster.childIds.push(node.id);
    });

    const superNodes = Array.from(clusterMap.values()).map(c => ({
      ...c,
      radius: Math.min(90, 28 + Math.log10(c.totalLOC + 1) * 16)
    }));

    // 6. INITIALIZE MASTER SIMULATION POOL
    const alreadySpawnedNodes = rawNodes.filter(n => n.isSpawned);
    const activeNodesPool = alreadySpawnedNodes.length > 0 ? [...alreadySpawnedNodes] : [];
    const activeNodeIds = new Set(activeNodesPool.map(n => n.id));

    simDataRef.current = {
      nodes: rawNodes,
      edges: allEdges,
      superNodes,
      activeNodeCount: activeNodesPool.length,
      isSpawningComplete: activeNodesPool.length === rawNodes.length
    };

    const getActiveEdges = () => {
      return allEdges.filter(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return activeNodeIds.has(s) && activeNodeIds.has(t);
      });
    };

    const linkForce = d3.forceLink(getActiveEdges()).id(d => d.id)
      .distance(link => {
        const tgtType = link.target?.nodeType || link.target?.data?.nodeType;
        if (link.type === 'hierarchy') {
          return tgtType === 'function' 
            ? (PHYSICS.SPRING_DISTANCE?.moonOrbit || 45)
            : (PHYSICS.SPRING_DISTANCE?.planetOrbit || 95);
        }
        if (link.type === 'network_bridge') {
          return (PHYSICS.SPRING_DISTANCE?.neuralCall || 180) * 1.2;
        }
        return (PHYSICS.SPRING_DISTANCE?.neuralCall || 160);
      })
      .strength(link => {
        if (link.type === 'hierarchy') return 0.95;
        if (link.type === 'network_bridge') return 0.35;
        return 0.25;
      });

    const simulation = d3.forceSimulation(activeNodesPool)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody()
        .strength(d => {
          return d.nodeType === 'folder' 
            ? (PHYSICS.REPULSION?.folder || -2600) 
            : d.nodeType === 'file' 
              ? (PHYSICS.REPULSION?.file || -900) 
              : (PHYSICS.REPULSION?.function || -240);
        })
        .distanceMax(PHYSICS.MAX_REPULSION_DISTANCE || 2200)
      )
      .force("x", d3.forceX(0).strength(0.008))
      .force("y", d3.forceY(0).strength(0.008))
      .force("collide", d3.forceCollide()
        .radius(d => {
          const base = d.nodeType === 'folder' 
            ? (PHYSICS.COLLISION_RADIUS?.folder || 48) 
            : d.nodeType === 'file' 
              ? (PHYSICS.COLLISION_RADIUS?.file || 26) 
              : (PHYSICS.COLLISION_RADIUS?.function || 15);
          return base + 10;
        })
        .iterations(2)
      )
      .alphaDecay(0.012)
      .velocityDecay(0.52);

    // Active Sanity Clamp on every D3 Simulation Tick
    simulation.on("tick", () => {
      activeNodesPool.forEach(node => {
        if (isNaN(node.x) || !isFinite(node.x)) node.x = (Math.random() - 0.5) * 50;
        if (isNaN(node.y) || !isFinite(node.y)) node.y = (Math.random() - 0.5) * 50;
        if (isNaN(node.vx) || !isFinite(node.vx)) node.vx = 0;
        if (isNaN(node.vy) || !isFinite(node.vy)) node.vy = 0;
      });
    });

    simulation.alphaTarget(RESTING_ALPHA_TARGET).restart();
    simulationRef.current = simulation;

    // 7. ORDERED BFS EMISSION QUEUE (Incremental Celestial Birth)
    const roots = rawNodes.filter(n => !parentMap.has(n.id) || n.tier === 0);
    const spawnQueue = [];
    const queuedSet = new Set(activeNodeIds);
    const bfsQueue = [...roots];

    roots.forEach(r => queuedSet.add(r.id));

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift();
      if (!current.isSpawned) {
        spawnQueue.push(current);
      }

      const childIds = childrenMap.get(current.id) || [];
      childIds.forEach(cId => {
        if (!queuedSet.has(cId)) {
          queuedSet.add(cId);
          const childNode = nodeLookup.get(cId);
          if (childNode) bfsQueue.push(childNode);
        }
      });
    }

    rawNodes.forEach(n => {
      if (!queuedSet.has(n.id)) {
        queuedSet.add(n.id);
        if (!n.isSpawned) spawnQueue.push(n);
      }
    });

    // 8. HIGH-SPEED SEQUENTIAL EMITTER
    const totalToSpawn = spawnQueue.length;
    const delayPerNodeMs = Math.max(15, Math.min(120, Math.round(8000 / Math.max(1, totalToSpawn))));

    const emitNextNode = () => {
      if (document.hidden || centerView !== 'spatial') {
        spawnTimerRef.current = setTimeout(emitNextNode, 150);
        return;
      }

      if (spawnQueue.length === 0) {
        simDataRef.current.isSpawningComplete = true;
        spawnTimerRef.current = null;
        return;
      }

      const node = spawnQueue.shift();
      const parentId = parentMap.get(node.id);
      const parentNode = parentId ? nodeLookup.get(parentId) : null;

      if (!parentNode || !parentNode.isSpawned) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        node.x = Math.cos(angle) * dist;
        node.y = Math.sin(angle) * dist;
        node.vx = Math.cos(angle) * 2;
        node.vy = Math.sin(angle) * 2;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const birthDist = 12;

        node.x = parentNode.x + Math.cos(angle) * birthDist;
        node.y = parentNode.y + Math.sin(angle) * birthDist;

        const speed = node.nodeType === 'file' ? 6.5 : 3.5;
        node.vx = (parentNode.vx || 0) * 0.2 + Math.cos(angle) * speed;
        node.vy = (parentNode.vy || 0) * 0.2 + Math.sin(angle) * speed;
      }

      node.isSpawned = true;
      node.spawnProgress = 0;

      activeNodesPool.push(node);
      activeNodeIds.add(node.id);

      const activeEdges = getActiveEdges();

      simulation.nodes(activeNodesPool);
      linkForce.links(activeEdges);
      simulation.alpha(Math.max(simulation.alpha(), 0.26)).restart();

      simDataRef.current.activeNodeCount = activeNodesPool.length;
      spawnTimerRef.current = setTimeout(emitNextNode, delayPerNodeMs);
    };

    if (totalToSpawn > 0) {
      spawnTimerRef.current = setTimeout(emitNextNode, 60);
    } else {
      simDataRef.current.isSpawningComplete = true;
    }

    // 9. BROWSER TAB HIBERNATION
    const handleVisibilityChange = () => {
      if (document.hidden || centerView !== 'spatial') {
        simulation.stop();
      } else {
        simulation.alphaTarget(RESTING_ALPHA_TARGET).restart();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
      simulation.stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isGraphLoaded, nodeTopologyKey, edgeTopologyKey, centerView]);

  // ZERO-LATENCY DRAG HANDLERS
  const onDragStart = useCallback((nodeId, x, y) => {
    draggedNodeRef.current = nodeId;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { 
      simNode.fx = sanitizeCoordinate(x); 
      simNode.fy = sanitizeCoordinate(y); 
    }
    simulationRef.current?.alphaTarget(DRAGGING_ALPHA_TARGET).restart();
  }, []);

  const onDragMove = useCallback((nodeId, x, y) => {
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { 
      simNode.fx = sanitizeCoordinate(x); 
      simNode.fy = sanitizeCoordinate(y); 
    }
  }, []);

  const onDragEnd = useCallback((nodeId) => {
    draggedNodeRef.current = null;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) {
      simNode.fx = null;
      simNode.fy = null;
    }
    simulationRef.current?.alphaTarget(RESTING_ALPHA_TARGET);

    if (wsRef.current?.readyState === WebSocket.OPEN && simNode) {
      wsRef.current.send(JSON.stringify({
        event: 'NODE_MOVE',
        node_id: nodeId,
        position: { x: simNode.x, y: simNode.y }
      }));
    }
  }, [wsRef]);

  return { simDataRef, onDragStart, onDragMove, onDragEnd };
}