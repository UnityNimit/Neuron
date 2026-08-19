// src/components/layout/TerminalPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Trash2, Square, ChevronDown, Terminal } from 'lucide-react';
import AnsiToHtml from 'ansi-to-html';

const ansiConverter = new AnsiToHtml({ 
  fg: '#e2e8f0', 
  bg: '#191a1b', 
  newline: false, 
  escapeXML: true 
});

export default function TerminalPanel({ 
  logs = [], 
  sessions = [], 
  activeSessionId = "output", 
  absTargetDir = "",
  onSelectSession, 
  onCreateSession, 
  onCloseSession, 
  onSendTerminalCommand, 
  onKillProcess, 
  onClearOutput 
}) {
  const [inputCommand, setInputCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShellDropdown, setShowShellDropdown] = useState(false);
  
  const terminalEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { 
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [logs, sessions, activeSessionId]);

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

  // Focus input when clicking anywhere inside the terminal background
  const handleTerminalClick = () => {
    const selection = window.getSelection();
    if (selection.toString().length === 0 && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Intercept Ctrl+C to kill running process
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && activeSession?.isRunning) {
      if (onKillProcess) onKillProcess(activeSessionId);
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!inputCommand.trim()) return;

      if (inputCommand.trim() === 'clear' || inputCommand.trim() === 'cls') {
        if (activeSessionId === 'output') {
          if (onClearOutput) onClearOutput();
        } else if (onSendTerminalCommand) {
          onSendTerminalCommand(activeSessionId, 'cls');
        }
        setInputCommand("");
        return;
      }

      setCommandHistory(prev => [...prev, inputCommand]);
      setHistoryIndex(-1);

      if (activeSessionId !== 'output' && onSendTerminalCommand) {
        onSendTerminalCommand(activeSessionId, inputCommand);
      }
      setInputCommand("");
    } 
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIndex = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIndex);
        setInputCommand(commandHistory[commandHistory.length - 1 - nextIndex] || "");
      }
    } 
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInputCommand(commandHistory[commandHistory.length - 1 - nextIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand("");
      }
    }
  };

  return (
    <div className="w-full h-full bg-[#191a1b] flex flex-col font-mono text-sm border-t border-[#26282a] select-none">
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. ULTRA-MINIMAL TERMINAL TAB STRIP                               */}
      {/* ----------------------------------------------------------------- */}
      <div className="h-8 shrink-0 bg-[#191a1b] border-b border-[#242628] flex items-center justify-between px-2 text-xs select-none">
        
        {/* Session Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-grow mr-4 [&::-webkit-scrollbar]:hidden">
          
          {/* Output Log Tab */}
          <button 
            onClick={() => onSelectSession && onSelectSession('output')} 
            className={`h-8 px-3 flex items-center gap-1.5 text-[11px] font-mono transition-all shrink-0 cursor-pointer ${
              activeSessionId === 'output' 
                ? 'bg-[#141516] text-blue-400 font-semibold border-t-2 border-t-blue-500' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202224]'
            }`}
          >
            <span>Output</span>
          </button>

          {/* Interactive Shell Sessions */}
          {sessions.map(s => {
            const isActive = activeSessionId === s.id;
            return (
              <div 
                key={s.id} 
                onClick={() => onSelectSession && onSelectSession(s.id)} 
                className={`h-8 px-2.5 flex items-center gap-1.5 cursor-pointer text-[11px] font-mono transition-all group shrink-0 ${
                  isActive 
                    ? 'bg-[#141516] text-blue-400 font-semibold border-t-2 border-t-blue-500' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202224]'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${s.isRunning ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>{s.name}</span>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (onCloseSession) onCloseSession(s.id); 
                  }} 
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1 p-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* New Shell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowShellDropdown(!showShellDropdown)} 
              className="p-1 hover:bg-[#242628] text-slate-400 hover:text-white rounded transition-colors flex items-center gap-0.5 cursor-pointer" 
              title="New Terminal"
            >
              <Plus size={13} />
              <ChevronDown size={10} />
            </button>
            
            {showShellDropdown && (
              <div className="absolute top-7 right-0 z-[200] w-44 bg-[#191a1b] border border-[#2e3032] shadow-2xl rounded-xl py-1 text-slate-300 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-100 font-mono text-[11px]">
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('powershell'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600/20 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-blue-400 font-bold">PS</span> PowerShell
                </button>
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('cmd'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600/20 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-blue-400 font-bold">&gt;_</span> Command Prompt
                </button>
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('bash'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-600/20 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-blue-400 font-bold">$</span> Bash
                </button>
              </div>
            )}
          </div>

          {/* Stop Process Button (if active process is running) */}
          {activeSession?.isRunning && (
            <button 
              onClick={() => onKillProcess && onKillProcess(activeSessionId)} 
              className="flex items-center gap-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 px-2 py-0.5 rounded text-[10px] font-mono border border-red-800/40 transition-colors" 
              title="Stop Running Process (Ctrl+C)"
            >
              <Square size={9} fill="currentColor" /> Stop
            </button>
          )}

          {/* Clear Console */}
          <button 
            onClick={onClearOutput} 
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" 
            title="Clear Console Output"
          >
            <Trash2 size={12} />
          </button>

        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. TERMINAL OUTPUT STREAM (Ultra-Thin Sleek Scrollbar)             */}
      {/* ----------------------------------------------------------------- */}
      <div 
        ref={containerRef}
        onClick={handleTerminalClick}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key.toLowerCase() === 'c' && activeSession?.isRunning) {
            if (onKillProcess) onKillProcess(activeSessionId);
          }
        }}
        className="flex-grow p-3 overflow-y-auto font-mono text-xs select-text cursor-text outline-none bg-[#191a1b] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-[#191a1b] [&::-webkit-scrollbar-thumb]:bg-[#2a2c2e] [&::-webkit-scrollbar-thumb:hover]:bg-[#3b82f6]"
      >
        {/* Output Mode */}
        {activeSessionId === 'output' && (
          <div className="flex flex-col gap-0.5">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`${
                  log.isError ? 'text-red-400' : log.isSystem ? 'text-slate-500' : 'text-slate-300'
                } whitespace-pre-wrap select-text leading-relaxed`}
                dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(log.text || "") }} 
              />
            ))}
          </div>
        )}

        {/* Interactive Shell Mode */}
        {activeSessionId !== 'output' && activeSession && (
          <div className="flex flex-col gap-1 select-text">
            {(activeSession.history || []).map((h, i) => (
              <div key={i} className="flex flex-col gap-0.5 mb-2.5">
                <div className="flex items-center text-slate-400 font-semibold select-text">
                  <span className="text-blue-400/80 select-text">{h.cwd}&gt;</span>
                  <span className="text-slate-100 ml-2">{h.command}</span>
                </div>
                {h.stdout && (
                  <div 
                    className="text-slate-300 whitespace-pre-wrap select-text leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stdout) }}
                  />
                )}
                {h.stderr && (
                  <div 
                    className="text-red-400 whitespace-pre-wrap select-text leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stderr) }}
                  />
                )}
              </div>
            ))}

            {/* Live Prompt / Execution Indicator */}
            {activeSession.isRunning ? (
              <div className="mt-1 text-blue-400/70 font-mono text-[11px] animate-pulse select-none">
                Executing... (Press Ctrl+C or Stop to kill)
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5 select-text">
                <span className="text-blue-400/80 font-semibold select-text">{activeSession.cwd}&gt;</span>
                <input 
                  ref={inputRef}
                  type="text" 
                  autoFocus 
                  value={inputCommand} 
                  onChange={(e) => setInputCommand(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  className="flex-grow bg-transparent text-slate-100 font-mono text-xs outline-none border-none caret-blue-400 select-text" 
                />
              </div>
            )}
          </div>
        )}
        
        <div ref={terminalEndRef} className="h-2" />
      </div>
    </div>
  );
}