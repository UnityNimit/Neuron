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
  const [showShellDropdown, setShowShellDropdown] = useState(false);
  const [directKeysMode, setDirectKeysMode] = useState(false);
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
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && activeSession?.isRunning) {
      e.preventDefault();
      if (onKillProcess) onKillProcess(activeSessionId);
      return;
    }

    // Direct live keystrokes for interactive games and CLI navigation
    if (activeSession?.isRunning) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSendStdin?.(activeSessionId, '\x1b[A');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSendStdin?.(activeSessionId, '\x1b[B');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSendStdin?.(activeSessionId, '\x1b[C');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSendStdin?.(activeSessionId, '\x1b[D');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onSendStdin?.(activeSessionId, '\x1b');
        return;
      }

      // Live game control keys (WASD, Q to quit, P to pause, R to restart)
      const isGameControl = ['w', 'a', 's', 'd', 'q', 'p', 'r'].includes(e.key.toLowerCase());
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
        if (directKeysMode || (inputCommand === "" && isGameControl)) {
          e.preventDefault();
          onSendStdin?.(activeSessionId, e.key.toLowerCase());
          return;
        }
      }
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
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. ULTRA-MINIMAL TERMINAL TAB STRIP (Detached Floating Cards)     */}
      {/* ----------------------------------------------------------------- */}
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
            className={`neuron-tab-card px-3 gap-1.5 font-mono shrink-0 cursor-pointer group ${
              activeSessionId === 'output' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-none">Output</span>
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
                className={`neuron-tab-card px-3 gap-1.5 cursor-pointer font-mono group shrink-0 ${
                  isActive 
                    ? 'neuron-tab-card-active' 
                    : 'neuron-tab-card-inactive'
                }`}
              >
                <div 
                  className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 ${s.isRunning ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: s.isRunning ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }}
                />
                <span className="leading-none">{s.name}</span>
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
          {activeSession?.isRunning && (
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
        {activeSessionId === 'output' && (
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
                    className="whitespace-pre-wrap select-text leading-none font-mono"
                    style={{ color: 'var(--theme-accent)', fontVariantLigatures: 'none' }}
                    dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(h.stderr) }}
                  />
                )}
              </div>
            ))}

            {/* Live Prompt / Execution Indicator & Interactive Input */}
            {activeSession.isRunning ? (
              <div className="flex items-center gap-2 mt-1 select-text">
                <span className="text-[var(--theme-accent)] font-semibold select-text animate-pulse shrink-0">Running &gt;</span>
                <input 
                  ref={inputRef}
                  type="text" 
                  autoFocus 
                  value={inputCommand} 
                  placeholder={directKeysMode ? "Direct Game Keys active (WASD / Arrows to steer, Q to quit)" : "Program running... Type input + Enter, use Arrow keys or WASD"}
                  onChange={(e) => setInputCommand(e.target.value)} 
                  onKeyDown={handleKeyDown} 
                  className="flex-grow bg-transparent text-[var(--theme-text-bright)] font-mono text-xs outline-none border-none caret-[var(--theme-accent)] select-text placeholder:text-[var(--theme-text-muted)] placeholder:text-[11px] placeholder:italic" 
                />
                <button
                  type="button"
                  onClick={() => setDirectKeysMode(prev => !prev)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all border cursor-pointer shrink-0 ${
                    directKeysMode 
                      ? 'bg-[var(--theme-accent)] text-white border-transparent' 
                      : 'bg-[var(--theme-surface, #161719)] text-[var(--theme-text-muted)] border-[var(--theme-border, #242628)] hover:text-[var(--theme-text-bright)]'
                  }`}
                  title="Toggle Direct Keystrokes for interactive games (WASD & single-key controls)"
                >
                  {directKeysMode ? "WASD: Direct" : "WASD Mode"}
                </button>
                <button
                  type="button"
                  onClick={() => onKillProcess?.(activeSessionId)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all bg-rose-600/90 hover:bg-rose-600 text-white shrink-0 cursor-pointer shadow-sm hover:brightness-110 active:scale-95"
                  title="Stop running process (Ctrl+C)"
                >
                  Stop
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