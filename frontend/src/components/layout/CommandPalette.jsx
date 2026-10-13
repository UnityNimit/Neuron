// src/components/layout/CommandPalette.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';

export default function CommandPalette({ 
  isOpen, 
  onOpen,
  onClose, 
  searchQuery = "", 
  setSearchQuery, 
  workspace = {}, 
  onRunCode, 
  onRunInTerminal,
  onOpenSettings, 
  onWarpToNode,
  onSwitchFile,
  repoName = ""
}) {
  const [semanticResults, setSemanticResults] = useState([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedItemRef = useRef(null);
  const requestSeqRef = useRef(0);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen]);

  // Global click-outside and Escape dismiss listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, onClose]);

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

    const timer = setTimeout(() => {
      if (workspace.wsRef?.current?.readyState === WebSocket.OPEN) {
        setIsSearchingVector(true);
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

  // 3. COMPILE UNIFIED SEARCH RESULTS
  // Exact Spatial Map Legend Colors:
  // Folder: #e4ef61, File: #3b82f6, Function: #8b5cf6, Medium Risk: #f59e0b, High Risk: #ef4444, Command: #9f00ad
  const unifiedResults = useMemo(() => {
    const rawQuery = searchQuery.trim();
    
    const isCommandMode = rawQuery.startsWith('>');
    const isFileMode = rawQuery.startsWith('#');
    const isSymbolMode = rawQuery.startsWith('@');
    
    const query = rawQuery.replace(/^[>#@]/, '').toLowerCase().trim();
    const list = [];

    // Category A: Dense Vector Semantic Matches & AST Symbols (Purple / Red / Amber)
    if (!isCommandMode && !isFileMode) {
      semanticResults.forEach(item => {
        const color = item.risk === 'high' 
          ? '#ef4444' 
          : item.risk === 'medium' 
            ? '#f59e0b' 
            : '#8b5cf6';

        list.push({
          id: item.id,
          category: 'Function',
          type: 'semantic_node',
          label: item.label,
          filePath: item.filePath,
          score: item.score,
          line: item.line,
          code: item.code,
          risk: item.risk || 'low',
          aiSummary: item.aiSummary,
          color
        });
      });
    }

    // Category B: Folders (Lime-Yellow #e4ef61)
    if (!isCommandMode && !isSymbolMode) {
      const folderSet = new Set();
      (workspace.items || []).forEach(it => {
        if (it.type === 'folder' && it.path) folderSet.add(it.path);
      });
      (workspace.files || []).forEach(f => {
        const parts = f.replace(/\\/g, '/').split('/');
        let cur = '';
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur ? `${cur}/${parts[i]}` : parts[i];
          folderSet.add(cur);
        }
      });

      folderSet.forEach(folderPath => {
        const folderName = folderPath.split('/').pop() || folderPath;
        if (!query || folderName.toLowerCase().includes(query) || folderPath.toLowerCase().includes(query)) {
          list.push({
            id: `folder_${folderPath}`,
            category: 'Folder',
            type: 'folder',
            label: folderName,
            filePath: folderPath,
            color: '#e4ef61'
          });
        }
      });
    }

    // Category C: Workspace Files (Blue #3b82f6)
    if (!isCommandMode && !isSymbolMode) {
      (workspace.files || []).forEach(f => {
        if (!query || f.toLowerCase().includes(query)) {
          list.push({
            id: `file_${f}`,
            category: 'File',
            type: 'file',
            label: f.split('/').pop(),
            filePath: f,
            color: '#3b82f6'
          });
        }
      });
    }

    // Category D: System Commands (Call Edge Magenta #9f00ad)
    if (!isFileMode && !isSymbolMode) {
      const commands = [
        { id: 'cmd_run', category: 'Command', type: 'command', label: 'Run Active File (F5)', action: onRunCode, color: '#9f00ad' },
        { id: 'cmd_run_terminal', category: 'Command', type: 'command', label: 'Run Active File in Terminal', action: onRunInTerminal, color: '#9f00ad' },
        { id: 'cmd_settings', category: 'Command', type: 'command', label: 'Open System Preferences', action: onOpenSettings, color: '#9f00ad' },
        { id: 'cmd_terminal_clear', category: 'Command', type: 'command', label: 'Clear Terminal Output Logs', action: () => workspace.setTerminalLogs && workspace.setTerminalLogs([]), color: '#9f00ad' },
        { id: 'cmd_refresh', category: 'Command', type: 'command', label: 'Re-sync Workspace & AST Graph', action: () => workspace.wsRef?.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile })), color: '#9f00ad' }
      ];

      commands.forEach(c => {
        if (!query || c.label.toLowerCase().includes(query)) {
          list.push(c);
        }
      });
    }

    return list;
  }, [semanticResults, searchQuery, workspace.files, workspace.items, onRunCode, onRunInTerminal, onOpenSettings, workspace]);

  // Reset highlight on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery, semanticResults]);

  // Auto-scroll selected element into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // 4. SELECTION ROUTER
  const handleSelect = useCallback((item, actionType = 'warp') => {
    if (!item) return;
    onClose();

    if (item.type === 'semantic_node') {
      if (actionType === 'warp') {
        if (onWarpToNode) onWarpToNode(item.id);
      } else {
        if (onSwitchFile && item.filePath) {
          onSwitchFile(item.filePath);
        }
      }
    } else if (item.type === 'file') {
      if (onSwitchFile && item.filePath) {
        onSwitchFile(item.filePath);
      }
    } else if (item.type === 'folder') {
      if (workspace.wsRef?.current?.readyState === WebSocket.OPEN) {
        workspace.wsRef.current.send(JSON.stringify({
          event: 'REVEAL_IN_EXPLORER',
          path: item.filePath
        }));
      }
    } else if (item.type === 'command') {
      if (item.action) item.action();
    }
  }, [onClose, onWarpToNode, workspace, onSwitchFile]);

  // 5. KEYBOARD NAVIGATION
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
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

  const activeItem = unifiedResults[selectedIndex];

  return (
    <>
      {/* Embedded Search Container in TopBar with smooth width animation */}
      <div 
        ref={containerRef}
        className={`relative z-[240] pointer-events-auto flex flex-col items-center transition-[width] duration-300 ease-out ${
          isOpen ? 'w-[540px]' : 'w-[300px]'
        }`}
      >
        {/* TopBar Search Input Bar */}
        <div 
          onClick={() => {
            if (!isOpen && onOpen) onOpen();
          }}
          className={`h-[26px] w-full px-2.5 rounded-lg flex items-center gap-2 border select-none transition-colors duration-200 overflow-hidden ${
            !isOpen ? 'cursor-pointer hover:border-[var(--theme-accent)] group' : ''
          }`}
          style={{
            backgroundColor: isOpen ? 'var(--theme-background, #121314)' : 'var(--theme-surface, #161719)',
            borderColor: isOpen ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-border, #242628)',
            color: 'var(--theme-text-muted, #94a3b8)'
          }}
          title={!isOpen ? "Search (Ctrl+K)" : ""}
        >
          <Search 
            size={12} 
            className={`shrink-0 transition-colors duration-200 ${
              isOpen 
                ? 'text-[var(--theme-accent)]' 
                : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-accent)]'
            }`} 
          />

          {!isOpen ? (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="text-[11px] font-mono text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-bright)] transition-colors select-none">
                Search
              </span>
              <kbd 
                className="text-[9.5px] font-mono px-1 py-0.2 rounded border shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{
                  backgroundColor: 'var(--theme-secondary, #191a1b)',
                  borderColor: 'var(--theme-border, #242628)'
                }}
              >
                Ctrl K
              </kbd>
            </div>
          ) : (
            <>
              <input 
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search"
                className="w-full bg-transparent text-xs font-mono text-[var(--theme-text-bright)] outline-none placeholder-[var(--theme-text-muted)] tracking-wide"
              />
              {isSearchingVector && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <span className="text-[10px] font-mono text-cyan-400">
                    Vectorizing...
                  </span>
                </div>
              )}
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-0.5 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer shrink-0"
                title="Close (Esc)"
              >
                <X size={12} />
              </button>

              {/* Scanning Line during vector search */}
              {isSearchingVector && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-lg">
                  <div className="neuron-loading-line-bar" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Anchored Results Dropdown Directly Beneath TopBar */}
        {isOpen && (
          <div 
            className="absolute top-full left-0 right-0 mt-1.5 border shadow-2xl rounded-xl overflow-hidden z-[250] flex flex-col animate-in fade-in zoom-in-95 duration-150 ease-out"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)'
            }}
          >
            <div className="flex flex-row max-h-[380px] overflow-hidden divide-x" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              
              {/* Left Stream: Ranked Matches */}
              <div className="flex-1 overflow-y-auto py-1.5 px-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10">
                {unifiedResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2.5 text-[var(--theme-text-muted)] font-mono text-xs">
                    {isSearchingVector ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span className="text-cyan-400 text-[11px] animate-pulse">Searching spatial vectors...</span>
                      </>
                    ) : (
                      <span>No matching files, symbols, or commands.</span>
                    )}
                  </div>
                ) : (
                  unifiedResults.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const matchScore = item.score;

                    return (
                      <div 
                        key={item.id + idx}
                        ref={isSelected ? selectedItemRef : null}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelect(item, 'warp');
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(item, 'warp');
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-mono transition-colors duration-75 select-none ${
                          isSelected 
                            ? 'bg-[var(--theme-surface-active)] text-[var(--theme-text-bright)]' 
                            : 'hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-primary)]'
                        }`}
                      >
                        {/* Solid Spatial Map Color Dot without any glow */}
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ 
                            backgroundColor: item.color
                          }} 
                        />
                        
                        <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                          <span className={`truncate text-xs ${isSelected ? 'text-[var(--theme-text-bright)] font-semibold' : 'text-[var(--theme-text-primary)]'}`}>
                            {item.label}
                          </span>
                          {item.filePath && (
                            <span className="text-[10px] text-[var(--theme-text-muted)] truncate">
                              {item.filePath} {item.line ? `· Ln ${item.line}` : ''}
                            </span>
                          )}
                        </div>

                        <div className="ml-auto flex items-center gap-2.5 shrink-0">
                          {/* Minimalist similarity text - Pure colored typography without outer box */}
                          {matchScore !== undefined && (
                            <span className={`text-[10px] font-mono font-semibold tabular-nums shrink-0 ${
                              matchScore >= 85 
                                ? 'text-emerald-400' 
                                : matchScore >= 60 
                                  ? 'text-cyan-400' 
                                  : 'text-[var(--theme-text-muted)]'
                            }`}>
                              {matchScore}%
                            </span>
                          )}
                          <span className="text-[9px] uppercase tracking-wider text-[var(--theme-text-muted)] font-mono">
                            {item.category}
                          </span>
                          {isSelected && (
                            <CornerDownLeft 
                              size={11} 
                              className="text-[var(--theme-accent)] shrink-0 animate-in fade-in slide-in-from-right-1 duration-150" 
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Drawer: Live AST Code Peek (Semantic Nodes Only) */}
              {activeItem && activeItem.type === 'semantic_node' && (
                <div 
                  className="w-[280px] p-3 flex flex-col justify-between overflow-hidden border-l shrink-0"
                  style={{
                    backgroundColor: 'var(--theme-background, #121314)',
                    borderColor: 'var(--theme-border, #242628)'
                  }}
                >
                  <div className="overflow-hidden flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" /> AST Code Peek
                      </span>
                      {/* Minimalist Risk Text - Pure colored typography without outer box */}
                      <span className={`text-[10px] font-mono font-medium tracking-wider shrink-0 ${
                        activeItem.risk === 'high' 
                          ? 'text-red-400' 
                          : activeItem.risk === 'medium'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}>
                        Risk: {activeItem.risk?.toUpperCase()}
                      </span>
                    </div>

                    {activeItem.aiSummary && (
                      <div 
                        className="p-2 rounded-lg border text-[10px] font-mono leading-snug"
                        style={{
                          backgroundColor: 'var(--theme-surface, #171717)',
                          borderColor: 'var(--theme-border, #2a2a2a)',
                          color: 'var(--theme-text-primary, #cbd5e1)'
                        }}
                      >
                        {activeItem.aiSummary}
                      </div>
                    )}

                    {activeItem.code && (
                      <pre 
                        className="p-2.5 rounded-lg border font-mono text-[10px] overflow-x-auto max-h-[190px] leading-relaxed [&::-webkit-scrollbar]:hidden"
                        style={{
                          backgroundColor: 'var(--theme-secondary, #191a1b)',
                          borderColor: 'var(--theme-border, #242628)',
                          color: 'var(--theme-text-primary, #cbd5e1)'
                        }}
                      >
                        <code>{activeItem.code}</code>
                      </pre>
                    )}
                  </div>

                  <div 
                    className="mt-2 pt-2 border-t flex items-center justify-between text-[9px] font-mono"
                    style={{
                      borderColor: 'var(--theme-border, #242628)',
                      color: 'var(--theme-text-muted, #64748b)'
                    }}
                  >
                    <button 
                      type="button"
                      onClick={() => handleSelect(activeItem, 'warp')}
                      className="hover:text-[var(--theme-accent)] transition-colors cursor-pointer"
                    >
                      ↵ Warp Map
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleSelect(activeItem, 'editor')}
                      className="hover:text-cyan-400 transition-colors cursor-pointer"
                    >
                      ⇧↵ Open Editor
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Legend matching spatial map */}
            <div 
              className="px-3.5 py-1.5 border-t flex items-center justify-between text-[10px] font-mono"
              style={{
                backgroundColor: 'var(--theme-secondary, #191a1b)',
                borderColor: 'var(--theme-border, #242628)',
                color: 'var(--theme-text-muted, #64748b)'
              }}
            >
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.2 rounded border bg-[var(--theme-surface)] border-[var(--theme-border)]">↑↓</kbd> Select</span>
                <span><kbd className="px-1 py-0.2 rounded border bg-[var(--theme-surface)] border-[var(--theme-border)]">↵</kbd> Open</span>
                <span><kbd className="px-1 py-0.2 rounded border bg-[var(--theme-surface)] border-[var(--theme-border)]">esc</kbd> Close</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#e4ef61]" /> Folder</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> File</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]" /> Function</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#9f00ad]" /> Command</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}