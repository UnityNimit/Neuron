// src/components/layout/ActivityBar.jsx
import React from 'react';
import { Files, Search, Settings, UserCircle } from 'lucide-react';

export default function ActivityBar({ layout, setLayout, onOpenSettings, onLogout }) {
  return (
    <div className="w-12 h-full bg-[#181818] border-r border-[#2b2d31] flex flex-col items-center justify-between py-4 shrink-0 z-40">
      
      {/* Top Navigation */}
      <div className="flex flex-col gap-4 w-full items-center">
        <button 
          onClick={() => setLayout(prev => ({ ...prev, sidebar: !prev.sidebar }))}
          className={`p-2 rounded-xl transition-colors relative group ${layout.sidebar ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
          title="Explorer"
        >
          {layout.sidebar && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r" />}
          <Files size={24} strokeWidth={1.5} />
        </button>
        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" title="Search">
          <Search size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-4 w-full items-center">
        {/* Sign Out Trigger */}
        <button 
          onClick={onLogout} 
          className="p-2 rounded-xl text-slate-500 hover:text-red-400 transition-colors" 
          title="Sign Out"
        >
          <UserCircle size={24} strokeWidth={1.5} />
        </button>
        
        {/* Settings Modal Trigger */}
        <button 
          onClick={onOpenSettings} 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" 
          title="Manage Settings"
        >
          <Settings size={24} strokeWidth={1.5} />
        </button>
      </div>

    </div>
  );
}