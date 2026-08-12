// src/components/layout/Sidebar.jsx
import React, { useState, useMemo } from 'react';
import { 
  FolderOpen, Folder, FileCode2, X, ChevronRight, ChevronDown, 
  FilePlus, FolderPlus, RefreshCw, ListCollapse 
} from 'lucide-react';
import ExplorerContextMenu from './ExplorerContextMenu';

export default function Sidebar({ 
  items = [], currentFile, absTargetDir, onSwitchFile, 
  onCreateItemClick, onDeleteFile, onRenameItem, onMoveItem, 
  onRevealExplorer, onRunFile, onRefresh 
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [clipboard, setClipboard] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);

  // Extract the name of the folder you opened to display in bold at the top
  const rootFolderName = useMemo(() => {
    if (!absTargetDir) return "WORKSPACE";
    // Handles both Windows (\) and Mac/Linux (/) paths
    return absTargetDir.split(/[/\\]/).pop().toUpperCase();
  }, [absTargetDir]);

  // Compute which files are not hidden inside collapsed folders
  const visibleItems = useMemo(() => {
    return items.filter(item => {
      const parts = item.path.split('/');
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        if (collapsedFolders[currentPath]) return false;
      }
      return true;
    });
  }, [items, collapsedFolders]);

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const toggleFolder = (folderPath, e) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  const handleCollapseAll = () => {
    const allFolders = items.filter(i => i.type === 'folder').reduce((acc, curr) => {
      acc[curr.path] = true;
      return acc;
    }, {});
    setCollapsedFolders(allFolders);
  };

  const handleDragStart = (e, itemPath) => e.dataTransfer.setData("text/plain", itemPath);
  const handleDragOver = (e, path, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'folder' && dragOverPath !== path) setDragOverPath(path);
  };
  const handleDragLeave = () => setDragOverPath(null);
  const handleDrop = (e, targetFolderPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const draggedPath = e.dataTransfer.getData("text/plain");
    if (draggedPath && draggedPath !== targetFolderPath && !targetFolderPath.startsWith(draggedPath + '/')) {
      onMoveItem(draggedPath, targetFolderPath);
    }
  };

  return (
    <div 
      className="w-full h-full bg-[#1e1e1e] flex flex-col select-none relative font-sans"
      onContextMenu={(e) => handleContextMenu(e, { path: "", type: "folder" })}
      onDragOver={(e) => handleDragOver(e, "", "folder")}
      onDrop={(e) => handleDrop(e, "")}
      onDragLeave={handleDragLeave}
    >
      {/* Top Action Bar */}
      <div className="p-2 text-[11px] font-bold tracking-widest text-slate-400 flex items-center justify-between uppercase shrink-0 border-b border-[#2b2d31]">
        <div className="flex items-center gap-2 pl-1">
          <FolderOpen size={14} /> Explorer
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onCreateItemClick('file')} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="New File"><FilePlus size={14} /></button>
          <button onClick={() => onCreateItemClick('folder')} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="New Folder"><FolderPlus size={14} /></button>
          <button onClick={onRefresh} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="Refresh Explorer"><RefreshCw size={14} /></button>
          <button onClick={handleCollapseAll} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="Collapse Folders"><ListCollapse size={14} /></button>
        </div>
      </div>

      {/* Root Folder Title */}
      <div className="px-3 py-2 text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1.5 shrink-0 hover:bg-[#2a2d31] transition-colors cursor-pointer" onClick={handleCollapseAll}>
        <ChevronDown size={14} className="text-slate-500" />
        {rootFolderName}
      </div>

      {/* File & Folder Tree */}
      <div className="flex-grow overflow-y-auto pb-4">
        {visibleItems.map(item => {
          const isFolder = item.type === 'folder';
          const isCollapsed = collapsedFolders[item.path];
          const depth = (item.path.match(/\//g) || []).length;
          const isDragTarget = dragOverPath === item.path;

          return (
            <div 
              key={item.path}
              draggable
              onDragStart={(e) => handleDragStart(e, item.path)}
              onDragOver={(e) => handleDragOver(e, item.path, item.type)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => isFolder ? handleDrop(e, item.path) : null}
              onContextMenu={(e) => handleContextMenu(e, item)}
              onClick={(e) => isFolder ? toggleFolder(item.path, e) : onSwitchFile(item.path)}
              style={{ paddingLeft: `${(depth * 14) + 8}px` }} // Dynamic indent calculation
              className={`relative flex items-center justify-between pr-2 py-1 cursor-pointer text-[13px] group transition-colors ${
                isDragTarget 
                  ? 'bg-blue-600/40 border border-blue-500'
                  : currentFile === item.path && !isFolder
                    ? 'bg-[#37373d] text-blue-400 font-medium' // VS Code active file color
                    : 'hover:bg-[#2a2d31] text-slate-300 border border-transparent'
              }`}
            >
              {/* Vertical Tree Guide Lines (Just like VS Code!) */}
              {Array.from({ length: depth }).map((_, i) => (
                <div 
                  key={i} 
                  style={{ left: `${(i * 14) + 14}px` }} 
                  className="absolute top-0 bottom-0 w-[1px] bg-[#333] group-hover:bg-[#4d4d4d] transition-colors"
                />
              ))}

              {/* Icon & File Name */}
              <div className="flex items-center gap-1.5 overflow-hidden z-10">
                {isFolder ? (
                  <>
                    {isCollapsed ? <ChevronRight size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                    <Folder size={14} className="text-[#dcb67a] shrink-0" /> {/* VS Code Folder Color */}
                  </>
                ) : (
                  <>
                    <div className="w-[14px]" /> {/* Aligns files perfectly under folders */}
                    <FileCode2 size={14} className={currentFile === item.path ? "text-[#519aba] shrink-0" : "text-slate-500 shrink-0"} />
                  </>
                )}
                <span className="truncate">{item.path.split('/').pop()}</span>
              </div>

              {/* Delete Icon (Visible on Hover) */}
              <button 
                onClick={(e) => onDeleteFile(item.path, e)} 
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5 z-10"
                title="Delete"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x} y={contextMenu.y} item={contextMenu.item} absPath={absTargetDir}
          onClose={() => setContextMenu(null)} onRun={(path) => onRunFile(path)} onOpenSide={(path) => onSwitchFile(path)}
          onRename={(item) => onRenameItem(item)} onDelete={(path) => onDeleteFile(path)}
          onCopyPath={(relPath) => navigator.clipboard.writeText(absTargetDir ? `${absTargetDir}/${relPath}`.replace(/\\/g, '/') : relPath)}
          onCopyRelPath={(relPath) => navigator.clipboard.writeText(relPath)} onReveal={(path) => onRevealExplorer(path)}
          onCut={(item) => setClipboard({ item, action: 'cut' })} onCopy={(item) => setClipboard({ item, action: 'copy' })}
          onPaste={(folder) => { if (clipboard) onMoveItem(clipboard.item.path, folder.path); }} hasClipboard={!!clipboard}
        />
      )}
    </div>
  );
}