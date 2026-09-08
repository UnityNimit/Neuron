// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Minus, Square, Copy, X, Check, ChevronRight, FolderClock, Trash2 
} from 'lucide-react';

export default function TopBar({ 
  onOpenFolder, 
  onOpenRecent, 
  onSave, 
  autoSave = false, 
  onToggleAutoSave, 
  layout = {}, 
  setLayout, 
  onOpenCommandPalette, 
  onOpenSettings 
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef(null);

  // Detect if running inside native Tauri desktop app
  const isTauri = typeof window !== 'undefined' && Boolean(
    window.__TAURI_INTERNALS__ || window.__TAURI__
  );

  // -------------------------------------------------------------------------
  // 1. RECENT PROJECTS LOCALSTORAGE SYNC
  // -------------------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem('neuron_recent_projects');
      if (saved) {
        setRecentProjects(JSON.parse(saved));
      }
    } catch (e) {}
  }, [activeMenu]);

  const handleSelectRecent = (folderPath) => {
    setActiveMenu(null);
    setShowRecentSubmenu(false);
    if (onOpenRecent) {
      onOpenRecent(folderPath);
    }
  };

  const handleClearRecent = (e) => {
    e.stopPropagation();
    localStorage.removeItem('neuron_recent_projects');
    setRecentProjects([]);
    setShowRecentSubmenu(false);
  };

  // -------------------------------------------------------------------------
  // 2. TAURI 2.0 NATIVE WINDOW CONTROLLER
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isTauri) return;

    let unlisten = null;
    const initTauriWindow = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const maxState = await appWindow.isMaximized();
        setIsMaximized(maxState);

        unlisten = await appWindow.onResized(async () => {
          const state = await appWindow.isMaximized();
          setIsMaximized(state);
        });
      } catch (e) {}
    };

    initTauriWindow();
    return () => { if (unlisten) unlisten(); };
  }, [isTauri]);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {}
  };

  const handleToggleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const state = await appWindow.isMaximized();
      setIsMaximized(state);
    } catch (e) {}
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      window.close();
    }
  };

  const handleQuitCompletely = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quit_neuron_completely');
    } catch (e) {
      window.close();
    }
  };

  // -------------------------------------------------------------------------
  // 3. MENU DROPDOWN & KEYBOARD SHORTCUTS
  // -------------------------------------------------------------------------
  const toggleLayout = (panel) => {
    if (setLayout) {
      setLayout(prev => ({ ...prev, [panel]: !prev[panel] }));
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
        setShowRecentSubmenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShowShortcuts = () => {
    alert(`NEURON IDE - KEYBOARD SHORTCUTS REFERENCE

[ FILE COMMANDS ]
Open Folder          Ctrl+K Ctrl+O
Save Active File     Ctrl+S
Preferences          Ctrl+,

[ EDIT & NAVIGATION ]
Command Palette      Ctrl+K  or  Cmd+K
Show All Commands    Ctrl+Shift+P
Toggle Line Comment  Ctrl+/
Toggle Block Comment Shift+Alt+A
Undo Canvas Refactor Ctrl+Z
Redo                 Ctrl+Y
Find / Replace       Ctrl+F / Ctrl+H

[ VIEW & LAYOUT ]
Toggle Sidebar       Ctrl+B
Toggle Terminal      Ctrl+\`
Run Active Script    F5

[ SPATIAL AST MAP ]
AI Impact Analysis   Alt+I
Focus Isolation      F
Clear Focus / Alerts Esc
Camera Warp to Node  Command Palette (↵)
Open Node in Editor  Double Click Node`);
  };

  const menuItems = ['File', 'Edit', 'Layout', 'Help'];

  // --- FILE MENU ---
  const fileDropdownItems = useMemo(() => [
    { label: "Open Folder...", action: onOpenFolder, shortcut: "Ctrl+K Ctrl+O" },
    { 
      label: "Open Recent", 
      isSubmenu: true, 
      hasChildren: recentProjects.length > 0 
    },
    { separator: true },
    { label: "Save", action: onSave, shortcut: "Ctrl+S" },
    { label: "Auto Save", action: onToggleAutoSave, toggle: autoSave },
    { separator: true },
    { label: "Preferences", action: onOpenSettings, shortcut: "Ctrl+," },
    { separator: true },
    { label: "Close to Tray", action: handleClose },
    { label: "Quit Neuron Completely", action: handleQuitCompletely }
  ], [onOpenFolder, onSave, onToggleAutoSave, autoSave, onOpenSettings, recentProjects]);

  // --- EDIT MENU ---
  const editDropdownItems = [
    { label: "Undo", action: () => document.execCommand('undo'), shortcut: "Ctrl+Z" },
    { label: "Redo", action: () => document.execCommand('redo'), shortcut: "Ctrl+Y" },
    { separator: true },
    { label: "Cut", action: () => document.execCommand('cut'), shortcut: "Ctrl+X" },
    { label: "Copy", action: () => document.execCommand('copy'), shortcut: "Ctrl+C" },
    { label: "Paste", action: async () => { try { const text = await navigator.clipboard.readText(); document.execCommand('insertText', false, text); } catch { document.execCommand('paste'); } }, shortcut: "Ctrl+V" },
    { separator: true },
    { label: "Search Omni-Palette", action: onOpenCommandPalette, shortcut: "Ctrl+K" },
    { label: "Find in Files", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+F" }
  ];

  // --- LAYOUT MENU ---
  const layoutDropdownItems = [
    { label: "Explorer Sidebar", action: () => toggleLayout('sidebar'), toggle: layout.sidebar, shortcut: "Ctrl+B" },
    { label: "Interactive Terminal", action: () => toggleLayout('terminal'), toggle: layout.terminal, shortcut: "Ctrl+`" },
    { label: "Standard Input Panel", action: () => toggleLayout('stdin'), toggle: layout.stdin }
  ];

  // --- HELP MENU ---
  const helpDropdownItems = [
    { label: "Documentation", action: () => window.open("https://neuron-website-ruby.vercel.app/docs", "_blank") },
    { label: "Keyboard Shortcuts Reference", action: handleShowShortcuts },
    { label: "Show All Commands", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+P" },
    { separator: true },
    { label: "About Neuron", action: () => window.open("https://neuron-website-ruby.vercel.app/", "_blank") }
  ];

  const getDropdownItems = (item) => {
    if (item === 'File') return fileDropdownItems;
    if (item === 'Edit') return editDropdownItems;
    if (item === 'Layout') return layoutDropdownItems;
    return helpDropdownItems;
  };

  return (
    <div 
      data-tauri-drag-region
      className="h-[42px] shrink-0 bg-[#121212] border-b border-[#242628] flex items-center justify-between pl-3 pr-0 text-[12px] text-slate-300 font-sans select-none z-[150] relative"
    >
      {/* ----------------------------------------------------------------- */}
      {/* LEFT: Flat Logo & Dropdown Menus                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3 pointer-events-auto" data-tauri-drag-region>
        
        {/* Flat Matte Logo */}
        <div className="flex items-center pr-1 cursor-pointer" onClick={onOpenSettings} title="Neuron IDE">
          <img 
            src="/logo.png" 
            alt="Neuron" 
            className="h-5 w-5 object-contain opacity-95" 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* Desktop Menu Bar */}
        <div className="flex items-center text-[#cccccc] text-xs font-mono" ref={menuRef}>
          {menuItems.map((item) => (
            <div key={item} className="relative">
              <button 
                onClick={() => {
                  setActiveMenu(activeMenu === item ? null : item);
                  setShowRecentSubmenu(false);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeMenu === item ? 'bg-[#262626] text-white font-medium' : 'hover:text-white hover:bg-[#1e1e1e]'
                }`}
              >
                {item}
              </button>

              {/* Primary Dropdown Menu */}
              {activeMenu === item && (
                <div 
                  className="absolute top-full left-0 mt-1 w-60 bg-[#191a1b]/95 border border-[#2e3032] shadow-2xl rounded-xl py-1.5 text-xs text-slate-300 font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none z-[200]"
                >
                  {getDropdownItems(item).map((opt, idx) => (
                    opt.separator ? (
                      <div key={idx} className="my-1 border-t border-[#242628]" />
                    ) : opt.isSubmenu ? (
                      /* 🚀 OPEN RECENT SUBMENU TRIGGER */
                      <div 
                        key={idx}
                        onMouseEnter={() => setShowRecentSubmenu(true)}
                        className="relative"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowRecentSubmenu(!showRecentSubmenu); }}
                          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left group"
                        >
                          <span className="text-slate-300 group-hover:text-white flex items-center gap-2">
                            <FolderClock size={12} className="text-blue-400" /> {opt.label}
                          </span>
                          <ChevronRight size={12} className="text-slate-500 group-hover:text-white" />
                        </button>

                        {/* Recent Projects Flyout Submenu */}
                        {showRecentSubmenu && (
                          <div 
                            className="absolute top-0 left-full ml-1 w-72 bg-[#191a1b]/95 border border-[#2e3032] shadow-2xl rounded-xl py-1.5 text-xs text-slate-300 font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 z-[210]"
                          >
                            {recentProjects.length === 0 ? (
                              <div className="px-3 py-2 text-slate-500 text-[11px] text-center">
                                No Recent Projects Found
                              </div>
                            ) : (
                              <>
                                <div className="max-h-48 overflow-y-auto divide-y divide-[#222426]">
                                  {recentProjects.map((pPath, pIdx) => (
                                    <button
                                      key={pIdx}
                                      onClick={() => handleSelectRecent(pPath)}
                                      className="w-full px-3 py-1.5 text-left hover:bg-blue-600/20 hover:text-white transition-colors flex flex-col group cursor-pointer"
                                      title={pPath}
                                    >
                                      <span className="text-slate-200 group-hover:text-white truncate font-medium">
                                        {pPath.split(/[/\\]/).pop()}
                                      </span>
                                      <span className="text-[10px] text-slate-500 truncate">
                                        {pPath}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                                <div className="my-1 border-t border-[#242628]" />
                                <button
                                  onClick={handleClearRecent}
                                  className="w-full px-3 py-1 text-left text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors flex items-center gap-1.5 text-[11px] cursor-pointer"
                                >
                                  <Trash2 size={11} /> Clear Recently Opened
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button 
                        key={idx} 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (opt.action) opt.action(); 
                          if (opt.toggle === undefined) {
                            setActiveMenu(null);
                            setShowRecentSubmenu(false);
                          }
                        }} 
                        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left group"
                      >
                        <span className="text-slate-300 group-hover:text-white">{opt.label}</span>

                        <div className="flex items-center gap-2 shrink-0">
                          {opt.shortcut && (
                            <span className="text-[10px] text-slate-500 group-hover:text-slate-300 font-mono">
                              {opt.shortcut}
                            </span>
                          )}
                          {opt.toggle !== undefined && (
                            <Check 
                              size={12} 
                              className={opt.toggle ? "text-blue-400 font-bold" : "opacity-0"} 
                            />
                          )}
                        </div>
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* CENTER: Pure Drag Area (Double-click to toggle maximize)          */}
      {/* ----------------------------------------------------------------- */}
      <div 
        className="flex-1 h-full" 
        data-tauri-drag-region 
        onDoubleClick={handleToggleMaximize} 
      />

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT: Seamless Full-Height Native Window Controls                */}
      {/* ----------------------------------------------------------------- */}
      {isTauri && (
        <div className="flex items-center h-full pointer-events-auto">
          {/* Minimize */}
          <button 
            onClick={handleMinimize}
            className="w-11 h-full flex items-center justify-center hover:bg-[#262626] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus size={13} />
          </button>

          {/* Maximize / Restore */}
          <button 
            onClick={handleToggleMaximize}
            className="w-11 h-full flex items-center justify-center hover:bg-[#262626] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy size={11} className="rotate-180" /> : <Square size={11} />}
          </button>

          {/* Close */}
          <button 
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center hover:bg-[#e81123] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}