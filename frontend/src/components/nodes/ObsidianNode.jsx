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

  const zLevel = zoom < LOD.Z_LEVELS.L1 ? 0 : zoom < LOD.Z_LEVELS.L2 ? 1 : zoom < LOD.Z_LEVELS.L3 ? 2 : 3;

  const sizePx = isFolder ? THEME.sizes.folder.px : isFile ? THEME.sizes.file.px : THEME.sizes.function.px;
  
  let orbColor = THEME.nodes.function; 
  if (isFolder) orbColor = THEME.nodes.folder;
  if (isFile) orbColor = THEME.nodes.file; 

  let riskGlow = '';
  if (data.risk === 'high') {
    orbColor = THEME.risk.high; 
    riskGlow = 'ring-4 ring-[#ef4444]/30 shadow-[0_0_30px_rgba(239,68,68,0.8)]';
  } else if (data.isImpacted) {
    orbColor = THEME.risk.impact; 
    riskGlow = 'ring-4 ring-[#fb923c]/30 shadow-[0_0_30px_rgba(251,146,60,0.8)]';
  } else if (selected || data.isFocused || data.isHoveredHighlight) {
    riskGlow = 'ring-2 ring-white/70 shadow-[0_0_20px_rgba(255,255,255,0.6)] scale-125';
  }

  return (
    <div 
      className="relative flex items-center justify-center cursor-pointer"
      style={{ width: `${sizePx}px`, height: `${sizePx}px` }} 
    >
      <Handle type="target" position={Position.Top} className="opacity-0 absolute pointer-events-none border-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

      <div 
        onDoubleClick={() => data.onDoubleClickNode && data.onDoubleClickNode(data.filePath, data.line || 1)}
        className={`w-full h-full rounded-full ${orbColor} ${riskGlow} transition-transform duration-100 z-10 hover:scale-150`}
      />

      <div className="absolute top-full mt-1.5 flex flex-col items-center pointer-events-none z-20 overflow-visible">
        {(zLevel === 1 || zLevel === 2) && (
          <span 
            className={`font-sans whitespace-nowrap px-2 py-0.5 rounded border shadow-md transition-opacity duration-200 ${isFolder ? 'text-[12px] font-bold tracking-[0.1em] uppercase' : isFile ? 'text-[11px] font-semibold' : 'text-[9px]'}`}
            style={{
              backgroundColor: 'var(--theme-surface, #0f0f0f)',
              borderColor: 'var(--theme-border, #333)',
              color: isFolder ? 'var(--theme-text-bright, #e5e5e5)' : isFile ? 'var(--theme-text-primary, #cccccc)' : 'var(--theme-text-secondary, #a3a3a3)'
            }}
          >
            {zLevel === 2 && isFunction ? `def ${data.label?.replace('()', '')}(...) -> ?` : data.label}
          </span>
        )}
        {zLevel === 2 && data.line && (
          <span 
            className="font-mono text-[8px] mt-0.5 px-1 rounded border"
            style={{
              backgroundColor: 'var(--theme-surface, #0f0f0f)',
              borderColor: 'var(--theme-border, #222)',
              color: 'var(--theme-text-muted, #555)'
            }}
          >
            Ln {data.line} {data.risk === 'high' ? '| RISK: CRITICAL' : ''}
          </span>
        )}
        {zLevel === 3 && (
          <div 
            className="mt-2 w-[340px] border rounded-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
              backgroundColor: 'var(--theme-surface, #141414)',
              borderColor: 'var(--theme-border, #333)'
            }}
          >
            <div 
              className="border-b px-3 py-1.5 flex items-center justify-between"
              style={{
                backgroundColor: 'var(--theme-secondary, #1e1e1e)',
                borderColor: 'var(--theme-border, #333)'
              }}
            >
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--theme-text-bright, #fff)' }}>{data.label}</span>
              <span className="font-mono text-[9px]" style={{ color: 'var(--theme-text-muted, #666)' }}>Ln {data.line || 1}</span>
            </div>
            {data.aiSummary && (
              <div 
                className="border-b px-3 py-2"
                style={{
                  backgroundColor: 'var(--theme-surface-hover, #1a202c)',
                  borderColor: 'var(--theme-border, #2d3748)'
                }}
              >
                <span className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--theme-accent, #93c5fd)' }}>[AI]: {data.aiSummary}</span>
              </div>
            )}
            <div className="px-3 py-2" style={{ backgroundColor: 'var(--theme-background, #0f0f0f)' }}>
              <pre className="font-mono text-[9px] whitespace-pre-wrap leading-tight max-h-48 overflow-y-hidden text-left" style={{ color: 'var(--theme-text-secondary, #999)' }}>
                {data.code || "Function code preview..."}
              </pre>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0 absolute pointer-events-none border-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    </div>
  );
};

export default memo(ObsidianNode, (prev, next) => (
  prev.selected === next.selected &&
  prev.data.label === next.data.label &&
  prev.data.risk === next.data.risk &&
  prev.data.isFocused === next.data.isFocused &&
  prev.data.isImpacted === next.data.isImpacted &&
  prev.data.isHoveredHighlight === next.data.isHoveredHighlight && 
  prev.data.aiSummary === next.data.aiSummary &&
  prev.data.code === next.data.code
));