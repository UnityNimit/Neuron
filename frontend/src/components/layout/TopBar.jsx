// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Minus, Square, Copy, X, Check 
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
    if (onOpenSettings) onOpenSettings('reference');
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
    { label: "Close Window", action: handleClose, shortcut: "Ctrl+W" },
    { label: "Exit Neuron", action: handleQuitCompletely, shortcut: "Alt+F4" }
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
    { label: "Search", action: onOpenCommandPalette, shortcut: "Ctrl+K" }
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
      className="h-[42px] shrink-0 border-b flex items-center justify-between pl-3 pr-0 text-[12px] font-sans select-none z-[150] relative"
      style={{
        backgroundColor: 'var(--theme-primary, #121212)',
        borderColor: 'var(--theme-border, #242628)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
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
        <div className="flex items-center text-xs font-mono" ref={menuRef}>
          {menuItems.map((item) => (
            <div key={item} className="relative">
              <button 
                onClick={() => {
                  setActiveMenu(activeMenu === item ? null : item);
                  setShowRecentSubmenu(false);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  activeMenu === item 
                    ? 'bg-[var(--theme-surface-active)] text-[var(--theme-text-bright)] font-medium' 
                    : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]'
                }`}
              >
                {item}
              </button>

              {/* Primary Dropdown Menu */}
              {activeMenu === item && (
                <div 
                  className="absolute top-full left-0 mt-1 w-60 border shadow-2xl rounded-xl py-1.5 text-xs font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none z-[200]"
                  style={{
                    backgroundColor: 'var(--theme-secondary, #191a1b)',
                    borderColor: 'var(--theme-border-subtle, #2e3032)',
                    color: 'var(--theme-text-primary, #cbd5e1)'
                  }}
                >
                  {getDropdownItems(item).map((opt, idx) => (
                    opt.separator ? (
                      <div key={idx} className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />
                    ) : opt.isSubmenu ? (
                      /* 🚀 OPEN RECENT SUBMENU TRIGGER */
                      <div 
                        key={idx}
                        onMouseEnter={() => setShowRecentSubmenu(true)}
                        className="relative"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowRecentSubmenu(!showRecentSubmenu); }}
                          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left group"
                        >
                          <span className="text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-bright)]">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-bright)]">
                            &gt;
                          </span>
                        </button>

                        {/* Recent Projects Flyout Submenu */}
                        {showRecentSubmenu && (
                          <div 
                            className="absolute top-0 left-full ml-1.5 w-80 border shadow-2xl rounded-2xl p-1.5 text-xs font-mono backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 z-[210]"
                            style={{
                              backgroundColor: 'var(--theme-surface, #161719)',
                              borderColor: 'var(--theme-border, #242628)',
                              color: 'var(--theme-text-primary, #cbd5e1)',
                              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--theme-border, #242628)'
                            }}
                          >
                            <div className="px-2.5 py-1 text-[9px] uppercase font-semibold tracking-wider border-b mb-1 flex items-center justify-between" style={{ borderColor: 'var(--theme-border, #242628)', color: 'var(--theme-text-muted, #64748b)' }}>
                              <span>Recent Workspaces</span>
                              <span className="opacity-50">{recentProjects.length}</span>
                            </div>

                            {recentProjects.length === 0 ? (
                              <div className="px-3 py-4 text-[var(--theme-text-muted)] text-[11px] text-center italic">
                                No recent workspaces found
                              </div>
                            ) : (
                              <>
                                <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 [&::-webkit-scrollbar]:w-1">
                                  {recentProjects.map((pPath, pIdx) => {
                                    const baseName = pPath.split(/[/\\]/).pop();
                                    return (
                                      <button
                                        key={pIdx}
                                        onClick={() => handleSelectRecent(pPath)}
                                        className="w-full px-2.5 py-2 text-left rounded-xl hover:bg-[var(--theme-surface-hover)] transition-all flex flex-col gap-0.5 group cursor-pointer"
                                        title={pPath}
                                      >
                                        <span className="text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-bright)] truncate font-semibold text-[11px]">
                                          {baseName}
                                        </span>
                                        <span className="text-[9.5px] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-secondary)] truncate opacity-70">
                                          {pPath}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />
                                <button
                                  onClick={handleClearRecent}
                                  className="w-full px-2.5 py-1.5 text-center text-[10px] font-mono rounded-lg transition-colors hover:bg-rose-500/10 hover:text-rose-400 cursor-pointer"
                                  style={{ color: 'var(--theme-text-muted, #64748b)' }}
                                >
                                  Clear Recent History
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
                        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left group"
                      >
                        <span className="text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-bright)]">{opt.label}</span>

                        <div className="flex items-center gap-2 shrink-0">
                          {opt.shortcut && (
                            <span className="text-[10px] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-primary)] font-mono">
                              {opt.shortcut}
                            </span>
                          )}
                          {opt.toggle !== undefined && (
                            <Check 
                              size={12} 
                              className={opt.toggle ? "text-[var(--theme-accent)] font-bold" : "opacity-0"} 
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
            className="w-11 h-full flex items-center justify-center hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus size={13} />
          </button>

          {/* Maximize / Restore */}
          <button 
            onClick={handleToggleMaximize}
            className="w-11 h-full flex items-center justify-center hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy size={11} className="rotate-180" /> : <Square size={11} />}
          </button>

          {/* Close */}
          <button 
            onClick={handleClose}
            className="w-11 h-full flex items-center justify-center hover:bg-[#e81123] text-[var(--theme-text-muted)] hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}