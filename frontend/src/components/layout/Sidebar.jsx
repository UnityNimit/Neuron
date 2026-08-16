// src/components/layout/Sidebar.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FolderOpen, Folder, FileCode2, X, ChevronRight, ChevronDown, 
  FilePlus, FolderPlus, RefreshCw, ListCollapse 
} from 'lucide-react';
import ExplorerContextMenu from './ExplorerContextMenu';

export default function Sidebar({ 
  items = [], currentFile, absTargetDir, gitStatuses = {}, 
  onSwitchFile, onCreateItem, onDeleteFile, onRenameItem, onMoveItem, 
  onRevealExplorer, onRunFile, onRefresh 
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [isRootCollapsed, setIsRootCollapsed] = useState(false); // NEW: Root toggler
  const [clipboard, setClipboard] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  
  // Context tracking and Inline Input States
  const [selectedPath, setSelectedPath] = useState(null);
  const [inlineCreate, setInlineCreate] = useState(null); 
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  const rootFolderName = useMemo(() => absTargetDir ? absTargetDir.split(/[/\\]/).pop().toUpperCase() : "WORKSPACE", [absTargetDir]);

  // SMART GIT FOLDER STATUS CALCULATION (Propagates 'M' up to parent folders)
  const folderGitStatus = useMemo(() => {
    const fStatus = {};
    Object.entries(gitStatuses).forEach(([filePath, status]) => {
      const parts = filePath.split('/');
      let current = "";
      for(let i=0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        fStatus[current] = "M"; 
      }
    });
    return fStatus;
  }, [gitStatuses]);

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

  // Handle outside clicks to cancel inline creation
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (inlineCreate && inputRef.current && !inputRef.current.contains(e.target)) {
        setInlineCreate(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [inlineCreate]);

  const handleInitiateCreate = (type) => {
    setIsRootCollapsed(false); // Ensure root is open to see the new file
    let parentPath = "";
    if (selectedPath) {
      const selectedItem = items.find(i => i.path === selectedPath);
      parentPath = selectedItem?.type === 'folder' ? selectedPath : (selectedPath.includes('/') ? selectedPath.substring(0, selectedPath.lastIndexOf('/')) : "");
    }
    if (parentPath && collapsedFolders[parentPath]) setCollapsedFolders(prev => ({ ...prev, [parentPath]: false }));
    setInlineCreate({ type, parentPath });
    setInputValue("");
  };

  const commitInlineCreate = (name) => {
    if (name.trim() && inlineCreate) {
      onCreateItem(inlineCreate.parentPath ? `${inlineCreate.parentPath}/${name.trim()}` : name.trim(), inlineCreate.type);
    }
    setInlineCreate(null);
  };

  const itemsToRender = [];
  let inputInserted = false;
  visibleItems.forEach(item => {
    itemsToRender.push(item);
    if (inlineCreate && item.path === inlineCreate.parentPath) {
      itemsToRender.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });
      inputInserted = true;
    }
  });
  if (inlineCreate && !inputInserted && inlineCreate.parentPath === "") itemsToRender.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });

  return (
    <div 
      className="w-full h-full bg-[#1e1e1e] flex flex-col select-none relative font-sans"
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedPath(null); setContextMenu({ x: e.clientX, y: e.clientY, item: { path: "", type: "folder" } }); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragOverPath !== "") setDragOverPath(""); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(null); const p = e.dataTransfer.getData("text/plain"); if (p) onMoveItem(p, ""); }}
      onClick={() => setSelectedPath(null)}
    >
      {/* Top Header Actions */}
      <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-slate-400 flex items-center justify-between uppercase shrink-0">
        <div className="flex items-center gap-1.5"> Explorer</div>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleInitiateCreate('file')} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="New File"><FilePlus size={13} /></button>
          <button onClick={() => handleInitiateCreate('folder')} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="New Folder"><FolderPlus size={13} /></button>
          <button onClick={onRefresh} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="Refresh"><RefreshCw size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); const all = items.filter(i => i.type === 'folder').reduce((acc, curr) => { acc[curr.path] = true; return acc; }, {}); setCollapsedFolders(all); setSelectedPath(null); }} className="p-1 hover:bg-[#2a2d31] hover:text-white rounded transition-colors" title="Collapse All Folders"><ListCollapse size={13} /></button>
        </div>
      </div>

      {/* Flawless VS Code Root Folder Alignment */}
      <div 
        className="px-1 py-0.5 text-[11px] font-bold text-slate-300 tracking-wider flex items-center gap-0.5 shrink-0 hover:bg-[#2a2d31] cursor-pointer transition-colors border-b border-transparent focus:border-blue-500" 
        onClick={() => setIsRootCollapsed(!isRootCollapsed)}
      >
        {isRootCollapsed ? <ChevronRight size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        {rootFolderName}
      </div>

      {/* File Tree Canvas */}
      {!isRootCollapsed && (
        <div className="flex-grow overflow-y-auto pb-4 outline-none">
          {itemsToRender.map(item => {
            
            // === INLINE INPUT RENDERER ===
            if (item.isInlineInput) {
              const depth = item.parentPath ? (item.parentPath.match(/\//g) || []).length + 1 : 0;
              return (
                <div key="inline-input" style={{ paddingLeft: `${(depth * 14) + 8}px` }} className="relative flex items-center gap-1.5 pr-2 py-1 bg-[#37373d]">
                  {Array.from({ length: depth }).map((_, i) => <div key={i} style={{ left: `${(i * 14) + 14}px` }} className="absolute top-0 bottom-0 w-[1px] bg-[#333]" />)}
                  <div className="w-[14px]" />
                  {item.type === 'folder' ? <Folder size={14} className="text-[#dcb67a] shrink-0" /> : <FileCode2 size={14} className="text-slate-500 shrink-0" />}
                  <input ref={inputRef} autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitInlineCreate(inputValue); if (e.key === 'Escape') setInlineCreate(null); }} className="w-full bg-[#1e1e1e] text-[#cccccc] text-[13px] border border-[#007fd4] outline-none px-1 rounded-sm shadow-sm" />
                </div>
              );
            }

            // === NORMAL RENDERER ===
            const isFolder = item.type === 'folder';
            const depth = (item.path.match(/\//g) || []).length;
            const isSelected = selectedPath === item.path;

            // NATIVE GIT STATUS CALCULATION
            const gStatus = isFolder ? folderGitStatus[item.path] : gitStatuses[item.path];
            let gitColor = 'text-slate-300';
            let badgeColor = '';
            
            if (gStatus === 'U' || gStatus === 'A') { gitColor = 'text-[#73c991]'; badgeColor = 'text-[#73c991]'; }
            else if (gStatus === 'M') { gitColor = 'text-[#e2c08d]'; badgeColor = 'text-[#e2c08d]'; }
            else if (gStatus === 'D') { gitColor = 'text-[#f14c4c]'; badgeColor = 'text-[#f14c4c]'; }

            // Active File overrides normal color but keeps selection color if clicked
            if (currentFile === item.path && !isFolder && gitColor === 'text-slate-300') {
              gitColor = 'text-blue-400 font-medium';
            }

            return (
              <div 
                key={item.path} draggable 
                onDragStart={(e) => e.dataTransfer.setData("text/plain", item.path)} 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragOverPath !== item.path) setDragOverPath(item.path); }} 
                onDragLeave={() => setDragOverPath(null)} 
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(null); const p = e.dataTransfer.getData("text/plain"); if (p && p !== item.path && isFolder) onMoveItem(p, item.path); }} 
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedPath(item.path); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                onClick={(e) => { e.stopPropagation(); setSelectedPath(item.path); if (isFolder) setCollapsedFolders(prev => ({ ...prev, [item.path]: !prev[item.path] })); else onSwitchFile(item.path); }}
                style={{ paddingLeft: `${(depth * 14) + 8}px` }}
                className={`relative flex items-center justify-between pr-2 py-0.5 cursor-pointer text-[13px] group transition-colors ${dragOverPath === item.path ? 'bg-blue-600/40 border border-blue-500' : isSelected ? 'bg-[#37373d] text-white font-medium' : 'hover:bg-[#2a2d31] border border-transparent'}`}
              >
                {/* VS Code Indentation Lines */}
                {Array.from({ length: depth }).map((_, i) => <div key={i} style={{ left: `${(i * 14) + 14}px` }} className="absolute top-0 bottom-0 w-[1px] bg-[#333] group-hover:bg-[#4d4d4d]" />)}

                <div className="flex items-center gap-1.5 overflow-hidden z-10">
                  {isFolder ? (
                    <>{collapsedFolders[item.path] ? <ChevronRight size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}<Folder size={14} className="text-[#dcb67a] shrink-0" /></>
                  ) : (
                    <><div className="w-[14px] shrink-0" /><FileCode2 size={14} className={currentFile === item.path ? "text-[#519aba] shrink-0" : "text-slate-500 shrink-0"} /></>
                  )}
                  {/* Applied dynamically computed Git Color */}
                  <span className={`truncate ${gitColor}`}>{item.path.split('/').pop()}</span>
                </div>

                {/* Git Badges & Delete Button (Hover interaction) */}
                <div className="flex items-center gap-1 shrink-0 z-10 bg-inherit pl-1">
                  {gStatus && <span className={`text-[10px] font-bold ${badgeColor} group-hover:hidden transition-opacity`}>{gStatus}</span>}
                  <button onClick={(e) => { e.stopPropagation(); onDeleteFile(item.path, e); }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5" title="Delete"><X size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu Popup */}
      {contextMenu && (
        <ExplorerContextMenu x={contextMenu.x} y={contextMenu.y} item={contextMenu.item} absPath={absTargetDir} onClose={() => setContextMenu(null)} onRun={(path) => onRunFile(path)} onOpenSide={(path) => onSwitchFile(path)} onRename={(item) => onRenameItem(item)} onDelete={(path) => onDeleteFile(path)} onCopyPath={(relPath) => navigator.clipboard.writeText(absTargetDir ? `${absTargetDir}/${relPath}`.replace(/\\/g, '/') : relPath)} onCopyRelPath={(relPath) => navigator.clipboard.writeText(relPath)} onReveal={(path) => onRevealExplorer(path)} onCut={(item) => setClipboard({ item, action: 'cut' })} onCopy={(item) => setClipboard({ item, action: 'copy' })} onPaste={(folder) => { if (clipboard) onMoveItem(clipboard.item.path, folder.path); }} hasClipboard={!!clipboard} />
      )}
    </div>
  );
}