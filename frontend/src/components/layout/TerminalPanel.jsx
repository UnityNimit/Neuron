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
  isOutputRunning = false,
  onSelectSession, 
  onCreateSession, 
  onCloseSession, 
  onSendTerminalCommand, 
  onSendStdin,
  onKillProcess, 
  onClearOutput,
  hideTabStrip = false
}) {
  const [inputCommand, setInputCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showShellDropdown, setShowShellDropdown] = useState(false);
  const prevIsRunningRef = useRef(false);
  
  const terminalEndRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { 
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
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

  const activeSession = sessions.find(s => s.id === activeSessionId) || (activeSessionId !== 'output' ? sessions[0] : null);
  const resolvedSessionId = activeSessionId === 'output' ? 'output' : (activeSession?.id || (sessions[0]?.id || 'output'));

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
            onKillProcess(resolvedSessionId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeSession?.isRunning, resolvedSessionId, onKillProcess]);

  // Clean up inputCommand immediately when process exits so leftover game keys are never submitted as shell commands
  useEffect(() => {
    if (prevIsRunningRef.current && !activeSession?.isRunning) {
      setInputCommand("");
    }
    prevIsRunningRef.current = Boolean(activeSession?.isRunning);
  }, [activeSession?.isRunning]);

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
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && (activeSession?.isRunning || (resolvedSessionId === 'output' && isOutputRunning))) {
      e.preventDefault();
      if (onKillProcess) onKillProcess(resolvedSessionId);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // If process is running, feed input into stdin
      if (activeSession?.isRunning) {
        if (onSendStdin) {
          onSendStdin(resolvedSessionId, inputCommand + '\n');
        }
        setInputCommand("");
        return;
      }

      if (!inputCommand.trim()) return;

      if (inputCommand.trim() === 'clear' || inputCommand.trim() === 'cls') {
        if (onClearOutput) onClearOutput();
        setInputCommand("");
        return;
      }

      setCommandHistory(prev => [...prev, inputCommand]);
      setHistoryIndex(-1);

      if (resolvedSessionId !== 'output' && onSendTerminalCommand) {
        onSendTerminalCommand(resolvedSessionId, inputCommand);
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
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. ULTRA-MINIMAL TERMINAL TAB STRIP (Detached Floating Cards)     */}
      {/* ----------------------------------------------------------------- */}
      {!hideTabStrip && (
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-0 border-b select-none relative z-30"
        style={{
          backgroundColor: 'var(--theme-secondary)',
          borderColor: 'var(--theme-border)'
        }}
      >
        {/* Session Tabs */}
        <div className="h-full flex items-center px-1.5 gap-1.5 overflow-x-auto flex-grow mr-2 [&::-webkit-scrollbar]:hidden relative z-10">
          
          {/* Output Log Tab */}
          <button 
            onClick={() => onSelectSession && onSelectSession('output')} 
            className={`neuron-tab-card px-2.5 font-mono shrink-0 cursor-pointer group ${
              activeSessionId === 'output' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="relative z-[2] leading-normal">Output</span>
            <span
              className={`neuron-tab-indicator ${
                activeSessionId === 'output' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
          </button>

          {/* Interactive Shell Sessions */}
          {sessions.map(s => {
            const isActive = activeSessionId === s.id;
            return (
              <div 
                key={s.id} 
                onClick={() => onSelectSession && onSelectSession(s.id)} 
                className={`neuron-tab-card px-2.5 gap-1.5 cursor-pointer font-mono group shrink-0 ${
                  isActive 
                    ? 'neuron-tab-card-active' 
                    : 'neuron-tab-card-inactive'
                }`}
              >
                <div 
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 relative z-[2] ${s.isRunning ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: s.isRunning ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
                />
                <span className="relative z-[2] leading-normal">{s.name}</span>
                <span
                  className={`neuron-tab-indicator ${
                    isActive ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 pr-2 relative z-20">
          
          {/* Stop Process Button (Left of Plus, Icon Only in Red) */}
          {(activeSession?.isRunning || (activeSessionId === 'output' && isOutputRunning)) && (
            <button 
              onClick={() => onKillProcess && onKillProcess(activeSessionId)} 
              className="p-1 text-red-500 hover:text-red-400 hover:bg-[var(--theme-surface-hover)] rounded transition-colors flex items-center justify-center cursor-pointer" 
              title="Stop Running Process (Ctrl+C)"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}

          {/* New Shell Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowShellDropdown(!showShellDropdown)} 
              className="p-1 hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] rounded transition-colors flex items-center cursor-pointer" 
              title="New Terminal"
            >
              <Plus size={13} />
            </button>
            
            {showShellDropdown && (
              <div 
                className="absolute top-7 right-0 z-[200] w-44 border shadow-2xl rounded-xl py-1 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-100 font-mono text-[11px]"
                style={{
                  backgroundColor: 'var(--theme-surface, #191a1b)',
                  borderColor: 'var(--theme-border-subtle, #2e3032)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
              >
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('powershell'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-[var(--theme-accent)] font-bold">PS</span> PowerShell
                </button>
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('cmd'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-[var(--theme-accent)] font-bold">&gt;_</span> Command Prompt
                </button>
                <button 
                  onClick={() => { 
                    if (onCreateSession) onCreateSession('bash'); 
                    setShowShellDropdown(false); 
                  }} 
                  className="w-full px-3 py-1.5 text-left hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="text-[var(--theme-accent)] font-bold">$</span> Bash
                </button>
              </div>
            )}
          </div>

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
      )}

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
          backgroundColor: 'var(--theme-background, #121314)',
          color: 'var(--theme-text-primary, #cbd5e1)',
          fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace"
        }}
      >
        {/* Output Mode */}
        {resolvedSessionId === 'output' && (
          <div className="flex flex-col gap-0.5">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`${
                  log.isError ? 'text-[var(--theme-accent)]' : log.isSystem ? 'text-[var(--theme-accent)] font-medium' : 'text-[var(--theme-text-primary)]'
                } whitespace-pre-wrap select-text leading-none font-mono`}
                style={{ fontVariantLigatures: 'none' }}
                dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(log.text || "") }} 
              />
            ))}
            {isOutputRunning && (
              <div className="flex items-center gap-2 mt-1.5 text-[var(--theme-accent)] font-medium select-none text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] animate-pulse" />
                <span>Running...</span>
              </div>
            )}
          </div>
        )}

        {/* Interactive Shell Mode */}
        {resolvedSessionId !== 'output' && activeSession && (
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
                    className="whitespace-pre-wrap select-text leading-none font-mono"
                    style={{ color: 'var(--theme-accent)', fontVariantLigatures: 'none' }}
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stderr) }}
                  />
                )}
              </div>
            ))}

            {/* Live Prompt / Interactive Stdin Input */}
            {activeSession.isRunning ? (
              <div className="flex items-center gap-2 mt-1 select-text">
                <span className="text-[var(--theme-accent)] font-semibold select-text animate-pulse shrink-0">&gt;</span>
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