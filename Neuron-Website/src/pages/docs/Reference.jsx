// src/pages/docs/Reference.jsx
import React from 'react';
import { DocSection, Callout } from '../../components/docs/DocComponents';

// 🎹 Custom Component for rendering gorgeous Keyboard Keys

export const Shortcut = ({ keys, description }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group">
    <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{description}</span>
    <div className="flex items-center gap-1.5">
      {keys.map((k, i) => (
        <kbd key={i} className="min-w-[28px] text-center px-2 py-1 bg-[#1e1e1e] border border-[#333] border-b-[#111] rounded-md text-[11px] font-mono text-slate-400 shadow-[0_2px_0_rgba(0,0,0,0.5)] group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors">
          {k}
        </kbd>
      ))}
    </div>
  </div>
);
