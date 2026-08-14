// src/components/layout/GroupNodes.jsx
import React from 'react';
import { Folder, FileCode2 } from 'lucide-react';

export function FolderNode({ data, selected }) {
  return (
    <div className={`w-full h-full rounded-2xl border-2 bg-[#1e1e1e]/40 backdrop-blur-sm transition-colors ${selected ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'border-slate-700/50 hover:border-slate-600'}`}>
      <div className="absolute top-0 left-0 bg-slate-800/80 px-6 py-2 rounded-br-xl rounded-tl-xl flex items-center gap-2 border-b-2 border-r-2 border-slate-700/50">
        <Folder size={20} className="text-[#dcb67a]" />
        <span className="text-white font-bold tracking-widest uppercase text-sm">{data.label}</span>
      </div>
    </div>
  );
}

export function FileNode({ data, selected }) {
  return (
    <div className={`w-full h-full rounded-xl border-2 bg-[#141414]/80 backdrop-blur-md transition-colors ${selected ? 'border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)]' : 'border-slate-700 hover:border-slate-500'}`}>
      <div className="bg-[#1e1e1e] px-4 py-3 rounded-t-lg flex items-center gap-2 border-b border-slate-700">
        <FileCode2 size={16} className="text-[#519aba]" />
        <span className="text-slate-200 font-semibold tracking-wide">{data.label}</span>
      </div>
    </div>
  );
}