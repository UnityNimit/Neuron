// src/components/CodeNode.jsx
import React from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

export default function CodeNode({ id, data }) {
  const zoom = useStore((s) => s.transform[2]);
  
  // LOD thresholds based on node type
  const isFolder = data.nodeType === 'folder';
  const isFile = data.nodeType === 'file';
  const isFunction = data.nodeType === 'function';

  // Obsidian Label Fade Logic
  const showLabel = (isFolder && zoom > 0.1) || (isFile && zoom > 0.3) || (isFunction && zoom > 0.6);

  // Obsidian Sizing & Coloring
  let sizeClass = 'w-4 h-4'; // default function size
  let orbColor = 'bg-[#8b5cf6]'; // Functions are Purple
  let labelColor = 'text-[#999]';
  let labelSize = 'text-[9px]';

  if (isFolder) {
    sizeClass = 'w-10 h-10';
    orbColor = 'bg-[#4b5563]'; // Gray
    labelColor = 'text-[#ccc] font-bold tracking-widest';
    labelSize = 'text-[14px]';
  } else if (isFile) {
    sizeClass = 'w-6 h-6';
    orbColor = 'bg-[#3b82f6]'; // Blue
    labelColor = 'text-[#aaa] font-semibold';
    labelSize = 'text-[11px]';
  }

  if (data.isFocused) orbColor = 'bg-[#facc15] shadow-[0_0_25px_rgba(250,204,21,0.6)]'; // Yellow highlight

  return (
    <div 
      onDoubleClick={() => data.onDoubleClickNode && data.onDoubleClickNode(data.filePath, data.line || 1)}
      className="flex flex-col items-center justify-center cursor-pointer relative"
    >
      {/* Invisible Handles exactly in the center so lines look native */}
      <Handle type="target" position={Position.Top} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      
      {/* THE ORB */}
      <div className={`${sizeClass} rounded-full ${orbColor} transition-transform duration-100 hover:scale-125 z-10 shadow-sm`} />

      {/* THE LABEL */}
      <div className={`absolute top-full mt-1.5 flex flex-col items-center transition-opacity duration-200 pointer-events-none ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
        <span className={`${labelColor} ${labelSize} font-sans whitespace-nowrap drop-shadow-md`}>
          {data.label}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}