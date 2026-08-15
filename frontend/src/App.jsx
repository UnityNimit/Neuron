// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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

// Layout & Nodes
import ObsidianNode from './components/nodes/ObsidianNode';
import NebulaOverlay from './components/nodes/NebulaOverlay'; 
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

import { ENGINE_CONFIG } from './config/engineConfig';

const nodeTypes = { 
  obsidianNode: ObsidianNode, codeNode: ObsidianNode, 
  spatialNode: ObsidianNode, folderGroup: ObsidianNode, fileGroup: ObsidianNode 
};

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
  
  // --- THE FOCUS-RAY ENGINE STATE ---
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const fPressed = useKeyPress(['f', 'F']);
  const escPressed = useKeyPress('Escape');

  // --- ACTIVATE D3 PHYSICS ENGINE ---
  const { onNodeDragStart, onNodeDrag, onNodeDragStop } = usePhysicsEngine(
    workspace.nodes, workspace.edges, workspace.setNodes, workspace.wsRef, workspace.isGraphLoaded, centerView
  );

  // --- BFS GRAPH TRACING (The Hover Ray) ---
  const activeRay = useMemo(() => {
    if (!hoveredNodeId) return null;
    
    const activeN = new Set([hoveredNodeId]);
    const activeE = new Set();
    const hierarchyAdj = {}; 
    const callAdjForward = {}; 
    const callAdjBackward = {}; 

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

    (hierarchyAdj[hoveredNodeId] || []).forEach(n => { activeN.add(n.id); activeE.add(n.edgeId); });

    const trace = (startId, adjMap) => {
      const queue = [startId];
      const visited = new Set([startId]);
      while(queue.length > 0) {
        const curr = queue.shift();
        (adjMap[curr] || []).forEach(n => {
          if (!visited.has(n.id)) {
            visited.add(n.id); activeN.add(n.id); activeE.add(n.edgeId); queue.push(n.id);
          }
        });
      }
    };

    trace(hoveredNodeId, callAdjForward);  
    trace(hoveredNodeId, callAdjBackward); 
    return { activeN, activeE };
  }, [hoveredNodeId, workspace.edges]);

  // --- INITIALIZATION & KEYBINDS ---
  useEffect(() => {
    const handleKeyDown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsCommandPaletteOpen(true); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  }, []);

  // --- GRAPH INTERACTION HANDLERS ---
  const handleNodesChange = useCallback((changes) => workspace.onNodesChange(changes), [workspace]);
  const onConnect = useCallback((params) => workspace.setEdges((eds) => addEdge({ ...params, type: 'straight', style: { stroke: '#444', strokeWidth: 1 } }, eds)), [workspace]);

  const onDoubleClickNode = useCallback((filePath, line) => {
    if (filePath !== workspace.currentFile) {
      workspace.setIsFileSyncing(true);
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: filePath }));
    }
    setEditorFocusLine(line);
    setCenterView('editor');
  }, [workspace, setCenterView]);

  useEffect(() => {
    if (impactPressed && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      const selectedNode = workspace.nodes.find(n => n.selected);
      if (selectedNode) workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: selectedNode.id }));
    }
  }, [impactPressed, workspace.nodes]);
  
  useEffect(() => {
    if (fPressed) {
      const selectedNode = workspace.nodes.find(n => n.selected);
      if (selectedNode) setFocusIsolationId(selectedNode.id);
    }
  }, [fPressed, workspace.nodes]);

  useEffect(() => { if (escPressed) { workspace.setBlastRadius(null); setFocusIsolationId(null); } }, [escPressed]);

  // --- DYNAMIC NODE RENDERING (LOD + Z-INDEX OVERRIDE) ---
  const displayNodes = useMemo(() => {
    let isolatedNodes = new Set();
    if (focusIsolationId) {
      isolatedNodes.add(focusIsolationId);
      workspace.edges.forEach(e => {
        if (e.source === focusIsolationId) isolatedNodes.add(e.target);
        if (e.target === focusIsolationId) isolatedNodes.add(e.source);
      });
    }

    return workspace.nodes.map(node => {
      const isImpacted = workspace.blastRadius?.includes(node.id);
      const isFocused = focusIsolationId === node.id;
      const isHoveredHighlight = activeRay?.activeN.has(node.id);
      
      const isIsolatedHidden = focusIsolationId && !isolatedNodes.has(node.id);
      const isDimmedByRay = activeRay && !isHoveredHighlight;

      let opacity = 1;
      let zIndex = 0; // Default elevation
      
      if (isIsolatedHidden) opacity = 0.05;
      else if (isDimmedByRay) opacity = 0.15; 
      else if (workspace.blastRadius && !isImpacted) opacity = 0.2;

      // Physically elevate the active execution path so it pops over the galaxy!
      if (isHoveredHighlight || isFocused) zIndex = 1000;

      return {
        ...node,
        style: { ...node.style, opacity, zIndex, transition: 'opacity 0.3s ease' },
        data: { ...node.data, isImpacted, isFocused, isHoveredHighlight, onDoubleClickNode, settings }
      };
    });
  }, [workspace.nodes, workspace.edges, workspace.blastRadius, focusIsolationId, activeRay, settings, onDoubleClickNode]);

  // --- DYNAMIC EDGE RENDERING (NEON ELECTRICITY) ---
  const displayEdges = useMemo(() => {
    return workspace.edges.map(e => {
      const isHoveredHighlight = activeRay?.activeE.has(e.id);
      const isDimmedByRay = activeRay && !isHoveredHighlight;

      const { THEME } = ENGINE_CONFIG;

      let strokeColor = e.type === 'call' ? THEME.edges.call : THEME.edges.hierarchy; 
      let strokeWidth = e.type === 'call' ? 1.5 : 1;
      let opacity = THEME.edges.opacityNormal;
      let animated = false;
      let filter = 'none'; 
      let zIndex = 0;

      if (isHoveredHighlight) {
        strokeColor = e.type === 'call' ? THEME.edges.callGlow : THEME.edges.hierarchyGlow; 
        strokeWidth = 2.5;
        opacity = 1;
        animated = e.type === 'call'; 
        filter = `drop-shadow(0 0 8px ${strokeColor})`; 
        zIndex = 1000;
      } else if (isDimmedByRay) {
        opacity = THEME.edges.opacityDimmed; 
      }

      return {
        ...e,
        type: 'straight',
        animated,
        zIndex,
        style: { 
          stroke: strokeColor, 
          strokeWidth, 
          opacity, 
          filter,
          transition: 'stroke 0.3s ease, opacity 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease' 
        }
      };
    });
  }, [workspace.edges, activeRay]);

  const getFullFileCode = () => {
    const fileNode = workspace.nodes.find(n => n.id === workspace.currentFile && n.data?.nodeType === 'file');
    return fileNode ? fileNode.data.code : "";
  };
  const activeCodeStr = getFullFileCode();

  const handleRunCode = async () => {
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
  };

  const handleSwitchFile = (filename) => { 
    if (filename !== workspace.currentFile) { 
      workspace.setIsFileSyncing(true); 
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); 
    }
  };

  const handleOpenFolder = () => workspace.wsRef.current?.readyState === WebSocket.OPEN && workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' }));
  const handleCreateItem = (name, type) => { workspace.setIsFileSyncing(true); workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); };
  const handleDeleteFile = (f, e) => { if (e) e.stopPropagation(); if (window.confirm(`Delete ${f}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); };

  // --- THE PERFECTED LOADING ROUTER ---
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
  
  const lineCount = activeCodeStr ? activeCodeStr.split("\n").length : 0;
  const wordCount = activeCodeStr.trim() ? activeCodeStr.trim().split(/\s+/).length : 0;

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
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar items={workspace.items} currentFile={workspace.currentFile} absTargetDir={workspace.absTargetDir} gitStatuses={workspace.gitStatuses} onSwitchFile={handleSwitchFile} onCreateItem={handleCreateItem} onDeleteFile={handleDeleteFile} onRunFile={handleRunCode} onRenameItem={(item) => { const n = prompt("New name:", item.path); if(n) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); }} onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} />
              </Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
            </>
          )}

          <Panel id="main-canvas" order={2} className="flex flex-col bg-[#0a0a0a]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col bg-[#0a0a0a]">
                
                <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-[#333]">
                  <button onClick={() => setCenterView('spatial')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'spatial' ? 'bg-[#0a0a0a] text-blue-400 border-t-2 border-t-blue-500 font-semibold' : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#141414] hover:text-slate-300'}`}>
                    <Network size={14} /> Spatial Map
                  </button>
                  <button onClick={() => setCenterView('editor')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'editor' ? 'bg-[#0a0a0a] text-yellow-400 border-t-2 border-t-yellow-500 font-semibold' : 'bg-[#1e1e1e] text-slate-400 hover:bg-[#141414] hover:text-slate-300'}`}>
                    <FileCode2 size={14} /> {workspace.currentFile} {workspace.isFileSyncing && <Loader2 size={12} className="text-yellow-500 animate-spin ml-1" />}
                  </button>
                </div>

                <div className="flex-grow relative">
                  {centerView === 'spatial' ? (
                    <ReactFlow 
                      nodes={displayNodes} 
                      edges={displayEdges} 
                      onNodesChange={handleNodesChange} 
                      onNodeDragStart={onNodeDragStart}
                      onNodeDrag={onNodeDrag}          
                      onNodeDragStop={onNodeDragStop}  
                      onEdgesChange={workspace.onEdgesChange} 
                      onConnect={onConnect} 
                      nodeTypes={nodeTypes} 
                      onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
                      onNodeMouseLeave={() => setHoveredNodeId(null)}
                      fitView 
                      fitViewOptions={{ padding: 0.2, maxZoom: 1 }} 
                      minZoom={0.01} maxZoom={5}    
                      elevateNodesOnSelect={true} nodesDraggable={true} colorMode="dark"
                      proOptions={{ hideAttribution: true }}
                    >
                      <NebulaOverlay />
                      <Background color="#1a1a1a" gap={30} size={1} />
                      <Controls className="bg-[#141414] border-slate-700 fill-white mb-2 ml-2 shadow-lg" />
                      <MiniMap 
                        maskColor="rgba(0, 0, 0, 0.85)" 
                        className="bg-[#0a0a0a] border border-[#333] mb-2 mr-2 shadow-xl" 
                        nodeColor={(n) => {
                          if (n.data?.risk === 'high') return '#ef4444';
                          if (n.data?.isImpacted) return '#fb923c';
                          if (n.data?.nodeType === 'folder') return '#4b5563';
                          if (n.data?.nodeType === 'file') return '#3b82f6';
                          return '#8b5cf6';
                        }}
                      />
                    </ReactFlow>
                  ) : (
                    <CodeEditor filename={workspace.currentFile} initialCode={activeCodeStr} settings={settings} focusLine={editorFocusLine} onCodeChange={(value) => { if (workspace.wsRef.current?.readyState === WebSocket.OPEN) { workspace.wsRef.current.send(JSON.stringify({ event: 'CODE_EDIT', filename: workspace.currentFile, node_id: workspace.currentFile, new_code: value })); } }} onClearFocus={() => setEditorFocusLine(null)} />
                  )}
                </div>
              </Panel>
              
              {layout.terminal && (
                <>
                  <Separator className="h-1 bg-[#2b2d31] hover:bg-blue-500 cursor-row-resize z-50 flex items-center"><div className="h-[1px] w-full bg-[#2b2d31]" /></Separator>
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#141414]">
                    <TerminalPanel logs={workspace.terminalLogs} sessions={workspace.terminalSessions} activeSessionId={workspace.activeSessionId} absTargetDir={workspace.absTargetDir} onSelectSession={workspace.setActiveSessionId} onCreateSession={workspace.createTerminalSession} onCloseSession={workspace.closeTerminalSession} onSendTerminalCommand={workspace.sendTerminalCommand} onKillProcess={workspace.killTerminalProcess} onClearOutput={() => workspace.setTerminalLogs([])} />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {layout.stdin && (
            <>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
              <Panel id="stdin-panel" order={4} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <StdinPanel stdin={stdin} setStdin={setStdin} />
              </Panel>
            </>
          )}
        </Group>
      </div>
      <StatusBar activeFile={workspace.currentFile} lineCount={lineCount.toString()} wordCount={wordCount.toString()} language={workspace.currentFile?.split('.').pop() === 'js' ? 'JavaScript' : 'Python'} />
      
      {/* ADDED PERF MONITOR */}
      <PerfMonitor />
    </div>
  );
}