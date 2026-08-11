import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, 
  useNodesState, useEdgesState, addEdge, useKeyPress
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Panel, Group, Separator } from 'react-resizable-panels';
import { Play, FolderOpen, FileCode2, TerminalSquare, ChevronRight, Plus, X, TextCursorInput } from 'lucide-react';
import CodeNode from './components/CodeNode';

const nodeTypes = { codeNode: CodeNode };

export default function App() {
  const [isGraphLoaded, setIsGraphLoaded] = useState(false);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState("");
  
  // --- NEW: Standard Input State for Codeforces ---
  const [stdin, setStdin] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [blastRadius, setBlastRadius] = useState(null);
  
  const [terminalLogs, setTerminalLogs] = useState([
    { text: "Neuron Terminal v1.0.0", isError: false },
    { text: "Waiting for execution...", isError: false }
  ]);
  
  const wsRef = useRef(null);
  const terminalEndRef = useRef(null);
  // FIX: Use Alt+I so it doesn't break normal typing!
  const impactPressed = useKeyPress(['Alt+i', 'Alt+I']);
  const escPressed = useKeyPress('Escape');

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const handleCodeEdit = useCallback((nodeId, newCode) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'CODE_EDIT', node_id: nodeId, new_code: newCode }));
    }
  }, []);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    const connectWebSocket = () => {
      ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => console.log("🟢 Connected to Python AI Engine");
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'INIT' || data.event === 'SYNC') {
          setFiles(data.payload.files);
          setCurrentFile(data.payload.active_file || "");
          
          const nodesWithCallbacks = data.payload.graph.nodes.map(node => ({
            ...node, data: { ...node.data, onCodeEdit: handleCodeEdit }
          }));
          setNodes(nodesWithCallbacks);
          setEdges(data.payload.graph.edges);
          setIsGraphLoaded(true);
        } else if (data.event === 'BLAST_RADIUS') {
          setBlastRadius(data.payload);
        } else if (data.event === 'TERMINAL_OUTPUT' || data.event === 'TERMINAL_ERROR') {
          const newLogs = data.payload.split('\n').filter(line => line !== '');
          const formattedLogs = newLogs.map(log => ({ text: log, isError: data.event === 'TERMINAL_ERROR' }));
          setTerminalLogs(prev => [...prev, ...formattedLogs]);
        }
      };
      ws.onclose = () => {
        console.log("🔴 Backend disconnected. Reconnecting...");
        reconnectTimer = setTimeout(connectWebSocket, 2000);
      };
    };
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [setNodes, setEdges, handleCodeEdit]);

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    const positionChange = changes.find((c) => c.type === 'position' && c.dragging);
    if (positionChange && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'NODE_MOVE', node_id: positionChange.id, position: positionChange.position }));
    }
  }, [onNodesChange]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), [setEdges]);

  useEffect(() => {
    if (impactPressed) {
      const selectedNode = nodes.find(n => n.selected);
      if (selectedNode && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: selectedNode.id }));
      }
    }
  }, [impactPressed, nodes]);

  useEffect(() => { if (escPressed) setBlastRadius(null); }, [escPressed]);

  const displayNodes = useMemo(() => {
    if (!blastRadius) return nodes;
    return nodes.map(node => {
      const isImpacted = blastRadius.includes(node.id);
      return {
        ...node,
        style: { ...node.style, opacity: isImpacted ? 1 : 0.2, transition: 'all 0.4s ease' },
        data: { ...node.data, isImpacted }
      };
    });
  }, [nodes, blastRadius]);

  const handleRunCode = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // NEW: Pass the Standard Input state to the backend compiler!
      wsRef.current.send(JSON.stringify({ event: 'RUN_CODE', stdin: stdin }));
    }
  };

  const handleSwitchFile = (filename) => {
    if (filename === currentFile) return;
    setIsGraphLoaded(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'SWITCH_FILE', filename }));
    }
  };

  const handleCreateFile = () => {
    const filename = prompt("Enter new Python file name (e.g., solution.py):");
    if (filename && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsGraphLoaded(false);
      wsRef.current.send(JSON.stringify({ event: 'CREATE_FILE', filename }));
    }
  };

  const handleDeleteFile = (filename, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Are you sure you want to delete ${filename}?`);
    if (confirmed && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'DELETE_FILE', filename }));
    }
  };

  if (!isGraphLoaded) {
    return (
      <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col items-center justify-center font-sans">
        <img src="/logo.png" alt="Neuron Logo" className="w-24 h-24 mb-6 animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
        <h1 className="text-white font-bold tracking-[0.2em] text-2xl mb-2 flex items-center gap-2">NEURON</h1>
        <p className="text-slate-500 text-xs tracking-widest uppercase mb-10">Initializing AI Engine & UMAP Layout...</p>
        <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 w-full animate-pulse rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#0f0f0f] flex flex-col font-sans text-slate-300 overflow-hidden">
      
      <div className="h-12 shrink-0 bg-[#1a1a1a] border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
          <h1 className="text-white font-bold tracking-wide flex items-center gap-2">
            NEURON <span className="text-slate-500 text-xs font-normal">| The Spatial IDE</span>
          </h1>
        </div>
        <button onClick={handleRunCode} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-1.5 rounded text-sm font-semibold transition-colors shadow-lg">
          <Play size={16} fill="currentColor" /> Run
        </button>
      </div>

      <Group orientation="horizontal" className="flex-grow overflow-hidden">
        
        {/* EXACT PANEL PRESERVED PER YOUR REQUEST */}
        <Panel defaultSize={200} minSize={100} maxSize={500} className="bg-[#141414] border-r border-slate-800 flex flex-col">
          <div className="p-3 text-xs font-semibold tracking-widest text-slate-500 flex items-center justify-between uppercase shrink-0">
            <div className="flex items-center gap-2"><FolderOpen size={14} /> Explorer</div>
            <button onClick={handleCreateFile} className="hover:text-white transition-colors"><Plus size={16} /></button>
          </div>
          <div className="flex-grow overflow-y-auto px-2 pb-4">
            {files.map(file => (
              <div key={file} onClick={() => handleSwitchFile(file)} className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer text-sm mb-1 group transition-colors ${currentFile === file ? 'bg-blue-900/30 text-blue-300 border border-blue-800/50' : 'hover:bg-slate-800/50 text-slate-400 border border-transparent'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCode2 size={14} className={currentFile === file ? "text-blue-400 shrink-0" : "text-slate-500 shrink-0"} />
                  <span className="truncate">{file}</span>
                </div>
                <button onClick={(e) => handleDeleteFile(file, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><X size={14} /></button>
              </div>
            ))}
          </div>
        </Panel>

        <Separator className="w-1.5 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center">
          <div className="w-[1px] h-full bg-slate-800" />
        </Separator>

        <Panel className="flex flex-col">
          <Group orientation="vertical">
            <Panel defaultSize={75} minSize={40} className="flex flex-col bg-[#0f0f0f]">
              <div className="h-9 shrink-0 bg-[#1a1a1a] flex items-center px-2 border-b border-slate-800">
                <div className="flex items-center gap-2 bg-[#0f0f0f] px-4 py-1.5 border-t-2 border-t-blue-500 text-sm border-r border-slate-800">
                  <FileCode2 size={14} className="text-blue-400" />
                  <span className="text-slate-200">{currentFile}</span>
                </div>
              </div>
              <div className="flex-grow relative">
                <ReactFlow nodes={displayNodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} colorMode="dark" className="absolute inset-0">
                  <Background color="#333" gap={24} size={2} />
                  <Controls className="bg-slate-800 border-slate-700 fill-white mb-2 ml-2 shadow-lg" />
                  <MiniMap nodeColor={(n) => (n.data?.isImpacted ? '#f97316' : n.data?.risk === 'high' ? '#ef4444' : '#3b82f6')} maskColor="rgba(0, 0, 0, 0.7)" className="bg-[#1e1e1e] border border-slate-700 mb-2 mr-2 shadow-lg" />
                </ReactFlow>
              </div>
            </Panel>
            <Separator className="h-1.5 bg-transparent hover:bg-blue-500 transition-colors cursor-row-resize relative flex items-center justify-center">
              <div className="h-[1px] w-full bg-slate-800" />
            </Separator>
            <Panel defaultSize={25} minSize={15} className="bg-[#141414] flex flex-col font-mono text-sm">
              <div className="h-8 shrink-0 bg-[#1a1a1a] border-b border-slate-800 flex items-center px-4 gap-2 text-slate-400 text-xs">
                <TerminalSquare size={14} /> TERMINAL
              </div>
              <div className="flex-grow p-4 overflow-y-auto">
                {terminalLogs.map((log, index) => (
                  <div key={index} className={`${log.isError ? 'text-red-400 font-bold' : 'text-green-400'} mb-1 leading-relaxed whitespace-pre-wrap`}>
                    <span className="text-slate-600 mr-2">➜</span> {log.text}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </Panel>
          </Group>
        </Panel>

        {/* --- NEW: Codeforces Input Right Panel --- */}
        <Separator className="w-1.5 bg-transparent hover:bg-blue-500 transition-colors cursor-col-resize relative flex items-center justify-center">
          <div className="w-[1px] h-full bg-slate-800" />
        </Separator>

        <Panel defaultSize={15} minSize={10} maxSize={30} className="bg-[#141414] border-l border-slate-800 flex flex-col">
          <div className="h-9 shrink-0 bg-[#1a1a1a] flex items-center px-4 border-b border-slate-800 gap-2 text-slate-400 text-xs uppercase tracking-widest font-semibold">
            <TextCursorInput size={14} /> Standard Input
          </div>
          <div className="flex-grow p-2">
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Paste Codeforces test cases here..."
              className="w-full h-full bg-[#1e1e1e] text-slate-300 font-mono text-sm p-3 border border-slate-700 rounded resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </Panel>

      </Group>
    </div>
  );
}