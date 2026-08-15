// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2 } from 'lucide-react';

// Authentication & Core Services
import { supabase } from './supabaseClient';
import { loadPyodideEngine } from './services/pyodideService';

// Hooks & State
import { useWorkspace } from './hooks/useWorkspace';
import { useSettings } from './hooks/useSettings';
import { usePersistentState } from './hooks/usePersistentState';
import { usePhysicsEngine } from './hooks/usePhysicsEngine';

// THE 100K NODE WEBGPU ENGINE (Pure Hardware Acceleration)
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
import SplashScreen from './components/layout/SplashScreen'; 
import PerfMonitor from './components/debug/PerfMonitor';

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

  // --- AI STATE & REFS ---
  const hoverTimerRef = useRef(null);
  const [aiInsight, setAiInsight] = useState(null);

  // --- ACTIVATE WEBGPU PURE-RAM PHYSICS ENGINE ---
  const { simDataRef, onDragStart, onDragMove, onDragEnd } = usePhysicsEngine(
    workspace.nodes, workspace.edges, workspace.wsRef, workspace.isGraphLoaded, centerView
  );

  // OPTIMIZATION 1: O(1) ADJACENCY CACHE
  const adjLists = useMemo(() => {
    const hierarchyAdj = {}; const callAdjForward = {}; const callAdjBackward = {}; 
    workspace.edges.forEach(e => {
      if (e.type === 'hierarchy') {
         if(!hierarchyAdj[e.source]) hierarchyAdj[e.source] = [];
         if(!hierarchyAdj[e.target]) hierarchyAdj[e.target] = [];
         hierarchyAdj[e.source].push({ id: e.target, edgeId: e.id });
         hierarchyAdj[e.target].push({ id: e.source, edgeId: e.id });
      } else {
         if(!callAdjForward[e.source]) callAdjForward[e.source] = [];
         if(!callAdjBackward[e.target]) callAdjBackward[e.target] = [];
         callAdjForward[e.source].push({ id: e.target, edgeId: e.id });
         callAdjBackward[e.target].push({ id: e.source, edgeId: e.id });
      }
    });
    return { hierarchyAdj, callAdjForward, callAdjBackward };
  }, [workspace.edges]);

  // OPTIMIZATION 2: LIGHTNING-FAST BFS TRACE FOR WEBGPU
  const activeRay = useMemo(() => {
    if (!hoveredNodeId) return null;
    
    const activeN = new Set([hoveredNodeId]);
    const activeE = new Set();
    const { hierarchyAdj, callAdjForward, callAdjBackward } = adjLists;
    
    (hierarchyAdj[hoveredNodeId] || []).forEach(n => { activeN.add(n.id); activeE.add(n.edgeId); });

    const trace = (startId, adjMap) => {
      const queue = [startId];
      const visited = new Set([startId]);
      while(queue.length > 0) {
        const curr = queue.shift();
        (adjMap[curr] || []).forEach(n => {
          if (!visited.has(n.id)) { visited.add(n.id); activeN.add(n.id); activeE.add(n.edgeId); queue.push(n.id); }
        });
      }
    };
    trace(hoveredNodeId, callAdjForward); trace(hoveredNodeId, callAdjBackward); 
    
    return { activeN, activeE };
  }, [hoveredNodeId, adjLists]);

  // --- OPTIMIZATION 3: NATIVE HARDWARE KEYBINDS (0ms Latency) ---
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { 
        e.preventDefault(); setIsCommandPaletteOpen(true); 
      }
      if (e.altKey && e.key.toLowerCase() === 'i' && hoveredNodeId) {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: hoveredNodeId }));
        }
      }
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
        if (hoveredNodeId) setFocusIsolationId(hoveredNodeId);
      }
      if (e.key === 'Escape') {
        workspace.setBlastRadius(null);
        setFocusIsolationId(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [hoveredNodeId, workspace]);

  // --- NEW: DECOUPLED AI LISTENER ---
  useEffect(() => {
    const ws = workspace.wsRef.current;
    if (!ws) return;

    const handleAiMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'LLM_SUMMARY_READY') {
          // Only show the summary if the user is STILL hovering over that exact node
          if (hoveredNodeId === data.node_id) {
            setAiInsight({
              nodeId: data.node_id,
              summary: data.summary
            });
          }
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleAiMessage);
    return () => ws.removeEventListener('message', handleAiMessage);
  }, [workspace.wsRef, hoveredNodeId]);

  // Clear insight when moving mouse away
  useEffect(() => {
    if (!hoveredNodeId) setAiInsight(null);
  }, [hoveredNodeId]);

  // --- MEMOIZED DISPATCHERS ---
  const activeCodeStr = useMemo(() => {
    const fileNode = workspace.nodes.find(n => n.id === workspace.currentFile && n.data?.nodeType === 'file');
    return fileNode ? fileNode.data.code : "";
  }, [workspace.nodes, workspace.currentFile]);

  const handleRunCode = useCallback(async () => {
    workspace.setActiveSessionId('output');
    if (!isCompilerReady || !window.pyodide) return;
    workspace.setTerminalLogs([{ text: `Executing ${workspace.currentFile}...`, isSystem: true }]);
    try {
      window.pyodide.setStdin({ stdin: () => { const lines = stdin.split('\n'); return lines.length > 0 ? lines.shift() : ""; }});
      await window.pyodide.runPythonAsync(activeCodeStr);
      workspace.setTerminalLogs(prev => [...prev, { text: `Process exited with code 0`, isSystem: true }]);
    } catch (error) { workspace.setTerminalLogs(prev => [...prev, { text: error.message, isError: true }]); }
  }, [workspace, isCompilerReady, stdin, activeCodeStr]);

  const handleSwitchFile = useCallback((filename) => { 
    if (filename !== workspace.currentFile) { workspace.setIsFileSyncing(true); workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); }
  }, [workspace]);

  const handleOpenFolder = useCallback(() => { if (workspace.wsRef.current?.readyState === WebSocket.OPEN) workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' })); }, [workspace]);
  const handleCreateItem = useCallback((name, type) => { workspace.setIsFileSyncing(true); workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); }, [workspace]);
  const handleDeleteFile = useCallback((f, e) => { if (e) e.stopPropagation(); if (window.confirm(`Delete ${f}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); }, [workspace]);

  const onDoubleClickNode = useCallback((filePath, line) => {
    if (filePath !== workspace.currentFile) {
      workspace.setIsFileSyncing(true);
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: filePath }));
    }
    setEditorFocusLine(line);
    setCenterView('editor');
  }, [workspace, setCenterView]);

  // STABLE WEBGPU HOVER ROUTER WITH AI DEBOUNCE
  const handleNodeHover = useCallback((isHovering, id) => {
    setHoveredNodeId(isHovering ? id : null);
    
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    
    if (isHovering && id) {
      hoverTimerRef.current = setTimeout(() => {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          const targetNode = workspace.nodes.find(n => n.id === id);
          if (targetNode?.data?.code) {
            console.log("🟢 1. Sending AI Request for:", id);
            workspace.setAiInsight({
              nodeId: id,
              summary: "Analyzing AST logic..." 
            });
            workspace.wsRef.current.send(JSON.stringify({ 
              event: 'REQUEST_LLM_SUMMARY', 
              node_id: id, 
              code: targetNode.data.code 
            }));
          }
        }
      }, 600);
    }
  }, [workspace.wsRef, workspace.nodes]);

  // Clear insight when moving mouse away
  useEffect(() => {
    // if (!hoveredNodeId) workspace.setAiInsight(null);
  }, [hoveredNodeId, workspace]);

  // --- INIT ROUTING ---
  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => setSession(session)); const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session)); return () => subscription.unsubscribe(); }, []);
  useEffect(() => { loadPyodideEngine((msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]), (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])).then(() => setIsCompilerReady(true)); }, [workspace]);

  if (!session || !workspace.isGraphLoaded || !isCompilerReady) {
    return <SplashScreen session={session} isGraphLoaded={workspace.isGraphLoaded} isCompilerReady={isCompilerReady} onLogin={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} />;
  }
  
  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col font-sans text-slate-300 overflow-hidden relative">
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => {setIsCommandPaletteOpen(false); setSearchQuery("");}} searchQuery={searchQuery} setSearchQuery={setSearchQuery} workspace={workspace} onRunCode={handleRunCode} onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSetting={updateSetting} />
      <TopBar onRun={handleRunCode} onOpenFolder={handleOpenFolder} onCreateFile={() => { const name = prompt("Enter new file name:"); if (name) handleCreateItem(name, 'file'); }} onOpenSettings={() => setIsSettingsOpen(true)} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} layout={layout} setLayout={setLayout} />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={() => supabase.auth.signOut()} />
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v12">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]"><Sidebar items={workspace.items} currentFile={workspace.currentFile} absTargetDir={workspace.absTargetDir} gitStatuses={workspace.gitStatuses} onSwitchFile={handleSwitchFile} onCreateItem={handleCreateItem} onDeleteFile={handleDeleteFile} onRunFile={handleRunCode} onRenameItem={(item) => { const n = prompt("New name:", item.path); if(n) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); }} onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} /></Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
            </>
          )}

          <Panel id="main-canvas" order={2} className="flex flex-col bg-[#0a0a0a]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col bg-[#0f0f0f]">
                <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-[#333] z-50">
                  <button onClick={() => setCenterView('spatial')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'spatial' ? 'bg-[#0f0f0f] text-blue-400 border-t-2 border-t-blue-500 font-semibold' : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#141414] hover:text-slate-300'}`}><Network size={14} /> Spatial Map</button>
                  <button onClick={() => setCenterView('editor')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'editor' ? 'bg-[#0a0a0a] text-yellow-400 border-t-2 border-t-yellow-500 font-semibold' : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#141414] hover:text-slate-300'}`}><FileCode2 size={14} /> {workspace.currentFile} {workspace.isFileSyncing && <Loader2 size={12} className="text-yellow-500 animate-spin ml-1" />}</button>
                </div>

                <div className="flex-grow relative overflow-hidden bg-[#050505]">
                  {centerView === 'spatial' ? (
                    <div className="relative w-full h-full">
                      <PixiSpatialEngine 
                        simDataRef={simDataRef}
                        activeRay={activeRay}
                        focusIsolationId={focusIsolationId}
                        blastRadius={workspace.blastRadius}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onNodeHover={handleNodeHover}
                        onNodeDoubleClick={onDoubleClickNode}
                      />
                      
                      {/* --- NEW: FLOATING AI INSIGHT PANEL --- */}
                      {workspace.aiInsight && workspace.aiInsight.nodeId === hoveredNodeId && (
                        <div className="absolute top-4 right-4 w-80 bg-[#141414]/95 border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 z-[100] backdrop-blur-sm pointer-events-none">
                          <div className="bg-[#1e1e1e] border-b border-[#333] px-3 py-2 flex items-center justify-between">
                            <span className="text-[#93c5fd] font-mono text-[10px] font-bold tracking-widest uppercase">AI File Overview</span>
                          </div>
                          <div className="p-4">
                            <span className="text-slate-200 font-sans text-sm leading-relaxed block">
                              {workspace.aiInsight.summary}
                            </span>
                            <span className="text-slate-500 font-mono text-[9px] mt-3 block truncate">
                              Target: {workspace.aiInsight.nodeId.split('::').pop()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <CodeEditor filename={workspace.currentFile} initialCode={activeCodeStr} settings={settings} focusLine={editorFocusLine} onCodeChange={(value) => { if (workspace.wsRef.current?.readyState === WebSocket.OPEN) { workspace.wsRef.current.send(JSON.stringify({ event: 'CODE_EDIT', filename: workspace.currentFile, node_id: workspace.currentFile, new_code: value })); } }} onClearFocus={() => setEditorFocusLine(null)} />
                  )}
                </div>
              </Panel>
              {layout.terminal && ( <><Separator className="h-1 bg-[#2b2d31] hover:bg-blue-500 cursor-row-resize z-50 flex items-center"><div className="h-[1px] w-full bg-[#2b2d31]" /></Separator><Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#141414]"><TerminalPanel logs={workspace.terminalLogs} sessions={workspace.terminalSessions} activeSessionId={workspace.activeSessionId} absTargetDir={workspace.absTargetDir} onSelectSession={workspace.setActiveSessionId} onCreateSession={workspace.createTerminalSession} onCloseSession={workspace.closeTerminalSession} onSendTerminalCommand={workspace.sendTerminalCommand} onKillProcess={workspace.killTerminalProcess} onClearOutput={() => workspace.setTerminalLogs([])} /></Panel></> )}
            </Group>
          </Panel>
          {layout.stdin && ( <><Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator><Panel id="stdin-panel" order={4} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]"><StdinPanel stdin={stdin} setStdin={setStdin} /></Panel></> )}
        </Group>
      </div>
      <StatusBar activeFile={workspace.currentFile} lineCount={(activeCodeStr?.split("\n").length || 0).toString()} wordCount={(activeCodeStr?.trim().split(/\s+/).length || 0).toString()} language={workspace.currentFile?.split('.').pop() === 'js' ? 'JavaScript' : 'Python'} />
      <PerfMonitor />
    </div>
  );
}