// frontend/src/components/layout/modular/PaneHeader.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileCode2, 
  Terminal, 
  X, 
  Play, 
  Plus, 
  Loader2, 
  Trash2,
  Square,
  ChevronDown
} from 'lucide-react';
import { isEditorPane } from './layoutModel';

export default function PaneHeader({
  pane,
  isActivePane,
  totalPanes = 1,
  totalEditorPanes = 1,
  dirtyFiles = new Set(),
  gitStatuses = {},
  isFileSyncing = false,
  currentSyncingFile = "",
  onSelectTab,
  onCloseTab,
  onSplitPane,
  onClosePane,
  onRunFile,
  onRunFileInTerminal,
  onAddTabToPane,
  workspaceFiles = [],
  draggedTabInfo,
  setDraggedTabInfo,
  onMoveTab,
  isOutputRunning = false,
  activeSessionId = "output",
  terminalSessions = [],
  onClearOutput,
  onKillProcess,
  onCreateTerminalSession,
  onCloseTerminalSession,
  onSelectTerminalSession
}) {
  const [showShellMenu, setShowShellMenu] = useState(false);
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const shellMenuRef = useRef(null);
  const sessionMenuRef = useRef(null);
  const dragPendingRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (shellMenuRef.current && !shellMenuRef.current.contains(e.target)) {
        setShowShellMenu(false);
      }
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target)) {
        setShowSessionMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTab = (pane.tabs || []).find(t => t.id === pane.activeTabId) || pane.tabs?.[0];
  const isCodeFileActive = activeTab && activeTab.type === 'file';
  const isOutputActive = activeTab && activeTab.type === 'output';
  const isTerminalActive = activeTab && activeTab.type === 'terminal';
  const isEditorView = Boolean(activeTab && (activeTab.type === 'file' || activeTab.type === 'spatial'));
  const isMapOnlyPane = (pane.tabs || []).some(t => t.id === 'spatial' || t.type === 'spatial');

  const activeTerminalSession = terminalSessions.find(s => s.id === activeSessionId) || terminalSessions[0];
  const isCurrentTerminalRunning = Boolean(activeTerminalSession?.isRunning);

  const handleTabPointerDown = (e, tab) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    dragPendingRef.current = {
      tab,
      sourcePaneId: pane.id,
      startX: e.clientX,
      startY: e.clientY
    };

    const handleWindowPointerMove = (moveEvt) => {
      if (!dragPendingRef.current) return;
      const dx = moveEvt.clientX - dragPendingRef.current.startX;
      const dy = moveEvt.clientY - dragPendingRef.current.startY;
      if (Math.hypot(dx, dy) > 5) {
        const payload = {
          sourcePaneId: pane.id,
          tabId: tab.id,
          tab,
          isPointerDrag: true,
          x: moveEvt.clientX,
          y: moveEvt.clientY
        };
        setDraggedTabInfo(payload);
        window.__neuronDraggedTab = payload;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        dragPendingRef.current = null;
      }
    };

    const handleWindowPointerUp = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      dragPendingRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
  };

  const handleTabDragStart = (e, tab) => {
    const payload = {
      sourcePaneId: pane.id,
      tabId: tab.id,
      tab,
      isPointerDrag: false
    };
    setDraggedTabInfo(payload);
    window.__neuronDraggedTab = payload;
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', tab.id);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
    document.body.style.cursor = 'grabbing';
  };

  const handleTabDragEnd = () => {
    setDraggedTabInfo(null);
    window.__neuronDraggedTab = null;
    setDragOverIndex(null);
    document.body.style.cursor = '';
  };

  const handleTabDropOnTab = (e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const info = draggedTabInfo || window.__neuronDraggedTab;
    if (!info) return;
    onMoveTab(info.sourcePaneId, pane.id, info.tabId, 'center', targetIndex);
    setDraggedTabInfo(null);
    window.__neuronDraggedTab = null;
    document.body.style.cursor = '';
  };

  const handleTabStripDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleTabStripDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const info = draggedTabInfo || window.__neuronDraggedTab;
    if (!info) return;
    onMoveTab(info.sourcePaneId, pane.id, info.tabId, 'center', (pane.tabs || []).length);
    setDraggedTabInfo(null);
    window.__neuronDraggedTab = null;
    document.body.style.cursor = '';
  };

  return (
    <div 
      className="h-8 shrink-0 flex items-center justify-between px-0 border-b border-[var(--theme-border)] select-none relative z-40 transition-colors"
      style={{
        backgroundColor: 'var(--theme-secondary)',
        borderColor: 'var(--theme-border)'
      }}
    >
      {/* Active Pane Top Accent Indicator (Code Editor Panes Only) */}
      {isActivePane && isEditorPane(pane) && (
        <div 
          className="absolute top-0 left-0 right-0 h-[2px] z-50 pointer-events-none transition-all duration-200"
          style={{
            backgroundColor: 'var(--theme-accent, #38bdf8)',
            boxShadow: '0 0 8px var(--theme-accent, #38bdf8)'
          }}
        />
      )}
      {/* ----------------------------------------------------------------- */}
      {/* LEFT: Scrollable Tab Strip                                        */}
      {/* ----------------------------------------------------------------- */}
      <div 
        className="h-full flex items-center px-1.5 gap-1.5 overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden relative z-10"
        onDragOver={handleTabStripDragOver}
        onDrop={handleTabStripDrop}
      >
        {(pane.tabs || []).map((tab, tabIdx) => {
          const isActive = tab.id === pane.activeTabId;
          const isFile = tab.type === 'file';
          const filePath = tab.path || '';
          const isDirty = isFile && dirtyFiles.has(filePath);
          const rawGStat = isFile ? (gitStatuses[filePath] || '') : '';
          const gStat = (isDirty && (!rawGStat || rawGStat === 'I')) ? 'M' : rawGStat;
          const isModified = gStat === 'M';
          const isUntracked = gStat === 'U';
          const isAdded = gStat === 'A';
          const isDeleted = gStat === 'D';

          let tabTextClass = "group-hover:text-[var(--theme-text-bright)]";
          let tabTextStyle = {
            color: isActive ? 'var(--theme-text-bright)' : 'var(--theme-text-secondary)'
          };
          let iconClass = "";
          let iconStyle = {
            color: isActive ? 'var(--theme-accent)' : 'var(--theme-text-muted)'
          };
          let badgeColor = "";

          if (isDirty || isModified) {
            tabTextClass = "text-amber-500";
            iconClass = "text-amber-500";
            badgeColor = "text-amber-500";
          } else if (isUntracked || isAdded) {
            tabTextClass = "text-emerald-500";
            iconClass = "text-emerald-500";
            badgeColor = "text-emerald-500";
          } else if (isDeleted) {
            tabTextClass = "text-red-500 line-through";
            iconClass = "text-red-500";
            badgeColor = "text-red-500";
          }

          return (
            <React.Fragment key={tab.id}>
              {/* Visual drop insertion line before tab */}
              {dragOverIndex === tabIdx && (
                <div className="w-0.5 h-4 bg-[var(--theme-accent)] rounded-full shadow-[0_0_8px_var(--theme-accent)] shrink-0 transition-all pointer-events-none" />
              )}
              <div
                draggable={true}
                onPointerDown={(e) => handleTabPointerDown(e, tab)}
                onDragStart={(e) => handleTabDragStart(e, tab)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mid = rect.left + rect.width / 2;
                  if (e.clientX < mid) {
                    if (dragOverIndex !== tabIdx) setDragOverIndex(tabIdx);
                  } else {
                    if (dragOverIndex !== tabIdx + 1) setDragOverIndex(tabIdx + 1);
                  }
                }}
                onDragLeave={() => {
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetIdx = dragOverIndex !== null ? dragOverIndex : tabIdx;
                  handleTabDropOnTab(e, targetIdx);
                }}
                onClick={() => onSelectTab(pane.id, tab.id)}
                className={`neuron-tab-card ${
                  isFile ? 'pl-2.5 pr-1.5' : 'pl-3 pr-1.5'
                } font-mono cursor-grab active:cursor-grabbing shrink-0 group ${
                  isActive ? 'neuron-tab-card-active' : 'neuron-tab-card-inactive'
                }`}
                title={tab.title}
              >
                {/* Only code files display an icon; Map, Output, Terminal, AI Agent, Input have no icon */}
                {isFile && (
                  <FileCode2 
                    size={12} 
                    className={`transition-colors duration-150 shrink-0 mr-1.5 ${iconClass}`} 
                    style={iconStyle} 
                  />
                )}

                <span 
                  className={`relative z-[2] leading-normal transition-colors duration-150 truncate max-w-[140px] select-none ${tabTextClass}`} 
                  style={tabTextStyle}
                >
                  {tab.title}
                </span>

                {gStat && gStat !== 'I' && (
                  <span className={`relative z-[2] text-[10px] leading-normal font-mono font-bold ${badgeColor} ml-1`}>
                    {gStat}
                  </span>
                )}

                {isFileSyncing && currentSyncingFile === filePath && (
                  <Loader2 size={11} className="relative z-[2] animate-spin shrink-0 ml-1" style={{ color: 'var(--theme-accent)' }} />
                )}

                {/* Close Tab Button or Dirty Indicator Dot (Code Files Only) */}
                {isFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(pane.id, tab.id);
                    }}
                    className={`ml-1 w-3.5 h-3.5 rounded flex items-center justify-center transition-all text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)] relative z-[2] shrink-0 cursor-pointer ${
                      isActive ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={isDirty ? "Unsaved changes (Click to close)" : "Close Tab"}
                  >
                    {isDirty ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:opacity-0 transition-opacity" />
                        <X size={10} strokeWidth={2.2} className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 m-auto text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)]" />
                      </>
                    ) : (
                      <X size={10} strokeWidth={2.2} className="transition-opacity text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)]" />
                    )}
                  </button>
                )}

                <span
                  className={`neuron-tab-indicator ${
                    isActive ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
                  }`}
                />
              </div>
            </React.Fragment>
          );
        })}
        {/* Visual drop insertion line at end of tab strip */}
        {dragOverIndex === (pane.tabs || []).length && (
          <div className="w-0.5 h-4 bg-[var(--theme-accent)] rounded-full shadow-[0_0_8px_var(--theme-accent)] shrink-0 transition-all pointer-events-none" />
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT: Pane Action Buttons & Quick Add Menu                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="ml-auto flex items-center gap-0.5 pr-2 shrink-0 relative z-20">
        {/* Code Editor Controls */}
        {isCodeFileActive && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onRunFile && onRunFile(activeTab.path)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-all cursor-pointer"
              title="Run in Output (F5)"
            >
              <Play size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onRunFileInTerminal && onRunFileInTerminal(activeTab.path)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-all cursor-pointer"
              title="Run in Terminal"
            >
              <Terminal size={12} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Output Controls */}
        {isOutputActive && (
          <div className="flex items-center gap-0.5">
            {isOutputRunning && (
              <button
                type="button"
                onClick={() => onKillProcess && onKillProcess('output')}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-rose-500 hover:text-rose-400 transition-all cursor-pointer"
                title="Stop Running Process (Ctrl+C)"
              >
                <Square size={11} fill="currentColor" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onClearOutput && onClearOutput()}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-rose-400 transition-all cursor-pointer"
              title="Clear Output"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {/* Terminal Controls */}
        {isTerminalActive && (
          <div className="flex items-center gap-0.5">
            {isCurrentTerminalRunning && (
              <button
                type="button"
                onClick={() => onKillProcess && onKillProcess(activeTerminalSession?.id || activeSessionId)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-rose-500 hover:text-rose-400 transition-all cursor-pointer"
                title="Stop Running Process (Ctrl+C)"
              >
                <Square size={11} fill="currentColor" />
              </button>
            )}

            {/* Session Switcher / Active Session Name */}
            <div className="relative" ref={sessionMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (terminalSessions.length > 1) {
                    setShowSessionMenu(prev => !prev);
                  }
                }}
                className={`h-6 px-1.5 flex items-center gap-1 rounded text-[10px] font-mono transition-all ${
                  terminalSessions.length > 1
                    ? 'hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] cursor-pointer'
                    : 'text-[var(--theme-text-secondary)] cursor-default'
                }`}
                title={terminalSessions.length > 1 ? "Switch Terminal Session" : "Active Terminal Session"}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isCurrentTerminalRunning ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }} />
                <span>{activeTerminalSession?.name || 'PowerShell 1'}</span>
                {terminalSessions.length > 1 && (
                  <ChevronDown size={10} className="opacity-70" />
                )}
              </button>
              {terminalSessions.length > 1 && showSessionMenu && (
                <div 
                  className="absolute top-full right-0 mt-1 w-36 border shadow-2xl rounded-lg p-1 text-[11px] font-mono backdrop-blur-xl z-[100]"
                  style={{
                    backgroundColor: 'var(--theme-secondary)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)'
                  }}
                >
                  {terminalSessions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (onSelectTerminalSession) onSelectTerminalSession(s.id);
                        setShowSessionMenu(false);
                      }}
                      className={`w-full px-2 py-1 rounded flex items-center gap-1.5 text-left cursor-pointer ${
                        (activeTerminalSession?.id === s.id) ? 'bg-[var(--theme-surface)] text-[var(--theme-accent)]' : 'hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.isRunning ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }} />
                      <span className="truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New Shell Session Dropdown */}
            <div className="relative" ref={shellMenuRef}>
              <button
                type="button"
                onClick={() => setShowShellMenu(prev => !prev)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-all cursor-pointer"
                title="New Terminal Session"
              >
                <Plus size={12} />
              </button>
              {showShellMenu && (
                <div 
                  className="absolute top-full right-0 mt-1 w-44 border shadow-2xl rounded-lg p-1 text-[11px] font-mono backdrop-blur-xl z-[100]"
                  style={{
                    backgroundColor: 'var(--theme-secondary)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (onCreateTerminalSession) onCreateTerminalSession('powershell');
                      setShowShellMenu(false);
                    }}
                    className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer"
                  >
                    <span className="text-[var(--theme-accent)] font-bold">PS</span> PowerShell
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCreateTerminalSession) onCreateTerminalSession('cmd');
                      setShowShellMenu(false);
                    }}
                    className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer"
                  >
                    <span className="text-[var(--theme-accent)] font-bold">&gt;_</span> Command Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCreateTerminalSession) onCreateTerminalSession('bash');
                      setShowShellMenu(false);
                    }}
                    className="w-full px-2 py-1.5 rounded flex items-center gap-2 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer"
                  >
                    <span className="text-[var(--theme-accent)] font-bold">$</span> Bash
                  </button>
                </div>
              )}
            </div>

            {/* Kill / Close Shell Session */}
            <button
              type="button"
              onClick={() => onCloseTerminalSession && onCloseTerminalSession(activeTerminalSession?.id || activeSessionId)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-rose-400 transition-all cursor-pointer"
              title="Kill Terminal Session"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
