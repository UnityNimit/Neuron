// src/hooks/usePhysicsEngine.js
import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3-force';
import { ENGINE_CONFIG } from '../config/engineConfig';

const { PHYSICS } = ENGINE_CONFIG;

export function usePhysicsEngine(nodes, edges, setNodes, wsRef, isGraphLoaded) {
  const simulationRef = useRef(null);
  const draggedNodeRef = useRef(null);

  useEffect(() => {
    if (!isGraphLoaded || nodes.length === 0) return;

    const simNodes = nodes.map(n => ({
      id: n.id,
      x: (typeof n.position?.x === 'number' && !isNaN(n.position?.x)) ? n.position.x : (Math.random() - 0.5) * 500, 
      y: (typeof n.position?.y === 'number' && !isNaN(n.position?.y)) ? n.position.y : (Math.random() - 0.5) * 500,
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
        .distanceMax(2000)
      )
      .force("x", d3.forceX(0).strength(PHYSICS.GRAVITY_PULL))
      .force("y", d3.forceY(0).strength(PHYSICS.GRAVITY_PULL))
      .force("collide", d3.forceCollide()
        .radius(d => d.nodeType === 'folder' ? PHYSICS.COLLISION_RADIUS.folder : d.nodeType === 'file' ? PHYSICS.COLLISION_RADIUS.file : PHYSICS.COLLISION_RADIUS.function)
        .iterations(3)
      )
      .alphaDecay(PHYSICS.ALPHA_DECAY) 
      .velocityDecay(PHYSICS.VELOCITY_DECAY) 
      .on("tick", () => {
        setNodes(nds => nds.map(n => {
          if (draggedNodeRef.current === n.id) return n;
          const simNode = simNodes.find(sn => sn.id === n.id);
          if (simNode) {
            if (isNaN(simNode.x) || isNaN(simNode.y)) return n;
            const curX = n.position?.x ?? 0;
            const curY = n.position?.y ?? 0;
            if (Math.abs(curX - simNode.x) > 0.5 || Math.abs(curY - simNode.y) > 0.5) {
                return { ...n, position: { x: simNode.x, y: simNode.y } };
            }
          }
          return n;
        }));
      });

    simulationRef.current = simulation;

    if (document.hidden) simulation.stop();

    const handleVisibilityChange = () => {
      if (document.hidden) simulation.stop();
      else simulation.alphaTarget(0.1).restart();
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      simulation.stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isGraphLoaded, edges.length]); 

  // ... (Drag functions remain exactly the same)
  const onNodeDragStart = useCallback((event, node) => {
    draggedNodeRef.current = node.id; 
    if (simulationRef.current) {
      const simNode = simulationRef.current.nodes().find(n => n.id === node.id);
      if (simNode) {
        simNode.fx = node.position?.x ?? 0;
        simNode.fy = node.position?.y ?? 0;
      }
      simulationRef.current.alphaTarget(0.3).restart(); 
    }
  }, []);

  const onNodeDrag = useCallback((event, node) => {
    if (simulationRef.current) {
      const simNode = simulationRef.current.nodes().find(n => n.id === node.id);
      if (simNode) {
        simNode.fx = node.position?.x ?? 0; 
        simNode.fy = node.position?.y ?? 0;
      }
    }
  }, []);

  const onNodeDragStop = useCallback((event, node) => {
    draggedNodeRef.current = null; 
    if (simulationRef.current) {
      const simNode = simulationRef.current.nodes().find(n => n.id === node.id);
      if (simNode) {
        simNode.fx = null; 
        simNode.fy = null;
      }
      simulationRef.current.alphaTarget(0); 
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'NODE_MOVE', node_id: node.id, position: node.position || { x: 0, y: 0 } }));
    }
  }, [wsRef]);

  return { onNodeDragStart, onNodeDrag, onNodeDragStop };
}