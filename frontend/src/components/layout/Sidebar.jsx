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
  dirtyFiles = new Set(),
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
  const loadedDirRef = useRef(null);

  // Storage key per workspace directory to remember expanded/collapsed folder states
  const storageKey = useMemo(() => {
    return absTargetDir ? `neuron_explorer_collapsed_${absTargetDir.replace(/[\\/]/g, '_')}` : null;
  }, [absTargetDir]);

  // Load from localStorage or initialize with VS Code-like default (all subfolders collapsed)
  useEffect(() => {
    if (!absTargetDir) return;
    
    // Check if switching workspace directory
    if (loadedDirRef.current !== absTargetDir) {
      loadedDirRef.current = absTargetDir;
      let restored = null;
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) restored = JSON.parse(saved);
        } catch (e) {}
      }

      if (restored && typeof restored === 'object') {
        setCollapsedFolders(restored);
      } else if (items && items.length > 0) {
        // VS Code Default: collapse all folders initially so top level is clean
        const initial = {};
        items.forEach(i => {
          if (i.type === 'folder') {
            initial[i.path] = true;
          }
        });
        setCollapsedFolders(initial);
      }
    } else if (items && items.length > 0 && Object.keys(collapsedFolders).length === 0) {
      // First load when items arrive for current workspace
      let restored = null;
      if (storageKey) {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) restored = JSON.parse(saved);
        } catch (e) {}
      }
      if (restored && typeof restored === 'object') {
        setCollapsedFolders(restored);
      } else {
        const initial = {};
        items.forEach(i => {
          if (i.type === 'folder') {
            initial[i.path] = true;
          }
        });
        setCollapsedFolders(initial);
      }
    }
  }, [absTargetDir, storageKey, items]);

  // Persist collapsedFolders to localStorage on changes
  useEffect(() => {
    if (storageKey && Object.keys(collapsedFolders).length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(collapsedFolders));
      } catch (e) {}
    }
  }, [collapsedFolders, storageKey]);

  // Auto-expand ancestors when currentFile is active
  useEffect(() => {
    if (!currentFile || !currentFile.includes('/')) return;
    const parts = currentFile.split('/');
    let changed = false;
    const toExpand = {};
    let cur = "";
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      if (collapsedFolders[cur]) {
        toExpand[cur] = false;
        changed = true;
      }
    }
    if (changed) {
      setCollapsedFolders(prev => ({ ...prev, ...toExpand }));
    }
  }, [currentFile]);

  const rootFolderName = useMemo(() => {
    return absTargetDir ? absTargetDir.split(/[/\\]/).pop().toUpperCase() : "WORKSPACE";
  }, [absTargetDir]);

  // SMART GIT FOLDER STATUS (Propagates 'M', 'A', 'D', 'U' indicators up to parent folders)
  const folderGitStatus = useMemo(() => {
    const fStatus = {};
    const priority = { 'M': 4, 'A': 3, 'D': 2, 'U': 1 };
    
    // Merge on-disk gitStatuses with real-time in-memory dirtyFiles for 0ms feedback
    const combined = { ...(gitStatuses || {}) };
    if (dirtyFiles) {
      dirtyFiles.forEach(df => {
        if (!combined[df] || combined[df] === 'I') combined[df] = 'M';
      });
    }

    Object.entries(combined).forEach(([filePath, status]) => {
      if (status === 'I') return;
      const parts = filePath.split('/');
      let current = "";
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        const existingPriority = priority[fStatus[current]] || 0;
        const newPriority = priority[status] || 0;
        if (newPriority > existingPriority) {
          fStatus[current] = status;
        }
      }
    });
    return fStatus;
  }, [gitStatuses, dirtyFiles]);

  const ignoredPathsSet = useMemo(() => {
    const set = new Set();
    Object.entries(gitStatuses || {}).forEach(([filePath, status]) => {
      if (status === 'I') {
        set.add(filePath);
      }
    });
    return set;
  }, [gitStatuses]);

  const isPathIgnored = (itemPath) => {
    if (!itemPath) return false;
    if (ignoredPathsSet.has(itemPath)) return true;
    const parts = itemPath.split('/');
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      if (ignoredPathsSet.has(cur)) return true;
    }
    const last = parts[parts.length - 1];
    if (['node_modules', 'dist', 'target', 'build', '__pycache__', '.venv', 'venv', '.git'].includes(last)) {
      return true;
    }
    return false;
  };

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
      if (inlineCreate.parentPath) {
        const parts = fullItemPath.split('/');
        const toExpand = {};
        let cur = "";
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur ? `${cur}/${parts[i]}` : parts[i];
          toExpand[cur] = false;
        }
        setCollapsedFolders(prev => ({ ...prev, ...toExpand }));
      }
      setSelectedPath(fullItemPath);
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

  const itemsToRender = useMemo(() => {
    const list = [];
    let inputInserted = false;
    visibleItems.forEach(item => {
      list.push(item);
      if (inlineCreate && item.path === inlineCreate.parentPath) {
        list.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });
        inputInserted = true;
      }
    });
    if (inlineCreate && !inputInserted && inlineCreate.parentPath === "") {
      list.push({ isInlineInput: true, ...inlineCreate, path: 'inline-input' });
    }
    return list;
  }, [visibleItems, inlineCreate]);

  return (
    <div 
      className="w-full h-full flex flex-col select-none relative font-sans"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
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
      <div 
        className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b"
        style={{ borderColor: 'var(--theme-border, #242628)' }}
      >
        <span className="font-medium tracking-wide" style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}>Explorer</span>
        
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => handleInitiateCreate('file')} 
            className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded-md transition-colors text-[var(--theme-text-muted)] cursor-pointer" 
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button 
            onClick={() => handleInitiateCreate('folder')} 
            className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded-md transition-colors text-[var(--theme-text-muted)] cursor-pointer" 
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button 
            onClick={onRefresh} 
            className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded-md transition-colors text-[var(--theme-text-muted)] cursor-pointer" 
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
            className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded-md transition-colors text-[var(--theme-text-muted)] cursor-pointer" 
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
        className="px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider flex items-center gap-1 shrink-0 hover:bg-[var(--theme-surface-hover)] cursor-pointer transition-colors select-none" 
        style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
        onClick={() => setIsRootCollapsed(!isRootCollapsed)}
      >
        {isRootCollapsed ? (
          <ChevronRight size={13} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-slate-500 shrink-0" />
        )}
        <span className="truncate font-bold">{rootFolderName}</span>
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
                    <Folder size={13} style={{ color: 'var(--theme-folder-icon, #dcb67a)' }} className="shrink-0" />
                  ) : (
                    <FileCode2 size={13} className="text-[var(--theme-text-muted)] shrink-0" />
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
                    className="w-full text-[11px] font-mono border border-blue-500 outline-none px-1.5 py-0.5 rounded shadow-inner" 
                    style={{
                      backgroundColor: 'var(--theme-background, #121314)',
                      color: 'var(--theme-text-primary, #e2e8f0)'
                    }}
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
            const isDirty = !isFolder && Boolean(dirtyFiles && dirtyFiles.has(item.path));
            const isIgnored = isPathIgnored(item.path);

            // 🚀 CLEAN MINIMALIST GIT STATUS COMPUTATION (No Boxes, No Borders)
            let gStatus = isFolder ? folderGitStatus[item.path] : (gitStatuses || {})[item.path];
            if (!isFolder && isDirty && (!gStatus || gStatus === 'I')) {
              gStatus = 'M';
            }

            let gitColor = 'text-[var(--theme-text-primary)]';
            let badgeColor = '';
            
            if (isDirty) {
              gitColor = 'text-amber-500 font-normal';
              badgeColor = 'text-amber-500';
            } else if (gStatus === 'U' || gStatus === 'A') { 
              gitColor = 'text-emerald-500 font-normal'; 
              badgeColor = 'text-emerald-500'; // Clean unboxed green
            } else if (gStatus === 'M') { 
              gitColor = 'text-amber-500 font-normal'; 
              badgeColor = 'text-amber-500';   // Clean unboxed orange-yellow
            } else if (gStatus === 'D') { 
              gitColor = 'text-red-500 font-normal'; 
              badgeColor = 'text-red-500';     // Clean unboxed red
            }

            if (isActiveFile && gitColor === 'text-[var(--theme-text-primary)]') {
              gitColor = 'text-[var(--theme-text-bright)] font-semibold';
            }

            if (isIgnored && !isDirty && !isActiveFile) {
              gitColor = 'text-[var(--theme-text-muted)] opacity-60 font-normal';
              badgeColor = '';
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
                className={`relative flex items-center justify-between pr-2 py-1 cursor-pointer text-[11px] font-mono font-normal group transition-colors select-none ${
                  dragOverPath === item.path 
                    ? 'bg-blue-600/30 border border-blue-500/50' 
                    : isSelected 
                      ? 'bg-[var(--theme-surface-active)] text-[var(--theme-text-bright)] font-medium' 
                      : isActiveFile
                        ? 'bg-[var(--theme-surface-hover)] text-[var(--theme-text-bright)] font-medium'
                        : isIgnored
                          ? 'text-[var(--theme-text-muted)] opacity-60 hover:bg-[var(--theme-surface-hover)] hover:opacity-100 border border-transparent'
                          : 'text-[var(--theme-text-primary)] hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] border border-transparent'
                }`}
              >
                {/* Visual Indentation Guide Lines */}
                {Array.from({ length: depth }).map((_, i) => (
                  <div 
                    key={i} 
                    style={{ left: `${(i * 14) + 14}px` }} 
                    className="absolute top-0 bottom-0 w-[1px] bg-[var(--theme-border)] group-hover:bg-[var(--theme-border-hover)]" 
                  />
                ))}

                <div className="flex items-center gap-1.5 overflow-hidden z-10 flex-1 mr-1">
                  {isFolder ? (
                    <>
                      {collapsedFolders[item.path] ? (
                        <ChevronRight size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                      ) : (
                        <ChevronDown size={13} className="text-[var(--theme-text-muted)] shrink-0" />
                      )}
                      <Folder size={13} style={{ color: isIgnored ? 'var(--theme-text-muted)' : 'var(--theme-folder-icon, #dcb67a)' }} className={`shrink-0 ${isIgnored ? 'opacity-40' : ''}`} />
                    </>
                  ) : (
                    <>
                      <div className="w-[13px] shrink-0" />
                      <FileCode2 size={13} className={
                        isActiveFile 
                          ? "text-[var(--theme-accent)] shrink-0" 
                          : isIgnored 
                            ? "text-[var(--theme-text-muted)]/50 shrink-0" 
                            : "text-[var(--theme-text-secondary)] shrink-0"
                      } />
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
                      className="w-full text-[11px] font-mono border border-blue-500 outline-none px-1 rounded shadow-inner"
                      style={{
                        backgroundColor: 'var(--theme-background, #121314)',
                        color: 'var(--theme-text-primary, #e2e8f0)'
                      }}
                    />
                  ) : (
                    <span className={`truncate text-[11px] font-mono font-normal ${gitColor}`}>
                      {item.path.split('/').pop()}
                    </span>
                  )}
                </div>

                {/* 🚀 CLEAN UNBOXED GIT BADGES & DIRTY DOT INDICATOR */}
                {!isBeingRenamed && (
                  <div className="flex items-center gap-1.5 shrink-0 z-10 bg-inherit pl-1">
                    {isDirty && (
                      <span 
                        className="w-2 h-2 rounded-full bg-amber-400 shrink-0 transition-opacity" 
                        title="Unsaved changes"
                      />
                    )}
                    {gStatus && gStatus !== 'I' && (
                      <span className={`text-[10px] font-mono font-bold ${badgeColor} transition-opacity pr-0.5`}>
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