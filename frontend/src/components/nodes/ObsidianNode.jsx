import React, { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { LOD, THEME } = ENGINE_CONFIG;
const zoomSelector = (s) => s.transform[2];

const ObsidianNode = ({ data, selected }) => {
  const zoom = useStore(zoomSelector);
  const zLevel = zoom < LOD.Z_LEVELS.L1 ? 0 : zoom < LOD.Z_LEVELS.L2 ? 1 : zoom < LOD.Z_LEVELS.L3 ? 2 : 3;

  const isFolder = data.nodeType === 'folder';
  const isFile = data.nodeType === 'file';

  let orbColor = isFolder ? THEME.nodes.folder : isFile ? THEME.nodes.file : THEME.nodes.function;
  let riskGlow = '';

  if (data.risk === 'high') {
    orbColor = THEME.risk.high;
    riskGlow = 'ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
  } else if (data.isImpacted) {
    orbColor = THEME.risk.impact;
    riskGlow = 'ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(251,146,60,0.5)]';
  } else if (selected || data.isFocused) {
    riskGlow = 'ring-2 ring-white scale-125';
  }

  return (
    <div className={`relative flex items-center justify-center ${isFolder ? 'w-10 h-10' : 'w-4 h-4'}`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div 
        onDoubleClick={() => data.onDoubleClickNode && data.onDoubleClickNode(data.filePath, data.line || 1)}
        className={`w-full h-full rounded-full ${orbColor} ${riskGlow} transition-transform z-10 hover:scale-150`}
      />
      {zLevel >= 1 && (
        <div className="absolute top-full mt-1 whitespace-nowrap text-[10px] text-slate-400 bg-black/50 px-1 rounded">
          {data.label}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

// PREVENT LAG: Only re-render if data values actually change
export default memo(ObsidianNode, (prev, next) => {
  return (
    prev.selected === next.selected &&
    prev.data.label === next.data.label &&
    prev.data.risk === next.data.risk &&
    prev.data.isFocused === next.data.isFocused &&
    prev.data.isImpacted === next.data.isImpacted
  );
});