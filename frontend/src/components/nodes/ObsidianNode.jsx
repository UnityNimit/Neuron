// src/components/nodes/ObsidianNode.jsx
import React, { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { LOD, THEME } = ENGINE_CONFIG;
const zoomSelector = (s) => s.transform[2];

const ObsidianNode = ({ data, selected }) => {
  const zoom = useStore(zoomSelector);

  const isFolder = data.nodeType === 'folder';
  const isFile = data.nodeType === 'file';
  const isFunction = data.nodeType === 'function';

  // --- Z-LEVEL LOD SYSTEM ---
  const zLevel = zoom < LOD.Z_LEVELS.L1 ? 0 : zoom < LOD.Z_LEVELS.L2 ? 1 : zoom < LOD.Z_LEVELS.L3 ? 2 : 3;

  // --- ORBITAL PHYSICS SIZING ---
  const sizeClass = isFolder ? THEME.sizes.folder.class : isFile ? THEME.sizes.file.class : THEME.sizes.function.class;
  const sizePx = isFolder ? THEME.sizes.folder.px : isFile ? THEME.sizes.file.px : THEME.sizes.function.px;
  
  let orbColor = THEME.nodes.function; 
  if (isFolder) orbColor = THEME.nodes.folder;
  if (isFile) orbColor = THEME.nodes.file; 

  // --- AI RISK HEATMAP OVERRIDES ---
  let riskGlow = '';
  if (data.risk === 'high') {
    orbColor = THEME.risk.high; 
    riskGlow = 'ring-4 ring-[#ef4444]/30 shadow-[0_0_30px_rgba(239,68,68,0.8)]';
  } else if (data.isImpacted) {
    orbColor = THEME.risk.impact; 
    riskGlow = 'ring-4 ring-[#fb923c]/30 shadow-[0_0_30px_rgba(251,146,60,0.8)]';
  } else if (selected || data.isFocused) {
    riskGlow = 'ring-2 ring-white/50 shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-125';
  }

  return (
    <div className={`relative flex items-center justify-center ${sizeClass} cursor-pointer`}>
      <Handle type="target" position={Position.Top} className="opacity-0 absolute pointer-events-none border-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

      <div 
        onDoubleClick={() => data.onDoubleClickNode && data.onDoubleClickNode(data.filePath, data.line || 1)}
        className={`w-full h-full rounded-full ${orbColor} ${riskGlow} transition-transform duration-100 z-10 hover:scale-150`}
      />

      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 flex flex-col items-center pointer-events-none z-20 overflow-visible">
        
        {(zLevel === 1 || zLevel === 2) && (
          <span className={`font-sans whitespace-nowrap bg-[#0f0f0f]/95 px-2 py-0.5 rounded border border-[#333] shadow-md transition-opacity duration-200 ${isFolder ? 'text-[#e5e5e5] text-[12px] font-bold tracking-[0.1em] uppercase' : isFile ? 'text-[#cccccc] text-[11px] font-semibold' : 'text-[#a3a3a3] text-[9px]'}`}>
            {zLevel === 2 && isFunction ? `def ${data.label?.replace('()', '')}(...) -> ?` : data.label}
          </span>
        )}

        {zLevel === 2 && data.line && (
          <span className="text-[#555] font-mono text-[8px] mt-0.5 bg-[#0f0f0f]/95 px-1 rounded border border-[#222]">
            Ln {data.line} {data.risk === 'high' ? '| RISK: CRITICAL' : ''}
          </span>
        )}

        {zLevel === 3 && (
          <div className="mt-2 w-[340px] bg-[#141414] border border-[#333] rounded-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-[#1e1e1e] border-b border-[#333] px-3 py-1.5 flex items-center justify-between">
              <span className="text-white font-mono text-[11px] font-bold">{data.label}</span>
              <span className="text-[#666] font-mono text-[9px]">Ln {data.line || 1}</span>
            </div>
            {data.aiSummary && (
              <div className="bg-[#1a202c] border-b border-[#2d3748] px-3 py-2">
                <span className="text-[#93c5fd] font-sans text-[10px] leading-relaxed">[AI]: {data.aiSummary}</span>
              </div>
            )}
            <div className="px-3 py-2 bg-[#0f0f0f]">
              <pre className="text-[#999] font-mono text-[9px] whitespace-pre-wrap leading-tight">{data.code || "Function code preview..."}</pre>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 absolute pointer-events-none border-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    </div>
  );
};

export default memo(ObsidianNode);