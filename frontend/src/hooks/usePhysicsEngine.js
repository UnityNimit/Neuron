// src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

export function usePhysicsEngine(nodes, edges, setNodes, wsRef, isGraphLoaded, centerView) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);
  const frameCounter = useRef(0); // For Frame-Skipping

  useEffect(() => {
    if (!isGraphLoaded || nodes.length === 0) return;

    const simNodes = nodes.map(n => ({
      id: n.id,
      x: n.position?.x ?? 0,
      y: n.position?.y ?? 0,
      nodeType: n.data?.nodeType || 'function'
    }));

    const simEdges = edges.map(e => ({ source: e.source, target: e.target, type: e.type }));

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simEdges).id(d => d.id)
        .distance(link => link.type === 'hierarchy' 
          ? (link.target.nodeType === 'function' ? PHYSICS.SPRING_DISTANCE.moonOrbit : PHYSICS.SPRING_DISTANCE.planetOrbit) 
          : PHYSICS.SPRING_DISTANCE.neuralCall)
        .strength(link => link.type === 'hierarchy' ? PHYSICS.SPRING_STRENGTH.structural : PHYSICS.SPRING_STRENGTH.neural) 
      )
      .force("charge", d3.forceManyBody()
        .strength(d => d.nodeType === 'folder' ? PHYSICS.REPULSION.folder : d.nodeType === 'file' ? PHYSICS.REPULSION.file : PHYSICS.REPULSION.function)
        .distanceMax(1500)
      )
      .force("x", d3.forceX(0).strength(PHYSICS.GRAVITY_PULL))
      .force("y", d3.forceY(0).strength(PHYSICS.GRAVITY_PULL))
      .force("collide", d3.forceCollide()
        .radius(d => d.nodeType === 'folder' ? PHYSICS.COLLISION_RADIUS.folder : d.nodeType === 'file' ? PHYSICS.COLLISION_RADIUS.file : PHYSICS.COLLISION_RADIUS.function)
      )
      .alphaDecay(PHYSICS.ALPHA_DECAY) 
      .velocityDecay(PHYSICS.VELOCITY_DECAY) 
      .on("tick", () => {
        frameCounter.current++;
        
        // --- FRAME SKIPPING: Only sync to React every 4th frame ---
        if (frameCounter.current % 4 !== 0) return;

        // --- HIBERNATION: Don't update state if we are in Editor mode ---
        if (centerView !== 'spatial') return;

        setNodes(nds => nds.map(n => {
          if (draggedNodeRef.current === n.id) return n;
          const simNode = simNodes.find(sn => sn.id === n.id);
          if (simNode && !isNaN(simNode.x)) {
            const curX = n.position?.x ?? 0;
            const curY = n.position?.y ?? 0;
            // Only update state if movement is significant (prevents micro-jitter)
            if (Math.abs(curX - simNode.x) > 1 || Math.abs(curY - simNode.y) > 1) {
                return { ...n, position: { x: simNode.x, y: simNode.y } };
            }
          }
          return n;
        }));
      });

    simulationRef.current = simulation;

    // Hibernate if tab is hidden OR user is coding
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
  }, [isGraphLoaded, edges.length, centerView]); // Re-run when view changes

  // Drag handlers (Optimized to restart simulation only when needed)
  const onNodeDragStart = useCallback((event, node) => {
    draggedNodeRef.current = node.id; 
    simulationRef.current?.alphaTarget(0.3).restart(); 
  }, []);

  const onNodeDrag = useCallback((event, node) => {
    const simNode = simulationRef.current?.nodes().find(n => n.id === node.id);
    if (simNode) { simNode.fx = node.position.x; simNode.fy = node.position.y; }
  }, []);

  const onNodeDragStop = useCallback((event, node) => {
    draggedNodeRef.current = null; 
    const simNode = simulationRef.current?.nodes().find(n => n.id === node.id);
    if (simNode) { simNode.fx = null; simNode.fy = null; }
    simulationRef.current?.alphaTarget(0); 
    wsRef.current?.send(JSON.stringify({ event: 'NODE_MOVE', node_id: node.id, position: node.position }));
  }, [wsRef]);

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
}