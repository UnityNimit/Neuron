// src/components/layout/StdinPanel.jsx
import React from 'react';
import { TextCursorInput } from 'lucide-react';

export default function StdinPanel({ stdin, setStdin }) {
  return (
    <div className="h-full flex flex-col bg-[#181818]">
      <div className="h-9 shrink-0 bg-[#1e1e1e] flex items-center px-4 border-b border-[#2b2d31] gap-2 text-slate-400 text-xs uppercase tracking-widest font-semibold">
        <TextCursorInput size={14} /> Input
      </div>
      <div className="flex-grow p-2">
        <textarea 
          value={stdin} 
          onChange={(e) => setStdin(e.target.value)} 
          placeholder="Test cases here..." 
          className="w-full h-full bg-[#141414] text-slate-300 font-mono text-sm p-3 border border-[#333] rounded focus:outline-none focus:border-blue-500 transition-colors resize-none whitespace-pre-wrap break-normal" 
        />
      </div>
    </div>
  );
}