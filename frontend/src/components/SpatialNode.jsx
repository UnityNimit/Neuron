// src/components/SpatialNode.jsx
import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Code2 } from 'lucide-react';

export default function SpatialNode({ id, data }) {
  const { glowColor, borderColor } = useMemo(() => {
    if (data.isImpacted) return { glowColor: 'shadow-orange-500/80', borderColor: 'border-orange-500' };
    if (data.isFocused) return { glowColor: 'shadow-purple-500/80', borderColor: 'border-purple-500' };
    if (data.risk === 'high') return { glowColor: 'shadow-red-500/50', borderColor: 'border-red-500' };
    return { glowColor: 'shadow-blue-500/10', borderColor: 'border-slate-700' };
  }, [data.isImpacted, data.isFocused, data.risk]);

  return (
    <div 
      onDoubleClick={() => data.onDoubleClickNode(data.filePath, data.line)}
      className={`w-[300px] h-[60px] bg-[#1e1e1e] rounded-lg border-2 ${borderColor} ${glowColor} flex flex-col justify-center px-4 font-sans cursor-pointer hover:bg-[#252526] transition-colors`}
      title="Double click to edit code"
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-blue-500 border-none" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Box size={14} className="text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">{data.fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm">Ln {data.line}</span>
          <Code2 size={12} className="text-slate-500" />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-blue-500 border-none" />
    </div>
  );
}