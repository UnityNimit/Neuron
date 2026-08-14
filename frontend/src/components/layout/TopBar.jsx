// src/components/layout/TopBar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, Layout } from 'lucide-react';

export default function TopBar({ 
  onRun, onOpenFolder, onCreateFile, layout, setLayout, onOpenCommandPalette, onOpenSettings 
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

  const handleShowShortcuts = () => {
    alert(`NEURON IDE - KEYBOARD SHORTCUTS REFERENCE

[ FILE COMMANDS ]
New File             Ctrl+N
New Window           Ctrl+Shift+N
Open Folder          Ctrl+K Ctrl+O
Save                 Ctrl+S

[ EDIT COMMANDS ]
Undo                 Ctrl+Z
Redo                 Ctrl+Y
Cut                  Ctrl+X
Copy                 Ctrl+C
Paste                Ctrl+V
Find                 Ctrl+F
Replace              Ctrl+H
Find in Files        Ctrl+Shift+F
Replace in Files     Ctrl+Shift+H
Toggle Line Comment  Ctrl+/
Toggle Block Comment Shift+Alt+A

[ VIEW & LAYOUT ]
Command Palette      Ctrl+K  or  Cmd+K
Show All Commands    Ctrl+Shift+P
Toggle Sidebar       Ctrl+B
Toggle Terminal      Ctrl+\`

[ SPATIAL MAP ENGINE ]
Impact Analysis      Alt+I
Focus Isolation      F
Clear Focus/Impact   Esc
Open Full Editor     Double Click Node`);
  };

  const menuItems = ['File', 'Edit', 'Help'];

  // --- PERFECTED FILE MENU ---
  const fileDropdownItems = [
    { label: "Open File...", action: () => alert("Please use the Explorer sidebar to open workspace files."), shortcut: "Ctrl+O" },
    { label: "Open Folder...", action: onOpenFolder, shortcut: "Ctrl+K Ctrl+O" },
    { label: "Open Recent", action: () => alert("No recent workspaces found.") },
    { separator: true },
    { label: "Save", action: () => console.log("Auto-save active"), shortcut: "Ctrl+S" },
    { label: "Save As...", action: () => alert("Save As is disabled (Auto-Sync is active)") },
    { label: "Auto Save", action: () => {}, toggle: true },
    { separator: true },
    { label: "Preferences", action: onOpenSettings, shortcut: "Ctrl+," },
    { separator: true },
    { label: "Exit", action: () => window.close() }
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
    { label: "Find", action: onOpenCommandPalette, shortcut: "Ctrl+F" },
    { label: "Replace", action: onOpenCommandPalette, shortcut: "Ctrl+H" },
    { separator: true },
    { label: "Find in Files", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+F" },
    { label: "Replace in Files", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+H" },
    { separator: true },
    { label: "Toggle Line Comment", action: () => console.log("Use editor shortcut"), shortcut: "Ctrl+/" },
    { label: "Toggle Block Comment", action: () => console.log("Use editor shortcut"), shortcut: "Shift+Alt+A" }
  ];

  // --- HELP MENU ---
  const helpDropdownItems = [
    { label: "Documentation", action: () => window.open("https://neuron-website-ruby.vercel.app/docs", "_blank") },
    { label: "Keyboard Shortcuts Reference", action: handleShowShortcuts },
    { label: "Show All Commands", action: onOpenCommandPalette, shortcut: "Ctrl+Shift+P" },
    { separator: true },
    { label: "About Neuron", action: () => window.open("https://neuron-website-ruby.vercel.app/", "_blank") }
  ];

  // --- UNIFIED LAYOUT MENU ---
  const layoutDropdownItems = [
    { label: "Show Sidebar", action: () => toggleLayout('sidebar'), toggle: layout.sidebar, shortcut: "Ctrl+B" },
    { label: "Show Terminal Panel", action: () => toggleLayout('terminal'), toggle: layout.terminal, shortcut: "Ctrl+`" },
    { label: "Show Stdin Panel", action: () => toggleLayout('stdin'), toggle: layout.stdin }
  ];

  const getDropdownItems = (item) => {
    if (item === 'File') return fileDropdownItems;
    if (item === 'Edit') return editDropdownItems;
    if (item === 'Layout') return layoutDropdownItems;
    return helpDropdownItems;
  };

  const renderDropdown = (item) => (
    <div className={`absolute top-full ${item === 'Layout' ? 'right-0' : 'left-0'} mt-1 w-64 bg-[#252526] border border-[#454545] rounded-md shadow-2xl py-1 z-[100] animate-in fade-in slide-in-from-top-1 duration-100`}>
      {getDropdownItems(item).map((opt, idx) => (
        opt.separator ? (
          <div key={idx} className="h-[1px] bg-[#454545] my-1.5 mx-3" />
        ) : (
          <button 
            key={idx} 
            onClick={(e) => { 
              e.stopPropagation(); 
              opt.action(); 
              if (item !== 'Layout') setActiveMenu(null); 
            }} 
            className="w-full text-left px-5 py-1 hover:bg-[#04395e] hover:text-white text-[#cccccc] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              {opt.toggle && <span className="text-blue-400 font-bold absolute left-2">✓</span>}
              <span className={opt.toggle ? "ml-4" : "ml-0"}>{opt.label}</span>
            </div>
            {opt.shortcut && <span className="text-[11px] text-slate-500 tracking-wide">{opt.shortcut}</span>}
          </button>
        )
      ))}
    </div>
  );

  return (
    <div className="h-[38px] shrink-0 bg-[#181818] border-b border-[#2b2d31] flex items-center justify-between px-3 text-[13px] text-slate-300 font-sans select-none z-50">
      
      {/* LEFT SECTION: Logo & Standard Menus */}
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2 pr-2">
          {/* Flat matte logo (glow removed) */}
          <img src="/logo.png" alt="Logo" className="h-5 w-5 object-contain" />
        </div>

        <div className="hidden md:flex items-center text-[#cccccc]" ref={menuRef}>
          {menuItems.map((item) => (
            <div key={item} className="relative">
              <button 
                onClick={() => setActiveMenu(activeMenu === item ? null : item)}
                className={`px-2.5 py-1 rounded-md transition-colors ${activeMenu === item ? 'bg-[#333] text-white' : 'hover:text-white hover:bg-[#2a2d31]'}`}
              >
                {item}
              </button>
              {activeMenu === item && renderDropdown(item)}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SECTION: Perfect Square Buttons */}
      <div className="flex items-center justify-end gap-2 flex-1">
        
        {/* SQUARE LAYOUT BUTTON */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'Layout' ? null : 'Layout'); }}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors border ${activeMenu === 'Layout' ? 'bg-[#333] text-white border-[#454545]' : 'bg-[#1e1e1e] text-slate-400 border-[#333] hover:text-slate-200 hover:bg-[#2a2d31]'}`}
            title="Toggle IDE Panels"
          >
            <Layout size={14} />
          </button>
          {activeMenu === 'Layout' && renderDropdown('Layout')}
        </div>
        
        {/* SQUARE EXECUTE BUTTON */}
        <button 
          onClick={onRun} 
          className="flex items-center justify-center w-7 h-7 bg-green-600/90 hover:bg-green-500 text-white rounded-md transition-colors shadow-md border border-green-700/50"
          title="Run Code"
        >
          {/* ml-0.5 centers the slightly lopsided play triangle perfectly! */}
          <Play size={15} fill="currentColor" className="ml-0.5" />
        </button>
      </div>
      
    </div>
  );
}