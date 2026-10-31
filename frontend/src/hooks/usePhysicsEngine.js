// frontend/src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

//  PERPETUAL COSMIC CONSTANTS
const RESTING_ALPHA_TARGET = 0.018;  // Keeps the universe floating continuously
const DRAGGING_ALPHA_TARGET = 0.25;  // High responsiveness during dragging
const MIN_ALPHA_THRESHOLD = 0.001;

// Coordinate Sanity Guard
const sanitizeCoordinate = (val, fallback = 0) => {
  return typeof val === 'number' && isFinite(val) && !isNaN(val) ? val : fallback;
};

export function usePhysicsEngine(nodes = [], edges = [], wsRef, isGraphLoaded, centerView, physicsEnabled = true, animationSpeed = 1.0, settings = {}) {
  const simulationRef = useRef(null);

  // Live Configurable Physics Parameters from Settings
  const gravityPull = Number(settings?.physicsGravity ?? PHYSICS.GRAVITY_PULL ?? 0.008);
  const repulseFolder = Number(settings?.physicsRepulsionFolder ?? PHYSICS.REPULSION?.folder ?? -1800);
  const repulseFile = Number(settings?.physicsRepulsionFile ?? PHYSICS.REPULSION?.file ?? -600);
  const repulseFunc = Number(settings?.physicsRepulsionFunction ?? PHYSICS.REPULSION?.function ?? -150);
  const maxRepulseDist = Number(settings?.physicsMaxRepulsionDistance ?? PHYSICS.MAX_REPULSION_DISTANCE ?? 2600);
  const springMoonDist = Number(settings?.physicsSpringMoonDistance ?? PHYSICS.SPRING_DISTANCE?.moonOrbit ?? 45);
  const springPlanetDist = Number(settings?.physicsSpringPlanetDistance ?? PHYSICS.SPRING_DISTANCE?.planetOrbit ?? 95);
  const springNeuralDist = Number(settings?.physicsSpringNeuralDistance ?? PHYSICS.SPRING_DISTANCE?.neuralCall ?? 180);
  const springBridgeDist = Number(settings?.physicsSpringBridgeDistance ?? (PHYSICS.SPRING_DISTANCE?.networkBridge || 216));
  const springHierarchyStrength = Number(settings?.physicsSpringHierarchyStrength ?? (PHYSICS.SPRING_STRENGTH?.hierarchy || 0.95));
  const springCallStrength = Number(settings?.physicsSpringCallStrength ?? (PHYSICS.SPRING_STRENGTH?.neural || 0.25));
  const springBridgeStrength = Number(settings?.physicsSpringBridgeStrength ?? (PHYSICS.SPRING_STRENGTH?.networkBridge || 0.35));
  const collideFolder = Number(settings?.physicsCollisionFolder ?? PHYSICS.COLLISION_RADIUS?.folder ?? 40);
  const collideFile = Number(settings?.physicsCollisionFile ?? PHYSICS.COLLISION_RADIUS?.file ?? 22);
  const collideFunc = Number(settings?.physicsCollisionFunction ?? PHYSICS.COLLISION_RADIUS?.function ?? 12);
  const collidePadding = Number(settings?.physicsCollisionPadding ?? PHYSICS.COLLISION_PADDING ?? 10);
  const collideIterations = Math.max(1, Math.round(Number(settings?.physicsCollisionIterations ?? PHYSICS.COLLISION_ITERATIONS ?? 2)));
  const alphaDecayVal = Number(settings?.physicsAlphaDecay ?? PHYSICS.ALPHA_DECAY ?? 0.012);
  const velocityDecayVal = Number(settings?.physicsVelocityDecay ?? PHYSICS.VELOCITY_DECAY ?? 0.54);
  const restingAlphaVal = Number(settings?.physicsRestingAlpha ?? PHYSICS.RESTING_ALPHA ?? 0.018);
  const draggingAlphaVal = Number(settings?.physicsDraggingAlpha ?? PHYSICS.DRAGGING_ALPHA ?? 0.25);
  const spawnFileSpeed = Number(settings?.physicsSpawnFileSpeed ?? (PHYSICS.SPAWN_SPEED?.file || 6.5));
  const spawnFuncSpeed = Number(settings?.physicsSpawnFuncSpeed ?? (PHYSICS.SPAWN_SPEED?.function || 3.5));

  const physicsSettingsRef = useRef({
    gravityPull,
    repulseFolder,
    repulseFile,
    repulseFunc,
    maxRepulseDist,
    springMoonDist,
    springPlanetDist,
    springNeuralDist,
    springBridgeDist,
    springHierarchyStrength,
    springCallStrength,
    springBridgeStrength,
    collideFolder,
    collideFile,
    collideFunc,
    collidePadding,
    collideIterations,
    alphaDecayVal,
    velocityDecayVal,
    restingAlphaVal,
    draggingAlphaVal,
    spawnFileSpeed,
    spawnFuncSpeed,
  });

  useEffect(() => {
    physicsSettingsRef.current = {
      gravityPull,
      repulseFolder,
      repulseFile,
      repulseFunc,
      maxRepulseDist,
      springMoonDist,
      springPlanetDist,
      springNeuralDist,
      springBridgeDist,
      springHierarchyStrength,
      springCallStrength,
      springBridgeStrength,
      collideFolder,
      collideFile,
      collideFunc,
      collidePadding,
      collideIterations,
      alphaDecayVal,
      velocityDecayVal,
      restingAlphaVal,
      draggingAlphaVal,
      spawnFileSpeed,
      spawnFuncSpeed,
    };
  }, [
    gravityPull,
    repulseFolder,
    repulseFile,
    repulseFunc,
    maxRepulseDist,
    springMoonDist,
    springPlanetDist,
    springNeuralDist,
    springBridgeDist,
    springHierarchyStrength,
    springCallStrength,
    springBridgeStrength,
    collideFolder,
    collideFile,
    collideFunc,
    collidePadding,
    collideIterations,
    alphaDecayVal,
    velocityDecayVal,
    restingAlphaVal,
    draggingAlphaVal,
    spawnFileSpeed,
    spawnFuncSpeed,
  ]);
  const draggedNodeRef = useRef(null);
  const spawnTimerRef = useRef(null);

  //  MASTER RAM CACHE (Direct Zero-Copy Access for WebGL Canvas)
  const simDataRef = useRef({
    nodes: [],
    edges: [],
    superNodes: [],
    activeNodeCount: 0,
    isSpawningComplete: false
  });

  // TOPOLOGY FINGERPRINTS: Fast 32-bit numeric hash avoids allocating thousands of strings/arrays every render
  const nodeTopologyKey = useMemo(() => {
    if (!nodes || nodes.length === 0) return 0;
    let hash = nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      const id = nodes[i]?.id || '';
      for (let j = 0; j < id.length; j++) {
        hash = ((hash << 5) - hash + id.charCodeAt(j)) | 0;
      }
    }
    return hash;
  }, [nodes]);

  const edgeTopologyKey = useMemo(() => {
    if (!edges || edges.length === 0) return 0;
    let hash = edges.length;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const s = typeof e.source === 'object' ? (e.source?.id || '') : (e.source || '');
      const t = typeof e.target === 'object' ? (e.target?.id || '') : (e.target || '');
      const id = e.id || '';
      const str = `${id}:${s}->${t}`;
      for (let j = 0; j < str.length; j++) {
        hash = ((hash << 5) - hash + str.charCodeAt(j)) | 0;
      }
    }
    return hash;
  }, [edges]);

  useEffect(() => {
    if (!isGraphLoaded) return;

    if (!nodes || nodes.length === 0) {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }
      simDataRef.current = {
        nodes: [],
        edges: [],
        superNodes: [],
        activeNodeCount: 0,
        isSpawningComplete: true
      };
      return;
    }

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
        const src = typeof link.source === 'object' ? link.source : null;
        const tgt = typeof link.target === 'object' ? link.target : null;
        const srcType = src?.nodeType || src?.data?.nodeType;
        const tgtType = tgt?.nodeType || tgt?.data?.nodeType;

        const srcBaseR = srcType === 'folder' ? 44 : srcType === 'file' ? 26 : 14;
        const tgtBaseR = tgtType === 'folder' ? 44 : tgtType === 'file' ? 26 : 14;
        const srcExtraR = Math.max(0, (src?.worldRadius || srcBaseR) - srcBaseR);
        const tgtExtraR = Math.max(0, (tgt?.worldRadius || tgtBaseR) - tgtBaseR);
        const repulse = src?.repulseStrength ?? 1.5;
        const extraSpacing = (srcExtraR + tgtExtraR) * 1.2 * repulse;

        const curConf = physicsSettingsRef.current;
        if (link.type === 'hierarchy') {
          const baseDist = tgtType === 'function' 
            ? (curConf.springMoonDist || 45)
            : (curConf.springPlanetDist || 95);
          return baseDist + extraSpacing;
        }
        if (link.type === 'network_bridge') {
          return (curConf.springBridgeDist || 216) + extraSpacing;
        }
        return (curConf.springNeuralDist || 180) + extraSpacing;
      })
      .strength(link => {
        const curConf = physicsSettingsRef.current;
        if (link.type === 'hierarchy') return (curConf.springHierarchyStrength ?? 0.95);
        if (link.type === 'network_bridge') return (curConf.springBridgeStrength ?? 0.35);
        return (curConf.springCallStrength ?? 0.25);
      });

    const chargeForce = d3.forceManyBody()
      .strength(d => {
        const m = d.mergeProgress || 0;
        if (m > 0.75) return 0;
        const curConf = physicsSettingsRef.current;
        const base = d.nodeType === 'folder' 
          ? (curConf.repulseFolder ?? -1800) 
          : d.nodeType === 'file' 
            ? (curConf.repulseFile ?? -600) 
            : (curConf.repulseFunc ?? -150);
        const mass = Math.max(0, d.absorbedMass || 0);
        const repulse = d.repulseStrength ?? 1.5;
        const mergedBoost = mass > 0.05 ? (1 + Math.min(4.0, Math.pow(mass, 0.52) * 0.45 * repulse)) : 1.0;
        return base * mergedBoost * (1 - m * 0.9);
      })
      .distanceMax(physicsSettingsRef.current.maxRepulseDist || 2600);

    const collideForce = d3.forceCollide()
      .radius(d => {
        const m = d.mergeProgress || 0;
        if (m > 0.65) return 0;
        const curConf = physicsSettingsRef.current;
        const base = d.nodeType === 'folder' 
          ? (curConf.collideFolder ?? 40) 
          : d.nodeType === 'file' 
            ? (curConf.collideFile ?? 22) 
            : (curConf.collideFunc ?? 12);
        const extraR = Math.max(0, (d.worldRadius || base) - base);
        const repulse = d.repulseStrength ?? 1.5;
        const padding = curConf.collidePadding ?? 10;
        return (base + padding + extraR * (1.15 * repulse)) * (1 - m * 0.85);
      })
      .iterations(physicsSettingsRef.current.collideIterations || 2);

    const safeAnimSpeed = Math.max(0.1, Number(animationSpeed || 1.0));
    const simulation = d3.forceSimulation(activeNodesPool)
      .force("link", linkForce)
      .force("charge", chargeForce)
      .force("x", d3.forceX(0).strength(physicsSettingsRef.current.gravityPull ?? 0.008))
      .force("y", d3.forceY(0).strength(physicsSettingsRef.current.gravityPull ?? 0.008))
      .force("collide", collideForce)
      .alphaDecay(physicsSettingsRef.current.alphaDecayVal ?? 0.012)
      .velocityDecay(Math.max(0.05, Math.min(0.99, (physicsSettingsRef.current.velocityDecayVal ?? 0.54) / Math.sqrt(safeAnimSpeed))));

    let tickCounter = 0;
    let lastMassSignature = 0;

    // Active Sanity Clamp & Smooth Merged-Size Physics Sync on D3 Simulation Tick
    simulation.on("tick", () => {
      tickCounter++;
      let currentMassSig = 0;

      activeNodesPool.forEach(node => {
        if (isNaN(node.x) || !isFinite(node.x)) node.x = (Math.random() - 0.5) * 50;
        if (isNaN(node.y) || !isFinite(node.y)) node.y = (Math.random() - 0.5) * 50;
        if (isNaN(node.vx) || !isFinite(node.vx)) node.vx = 0;
        if (isNaN(node.vy) || !isFinite(node.vy)) node.vy = 0;
        currentMassSig += (node.absorbedMass || 0) * 5 + (node.repulseStrength || 1.5) * 10;
      });

      if (tickCounter % 8 === 0 && Math.abs(currentMassSig - lastMassSignature) > 4.0) {
        lastMassSignature = currentMassSig;
        collideForce.initialize(activeNodesPool);
        chargeForce.initialize(activeNodesPool);
        if (simulation.alpha() < 0.045) {
          simulation.alpha(0.045);
        }
      }
    });

    simulation.alphaTarget(physicsSettingsRef.current.restingAlphaVal ?? 0.018).restart();
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
    const delayPerNodeMs = Math.max(8, Math.min(120, Math.round(8000 / (Math.max(1, totalToSpawn) * safeAnimSpeed))));

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

        const speed = node.nodeType === 'file' 
          ? (physicsSettingsRef.current?.spawnFileSpeed ?? 6.5) 
          : (physicsSettingsRef.current?.spawnFuncSpeed ?? 3.5);
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
        simulation.alphaTarget(physicsSettingsRef.current?.restingAlphaVal ?? 0.018).restart();
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
    const dragAlpha = physicsSettingsRef.current?.draggingAlphaVal ?? 0.25;
    simulationRef.current?.alphaTarget(dragAlpha).restart();
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
    const restAlpha = physicsSettingsRef.current?.restingAlphaVal ?? 0.018;
    simulationRef.current?.alphaTarget(restAlpha);

    if (wsRef.current?.readyState === WebSocket.OPEN && simNode) {
      wsRef.current.send(JSON.stringify({
        event: 'NODE_MOVE',
        node_id: nodeId,
        position: { x: simNode.x, y: simNode.y }
      }));
    }
  }, [wsRef]);

  // Dynamically pause/resume simulation when physicsEnabled changes
  useEffect(() => {
    if (!simulationRef.current) return;
    if (physicsEnabled === false) {
      simulationRef.current.stop();
    } else {
      simulationRef.current.alpha(0.25).restart();
    }
  }, [physicsEnabled]);

  // Dynamically update force parameters in real-time when physics settings change
  useEffect(() => {
    const simulation = simulationRef.current;
    if (!simulation) return;

    const forceX = simulation.force("x");
    if (forceX) forceX.strength(gravityPull);

    const forceY = simulation.force("y");
    if (forceY) forceY.strength(gravityPull);

    simulation.alphaDecay(alphaDecayVal);
    const speed = Math.max(0.1, Number(animationSpeed || 1.0));
    simulation.velocityDecay(Math.max(0.05, Math.min(0.99, velocityDecayVal / Math.sqrt(speed))));

    const linkForce = simulation.force("link");
    if (linkForce) {
      linkForce
        .distance(link => {
          const src = typeof link.source === 'object' ? link.source : null;
          const tgt = typeof link.target === 'object' ? link.target : null;
          const srcType = src?.nodeType || src?.data?.nodeType;
          const tgtType = tgt?.nodeType || tgt?.data?.nodeType;

          const srcBaseR = srcType === 'folder' ? 44 : srcType === 'file' ? 26 : 14;
          const tgtBaseR = tgtType === 'folder' ? 44 : tgtType === 'file' ? 26 : 14;
          const srcExtraR = Math.max(0, (src?.worldRadius || srcBaseR) - srcBaseR);
          const tgtExtraR = Math.max(0, (tgt?.worldRadius || tgtBaseR) - tgtBaseR);
          const repulse = src?.repulseStrength ?? 1.5;
          const extraSpacing = (srcExtraR + tgtExtraR) * 1.2 * repulse;

          if (link.type === 'hierarchy') {
            const baseDist = tgtType === 'function' ? springMoonDist : springPlanetDist;
            return baseDist + extraSpacing;
          }
          if (link.type === 'network_bridge') {
            return springBridgeDist + extraSpacing;
          }
          return springNeuralDist + extraSpacing;
        })
        .strength(link => {
          if (link.type === 'hierarchy') return springHierarchyStrength;
          if (link.type === 'network_bridge') return springBridgeStrength;
          return springCallStrength;
        });
    }

    const chargeForce = simulation.force("charge");
    if (chargeForce) {
      chargeForce
        .strength(d => {
          const m = d.mergeProgress || 0;
          if (m > 0.75) return 0;
          const base = d.nodeType === 'folder' 
            ? repulseFolder 
            : d.nodeType === 'file' 
              ? repulseFile 
              : repulseFunc;
          const mass = Math.max(0, d.absorbedMass || 0);
          const repulse = d.repulseStrength ?? 1.5;
          const mergedBoost = mass > 0.05 ? (1 + Math.min(4.0, Math.pow(mass, 0.52) * 0.45 * repulse)) : 1.0;
          return base * mergedBoost * (1 - m * 0.9);
        })
        .distanceMax(maxRepulseDist);
    }

    const collideForce = simulation.force("collide");
    if (collideForce) {
      collideForce
        .radius(d => {
          const m = d.mergeProgress || 0;
          if (m > 0.65) return 0;
          const base = d.nodeType === 'folder' 
            ? collideFolder 
            : d.nodeType === 'file' 
              ? collideFile 
              : collideFunc;
          const extraR = Math.max(0, (d.worldRadius || base) - base);
          const repulse = d.repulseStrength ?? 1.5;
          return (base + collidePadding + extraR * (1.15 * repulse)) * (1 - m * 0.85);
        })
        .iterations(collideIterations);
    }

    if (physicsEnabled !== false) {
      simulation.alpha(Math.max(simulation.alpha(), 0.18)).restart();
    }
  }, [
    gravityPull,
    repulseFolder,
    repulseFile,
    repulseFunc,
    maxRepulseDist,
    springMoonDist,
    springPlanetDist,
    springNeuralDist,
    springBridgeDist,
    springHierarchyStrength,
    springCallStrength,
    springBridgeStrength,
    collideFolder,
    collideFile,
    collideFunc,
    collidePadding,
    collideIterations,
    alphaDecayVal,
    velocityDecayVal,
    restingAlphaVal,
    draggingAlphaVal,
    animationSpeed,
    physicsEnabled
  ]);

  return { simDataRef, onDragStart, onDragMove, onDragEnd };
}