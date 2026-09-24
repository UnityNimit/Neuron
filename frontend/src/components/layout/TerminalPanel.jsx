// src/components/layout/TerminalPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Square } from 'lucide-react';
import AnsiToHtml from 'ansi-to-html';

const ansiConverter = new AnsiToHtml({ 
  fg: 'currentColor', 
  bg: 'transparent', 
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
  onSendStdin,
  onKillProcess, 
  onClearOutput 
}) {
  const [inputCommand, setInputCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { 
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, sessions, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Global Ctrl+C handler when terminal is active/focused
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'c' && activeSession?.isRunning) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          // User is highlighting text - allow standard clipboard copy
          return;
        }
        if (
          containerRef.current &&
          (containerRef.current.contains(document.activeElement) ||
           document.activeElement === containerRef.current ||
           document.activeElement === document.body ||
           document.activeElement === inputRef.current)
        ) {
          e.preventDefault();
          if (onKillProcess) {
            onKillProcess(activeSessionId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeSession?.isRunning, activeSessionId, onKillProcess]);

  // Focus input when clicking anywhere inside the terminal background
  const handleTerminalClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    if (inputRef.current) {
      inputRef.current.focus();
    } else if (containerRef.current) {
      containerRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Intercept Ctrl+K to open Omni-Search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('neuron-open-command-palette'));
      return;
    }

    // Intercept Ctrl+C to kill running process
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && activeSession?.isRunning) {
      e.preventDefault();
      if (onKillProcess) onKillProcess(activeSessionId);
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();

      // If process is running, feed keystrokes into stdin
      if (activeSession?.isRunning) {
        if (onSendStdin) {
          onSendStdin(activeSessionId, inputCommand + '\n');
        }
        setInputCommand("");
        return;
      }

      if (!inputCommand.trim()) return;

      if (inputCommand.trim() === 'clear' || inputCommand.trim() === 'cls') {
        if (onClearOutput) onClearOutput();
        if (activeSessionId !== 'output' && onSendTerminalCommand) {
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
    <div 
      className="w-full h-full flex flex-col font-mono text-sm select-none"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. ULTRA-MINIMAL TERMINAL TAB STRIP                               */}
      {/* ----------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 border-b flex items-center justify-between px-0 select-none"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)'
        }}
      >
        
        {/* Session Tabs */}
        <div className="flex items-center overflow-x-auto flex-grow mr-2 [&::-webkit-scrollbar]:hidden">
          
          {/* Output Log Tab */}
          <button 
            onClick={() => onSelectSession && onSelectSession('output')} 
            className={`h-8 px-3 flex items-center text-[11px] font-mono font-medium border-r transition-colors shrink-0 cursor-pointer ${
              activeSessionId === 'output' 
                ? 'font-semibold border-t-2 border-t-[var(--theme-accent)]' 
                : 'hover:text-[var(--theme-text-bright)]'
            }`}
            style={{
              backgroundColor: activeSessionId === 'output' ? 'var(--theme-background, #121314)' : 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: activeSessionId === 'output' ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-secondary, #94a3b8)'
            }}
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
                className={`h-8 px-3 flex items-center gap-1.5 cursor-pointer text-[11px] font-mono font-medium border-r transition-colors group shrink-0 ${
                  isActive 
                    ? 'font-semibold border-t-2 border-t-[var(--theme-accent)]' 
                    : 'hover:text-[var(--theme-text-bright)]'
                }`}
                style={{
                  backgroundColor: isActive ? 'var(--theme-background, #121314)' : 'var(--theme-secondary, #191a1b)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: isActive ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-secondary, #94a3b8)'
                }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${s.isRunning ? 'bg-[var(--theme-accent)] animate-pulse' : 'bg-[var(--theme-text-muted)]'}`} />
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2">
          
          {/* New Terminal Button */}
          <button 
            onClick={() => {
              if (onCreateSession) onCreateSession('powershell');
            }} 
            className="p-1 hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] rounded transition-colors cursor-pointer" 
            title="New Terminal"
          >
            <Plus size={13} />
          </button>

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

          {/* Clear / Kill Terminal */}
          <button 
            onClick={() => {
              if (activeSessionId === 'output') {
                if (onClearOutput) onClearOutput();
              } else {
                if (onCloseSession) onCloseSession(activeSessionId);
              }
            }} 
            className="p-1 text-[var(--theme-text-muted)] hover:text-red-400 transition-colors cursor-pointer" 
            title={activeSessionId === 'output' ? "Clear Output" : "Kill Terminal"}
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
        className="flex-grow p-3 overflow-y-auto font-mono text-xs select-text cursor-text outline-none [&::-webkit-scrollbar]:w-1"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          color: 'var(--theme-text-primary, #cbd5e1)',
          fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace"
        }}
      >
        {/* Output Mode */}
        {activeSessionId === 'output' && (
          <div className="flex flex-col gap-0.5">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`${
                  log.isError ? 'text-red-400' : log.isSystem ? 'text-[var(--theme-accent)] font-medium' : 'text-[var(--theme-text-primary)]'
                } whitespace-pre-wrap select-text leading-none font-mono`}
                style={{ fontVariantLigatures: 'none' }}
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
                <div className="flex items-center text-[var(--theme-text-muted)] font-semibold select-text">
                  <span className="text-[var(--theme-accent)] select-text">{h.cwd}&gt;</span>
                  <span className="text-[var(--theme-text-bright)] ml-2">{h.command}</span>
                </div>
                {h.stdout && (
                  <div 
                    className="text-[var(--theme-text-primary)] whitespace-pre-wrap select-text leading-none font-mono"
                    style={{ fontVariantLigatures: 'none' }}
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stdout) }}
                  />
                )}
                {h.stderr && (
                  <div 
                    className="text-red-400 whitespace-pre-wrap select-text leading-none font-mono"
                    style={{ fontVariantLigatures: 'none' }}
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stderr) }}
                  />
                )}
              </div>
            ))}

            {/* Live Prompt / Execution Indicator & Interactive Input */}
            {activeSession.isRunning ? (
              <div className="flex items-center gap-2 mt-1 select-text">
                <span className="text-[var(--theme-accent)] font-semibold select-text animate-pulse">Running &gt;</span>
                <input 
                  ref={inputRef}
                  type="text" 
                  autoFocus 
                  value={inputCommand} 
                  placeholder="Program running... Press Ctrl+C or click Stop to terminate"
                  onChange={(e) => setInputCommand(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  className="flex-grow bg-transparent text-[var(--theme-text-bright)] font-mono text-xs outline-none border-none caret-[var(--theme-accent)] select-text placeholder:text-[var(--theme-text-muted)] placeholder:text-[11px] placeholder:italic" 
                />
                <button 
                  onClick={() => onKillProcess && onKillProcess(activeSessionId)} 
                  className="flex items-center gap-1 bg-red-950/50 hover:bg-red-900/80 text-red-300 px-2 py-0.5 rounded text-[10px] font-mono border border-red-800/50 transition-colors shrink-0 cursor-pointer"
                  title="Stop Running Process (Ctrl+C)"
                >
                  <Square size={8} fill="currentColor" /> Stop
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5 select-text">
                <span className="text-[var(--theme-accent)] font-semibold select-text">{activeSession.cwd}&gt;</span>
                <input 
                  ref={inputRef}
                  type="text" 
                  autoFocus 
                  value={inputCommand} 
                  onChange={(e) => setInputCommand(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  className="flex-grow bg-transparent text-[var(--theme-text-bright)] font-mono text-xs outline-none border-none caret-[var(--theme-accent)] select-text" 
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