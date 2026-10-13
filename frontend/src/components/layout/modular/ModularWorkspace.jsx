// frontend/src/components/layout/modular/ModularWorkspace.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import ModularPane from './ModularPane';
import {
  getAllPanes,
  findPaneById,
  addTabToPane,
  removeTabFromPane,
  setActiveTabInPane,
  splitPane,
  moveTab,
  closePane,
  normalizeTree,
  saveLayoutToStorage
} from './layoutModel';

export default function ModularWorkspace({
  layoutTree,
  setLayoutTree,
  activePaneId,
  setActivePaneId,
  onActiveFileChange,
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
  dirtyFiles,
  settings,
  editorFocusLine,
  setEditorFocusLine,
  handleCodeChange,
  handleSaveFile,
  stdin,
  setStdin,
  aiStudio,
  handleOpenSettings,
  onRunCode,
  onRunInTerminal
}) {
  const [draggedTabInfo, setDraggedTabInfo] = useState(null);

  const allPanes = useMemo(() => getAllPanes(layoutTree), [layoutTree]);
  const totalPanes = allPanes.length;
  const totalEditorPanes = useMemo(() => {
    return allPanes.filter(p => (p.tabs || []).some(t => t.type === 'file' || t.type === 'spatial')).length;
  }, [allPanes]);

  // Auto-persist layout changes to localStorage
  useEffect(() => {
    if (layoutTree) {
      saveLayoutToStorage(layoutTree);
    }
  }, [layoutTree]);

  // Keep workspace.currentFile in sync when active tab in active pane changes
  useEffect(() => {
    if (!activePaneId || !layoutTree) return;
    const activePane = findPaneById(layoutTree, activePaneId);
    if (!activePane) return;
    const activeTab = (activePane.tabs || []).find(t => t.id === activePane.activeTabId);
    if (activeTab && activeTab.type === 'file' && activeTab.path) {
      if (workspace.currentFile !== activeTab.path && onActiveFileChange) {
        onActiveFileChange(activeTab.path);
      }
    }
  }, [activePaneId, layoutTree, workspace.currentFile, onActiveFileChange]);

  const handleSelectTab = useCallback((paneId, tabId) => {
    setActivePaneId(paneId);
    setLayoutTree(prev => {
      const updated = setActiveTabInPane(prev, paneId, tabId);
      const targetPane = findPaneById(updated, paneId);
      const activeTab = (targetPane?.tabs || []).find(t => t.id === tabId);
      if (activeTab?.type === 'file' && activeTab.path && onActiveFileChange) {
        onActiveFileChange(activeTab.path);
      }
      return updated;
    });
  }, [setActivePaneId, setLayoutTree, onActiveFileChange]);

  const handleCloseTab = useCallback((paneId, tabId) => {
    setLayoutTree(prev => {
      const updated = removeTabFromPane(prev, paneId, tabId);
      return updated;
    });
  }, [setLayoutTree]);

  const handleSplitPane = useCallback((paneId, direction) => {
    setLayoutTree(prev => {
      const pane = findPaneById(prev, paneId);
      if (!pane) return prev;

      const activeTab = (pane.tabs || []).find(t => t.id === pane.activeTabId) || pane.tabs?.[0];
      if (!activeTab) return prev;

      // If pane has multiple tabs, move the active tab into the new split
      if ((pane.tabs || []).length > 1) {
        const moved = moveTab(prev, paneId, paneId, activeTab.id, direction === 'horizontal' ? 'right' : 'bottom');
        setActivePaneId(moved.activePaneId);
        return moved.tree;
      }

      // If pane has only 1 tab, create duplicate tab in the new split
      const duplicateTab = {
        ...activeTab,
        id: activeTab.type === 'file' ? activeTab.id : `${activeTab.id}_split_${Date.now()}`
      };
      const result = splitPane(prev, paneId, direction, duplicateTab, false);
      setActivePaneId(result.newPaneId);
      return result.tree;
    });
  }, [setLayoutTree, setActivePaneId]);

  const handleClosePane = useCallback((paneId) => {
    setLayoutTree(prev => {
      const updated = closePane(prev, paneId);
      const remainingPanes = getAllPanes(updated);
      if (remainingPanes.length > 0 && !findPaneById(updated, activePaneId)) {
        setActivePaneId(remainingPanes[0].id);
      }
      return updated;
    });
  }, [setLayoutTree, activePaneId, setActivePaneId]);

  const handleMoveTab = useCallback((sourcePaneId, targetPaneId, tabId, dropZone, targetIndex = -1) => {
    setLayoutTree(prev => {
      const result = moveTab(prev, sourcePaneId, targetPaneId, tabId, dropZone, targetIndex);
      if (result.activePaneId) {
        setActivePaneId(result.activePaneId);
      }
      return result.tree;
    });
  }, [setLayoutTree, setActivePaneId]);

  const handleAddTabToPane = useCallback((paneId, tab) => {
    setActivePaneId(paneId);
    setLayoutTree(prev => {
      const updated = addTabToPane(prev, paneId, tab);
      if (tab.type === 'file' && tab.path && onActiveFileChange) {
        onActiveFileChange(tab.path);
      }
      return updated;
    });
  }, [setActivePaneId, setLayoutTree, onActiveFileChange]);

  // Recursive Renderer for the Layout Tree
  const renderNode = (node) => {
    if (!node) return null;

    if (node.type === 'pane') {
      const isActivePane = node.id === activePaneId || totalPanes === 1;

      return (
        <ModularPane 
          key={node.id}
          pane={node}
          isActivePane={isActivePane}
          totalPanes={totalPanes}
          totalEditorPanes={totalEditorPanes}
          onActivatePane={setActivePaneId}
          dirtyFiles={dirtyFiles}
          gitStatuses={workspace.gitStatuses || {}}
          isFileSyncing={workspace.isFileSyncing}
          currentSyncingFile={workspace.currentFile}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onSplitPane={handleSplitPane}
          onClosePane={handleClosePane}
          onRunFile={onRunCode}
          onRunFileInTerminal={onRunInTerminal}
          onAddTabToPane={handleAddTabToPane}
          workspaceFiles={workspace.files || []}
          draggedTabInfo={draggedTabInfo}
          setDraggedTabInfo={setDraggedTabInfo}
          onMoveTab={handleMoveTab}
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
          settings={settings}
          editorFocusLine={editorFocusLine}
          setEditorFocusLine={setEditorFocusLine}
          handleCodeChange={handleCodeChange}
          handleSaveFile={handleSaveFile}
          stdin={stdin}
          setStdin={setStdin}
          aiStudio={aiStudio}
          handleOpenSettings={handleOpenSettings}
        />
      );
    }

    if (node.type === 'split') {
      const orientation = node.direction === 'horizontal' ? 'horizontal' : 'vertical';
      const children = node.children || [];

      return (
        <Group 
          key={node.id} 
          orientation={orientation} 
          id={node.id}
          className="w-full h-full"
        >
          {children.map((child, idx) => {
            const defaultSize = node.sizes?.[idx] ?? Math.floor(100 / children.length);

            return (
              <React.Fragment key={child.id}>
                {idx > 0 && (
                  <Separator 
                    className={`${
                      orientation === 'horizontal' 
                        ? 'w-[1px] h-full shrink-0 cursor-col-resize hover:bg-[var(--theme-accent)] transition-colors' 
                        : 'h-[1px] w-full shrink-0 cursor-row-resize hover:bg-[var(--theme-accent)] transition-colors'
                    } z-30 outline-none`}
                    style={{ backgroundColor: 'var(--theme-border, #242628)' }}
                  />
                )}
                <Panel 
                  id={child.id} 
                  minSize={12} 
                  defaultSize={defaultSize}
                  className="flex flex-col min-w-0 min-h-0 overflow-hidden"
                >
                  {renderNode(child)}
                </Panel>
              </React.Fragment>
            );
          })}
        </Group>
      );
    }

    return null;
  };

  return (
    <div 
      className="w-full h-full flex flex-col min-w-0 min-h-0 overflow-hidden relative select-none"
      style={{ backgroundColor: 'var(--theme-background, #121314)' }}
    >
      {renderNode(layoutTree)}
    </div>
  );
}
