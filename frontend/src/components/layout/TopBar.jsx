import React from 'react';
import { Play, PanelLeft, PanelBottom, PanelRight } from 'lucide-react';

export default function TopBar({ onRun, layout, setLayout }) {
  const toggleLayout = (panel) => {
    setLayout(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  return (
    <div className="h-12 shrink-0 bg-[#181818] border-b border-[#2b2d31] flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
        <h1 className="text-white font-bold tracking-wide flex items-center gap-2 text-sm">
          NEURON
        </h1>
      </div>
      
      {/* VS Code Style Layout Toggles */}
      <div className="flex items-center gap-1 bg-[#232325] p-1 rounded-md border border-[#333]">
        <button 
          onClick={() => toggleLayout('sidebar')} 
          className={`p-1.5 rounded transition-colors ${layout.sidebar ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          title="Toggle Primary Side Bar"
        >
          <PanelLeft size={16} />
        </button>
        <button 
          onClick={() => toggleLayout('terminal')} 
          className={`p-1.5 rounded transition-colors ${layout.terminal ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          title="Toggle Panel"
        >
          <PanelBottom size={16} />
        </button>
        <button 
          onClick={() => toggleLayout('stdin')} 
          className={`p-1.5 rounded transition-colors ${layout.stdin ? 'bg-[#3b4048] text-white' : 'text-slate-400 hover:text-slate-200'}`}
          title="Toggle Secondary Side Bar"
        >
          <PanelRight size={16} />
        </button>
      </div>

      <button onClick={onRun} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors shadow-lg">
        <Play size={14} fill="currentColor" /> Run
      </button>
    </div>
  );
}