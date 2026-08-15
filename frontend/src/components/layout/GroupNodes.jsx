// src/components/layout/GroupNodes.jsx
import React from 'react';
import { useStore } from '@xyflow/react';

export function FolderNode({ data, selected }) {
  const zoom = useStore((s) => s.transform[2]);
  const showLabel = zoom > 0.15; // Folders labels show from very far away

  return (
    <div className={`w-full h-full rounded-3xl border-2 transition-all duration-500 ${selected ? 'border-[#519aba]/60 bg-[#519aba]/5' : 'border-[#333]/30 hover:border-[#555]/50'}`}>
      <div className={`absolute -top-5 left-4 transition-opacity duration-500 ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-[#555] font-sans font-bold text-[10px] uppercase tracking-widest">{data.label}</span>
      </div>
    </div>
  );
}

export function FileNode({ data, selected }) {
  const zoom = useStore((s) => s.transform[2]);
  const showLabel = zoom > 0.3; // File labels show mid-zoom

  return (
    <div className={`w-full h-full rounded-2xl border border-dashed transition-all duration-500 ${selected ? 'border-[#a855f7]/60 bg-[#a855f7]/5' : 'border-[#444]/30 hover:border-[#666]/60'}`}>
      <div className={`absolute -top-4 left-4 transition-opacity duration-500 ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-[#888] font-sans font-medium text-[10px]">{data.label}</span>
      </div>
    </div>
  );
}