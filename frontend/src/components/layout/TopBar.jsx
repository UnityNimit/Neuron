// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Layout, Search, Settings, Minus, Square, 
  Copy, X, Terminal, Sparkles, FolderOpen, Plus, 
  HelpCircle, Code2, Sliders, Check 
} from 'lucide-react';

export default function TopBar({ 
  onRun, 
  onOpenFolder, 
  onCreateFile, 
  layout = {}, 
  setLayout, 
  onOpenCommandPalette, 
  onOpenSettings 
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef(null);

  // Detect if running inside native Tauri desktop app
  const isTauri = typeof window !== 'undefined' && Boolean(
    window.__TAURI_INTERNALS__ || window.__TAURI__
  );

  // -------------------------------------------------------------------------
  // 1. TAURI 2.0 NATIVE WINDOW CONTROLLER
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

  // -------------------------------------------------------------------------
  // 2. MENU DROPDOWN SYSTEM
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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShowShortcuts = () => {
    alert(`NEURON IDE - KEYBOARD SHORTCUTS REFERENCE

[ FILE COMMANDS ]
New File             Ctrl+N
Open Folder          Ctrl+K Ctrl+O
Save / Sync          Ctrl+S
Preferences          Ctrl+,

[ EDIT & NAVIGATION ]
Command Palette      Ctrl+K  or  Cmd+K
Show All Commands    Ctrl+Shift+P
Undo Canvas Refactor Ctrl+Z
Redo                 Ctrl+Y
Find / Replace       Ctrl+F / Ctrl+H

[ VIEW & LAYOUT ]
Toggle Sidebar       Ctrl+B
Toggle Terminal      Ctrl+\`
Run Script           F5

[ SPATIAL AST MAP ]
AI Impact Analysis   Alt+I
Focus Isolation      F
Clear Focus / Alerts Esc
Camera Warp to Node  Command Palette (↵)
Open Node in Editor  Double Click Node`);
  };

  const menuItems = ['File', 'Edit', 'Layout', 'Help'];

  // --- FILE MENU ---
  const fileDropdownItems = [
    { label: "New File...", action: () => { const n = prompt("Enter new file name:"); if (n && onCreateFile) onCreateFile(n, 'file'); }, shortcut: "Ctrl+N" },
    { label: "Open Folder...", action: onOpenFolder, shortcut: "Ctrl+K Ctrl+O" },
    { separator: true },
    { label: "Save", action: () => console.log("Auto-Sync Active"), shortcut: "Ctrl+S" },
    { label: "Auto Save", action: () => {}, toggle: true },
    { separator: true },
    { label: "Preferences", action: onOpenSettings, shortcut: "Ctrl+," },
    { separator: true },
    { label: "Exit Application", action: handleClose }
  ];

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

  const renderDropdown = (item) => (
    <div className={`absolute top-full ${item === 'Layout' ? 'left-0' : 'left-0'} mt-1 w-64 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl py-1.5 z-[200] backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-100`}>
      {getDropdownItems(item).map((opt, idx) => (
        opt.separator ? (
          <div key={idx} className="h-[1px] bg-[#2d2d2d] my-1.5 mx-2" />
        ) : (
          <button 
            key={idx} 
            onClick={(e) => { 
              e.stopPropagation(); 
              opt.action(); 
              if (!opt.toggle) setActiveMenu(null); 
            }} 
            className="w-full text-left px-3.5 py-1.5 hover:bg-blue-600/20 hover:text-white text-[#cccccc] text-xs font-mono flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-2">
              {opt.toggle !== undefined ? (
                <span className={`w-3.5 flex items-center justify-center font-bold ${opt.toggle ? 'text-blue-400' : 'opacity-0'}`}>
                  <Check size={12} />
                </span>
              ) : (
                <span className="w-3.5" />
              )}
              <span className="group-hover:text-white">{opt.label}</span>
            </div>
            {opt.shortcut && <span className="text-[10px] text-slate-500 tracking-wider font-mono">{opt.shortcut}</span>}
          </button>
        )
      ))}
    </div>
  );

  return (
    <div 
      data-tauri-drag-region
      className="h-[38px] shrink-0 bg-[#121212] border-b border-[#242424] flex items-center justify-between px-3 text-[12px] text-slate-300 font-sans select-none z-[150] relative"
    >
      {/* ----------------------------------------------------------------- */}
      {/* LEFT: Logo & Dropdown Menus                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3 pointer-events-auto" data-tauri-drag-region>
        
        {/* App Logo */}
        <div className="flex items-center gap-1.5 pr-1 cursor-pointer" onClick={onOpenSettings} title="Neuron IDE">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-4.5 w-4.5 object-contain" 
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="font-bold font-mono tracking-widest text-[11px] text-slate-200 hidden sm:inline">NEURON</span>
        </div>

        {/* Desktop Menu Bar */}
        <div className="flex items-center text-[#cccccc] text-xs" ref={menuRef}>
          {menuItems.map((item) => (
            <div key={item} className="relative">
              <button 
                onClick={() => setActiveMenu(activeMenu === item ? null : item)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeMenu === item ? 'bg-[#262626] text-white font-medium' : 'hover:text-white hover:bg-[#1e1e1e]'
                }`}
              >
                {item}
              </button>
              {activeMenu === item && renderDropdown(item)}
            </div>
          ))}
        </div>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* CENTER: Omni-Search Bar (Interactive Window Drag Region)         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 max-w-sm mx-4 hidden md:flex items-center pointer-events-auto" data-tauri-drag-region>
        <button 
          onClick={onOpenCommandPalette}
          className="w-full h-6.5 px-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#181818] hover:bg-[#202020] hover:text-slate-200 border border-[#2b2d31] rounded-lg transition-all shadow-inner group"
        >
          <div className="flex items-center gap-2 truncate">
            <Search size={11} className="text-blue-400 group-hover:text-blue-300" />
            <span className="truncate">Omni-Search (symbols, files, AI)...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] bg-[#242424] border border-[#333] rounded text-slate-400 font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT: Actions, Panel Toggles & Custom Window Controls            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        
        {/* Quick Action: Run Code */}
        {onRun && (
          <button 
            onClick={onRun}
            className="h-6 px-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.25)] border border-emerald-500/40"
            title="Run Active Script (F5)"
          >
            <Play size={10} fill="currentColor" />
            <span className="hidden sm:inline">Run</span>
          </button>
        )}

        {/* Quick Action: Toggle Layout */}
        <button 
          onClick={() => toggleLayout('sidebar')}
          className={`h-6 w-6 flex items-center justify-center rounded-md border transition-colors ${
            layout.sidebar ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'bg-[#181818] border-[#2c2c2c] text-slate-400 hover:text-slate-200 hover:bg-[#222]'
          }`}
          title="Toggle Sidebar (Ctrl+B)"
        >
          <Layout size={12} />
        </button>

        {/* Quick Action: Preferences */}
        {onOpenSettings && (
          <button 
            onClick={onOpenSettings}
            className="h-6 w-6 flex items-center justify-center rounded-md bg-[#181818] hover:bg-[#222] text-slate-400 hover:text-slate-200 border border-[#2c2c2c] transition-colors"
            title="Preferences (Ctrl+,)"
          >
            <Settings size={12} />
          </button>
        )}

        {/* 🚀 CUSTOM NATIVE DESKTOP WINDOW CONTROLS (Zero Wasted Height) */}
        {isTauri && (
          <div className="flex items-center ml-2 pl-2 border-l border-[#282828] h-5 gap-0.5">
            {/* Minimize */}
            <button 
              onClick={handleMinimize}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#262626] text-slate-400 hover:text-slate-100 transition-colors"
              title="Minimize Window"
            >
              <Minus size={12} />
            </button>

            {/* Maximize / Restore */}
            <button 
              onClick={handleToggleMaximize}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#262626] text-slate-400 hover:text-slate-100 transition-colors"
              title={isMaximized ? "Restore Window" : "Maximize Window"}
            >
              {isMaximized ? <Copy size={10} className="rotate-180" /> : <Square size={10} />}
            </button>

            {/* Close */}
            <button 
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 text-slate-400 hover:text-white transition-colors"
              title="Close Application"
            >
              <X size={13} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}