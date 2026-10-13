// frontend/src/components/layout/modular/ModularPane.jsx
import React, { useState, useRef } from 'react';
import { Columns2, Rows2, PlusSquare } from 'lucide-react';
import PaneHeader from './PaneHeader';
import PaneContent from './PaneContent';

export default function ModularPane({
  pane,
  isActivePane,
  totalPanes = 1,
  totalEditorPanes = 1,
  onActivatePane,
  // Tab & Header actions
  dirtyFiles,
  gitStatuses,
  isFileSyncing,
  currentSyncingFile,
  onSelectTab,
  onCloseTab,
  onSplitPane,
  onClosePane,
  onRunFile,
  onRunFileInTerminal,
  onAddTabToPane,
  workspaceFiles,
  draggedTabInfo,
  setDraggedTabInfo,
  onMoveTab,
  // Content Props
  workspace,
  simDataRef,
  activeRay,
  focusIsolationId,
  warpTargetNodeId,
  refactorEnabled,
  onDragStart,
  onDragMove,
  onDragEnd,
  handleRefactorDrop,
  handleFileMergeDrop,
  handleNodeHover,
  onDoubleClickNode,
  hoveredNodeId,
  cspRejection,
  setCspRejection,
  handleCreateItem,
  getCodeForFile,
  settings,
  editorFocusLine,
  setEditorFocusLine,
  handleCodeChange,
  handleSaveFile,
  stdin,
  setStdin,
  aiStudio,
  handleOpenSettings
}) {
  const [dropZone, setDropZone] = useState(null); // 'left' | 'right' | 'top' | 'bottom' | 'center' | null
  const contentContainerRef = useRef(null);

  const activeTab = (pane.tabs || []).find(t => t.id === pane.activeTabId) || pane.tabs?.[0];

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!contentContainerRef.current) return;
    const rect = contentContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const edgeMargin = 0.22;
    let zone = 'center';

    if (relX < edgeMargin) {
      zone = 'left';
    } else if (relX > 1 - edgeMargin) {
      zone = 'right';
    } else if (relY < edgeMargin) {
      zone = 'top';
    } else if (relY > 1 - edgeMargin) {
      zone = 'bottom';
    } else {
      zone = 'center';
    }

    setDropZone(zone);
  };

  const handleDragLeave = (e) => {
    if (contentContainerRef.current && !contentContainerRef.current.contains(e.relatedTarget)) {
      setDropZone(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const zone = dropZone || 'center';
    setDropZone(null);

    const info = draggedTabInfo || window.__neuronDraggedTab;
    if (!info) return;

    onMoveTab(info.sourcePaneId, pane.id, info.tabId, zone);
    setDraggedTabInfo(null);
    window.__neuronDraggedTab = null;
  };

  let overlayStyle = "";
  let overlayLabel = "Dock Tab";
  let OverlayIcon = PlusSquare;

  if (dropZone === 'left') {
    overlayStyle = "top-0 bottom-0 left-0 w-1/2";
    overlayLabel = "Split Left";
    OverlayIcon = Columns2;
  } else if (dropZone === 'right') {
    overlayStyle = "top-0 bottom-0 right-0 w-1/2";
    overlayLabel = "Split Right";
    OverlayIcon = Columns2;
  } else if (dropZone === 'top') {
    overlayStyle = "top-0 left-0 right-0 h-1/2";
    overlayLabel = "Split Top";
    OverlayIcon = Rows2;
  } else if (dropZone === 'bottom') {
    overlayStyle = "bottom-0 left-0 right-0 h-1/2";
    overlayLabel = "Split Bottom";
    OverlayIcon = Rows2;
  } else if (dropZone === 'center') {
    overlayStyle = "inset-0";
    overlayLabel = "Dock Here";
    OverlayIcon = PlusSquare;
  }

  return (
    <div 
      className="relative w-full h-full flex flex-col overflow-hidden outline-none select-none"
      style={{ backgroundColor: 'var(--theme-background, #121314)' }}
      onClick={() => onActivatePane && onActivatePane(pane.id)}
    >
      {/* Pane Tab Strip Header */}
      <PaneHeader 
        pane={pane}
        isActivePane={isActivePane}
        totalPanes={totalPanes}
        totalEditorPanes={totalEditorPanes}
        dirtyFiles={dirtyFiles}
        gitStatuses={gitStatuses}
        isFileSyncing={isFileSyncing}
        currentSyncingFile={currentSyncingFile}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        onSplitPane={onSplitPane}
        onClosePane={onClosePane}
        onRunFile={onRunFile}
        onRunFileInTerminal={onRunFileInTerminal}
        onAddTabToPane={onAddTabToPane}
        workspaceFiles={workspaceFiles}
        draggedTabInfo={draggedTabInfo}
        setDraggedTabInfo={setDraggedTabInfo}
        onMoveTab={onMoveTab}
        isOutputRunning={workspace.isOutputRunning}
        activeSessionId={workspace.activeSessionId}
        terminalSessions={workspace.terminalSessions || []}
        onClearOutput={() => workspace.clearTerminalSession && workspace.clearTerminalSession('output')}
        onKillProcess={workspace.killTerminalProcess}
        onCreateTerminalSession={workspace.createTerminalSession}
        onCloseTerminalSession={workspace.closeTerminalSession}
        onSelectTerminalSession={workspace.setActiveSessionId}
      />

      {/* Pane Content Area with Drag-over Drop Detection */}
      <div 
        ref={contentContainerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <PaneContent 
          activeTab={activeTab}
          paneId={pane.id}
          workspace={workspace}
          simDataRef={simDataRef}
          activeRay={activeRay}
          focusIsolationId={focusIsolationId}
          warpTargetNodeId={warpTargetNodeId}
          refactorEnabled={refactorEnabled}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          handleRefactorDrop={handleRefactorDrop}
          handleFileMergeDrop={handleFileMergeDrop}
          handleNodeHover={handleNodeHover}
          onDoubleClickNode={onDoubleClickNode}
          hoveredNodeId={hoveredNodeId}
          cspRejection={cspRejection}
          setCspRejection={setCspRejection}
          handleCreateItem={handleCreateItem}
          getCodeForFile={getCodeForFile}
          dirtyFiles={dirtyFiles}
          settings={settings}
          editorFocusLine={editorFocusLine}
          setEditorFocusLine={setEditorFocusLine}
          handleCodeChange={handleCodeChange}
          handleSaveFile={handleSaveFile}
          stdin={stdin}
          setStdin={setStdin}
          aiStudio={aiStudio}
          handleOpenSettings={handleOpenSettings}
          onOpenTabInPane={onAddTabToPane}
        />

        {/* Visual Drop Zone Feedback Overlay */}
        {dropZone && (
          <div 
            className={`absolute z-50 pointer-events-none rounded-lg flex items-center justify-center border-2 border-dashed transition-all duration-150 backdrop-blur-[2px] ${overlayStyle}`}
            style={{
              backgroundColor: 'color-mix(in srgb, var(--theme-accent) 18%, transparent)',
              borderColor: 'var(--theme-accent)',
              boxShadow: '0 0 20px color-mix(in srgb, var(--theme-accent) 30%, transparent)'
            }}
          >
            <div 
              className="px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold shadow-2xl flex items-center gap-2"
              style={{
                backgroundColor: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-bright)'
              }}
            >
              <OverlayIcon size={14} style={{ color: 'var(--theme-accent)' }} />
              <span>{overlayLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
