// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, Group, Separator } from 'react-resizable-panels'; // FIXED: V4 Imports!
import { FileCode2 } from 'lucide-react';
import { supabase } from './supabaseClient';

// Extracted UI Components
import CodeNode from './components/CodeNode';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SettingsModal from './components/layout/SettingsModal';
import NewItemModal from './components/layout/NewItemModal';
import StatusBar from './components/layout/StatusBar';
import TerminalPanel from './components/layout/TerminalPanel';
import StdinPanel from './components/layout/StdinPanel';
import CommandPalette from './components/layout/CommandPalette';

// Hooks & Services
import { useWorkspace } from './hooks/useWorkspace';
import { loadPyodideEngine } from './services/pyodideService';
import { useSettings } from './hooks/useSettings';

const nodeTypes = { codeNode: CodeNode };

export default function App() {
  const [session, setSession] = useState(null);
  const workspace = useWorkspace(session);
  const { settings, updateSetting } = useSettings();
  
  const [layout, setLayout] = useState({ sidebar: true, terminal: true, stdin: true });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewItemOpen, setIsNewItemOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stdin, setStdin] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  
  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
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

  useEffect(() => {
    if (impactPressed && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      const selectedNode = workspace.nodes.find(n => n.selected);
      if (selectedNode) workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: selectedNode.id }));
    }
  }, [impactPressed, workspace.nodes]);
  
  useEffect(() => { if (escPressed) workspace.setBlastRadius(null); }, [escPressed]);

  const displayNodes = useMemo(() => {
    if (!workspace.blastRadius) return workspace.nodes.map(n => ({ ...n, data: { ...n.data, settings } }));
    return workspace.nodes.map(n => ({
      ...n,
      style: { ...n.style, opacity: workspace.blastRadius.includes(n.id) ? 1 : 0.2, transition: 'all 0.4s ease' },
      data: { ...n.data, isImpacted: workspace.blastRadius.includes(n.id), settings }
    }));
  }, [workspace.nodes, workspace.blastRadius, settings]);

  const handleRunCode = async () => {
    workspace.setActiveSessionId('output');
    if (!isCompilerReady || !window.pyodide) {
      workspace.setTerminalLogs([{ text: "❌ Python Engine is still loading...", isError: true }]);
      return;
    }
    workspace.setTerminalLogs([{ text: `>>> Executing ${workspace.currentFile} in browser sandbox...`, isError: false }]);
    const sortedNodes = [...workspace.nodes].sort((a, b) => a.position.y - b.position.y);
    let fullCodeToExecute = sortedNodes.map(n => n.data.code).join("\n\n");
    try {
      window.pyodide.setStdin({ stdin: () => { const lines = stdin.split('\n'); return lines.length > 0 ? lines.shift() : ""; }});
      await window.pyodide.runPythonAsync(fullCodeToExecute);
      workspace.setTerminalLogs(prev => [...prev, { text: "\n>>> Process finished with exit code 0", isError: false }]);
    } catch (error) { workspace.setTerminalLogs(prev => [...prev, { text: `\n${error.message}`, isError: true }]); }
  };

  const handleSwitchFile = (filename) => { if (filename !== workspace.currentFile) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); }};
  const handleOpenFolder = () => workspace.wsRef.current?.readyState === WebSocket.OPEN && workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' }));
  const handleCreateItem = (name, type) => { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); };
  const handleDeleteFile = (f, e) => { if (e) e.stopPropagation(); if (window.confirm(`Delete ${f}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); };

  if (!session) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="bg-[#141414] border border-slate-800 p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center z-10">
          <img src="/logo.png" alt="Neuron Logo" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <h1 className="text-white font-bold tracking-widest text-2xl mb-1">NEURON</h1>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="w-full bg-white text-black hover:bg-slate-200 flex items-center justify-center gap-3 px-4 py-3 rounded font-bold mt-8 shadow-lg">Continue with Google</button>
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

  const centerHorizontalSize = 1000 - (layout.sidebar ? 200 : 0) - (layout.stdin ? 200 : 0);
  const centerVerticalSize = 1000 - (layout.terminal ? 250 : 0);
  const activeCodeStr = workspace.nodes.map(n => n.data.code || "").join("\n");

  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden">
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => {setIsCommandPaletteOpen(false); setSearchQuery("");}} searchQuery={searchQuery} setSearchQuery={setSearchQuery} workspace={workspace} onRunCode={handleRunCode} onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSetting={updateSetting} />
      <NewItemModal isOpen={isNewItemOpen} onClose={() => setIsNewItemOpen(false)} onCreate={handleCreateItem} />
      
      <TopBar 
        onRun={handleRunCode} onOpenFolder={handleOpenFolder} onCreateFile={() => setIsNewItemOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} layout={layout} setLayout={setLayout} 
      />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={() => supabase.auth.signOut()} />
        
        {/* FIXED: Using Group and orientation="horizontal" for Version 4 */}
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v6">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar items={workspace.items} currentFile={workspace.currentFile} absTargetDir={workspace.absTargetDir} onSwitchFile={handleSwitchFile} onCreateItemClick={() => setIsNewItemOpen(true)} onDeleteFile={handleDeleteFile} onRunFile={handleRunCode} onRenameItem={(item) => { const n = prompt("New name:", item.path); if(n) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); }} onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} />
              </Panel>
              {/* FIXED: Using Separator for Version 4 */}
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
            </>
          )}
          <Panel id="main-canvas" order={2} defaultSize={centerHorizontalSize} minSize={200} className="flex flex-col bg-[#0f0f0f]">
            
            {/* FIXED: Using Group and orientation="vertical" for Version 4 */}
            <Group orientation="vertical" autoSaveId="neuron-vertical-v6">
              <Panel id="canvas-area" order={1} defaultSize={centerVerticalSize} minSize={200} className="flex flex-col relative">
                <div className="absolute top-4 left-4 z-10 bg-[#1e1e1e]/90 border border-[#333] px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm"><FileCode2 size={16} className="text-blue-400" /><span className="text-slate-200">{workspace.currentFile}</span></div>
                <ReactFlow nodes={displayNodes} edges={workspace.edges} onNodesChange={handleNodesChange} onEdgesChange={workspace.onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView colorMode="dark"><Background color="#333" gap={24} size={2} /><Controls className="bg-[#1e1e1e] border-slate-700 fill-white mb-2 ml-2" /><MiniMap maskColor="rgba(0, 0, 0, 0.7)" className="bg-[#1e1e1e] border border-[#333] mb-2 mr-2" /></ReactFlow>
              </Panel>
              {layout.terminal && (
                <>
                  <Separator className="h-2 bg-transparent hover:bg-blue-500 cursor-row-resize z-50 flex items-center"><div className="h-[1px] w-full bg-[#2b2d31]" /></Separator>
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#181818] flex flex-col font-mono text-sm min-h-[150px]">
                    <TerminalPanel logs={workspace.terminalLogs} sessions={workspace.terminalSessions} activeSessionId={workspace.activeSessionId} absTargetDir={workspace.absTargetDir} onSelectSession={(id) => workspace.setActiveSessionId(id)} onCreateSession={workspace.createTerminalSession} onCloseSession={workspace.closeTerminalSession} onSendTerminalCommand={workspace.sendTerminalCommand} onKillProcess={workspace.killTerminalProcess} onClearOutput={() => workspace.setTerminalLogs([])} />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>
          {layout.stdin && (
            <>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 flex justify-center"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
              <Panel id="stdin-panel" order={3} defaultSize={200} minSize={100} maxSize={500}>
                <StdinPanel stdin={stdin} setStdin={setStdin} />
              </Panel>
            </>
          )}
        </Group>
      </div>
      <StatusBar activeFile={workspace.currentFile} lineCount={activeCodeStr ? activeCodeStr.split("\n").length : 0} wordCount={activeCodeStr.trim() ? activeCodeStr.trim().split(/\s+/).length : 0} language="Python" />
    </div>
  );
}