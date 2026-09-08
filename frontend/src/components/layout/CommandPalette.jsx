// src/components/layout/CommandPalette.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Search, FileCode2, Play, Settings, Sparkles, 
  CornerDownLeft, Code2, AlertTriangle, ShieldCheck, 
  ExternalLink, Layers, Terminal, ArrowRight, Zap 
} from 'lucide-react';

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  searchQuery, 
  setSearchQuery, 
  workspace, 
  onRunCode, 
  onOpenSettings, 
  onWarpToNode,
  onSwitchFile
}) {
  const [semanticResults, setSemanticResults] = useState([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef(null);
  const selectedItemRef = useRef(null);
  const requestSeqRef = useRef(0);

  // 1. LISTEN FOR VECTOR SEARCH RESULTS OVER WEBSOCKETS
  useEffect(() => {
    const ws = workspace.wsRef?.current;
    if (!ws) return;

    const handleWsMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'SEMANTIC_SEARCH_RESULTS') {
          setSemanticResults(data.results || []);
          setIsSearchingVector(false);
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleWsMessage);
    return () => ws.removeEventListener('message', handleWsMessage);
  }, [workspace.wsRef]);

  // 2. DISPATCH ASYNC VECTOR SEARCH ON DEBOUNCED TYPING (140ms Latency)
  useEffect(() => {
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || cleanQuery.startsWith('>') || cleanQuery === '@' || cleanQuery === '#') {
      setSemanticResults([]);
      setIsSearchingVector(false);
      return;
    }

    const currentSeq = ++requestSeqRef.current;

    const timer = setTimeout(() => {
      if (workspace.wsRef?.current?.readyState === WebSocket.OPEN) {
        setIsSearchingVector(true);
        // Strip prefix modifiers if present
        const queryPayload = cleanQuery.replace(/^[@#]/, '').trim();
        if (queryPayload) {
          workspace.wsRef.current.send(JSON.stringify({
            event: 'SEMANTIC_SEARCH',
            query: queryPayload,
            top_k: 8
          }));
        }
      }
    }, 140);

    return () => clearTimeout(timer);
  }, [searchQuery, workspace.wsRef]);

  // 3. COMPILE UNIFIED SEARCH RESULTS (AI Vectors + AST Symbols + Files + Commands)
  const unifiedResults = useMemo(() => {
    const rawQuery = searchQuery.trim();
    if (!rawQuery) return [];
    
    const isCommandMode = rawQuery.startsWith('>');
    const isFileMode = rawQuery.startsWith('#');
    const isSymbolMode = rawQuery.startsWith('@');
    
    const query = rawQuery.replace(/^[>#@]/, '').toLowerCase().trim();
    const list = [];

    // Category A: Dense Vector Semantic Matches (AI Embeddings)
    if (!isCommandMode && !isFileMode) {
      semanticResults.forEach(item => {
        list.push({
          id: item.id,
          category: 'AI Vector Match',
          type: 'semantic_node',
          label: item.label,
          filePath: item.filePath,
          score: item.score,
          line: item.line,
          code: item.code,
          risk: item.risk || 'low',
          aiSummary: item.aiSummary,
          icon: <Sparkles size={14} className="text-cyan-400 shrink-0" />
        });
      });
    }

    // Category B: Exact File System Matches
    if (!isCommandMode && !isSymbolMode) {
      (workspace.files || []).forEach(f => {
        if (!query || f.toLowerCase().includes(query)) {
          list.push({
            id: f,
            category: 'Workspace File',
            type: 'file',
            label: f.split('/').pop(),
            filePath: f,
            icon: <FileCode2 size={14} className="text-blue-400 shrink-0" />
          });
        }
      });
    }

    // Category C: System Commands
    if (!isFileMode && !isSymbolMode) {
      const commands = [
        { id: 'cmd_run', category: 'Command', type: 'command', label: 'Run Active Python Script', action: onRunCode, icon: <Play size={14} className="text-emerald-400 shrink-0" /> },
        { id: 'cmd_settings', category: 'Command', type: 'command', label: 'Open System Preferences', action: onOpenSettings, icon: <Settings size={14} className="text-slate-400 shrink-0" /> },
        { id: 'cmd_terminal_clear', category: 'Command', type: 'command', label: 'Clear Terminal Output Logs', action: () => workspace.setTerminalLogs && workspace.setTerminalLogs([]), icon: <Terminal size={14} className="text-yellow-400 shrink-0" /> },
        { id: 'cmd_refresh', category: 'Command', type: 'command', label: 'Re-sync Workspace & AST Graph', action: () => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile })), icon: <Layers size={14} className="text-purple-400 shrink-0" /> }
      ];

      commands.forEach(c => {
        if (!query || c.label.toLowerCase().includes(query)) {
          list.push(c);
        }
      });
    }

    return list;
  }, [semanticResults, searchQuery, workspace.files, onRunCode, onOpenSettings, workspace]);

  // Reset keyboard highlight on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, semanticResults]);

  // Auto-scroll selected element into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // 4. SELECTION & DUAL ACTION ROUTING
  const handleSelect = useCallback((item, actionType = 'warp') => {
    if (!item) return;
    onClose();

    if (item.type === 'semantic_node') {
      if (actionType === 'warp') {
        // 🚀 A. Warp 3D Camera on WebGPU Canvas
        if (onWarpToNode) onWarpToNode(item.id);
      } else {
        // 🚀 B. Open Directly in Code Editor at Line
        if (onSwitchFile && item.filePath) {
          onSwitchFile(item.filePath);
        } else {
          if (item.filePath && item.filePath !== workspace.currentFile) {
            workspace.setIsFileSyncing?.(true);
            workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: item.filePath }));
          }
          if (workspace.setCenterView) workspace.setCenterView('editor');
        }
      }
    } else if (item.type === 'file') {
      if (onSwitchFile && item.filePath) {
        onSwitchFile(item.filePath);
      } else {
        if (item.filePath !== workspace.currentFile) {
          workspace.setIsFileSyncing?.(true);
          workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: item.filePath }));
        }
        if (workspace.setCenterView) workspace.setCenterView('editor');
      }
    } else if (item.type === 'command') {
      if (item.action) item.action();
    }
  }, [onClose, onWarpToNode, workspace, onSwitchFile]);

  // 5. KEYBOARD NAVIGATION HANDLER (Enter = Warp, Shift+Enter = Editor)
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1 < unifiedResults.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (unifiedResults.length > 0) {
        const action = e.shiftKey ? 'editor' : 'warp';
        handleSelect(unifiedResults[selectedIndex], action);
      }
    }
  };

  if (!isOpen) return null;

  const activeItem = unifiedResults[selectedIndex];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[200] flex items-start justify-center pt-20 font-sans select-none animate-in fade-in duration-100">
      <div className="bg-[#121212] w-[740px] border border-[#2d2d2d] shadow-[0_0_90px_rgba(0,0,0,0.9)] rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-top-3 duration-150">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#222] bg-[#171717]">
          <Search size={17} className="text-blue-400 mr-3 shrink-0" />
          <input 
            ref={inputRef}
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search symbols (@), files (#), commands (>), or type natural language..."
            className="w-full bg-transparent text-slate-100 text-sm outline-none placeholder-slate-500 font-sans"
          />
          {isSearchingVector && (
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50 animate-pulse shrink-0 flex items-center gap-1">
              <Zap size={10} /> Vectorizing...
            </span>
          )}
        </div>

        {/* Unified Results + Code Peek Dual View */}
        {searchQuery.trim() && (
          <div className="flex flex-row max-h-[390px] overflow-hidden divide-x divide-[#222]">
            
            {/* Left Stream: Ranked Matches */}
            <div className="flex-1 overflow-y-auto py-2 px-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10">
              {unifiedResults.length === 0 && !isSearchingVector ? (
                <div className="text-center text-slate-500 py-12 text-xs font-mono">
                  No semantic AST symbols or workspace files matched your query.
                </div>
              ) : (
                unifiedResults.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  const matchScore = item.score;

                  return (
                    <div 
                      key={item.id + idx}
                      ref={isSelected ? selectedItemRef : null}
                      onClick={() => handleSelect(item, 'warp')}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                        isSelected 
                          ? 'bg-blue-600/20 border border-blue-500/40 shadow-[inset_0_0_12px_rgba(59,130,246,0.15)]' 
                          : 'hover:bg-[#1a1a1a] border border-transparent'
                      }`}
                    >
                      {item.icon}
                      
                      <div className="flex flex-col overflow-hidden min-w-0">
                        <span className={`font-mono truncate ${isSelected ? 'text-white font-semibold' : 'text-slate-200'}`}>
                          {item.label}
                        </span>
                        {item.filePath && (
                          <span className="text-[10px] text-slate-500 font-mono truncate">
                            {item.filePath} {item.line ? `· Ln ${item.line}` : ''}
                          </span>
                        )}
                      </div>

                      <div className="ml-auto flex items-center gap-2 shrink-0">
                        {matchScore !== undefined && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            matchScore >= 85 
                              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' 
                              : matchScore >= 60 
                                ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40' 
                                : 'text-slate-400 bg-slate-900 border-slate-800'
                          }`}>
                            {matchScore}%
                          </span>
                        )}
                        {isSelected && <CornerDownLeft size={12} className="text-blue-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Drawer: Live AST Code Peek & AI Smell Summary */}
            {activeItem && activeItem.type === 'semantic_node' && (
              <div className="w-[310px] bg-[#0d0d0d] p-3 flex flex-col justify-between overflow-hidden">
                <div className="overflow-hidden flex flex-col gap-2">
                  
                  {/* Header Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                      <Code2 size={11} /> AST Code Peek
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      activeItem.risk === 'high' 
                        ? 'text-red-400 bg-red-950/50 border-red-800/50' 
                        : activeItem.risk === 'medium'
                          ? 'text-yellow-400 bg-yellow-950/50 border-yellow-800/50'
                          : 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
                    }`}>
                      Risk: {activeItem.risk?.toUpperCase()}
                    </span>
                  </div>

                  {/* AI Architectural Smell Diagnosis */}
                  {activeItem.aiSummary && (
                    <div className="p-2 bg-[#171717] rounded-lg border border-[#2a2a2a] text-[10px] font-mono text-slate-300 leading-snug">
                      {activeItem.aiSummary}
                    </div>
                  )}

                  {/* Code Snippet Box */}
                  {activeItem.code && (
                    <pre className="p-2.5 bg-[#141414] rounded-lg border border-[#222] font-mono text-[10px] text-slate-400 overflow-x-auto max-h-[210px] leading-relaxed [&::-webkit-scrollbar]:hidden">
                      <code>{activeItem.code}</code>
                    </pre>
                  )}
                </div>

                {/* Action Shortcuts for Selected Match */}
                <div className="mt-2 pt-2 border-t border-[#222] flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <button 
                    onClick={() => handleSelect(activeItem, 'warp')}
                    className="hover:text-blue-400 transition-colors flex items-center gap-1"
                  >
                    <span>↵ Warp Map</span>
                  </button>
                  <button 
                    onClick={() => handleSelect(activeItem, 'editor')}
                    className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                  >
                    <span>⇧↵ Open Editor</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        )}

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2.5 bg-[#0e0e0e] border-t border-[#222] flex items-center justify-between text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-[#1c1c1c] border border-[#333] rounded text-slate-300">↑↓</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-[#1c1c1c] border border-[#333] rounded text-slate-300">↵</kbd> Camera Warp</span>
            <span><kbd className="px-1.5 py-0.5 bg-[#1c1c1c] border border-[#333] rounded text-slate-300">⇧↵</kbd> Code Editor</span>
            <span><kbd className="px-1.5 py-0.5 bg-[#1c1c1c] border border-[#333] rounded text-slate-300">esc</kbd> Dismiss</span>
          </div>
          <span className="text-cyan-400/80 font-semibold">Neuron Omni-Search v2</span>
        </div>

      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}