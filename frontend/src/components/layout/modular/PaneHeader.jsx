// frontend/src/components/layout/modular/PaneHeader.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileCode2, 
  Terminal, 
  X, 
  Play, 
  Loader2 
} from 'lucide-react';
import { isEditorPane, isMapPane, isBottomConsolePane, isRightPanelPane } from './layoutModel';

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
  onSelectTerminalSession,
  onActivatePane
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragPendingRef = useRef(null);

  // Dedicated Spatial Map pane header (Explorer Normal Text)
  if (isMapPane(pane)) {
    return (
      <div 
        className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b select-none transition-colors"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)'
        }}
        onClick={() => onActivatePane && onActivatePane(pane.id)}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const info = draggedTabInfo || window.__neuronDraggedTab;
          if (info && info.sourcePaneId && onMoveTab) {
            onMoveTab(info.sourcePaneId, pane.id, info.tabId, 'right');
            if (setDraggedTabInfo) setDraggedTabInfo(null);
            window.__neuronDraggedTab = null;
          }
        }}
      >
        <span className="font-medium tracking-wide" style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}>
          Spatial Map
        </span>
      </div>
    );
  }

  const isFixedPane = isBottomConsolePane(pane) || isRightPanelPane(pane);
  const activeTab = (pane.tabs || []).find(t => t.id === pane.activeTabId) || pane.tabs?.[0];
  const isCodeFileActive = activeTab && activeTab.type === 'file';

  const handleTabPointerDown = (e, tab) => {
    if (isFixedPane) return;
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
    if (isFixedPane) {
      e.preventDefault();
      return;
    }
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
    if (isFixedPane) return;
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
    if (isFixedPane) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleTabStripDrop = (e) => {
    if (isFixedPane) return;
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
              {dragOverIndex === tabIdx && !isFixedPane && (
                <div className="w-0.5 h-4 bg-[var(--theme-accent)] rounded-full shrink-0 transition-all pointer-events-none" />
              )}
              <div
                draggable={!isFixedPane}
                onPointerDown={(e) => handleTabPointerDown(e, tab)}
                onDragStart={(e) => handleTabDragStart(e, tab)}
                onDragEnd={handleTabDragEnd}
                onDragOver={(e) => {
                  if (isFixedPane) return;
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
                  if (isFixedPane) return;
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  if (isFixedPane) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const targetIdx = dragOverIndex !== null ? dragOverIndex : tabIdx;
                  handleTabDropOnTab(e, targetIdx);
                }}
                onClick={() => onSelectTab(pane.id, tab.id)}
                className={`neuron-tab-card ${
                  isFile ? 'pl-2.5 pr-1.5' : 'px-3'
                } font-mono ${isFixedPane ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} shrink-0 group ${
                  isActive ? 'neuron-tab-card-active' : 'neuron-tab-card-inactive'
                }`}
                style={isActive ? {
                  backgroundColor: 'var(--theme-background, #121314)',
                  borderColor: 'var(--theme-border, #242628)',
                  boxShadow: 'none'
                } : {
                  boxShadow: 'none'
                }}
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
                  className={`relative z-[2] leading-normal transition-colors duration-150 truncate max-w-[140px] select-none py-0.5 ${tabTextClass}`} 
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
              </div>
            </React.Fragment>
          );
        })}
        {/* Visual drop insertion line at end of tab strip */}
        {dragOverIndex === (pane.tabs || []).length && !isFixedPane && (
          <div className="w-0.5 h-4 bg-[var(--theme-accent)] rounded-full shrink-0 transition-all pointer-events-none" />
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
      </div>
    </div>
  );
}
