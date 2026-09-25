// src/components/layout/StdinPanel.jsx
import React from 'react';

export default function StdinPanel({ stdin = "", setStdin }) {
  return (
    <div 
      className="w-full h-full flex flex-col select-none"
      style={{
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      <textarea 
        value={stdin} 
        onChange={(e) => setStdin && setStdin(e.target.value)} 
        placeholder="Test Cases" 
        spellCheck={false}
        className="w-full h-full font-mono text-xs p-3 bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-[var(--theme-text-muted)] placeholder:opacity-50 [&::-webkit-scrollbar]:w-1"
        style={{
          backgroundColor: 'var(--theme-background, #121314)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
      />
    </div>
  );
}