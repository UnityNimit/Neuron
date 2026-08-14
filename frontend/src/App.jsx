// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

// Authentication
import { supabase } from './supabaseClient';

// Views & Nodes
import CodeNode from './components/CodeNode';
import { FolderNode, FileNode } from './components/layout/GroupNodes';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SettingsModal from './components/layout/SettingsModal';
import StatusBar from './components/layout/StatusBar';
import TerminalPanel from './components/layout/TerminalPanel';
import StdinPanel from './components/layout/StdinPanel';
import CommandPalette from './components/layout/CommandPalette';

// Controllers
import { useWorkspace } from './hooks/useWorkspace';
import { loadPyodideEngine } from './services/pyodideService';
import { useSettings } from './hooks/useSettings';
import { usePersistentState } from './hooks/usePersistentState'; // NEW MASTER STATE

// Our new flawless debounced Code Editor wrapper!
import CodeEditor from './components/layout/CodeEditor';

// Mapped both 'codeNode' and the new 'spatialNode' to our sleek CodeNode component!
const nodeTypes = { codeNode: CodeNode, spatialNode: CodeNode, folderGroup: FolderNode, fileGroup: FileNode };

export default function App() {
  const [session, setSession] = useState(null);
  const workspace = useWorkspace(session);
  const { settings, updateSetting } = useSettings();
  
  // Persistent IDE State completely takes over!
  const { layout, setLayout, centerView, setCenterView, stdin, setStdin } = usePersistentState();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  
  const [editorFocusLine, setEditorFocusLine] = useState(null);
  const fullEditorTimerRef = useRef(null);
  const [focusIsolationId, setFocusIsolationId] = useState(null);

  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const fPressed = useKeyPress(['f', 'F']);
  const escPressed = useKeyPress('Escape');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsCommandPaletteOpen(true); }
    };
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

  const handleNodesChange = useCallback((changes) => {
    workspace.onNodesChange(changes);
    const posChange = changes.find((c) => c.type === 'position' && c.dragging);
    if (posChange && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({ event: 'NODE_MOVE', node_id: posChange.id, position: posChange.position }));
    }
  }, [workspace]);

  const onConnect = useCallback((params) => workspace.setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [workspace]);

  // DOUBLE CLICK INSTANTLY OPENS THE FULL SCREEN EDITOR
  const onDoubleClickNode = useCallback((filePath, line) => {
    if (filePath !== workspace.currentFile) {
      workspace.setIsFileSyncing(true); // SUBTLE LOADING
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
      // Dim nodes that aren't isolated
      const isIsolatedHidden = focusIsolationId && !isolatedNodes.has(node.id) && (node.type === 'codeNode' || node.type === 'spatialNode');

      return {
        ...node,
        style: { ...node.style, opacity: isIsolatedHidden ? 0.1 : (workspace.blastRadius && !isImpacted ? 0.2 : 1), transition: 'all 0.4s ease' },
        data: { ...node.data, isImpacted, isFocused, onDoubleClickNode, settings }
      };
    });
  }, [workspace.nodes, workspace.edges, workspace.blastRadius, focusIsolationId, settings, onDoubleClickNode]);

  // FIX: Look for 'fileGroup' to get the entire file's code correctly!
  const getFullFileCode = () => {
    const fileNode = workspace.nodes.find(n => n.id === workspace.currentFile && n.type === 'fileGroup');
    return fileNode ? fileNode.data.code : "";
  };
  
  const activeCodeStr = getFullFileCode();

  const handleRunCode = async () => {
    workspace.setActiveSessionId('output');
    if (!isCompilerReady || !window.pyodide) return;
    
    // Completely minimalist, no emojis, no ugly arrows
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

  if (!session) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="bg-[#141414] border border-slate-800 p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center max-w-sm w-full relative z-10">
          <img src="/logo.png" alt="Neuron Logo" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <h1 className="text-white font-bold tracking-widest text-2xl mb-1">NEURON</h1>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })} className="w-full bg-white text-black hover:bg-slate-200 flex items-center justify-center gap-3 px-4 py-3 rounded font-bold mt-8 shadow-lg">Continue with Google</button>
        </div>
      </div>
    );
  }

  if (!workspace.isGraphLoaded || !isCompilerReady) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans">
        <img src="/logo.png" alt="Neuron Logo" className="w-24 h-24 mb-6 animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
        <h1 className="text-white font-bold tracking-[0.2em] text-2xl mb-2">NEURON</h1>
        <div className="flex flex-col gap-3 text-xs font-mono bg-[#141414] p-5 rounded-xl border border-slate-800 min-w-[300px] shadow-2xl mt-6">
          <div className="flex items-center justify-between"><span className="text-slate-400">Python Backend:</span><span className={workspace.isGraphLoaded ? "text-green-400 font-bold" : "text-yellow-500 animate-pulse"}>{workspace.isGraphLoaded ? "✓ Ready" : "Connecting..."}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">WASM Compiler:</span><span className={isCompilerReady ? "text-green-400 font-bold" : "text-yellow-500 animate-pulse"}>{isCompilerReady ? "✓ Ready" : "Downloading..."}</span></div>
        </div>
      </div>
    );
  }
  
  // Calculate text stats for the bottom Status Bar
  const lineCount = activeCodeStr ? activeCodeStr.split("\n").length : 0;
  const wordCount = activeCodeStr.trim() ? activeCodeStr.trim().split(/\s+/).length : 0;

  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden relative">
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => {setIsCommandPaletteOpen(false); setSearchQuery("");}} searchQuery={searchQuery} setSearchQuery={setSearchQuery} workspace={workspace} onRunCode={handleRunCode} onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSetting={updateSetting} />
      
      {/* RESTORED TOPBAR */}
      <TopBar 
        onRun={handleRunCode} 
        onOpenFolder={handleOpenFolder} 
        onCreateFile={() => {
          const name = prompt("Enter new file name (e.g., styles.css):");
          if (name) handleCreateItem(name, 'file');
        }} 
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
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                {/* RESTORED AND WIRED SIDEBAR WITH NEW INLINE CREATE SYSTEM */}
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
                    const n = prompt("New name:", item.path); 
                    if(n) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); 
                  }} 
                  onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} 
                  onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} 
                  onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} 
                />
              </Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
            </>
          )}

          {/* MAIN CENTER PANEL (SPATIAL OR EDITOR) */}
          <Panel id="main-canvas" order={2} className="flex flex-col bg-[#0f0f0f]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col bg-[#1e1e1e]">
                
                {/* VS CODE STYLE TAB BAR */}
                <div className="h-9 shrink-0 bg-[#252526] flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b border-[#333]">
                  <button onClick={() => setCenterView('spatial')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'spatial' ? 'bg-[#1e1e1e] text-blue-400 border-t-2 border-t-blue-500 font-semibold' : 'bg-[#2d2d2d] text-slate-400 hover:bg-[#1e1e1e] hover:text-slate-300'}`}>
                    <Network size={14} /> Spatial Map
                  </button>
                  <button onClick={() => setCenterView('editor')} className={`h-full px-4 flex items-center gap-2 text-xs border-r border-[#333] transition-colors ${centerView === 'editor' ? 'bg-[#1e1e1e] text-yellow-400 border-t-2 border-t-yellow-500 font-semibold' : 'bg-[#2d2d2d] text-slate-400 hover:bg-[#1e1e1e] hover:text-slate-300'}`}>
                    <FileCode2 size={14} /> 
                    {workspace.currentFile}
                    {workspace.isFileSyncing && <Loader2 size={12} className="text-yellow-500 animate-spin ml-1" />}
                  </button>
                </div>

                <div className="flex-grow relative">
                  {centerView === 'spatial' ? (
                    <ReactFlow nodes={displayNodes} edges={workspace.edges} onNodesChange={handleNodesChange} onEdgesChange={workspace.onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} colorMode="dark">
                      <Background color="#333" gap={24} size={2} />
                      <Controls className="bg-[#1e1e1e] border-slate-700 fill-white mb-2 ml-2 shadow-lg" />
                      <MiniMap maskColor="rgba(0, 0, 0, 0.7)" className="bg-[#1e1e1e] border border-[#333] mb-2 mr-2 shadow-lg" />
                    </ReactFlow>
                  ) : (
                    // CRITICAL FIX: Use our debounced wrapper component instead of raw Editor!
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
                  <Separator className="h-1 bg-[#2b2d31] hover:bg-blue-500 cursor-row-resize z-50 flex items-center"><div className="h-[1px] w-full bg-[#2b2d31]" /></Separator>
                  {/* EXACT PRESERVED SIZES */}
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#181818]">
                    <TerminalPanel logs={workspace.terminalLogs} sessions={workspace.terminalSessions} activeSessionId={workspace.activeSessionId} absTargetDir={workspace.absTargetDir} onSelectSession={workspace.setActiveSessionId} onCreateSession={workspace.createTerminalSession} onCloseSession={workspace.closeTerminalSession} onSendTerminalCommand={workspace.sendTerminalCommand} onKillProcess={workspace.killTerminalProcess} onClearOutput={() => workspace.setTerminalLogs([])} />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {layout.stdin && (
            <>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
              {/* EXACT PRESERVED SIZES */}
              <Panel id="stdin-panel" order={4} defaultSize={200} minSize={100} maxSize={500} className="bg-[#181818]">
                <StdinPanel stdin={stdin} setStdin={setStdin} />
              </Panel>
            </>
          )}
        </Group>
      </div>
      <StatusBar activeFile={workspace.currentFile} lineCount={lineCount.toString()} wordCount={wordCount.toString()} language={workspace.currentFile?.split('.').pop() === 'js' ? 'JavaScript' : 'Python'} />
    </div>
  );
}