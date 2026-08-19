// src/components/layout/ActivityBar.jsx
import React from 'react';
import { Files, GitBranch, Palette, Settings, UserCircle } from 'lucide-react';

export default function ActivityBar({ layout = {}, setLayout, onOpenSettings, onLogout }) {
  const isSidebarOpen = Boolean(layout?.sidebar);

  return (
    <div className="w-12 h-full bg-[#191a1b] border-r border-[#242628] flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none">
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Explorer Sidebar Toggle */}
        <button 
          onClick={() => setLayout && setLayout(prev => ({ ...prev, sidebar: !prev.sidebar }))}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isSidebarOpen ? 'text-white bg-[#222426]/50' : 'text-slate-500 hover:text-slate-200 hover:bg-[#222426]'
          }`}
          title="Explorer (Ctrl+B)"
        >
          {isSidebarOpen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          )}
          <Files size={20} strokeWidth={1.6} />
        </button>

        {/* Git Source Control */}
        <button 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-[#222426] transition-colors relative cursor-pointer" 
          title="Source Control"
        >
          <GitBranch size={20} strokeWidth={1.6} />
        </button>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. BOTTOM UTILITY ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Color Palette Info */}
        <button 
          onClick={() => alert("Neuron Color System:\n• Primary (TopBar): #121212\n• Secondary (Bars): #191a1b\n• Background (Canvas & Editor): #121314")} 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-[#222426] transition-colors cursor-pointer" 
          title="Color Theme Matrix"
        >
          <Palette size={20} strokeWidth={1.6} />
        </button>

        {/* Settings */}
        <button 
          onClick={onOpenSettings} 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-[#222426] transition-colors cursor-pointer" 
          title="Preferences (Ctrl+,)"
        >
          <Settings size={20} strokeWidth={1.6} />
        </button>

        {/* Sign Out */}
        <button 
          onClick={onLogout} 
          className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer" 
          title="Sign Out"
        >
          <UserCircle size={20} strokeWidth={1.6} />
        </button>

      </div>

    </div>
  );
}