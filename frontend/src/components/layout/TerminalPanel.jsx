// src/components/layout/TerminalPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { TerminalSquare, Plus, X, Trash2, Square, CornerDownLeft, ChevronDown } from 'lucide-react';

export default function TerminalPanel({ 
  logs, 
  sessions, 
  activeSessionId, 
  absTargetDir,
  onSelectSession, 
  onCreateSession, 
  onCloseSession, 
  onSendTerminalCommand, 
  onKillProcess,
  onClearOutput 
}) {
  const [inputCommand, setItemCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShellDropdown, setShowShellDropdown] = useState(false);
  
  const terminalEndRef = useRef(null);
  const dropdownRef = useRef(null);

  // Auto-scroll to the bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, sessions, activeSessionId]);

  // Click-away listener to close the shell dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowShellDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const handleKeyDown = (e) => {
    // Ctrl+C to kill running process
    if (e.ctrlKey && e.key === 'c' && activeSession?.isRunning) {
      onKillProcess(activeSessionId);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!inputCommand.trim()) return;

      if (inputCommand.trim() === 'clear' || inputCommand.trim() === 'cls') {
        if (activeSessionId === 'output') onClearOutput();
        else onSendTerminalCommand(activeSessionId, 'cls');
        setItemCommand("");
        return;
      }

      setCommandHistory(prev => [...prev, inputCommand]);
      setHistoryIndex(-1);

      if (activeSessionId !== 'output') {
        onSendTerminalCommand(activeSessionId, inputCommand);
      }
      setItemCommand("");
    } 
    else if (e.key === 'ArrowUp') {
      if (commandHistory.length > 0) {
        const nextIndex = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIndex);
        setItemCommand(commandHistory[commandHistory.length - 1 - nextIndex] || "");
      }
    } 
    else if (e.key === 'ArrowDown') {
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setItemCommand(commandHistory[commandHistory.length - 1 - nextIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setItemCommand("");
      }
    }
  };

  return (
    <div className="w-full h-full bg-[#141414] flex flex-col font-mono text-sm border-t border-[#2b2d31]">
      
      {/* 1. Terminal Top Bar */}
      <div className="h-8 shrink-0 bg-[#1e1e1e] border-b border-[#2b2d31] flex items-center justify-between px-2 text-xs select-none">
        
        {/* TABS AREA (Scrollable, but scrollbar hidden via CSS) */}
        <div className="flex items-center gap-1 overflow-x-auto flex-grow mr-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Output Tab */}
          <button
            onClick={() => onSelectSession('output')}
            className={`px-3 py-1 rounded-t flex items-center gap-2 transition-all shrink-0 ${
              activeSessionId === 'output' 
                ? 'bg-[#141414] text-blue-400 font-bold border-t-2 border-t-blue-500' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TerminalSquare size={13} />
            <span>Output</span>
          </button>

          {/* Active Terminal Sessions */}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`px-3 py-1 rounded-t flex items-center gap-2 cursor-pointer transition-all group shrink-0 ${
                activeSessionId === s.id 
                  ? 'bg-[#141414] text-green-400 font-bold border-t-2 border-t-green-500' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${s.isRunning ? 'bg-yellow-400 animate-ping' : 'bg-green-500'}`} />
              <span>{s.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onCloseSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* ACTIONS AREA (Fixed to the right) */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* New Terminal Dropdown Button */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowShellDropdown(!showShellDropdown)}
              className="px-1.5 py-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors flex items-center gap-0.5"
              title="New Terminal"
            >
              <Plus size={14} />
              <ChevronDown size={10} />
            </button>

            {/* Dropdown Menu (Z-index 200 ensures it goes over everything) */}
            {showShellDropdown && (
              <div className="absolute top-6 right-0 z-[200] w-48 bg-[#1e1e1e] border border-[#333] shadow-2xl rounded-md py-1 text-slate-300 animate-in fade-in slide-in-from-top-1 duration-150">
                <button 
                  onClick={() => { onCreateSession('powershell'); setShowShellDropdown(false); }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
                >
                  <span className="text-green-400 font-bold">PS</span> PowerShell
                </button>
                <button 
                  onClick={() => { onCreateSession('cmd'); setShowShellDropdown(false); }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
                >
                  <span className="text-yellow-400 font-bold">&gt;_</span> Command Prompt (CMD)
                </button>
                <button 
                  onClick={() => { onCreateSession('bash'); setShowShellDropdown(false); }}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600 hover:text-white flex items-center gap-2 text-xs"
                >
                  <span className="text-blue-400 font-bold">$</span> Bash / Shell
                </button>
              </div>
            )}
          </div>

          {activeSession?.isRunning && (
            <button 
              onClick={() => onKillProcess(activeSessionId)}
              className="flex items-center gap-1 bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-0.5 rounded text-[10px] font-semibold border border-red-700/50 transition-colors"
              title="Stop Running Process (Ctrl+C)"
            >
              <Square size={10} fill="currentColor" /> Stop
            </button>
          )}

          <button 
            onClick={onClearOutput}
            className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
            title="Clear Console"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* 2. Terminal Content Area (TEXT SELECTION ENABLED!) */}
      <div className="flex-grow p-4 overflow-y-auto font-mono text-xs select-text cursor-text">
        
        {/* Output Tab */}
        {activeSessionId === 'output' && (
          <div>
            {logs.map((log, index) => (
              <div key={index} className={`${log.isError ? 'text-red-400 font-bold' : 'text-green-400'} mb-1 leading-relaxed whitespace-pre-wrap select-text`}>
                <span className="text-slate-600 mr-2 select-none">➜</span> {log.text}
              </div>
            ))}
          </div>
        )}

        {/* Interactive Shell Sessions */}
        {activeSessionId !== 'output' && activeSession && (
          <div className="flex flex-col gap-1 select-text">
            {activeSession.history.map((h, i) => (
              <div key={i} className="flex flex-col gap-1 mb-2">
                <div className="flex items-center text-slate-400 font-semibold select-text">
                  <span className="text-green-400 mr-2 select-none">
                    {activeSession.shellType === 'cmd' ? '>' : activeSession.shellType === 'bash' ? '$' : 'PS'}
                  </span>
                  <span className="text-slate-300">{h.cwd}&gt;</span>
                  <span className="text-white ml-2">{h.command}</span>
                </div>
                {h.stdout && <div className="text-slate-300 whitespace-pre-wrap pl-4 border-l border-slate-700 font-mono select-text">{h.stdout}</div>}
                {h.stderr && <div className="text-red-400 font-bold whitespace-pre-wrap pl-4 border-l border-red-800 font-mono select-text">{h.stderr}</div>}
              </div>
            ))}

            {/* Prompt Line */}
            <div className="flex items-center gap-2 mt-1 select-none">
              <span className="text-green-400 font-bold">
                {activeSession.shellType === 'cmd' ? '>' : activeSession.shellType === 'bash' ? '$' : 'PS'}
              </span>
              <span className="text-slate-300 font-semibold">{activeSession.cwd}&gt;</span>
              <input 
                type="text"
                autoFocus
                value={inputCommand}
                onChange={(e) => setItemCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeSession.isRunning ? "Running... (Press Ctrl+C or click Stop)" : "Type command..."}
                className="flex-grow bg-transparent text-white font-mono text-xs outline-none border-none caret-blue-500 select-text"
              />
              <CornerDownLeft size={12} className="text-slate-600" />
            </div>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

    </div>
  );
}