// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2, X, Play, AlertOctagon } from 'lucide-react';

// Authentication & Core Services
import { 
  supabase, 
  isTauriApp, 
  getLocalDesktopSession, 
  signInWithGoogleOAuth 
} from './supabaseClient';
import { loadPyodideEngine } from './services/pyodideService';

// Hooks & State
import { useWorkspace } from './hooks/useWorkspace';
import { useSettings } from './hooks/useSettings';
import { usePersistentState } from './hooks/usePersistentState';
import { usePhysicsEngine } from './hooks/usePhysicsEngine';

// 🌌 THE 100K NODE WEBGPU ENGINE (Pure Hardware Acceleration)
import PixiSpatialEngine from './components/canvas/PixiSpatialEngine';

// Layout & UI
import CodeEditor from './components/layout/CodeEditor';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SettingsModal from './components/layout/SettingsModal';
import StatusBar from './components/layout/StatusBar';
import TerminalPanel from './components/layout/TerminalPanel';
import StdinPanel from './components/layout/StdinPanel';
import CommandPalette from './components/layout/CommandPalette';
import AgentSupervisorHUD from './components/layout/AgentSupervisorHUD';
import SplashScreen from './components/layout/SplashScreen'; 

export default function App() {
  const [session, setSession] = useState(null);
  const workspace = useWorkspace(session);
  const { settings, updateSetting } = useSettings();
  
  const { layout, setLayout, centerView, setCenterView, stdin, setStdin } = usePersistentState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  
  const [editorFocusLine, setEditorFocusLine] = useState(null);
  const [focusIsolationId, setFocusIsolationId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // --- 🚀 HORIZON 2: CAMERA WARP TARGET STATE ---
  const [warpTargetNodeId, setWarpTargetNodeId] = useState(null);

  // --- VS CODE-STYLE DIRTY/UNSAVED FILES TRACKER ---
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const currentCodeBufferRef = useRef({});
  const autoSaveTimerRef = useRef(null);

  // --- AI & REFACTORING TRANSACTION REFS ---
  const hoverTimerRef = useRef(null);
  const pendingRefactorRef = useRef(null);
  const [cspRejection, setCspRejection] = useState(null);

  // --- ACTIVATE WEBGPU PURE-RAM PHYSICS ENGINE ---
  const { simDataRef, onDragStart, onDragMove, onDragEnd } = usePhysicsEngine(
    workspace.nodes || [], 
    workspace.edges || [], 
    workspace.wsRef, 
    workspace.isGraphLoaded, 
    centerView
  );

  // --- 🛡️ PERMANENT DESKTOP & WEB AUTH RESOLVER ---
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 🚀 DESKTOP NATIVE APP MODE: Instant local session (Zero external redirects)
      if (isTauriApp()) {
        const saved = localStorage.getItem('neuron_desktop_session');
        const desktopSession = saved ? JSON.parse(saved) : getLocalDesktopSession();
        localStorage.setItem('neuron_desktop_session', JSON.stringify(desktopSession));
        if (isMounted) setSession(desktopSession);
        return;
      }

      // 🌐 WEB BROWSER MODE: Supabase Session with fail-safe fallback
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (isMounted && existingSession) {
          setSession(existingSession);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
          if (isMounted && currentSession) {
            setSession(currentSession);
          }
        });
        return () => subscription.unsubscribe();
      } catch (err) {
        if (isMounted) setSession(getLocalDesktopSession());
      }
    };

    initAuth();
    return () => { isMounted = false; };
  }, []);

  const handleLogin = useCallback(async () => {
    if (isTauriApp()) {
      const desktopSession = getLocalDesktopSession();
      localStorage.setItem('neuron_desktop_session', JSON.stringify(desktopSession));
      setSession(desktopSession);
      return;
    }

    try {
      const { data, error } = await signInWithGoogleOAuth();
      if (error) throw error;
      if (data?.session) setSession(data.session);
    } catch (err) {
      console.warn("[AUTH] Fallback to local developer session:", err);
      setSession(getLocalDesktopSession());
    }
  }, []);

  // --- RECENT WORKSPACES RECORDER ---
  useEffect(() => {
    if (workspace.absTargetDir) {
      try {
        const saved = JSON.parse(localStorage.getItem('neuron_recent_projects') || '[]');
        const updated = [workspace.absTargetDir, ...saved.filter(p => p !== workspace.absTargetDir)].slice(0, 10);
        localStorage.setItem('neuron_recent_projects', JSON.stringify(updated));
      } catch (e) {}
    }
  }, [workspace.absTargetDir]);

  const handleOpenRecentWorkspace = useCallback((folderPath) => {
    if (folderPath && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.setIsFileSyncing(true);
      workspace.wsRef.current.send(JSON.stringify({
        event: 'OPEN_FOLDER_DIALOG',
        target_dir: folderPath
      }));
    }
  }, [workspace]);

  // --- 🚀 ATOMIC SAVE & AUTO-SAVE CONTROLLER ---
  const activeCodeStr = useMemo(() => {
    const fileNode = (workspace.nodes || []).find(n => n.id === workspace.currentFile && n.data?.nodeType === 'file');
    return fileNode ? (fileNode.data?.code || "") : "";
  }, [workspace.nodes, workspace.currentFile]);

  const handleSaveFile = useCallback((fileToSave, codeContent) => {
    const target = fileToSave || workspace.currentFile;
    const content = codeContent !== undefined 
      ? codeContent 
      : (currentCodeBufferRef.current[target] ?? activeCodeStr);
    
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN && target) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'SAVE_FILE',
        filename: target,
        content: content
      }));

      // Clear dirty indicator
      setDirtyFiles(prev => {
        const next = new Set(prev);
        next.delete(target);
        return next;
      });
    }
  }, [workspace.currentFile, workspace.wsRef, activeCodeStr]);

  const handleCodeChange = useCallback((newCode) => {
    if (!workspace.currentFile) return;
    currentCodeBufferRef.current[workspace.currentFile] = newCode;
    
    const isAutoSaveActive = settings?.autoSave ?? true;

    if (isAutoSaveActive) {
      // Auto-save on debounced idle
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveFile(workspace.currentFile, newCode);
      }, 550);
    } else {
      // Manual Save Mode: Mark file as dirty (●)
      setDirtyFiles(prev => new Set(prev).add(workspace.currentFile));
    }
  }, [workspace.currentFile, settings?.autoSave, handleSaveFile]);

  // --- OPTIMIZATION 1: O(1) ADJACENCY CACHE ---
  const adjLists = useMemo(() => {
    const hierarchyAdj = {}; 
    const callAdjForward = {}; 
    const callAdjBackward = {}; 

    (workspace.edges || []).forEach(e => {
      const srcId = typeof e.source === 'object' ? String(e.source.id) : String(e.source);
      const tgtId = typeof e.target === 'object' ? String(e.target.id) : String(e.target);
      const edgeId = e.id || `edge-${srcId}-${tgtId}`;

      if (e.type === 'hierarchy') {
        if (!hierarchyAdj[srcId]) hierarchyAdj[srcId] = [];
        if (!hierarchyAdj[tgtId]) hierarchyAdj[tgtId] = [];
        hierarchyAdj[srcId].push({ id: tgtId, edgeId });
        hierarchyAdj[tgtId].push({ id: srcId, edgeId });
      } else {
        if (!callAdjForward[srcId]) callAdjForward[srcId] = [];
        if (!callAdjBackward[tgtId]) callAdjBackward[tgtId] = [];
        callAdjForward[srcId].push({ id: tgtId, edgeId });
        callAdjBackward[tgtId].push({ id: srcId, edgeId });
      }
    });

    return { hierarchyAdj, callAdjForward, callAdjBackward };
  }, [workspace.edges]);

  // --- OPTIMIZATION 2: BFS PATHFINDING FOR WEBGPU FOCUS-RAY ---
  const activeRay = useMemo(() => {
    if (!hoveredNodeId) return null;
    
    const activeN = new Set([hoveredNodeId]);
    const activeE = new Set();
    const { hierarchyAdj, callAdjForward, callAdjBackward } = adjLists;
    
    (hierarchyAdj[hoveredNodeId] || []).forEach(n => { 
      activeN.add(n.id); 
      activeE.add(n.edgeId); 
    });

    const trace = (startId, adjMap) => {
      const queue = [startId];
      const visited = new Set([startId]);
      while (queue.length > 0) {
        const curr = queue.shift();
        (adjMap[curr] || []).forEach(n => {
          if (!visited.has(n.id)) { 
            visited.add(n.id); 
            activeN.add(n.id); 
            activeE.add(n.edgeId); 
            queue.push(n.id); 
          }
        });
      }
    };
    
    trace(hoveredNodeId, callAdjForward); 
    trace(hoveredNodeId, callAdjBackward); 
    
    return { activeN, activeE };
  }, [hoveredNodeId, adjLists]);

  // --- NATIVE HARDWARE KEYBINDS (Ctrl+S, Ctrl+K, Alt+I, F, Escape) ---
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      // 🚀 Save Active File (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { 
        e.preventDefault(); 
        handleSaveFile(); 
      }
      // Command Palette (Ctrl+K / Cmd+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { 
        e.preventDefault(); 
        setIsCommandPaletteOpen(true); 
      }
      // AI Impact Analysis (Alt+I)
      if (e.altKey && e.key.toLowerCase() === 'i' && hoveredNodeId) {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: hoveredNodeId }));
        }
      }
      // Focus Isolation (F)
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (hoveredNodeId) setFocusIsolationId(hoveredNodeId);
      }
      // Clear Map & Alerts (Escape)
      if (e.key === 'Escape') {
        workspace.setBlastRadius(null);
        setFocusIsolationId(null);
        setCspRejection(null);
        setWarpTargetNodeId(null);
      }
      // Canvas Refactor Undo (Ctrl+Z / Cmd+Z on Spatial Map)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (centerView === 'spatial' && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          e.preventDefault();
          workspace.wsRef.current.send(JSON.stringify({ event: 'REFACTOR_UNDO' }));
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [hoveredNodeId, workspace, centerView, handleSaveFile]);

  // --- WEBSOCKET EVENT LISTENER ---
  useEffect(() => {
    const ws = workspace.wsRef.current;
    if (!ws) return;

    const handleWsEvents = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'SAVE_FILE_SUCCESS') {
          setDirtyFiles(prev => {
            const next = new Set(prev);
            if (data.filename) next.delete(data.filename);
            return next;
          });
        }
        else if (data.event === 'LLM_SUMMARY_READY') {
          if (hoveredNodeId === data.node_id) {
            workspace.setAiInsight({
              nodeId: data.node_id,
              summary: data.summary
            });
          }
        }
        else if (data.event === 'REFACTOR_CSP_VIOLATION') {
          const payload = data.payload || {};
          const pending = pendingRefactorRef.current;
          
          setCspRejection({
            timestamp: Date.now(),
            processed: false,
            reason: payload.reason || "Constraint Violation: Cyclic dependency detected.",
            violationType: payload.violation_type || "CSP_VIOLATION",
            cyclePath: payload.cycle_path || [],
            suggestedFix: payload.suggested_fix,
            nodeId: pending?.nodeId,
            originalPos: pending?.originalPos
          });
        }
        else if (data.event === 'REFACTOR_SUCCESS' || data.event === 'REFACTOR_FILE_MERGE_SUCCESS') {
          setCspRejection(null);
          pendingRefactorRef.current = null;
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleWsEvents);
    return () => ws.removeEventListener('message', handleWsEvents);
  }, [workspace.wsRef, hoveredNodeId, workspace]);

  // --- FUNCTION-TO-FILE AST TRANSPLANT DISPATCHER ---
  const handleRefactorDrop = useCallback(({ symbolName, sourceFile, destFile, nodeId, originalPos }) => {
    pendingRefactorRef.current = { symbolName, sourceFile, destFile, nodeId, originalPos };
    
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_SYMBOL_MOVE',
        symbol_name: symbolName,
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef]);

  // --- FILE-TO-FILE FUSION DISPATCHER ---
  const handleFileMergeDrop = useCallback(({ sourceFile, destFile }) => {
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_FILE_MERGE',
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef]);

  // --- 🚀 3D CAMERA WARP DISPATCHER ---
  const handleWarpToNode = useCallback((nodeId) => {
    setCenterView('spatial');
    setWarpTargetNodeId(nodeId);
    setHoveredNodeId(nodeId);

    setTimeout(() => {
      setWarpTargetNodeId(null);
    }, 250);
  }, [setCenterView]);

  // 🚀 UNIVERSAL POLYGLOT CODE RUNNER (C++, C, Java, Python, JS)
  const handleRunCode = useCallback(async () => {
    workspace.setActiveSessionId('output');
    const activeExt = workspace.currentFile?.split('.').pop()?.toLowerCase();

    // 1. Primary: Run via Backend Compiler Engine with STDIN
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.setTerminalLogs(prev => [
        ...prev, 
        { text: `Compiling & executing ${workspace.currentFile}...`, isSystem: true }
      ]);
      workspace.wsRef.current.send(JSON.stringify({
        event: 'RUN_CODE',
        filename: workspace.currentFile,
        stdin: stdin
      }));
      return;
    }

    // 2. Web browser fallback for Python via Pyodide WASM
    if (activeExt === 'py' && isCompilerReady && window.pyodide) {
      workspace.setTerminalLogs([{ text: `Executing ${workspace.currentFile} in browser WASM...`, isSystem: true }]);
      try {
        window.pyodide.setStdin({ 
          stdin: () => { 
            const lines = stdin.split('\n'); 
            return lines.length > 0 ? lines.shift() : ""; 
          }
        });
        await window.pyodide.runPythonAsync(activeCodeStr);
        workspace.setTerminalLogs(prev => [...prev, { text: `Process exited with code 0`, isSystem: true }]);
      } catch (error) { 
        workspace.setTerminalLogs(prev => [...prev, { text: error.message, isError: true }]); 
      }
    }
  }, [workspace, isCompilerReady, stdin, activeCodeStr]);

  const handleSwitchFile = useCallback((filename) => { 
    if (filename !== workspace.currentFile) { 
      workspace.setIsFileSyncing(true); 
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); 
    }
  }, [workspace]);

  const handleOpenFolder = useCallback(() => { 
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' })); 
    }
  }, [workspace]);

  const handleCreateItem = useCallback((name, type) => { 
    workspace.setIsFileSyncing(true); 
    workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); 
  }, [workspace]);

  const handleDeleteFile = useCallback((f, e) => { 
    if (e) e.stopPropagation(); 
    if (window.confirm(`Delete ${f}?`)) {
      workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); 
    }
  }, [workspace]);

  const onDoubleClickNode = useCallback((filePath, line) => {
    if (filePath && filePath !== workspace.currentFile) {
      workspace.setIsFileSyncing(true);
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: filePath }));
    }
    setEditorFocusLine(line || 1);
    setCenterView('editor');
  }, [workspace, setCenterView]);

  // STABLE WEBGPU HOVER ROUTER
  const handleNodeHover = useCallback((isHovering, id) => {
    setHoveredNodeId(isHovering ? id : null);
    
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    
    if (isHovering && id) {
      hoverTimerRef.current = setTimeout(() => {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          const targetNode = (workspace.nodes || []).find(n => n.id === id);
          if (targetNode?.data?.code) {
            workspace.setAiInsight({
              nodeId: id,
              summary: "Analyzing AST topology & dependencies..." 
            });
            workspace.wsRef.current.send(JSON.stringify({ 
              event: 'REQUEST_LLM_SUMMARY', 
              node_id: id, 
              code: targetNode.data.code 
            }));
          }
        }
      }, 550);
    }
  }, [workspace.wsRef, workspace.nodes, workspace]);

  // --- INIT PYODIDE ENGINE ---
  useEffect(() => { 
    loadPyodideEngine(
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]), 
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])
    ).then(() => setIsCompilerReady(true)); 
  }, [workspace]);

  if (!session || !workspace.isGraphLoaded || !isCompilerReady) {
    return (
      <SplashScreen 
        session={session} 
        isGraphLoaded={workspace.isGraphLoaded} 
        isCompilerReady={isCompilerReady} 
        onLogin={handleLogin} 
      />
    );
  }
  
  return (
    <div className="w-screen h-screen bg-[#121314] flex flex-col font-sans text-slate-300 overflow-hidden relative select-none overscroll-none">
      
      {/* Omni-Search Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => { setIsCommandPaletteOpen(false); setSearchQuery(""); }} 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        workspace={workspace} 
        onRunCode={handleRunCode} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onWarpToNode={handleWarpToNode}
      />
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSetting={updateSetting} />
      
      {/* 🚀 Sleek Custom TopBar (With Active Save, Auto Save & Open Recent) */}
      <TopBar 
        onOpenFolder={handleOpenFolder} 
        onOpenRecent={handleOpenRecentWorkspace}
        onSave={() => handleSaveFile()}
        autoSave={settings?.autoSave ?? true}
        onToggleAutoSave={() => updateSetting('autoSave', !(settings?.autoSave ?? true))}
        onCreateFile={() => { const name = prompt("Enter new file name:"); if (name) handleCreateItem(name, 'file'); }} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} 
        layout={layout} 
        setLayout={setLayout} 
      />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={() => supabase.auth.signOut()} />
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v12">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#191a1b]">
                <Sidebar 
                  items={workspace.items} 
                  currentFile={workspace.currentFile} 
                  absTargetDir={workspace.absTargetDir} 
                  gitStatuses={workspace.gitStatuses} 
                  onSwitchFile={handleSwitchFile} 
                  onCreateItem={handleCreateItem} 
                  onDeleteFile={handleDeleteFile} 
                  onRunFile={handleRunCode} 
                  onRenameItem={(item) => { 
                    const oldPath = item.old_path || item.path;
                    const newPath = item.new_path || item.newPath;
                    if (oldPath && newPath && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
                      workspace.wsRef.current.send(JSON.stringify({ 
                        event: 'RENAME_ITEM', 
                        old_path: oldPath, 
                        new_path: newPath 
                      }));
                    }
                  }} 
                  onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} 
                  onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} 
                  onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} 
                />
              </Panel>
              {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (Sidebar) */}
              <Separator className="w-[1px] bg-[#242628] hover:bg-blue-500 cursor-col-resize z-50 flex justify-center transition-colors outline-none" />
            </>
          )}

          <Panel id="main-canvas" order={2} className="flex flex-col bg-[#121314]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col bg-[#121314]">
                
                {/* ----------------------------------------------------------- */}
                {/* CENTER TAB STRIP (#191a1b & Blue Accent)                    */}
                {/* ----------------------------------------------------------- */}
                <div className="h-8 shrink-0 bg-[#191a1b] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-[#242628] z-40 relative select-none">
                  
                  {/* Spatial Map Tab */}
                  <button 
                    onClick={() => setCenterView('spatial')} 
                    className={`h-full px-3 flex items-center gap-1.5 text-xs font-mono border-r border-[#242628] transition-colors shrink-0 cursor-pointer ${
                      centerView === 'spatial' 
                        ? 'bg-[#121314] text-blue-400 border-t-2 border-t-blue-500 font-semibold' 
                        : 'bg-[#191a1b] text-slate-400 hover:bg-[#202224] hover:text-slate-200'
                    }`}
                  >
                    <Network size={13} /> <span>Spatial Map</span>
                  </button>

                  {/* Dynamic Multi-File Tabs (With VS Code Dirty Dot Indicator ●) */}
                  {(workspace.openFiles || []).map(file => {
                    const gStat = (workspace.gitStatuses || {})[file];
                    const isModified = gStat === 'M';
                    const isUntracked = gStat === 'U';
                    const isActive = centerView === 'editor' && workspace.currentFile === file;
                    const isDirty = dirtyFiles.has(file);
                    
                    return (
                      <div 
                        key={file} 
                        onClick={() => { setCenterView('editor'); handleSwitchFile(file); }} 
                        className={`h-full px-3 flex items-center gap-2 text-xs font-mono border-r border-[#242628] transition-colors cursor-pointer shrink-0 group ${
                          isActive 
                            ? 'bg-[#121314] text-white border-t-2 border-t-blue-500 font-semibold' 
                            : 'bg-[#191a1b] text-slate-400 hover:bg-[#202224] hover:text-slate-200'
                        }`}
                      >
                        <FileCode2 size={13} className={isModified ? "text-blue-400" : isUntracked ? "text-emerald-400" : "text-slate-500"} /> 
                        
                        <span className={isActive ? "text-white" : isModified ? "text-blue-300" : isUntracked ? "text-emerald-300" : "text-slate-400"}>
                          {file.split('/').pop()}
                        </span>
                        
                        {gStat && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            isModified 
                              ? "text-blue-300 bg-blue-950/40 border border-blue-800/40" 
                              : "text-emerald-300 bg-emerald-950/40 border border-emerald-800/40"
                          }`}>
                            {gStat}
                          </span>
                        )}

                        {workspace.isFileSyncing && workspace.currentFile === file && (
                          <Loader2 size={11} className="text-blue-400 animate-spin" />
                        )}
                        
                        {/* 🚀 VS CODE-STYLE CLOSE BUTTON OR DIRTY CIRCLE (●) */}
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (workspace.closeFile) workspace.closeFile(file); 
                            if ((workspace.openFiles || []).length === 1) setCenterView('spatial'); 
                            setDirtyFiles(prev => {
                              const next = new Set(prev);
                              next.delete(file);
                              return next;
                            });
                          }} 
                          className="rounded p-0.5 ml-0.5 transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center relative w-4 h-4"
                          title={isDirty ? "Unsaved changes (Click to close)" : "Close Tab"}
                        >
                          {isDirty ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-slate-300 group-hover:opacity-0 transition-opacity" />
                              <X size={11} className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 m-auto" />
                            </>
                          ) : (
                            <X size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {/* 🚀 HOLLOW WHITE TRIANGLE RUN BUTTON (F5) */}
                  <div className="ml-auto flex items-center pr-2.5 shrink-0">
                    <button 
                      onClick={handleRunCode} 
                      className="w-7 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
                      title="Run Active File (F5)"
                    >
                      <Play size={13} strokeWidth={1.8} />
                    </button>
                  </div>

                </div>

                <div className="flex-grow relative overflow-hidden bg-[#121314]">
                  {centerView === 'spatial' ? (
                    <div className="relative w-full h-full">
                      {/* 🌌 THE WEBGPU SPATIAL ENGINE 🌌 */}
                      <PixiSpatialEngine 
                        simDataRef={simDataRef}
                        activeRay={activeRay}
                        focusIsolationId={focusIsolationId}
                        blastRadius={workspace.blastRadius}
                        cspRejectionEvent={cspRejection}
                        warpTargetNodeId={warpTargetNodeId}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onRefactorDrop={handleRefactorDrop}
                        onFileMergeDrop={handleFileMergeDrop}
                        onNodeHover={handleNodeHover}
                        onNodeDoubleClick={onDoubleClickNode}
                      />
                      
                      {/* 🚀 SUPER-MINIMALIST FLOATING AI OVERVIEW PANEL */}
                      {workspace.aiInsight && workspace.aiInsight.nodeId === hoveredNodeId && (
                        <div className="absolute top-4 right-4 max-w-sm bg-[#141516]/95 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)] rounded-xl p-3.5 z-[100] backdrop-blur-md pointer-events-none animate-in fade-in duration-150">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-blue-400 truncate">
                                {workspace.aiInsight.nodeId.split('::').pop()?.replace('()', '')}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 truncate shrink-0">
                                {workspace.aiInsight.nodeId.split('::')[0]}
                              </span>
                            </div>
                            <p className="text-slate-300 font-sans text-xs leading-relaxed">
                              {workspace.aiInsight.summary}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* --- FLOATING CSP REFACTORING VIOLATION ALERT --- */}
                      {cspRejection && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-full bg-[#1c0808]/95 border border-red-800/80 shadow-[0_0_50px_rgba(239,68,68,0.3)] rounded-xl p-4 z-[100] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
                          <div className="flex items-start gap-3">
                            <AlertOctagon size={20} className="text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-red-200 font-mono text-xs font-bold uppercase tracking-wider">
                                  Refactoring Guard: {cspRejection.violationType}
                                </h4>
                                <button 
                                  onClick={() => setCspRejection(null)} 
                                  className="text-red-400 hover:text-red-200 p-0.5"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <p className="text-slate-300 font-sans text-xs mt-1.5 leading-relaxed">
                                {cspRejection.reason}
                              </p>
                              {cspRejection.suggestedFix && (
                                <p className="text-red-300 font-mono text-[10px] mt-2 bg-black/40 p-2 rounded border border-red-950">
                                  Suggested: {cspRejection.suggestedFix}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <CodeEditor 
                      filename={workspace.currentFile} 
                      initialCode={activeCodeStr} 
                      settings={settings} 
                      focusLine={editorFocusLine} 
                      onCodeChange={handleCodeChange}
                      onSave={() => handleSaveFile()}
                      onClearFocus={() => setEditorFocusLine(null)} 
                    />
                  )}
                </div>
              </Panel>
              {layout.terminal && ( 
                <>
                  {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (Terminal) */}
                  <Separator className="h-[1px] bg-[#242628] hover:bg-blue-500 cursor-row-resize z-50 flex items-center transition-colors outline-none" />
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#191a1b]">
                    <TerminalPanel 
                      logs={workspace.terminalLogs} 
                      sessions={workspace.terminalSessions} 
                      activeSessionId={workspace.activeSessionId} 
                      absTargetDir={workspace.absTargetDir} 
                      onSelectSession={workspace.setActiveSessionId} 
                      onCreateSession={workspace.createTerminalSession} 
                      onCloseSession={workspace.closeTerminalSession} 
                      onSendTerminalCommand={workspace.sendTerminalCommand} 
                      onKillProcess={workspace.killTerminalProcess} 
                      onClearOutput={() => workspace.setTerminalLogs([])} 
                    />
                  </Panel>
                </> 
              )}
            </Group>
          </Panel>
          {layout.stdin && ( 
            <>
              {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (STDIN) */}
              <Separator className="w-[1px] bg-[#242628] hover:bg-blue-500 cursor-col-resize z-50 flex justify-center transition-colors outline-none" />
              <Panel id="stdin-panel" order={4} defaultSize={200} minSize={100} maxSize={500} className="bg-[#191a1b]">
                <StdinPanel stdin={stdin} setStdin={setStdin} />
              </Panel>
            </> 
          )}
        </Group>
      </div>

      {/* 🚀 HORIZON 3: AI AGENT SUPERVISOR LIVE PR BLAST RADIUS HUD */}
      <AgentSupervisorHUD 
        agentBatch={workspace.agentBatch}
        onRollback={workspace.rollbackAgentBatch}
        onApprove={workspace.approveAgentBatch}
        onDismiss={workspace.dismissAgentBatch}
        onWarpToNode={handleWarpToNode}
        onSwitchFile={handleSwitchFile}
      />

      {/* 🚀 BOTTOM STATUS BAR (#191a1b Secondary Theme) */}
      <StatusBar 
        activeFile={workspace.currentFile} 
        lineCount={(activeCodeStr?.split("\n").length || 0).toString()} 
        wordCount={(activeCodeStr?.trim().split(/\s+/).length || 0).toString()} 
        language={workspace.currentFile?.split('.').pop() || 'plaintext'} 
        nodes={workspace.nodes || []}
        edges={workspace.edges || []}
        gitStatuses={workspace.gitStatuses || {}}
        gitBranch={workspace.gitBranch || "main"}
        isGitRepo={workspace.isGitRepo ?? true}
        repoName={workspace.repoName || ""}
        absTargetDir={workspace.absTargetDir || ""}
        onCenterSpatialMap={() => setCenterView('spatial')}
      />
    </div>
  );
}