// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Minus, Square, Copy, X, Check,
  Plus, Columns2, Rows2, PanelRightClose, FileCode2
} from 'lucide-react';
import NeuronLogo from '../common/NeuronLogo';
import { useTheme } from '../../config/themeConfig';
import CommandPalette from './CommandPalette';

export default function TopBar({ 
  onOpenFolder, 
  onOpenRecent, 
  onSave, 
  autoSave = false, 
  onToggleAutoSave, 
  layout = {}, 
  setLayout, 
  onOpenCommandPalette, 
  onOpenSettings,
  onApplyLayoutPreset,
  isCommandPaletteOpen = false,
  setIsCommandPaletteOpen,
  searchQuery = "",
  setSearchQuery,
  workspace = {},
  onRunCode,
  onRunInTerminal,
  onWarpToNode,
  onSwitchFile,
  onSplitPane,
  onClosePane,
  onAddTabToPane,
  canCloseSplit = false
}) {
  const { theme } = useTheme();
  const [activeMenu, setActiveMenu] = useState(null);
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);
  const [recentProjects, setRecentProjects] = useState([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef(null);
  const addTabMenuRef = useRef(null);

  // Close add tab menu on outside click
  useEffect(() => {
    if (!showAddTabMenu) return;
    const handleClickOutside = (e) => {
      if (addTabMenuRef.current && !addTabMenuRef.current.contains(e.target)) {
        setShowAddTabMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddTabMenu]);

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
    { label: "Standard Input Panel", action: () => toggleLayout('stdin'), toggle: layout.stdin },
    { separator: true },
    { isHeader: true, label: "Layout Presets" },
    { label: "1. Default Layout", action: () => onApplyLayoutPreset && onApplyLayoutPreset('default') },
    { label: "2. Map + Code Split", action: () => onApplyLayoutPreset && onApplyLayoutPreset('map-code') },
    { label: "3. Two Code Files Split", action: () => onApplyLayoutPreset && onApplyLayoutPreset('two-code') },
    { label: "4. Map + Code + Code Split", action: () => onApplyLayoutPreset && onApplyLayoutPreset('map-code-code') },
    { label: "5. Three Code Files Split", action: () => onApplyLayoutPreset && onApplyLayoutPreset('three-code') },
    { label: "6. Competitive Programming", action: () => onApplyLayoutPreset && onApplyLayoutPreset('competitive') }
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
      className="h-[42px] shrink-0 border-b flex items-center justify-between pl-3 pr-0 text-[12px] font-sans select-none z-[500] relative"
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
        
        {/* Official Vector Theme-Customizable Logo */}
        <div 
          className="flex items-center pr-1 cursor-pointer group transition-transform active:scale-95" 
          onClick={onOpenSettings} 
          title="Neuron IDE - Settings"
        >
          <NeuronLogo 
            size={18} 
            color={theme?.accent || 'var(--theme-accent, #3b82f6)'}
            style={{ color: theme?.accent || 'var(--theme-accent, #3b82f6)' }}
            className="group-hover:brightness-125 transition-all" 
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
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-mono transition-colors cursor-pointer ${
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
                  className="absolute top-full left-0 mt-1 w-56 border shadow-2xl rounded-xl p-1 text-[11px] font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none z-[200]"
                  style={{
                    backgroundColor: 'var(--theme-secondary, #191a1b)',
                    borderColor: 'var(--theme-border, #242628)',
                    color: 'var(--theme-text-primary, #cbd5e1)'
                  }}
                >
                  {getDropdownItems(item).map((opt, idx) => (
                    opt.separator ? (
                      <div key={idx} className="my-1 border-t mx-1" style={{ borderColor: 'var(--theme-border, #242628)' }} />
                    ) : opt.isHeader ? (
                      <div key={idx} className="px-2.5 pt-2 pb-1 text-[10px] uppercase font-mono tracking-wider font-semibold select-none text-[var(--theme-text-muted)]">
                        {opt.label}
                      </div>
                    ) : opt.isSubmenu ? (
                      /*  OPEN RECENT SUBMENU TRIGGER */
                      <div 
                        key={idx}
                        onMouseEnter={() => setShowRecentSubmenu(true)}
                        className="relative"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowRecentSubmenu(!showRecentSubmenu); }}
                          className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left group"
                        >
                          <span className="text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-bright)]">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-bright)]">
                            ›
                          </span>
                        </button>

                        {/* Recent Projects Flyout Submenu */}
                        {showRecentSubmenu && (
                          <div 
                            className="absolute top-0 left-full ml-1 w-72 border shadow-2xl rounded-xl p-1 text-[11px] font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 z-[210]"
                            style={{
                              backgroundColor: 'var(--theme-secondary, #191a1b)',
                              borderColor: 'var(--theme-border, #242628)',
                              color: 'var(--theme-text-primary, #cbd5e1)'
                            }}
                          >
                            <div 
                              className="h-7 px-2.5 border-b flex items-center justify-between shrink-0 mb-1" 
                              style={{ borderColor: 'var(--theme-border, #242628)' }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono font-medium text-[var(--theme-text-bright)] tracking-wide">
                                  Recent Workspaces
                                </span>
                                {recentProjects.length > 0 && (
                                  <span 
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded text-[var(--theme-text-muted)] leading-none"
                                    style={{
                                      backgroundColor: 'var(--theme-surface-active, #222426)',
                                    }}
                                  >
                                    {recentProjects.length}
                                  </span>
                                )}
                              </div>
                            </div>

                            {recentProjects.length === 0 ? (
                              <div className="py-4 px-3 flex flex-col items-center justify-center gap-1 text-center text-[var(--theme-text-muted)] text-[11px] font-mono">
                                <span>No recent workspaces</span>
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
                                        className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-[var(--theme-surface-hover)] transition-all flex flex-col gap-0.5 group cursor-pointer"
                                        title={pPath}
                                      >
                                        <span className="text-[var(--theme-text-primary)] group-hover:text-[var(--theme-text-bright)] truncate font-medium text-[11px]">
                                          {baseName}
                                        </span>
                                        <span className="text-[9.5px] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-secondary)] truncate opacity-70">
                                          {pPath}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="my-1 border-t mx-1" style={{ borderColor: 'var(--theme-border, #242628)' }} />
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
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left group"
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
      {/* CENTER DRAG REGION: Native Titlebar Dragging Space               */}
      {/* ----------------------------------------------------------------- */}
      <div 
        className="flex-1 h-full min-w-[20px]" 
        data-tauri-drag-region 
        onDoubleClick={handleToggleMaximize} 
      />

      {/* ----------------------------------------------------------------- */}
      {/* TRUE SCREEN CENTER: Perfectly Centered Search System (Ctrl+K)    */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 flex items-center justify-center pointer-events-none z-[220]">
        <div className="pointer-events-auto flex justify-center">
          <CommandPalette 
            isOpen={isCommandPaletteOpen}
            onOpen={() => setIsCommandPaletteOpen && setIsCommandPaletteOpen(true)}
            onClose={() => {
              if (setIsCommandPaletteOpen) setIsCommandPaletteOpen(false);
              if (setSearchQuery) setSearchQuery("");
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            workspace={workspace}
            onRunCode={onRunCode}
            onRunInTerminal={onRunInTerminal}
            onOpenSettings={onOpenSettings}
            onWarpToNode={onWarpToNode}
            onSwitchFile={onSwitchFile}
            repoName={workspace.repoName || (workspace.absTargetDir ? workspace.absTargetDir.split(/[\\/]/).pop() : "Neuron")}
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* RIGHT: Pane Layout Actions (Add Tab, Splits) & Window Controls   */}
      {/* ----------------------------------------------------------------- */}
      <div className={`flex items-center h-full pointer-events-auto ${isTauri ? '' : 'pr-3'}`}>
        
        {/* Modular Workspace Split & Add Tab Actions */}
        <div className="flex items-center gap-0.5">
          {/* Quick Add Tab Dropdown */}
          <div className="relative" ref={addTabMenuRef}>
            <button
              type="button"
              onClick={() => setShowAddTabMenu(prev => !prev)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
              title="Add Tab to Active Pane"
            >
              <Plus size={14} strokeWidth={2} />
            </button>

            {showAddTabMenu && (
              <div 
                className="absolute top-full right-0 mt-1.5 w-48 border shadow-2xl rounded-lg p-1 text-[11px] font-mono z-[300] animate-in fade-in zoom-in-95 duration-100"
                style={{
                  backgroundColor: 'var(--theme-secondary, #191a1b)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
              >
                <div className="px-2 py-1 text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">
                  Core Sections
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddTabToPane && onAddTabToPane({ id: 'spatial', type: 'spatial', title: 'Map' });
                    setShowAddTabMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer transition-colors"
                >
                  <span>Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTabToPane && onAddTabToPane({ id: 'output', type: 'output', title: 'Output' });
                    setShowAddTabMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer transition-colors"
                >
                  <span>Output</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTabToPane && onAddTabToPane({ id: 'terminal', type: 'terminal', title: 'Terminal' });
                    setShowAddTabMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer transition-colors"
                >
                  <span>Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTabToPane && onAddTabToPane({ id: 'ai', type: 'ai', title: 'AI Agent' });
                    setShowAddTabMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer transition-colors"
                >
                  <span>AI Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddTabToPane && onAddTabToPane({ id: 'stdin', type: 'stdin', title: 'Input' });
                    setShowAddTabMenu(false);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left cursor-pointer transition-colors"
                >
                  <span>Input</span>
                </button>

                {(workspace.files || []).length > 0 && (
                  <>
                    <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />
                    <div className="px-2 py-1 text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider font-semibold">
                      Open Files
                    </div>
                    <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
                      {(workspace.files || []).slice(0, 15).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            onAddTabToPane && onAddTabToPane({ id: `file:${f}`, type: 'file', path: f, title: f.split('/').pop() });
                            setShowAddTabMenu(false);
                          }}
                          className="w-full px-2 py-1 rounded flex items-center gap-2 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] text-left truncate cursor-pointer transition-colors"
                        >
                          <FileCode2 size={11} className="text-[var(--theme-text-muted)] shrink-0" />
                          <span className="truncate">{f.split('/').pop()}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Split Right (Horizontal Columns) */}
          <button
            type="button"
            onClick={() => onSplitPane && onSplitPane('horizontal')}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
            title="Split Right (Columns)"
          >
            <Columns2 size={14} strokeWidth={1.8} />
          </button>

          {/* Split Down (Vertical Rows) */}
          <button
            type="button"
            onClick={() => onSplitPane && onSplitPane('vertical')}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
            title="Split Down (Rows)"
          >
            <Rows2 size={14} strokeWidth={1.8} />
          </button>

          {/* Close Split Pane Button */}
          {canCloseSplit && (
            <button
              type="button"
              onClick={() => onClosePane && onClosePane()}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-rose-500/15 hover:text-rose-400 text-[var(--theme-text-muted)] transition-colors cursor-pointer"
              title="Close Split Pane"
            >
              <PanelRightClose size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Seamless Full-Height Native Window Controls for Desktop Tauri */}
        {isTauri && (
          <div className="flex items-center h-full ml-1.5 border-l" style={{ borderColor: 'var(--theme-border, #242628)' }}>
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
    </div>
  );
}