// src/hooks/useWorkspace.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';

export function useWorkspace() {
  // State Models
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  const [blastRadius, setBlastRadius] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Terminal v1.0.0", isError: false },
    { text: "Waiting for execution...", isError: false }
  ]);

  // Graph Models
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const wsRef = useRef(null);

  // Controller Actions
  const handleCodeEdit = useCallback((nodeId, newCode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'CODE_EDIT', node_id: nodeId, new_code: newCode }));
    }
  }, []);

  // WebSocket Connection Service Initialization
  useEffect(() => {
    let ws;
    let reconnectTimer;
    
    const connectWebSocket = () => {
      ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => console.log("🟢 Connected to Python AI Engine");
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'INIT' || data.event === 'SYNC') {
          setFiles(data.payload.files);
          setCurrentFile(data.payload.active_file || "");
          
          const nodesWithCallbacks = data.payload.graph.nodes.map(node => ({
            ...node, data: { ...node.data, onCodeEdit: handleCodeEdit }
          }));
          
          setNodes(nodesWithCallbacks);
          setEdges(data.payload.graph.edges);
          setIsGraphLoaded(true);
        } else if (data.event === 'BLAST_RADIUS') {
          setBlastRadius(data.payload);
        } else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
          const newLogs = data.payload.split('\n').filter(line => line !== '').map(log => ({ text: log, isError: data.event === 'TERMINAL_ERROR' }));
          setTerminalLogs(prev => [...prev, ...newLogs]);
        }
      };

      ws.onclose = () => {
        console.log("🔴 Backend disconnected. Reconnecting...");
        reconnectTimer = setTimeout(connectWebSocket, 2000);
      };
    };

    connectWebSocket();
    return () => { clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.close(); } };
  }, [setNodes, setEdges, handleCodeEdit]);

  // Expose state and functions to the View
  return {
    isGraphLoaded, setIsGraphLoaded,
    files, currentFile, setCurrentFile,
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    blastRadius, setBlastRadius,
    terminalLogs, setTerminalLogs,
    wsRef
  };
}