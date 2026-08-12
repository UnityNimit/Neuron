// src/components/layout/Sidebar.jsx
import React, { useState } from 'react';
import { FolderOpen, Folder, FileCode2, Plus, X, ChevronRight, ChevronDown } from 'lucide-react';
import ExplorerContextMenu from './ExplorerContextMenu';

export default function Sidebar({ 
  items = [], currentFile, absTargetDir, onSwitchFile, onCreateFile, onDeleteFile, 
  onRenameItem, onMoveItem, onRevealExplorer, onRunFile 
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [clipboard, setClipboard] = useState(null);

  // Right Click Handler
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Toggle Folder Open/Closed
  const toggleFolder = (folderPath, e) => {
    e.stopPropagation();
    setCollapsedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, itemPath) => {
    e.dataTransfer.setData("text/plain", itemPath);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Required to allow drop
  };

  const handleDrop = (e, targetFolderPath) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedPath = e.dataTransfer.getData("text/plain");
    if (draggedPath && draggedPath !== targetFolderPath) {
      onMoveItem(draggedPath, targetFolderPath);
    }
  };

  // Clipboard Helpers
  const copyPath = (relPath) => {
    const full = absTargetDir ? `${absTargetDir}/${relPath}`.replace(/\\/g, '/') : relPath;
    navigator.clipboard.writeText(full);
  };

  const copyRelPath = (relPath) => {
    navigator.clipboard.writeText(relPath);
  };

  return (
    <div 
      className="w-full h-full bg-[#1e1e1e] flex flex-col select-none relative"
      onContextMenu={(e) => handleContextMenu(e, { path: "", type: "folder" })}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, "")} // Drop in root directory
    >
      {/* Header */}
      <div className="p-3 text-[11px] font-bold tracking-widest text-slate-400 flex items-center justify-between uppercase shrink-0 border-b border-[#2b2d31]">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} /> Explorer
        </div>
        <button onClick={onCreateFile} className="hover:text-white transition-colors" title="New File / Folder">
          <Plus size={16} />
        </button>
      </div>

      {/* File & Folder Tree */}
      <div className="flex-grow overflow-y-auto px-1 py-2">
        {items.map(item => {
          const isFolder = item.type === 'folder';
          const isCollapsed = collapsedFolders[item.path];
          const depth = (item.path.match(/\//g) || []).length;

          return (
            <div 
              key={item.path}
              draggable
              onDragStart={(e) => handleDragStart(e, item.path)}
              onDragOver={handleDragOver}
              onDrop={(e) => isFolder ? handleDrop(e, item.path) : null}
              onContextMenu={(e) => handleContextMenu(e, item)}
              onClick={(e) => isFolder ? toggleFolder(item.path, e) : onSwitchFile(item.path)}
              style={{ paddingLeft: `${(depth + 1) * 12}px` }}
              className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs mb-0.5 group transition-all ${
                currentFile === item.path 
                  ? 'bg-blue-600/20 text-blue-400 font-medium' 
                  : 'hover:bg-[#2a2d31] text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                {isFolder ? (
                  <>
                    {isCollapsed ? <ChevronRight size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                    <Folder size={14} className="text-blue-400 shrink-0" />
                  </>
                ) : (
                  <FileCode2 size={14} className={currentFile === item.path ? "text-blue-400 shrink-0" : "text-slate-500 shrink-0"} />
                )}
                <span className="truncate">{item.path.split('/').pop()}</span>
              </div>

              <button 
                onClick={(e) => onDeleteFile(item.path, e)} 
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5"
                title="Delete"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          absPath={absTargetDir}
          onClose={() => setContextMenu(null)}
          onRun={(path) => onRunFile(path)}
          onOpenSide={(path) => onSwitchFile(path)}
          onRename={(item) => onRenameItem(item)}
          onDelete={(path) => onDeleteFile(path)}
          onCopyPath={copyPath}
          onCopyRelPath={copyRelPath}
          onReveal={(path) => onRevealExplorer(path)}
          onCut={(item) => setClipboard({ item, action: 'cut' })}
          onCopy={(item) => setClipboard({ item, action: 'copy' })}
          onPaste={(folder) => {
            if (clipboard) onMoveItem(clipboard.item.path, folder.path);
          }}
          hasClipboard={!!clipboard}
        />
      )}
    </div>
  );
}