// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, TerminalSquare, TextCursorInput } from 'lucide-react';

// Views
import CodeNode from './components/CodeNode';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SettingsModal from './components/layout/SettingsModal';

// Controllers & Services
import { useWorkspace } from './hooks/useWorkspace';
import { loadPyodideEngine } from './services/pyodideService';
import { useSettings } from './hooks/useSettings';

const nodeTypes = { codeNode: CodeNode };

export default function App() {
  const workspace = useWorkspace();
  const { settings, updateSetting } = useSettings(); // Load our settings controller
  
  const [layout, setLayout] = useState({ sidebar: true, terminal: true, stdin: true });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Modal state
  const [stdin, setStdin] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  const terminalEndRef = React.useRef(null);
  
  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const escPressed = useKeyPress('Escape');

  useEffect(() => {
    loadPyodideEngine(
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]),
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])
    ).then(() => setIsCompilerReady(true));
  }, []);

  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [workspace.terminalLogs]);

  const handleNodesChange = useCallback((changes) => {
    workspace.onNodesChange(changes);
    const positionChange = changes.find((c) => c.type === 'position' && c.dragging);
    if (positionChange && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({ event: 'NODE_MOVE', node_id: positionChange.id, position: positionChange.position }));
    }
  }, [workspace]);

  const onConnect = useCallback((params) => workspace.setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [workspace]);

  useEffect(() => {
    if (impactPressed) {
      const selectedNode = workspace.nodes.find(n => n.selected);
      if (selectedNode && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
        workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: selectedNode.id }));
      }
    }
  }, [impactPressed, workspace.nodes]);
  
  useEffect(() => { if (escPressed) workspace.setBlastRadius(null); }, [escPressed]);

  // INJECT SETTINGS INTO NODES
  const displayNodes = useMemo(() => {
    if (!workspace.blastRadius) {
      return workspace.nodes.map(node => ({ ...node, data: { ...node.data, settings } }));
    }
    return workspace.nodes.map(node => ({
      ...node,
      style: { ...node.style, opacity: workspace.blastRadius.includes(node.id) ? 1 : 0.2, transition: 'all 0.4s ease' },
      data: { ...node.data, isImpacted: workspace.blastRadius.includes(node.id), settings }
    }));
  }, [workspace.nodes, workspace.blastRadius, settings]);

  const handleRunCode = () => workspace.wsRef.current?.readyState === WebSocket.OPEN && workspace.wsRef.current.send(JSON.stringify({ event: 'RUN_CODE', stdin }));
  const handleSwitchFile = (filename) => { if (filename !== workspace.currentFile) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); }};
  const handleCreateFile = () => { const filename = prompt("Enter new file name:"); if (filename) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_FILE', filename })); }};
  const handleDeleteFile = (filename, e) => { e.stopPropagation(); if (window.confirm(`Delete ${filename}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename })); };

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

  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden">
      
      {/* THE SETTINGS MODAL */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        updateSetting={updateSetting} 
      />

      <TopBar onRun={handleRunCode} layout={layout} setLayout={setLayout} />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        {/* Pass the toggle function to the Activity Bar */}
        <ActivityBar layout={layout} setLayout={setLayout} onOpenSettings={() => setIsSettingsOpen(true)} />
        
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v3">
          {layout.sidebar && (
            <>
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar files={workspace.files} currentFile={workspace.currentFile} onSwitchFile={handleSwitchFile} onCreateFile={handleCreateFile} onDeleteFile={handleDeleteFile} />
              </Panel>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center z-50">
                <div className="w-[1px] h-full bg-[#2b2d31]" />
              </Separator>
            </>
          )}
          
          <Panel id="main-canvas" order={2} defaultSize={centerHorizontalSize} minSize={200} className="flex flex-col bg-[#0f0f0f]">
            <Group orientation="vertical" autoSaveId="neuron-vertical-v3">
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
                  <Separator className="h-2 bg-transparent hover:bg-blue-500 transition-colors cursor-row-resize relative flex items-center justify-center z-50">
                    <div className="h-[1px] w-full bg-[#2b2d31]" />
                  </Separator>
                  <Panel id="terminal-area" order={2} defaultSize={200} minSize={15} maxSize={300} className="bg-[#181818] flex flex-col font-mono text-sm min-h-[150px]">
                    <div className="h-8 shrink-0 bg-[#1e1e1e] border-b border-[#2b2d31] flex items-center px-4 gap-2 text-slate-400 text-xs">
                      <TerminalSquare size={14} /> TERMINAL
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto">
                      {workspace.terminalLogs.map((log, index) => (
                        <div key={index} className={`${log.isError ? 'text-red-400 font-bold' : 'text-green-400'} mb-1 leading-relaxed whitespace-pre-wrap`}>
                          <span className="text-slate-600 mr-2">➜</span> {log.text}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {layout.stdin && (
            <>
              <Separator className="w-2 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center z-50">
                <div className="w-[1px] h-full bg-[#2b2d31]" />
              </Separator>
              <Panel id="stdin-panel" order={3} defaultSize={200} minSize={100} maxSize={500} className="bg-[#181818] flex flex-col">
                <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center px-4 border-b border-[#2b2d31] gap-2 text-slate-400 text-xs uppercase tracking-widest font-semibold">
                  <TextCursorInput size={14} /> Input
                </div>
                <div className="flex-grow p-2">
                  <textarea 
                    value={stdin} 
                    onChange={(e) => setStdin(e.target.value)} 
                    placeholder="Test cases here..." 
                    className="w-full h-full bg-[#141414] text-slate-300 font-mono text-sm p-3 border border-[#333] rounded focus:outline-none focus:border-blue-500 transition-colors resize-none whitespace-pre-wrap break-normal" 
                  />
                </div>
              </Panel>
            </>
          )}

        </Group>
      </div>
    </div>
  );
}