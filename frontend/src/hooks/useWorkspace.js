// src/hooks/useWorkspace.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';

export function useWorkspace(session) {
  // --- CORE SYSTEM STATES ---
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [isFileSyncing, setIsFileSyncing] = useState(false); 
  
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  const [absTargetDir, setAbsTargetDir] = useState("");
  const [blastRadius, setBlastRadius] = useState(null);
  
  // NEW: GIT STATE
  const [gitStatuses, setGitStatuses] = useState({});
  
  // --- TERMINAL MULTI-SESSION STATES ---
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Output Log v1.0.0", isError: false },
    { text: "Waiting for execution...", isError: false }
  ]);
  const [terminalSessions, setTerminalSessions] = useState([
    { id: "term_1", name: "PowerShell 1", shellType: "powershell", cwd: "", isRunning: false, history: [] }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("output");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const wsRef = useRef(null);
  const currentFileRef = useRef(currentFile);
  
  useEffect(() => { currentFileRef.current = currentFile; }, [currentFile]);

  const handleCodeEdit = useCallback((nodeId, newCode, filePath) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        event: 'CODE_EDIT', filename: filePath || currentFileRef.current, node_id: nodeId, new_code: newCode 
      }));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let ws, reconnectTimer;
    
    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://127.0.0.1:8000/ws');
        wsRef.current = ws;

        ws.onopen = () => console.log("🟢 Connected to Python AI Engine");
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.event === 'INIT' || data.event === 'SYNC') {
              setItems(data.payload.items || []);
              setFiles(data.payload.files || []);
              setCurrentFile(data.payload.active_file || "");
              setAbsTargetDir(data.payload.target_dir_abs || "");
              
              // NEW: Save Git statuses!
              setGitStatuses(data.payload.git_statuses || {});
              
              setTerminalSessions(prev => prev.map(s => ({ ...s, cwd: s.cwd || data.payload.target_dir_abs || "" })));
              const rawNodes = data.payload.graph?.nodes || [];
              const nodesWithCallbacks = rawNodes.map(node => ({ ...node, data: { ...node.data, onCodeEdit: handleCodeEdit } }));
              setNodes(nodesWithCallbacks);
              setEdges(data.payload.graph?.edges || []);
              setIsGraphLoaded(true); setIsFileSyncing(false); 
            } 
            else if (data.event === 'BLAST_RADIUS') setBlastRadius(data.payload);
            else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
              const newLogs = (data.payload || '').split('\n').filter(line => line !== '').map(log => ({ text: log, isError: data.event === 'TERMINAL_ERROR' }));
              setTerminalLogs(prev => [...prev, ...newLogs]);
            } 
            else if (data.event === 'TERMINAL_STREAM_START') {
              setTerminalSessions(prev => prev.map(s => s.id === data.session_id ? { ...s, isRunning: true, cwd: data.cwd, history: [...s.history, { command: data.command, stdout: "", stderr: "", cwd: data.cwd }] } : s));
            }
            else if (data.event === 'TERMINAL_CWD_UPDATE') {
              setTerminalSessions(prev => prev.map(s => s.id === data.session_id ? { ...s, cwd: data.cwd } : s));
            }
            else if (data.event === 'TERMINAL_STREAM') {
              setTerminalSessions(prev => prev.map(s => {
                if (s.id === data.session_id && s.history.length > 0) {
                  const lastIdx = s.history.length - 1;
                  const updatedHistory = [...s.history];
                  const key = data.is_error ? 'stderr' : 'stdout';
                  updatedHistory[lastIdx] = { ...updatedHistory[lastIdx], [key]: updatedHistory[lastIdx][key] + data.text };
                  return { ...s, history: updatedHistory };
                }
                return s;
              }));
            }
            else if (data.event === 'TERMINAL_STREAM_END') {
              setTerminalSessions(prev => prev.map(s => s.id === data.session_id ? { ...s, isRunning: false } : s));
            }
            else if (data.event === 'TERMINAL_RESPONSE') {
              setTerminalSessions(prev => prev.map(s => {
                if (s.id === data.session_id) return { ...s, cwd: data.new_cwd || s.cwd, history: [...s.history, { command: data.command, stdout: data.stdout, stderr: data.stderr, cwd: s.cwd }] };
                return s;
              }));
            }
          } catch (msgErr) { console.error("Error processing message:", msgErr); }
        };

        ws.onclose = () => { reconnectTimer = setTimeout(connectWebSocket, 2000); };
      } catch (wsErr) { }
    };

    connectWebSocket();
    return () => { clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.close(); } };
  }, [session, setNodes, setEdges, handleCodeEdit]);

  const refreshWorkspace = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) { setIsFileSyncing(true); wsRef.current.send(JSON.stringify({ event: 'SWITCH_FILE', filename: currentFileRef.current })); }
  }, []);

  const createTerminalSession = (shellType = 'powershell') => {
    const nextNum = terminalSessions.filter(s => s.shellType === shellType).length + 1;
    const nameMap = { powershell: 'PowerShell', cmd: 'CMD', bash: 'Bash' };
    const newId = `term_${Date.now()}`;
    setTerminalSessions(prev => [...prev, { id: newId, name: `${nameMap[shellType] || 'Terminal'} ${nextNum}`, shellType, cwd: absTargetDir, isRunning: false, history: [] }]);
    setActiveSessionId(newId);
  };

  const closeTerminalSession = (sessionId) => {
    killTerminalProcess(sessionId);
    setTerminalSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) setActiveSessionId('output');
  };

  const sendTerminalCommand = (sessionId, command) => {
    const targetSession = terminalSessions.find(s => s.id === sessionId);
    if (wsRef.current?.readyState === WebSocket.OPEN && targetSession) {
      wsRef.current.send(JSON.stringify({ event: 'RUN_TERMINAL_COMMAND', session_id: sessionId, shell_type: targetSession.shellType || 'powershell', command: command, cwd: targetSession.cwd }));
    }
  };

  const killTerminalProcess = (sessionId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ event: 'KILL_TERMINAL_PROCESS', session_id: sessionId })); }
  };

  return {
    isGraphLoaded, setIsGraphLoaded, isFileSyncing, setIsFileSyncing,
    items, files, currentFile, setCurrentFile, absTargetDir,
    gitStatuses, // EXPORTED TO APP
    nodes, setNodes, onNodesChange, edges, setEdges, onEdgesChange,
    blastRadius, setBlastRadius, terminalLogs, setTerminalLogs,
    terminalSessions, activeSessionId, setActiveSessionId,
    createTerminalSession, closeTerminalSession, sendTerminalCommand, killTerminalProcess,
    refreshWorkspace, wsRef
  };
}