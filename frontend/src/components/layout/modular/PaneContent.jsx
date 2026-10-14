// frontend/src/components/layout/modular/PaneContent.jsx
import React from 'react';
import { AlertOctagon, X, Terminal } from 'lucide-react';

import PixiSpatialEngine from '../../canvas/PixiSpatialEngine';
import SpatialMinimap from '../../canvas/SpatialMinimap';
import RefactorContextMenu from '../../canvas/RefactorContextMenu';
import RefactorSelectionHUD from '../../canvas/RefactorSelectionHUD';
import FileSplitModal from '../../canvas/FileSplitModal';
import FileMergeModal from '../../canvas/FileMergeModal';
import CodeEditor from '../CodeEditor';
import ImageViewer from '../ImageViewer';
import UnsupportedFileViewer from '../UnsupportedFileViewer';
import TerminalPanel from '../TerminalPanel';
import StdinPanel from '../StdinPanel';
import AiChatView from '../../ai/AiChatView';
import ModelSelectorDropdown from '../../ai/ModelSelectorDropdown';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'bmp', 'tiff', 'tif', 'avif']);
const UNSUPPORTED_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'msi', 'iso', 'dmg', 'o', 'obj', 'class', 'jar',
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'db', 'sqlite', 'sqlite3', 'mdb'
]);

export default function PaneContent({
  activeTab,
  paneId,
  // Workspace & Canvas
  workspace,
  simDataRef,
  activeRay,
  focusIsolationId,
  warpTargetNodeId,
  refactorEnabled,
  refactorFeedback,
  setRefactorFeedback,
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
  // Code Editor
  getCodeForFile,
  dirtyFiles,
  settings,
  editorFocusLine,
  setEditorFocusLine,
  handleCodeChange,
  handleSaveFile,
  // Terminal
  // Stdin
  stdin,
  setStdin,
  // AI Studio
  aiStudio,
  handleOpenSettings,
  // Pane Switch / Open actions
  onOpenTabInPane
}) {
  // Multi-Orb Refactoring & Selection State
  const [selectedNodeIds, setSelectedNodeIds] = React.useState([]);
  const [contextMenu, setContextMenu] = React.useState({ isOpen: false, position: null, targetNode: null });
  const [splitModalFile, setSplitModalFile] = React.useState(null);
  const [mergeModalFiles, setMergeModalFiles] = React.useState(null);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setContextMenu({ isOpen: false, position: null, targetNode: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allNodes = workspace.nodes || simDataRef?.current?.nodes || [];
  const selectedNodes = React.useMemo(() => {
    const nodeMap = new Map();
    allNodes.forEach(n => nodeMap.set(n.id, n));
    return selectedNodeIds.map(id => nodeMap.get(id)).filter(Boolean);
  }, [selectedNodeIds, allNodes]);

  const summaryFileLocation = React.useMemo(() => {
    if (!workspace.aiInsight?.nodeId) return '';
    const rawId = workspace.aiInsight.nodeId;
    const nodeObj = allNodes.find(n => n.id === rawId);
    if (nodeObj?.data?.filePath) {
      return nodeObj.data.filePath.replace(/\\/g, '/');
    }
    let clean = rawId.replace(/^(file|function)::/, '');
    if (clean.includes('::')) {
      clean = clean.split('::')[0];
    }
    return clean.replace(/\\/g, '/');
  }, [workspace.aiInsight?.nodeId, allNodes]);

  // Reset all refactoring selections and modals when refactoring is turned off in the bottom section
  React.useEffect(() => {
    if (!refactorEnabled) {
      setSelectedNodeIds([]);
      setContextMenu({ isOpen: false, position: null, targetNode: null });
      setSplitModalFile(null);
      setMergeModalFiles(null);
    }
  }, [refactorEnabled]);

  const handleNodeClick = React.useCallback((nodeId, node, shiftKey) => {
    if (!refactorEnabled) return;
    setSelectedNodeIds(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, [refactorEnabled]);

  const handleNodeRightClick = React.useCallback(({ nodeId, node, clientX, clientY, shiftKey }) => {
    if (!refactorEnabled) return;
    setSelectedNodeIds(prev => {
      if (prev.includes(nodeId)) {
        if (shiftKey) return prev.filter(id => id !== nodeId);
        return prev;
      }
      return [...prev, nodeId];
    });

    setContextMenu({
      isOpen: true,
      position: { x: clientX, y: clientY },
      targetNode: node
    });
  }, [refactorEnabled]);

  const handleCanvasClick = React.useCallback(() => {
    setContextMenu({ isOpen: false, position: null, targetNode: null });
    setSelectedNodeIds([]);
  }, []);

  const handleClearSelection = React.useCallback(() => {
    setSelectedNodeIds([]);
    setContextMenu({ isOpen: false, position: null, targetNode: null });
  }, []);

  const handleDeselectNode = React.useCallback((nodeId) => {
    setSelectedNodeIds(prev => prev.filter(id => id !== nodeId));
  }, []);

  const handleDivideFile = React.useCallback((fileNode) => {
    if (!fileNode) {
      setRefactorFeedback?.({ status: 'cant', reason: 'select a file to divide' });
      return;
    }
    setSplitModalFile(fileNode);
  }, [setRefactorFeedback]);

  const handleCombineFiles = React.useCallback((fileNodes) => {
    if (!fileNodes || fileNodes.length < 2) {
      setRefactorFeedback?.({ status: 'cant', reason: 'select at least 2 files to combine' });
      return;
    }
    setMergeModalFiles(fileNodes);
  }, [setRefactorFeedback]);

  const handleMoveFunctions = React.useCallback((funcNodes, targetFileNode) => {
    const destFile = targetFileNode?.data?.filePath || targetFileNode?.id;
    if (!targetFileNode || !destFile) {
      setRefactorFeedback?.({ status: 'cant', reason: 'no destination file selected' });
      return;
    }
    let attempted = false;
    funcNodes.forEach(fn => {
      const rawLabel = fn.data?.label || fn.id;
      const funcName = rawLabel.replace('def ', '').split('(')[0].trim().split('.').pop();
      const sourceFile = fn.data?.filePath;
      const normSrc = (sourceFile || '').replace(/\\/g, '/').toLowerCase();
      const normDst = (destFile || '').replace(/\\/g, '/').toLowerCase();
      if (normSrc && normDst && (normSrc === normDst || normSrc.endsWith('/' + normDst) || normDst.endsWith('/' + normSrc))) {
        setRefactorFeedback?.({ status: 'cant', reason: 'already in this file' });
        return;
      }
      if (sourceFile && destFile) {
        attempted = true;
        handleRefactorDrop?.({
          symbolName: funcName,
          sourceFile,
          destFile,
          nodeId: fn.id,
          originalPos: { x: fn.x, y: fn.y },
          force: true
        });
      }
    });
    if (attempted) {
      setSelectedNodeIds([]);
    }
  }, [handleRefactorDrop, setRefactorFeedback]);

  const handleExtractFunctions = React.useCallback((funcNodes) => {
    if (funcNodes.length === 0) return;
    const firstFunc = funcNodes[0];
    const sourceFile = firstFunc.data?.filePath;
    if (!sourceFile) return;
    const ext = sourceFile.split('.').pop();
    const cleanSym = (firstFunc.data?.label || firstFunc.id).replace('def ', '').split('(')[0].trim().split('.').pop();
    const targetFile = `${cleanSym.toLowerCase()}_extracted.${ext}`;

    handleCreateItem(targetFile, 'file');
    setTimeout(() => {
      funcNodes.forEach(fn => {
        const rawLabel = fn.data?.label || fn.id;
        const fnName = rawLabel.replace('def ', '').split('(')[0].trim().split('.').pop();
        handleRefactorDrop?.({
          symbolName: fnName,
          sourceFile: fn.data?.filePath || sourceFile,
          destFile: targetFile,
          nodeId: fn.id,
          originalPos: { x: fn.x, y: fn.y }
        });
      });
      setSelectedNodeIds([]);
    }, 250);
  }, [handleCreateItem, handleRefactorDrop]);

  if (!activeTab) {
    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center text-[var(--theme-text-muted)] font-mono text-xs select-none p-4"
        style={{ backgroundColor: 'var(--theme-background, #121314)' }}
      >
        <p>No active tab in this pane</p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => onOpenTabInPane(paneId, { id: 'spatial', type: 'spatial', title: 'Map' })}
            className="px-2.5 py-1.5 rounded bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-colors border border-[var(--theme-border)] cursor-pointer"
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => onOpenTabInPane(paneId, { id: 'output', type: 'output', title: 'Output' })}
            className="px-2.5 py-1.5 rounded bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-colors border border-[var(--theme-border)] cursor-pointer"
          >
            Output
          </button>
          <button
            type="button"
            onClick={() => onOpenTabInPane(paneId, { id: 'terminal', type: 'terminal', title: 'Terminal' })}
            className="px-2.5 py-1.5 rounded bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] transition-colors border border-[var(--theme-border)] cursor-pointer"
          >
            Terminal
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 1. SPATIAL MAP ENGINE VIEW
  // -------------------------------------------------------------------------
  if (activeTab.type === 'spatial') {
    return (
      <div 
        className="relative w-full h-full flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--theme-background, #121314)' }}
      >
        {/* SPATIAL MAP TOP BAR (Legend matches CodeEditor breadcrumb bar) */}
        <div 
          className="h-6 shrink-0 border-b px-3 flex items-center justify-between text-[11px] font-mono select-none z-20"
          style={{
            backgroundColor: 'var(--theme-background, #121314)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-secondary, #94a3b8)'
          }}
        >
          <div className="flex items-center gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#e4ef61' }} />
              <span className="text-[var(--theme-text-muted)]">Folder</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-[var(--theme-text-muted)]">File</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#8b5cf6' }} />
              <span className="text-[var(--theme-text-muted)]">Function</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-[var(--theme-text-muted)]">Medium Risk</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-[var(--theme-text-muted)]">High Risk</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#9f00ad' }} />
              <span className="text-[var(--theme-text-muted)]">Call Edge</span>
            </div>
          </div>
        </div>

        <div className="relative flex-1 w-full min-h-0 overflow-hidden">
          {/* THE WEBGPU SPATIAL ENGINE */}
          <PixiSpatialEngine 
            simDataRef={simDataRef}
            activeRay={activeRay}
            focusIsolationId={focusIsolationId}
            blastRadius={workspace.blastRadius}
            cspRejectionEvent={cspRejection}
            warpTargetNodeId={warpTargetNodeId}
            refactorEnabled={refactorEnabled}
            selectedNodeIds={selectedNodeIds}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onRefactorDrop={handleRefactorDrop}
            onFileMergeDrop={handleFileMergeDrop}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeDoubleClick={onDoubleClickNode}
            onNodeRightClick={handleNodeRightClick}
            onCanvasClick={handleCanvasClick}
            settings={settings}
          />

          {/* SUPER MINIMAL REFACTOR FEEDBACK INDICATOR */}
          {refactorFeedback && (
            <div 
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 h-7 flex items-center gap-1.5 px-3 rounded-full border shadow-lg backdrop-blur-md text-[11px] font-mono select-none pointer-events-none animate-in fade-in duration-150"
              style={{
                backgroundColor: 'rgba(18, 19, 22, 0.94)',
                borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.12))',
                boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5)'
              }}
            >
              {refactorFeedback.status === 'done' && (
                <span className="text-emerald-400 font-medium font-mono">done</span>
              )}
              {refactorFeedback.status === 'cant' && (
                <div className="flex items-center gap-1.5 max-w-[500px]">
                  <span className="text-rose-400 font-medium font-mono shrink-0">can't</span>
                  <span className="text-zinc-600 font-mono shrink-0">·</span>
                  <span className="text-zinc-300 font-sans truncate">{refactorFeedback.reason}</span>
                </div>
              )}
              {refactorFeedback.status === 'moving' && (
                <span className="text-cyan-400 font-mono animate-pulse">moving...</span>
              )}
            </div>
          )}

          {/* FLOATING REFACTOR SELECTION HUD */}
          {refactorEnabled && !refactorFeedback && (
            <RefactorSelectionHUD
              selectedNodes={selectedNodes}
              onDivideFile={handleDivideFile}
              onCombineFiles={handleCombineFiles}
              onMoveFunctions={handleMoveFunctions}
              onExtractFunctions={handleExtractFunctions}
              onDeselectNode={handleDeselectNode}
              onClearSelection={handleClearSelection}
            />
          )}

          {/* REFACTOR CONTEXT MENU */}
          {refactorEnabled && (
            <RefactorContextMenu
              isOpen={contextMenu.isOpen}
              position={contextMenu.position}
              selectedNodes={selectedNodes}
              targetNode={contextMenu.targetNode}
              onClose={() => setContextMenu({ isOpen: false, position: null, targetNode: null })}
              onDivideFile={handleDivideFile}
              onCombineFiles={handleCombineFiles}
              onMoveFunctions={handleMoveFunctions}
              onExtractFunctions={handleExtractFunctions}
              onOpenInEditor={(path) => onDoubleClickNode(path, 1)}
              onClearSelection={handleClearSelection}
            />
          )}

          {/* FILE SPLIT MODAL */}
          <FileSplitModal
            isOpen={!!splitModalFile}
            fileNode={splitModalFile}
            workspace={workspace}
            onClose={() => setSplitModalFile(null)}
            onSplitSuccess={() => {
              setSelectedNodeIds([]);
              workspace.addNotification?.('success', 'File Split Complete', 'Symbols successfully separated into distinct files.', 'ai');
            }}
          />

          {/* FILE MERGE MODAL */}
          <FileMergeModal
            isOpen={!!mergeModalFiles}
            selectedFiles={mergeModalFiles || []}
            workspace={workspace}
            onClose={() => setMergeModalFiles(null)}
            onMergeSuccess={() => {
              setSelectedNodeIds([]);
              workspace.addNotification?.('success', 'Files Combined', 'Selected files merged successfully.', 'ai');
            }}
          />

          {/* EMPTY WORKSPACE ONBOARDING HERO CARD */}
          {(workspace.files || []).length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 select-none">
              <div 
                className="pointer-events-auto flex flex-col items-center text-center max-w-sm px-6 py-5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all"
                style={{
                  backgroundColor: 'rgba(18, 19, 20, 0.75)',
                  borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.08))'
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
                  <Network size={20} />
                </div>
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  {workspace.repoName || (workspace.absTargetDir ? workspace.absTargetDir.split(/[\\/]/).pop() : "Workspace")}
                </h3>
                <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed font-sans">
                  Workspace loaded. Create your first code file in the Explorer or click below to build your celestial map.
                </p>
                <button
                  type="button"
                  onClick={() => handleCreateItem('main.py', 'file')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 bg-[var(--theme-accent, #3b82f6)] text-white hover:brightness-110"
                >
                  <span>+ Create First File</span>
                </button>
              </div>
            </div>
          )}

          {/* SPATIAL RADAR MINIMAP OVERLAY */}
          {(settings?.spatialMinimap ?? true) && (
            <SpatialMinimap 
              nodes={workspace.nodes || []} 
              simDataRef={simDataRef} 
            />
          )}

          {/* FLOATING AI OVERVIEW PANEL */}
          {workspace.aiInsight && workspace.aiInsight.nodeId === hoveredNodeId && (
            <div 
              className="absolute top-3 right-3 max-w-xs z-30 border rounded-none p-3 pointer-events-none select-none flex flex-col gap-1.5 animate-in fade-in duration-100"
              style={{
                backgroundColor: 'var(--theme-surface, #161719)',
                borderColor: 'var(--theme-border, #242628)',
                boxShadow: 'none'
              }}
            >
              <div className="font-mono text-[11px] text-[var(--theme-text-muted, #71717a)] truncate leading-tight">
                {summaryFileLocation}
              </div>
              <p className="font-sans text-xs text-[var(--theme-text-primary, #e4e4e7)] leading-relaxed">
                {workspace.aiInsight.summary}
              </p>
            </div>
          )}

          {/* FLOATING CSP REFACTORING VIOLATION ALERT */}
          {cspRejection && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-full bg-[#1c0808]/95 border border-red-800/80 shadow-[0_0_50px_rgba(239,68,68,0.3)] rounded-xl p-4 z-[100] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-start gap-3">
                <AlertOctagon size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-red-200 font-mono text-xs font-bold uppercase tracking-wider">
                      Refactoring Guard: {cspRejection.violationType}
                    </h4>
                    <button 
                      type="button"
                      onClick={() => setCspRejection(null)} 
                      className="text-red-400 hover:text-red-200 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-slate-300 font-sans text-xs mt-1.5 leading-relaxed">
                    {cspRejection.reason}
                  </p>
                  {cspRejection.suggestedFix && (
                    <p className="text-red-300 font-mono text-[10px] mt-2 bg-black/40 p-2 rounded border border-red-950">
                      Suggested: {cspRejection.suggestedFix}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. CODE EDITOR / IMAGE / FILE VIEWER
  // -------------------------------------------------------------------------
  if (activeTab.type === 'file') {
    const filePath = activeTab.path;
    const fileExt = filePath ? filePath.split('.').pop().toLowerCase() : '';
    const isImageFile = IMAGE_EXTENSIONS.has(fileExt);
    const isUnsupportedFile = UNSUPPORTED_EXTENSIONS.has(fileExt);
    const fileCode = getCodeForFile(filePath);

    if (isImageFile) {
      return (
        <ImageViewer 
          filename={filePath} 
          isSyncing={workspace.isFileSyncing && workspace.currentFile === filePath}
        />
      );
    }

    if (isUnsupportedFile) {
      return (
        <UnsupportedFileViewer 
          filename={filePath} 
          onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))}
        />
      );
    }

    return (
      <CodeEditor 
        filename={filePath} 
        initialCode={fileCode} 
        isDirty={dirtyFiles.has(filePath)}
        settings={settings} 
        focusLine={editorFocusLine} 
        isSyncing={workspace.isFileSyncing && workspace.currentFile === filePath}
        onCodeChange={(newCode) => handleCodeChange(filePath, newCode)}
        onSave={() => handleSaveFile(filePath)}
        onClearFocus={() => setEditorFocusLine(null)} 
      />
    );
  }

  // -------------------------------------------------------------------------
  // 3. OUTPUT PANEL
  // -------------------------------------------------------------------------
  if (activeTab.type === 'output') {
    return (
      <TerminalPanel 
        logs={workspace.terminalLogs} 
        sessions={workspace.terminalSessions} 
        activeSessionId="output" 
        absTargetDir={workspace.absTargetDir} 
        isOutputRunning={workspace.isOutputRunning}
        onSelectSession={workspace.setActiveSessionId} 
        onCreateSession={workspace.createTerminalSession} 
        onCloseSession={workspace.closeTerminalSession} 
        onSendTerminalCommand={workspace.sendTerminalCommand} 
        onSendStdin={workspace.sendTerminalStdin}
        onKillProcess={workspace.killTerminalProcess} 
        onClearOutput={() => workspace.clearTerminalSession('output')} 
        hideTabStrip={true}
      />
    );
  }

  // -------------------------------------------------------------------------
  // 3b. INTERACTIVE TERMINAL PANEL
  // -------------------------------------------------------------------------
  if (activeTab.type === 'terminal') {
    const termSessionId = (workspace.activeSessionId && workspace.activeSessionId !== 'output')
      ? workspace.activeSessionId
      : (workspace.terminalSessions?.[0]?.id || 'term_1');

    return (
      <TerminalPanel 
        logs={workspace.terminalLogs} 
        sessions={workspace.terminalSessions} 
        activeSessionId={termSessionId} 
        absTargetDir={workspace.absTargetDir} 
        isOutputRunning={workspace.isOutputRunning}
        onSelectSession={workspace.setActiveSessionId} 
        onCreateSession={workspace.createTerminalSession} 
        onCloseSession={workspace.closeTerminalSession} 
        onSendTerminalCommand={workspace.sendTerminalCommand} 
        onSendStdin={workspace.sendTerminalStdin}
        onKillProcess={workspace.killTerminalProcess} 
        onClearOutput={() => workspace.clearTerminalSession(termSessionId)} 
        hideTabStrip={true}
      />
    );
  }

  // -------------------------------------------------------------------------
  // 4. STANDARD INPUT PANEL (TEST CASES)
  // -------------------------------------------------------------------------
  if (activeTab.type === 'stdin') {
    return (
      <StdinPanel 
        stdin={stdin} 
        setStdin={setStdin} 
      />
    );
  }

  // -------------------------------------------------------------------------
  // 5. AI AGENT VIEW
  // -------------------------------------------------------------------------
  if (activeTab.type === 'ai') {
    const currentFilePath = workspace.currentFile || "";
    const activeCodeStr = getCodeForFile(currentFilePath);

    return (
      <div 
        className="w-full h-full flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-background, #121314)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
      >
        {/* Model Selector Bar at Top of AI Agent */}
        <div 
          className="h-8 shrink-0 px-3 border-b flex items-center justify-between text-xs font-mono select-none"
          style={{
            backgroundColor: 'var(--theme-background, #121314)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--theme-text-bright)]">AI Agent</span>
            {aiStudio?.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] animate-pulse" />
            )}
          </div>
          <div className="shrink-0">
            <ModelSelectorDropdown 
              activeModelId={aiStudio?.selectedModel}
              onSelectModel={aiStudio?.handleSelectModel}
              isStreaming={aiStudio?.isStreaming}
              onOpenSettings={handleOpenSettings}
            />
          </div>
        </div>

        {/* AI Chat View Body */}
        <div className="flex-1 min-h-0 relative">
          <AiChatView 
            conversation={aiStudio?.activeConversation}
            activeModelId={aiStudio?.selectedModel}
            onSelectModel={aiStudio?.handleSelectModel}
            onSendMessage={aiStudio?.handleSendMessage}
            onStopGeneration={aiStudio?.handleStopGeneration}
            onRollback={aiStudio?.handleRollback}
            onApplyRefactor={aiStudio?.handleApplyRefactor}
            isStreaming={aiStudio?.isStreaming}
            streamingThought={aiStudio?.streamingThought}
            streamingDelta={aiStudio?.streamingDelta}
            streamingSteps={aiStudio?.streamingSteps}
            activeFile={currentFilePath}
            fileContent={activeCodeStr}
            projectName={workspace.repoName || (workspace.absTargetDir ? workspace.absTargetDir.split(/[\\/]/).pop() : "Neuron")}
            onOpenSettings={handleOpenSettings}
            pendingApproval={aiStudio?.pendingApproval}
            onApproveAction={aiStudio?.handleApproveAction}
            onRejectAction={aiStudio?.handleRejectAction}
          />
        </div>
      </div>
    );
  }

  return null;
}
