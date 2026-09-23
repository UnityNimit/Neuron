import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from './engineConfig';

const { PHYSICS } = ENGINE_CONFIG;
const RESTING_ALPHA_TARGET = 0.018;
const DRAGGING_ALPHA_TARGET = 0.25;

const sanitizeCoord = (val, fallback = 0) =>
  typeof val === 'number' && isFinite(val) && !isNaN(val) ? val : fallback;

export function usePhysicsEngine(nodes = [], edges = [], isGraphLoaded = true) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);
  const simDataRef = useRef({
    nodes: [],
    edges: [],
    superNodes: [],
    isSpawningComplete: true
  });

  useEffect(() => {
    if (!isGraphLoaded || !nodes.length) return;

    // 1. Prepare Nodes with Sanity Guards
    const existingMap = new Map(simDataRef.current.nodes.map(n => [n.id, n]));
    const rawNodes = nodes.map((n, idx) => {
      const existing = existingMap.get(n.id);
      const nodeType = n.data?.nodeType || 'function';
      const fallbackX = Math.cos(idx) * (40 + idx * 10);
      const fallbackY = Math.sin(idx) * (40 + idx * 10);
      return {
        ...n,
        id: String(n.id),
        nodeType,
        x: sanitizeCoord(existing?.x ?? n.position?.x, fallbackX),
        y: sanitizeCoord(existing?.y ?? n.position?.y, fallbackY),
        vx: sanitizeCoord(existing?.vx, 0),
        vy: sanitizeCoord(existing?.vy, 0),
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
        spawnProgress: 1,
        isSpawned: true
      };
    });

    // 2. Prepare Edges
    const validNodeIds = new Set(rawNodes.map(n => n.id));
    const allEdges = edges
      .filter(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return s && t && s !== t && validNodeIds.has(s) && validNodeIds.has(t);
      })
      .map(e => ({
        id: e.id || `edge-${e.source}-${e.target}`,
        source: typeof e.source === 'object' ? e.source.id : e.source,
        target: typeof e.target === 'object' ? e.target.id : e.target,
        type: e.type || 'hierarchy'
      }));

    simDataRef.current = {
      nodes: rawNodes,
      edges: allEdges,
      superNodes: [],
      isSpawningComplete: true
    };

    // 3. Configure D3 Forces
    const linkForce = d3.forceLink(allEdges)
      .id(d => d.id)
      .distance(link => {
        if (link.type === 'hierarchy') {
          return link.target?.nodeType === 'function'
            ? PHYSICS.SPRING_DISTANCE.moonOrbit
            : PHYSICS.SPRING_DISTANCE.planetOrbit;
        }
        return PHYSICS.SPRING_DISTANCE.neuralCall;
      })
      .strength(link => (link.type === 'hierarchy' ? 0.95 : 0.25));

    const simulation = d3.forceSimulation(rawNodes)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody().strength(d => {
        return d.nodeType === 'folder'
          ? PHYSICS.REPULSION.folder
          : d.nodeType === 'file'
            ? PHYSICS.REPULSION.file
            : PHYSICS.REPULSION.function;
      }))
      .force("x", d3.forceX(0).strength(PHYSICS.GRAVITY_PULL))
      .force("y", d3.forceY(0).strength(PHYSICS.GRAVITY_PULL))
      .force("collide", d3.forceCollide().radius(d => {
        const base = d.nodeType === 'folder'
          ? PHYSICS.COLLISION_RADIUS.folder
          : d.nodeType === 'file'
            ? PHYSICS.COLLISION_RADIUS.file
            : PHYSICS.COLLISION_RADIUS.function;
        return base + 8;
      }))
      .alphaDecay(PHYSICS.ALPHA_DECAY)
      .velocityDecay(PHYSICS.VELOCITY_DECAY);

    simulation.on("tick", () => {
      rawNodes.forEach(node => {
        if (isNaN(node.x) || !isFinite(node.x)) node.x = (Math.random() - 0.5) * 50;
        if (isNaN(node.y) || !isFinite(node.y)) node.y = (Math.random() - 0.5) * 50;
      });
    });

    simulation.alphaTarget(RESTING_ALPHA_TARGET).restart();
    simulationRef.current = simulation;

    return () => simulation.stop();
  }, [nodes, edges, isGraphLoaded]);

  // Drag interaction handlers
  const onDragStart = useCallback((nodeId, x, y) => {
    draggedNodeRef.current = nodeId;
    const node = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (node) { node.fx = sanitizeCoord(x); node.fy = sanitizeCoord(y); }
    simulationRef.current?.alphaTarget(DRAGGING_ALPHA_TARGET).restart();
  }, []);

  const onDragMove = useCallback((nodeId, x, y) => {
    const node = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (node) { node.fx = sanitizeCoord(x); node.fy = sanitizeCoord(y); }
  }, []);

  const onDragEnd = useCallback((nodeId) => {
    draggedNodeRef.current = null;
    const node = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (node) { node.fx = null; node.fy = null; }
    simulationRef.current?.alphaTarget(RESTING_ALPHA_TARGET);
  }, []);

  return { simDataRef, onDragStart, onDragMove, onDragEnd };
}
