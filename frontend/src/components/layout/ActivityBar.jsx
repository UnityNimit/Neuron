// src/components/layout/ActivityBar.jsx
import React from 'react';
import { Files, Search, Settings, UserCircle } from 'lucide-react';

// Notice 'onOpenSettings' is received here!
export default function ActivityBar({ layout, setLayout, onOpenSettings }) {
  return (
    <div className="w-12 h-full bg-[#181818] border-r border-[#2b2d31] flex flex-col items-center justify-between py-4 shrink-0 z-40">
      
      {/* Top Icons */}
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

      {/* Bottom Icons */}
      <div className="flex flex-col gap-4 w-full items-center">
        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-300 transition-colors" title="Accounts">
          <UserCircle size={24} strokeWidth={1.5} />
        </button>
        
        {/* THIS IS THE FIX: The onClick event must trigger onOpenSettings */}
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