// frontend/src/hooks/useWorkspace.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';

// Dynamic WebSocket URL Resolver
const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8000/ws';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || '127.0.0.1';
  const port = window.location.port === '3000' || window.location.port === '5173' ? '8000' : (window.location.port || '8000');
  return `${protocol}//${host}:${port}/ws`;
};

// Coordinate Sanity Guard
const sanitizeCoordinate = (val, fallback) => {
  return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : fallback;
};

export function useWorkspace(session) {
  // --- CORE SYSTEM STATES ---
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [isFileSyncing, setIsFileSyncing] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsLatency, setWsLatency] = useState(0);
  
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [absTargetDir, setAbsTargetDir] = useState("");
  const [blastRadius, setBlastRadius] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  
  // --- HORIZON 3: AI AGENT SUPERVISOR BATCH STATE ---
  const [agentBatch, setAgentBatch] = useState(null);
  
  // --- ML & SOURCE CONTROL STATES ---
  const [gitStatuses, setGitStatuses] = useState({});
  
  // --- TERMINAL MULTI-SESSION STATES ---
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Neural Engine v2.4 initialized.", isError: false },
    { text: "Ready for spatial inspection & code execution.", isError: false }
  ]);
  const [terminalSessions, setTerminalSessions] = useState([
    { id: "term_1", name: "PowerShell 1", shellType: "powershell", cwd: "", isRunning: false, history: [] }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("output");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const wsRef = useRef(null);
  const currentFileRef = useRef(currentFile);
  const reconnectAttemptsRef = useRef(0);
  const pingTimestampRef = useRef(Date.now());
  
  useEffect(() => { 
    currentFileRef.current = currentFile; 
  }, [currentFile]);

  // Code Mutation Event Emitter
  const handleCodeEdit = useCallback((nodeId, newCode, filePath) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        event: 'CODE_EDIT', 
        filename: filePath || currentFileRef.current, 
        node_id: nodeId, 
        new_code: newCode 
      }));
    }
  }, []);

  // --- THE WEBSOCKET NEURAL ENGINE ---
  useEffect(() => {
    if (!session) return;
    let ws = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      try {
        const wsUrl = getWebSocketUrl();
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsWsConnected(true);
          reconnectAttemptsRef.current = 0;
          console.log("🟢 Connected to Python AI Backend:", wsUrl);

          // Heartbeat Ping loop
          heartbeatTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              pingTimestampRef.current = Date.now();
              ws.send(JSON.stringify({ event: 'PING' }));
            }
          }, 8000);
        };
        
        ws.onmessage = (event) => {
          if (isUnmounted) return;

          try {
            const data = JSON.parse(event.data);
            
            // 0. PONG Heartbeat Latency
            if (data.event === 'PONG') {
              setWsLatency(Math.max(1, Date.now() - pingTimestampRef.current));
            }

            // 1. FULL WORKSPACE INITIALIZATION / SYNC
            else if (data.event === 'INIT' || data.event === 'SYNC') {
              const payload = data.payload || {};
              setItems(payload.items || []);
              setFiles(payload.files || []);
              
              const newActive = payload.active_file || "";
              if (newActive) {
                setCurrentFile(newActive);
                setOpenFiles(prev => (prev.includes(newActive) ? prev : [...prev, newActive]));
              }

              setAbsTargetDir(payload.target_dir_abs || "");
              setGitStatuses(payload.git_statuses || {});

              if (payload.agent_batch) {
                setAgentBatch(payload.agent_batch);
                if (payload.agent_batch.blastRadiusNodeIds) {
                  setBlastRadius(payload.agent_batch.blastRadiusNodeIds);
                }
              }
              
              setTerminalSessions(prev => prev.map(s => ({
                ...s, 
                cwd: s.cwd || payload.target_dir_abs || "" 
              })));
              
              const rawNodes = payload.graph?.nodes || [];
              
              // 🛡️ THE ABSOLUTE ANTI-CRASH GUARANTEE 🛡️
              const sanitizedNodes = rawNodes.map((node, idx) => {
                const fallbackX = (Math.cos(idx) * (40 + idx * 6));
                const fallbackY = (Math.sin(idx) * (40 + idx * 6));

                const safeX = sanitizeCoordinate(node.position?.x, fallbackX);
                const safeY = sanitizeCoordinate(node.position?.y, fallbackY);
                
                return {
                  ...node,
                  id: String(node.id),
                  position: { x: safeX, y: safeY },
                  data: { 
                    ...node.data, 
                    onCodeEdit: handleCodeEdit 
                  }
                };
              });
              
              setNodes(sanitizedNodes);
              setEdges(payload.graph?.edges || []);
              
              setIsGraphLoaded(true); 
              setIsFileSyncing(false); 
            }

            // 2. 🚀 INCREMENTAL LIVE GRAPH HOT-PATCHING (Zero Canvas Reload)
            else if (data.event === 'GRAPH_DELTA') {
              const { 
                nodes_upsert = [], 
                nodes_remove = [], 
                edges_upsert = [], 
                edges_remove = [], 
                git_statuses, 
                agent_batch 
              } = data.payload || {};

              if (git_statuses) setGitStatuses(git_statuses);
              if (agent_batch) {
                setAgentBatch(agent_batch);
                if (agent_batch.blastRadiusNodeIds) {
                  setBlastRadius(agent_batch.blastRadiusNodeIds);
                }
              }

              // Hot-patch Nodes (Preserving existing particle coordinates & velocities)
              setNodes(prevNodes => {
                const nodeMap = new Map(prevNodes.map(n => [n.id, n]));

                // Remove deleted nodes
                nodes_remove.forEach(id => nodeMap.delete(id));

                // Upsert updated/added nodes
                nodes_upsert.forEach((newNode, idx) => {
                  const existing = nodeMap.get(newNode.id);
                  const fallbackX = (Math.cos(idx) * (40 + idx * 6));
                  const fallbackY = (Math.sin(idx) * (40 + idx * 6));

                  const posX = existing ? existing.position.x : sanitizeCoordinate(newNode.position?.x, fallbackX);
                  const posY = existing ? existing.position.y : sanitizeCoordinate(newNode.position?.y, fallbackY);

                  nodeMap.set(newNode.id, {
                    ...newNode,
                    id: String(newNode.id),
                    position: { x: posX, y: posY },
                    data: {
                      ...newNode.data,
                      onCodeEdit: handleCodeEdit
                    }
                  });
                });

                return Array.from(nodeMap.values());
              });

              // Hot-patch Edges
              setEdges(prevEdges => {
                const edgeMap = new Map(prevEdges.map(e => [e.id, e]));
                edges_remove.forEach(id => edgeMap.delete(id));
                edges_upsert.forEach(newEdge => {
                  edgeMap.set(newEdge.id, newEdge);
                });
                return Array.from(edgeMap.values());
              });

              setIsFileSyncing(false);
            }
            
            // 3. HORIZON 3: AI AGENT SUPERVISOR EVENTS
            else if (data.event === 'BLAST_RADIUS') {
              setBlastRadius(Array.isArray(data.payload) ? data.payload : null);
            }
            else if (data.event === 'AGENT_BATCH_DETAILS') {
              setAgentBatch(data.payload);
            }
            else if (data.event === 'AGENT_ROLLBACK_SUCCESS') {
              setAgentBatch(null);
              setBlastRadius(null);
            }
            else if (data.event === 'LLM_SUMMARY_READY') {
              setAiInsight({
                nodeId: data.node_id,
                summary: data.summary
              });
            }

            // 4. TERMINAL STREAMING ENGINE
            else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
              const lines = (data.payload || '').split('\n').filter(Boolean);
              const newLogs = lines.map(text => ({ text, isError: data.event === 'TERMINAL_ERROR' }));
              setTerminalLogs(prev => [...prev.slice(-400), ...newLogs]);
            } 
            else if (data.event === 'TERMINAL_STREAM_START') {
              setTerminalSessions(prev => prev.map(s => (
                s.id === data.session_id ? { 
                  ...s, 
                  isRunning: true, 
                  cwd: data.cwd, 
                  history: [...s.history.slice(-100), { command: data.command, stdout: "", stderr: "", cwd: data.cwd }] 
                } : s
              )));
            }
            else if (data.event === 'TERMINAL_CWD_UPDATE') {
              setTerminalSessions(prev => prev.map(s => (
                s.id === data.session_id ? { ...s, cwd: data.cwd } : s
              )));
            }
            else if (data.event === 'TERMINAL_STREAM') {
              setTerminalSessions(prev => prev.map(s => {
                if (s.id === data.session_id && s.history.length > 0) {
                  const lastIdx = s.history.length - 1;
                  const updatedHistory = [...s.history];
                  const key = data.is_error ? 'stderr' : 'stdout';
                  updatedHistory[lastIdx] = { 
                    ...updatedHistory[lastIdx], 
                    [key]: (updatedHistory[lastIdx][key] + data.text).slice(-10000) 
                  };
                  return { ...s, history: updatedHistory };
                }
                return s;
              }));
            }
            else if (data.event === 'TERMINAL_STREAM_END') {
              setTerminalSessions(prev => prev.map(s => (
                s.id === data.session_id ? { ...s, isRunning: false } : s
              )));
            }

          } catch (msgErr) { 
            console.error("[ERROR] Failed parsing WebSocket payload:", msgErr); 
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsWsConnected(false);
          clearInterval(heartbeatTimer);
          
          const delay = Math.min(10000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current++));
          reconnectTimer = setTimeout(connectWebSocket, delay);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };

      } catch (wsErr) {
        setIsWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [session, handleCodeEdit]);

  // Tab & File Management
  const closeFile = useCallback((filename) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f !== filename);
      if (currentFileRef.current === filename) {
        const fallback = next.length > 0 ? next[next.length - 1] : "";
        if (wsRef.current?.readyState === WebSocket.OPEN && fallback) {
          wsRef.current.send(JSON.stringify({ event: 'SWITCH_FILE', filename: fallback }));
        }
      }
      return next;
    });
  }, []);

  const refreshWorkspace = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsFileSyncing(true);
      wsRef.current.send(JSON.stringify({ 
        event: 'SWITCH_FILE', 
        filename: currentFileRef.current 
      }));
    }
  }, []);

  // 🚀 HORIZON 3: AI AGENT SUPERVISOR ACTIONS
  const rollbackAgentBatch = useCallback((batchId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && batchId) {
      wsRef.current.send(JSON.stringify({
        event: 'AGENT_ROLLBACK_BATCH',
        batch_id: batchId
      }));
    }
  }, []);

  const approveAgentBatch = useCallback((batchId) => {
    setAgentBatch(null);
    setBlastRadius(null);
  }, []);

  const dismissAgentBatch = useCallback(() => {
    setAgentBatch(null);
    setBlastRadius(null);
  }, []);

  // Multi-Session Terminal Actions
  const createTerminalSession = useCallback((shellType = 'powershell') => {
    const nextNum = terminalSessions.filter(s => s.shellType === shellType).length + 1;
    const nameMap = { powershell: 'PowerShell', cmd: 'CMD', bash: 'Bash', zsh: 'Zsh' };
    const newId = `term_${Date.now()}`;
    
    setTerminalSessions(prev => [
      ...prev, 
      { 
        id: newId, 
        name: `${nameMap[shellType] || 'Terminal'} ${nextNum}`, 
        shellType, 
        cwd: absTargetDir, 
        isRunning: false, 
        history: [] 
      }
    ]);
    setActiveSessionId(newId);
  }, [terminalSessions, absTargetDir]);

  const closeTerminalSession = useCallback((sessionId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'KILL_TERMINAL_PROCESS', session_id: sessionId }));
    }
    setTerminalSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) setActiveSessionId('output');
  }, [activeSessionId]);

  const sendTerminalCommand = useCallback((sessionId, command) => {
    const targetSession = terminalSessions.find(s => s.id === sessionId);
    if (wsRef.current?.readyState === WebSocket.OPEN && targetSession) {
      wsRef.current.send(JSON.stringify({ 
        event: 'RUN_TERMINAL_COMMAND', 
        session_id: sessionId, 
        shell_type: targetSession.shellType || 'powershell', 
        command: command, 
        cwd: targetSession.cwd || absTargetDir 
      }));
    }
  }, [terminalSessions, absTargetDir]);

  const sendTerminalStdin = useCallback((sessionId, text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        event: 'TERMINAL_STDIN', 
        session_id: sessionId, 
        input: text 
      }));
    }
  }, []);

  const killTerminalProcess = useCallback((sessionId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        event: 'KILL_TERMINAL_PROCESS', 
        session_id: sessionId 
      }));
    }
  }, []);

  return {
    isGraphLoaded, setIsGraphLoaded, 
    isFileSyncing, setIsFileSyncing,
    isWsConnected, wsLatency,
    items, files, currentFile, setCurrentFile, absTargetDir,
    openFiles, setOpenFiles, closeFile,
    gitStatuses, 
    nodes, setNodes, onNodesChange, 
    edges, setEdges, onEdgesChange,
    blastRadius, setBlastRadius, 
    aiInsight, setAiInsight, 
    agentBatch, rollbackAgentBatch, approveAgentBatch, dismissAgentBatch,
    terminalLogs, setTerminalLogs,
    terminalSessions, activeSessionId, setActiveSessionId,
    createTerminalSession, closeTerminalSession, 
    sendTerminalCommand, sendTerminalStdin, killTerminalProcess,
    refreshWorkspace, wsRef
  };
}