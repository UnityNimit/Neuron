// src/components/layout/StdinPanel.jsx
import React from 'react';

export default function StdinPanel({ stdin = "", setStdin }) {
  return (
    <div 
      className="w-full h-full flex flex-col select-none"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      {/* Super-Minimalist Header (Sleek 1px Border) */}
      <div 
        className="h-8 shrink-0 flex items-center px-3 border-b text-[11px] font-mono font-medium tracking-wide"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
      >
        <span>Input</span>
      </div>

      {/* Minimalist Input Area (Sleek 1px Border & 4px Scrollbar) */}
      <div className="flex-grow p-2 overflow-hidden">
        <textarea 
          value={stdin} 
          onChange={(e) => setStdin && setStdin(e.target.value)} 
          placeholder="Test Cases" 
          spellCheck={false}
          className="w-full h-full font-mono text-xs p-2.5 border rounded-lg focus:outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed placeholder:text-slate-600 [&::-webkit-scrollbar]:w-1"
          style={{
            backgroundColor: 'var(--theme-background, #141516)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-primary, #cbd5e1)'
          }}
        />
      </div>
    </div>
  );
}