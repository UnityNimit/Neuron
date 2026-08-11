// src/hooks/useWorkspace.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';

export function useWorkspace() {
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  const [blastRadius, setBlastRadius] = useState(null);
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Terminal v1.0.0", isError: false },
    { text: "Waiting for execution...", isError: false }
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const wsRef = useRef(null);

  const handleCodeEdit = useCallback((nodeId, newCode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'CODE_EDIT', node_id: nodeId, new_code: newCode }));
    }
  }, []);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    
    const connectWebSocket = () => {
      try {
        // Uses 127.0.0.1 to avoid Windows IPv6 resolution bugs
        ws = new WebSocket('ws://127.0.0.1:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => console.log("🟢 Connected to Python AI Engine");
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'INIT' || data.event === 'SYNC') {
              setFiles(data.payload.files || []);
              setCurrentFile(data.payload.active_file || "");
              
              const rawNodes = data.payload.graph?.nodes || [];
              const nodesWithCallbacks = rawNodes.map(node => ({
                ...node, data: { ...node.data, onCodeEdit: handleCodeEdit }
              }));
              
              setNodes(nodesWithCallbacks);
              setEdges(data.payload.graph?.edges || []);
              setIsGraphLoaded(true); // <--- Unlocks the loading screen!
            } else if (data.event === 'BLAST_RADIUS') {
              setBlastRadius(data.payload);
            } else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
              const newLogs = (data.payload || '').split('\n').filter(line => line !== '').map(log => ({ text: log, isError: data.event === 'TERMINAL_ERROR' }));
              setTerminalLogs(prev => [...prev, ...newLogs]);
            }
          } catch (msgErr) {
            console.error("Error processing WebSocket message:", msgErr);
          }
        };

        ws.onclose = () => {
          console.log("🔴 Backend disconnected. Reconnecting in 2s...");
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (err) => {
          console.error("🔴 WebSocket error:", err);
        };
      } catch (wsErr) {
        console.error("Failed to create WebSocket:", wsErr);
      }
    };

    connectWebSocket();
    return () => { clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.close(); } };
  }, [setNodes, setEdges, handleCodeEdit]);

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