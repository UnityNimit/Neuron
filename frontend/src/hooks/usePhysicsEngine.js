// src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

export function usePhysicsEngine(nodes, edges, wsRef, isGraphLoaded, centerView) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);
  
  // 🚀 THE MASTER RAM CACHE (WebGPU reads directly from this)
  const simDataRef = useRef({ nodes: [], edges: [] });

  useEffect(() => {
    if (!isGraphLoaded || nodes.length === 0) return;

    // Preserve existing coordinates to avoid resetting the galaxy
    const existingNodes = new Map(simDataRef.current.nodes.map(n => [n.id, n]));

    const simNodes = nodes.map(n => {
      const existing = existingNodes.get(n.id);
      return {
        ...n,
        // WIRED: Dynamic Spawn Scatter
        x: existing?.x ?? n.position?.x ?? (Math.random() - 0.5) * PHYSICS.SPAWN_SCATTER,
        y: existing?.y ?? n.position?.y ?? (Math.random() - 0.5) * PHYSICS.SPAWN_SCATTER,
        fx: existing?.fx ?? null, 
        fy: existing?.fy ?? null
      };
    });

    const simEdges = edges.map(e => ({ ...e, source: e.source, target: e.target }));

    simDataRef.current = { nodes: simNodes, edges: simEdges };

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simEdges).id(d => d.id)
        .distance(link => link.type === 'hierarchy' ? (link.target.data?.nodeType === 'function' ? PHYSICS.SPRING_DISTANCE.moonOrbit : PHYSICS.SPRING_DISTANCE.planetOrbit) : PHYSICS.SPRING_DISTANCE.neuralCall)
        .strength(link => link.type === 'hierarchy' ? PHYSICS.SPRING_STRENGTH.structural : PHYSICS.SPRING_STRENGTH.neural)
      )
      .force("charge", d3.forceManyBody()
        .strength(d => d.data?.nodeType === 'folder' ? PHYSICS.REPULSION.folder : d.data?.nodeType === 'file' ? PHYSICS.REPULSION.file : PHYSICS.REPULSION.function)
        // WIRED: CPU Cutoff distance
        .distanceMax(PHYSICS.MAX_REPULSION_DISTANCE)
      )
      .force("x", d3.forceX(0).strength(PHYSICS.GRAVITY_PULL))
      .force("y", d3.forceY(0).strength(PHYSICS.GRAVITY_PULL))
      .force("collide", d3.forceCollide()
        .radius(d => d.data?.nodeType === 'folder' ? PHYSICS.COLLISION_RADIUS.folder : d.data?.nodeType === 'file' ? PHYSICS.COLLISION_RADIUS.file : PHYSICS.COLLISION_RADIUS.function)
      )
      .alphaDecay(PHYSICS.ALPHA_DECAY)
      .velocityDecay(PHYSICS.VELOCITY_DECAY);

    simulationRef.current = simulation;

    if (document.hidden || centerView !== 'spatial') simulation.stop();

    const handleVisibilityChange = () => {
      if (document.hidden || centerView !== 'spatial') {
        simulation.stop();
      } else {
        // WIRED: Tab-Wakeup Heat (Solves the swirling galaxy glitch!)
        if (PHYSICS.TAB_WAKEUP_HEAT > 0) {
          simulation.alphaTarget(PHYSICS.TAB_WAKEUP_HEAT).restart();
        } else if (simulation.alpha() >= simulation.alphaMin()) {
          simulation.restart(); // Cold start, purely resumes existing velocity
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      simulation.stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isGraphLoaded, edges.length, centerView]);

  const onDragStart = useCallback((nodeId, x, y) => {
    draggedNodeRef.current = nodeId;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { simNode.fx = x; simNode.fy = y; }
    // WIRED: Dynamic Drag Heat (Cold drag vs Jelly wobble)
    simulationRef.current?.alphaTarget(PHYSICS.DRAG_KINETIC_HEAT).restart();
  }, []);

  const onDragMove = useCallback((nodeId, x, y) => {
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { simNode.fx = x; simNode.fy = y; }
    // WIRED: Dynamic Drag Heat
    simulationRef.current?.alphaTarget(PHYSICS.DRAG_KINETIC_HEAT).restart();
  }, []);

  const onDragEnd = useCallback((nodeId) => {
    draggedNodeRef.current = null;
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { simNode.fx = null; simNode.fy = null; }
    simulationRef.current?.alphaTarget(0);

    if (wsRef.current?.readyState === WebSocket.OPEN && simNode) {
      wsRef.current.send(JSON.stringify({ 
        event: 'NODE_MOVE', node_id: nodeId, position: { x: simNode.x, y: simNode.y } 
      }));
    }
  }, [wsRef]);

  return { simDataRef, onDragStart, onDragMove, onDragEnd };
}