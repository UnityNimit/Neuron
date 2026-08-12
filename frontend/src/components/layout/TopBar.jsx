// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, PanelLeft, PanelBottom, PanelRight, FolderOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function TopBar({ 
  onRun, onOpenFolder, onCreateFile, layout, setLayout, onOpenSettings, onOpenCommandPalette 
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  const toggleLayout = (panel) => setLayout(prev => ({ ...prev, [panel]: !prev[panel] }));

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setActiveMenu(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

  // --- THE EXACT FILE MENU REQUESTED ---
  const fileDropdownItems = [
    { label: "New File", action: onCreateFile, shortcut: "Ctrl+N" },
    { label: "New Window", action: () => window.open(window.location.href, '_blank'), shortcut: "Ctrl+Shift+N" },
    { separator: true },
    { label: "Open File...", action: () => alert("Open File not implemented in this demo.") },
    { label: "Open Folder...", action: onOpenFolder, shortcut: "Ctrl+K Ctrl+O" },
    { label: "Open Recent", action: () => alert("No recent workspaces found.") },
    { separator: true },
    { label: "Save", action: () => alert("Code is continuously saved!"), shortcut: "Ctrl+S" },
    { label: "Save As...", action: () => alert("Save As not needed (Auto-Sync is active)") },
    { label: "Auto Save", action: () => {}, toggle: true }, // Visual toggle indicator
    { separator: true },
    { label: "Exit", action: () => window.close() }
  ];

  const helpDropdownItems = [
    { label: "Welcome", action: () => alert("Welcome to Neuron: The Spatial IDE!") },
    { label: "Show All Commands", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+P" },
    { label: "Documentation", action: () => window.open("https://github.com/UnityNimit/Neuron", "_blank") },
    { label: "Interactive Walkthrough", action: () => alert("Walkthrough coming soon!") },
    { separator: true },
    { label: "About Neuron", action: () => alert("Neuron v1.0.0\nBuilt by Nimit & Team") }
  ];

  return (
    <div className="h-9 shrink-0 bg-[#181818] border-b border-[#2b2d31] flex items-center justify-between px-3 text-xs text-slate-300 font-sans select-none z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-1">
          <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
          <span className="text-white font-bold tracking-wider text-xs">NEURON</span>
        </div>
        <div className="flex items-center gap-0.5 text-slate-500 border-l border-[#2b2d31] pl-2">
          <button className="p-1 hover:text-slate-200 hover:bg-[#2a2d31] rounded transition-colors"><ChevronLeft size={14} /></button>
          <button className="p-1 hover:text-slate-200 hover:bg-[#2a2d31] rounded transition-colors"><ChevronRight size={14} /></button>
        </div>

        <div className="hidden lg:flex items-center text-[12px] text-slate-400 relative" ref={menuRef}>
          {menuItems.map((item) => (
            <div key={item} className="relative">
              <button 
                onClick={() => setActiveMenu(activeMenu === item ? null : item)}
                className={`px-2 py-0.5 rounded transition-colors ${activeMenu === item ? 'bg-[#333] text-white' : 'hover:text-white hover:bg-[#2a2d31]'}`}
              >
                {item}
              </button>

              {activeMenu === item && (item === 'Help' || item === 'File') && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#252526] border border-[#454545] rounded-md shadow-2xl py-1 z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                  {(item === 'File' ? fileDropdownItems : helpDropdownItems).map((opt, idx) => (
                    opt.separator ? (
                      <div key={idx} className="h-[1px] bg-[#454545] my-1 mx-2" />
                    ) : (
                      <button key={idx} onClick={() => { opt.action(); setActiveMenu(null); }} className="w-full text-left px-6 py-1.5 hover:bg-[#094771] hover:text-white text-[#cccccc] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {opt.toggle && <span className="text-blue-400 font-bold">✓</span>}
                          <span className={opt.toggle ? "ml-1" : "ml-4"}>{opt.label}</span>
                        </div>
                        {opt.shortcut && <span className="text-[10px] text-slate-500">{opt.shortcut}</span>}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div onClick={onOpenCommandPalette} className="flex-1 max-w-md mx-4 bg-[#252526] hover:bg-[#2d2d2d] border border-[#3c3c3c] hover:border-blue-500/50 rounded-md px-3 py-1 flex items-center justify-between text-slate-400 cursor-pointer transition-all shadow-inner group">
        <div className="flex items-center gap-2 overflow-hidden text-xs">
          <Search size={13} className="text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
          <span className="truncate">Search Neuron (Ctrl+K or Cmd+K)</span>
        </div>
        <kbd className="hidden sm:inline-block text-[10px] bg-[#1e1e1e] border border-[#3c3c3c] px-1.5 py-0.2 rounded text-slate-500 font-mono">Ctrl+K</kbd>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onOpenFolder} className="hidden md:flex items-center gap-1.5 bg-[#252526] hover:bg-[#333] text-slate-300 px-2.5 py-1 rounded text-xs border border-[#3c3c3c] transition-colors" title="Open Folder on Local Computer">
          <FolderOpen size={13} className="text-blue-400" /><span>Open</span>
        </button>
        <div className="flex items-center gap-0.5 bg-[#232325] p-0.5 rounded border border-[#333]">
          <button onClick={() => toggleLayout('sidebar')} className={`p-1 rounded transition-colors ${layout.sidebar ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}><PanelLeft size={14} /></button>
          <button onClick={() => toggleLayout('terminal')} className={`p-1 rounded transition-colors ${layout.terminal ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}><PanelBottom size={14} /></button>
          <button onClick={() => toggleLayout('stdin')} className={`p-1 rounded transition-colors ${layout.stdin ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}><PanelRight size={14} /></button>
        </div>
        <button onClick={onRun} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-semibold transition-colors shadow-md">
          <Play size={13} fill="currentColor" /> <span>Run</span>
        </button>
      </div>
    </div>
  );
}