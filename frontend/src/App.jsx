// src/App.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, TextCursorInput } from 'lucide-react';

// Views
import CodeNode from './components/CodeNode';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SettingsModal from './components/layout/SettingsModal';
import NewItemModal from './components/layout/NewItemModal';
import StatusBar from './components/layout/StatusBar';
import TerminalPanel from './components/layout/TerminalPanel';

// Controllers
import { useWorkspace } from './hooks/useWorkspace';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useCompiler } from './hooks/useCompiler';

const nodeTypes = { codeNode: CodeNode };

export default function App() {
  // 1. Initialize Controllers
  const { session, login, logout } = useAuth();
  const workspace = useWorkspace(session);
  const { isCompilerReady } = useCompiler(workspace);
  const { settings, updateSetting } = useSettings();
  
  // 2. Local View State
  const [layout, setLayout] = useState({ sidebar: true, terminal: true, stdin: true });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewItemOpen, setIsNewItemOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  
  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const escPressed = useKeyPress('Escape');

  // 3. Actions & Graph State
  const handleNodesChange = useCallback((changes) => {
    workspace.onNodesChange(changes);
    const positionChange = changes.find((c) => c.type === 'position' && c.dragging);
    if (positionChange && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({ event: 'NODE_MOVE', node_id: positionChange.id, position: positionChange.position }));
    }
  }, [workspace]);

  const onConnect = useCallback((params) => workspace.setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [workspace]);

  React.useEffect(() => {
    if (impactPressed) {
      const selectedNode = workspace.nodes.find(n => n.selected);
      if (selectedNode && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
        workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: selectedNode.id }));
      }
    }
  }, [impactPressed, workspace.nodes]);
  
  React.useEffect(() => { if (escPressed) workspace.setBlastRadius(null); }, [escPressed]);

  const displayNodes = useMemo(() => {
    if (!workspace.blastRadius) return workspace.nodes.map(node => ({ ...node, data: { ...node.data, settings } }));
    return workspace.nodes.map(node => ({
      ...node,
      style: { ...node.style, opacity: workspace.blastRadius.includes(node.id) ? 1 : 0.2, transition: 'all 0.4s ease' },
      data: { ...node.data, isImpacted: workspace.blastRadius.includes(node.id), settings }
    }));
  }, [workspace.nodes, workspace.blastRadius, settings]);

  const handleRunCode = () => {
    workspace.setActiveSessionId('output');
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) workspace.wsRef.current.send(JSON.stringify({ event: 'RUN_CODE', stdin }));
  };

  const handleCreateItem = (itemName, itemType) => {
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.setIsGraphLoaded(false);
      workspace.wsRef.current.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: itemName, item_type: itemType }));
    }
  };

  // 4. View Rendering
  if (!session) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="bg-[#141414] border border-slate-800 p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center max-w-sm w-full relative z-10">
          <img src="/logo.png" alt="Neuron Logo" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <h1 className="text-white font-bold tracking-widest text-2xl mb-1">NEURON</h1>
          <button onClick={login} className="w-full bg-white text-black hover:bg-slate-200 flex items-center justify-center gap-3 px-4 py-3 rounded font-bold mt-8 shadow-lg">
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  if (!workspace.isGraphLoaded || !isCompilerReady) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans">
        <img src="/logo.png" alt="Neuron Logo" className="w-24 h-24 mb-6 animate-pulse" />
        <h1 className="text-white font-bold tracking-[0.2em] text-2xl mb-2">NEURON</h1>
        <div className="w-64 h-1 bg-slate-800 rounded-full mt-8 overflow-hidden"><div className="h-full bg-blue-500 w-full animate-pulse rounded-full"></div></div>
      </div>
    );
  }

  const centerHorizontalSize = 1000 - (layout.sidebar ? 200 : 0) - (layout.stdin ? 200 : 0);
  const centerVerticalSize = 1000 - (layout.terminal ? 200 : 0);
  const activeCodeStr = workspace.nodes.map(n => n.data.code || "").join("\n");
  const lineCount = activeCodeStr ? activeCodeStr.split("\n").length : 0;
  const wordCount = activeCodeStr.trim() ? activeCodeStr.trim().split(/\s+/).length : 0;
  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSetting={updateSetting} />
      <NewItemModal isOpen={isNewItemOpen} onClose={() => setIsNewItemOpen(false)} onCreate={handleCreateItem} />
      
      <TopBar 
        onRun={handleRunCode} 
        onOpenFolder={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' }))} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        layout={layout} setLayout={setLayout} 
      />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} onLogout={logout} />
        
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v4">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar 
                  items={workspace.items} currentFile={workspace.currentFile} absTargetDir={workspace.absTargetDir}
                  onSwitchFile={(f) => { if(f !== workspace.currentFile) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: f })); }}} 
                  onCreateFile={() => setIsNewItemOpen(true)} 
                  onDeleteFile={(f, e) => { if(e) e.stopPropagation(); if(window.confirm(`Delete ${f}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); }} 
                  onRenameItem={(item) => { const n = prompt("New name:", item.path); if(n && n !== item.path) workspace.wsRef.current?.send(JSON.stringify({ event: 'RENAME_ITEM', old_path: item.path, new_path: n })); }}
                  onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))}
                  onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))}
                  onRunFile={handleRunCode}
                />
              </Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center z-50"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
            </>
          )}
          
          <Panel id="main-canvas" order={2} defaultSize={centerHorizontalSize} minSize={200} className="flex flex-col bg-[#0f0f0f]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v4">
              <Panel id="canvas-area" order={1} defaultSize={centerVerticalSize} minSize={200} className="flex flex-col relative">
                <div className="absolute top-4 left-4 z-10 bg-[#1e1e1e]/90 backdrop-blur border border-[#333] px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm shadow-xl">
                  <FileCode2 size={16} className="text-blue-400" />
                  <span className="text-slate-200 font-medium">{workspace.currentFile}</span>
                </div>
                <ReactFlow nodes={displayNodes} edges={workspace.edges} onNodesChange={handleNodesChange} onEdgesChange={workspace.onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} colorMode="dark">
                  <Background color="#333" gap={24} size={2} />
                  <Controls className="bg-[#1e1e1e] border-slate-700 fill-white mb-2 ml-2 shadow-lg" />
                  <MiniMap nodeColor={(n) => (n.data?.isImpacted ? '#f97316' : n.data?.risk === 'high' ? '#ef4444' : '#3b82f6')} maskColor="rgba(0, 0, 0, 0.7)" className="bg-[#1e1e1e] border border-[#333] mb-2 mr-2 shadow-lg" />
                </ReactFlow>
              </Panel>
              
              {layout.terminal && (
                <>
                  <Separator className="h-2 bg-transparent hover:bg-blue-500 transition-colors cursor-row-resize relative flex items-center justify-center z-50"><div className="h-[1px] w-full bg-[#2b2d31]" /></Separator>
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#181818] flex flex-col font-mono text-sm min-h-[150px]">
                    <TerminalPanel 
                      logs={workspace.terminalLogs} sessions={workspace.terminalSessions} activeSessionId={workspace.activeSessionId}
                      absTargetDir={workspace.absTargetDir} onSelectSession={(id) => workspace.setActiveSessionId(id)}
                      onCreateSession={workspace.createTerminalSession} onCloseSession={workspace.closeTerminalSession}
                      onSendTerminalCommand={workspace.sendTerminalCommand} onKillProcess={workspace.killTerminalProcess}
                      onClearOutput={() => workspace.setTerminalLogs([])}
                    />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {layout.stdin && (
            <>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center z-50"><div className="w-[1px] h-full bg-[#2b2d31]" /></Separator>
              <Panel id="stdin-panel" order={3} defaultSize={200} minSize={100} maxSize={500} className="bg-[#181818] flex flex-col">
                <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center px-4 border-b border-[#2b2d31] gap-2 text-slate-400 text-xs uppercase tracking-widest font-semibold">
                  <TextCursorInput size={14} /> Input
                </div>
                <div className="flex-grow p-2">
                  <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Test cases here..." className="w-full h-full bg-[#141414] text-slate-300 font-mono text-sm p-3 border border-[#333] rounded focus:outline-none focus:border-blue-500 transition-colors resize-none whitespace-pre-wrap break-normal" />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
      <StatusBar activeFile={workspace.currentFile} lineCount={lineCount.toString()} wordCount={wordCount.toString()} language={workspace.currentFile?.split('.').pop() === 'py' ? 'Python' : 'Plain Text'} />
    </div>
  );
}