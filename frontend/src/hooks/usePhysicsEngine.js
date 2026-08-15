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

    const simNodes = nodes.map(n => ({
      ...n,
      x: n.position?.x ?? (Math.random() - 0.5) * 500,
      y: n.position?.y ?? (Math.random() - 0.5) * 500,
      fx: null, fy: null
    }));

    const simEdges = edges.map(e => ({ ...e, source: e.source, target: e.target }));

    simDataRef.current = { nodes: simNodes, edges: simEdges };

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simEdges).id(d => d.id)
        .distance(link => link.type === 'hierarchy' ? (link.target.data?.nodeType === 'function' ? PHYSICS.SPRING_DISTANCE.moonOrbit : PHYSICS.SPRING_DISTANCE.planetOrbit) : PHYSICS.SPRING_DISTANCE.neuralCall)
        .strength(link => link.type === 'hierarchy' ? PHYSICS.SPRING_STRENGTH.structural : PHYSICS.SPRING_STRENGTH.neural)
      )
      .force("charge", d3.forceManyBody()
        .strength(d => d.data?.nodeType === 'folder' ? PHYSICS.REPULSION.folder : d.data?.nodeType === 'file' ? PHYSICS.REPULSION.file : PHYSICS.REPULSION.function)
        .distanceMax(1500)
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
      if (document.hidden || centerView !== 'spatial') simulation.stop();
      else simulation.alphaTarget(0.1).restart();
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
    simulationRef.current?.alphaTarget(0.3).restart();
  }, []);

  const onDragMove = useCallback((nodeId, x, y) => {
    const simNode = simDataRef.current.nodes.find(n => n.id === nodeId);
    if (simNode) { simNode.fx = x; simNode.fy = y; }
    simulationRef.current?.alphaTarget(0.3).restart();
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

  // FIX: Export simDataRef so WebGPU can actually read it!
  return { simDataRef, onDragStart, onDragMove, onDragEnd };
}