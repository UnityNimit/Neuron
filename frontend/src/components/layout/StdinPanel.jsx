// src/components/layout/StdinPanel.jsx
import React from 'react';

export default function StdinPanel({ stdin = "", setStdin }) {
  return (
    <div className="w-full h-full flex flex-col bg-[#191a1b] select-none">
      
      {/* Super-Minimalist Header (Sleek 1px Border) */}
      <div className="h-8 shrink-0 bg-[#191a1b] flex items-center px-3 border-b border-[#242628] text-[11px] font-mono font-medium tracking-wide text-slate-300">
        <span>Input</span>
      </div>

      {/* Minimalist Input Area (Sleek 1px Border & 4px Scrollbar) */}
      <div className="flex-grow p-2 overflow-hidden">
        <textarea 
          value={stdin} 
          onChange={(e) => setStdin && setStdin(e.target.value)} 
          placeholder="Test Cases" 
          spellCheck={false}
          className="w-full h-full bg-[#141516] text-slate-300 font-mono text-xs p-2.5 border border-[#242628] rounded-lg focus:outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed placeholder:text-slate-600 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2a2c2e] [&::-webkit-scrollbar-thumb:hover]:bg-[#3b82f6]" 
        />
      </div>
    </div>
  );
}