// frontend/src/hooks/useWorkspace.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';

// Dynamic WebSocket URL Resolver
const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8000/ws';

  // 1. Explicit environment variable override
  if (import.meta?.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 2. Tauri Desktop App: ALWAYS connect directly to local loopback IPv4
  const isTauri = Boolean(
    window.__TAURI_INTERNALS__ || 
    window.__TAURI__ || 
    window.location.hostname === 'tauri.localhost' || 
    window.location.protocol === 'tauri:'
  );

  if (isTauri) {
    return 'ws://127.0.0.1:8000/ws';
  }

  // 3. Local Web Dev Mode (localhost:5173 or 127.0.0.1)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://127.0.0.1:8000/ws';
  }

  // 4. Remote Web Production
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || '127.0.0.1';
  return `${protocol}//${host}:8000/ws`;
};

// Coordinate Sanity Guard
const sanitizeCoordinate = (val, fallback) => {
  return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : fallback;
};

// Check if Blast Protection is enabled in local settings
const isBlastProtectionLocallyEnabled = () => {
  try {
    const saved = localStorage.getItem('neuron-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.blastProtection !== undefined) return Boolean(parsed.blastProtection);
    }
    return localStorage.getItem('neuron-blast-protection') === 'true';
  } catch {
    return false;
  }
};

export function useWorkspace(session) {
  // --- CORE SYSTEM STATES ---
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const folderLoadingStartTimeRef = useRef(0);
  const [isFileSyncing, setIsFileSyncing] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [wsLatency, setWsLatency] = useState(0);
  
  const [items, setItems] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  const [openFiles, setOpenFiles] = useState([]);

  // Ref mirrors for 0ms synchronous access and callback safety
  const currentFileRef = useRef(currentFile);
  useEffect(() => {
    currentFileRef.current = currentFile;
  }, [currentFile]);

  const openFilesRef = useRef(openFiles);
  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);
  const [absTargetDir, setAbsTargetDir] = useState("");
  const [blastRadius, setBlastRadius] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  
  // --- HORIZON 3: AI AGENT SUPERVISOR BATCH STATE ---
  const [agentBatch, setAgentBatch] = useState(null);
  const [remoteAuthSession, setRemoteAuthSession] = useState(null);
  
  // --- ML & SOURCE CONTROL STATES ---
  const [gitStatuses, setGitStatuses] = useState({});
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitBranch, setGitBranch] = useState("main");
  const [repoName, setRepoName] = useState("");
  const [gitDetailedStatus, setGitDetailedStatus] = useState({ staged: [], unstaged: [] });
  const [gitGraph, setGitGraph] = useState([]);
  
  // --- TERMINAL MULTI-SESSION STATES ---
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Neural Engine initialized.", isError: false },
    { text: "Ready for spatial inspection & code execution.", isError: false }
  ]);
  const [terminalSessions, setTerminalSessions] = useState([
    { id: "term_1", name: "PowerShell 1", shellType: "powershell", cwd: "", isRunning: false, history: [] }
  ]);
  const [activeSessionId, setActiveSessionId] = useState("output");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const wsRef = useRef(null);
  const lastTargetDirRef = useRef("");
  const reconnectAttemptsRef = useRef(0);
  const pingTimestampRef = useRef(Date.now());
  const hasNotifiedConnectedRef = useRef(false);
  const terminalStreamBufferRef = useRef({});
  const terminalStreamTimerRef = useRef(null);
  
  // --- REAL-TIME SYSTEM ALERTS & NOTIFICATIONS ---
  const [notifications, setNotifications] = useState([
    {
      id: 'init_spatial',
      type: 'success',
      title: 'Spatial Engine',
      message: 'WebGPU Spatial Canvas active (60 FPS)',
      time: 'Just now',
      timestamp: Date.now(),
      read: true,
      source: 'engine'
    },
    {
      id: 'init_guard',
      type: 'info',
      title: 'AST Refactor Guard',
      message: 'LibCST & Tree-Sitter parsing active',
      time: 'Ready',
      timestamp: Date.now(),
      read: true,
      source: 'ai'
    }
  ]);

  const addNotification = useCallback((type, title, message, source = 'system') => {
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      title,
      message,
      time: 'Just now',
      timestamp: Date.now(),
      read: false,
      source
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);
  }, []);

  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

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
    let ws = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let sleepWatcherTimer = null;
    let lastTick = Date.now();
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
          if (!hasNotifiedConnectedRef.current) {
            hasNotifiedConnectedRef.current = true;
            addNotificationRef.current?.('success', 'Neural Engine Connected', 'Spatial Engine & AST Sidecar online (127.0.0.1:8000)', 'engine');
          }

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

            // 0b. WORKSPACE FOLDER LOADING & CANCEL (Minimalist Splash Loading)
            else if (data.event === 'WORKSPACE_LOADING') {
              folderLoadingStartTimeRef.current = Date.now();
              setIsFolderLoading(true);
            }
            else if (data.event === 'FOLDER_PICK_CANCELLED') {
              setIsFolderLoading(false);
              folderLoadingStartTimeRef.current = 0;
            }

            // 1. FULL WORKSPACE INITIALIZATION / SYNC
            else if (data.event === 'INIT' || data.event === 'SYNC') {
              const payload = data.payload || {};
              const newTargetDir = payload.target_dir_abs || "";
              const isDirSwitch = lastTargetDirRef.current && lastTargetDirRef.current !== newTargetDir;
              lastTargetDirRef.current = newTargetDir;

              if (payload.user_session) {
                setRemoteAuthSession(prev => {
                  if (prev && JSON.stringify(prev) === JSON.stringify(payload.user_session)) {
                    return prev;
                  }
                  return payload.user_session;
                });
              }

              setItems(payload.items || []);
              setFiles(payload.files || []);
              
              const newActive = payload.active_file || "";
              
              // Only override currentFile on initial load or workspace folder switch
              if (isDirSwitch) {
                setCurrentFile(newActive || "");
                currentFileRef.current = newActive || "";
              } else if (!currentFileRef.current) {
                if (newActive) {
                  setCurrentFile(newActive);
                  currentFileRef.current = newActive;
                }
              }

              // 🚀 PURGE DELETED FILES WITHOUT RESURRECTING CLOSED TABS
              setOpenFiles(prev => {
                if (isDirSwitch) {
                  return newActive ? [newActive] : [];
                }
                if (prev.length === 0) {
                  const initial = currentFileRef.current || newActive;
                  return initial ? [initial] : [];
                }
                const validSet = new Set(payload.files || []);
                return prev.filter(f => validSet.has(f));
              });

              setAbsTargetDir(newTargetDir);
              setGitStatuses(payload.git_statuses || {});
              setIsGitRepo(Boolean(payload.is_git_repo));
              setGitBranch(payload.git_branch || "main");
              setRepoName(payload.repo_name || "");
              if (payload.git_detailed_status) {
                setGitDetailedStatus(payload.git_detailed_status);
              }
              if (payload.git_graph) {
                setGitGraph(payload.git_graph);
              }

              const isBlastOn = isBlastProtectionLocallyEnabled();
              if (isBlastOn && payload.agent_batch) {
                setAgentBatch(payload.agent_batch);
                if (payload.agent_batch.blastRadiusNodeIds) {
                  setBlastRadius(payload.agent_batch.blastRadiusNodeIds);
                }
                if (payload.agent_batch.blastProtectionBlocked) {
                  addNotificationRef.current?.(
                    'warning',
                    'Blast Protection Intercepted Burst',
                    payload.agent_batch.protectionMessage || 'Neutralized rapid multi-file AI edits to safeguard your codebase.',
                    'blast'
                  );
                }
              } else {
                setAgentBatch(null);
                setBlastRadius(null);
              }
              
              // 🚀 CLEANLY RESET TERMINALS ON WORKSPACE SWITCH
              if (isDirSwitch) {
                // Terminate any running processes known from previous workspace
                terminalSessions.forEach(s => {
                  if (s.isRunning && ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ event: 'KILL_TERMINAL_PROCESS', session_id: s.id }));
                  }
                });

                setTerminalSessions([
                  { 
                    id: "term_1", 
                    name: "PowerShell 1", 
                    shellType: "powershell", 
                    cwd: newTargetDir, 
                    isRunning: false, 
                    history: [] 
                  }
                ]);
                setActiveSessionId("term_1");
                setTerminalLogs([
                  { text: `Workspace switched to ${newTargetDir}`, isError: false, isSystem: true }
                ]);
              } else {
                setTerminalSessions(prev => prev.map(s => ({
                  ...s, 
                  cwd: newTargetDir || s.cwd 
                })));
              }
              
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

              // 🚀 Smoothly exit folder loading screen (350ms min display prevents visual jitter)
              const elapsed = Date.now() - (folderLoadingStartTimeRef.current || 0);
              const minDisplayTime = 350;
              if (folderLoadingStartTimeRef.current && elapsed < minDisplayTime) {
                setTimeout(() => {
                  setIsFolderLoading(false);
                  folderLoadingStartTimeRef.current = 0;
                }, minDisplayTime - elapsed);
              } else {
                setIsFolderLoading(false);
                folderLoadingStartTimeRef.current = 0;
              }
            }

            // 2. INCREMENTAL LIVE GRAPH HOT-PATCHING
            else if (data.event === 'GRAPH_DELTA') {
              const { 
                nodes_upsert = [], 
                nodes_remove = [], 
                edges_upsert = [], 
                edges_remove = [], 
                items: deltaItems,
                files: deltaFiles,
                git_statuses, 
                git_detailed_status,
                git_graph,
                git_branch,
                is_git_repo,
                repo_name,
                agent_batch 
              } = data.payload || {};

              if (deltaItems) setItems(deltaItems);
              if (deltaFiles) setFiles(deltaFiles);
              if (git_statuses) setGitStatuses(git_statuses);
              if (git_detailed_status) setGitDetailedStatus(git_detailed_status);
              if (Array.isArray(git_graph)) setGitGraph(git_graph);
              if (typeof is_git_repo !== 'undefined') setIsGitRepo(Boolean(is_git_repo));
              if (git_branch) setGitBranch(git_branch);
              if (repo_name) setRepoName(repo_name);

              const isBlastOn = isBlastProtectionLocallyEnabled();
              if (isBlastOn && agent_batch) {
                setAgentBatch(agent_batch);
                setBlastRadius(agent_batch.blastRadiusNodeIds || null);
                if (agent_batch.blastProtectionBlocked) {
                  addNotificationRef.current?.(
                    'warning',
                    'Blast Protection Intercepted Burst',
                    agent_batch.protectionMessage || 'Neutralized rapid multi-file AI edits to safeguard your codebase.',
                    'blast'
                  );
                }
              } else if (!isBlastOn || agent_batch === null) {
                setAgentBatch(null);
                setBlastRadius(null);
              }

              setNodes(prevNodes => {
                const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
                nodes_remove.forEach(id => nodeMap.delete(id));
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
            
            // 3. FILE SAVE & SYNCHRONIZATION EVENTS
            else if (data.event === 'SAVE_FILE_SUCCESS') {
              setIsFileSyncing(false);
              addNotificationRef.current?.('success', 'File Saved', `${data.filename || 'File'} saved successfully to disk`, 'filesystem');
            }
            else if (data.event === 'SAVE_FILE_ERROR') {
              setIsFileSyncing(false);
              addNotificationRef.current?.('error', 'Save Failed', `Failed to save ${data.filename}: ${data.reason}`, 'filesystem');
            }

            // 3.1 FAST FILE SWITCH ACKNOWLEDGEMENT
            else if (data.event === 'FILE_SWITCH_ACK') {
              setIsFileSyncing(false);
              const { active_file, content } = data;
              if (active_file && content !== undefined) {
                setNodes(prev => prev.map(n => {
                  if (n.id === active_file && n.data?.nodeType === 'file') {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        code: content
                      }
                    };
                  }
                  return n;
                }));
              }
            }

            // 3.5 USER AUTHENTICATION SYNCHRONIZATION
            else if (data.event === 'AUTH_SESSION_UPDATE') {
              const newSession = data.session;
              setRemoteAuthSession(newSession);
              const name = newSession?.user?.user_metadata?.full_name || newSession?.user?.email || 'Google User';
              addNotificationRef.current?.('success', 'Google Account Synced', `Signed in as ${name}`, 'auth');
            }
            else if (data.event === 'AUTH_LOGOUT') {
              setRemoteAuthSession(null);
              addNotificationRef.current?.('info', 'Signed Out', 'Signed out of Google account.', 'auth');
            }

            // 4. HORIZON 3: AI AGENT SUPERVISOR EVENTS
            else if (data.event === 'BLAST_RADIUS') {
              setBlastRadius(Array.isArray(data.payload) ? data.payload : null);
            }
            else if (data.event === 'AGENT_BATCH_DETAILS') {
              setAgentBatch(data.payload);
            }
            else if (data.event === 'AGENT_ROLLBACK_SUCCESS') {
              setAgentBatch(null);
              setBlastRadius(null);
              addNotificationRef.current?.('info', 'Agent Rollback', 'Rolled back AI modifications to baseline', 'ai');
            }
            else if (data.event === 'AGENT_APPROVE_SUCCESS') {
              setAgentBatch(null);
              setBlastRadius(null);
              addNotificationRef.current?.('success', 'Agent Approved', 'AI batch changes merged into workspace', 'ai');
            }
            else if (data.event === 'REFACTOR_CSP_VIOLATION') {
              addNotificationRef.current?.('error', 'Refactoring Guard (CSP)', data.reason || 'Dependency rule violated', 'ai');
            }
            else if (data.event === 'REFACTOR_SUCCESS' || data.event === 'REFACTOR_FILE_MERGE_SUCCESS') {
              addNotificationRef.current?.('success', 'Refactor Applied', data.message || 'AST transformation merged cleanly', 'ai');
            }
            else if (data.event === 'REFACTOR_ERROR' || data.event === 'REFACTOR_FILE_MERGE_ERROR') {
              addNotificationRef.current?.('error', 'Refactor Error', data.reason || 'Transformation failed', 'ai');
            }
            else if (data.event === 'LLM_SUMMARY_READY') {
              setAiInsight({
                nodeId: data.node_id,
                summary: data.summary
              });
            }
            else if (data.event === 'GIT_DETAILED_STATUS') {
              if (data.payload) setGitDetailedStatus(data.payload);
            }
            else if (data.event === 'GIT_GRAPH_DATA') {
              if (data.payload) setGitGraph(data.payload);
            }
            else if (data.event === 'GIT_COMMIT_SUCCESS') {
              addNotificationRef.current?.('success', 'Git Commit', 'Changes committed successfully', 'engine');
            }
            else if (data.event === 'GIT_COMMIT_ERROR') {
              addNotificationRef.current?.('error', 'Git Commit Failed', data.error || 'Failed to commit', 'engine');
            }

            // 5. TERMINAL STREAMING ENGINE
            else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
              const rawLines = (data.payload || '').split('\n');
              if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
                rawLines.pop();
              }
              rawLines.forEach(text => {
                if (text.startsWith('[Done]')) {
                  const isExitSuccess = text.includes('code 0');
                  if (isExitSuccess) {
                    addNotificationRef.current?.('success', 'Execution Finished', text, 'runtime');
                  } else {
                    addNotificationRef.current?.('error', 'Execution Error', text, 'runtime');
                  }
                } else if (text.startsWith('[Timeout]')) {
                  addNotificationRef.current?.('warning', 'Execution Timeout', text, 'runtime');
                }
              });

              const newLogs = rawLines.map(text => {
                const isSystem = text.startsWith('[Done]') || text.startsWith('[Running]') || text.startsWith('[Compiling') || text.startsWith('[Timeout]');
                return { 
                  text, 
                  isError: data.event === 'TERMINAL_ERROR',
                  isSystem 
                };
              });
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
              const sId = data.session_id;
              if (!terminalStreamBufferRef.current[sId]) {
                terminalStreamBufferRef.current[sId] = { stdout: "", stderr: "" };
              }
              const key = data.is_error ? 'stderr' : 'stdout';
              terminalStreamBufferRef.current[sId][key] += data.text;

              if (!terminalStreamTimerRef.current) {
                terminalStreamTimerRef.current = setTimeout(() => {
                  terminalStreamTimerRef.current = null;
                  const chunks = terminalStreamBufferRef.current;
                  terminalStreamBufferRef.current = {};

                  setTerminalSessions(prev => prev.map(s => {
                    const chunk = chunks[s.id];
                    if (!chunk || s.history.length === 0) return s;
                    const lastIdx = s.history.length - 1;
                    const updatedHistory = [...s.history];
                    const item = updatedHistory[lastIdx];
                    updatedHistory[lastIdx] = {
                      ...item,
                      stdout: (item.stdout + chunk.stdout).slice(-200000),
                      stderr: (item.stderr + chunk.stderr).slice(-50000)
                    };
                    return { ...s, history: updatedHistory };
                  }));
                }, 25);
              }
            }
            else if (data.event === 'TERMINAL_STREAM_END') {
              if (terminalStreamTimerRef.current) {
                clearTimeout(terminalStreamTimerRef.current);
                terminalStreamTimerRef.current = null;
              }
              const chunks = terminalStreamBufferRef.current;
              terminalStreamBufferRef.current = {};

              setTerminalSessions(prev => prev.map(s => {
                if (s.id === data.session_id) {
                  let updatedHistory = s.history;
                  const chunk = chunks[s.id];
                  if (chunk && s.history.length > 0) {
                    const lastIdx = s.history.length - 1;
                    updatedHistory = [...s.history];
                    const item = updatedHistory[lastIdx];
                    updatedHistory[lastIdx] = {
                      ...item,
                      stdout: (item.stdout + chunk.stdout).slice(-200000),
                      stderr: (item.stderr + chunk.stderr).slice(-50000)
                    };
                  }
                  return { ...s, isRunning: false, history: updatedHistory };
                }
                return s;
              }));
            }

            // 8. GIT SOURCE CONTROL REAL-TIME EVENT BUS
            else if (data.event === 'GIT_DETAILED_STATUS') {
              if (data.payload) setGitDetailedStatus(data.payload);
            }
            else if (data.event === 'GIT_GRAPH_DATA') {
              if (data.payload) setGitGraph(data.payload);
            }
            else if (data.event === 'GIT_COMMIT_SUCCESS') {
              addNotificationRef.current?.('success', 'Commit Succeeded', data.output || 'Changes committed successfully', 'git');
            }
            else if (data.event === 'GIT_COMMIT_ERROR') {
              addNotificationRef.current?.('error', 'Commit Failed', data.error || 'Failed to commit changes', 'git');
            }
            else if (data.event === 'GIT_PUSH_SUCCESS') {
              addNotificationRef.current?.('success', 'Push Succeeded', data.output || 'Pushed commits to remote', 'git');
            }
            else if (data.event === 'GIT_PUSH_ERROR') {
              addNotificationRef.current?.('error', 'Push Failed', data.error || 'Failed to push commits', 'git');
            }

          } catch (msgErr) { 
            console.error("[ERROR] Failed parsing WebSocket payload:", msgErr); 
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setIsWsConnected(false);
          clearInterval(heartbeatTimer);
          addNotificationRef.current?.('warning', 'Connection Interrupted', 'Python Backend offline. Reconnecting...', 'engine');
          
          const delay = Math.min(6000, 500 * Math.pow(1.4, reconnectAttemptsRef.current++));
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

    // ⚡ System Sleep / Wake Detector
    sleepWatcherTimer = setInterval(() => {
      const now = Date.now();
      // If gap > 5000ms on a 2000ms interval, PC was asleep / suspended
      if (now - lastTick > 5000) {
        console.log("⚡ PC wake detected after sleep/hibernation. Refreshing socket & terminal sync...");
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        } else {
          try {
            ws.send(JSON.stringify({ event: 'PING' }));
          } catch (e) {
            try { ws.close(); } catch (_) {}
          }
        }
      }
      lastTick = now;
    }, 2000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastTick > 5000) {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            connectWebSocket();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleWindowFocus = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'SYNC_WORKSPACE' }));
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      clearInterval(sleepWatcherTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, []); // Mounts WebSocket connection once for the lifetime of the application

  // Tab & File Management (VS Code Standard Adjacent Tab Selection & 0ms Optimistic UI)
  const closeFile = useCallback((fileToClose, onActiveChange) => {
    const currentList = openFilesRef.current;
    const closeIdx = currentList.indexOf(fileToClose);
    const nextList = currentList.filter(f => f !== fileToClose);

    setOpenFiles(nextList);
    openFilesRef.current = nextList;

    if (currentFileRef.current === fileToClose) {
      let nextActive = "";
      if (nextList.length > 0) {
        // Pick adjacent tab: if closing middle/first tab, pick right adjacent; if closing last tab, pick left adjacent
        const targetIdx = Math.min(Math.max(0, closeIdx), nextList.length - 1);
        nextActive = nextList[targetIdx];
      }

      setCurrentFile(nextActive);
      currentFileRef.current = nextActive;

      if (onActiveChange) {
        onActiveChange(nextActive);
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'SWITCH_FILE', filename: nextActive }));
      }
    }
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

  // AI Agent Supervisor Actions
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

  // 🚀 Terminal Actions with Active Folder CWD
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
        cwd: absTargetDir || lastTargetDirRef.current, 
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
        cwd: targetSession.cwd || absTargetDir || lastTargetDirRef.current
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
    // 🚀 Optimistically unlock terminal state immediately
    if (terminalStreamTimerRef.current) {
      clearTimeout(terminalStreamTimerRef.current);
      terminalStreamTimerRef.current = null;
    }
    terminalStreamBufferRef.current[sessionId] = { stdout: "", stderr: "" };

    setTerminalSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updatedHistory = [...(s.history || [])];
        if (updatedHistory.length > 0) {
          const lastIdx = updatedHistory.length - 1;
          const currentOut = updatedHistory[lastIdx].stdout || "";
          if (!currentOut.includes("[Process terminated")) {
            updatedHistory[lastIdx] = {
              ...updatedHistory[lastIdx],
              stdout: currentOut + "\r\n[Process terminated by user]\r\n"
            };
          }
        }
        return { ...s, isRunning: false, history: updatedHistory };
      }
      return s;
    }));
  }, []);

  const clearTerminalSession = useCallback((sessionId) => {
    if (sessionId === 'output') {
      setTerminalLogs([]);
    } else {
      setTerminalSessions(prev => prev.map(s => (
        s.id === sessionId ? { ...s, history: [] } : s
      )));
    }
  }, []);

  const commitGitChanges = useCallback((message, options = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        event: 'GIT_COMMIT', 
        message,
        push: Boolean(options.push),
        amend: Boolean(options.amend)
      }));
    }
  }, []);

  const pushGitChanges = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_PUSH' }));
    }
  }, []);

  const stageGitFile = useCallback((path) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_STAGE_FILE', path }));
    }
  }, []);

  const unstageGitFile = useCallback((path) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_UNSTAGE_FILE', path }));
    }
  }, []);

  const discardGitFile = useCallback((path) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_DISCARD_FILE', path }));
    }
  }, []);

  const stageAllGit = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_STAGE_ALL' }));
    }
  }, []);

  const discardAllGit = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_DISCARD_ALL' }));
    }
  }, []);

  const refreshGitGraph = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'GIT_FETCH_STATUS' }));
    }
  }, []);

  return {
    isGraphLoaded, setIsGraphLoaded, 
    isFolderLoading, setIsFolderLoading,
    isFileSyncing, setIsFileSyncing,
    isWsConnected, wsLatency,
    items, files, currentFile, setCurrentFile, absTargetDir,
    openFiles, setOpenFiles, closeFile,
    gitStatuses, isGitRepo, gitBranch, repoName,
    gitDetailedStatus, gitGraph,
    commitGitChanges, pushGitChanges, stageGitFile, unstageGitFile, discardGitFile,
    stageAllGit, discardAllGit, refreshGitGraph,
    nodes, setNodes, onNodesChange, 
    edges, setEdges, onEdgesChange,
    blastRadius, setBlastRadius, 
    aiInsight, setAiInsight, 
    agentBatch, rollbackAgentBatch, approveAgentBatch, dismissAgentBatch,
    terminalLogs, setTerminalLogs,
    terminalSessions, activeSessionId, setActiveSessionId,
    createTerminalSession, closeTerminalSession, 
    sendTerminalCommand, sendTerminalStdin, killTerminalProcess, clearTerminalSession,
    refreshWorkspace, wsRef,
    notifications, addNotification, dismissNotification, clearNotifications, markAllNotificationsRead,
    remoteAuthSession, setRemoteAuthSession
  };
}