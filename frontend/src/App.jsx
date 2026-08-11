// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useKeyPress } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, TerminalSquare, TextCursorInput } from 'lucide-react';

// Authentication
import { supabase } from './supabaseClient';

// Views (Components)
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
  // --- 1. AUTHENTICATION STATE ---
  const [session, setSession] = useState(null);

  // --- 2. CONTROLLER HOOKS ---
  const workspace = useWorkspace();
  const { settings, updateSetting } = useSettings();
  
  // --- 3. UI LAYOUT STATES ---
  const [layout, setLayout] = useState({ sidebar: true, terminal: true, stdin: true });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  const terminalEndRef = React.useRef(null);
  
  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const escPressed = useKeyPress('Escape');

  // Supabase Auth Session Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialize WebAssembly Pyodide Engine
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

  // Inject user's custom settings into nodes
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

  const handleRunCode = async () => {
    if (!isCompilerReady || !window.pyodide) {
      workspace.setTerminalLogs([{ text: "❌ Python Engine is still loading...", isError: true }]);
      return;
    }

    workspace.setTerminalLogs([{ text: `>>> Executing ${workspace.currentFile} in browser sandbox...`, isError: false }]);

    const sortedNodes = [...workspace.nodes].sort((a, b) => a.position.y - b.position.y);
    let fullCodeToExecute = sortedNodes.map(n => n.data.code).join("\n\n");

    try {
      window.pyodide.setStdin({
        stdin: () => {
          const lines = stdin.split('\n');
          return lines.length > 0 ? lines.shift() : "";
        }
      });
      await window.pyodide.runPythonAsync(fullCodeToExecute);
      workspace.setTerminalLogs(prev => [...prev, { text: "\n>>> Process finished with exit code 0", isError: false }]);
    } catch (error) {
      workspace.setTerminalLogs(prev => [...prev, { text: `\n${error.message}`, isError: true }]);
    }
  };

  const handleSwitchFile = (filename) => { if (filename !== workspace.currentFile) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); }};
  const handleCreateFile = () => { const filename = prompt("Enter new file name:"); if (filename) { workspace.setIsGraphLoaded(false); workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_FILE', filename })); }};
  const handleDeleteFile = (filename, e) => { e.stopPropagation(); if (window.confirm(`Delete ${filename}?`)) workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename })); };

  // --- 1. GOOGLE AUTH LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="bg-[#141414] border border-slate-800 p-10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center max-w-sm w-full relative z-10">
          <img src="/logo.png" alt="Neuron Logo" className="w-16 h-16 mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <h1 className="text-white font-bold tracking-widest text-2xl mb-1">NEURON</h1>
          <p className="text-slate-500 text-xs tracking-wide uppercase mb-8 text-center">The Spatial IDE</p>
          <button 
            onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
            className="w-full bg-white text-black hover:bg-slate-200 flex items-center justify-center gap-3 px-4 py-3 rounded font-bold transition-all shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  // --- 2. DIAGNOSTIC LOADING SCREEN ---
  if (!workspace.isGraphLoaded || !isCompilerReady) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans">
        <img src="/logo.png" alt="Neuron Logo" className="w-24 h-24 mb-6 animate-pulse" />
        <h1 className="text-white font-bold tracking-[0.2em] text-2xl mb-2">NEURON</h1>
        <p className="text-slate-500 text-xs tracking-widest uppercase mb-6">Initializing Systems...</p>

        {/* REAL-TIME SYSTEM STATUS BOX */}
        <div className="flex flex-col gap-3 text-xs font-mono bg-[#141414] p-5 rounded-xl border border-slate-800 min-w-[300px] shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Python Backend (port 8000):</span>
            <span className={workspace.isGraphLoaded ? "text-green-400 font-bold" : "text-yellow-500 animate-pulse"}>
              {workspace.isGraphLoaded ? "✓ Ready" : "Connecting..."}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">WASM Compiler (Pyodide):</span>
            <span className={isCompilerReady ? "text-green-400 font-bold" : "text-yellow-500 animate-pulse"}>
              {isCompilerReady ? "✓ Ready" : "Downloading..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- 3. FULL IDE UI ---
  const centerHorizontalSize = 1000 - (layout.sidebar ? 200 : 0) - (layout.stdin ? 200 : 0);
  const centerVerticalSize = 1000 - (layout.terminal ? 200 : 0);

  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden">
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        updateSetting={updateSetting} 
      />

      <TopBar onRun={handleRunCode} layout={layout} setLayout={setLayout} />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar 
          layout={layout} 
          setLayout={setLayout} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          onLogout={() => supabase.auth.signOut()} 
        />
        
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v4">
          
          {layout.sidebar && (
            <>
              {/* YOUR EXACT PRESERVED SIZES */}
              <Panel id="sidebar" order={1} defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414]">
                <Sidebar files={workspace.files} currentFile={workspace.currentFile} onSwitchFile={handleSwitchFile} onCreateFile={handleCreateFile} onDeleteFile={handleDeleteFile} />
              </Panel>
              
              <Separator className="w-2 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center z-50">
                <div className="w-[1px] h-full bg-[#2b2d31]" />
              </Separator>
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
                  <Separator className="h-2 bg-transparent hover:bg-blue-500 transition-colors cursor-row-resize relative flex items-center justify-center z-50">
                    <div className="h-[1px] w-full bg-[#2b2d31]" />
                  </Separator>
                  
                  <Panel id="terminal-area" order={2} defaultSize={250} minSize={15} maxSize={300} className="bg-[#181818] flex flex-col font-mono text-sm min-h-[150px]">
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