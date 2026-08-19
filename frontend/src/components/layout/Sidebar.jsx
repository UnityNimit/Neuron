// src/components/layout/Sidebar.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Folder, FileCode2, X, ChevronRight, ChevronDown, 
  FilePlus, FolderPlus, RefreshCw, ListCollapse 
} from 'lucide-react';
import ExplorerContextMenu from './ExplorerContextMenu';

export default function Sidebar({ 
  items = [], 
  currentFile = "", 
  absTargetDir = "", 
  gitStatuses = {}, 
  onSwitchFile, 
  onCreateItem, 
  onDeleteFile, 
  onRenameItem, 
  onMoveItem, 
  onRevealExplorer, 
  onRunFile, 
  onRefresh 
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [isRootCollapsed, setIsRootCollapsed] = useState(false);
  const [clipboard, setClipboard] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  
  // Selection, Creation, and Inline Renaming States
  const [selectedPath, setSelectedPath] = useState(null);
  const [inlineCreate, setInlineCreate] = useState(null); 
  const [inputValue, setInputValue] = useState("");
  
  const [inlineRename, setInlineRename] = useState(null); // { item, originalName }
  const [renameValue, setRenameValue] = useState("");
  
  const inputRef = useRef(null);
  const renameInputRef = useRef(null);

  const rootFolderName = useMemo(() => {
    return absTargetDir ? absTargetDir.split(/[/\\]/).pop().toUpperCase() : "WORKSPACE";
  }, [absTargetDir]);

  // SMART GIT FOLDER STATUS (Propagates 'M' & 'U' indicators up to parent folders)
  const folderGitStatus = useMemo(() => {
    const fStatus = {};
    Object.entries(gitStatuses || {}).forEach(([filePath, status]) => {
      const parts = filePath.split('/');
      let current = "";
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        fStatus[current] = status === 'U' ? 'U' : 'M'; 
      }
    });
    return fStatus;
  }, [gitStatuses]);

  const visibleItems = useMemo(() => {
    return (items || []).filter(item => {
      const parts = item.path.split('/');
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        if (collapsedFolders[currentPath]) return false;
      }
      return true;
    });
  }, [items, collapsedFolders]);

  // Handle outside clicks to cancel inline creation or renaming
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (inlineCreate && inputRef.current && !inputRef.current.contains(e.target)) {
        setInlineCreate(null);
      }
      if (inlineRename && renameInputRef.current && !renameInputRef.current.contains(e.target)) {
        setInlineRename(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [inlineCreate, inlineRename]);

  // Auto-focus and highlight filename on inline rename
  useEffect(() => {
    if (inlineRename && renameInputRef.current) {
      renameInputRef.current.focus();
      const val = renameInputRef.current.value;
      const dotIdx = val.lastIndexOf('.');
      if (dotIdx > 0 && inlineRename.item.type === 'file') {
        renameInputRef.current.setSelectionRange(0, dotIdx);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [inlineRename]);

  // -------------------------------------------------------------------------
  // 1. INLINE CREATION HANDLERS
  // -------------------------------------------------------------------------
  const handleInitiateCreate = (type) => {
    setIsRootCollapsed(false);
    let parentPath = "";
    if (selectedPath) {
      const selectedItem = (items || []).find(i => i.path === selectedPath);
      parentPath = selectedItem?.type === 'folder' 
        ? selectedPath 
        : (selectedPath.includes('/') ? selectedPath.substring(0, selectedPath.lastIndexOf('/')) : "");
    }
    if (parentPath && collapsedFolders[parentPath]) {
      setCollapsedFolders(prev => ({ ...prev, [parentPath]: false }));
    }
    setInlineCreate({ type, parentPath });
    setInputValue("");
  };

  const commitInlineCreate = (name) => {
    if (name.trim() && inlineCreate && onCreateItem) {
      const fullItemPath = inlineCreate.parentPath 
        ? `${inlineCreate.parentPath}/${name.trim()}` 
        : name.trim();
      onCreateItem(fullItemPath, inlineCreate.type);
    }
    setInlineCreate(null);
  };

  // -------------------------------------------------------------------------
  // 2. INLINE RENAMING HANDLERS (F2 & Context Menu)
  // -------------------------------------------------------------------------
  const handleInitiateRename = (item) => {
    if (!item) return;
    const name = item.path.split('/').pop();
    setInlineRename({ item, originalName: name });
    setRenameValue(name);
  };

  const commitInlineRename = (newName) => {
    if (newName.trim() && inlineRename && onRenameItem) {
      const oldPath = inlineRename.item.path;
      const parentDir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : "";
      const newPath = parentDir ? `${parentDir}/${newName.trim()}` : newName.trim();
      if (oldPath !== newPath) {
        onRenameItem({
          old_path: oldPath,
          new_path: newPath,
          path: oldPath,
          newPath: newPath,
          type: inlineRename.item.type
        });
      }
    }
    setInlineRename(null);
  };

  // Handle global F2 keyboard shortcut on selected item
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2' && selectedPath && !inlineRename && !inlineCreate) {
        const item = (items || []).find(i => i.path === selectedPath);
        if (item) handleInitiateRename(item);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPath, items, inlineRename, inlineCreate]);

  const itemsToRender = [];
  let inputInserted = false;
  visibleItems.forEach(item => {
    itemsToRender.push(item);
    if (inlineCreate && item.path === inlineCreate.parentPath) {
      itemsToRender.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });
      inputInserted = true;
    }
  });
  if (inlineCreate && !inputInserted && inlineCreate.parentPath === "") {
    itemsToRender.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });
  }

  return (
    <div 
      className="w-full h-full bg-[#191a1b] flex flex-col select-none relative font-sans text-slate-300 border-r border-[#242628]"
      onContextMenu={(e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        setSelectedPath(null); 
        setContextMenu({ x: e.clientX, y: e.clientY, item: { path: "", type: "folder" } }); 
      }}
      onDragOver={(e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        if (dragOverPath !== "") setDragOverPath(""); 
      }}
      onDrop={(e) => { 
        e.preventDefault(); 
        e.stopPropagation(); 
        setDragOverPath(null); 
        const p = e.dataTransfer.getData("text/plain"); 
        if (p && onMoveItem) onMoveItem(p, ""); 
      }}
      onClick={() => setSelectedPath(null)}
    >
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP HEADER & ACTION ICONS                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="h-8 px-3 text-[10px] font-mono font-bold tracking-widest text-slate-400 flex items-center justify-between uppercase shrink-0 border-b border-[#242628]">
        <span className="text-slate-300 font-semibold tracking-wider">Explorer</span>
        
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => handleInitiateCreate('file')} 
            className="p-1 hover:bg-[#242628] hover:text-white rounded-md transition-colors text-slate-400 cursor-pointer" 
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button 
            onClick={() => handleInitiateCreate('folder')} 
            className="p-1 hover:bg-[#242628] hover:text-white rounded-md transition-colors text-slate-400 cursor-pointer" 
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button 
            onClick={onRefresh} 
            className="p-1 hover:bg-[#242628] hover:text-white rounded-md transition-colors text-slate-400 cursor-pointer" 
            title="Refresh Explorer"
          >
            <RefreshCw size={12} />
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              const all = (items || []).filter(i => i.type === 'folder').reduce((acc, curr) => { 
                acc[curr.path] = true; 
                return acc; 
              }, {}); 
              setCollapsedFolders(all); 
              setSelectedPath(null); 
            }} 
            className="p-1 hover:bg-[#242628] hover:text-white rounded-md transition-colors text-slate-400 cursor-pointer" 
            title="Collapse All Folders"
          >
            <ListCollapse size={13} />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. ROOT WORKSPACE FOLDER TOGGLER                                  */}
      {/* ----------------------------------------------------------------- */}
      <div 
        className="px-2 py-1 text-[11px] font-mono font-bold text-slate-300 tracking-wider flex items-center gap-1 shrink-0 hover:bg-[#222426] cursor-pointer transition-colors" 
        onClick={() => setIsRootCollapsed(!isRootCollapsed)}
      >
        {isRootCollapsed ? (
          <ChevronRight size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
        <span className="truncate">{rootFolderName}</span>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. MINIMALIST FILE TREE (Super Clean Unboxed Git Badges)          */}
      {/* ----------------------------------------------------------------- */}
      {!isRootCollapsed && (
        <div className="flex-grow overflow-y-auto pb-4 outline-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-[#191a1b] [&::-webkit-scrollbar-thumb]:bg-[#2a2c2e] [&::-webkit-scrollbar-thumb:hover]:bg-[#3b82f6]">
          {itemsToRender.map(item => {
            
            // === A. INLINE FILE CREATION ROW ===
            if (item.isInlineInput) {
              const depth = item.parentPath ? (item.parentPath.match(/\//g) || []).length + 1 : 0;
              return (
                <div 
                  key="inline-input" 
                  style={{ paddingLeft: `${(depth * 14) + 8}px` }} 
                  className="relative flex items-center gap-1.5 pr-2 py-1 bg-[#26282a]"
                >
                  {Array.from({ length: depth }).map((_, i) => (
                    <div 
                      key={i} 
                      style={{ left: `${(i * 14) + 14}px` }} 
                      className="absolute top-0 bottom-0 w-[1px] bg-[#2a2c2e]" 
                    />
                  ))}
                  <div className="w-[14px]" />
                  {item.type === 'folder' ? (
                    <Folder size={13} className="text-[#dcb67a] shrink-0" />
                  ) : (
                    <FileCode2 size={13} className="text-slate-400 shrink-0" />
                  )}
                  <input 
                    ref={inputRef} 
                    autoFocus 
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)} 
                    onKeyDown={e => { 
                      if (e.key === 'Enter') commitInlineCreate(inputValue); 
                      if (e.key === 'Escape') setInlineCreate(null); 
                    }} 
                    className="w-full bg-[#121314] text-[#e2e8f0] text-[12px] font-mono border border-blue-500 outline-none px-1.5 py-0.5 rounded shadow-inner" 
                  />
                </div>
              );
            }

            // === B. NORMAL TREE ROW (With Clean Unboxed Git Status) ===
            const isFolder = item.type === 'folder';
            const depth = (item.path.match(/\//g) || []).length;
            const isSelected = selectedPath === item.path;
            const isActiveFile = currentFile === item.path && !isFolder;
            const isBeingRenamed = inlineRename?.item?.path === item.path;

            // 🚀 CLEAN MINIMALIST GIT STATUS COMPUTATION (No Boxes, No Borders)
            const gStatus = isFolder ? folderGitStatus[item.path] : (gitStatuses || {})[item.path];
            let gitColor = 'text-slate-300';
            let badgeColor = '';
            
            if (gStatus === 'U' || gStatus === 'A') { 
              gitColor = 'text-emerald-400'; 
              badgeColor = 'text-emerald-400'; // Clean unboxed green
            } else if (gStatus === 'M') { 
              gitColor = 'text-amber-400'; 
              badgeColor = 'text-amber-400';   // Clean unboxed orange-yellow
            } else if (gStatus === 'D') { 
              gitColor = 'text-red-400'; 
              badgeColor = 'text-red-400';     // Clean unboxed red
            }

            if (isActiveFile && gitColor === 'text-slate-300') {
              gitColor = 'text-blue-400 font-semibold';
            }

            return (
              <div 
                key={item.path} 
                draggable={!isBeingRenamed}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", item.path)} 
                onDragOver={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  if (dragOverPath !== item.path) setDragOverPath(item.path); 
                }} 
                onDragLeave={() => setDragOverPath(null)} 
                onDrop={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setDragOverPath(null); 
                  const p = e.dataTransfer.getData("text/plain"); 
                  if (p && p !== item.path && isFolder && onMoveItem) onMoveItem(p, item.path); 
                }} 
                onContextMenu={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setSelectedPath(item.path); 
                  setContextMenu({ x: e.clientX, y: e.clientY, item }); 
                }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelectedPath(item.path); 
                  if (!isBeingRenamed) {
                    if (isFolder) {
                      setCollapsedFolders(prev => ({ ...prev, [item.path]: !prev[item.path] })); 
                    } else if (onSwitchFile) {
                      onSwitchFile(item.path); 
                    }
                  }
                }}
                style={{ paddingLeft: `${(depth * 14) + 8}px` }}
                className={`relative flex items-center justify-between pr-2 py-1 cursor-pointer text-[12px] font-mono group transition-colors ${
                  dragOverPath === item.path 
                    ? 'bg-blue-600/30 border border-blue-500/50' 
                    : isSelected 
                      ? 'bg-[#282a2d] text-white font-medium' 
                      : isActiveFile
                        ? 'bg-[#202224] text-white'
                        : 'hover:bg-[#202224] border border-transparent'
                }`}
              >
                {/* Visual Indentation Guide Lines */}
                {Array.from({ length: depth }).map((_, i) => (
                  <div 
                    key={i} 
                    style={{ left: `${(i * 14) + 14}px` }} 
                    className="absolute top-0 bottom-0 w-[1px] bg-[#242628] group-hover:bg-[#343638]" 
                  />
                ))}

                <div className="flex items-center gap-1.5 overflow-hidden z-10 flex-1 mr-1">
                  {isFolder ? (
                    <>
                      {collapsedFolders[item.path] ? (
                        <ChevronRight size={13} className="text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown size={13} className="text-slate-500 shrink-0" />
                      )}
                      <Folder size={13} className="text-[#dcb67a] shrink-0" />
                    </>
                  ) : (
                    <>
                      <div className="w-[13px] shrink-0" />
                      <FileCode2 size={13} className={isActiveFile ? "text-blue-400 shrink-0" : "text-slate-500 shrink-0"} />
                    </>
                  )}
                  
                  {/* Inline Renaming Input vs Static Filename */}
                  {isBeingRenamed ? (
                    <input 
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitInlineRename(renameValue);
                        if (e.key === 'Escape') setInlineRename(null);
                      }}
                      className="w-full bg-[#121314] text-[#e2e8f0] text-[12px] font-mono border border-blue-500 outline-none px-1 rounded shadow-inner"
                    />
                  ) : (
                    <span className={`truncate text-xs ${gitColor}`}>
                      {item.path.split('/').pop()}
                    </span>
                  )}
                </div>

                {/* 🚀 CLEAN UNBOXED GIT BADGES (No Boxes, No Borders) */}
                {!isBeingRenamed && (
                  <div className="flex items-center gap-1.5 shrink-0 z-10 bg-inherit pl-1">
                    {gStatus && (
                      <span className={`text-[11px] font-mono font-bold ${badgeColor} group-hover:hidden transition-opacity pr-0.5`}>
                        {gStatus}
                      </span>
                    )}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onDeleteFile) onDeleteFile(item.path, e); 
                      }} 
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5 rounded" 
                      title="Delete"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. CONTEXT MENU POPUP (Connected to Inline Rename)                */}
      {/* ----------------------------------------------------------------- */}
      {contextMenu && (
        <ExplorerContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          item={contextMenu.item} 
          absPath={absTargetDir} 
          onClose={() => setContextMenu(null)} 
          onRun={(path) => onRunFile && onRunFile(path)} 
          onOpenSide={(path) => onSwitchFile && onSwitchFile(path)} 
          onRename={(item) => handleInitiateRename(item)} 
          onDelete={(path) => onDeleteFile && onDeleteFile(path)} 
          onCopyPath={(relPath) => navigator.clipboard.writeText(absTargetDir ? `${absTargetDir}/${relPath}`.replace(/\\/g, '/') : relPath)} 
          onCopyRelPath={(relPath) => navigator.clipboard.writeText(relPath)} 
          onReveal={(path) => onRevealExplorer && onRevealExplorer(path)} 
          onCut={(item) => setClipboard({ item, action: 'cut' })} 
          onCopy={(item) => setClipboard({ item, action: 'copy' })} 
          onPaste={(folder) => { 
            if (clipboard && onMoveItem) onMoveItem(clipboard.item.path, folder.path); 
          }} 
          hasClipboard={!!clipboard} 
        />
      )}
    </div>
  );
}