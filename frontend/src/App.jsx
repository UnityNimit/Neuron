// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2, X, Play, Layout, AlertOctagon } from 'lucide-react';

// Authentication & Core Services
import { supabase } from './supabaseClient';
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

  // --- OPTIMIZATION 1: O(1) ADJACENCY CACHE (Handles String & Object Endpoints) ---
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

  // --- NATIVE HARDWARE KEYBINDS (0ms Latency) ---
  useEffect(() => {
    const handleGlobalKeys = (e) => {
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
  }, [hoveredNodeId, workspace, centerView]);

  // --- WEBSOCKET EVENT LISTENER: AI & REFACTORING TRANSACTIONS ---
  useEffect(() => {
    const ws = workspace.wsRef.current;
    if (!ws) return;

    const handleWsEvents = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 1. LLM Summary Response
        if (data.event === 'LLM_SUMMARY_READY') {
          if (hoveredNodeId === data.node_id) {
            workspace.setAiInsight({
              nodeId: data.node_id,
              summary: data.summary
            });
          }
        }
        // 2. CSP Refactoring Rejection
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
        // 3. CSP Refactoring Success
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

  // --- FILE-TO-FILE FUSION (MERGE) DISPATCHER ---
  const handleFileMergeDrop = useCallback(({ sourceFile, destFile }) => {
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_FILE_MERGE',
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef]);

  // --- 🚀 HORIZON 2: 3D CAMERA WARP DISPATCHER ---
  const handleWarpToNode = useCallback((nodeId) => {
    setCenterView('spatial');
    setWarpTargetNodeId(nodeId);
    setHoveredNodeId(nodeId);

    setTimeout(() => {
      setWarpTargetNodeId(null);
    }, 250);
  }, [setCenterView]);

  // --- MEMOIZED DISPATCHERS ---
  const activeCodeStr = useMemo(() => {
    const fileNode = (workspace.nodes || []).find(n => n.id === workspace.currentFile && n.data?.nodeType === 'file');
    return fileNode ? (fileNode.data?.code || "") : "";
  }, [workspace.nodes, workspace.currentFile]);

  const handleRunCode = useCallback(async () => {
    workspace.setActiveSessionId('output');
    if (!isCompilerReady || !window.pyodide) return;
    workspace.setTerminalLogs([{ text: `Executing ${workspace.currentFile}...`, isSystem: true }]);
    try {
      window.pyodide.setStdin({ stdin: () => { const lines = stdin.split('\n'); return lines.length > 0 ? lines.shift() : ""; }});
      await window.pyodide.runPythonAsync(activeCodeStr);
      workspace.setTerminalLogs(prev => [...prev, { text: `Process exited with code 0`, isSystem: true }]);
    } catch (error) { 
      workspace.setTerminalLogs(prev => [...prev, { text: error.message, isError: true }]); 
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

  // STABLE WEBGPU HOVER ROUTER WITH AI DEBOUNCE
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

  // --- INIT ROUTING ---
  useEffect(() => { 
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session)); 
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session)); 
    return () => subscription.unsubscribe(); 
  }, []);

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
        onLogin={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} 
      />
    );
  }
  
  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col font-sans text-slate-300 overflow-hidden relative">
      
      {/* 🚀 COMMAND PALETTE (Natural Language Omni-Search) */}
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
      <TopBar onRun={handleRunCode} onOpenFolder={handleOpenFolder} onCreateFile={() => { const name = prompt("Enter new file name:"); if (name) handleCreateItem(name, 'file'); }} onOpenSettings={() => setIsSettingsOpen(true)} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} layout={layout} setLayout={setLayout} />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={() => supabase.auth.signOut()} />
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v12">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar 
                  items={workspace.items} 
                  currentFile={workspace.currentFile} 
                  absTargetDir={workspace.absTargetDir} 
                  gitStatuses={workspace.gitStatuses} 
                  onSwitchFile={handleSwitchFile} 
                  onCreateItem={handleCreateItem} 
                  onDeleteFile={handleDeleteFile} 
                  onRunFile={handleRunCode} 
                  onRenameItem={(item) => { const n = prompt("New name:", item.path); if (n) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); }} 
                  onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} 
                  onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} 
                  onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} 
                />
              </Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center">
                <div className="w-[1px] h-full bg-[#2b2d31]" />
              </Separator>
            </>
          )}

          <Panel id="main-canvas" order={2} className="flex flex-col bg-[#0a0a0a]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col bg-[#0f0f0f]">
                
                {/* Center Tab Bar */}
                <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-[#333] z-40 relative">
                  
                  <button onClick={() => setCenterView('spatial')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors shrink-0 ${centerView === 'spatial' ? 'bg-[#0f0f0f] text-blue-400 border-t-2 border-t-blue-500 font-semibold' : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#141414] hover:text-slate-300'}`}>
                    <Network size={14} /> Spatial Map
                  </button>

                  {/* Dynamic Multi-File Tabs with Git Status */}
                  {(workspace.openFiles || []).map(file => {
                    const gStat = (workspace.gitStatuses || {})[file];
                    const isModified = gStat === 'M';
                    const isUntracked = gStat === 'U';
                    
                    return (
                      <div 
                        key={file} 
                        onClick={() => { setCenterView('editor'); handleSwitchFile(file); }} 
                        className={`h-full px-3 flex items-center gap-2 text-xs border-r border-[#333] transition-colors cursor-pointer shrink-0 group ${centerView === 'editor' && workspace.currentFile === file ? 'bg-[#0a0a0a] border-t-2 border-t-yellow-500 font-semibold' : 'bg-[#1e1e1e] hover:bg-[#141414]'}`}
                      >
                        <FileCode2 size={14} className={isModified ? "text-yellow-600" : isUntracked ? "text-green-600" : "text-slate-400"} /> 
                        
                        <span className={`${isModified ? "text-yellow-500" : isUntracked ? "text-green-500" : centerView === 'editor' && workspace.currentFile === file ? "text-yellow-400" : "text-slate-300"}`}>
                          {file.split('/').pop()}
                        </span>
                        
                        {gStat && (
                          <span className={`text-[10px] ml-1 font-bold ${isModified ? "text-yellow-600" : "text-green-600"}`}>
                            {gStat}
                          </span>
                        )}

                        {workspace.isFileSyncing && workspace.currentFile === file && <Loader2 size={12} className="text-yellow-500 animate-spin ml-1" />}
                        
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (workspace.closeFile) workspace.closeFile(file); 
                            if ((workspace.openFiles || []).length === 1) setCenterView('spatial'); 
                          }} 
                          className="opacity-0 group-hover:opacity-100 hover:bg-[#333] rounded p-0.5 ml-1 transition-opacity text-slate-400 hover:text-slate-200"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Right Action Bar */}
                  <div className="ml-auto flex items-center gap-2 pr-3 shrink-0">
                    <button 
                      onClick={() => setLayout(prev => ({ ...prev, sidebar: !prev.sidebar }))}
                      className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1e1e1e] text-slate-400 border border-[#333] hover:text-slate-200 hover:bg-[#2a2d31] transition-colors"
                      title="Toggle Sidebar"
                    >
                      <Layout size={14} />
                    </button>
                    <button 
                      onClick={handleRunCode} 
                      className="flex items-center justify-center w-7 h-7 bg-green-600/90 hover:bg-green-500 text-white rounded-md transition-colors shadow-md border border-green-700/50"
                      title="Run Code"
                    >
                      <Play size={15} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-grow relative overflow-hidden bg-[#050505]">
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
                        <div className="absolute top-4 right-4 max-w-sm bg-[#0e0e0e]/90 border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)] rounded-xl p-3.5 z-[100] backdrop-blur-md pointer-events-none animate-in fade-in duration-150">
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
                      onCodeChange={(value) => { 
                        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) { 
                          workspace.wsRef.current.send(JSON.stringify({ 
                            event: 'CODE_EDIT', 
                            filename: workspace.currentFile, 
                            node_id: workspace.currentFile, 
                            new_code: value 
                          })); 
                        } 
                      }} 
                      onClearFocus={() => setEditorFocusLine(null)} 
                    />
                  )}
                </div>
              </Panel>
              {layout.terminal && ( 
                <>
                  <Separator className="h-1 bg-[#2b2d31] hover:bg-blue-500 cursor-row-resize z-50 flex items-center">
                    <div className="h-[1px] w-full bg-[#2b2d31]" />
                  </Separator>
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#141414]">
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
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center">
                <div className="w-[1px] h-full bg-[#2b2d31]" />
              </Separator>
              <Panel id="stdin-panel" order={4} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
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

      {/* 🚀 BOTTOM STATUS BAR (Live Protocols, Active Nodes, Git Churn, WebSocket Pulse) */}
      <StatusBar 
        activeFile={workspace.currentFile} 
        lineCount={(activeCodeStr?.split("\n").length || 0).toString()} 
        wordCount={(activeCodeStr?.trim().split(/\s+/).length || 0).toString()} 
        language={workspace.currentFile?.split('.').pop() === 'js' || workspace.currentFile?.split('.').pop() === 'jsx' ? 'JavaScript' : 'Python'} 
        nodes={workspace.nodes || []}
        edges={workspace.edges || []}
        gitStatuses={workspace.gitStatuses || {}}
        isWsConnected={workspace.isWsConnected}
        onCenterSpatialMap={() => setCenterView('spatial')}
      />
    </div>
  );
}