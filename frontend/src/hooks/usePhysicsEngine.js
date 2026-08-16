// src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

// 🪐 PERPETUAL COSMIC CONSTANTS
const RESTING_ALPHA_TARGET = 0.018; // Keeps the universe alive & floating 24/7
const DRAGGING_ALPHA_TARGET = 0.22;  // Kinetic impulse when grabbing an orb

export function usePhysicsEngine(nodes, edges, wsRef, isGraphLoaded, centerView) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);
  const spawnTimerRef = useRef(null);

  // 🚀 MASTER RAM CACHE: Direct memory mapping for WebGPU
  const simDataRef = useRef({
    nodes: [],
    edges: [],
    superNodes: [],
    activeNodeCount: 0,
    isSpawningComplete: false
  });

  useEffect(() => {
    if (!isGraphLoaded || nodes.length === 0) return;

    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }

    // 1. IMMUTABLE TREE STRUCTURE & HIERARCHY MAPS
    const parentMap = new Map();
    const childrenMap = new Map();

    edges.forEach(e => {
      const srcId = typeof e.source === 'object' ? e.source.id : e.source;
      const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
      if (e.type === 'hierarchy' || !e.type) {
        parentMap.set(tgtId, srcId);
        if (!childrenMap.has(srcId)) childrenMap.set(srcId, []);
        childrenMap.get(srcId).push(tgtId);
      }
    });

    const existingMap = new Map(simDataRef.current.nodes.map(n => [n.id, n]));

    // 2. PREPARE UNIFIED NODE GRAPH
    const rawNodes = nodes.map(n => {
      const existing = existingMap.get(n.id);
      const nodeType = n.data?.nodeType || 'function';
      const tier = nodeType === 'folder' ? 0 : nodeType === 'file' ? 1 : 2;

      return {
        ...n,
        nodeType,
        tier,
        x: existing?.x ?? 0,
        y: existing?.y ?? 0,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
        spawnProgress: existing ? 1 : 0,
        isSpawned: !!existing
      };
    });

    const nodeLookup = new Map(rawNodes.map(n => [n.id, n]));
    const validNodeIdSet = new Set(rawNodes.map(n => n.id));

    // 3. PREPARE EDGES
    const allEdges = edges
      .filter(e => {
        const srcId = typeof e.source === 'object' ? e.source.id : e.source;
        const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
        return validNodeIdSet.has(srcId) && validNodeIdSet.has(tgtId);
      })
      .map(e => ({
        ...e,
        source: typeof e.source === 'object' ? e.source.id : e.source,
        target: typeof e.target === 'object' ? e.target.id : e.target,
        type: e.type || 'hierarchy'
      }));

    // 4. SUPER-NODES FOR MACRO LOD
    const clusterMap = new Map();
    rawNodes.forEach(node => {
      const clusterKey = node.data?.filePath?.split('/')[0] || node.id;
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
      cluster.totalLOC += (node.data?.loc || 10);
      cluster.childIds.push(node.id);
    });

    const superNodes = Array.from(clusterMap.values()).map(c => ({
      ...c,
      radius: Math.min(80, 25 + Math.log10(c.totalLOC + 1) * 15)
    }));

    simDataRef.current = {
      nodes: rawNodes,
      edges: allEdges,
      superNodes,
      activeNodeCount: rawNodes.filter(n => n.isSpawned).length,
      isSpawningComplete: false
    };

    // 5. 🪐 ACTIVE SIMULATION POOL
    const activeNodesPool = rawNodes.filter(n => n.isSpawned);
    const activeNodeIds = new Set(activeNodesPool.map(n => n.id));
    const activeEdgesPool = allEdges.filter(e => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));

    const linkForce = d3.forceLink(activeEdgesPool).id(d => d.id)
      .distance(link => {
        const tgtType = link.target?.nodeType || link.target?.data?.nodeType;
        if (link.type === 'hierarchy') {
          return tgtType === 'function' 
            ? (PHYSICS.SPRING_DISTANCE.moonOrbit || 40)
            : (PHYSICS.SPRING_DISTANCE.planetOrbit || 85);
        }
        return (PHYSICS.SPRING_DISTANCE.neuralCall || 160);
      })
      .strength(link => (link.type === 'hierarchy' ? 0.9 : 0.2));

    const simulation = d3.forceSimulation(activeNodesPool)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody()
        .strength(d => {
          return d.nodeType === 'folder' 
            ? (PHYSICS.REPULSION.folder || -2400) 
            : d.nodeType === 'file' 
              ? (PHYSICS.REPULSION.file || -850) 
              : (PHYSICS.REPULSION.function || -220);
        })
        .distanceMax(PHYSICS.MAX_REPULSION_DISTANCE || 1800)
      )
      .force("x", d3.forceX(0).strength(0.006))
      .force("y", d3.forceY(0).strength(0.006))
      .force("collide", d3.forceCollide()
        .radius(d => {
          const base = d.nodeType === 'folder' 
            ? (PHYSICS.COLLISION_RADIUS.folder || 45) 
            : d.nodeType === 'file' 
              ? (PHYSICS.COLLISION_RADIUS.file || 24) 
              : (PHYSICS.COLLISION_RADIUS.function || 14);
          return base + 8;
        })
        .iterations(3)
      )
      .alphaDecay(0.01)
      .velocityDecay(0.55); // High cosmic viscosity: Smooth continuous motion with 0 jitter

    // 🚀 THE 24/7 PERPETUAL SIMMER ENGINE
    // By locking alphaTarget to a resting positive value, D3 never shuts off.
    simulation.alphaTarget(RESTING_ALPHA_TARGET).restart();
    simulationRef.current = simulation;

    // 6. 🚀 STRICT HIERARCHICAL BFS QUEUE (Top-Down Sequence)
    const roots = rawNodes.filter(n => !parentMap.has(n.id) || n.tier === 0);
    const spawnQueue = [];
    const queuedSet = new Set();
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

    // Collect any orphan nodes to the end of the queue
    rawNodes.forEach(n => {
      if (!queuedSet.has(n.id)) {
        queuedSet.add(n.id);
        if (!n.isSpawned) spawnQueue.push(n);
      }
    });

    // 7. ⏱️ 5x SLOWER PROCEDURAL 1-BY-1 EMITTER
    const totalToSpawn = spawnQueue.length;

    // Calculate delay per single node (Adaptive: ~180ms for small/medium repos, ~30ms floor for 1000+ nodes)
    const delayPerNodeMs = Math.max(25, Math.min(200, Math.round(14000 / Math.max(1, totalToSpawn))));

    const emitNextNode = () => {
      if (document.hidden || centerView !== 'spatial') {
        spawnTimerRef.current = setTimeout(emitNextNode, 200);
        return;
      }

      if (spawnQueue.length === 0) {
        simDataRef.current.isSpawningComplete = true;
        spawnTimerRef.current = null;
        return;
      }

      // Pop STRICTLY 1 node at a time
      const node = spawnQueue.shift();
      const parentId = parentMap.get(node.id);
      const parentNode = parentId ? nodeLookup.get(parentId) : null;

      if (!parentNode || !parentNode.isSpawned) {
        // Root Sun Birth at origin
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        node.x = Math.cos(angle) * dist;
        node.y = Math.sin(angle) * dist;
        node.vx = Math.cos(angle) * 3;
        node.vy = Math.sin(angle) * 3;
      } else {
        // Child birth: Pops out directly from parent's live coordinates
        const angle = Math.random() * Math.PI * 2;
        const birthDist = 8;

        node.x = parentNode.x + Math.cos(angle) * birthDist;
        node.y = parentNode.y + Math.sin(angle) * birthDist;

        const speed = node.nodeType === 'file' ? 8 : 4.5;
        node.vx = (parentNode.vx || 0) * 0.2 + Math.cos(angle) * speed;
        node.vy = (parentNode.vy || 0) * 0.2 + Math.sin(angle) * speed;

        // Recoil on parent
        parentNode.vx = (parentNode.vx || 0) - Math.cos(angle) * 0.25;
        parentNode.vy = (parentNode.vy || 0) - Math.sin(angle) * 0.25;
      }

      node.isSpawned = true;
      node.spawnProgress = 0;

      activeNodesPool.push(node);
      activeNodeIds.add(node.id);

      // Re-sync active links
      const currentActiveEdges = allEdges.filter(
        e => activeNodeIds.has(e.source?.id || e.source) && activeNodeIds.has(e.target?.id || e.target)
      );

      simulation.nodes(activeNodesPool);
      linkForce.links(currentActiveEdges);

      // Inject brief energy burst for newly born node while maintaining 24/7 baseline
      simulation.alpha(Math.max(simulation.alpha(), 0.28)).restart();

      simDataRef.current.activeNodeCount = activeNodesPool.length;

      // Schedule next individual node birth
      spawnTimerRef.current = setTimeout(emitNextNode, delayPerNodeMs);
    };

    if (totalToSpawn > 0) {
      spawnTimerRef.current = setTimeout(emitNextNode, 100);
    } else {
      simDataRef.current.isSpawningComplete = true;
    }

    // 8. HIBERNATION
    if (document.hidden || centerView !== 'spatial') simulation.stop();

    const handleVisibilityChange = () => {
      if (document.hidden || centerView !== 'spatial') {
        simulation.stop();
      } else {
        simulation.alphaTarget(RESTING_ALPHA_TARGET).restart();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
      simulation.stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isGraphLoaded, edges.length, centerView]);

  // RAW DRAG HANDLERS
  const onDragStart = useCallback((nodeId, x, y) => {
    draggedNodeRef.current = nodeId;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { 
      simNode.fx = x; 
      simNode.fy = y; 
    }
    simulationRef.current?.alphaTarget(DRAGGING_ALPHA_TARGET).restart();
  }, []);

  const onDragMove = useCallback((nodeId, x, y) => {
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { 
      simNode.fx = x; 
      simNode.fy = y; 
    }
  }, []);

  const onDragEnd = useCallback((nodeId) => {
    draggedNodeRef.current = null;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) {
      simNode.fx = null;
      simNode.fy = null;
    }
    // Settle back to 24/7 perpetual living baseline (Never stops!)
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