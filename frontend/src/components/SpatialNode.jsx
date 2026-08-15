// src/components/CodeNode.jsx
import React from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

export default function CodeNode({ id, data }) {
  // --- PERFECT LOD SYSTEM ---
  // Hook directly into the React Flow camera zoom matrix
  const zoom = useStore((s) => s.transform[2]);
  const showLabel = zoom > 0.45; // Labels appear when zooming in
  const showDetails = zoom > 0.8; // Line numbers appear when extremely close

  const isFocused = data.isFocused;
  const isImpacted = data.isImpacted;

  // Obsidian-style Orbital Colors
  let orbColor = 'bg-[#a3a3a3]'; // Default gray dot
  if (data.fileName && data.fileName.includes('()')) orbColor = 'bg-[#60a5fa]'; // Functions are soft blue
  if (data.risk === 'high') orbColor = 'bg-[#f87171]'; // High risk is red
  if (isImpacted) orbColor = 'bg-[#fb923c] shadow-[0_0_20px_rgba(251,146,60,0.8)]'; // Blast radius
  if (isFocused) orbColor = 'bg-[#c084fc] shadow-[0_0_20px_rgba(192,132,252,0.8)]'; // Focused

  return (
    <div 
      onDoubleClick={() => data.onDoubleClickNode && data.onDoubleClickNode(data.filePath, data.line || 1)}
      // Fills the packing boundary but centers the physical orb
      className="w-full h-full flex flex-col items-center justify-center group cursor-pointer"
    >
      {/* 
        MAGIC TRICK: 
        We force the handles to the absolute mathematical center of the 260x45 box.
        This forces the connecting lines to shoot directly into the dot! 
      */}
      <Handle type="target" position={Position.Top} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      
      {/* THE ACTUAL ORB */}
      <div className={`w-4 h-4 rounded-full ${orbColor} transition-transform duration-200 group-hover:scale-150 z-10`} />

      {/* LOD LABELS (Fades out when zoomed out) */}
      <div className={`absolute top-[60%] flex flex-col items-center transition-opacity duration-300 pointer-events-none ${showLabel ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-[#a3a3a3] font-sans text-[11px] whitespace-nowrap group-hover:text-white transition-colors">
          {data.fileName || "unnamed"}
        </span>
        {showDetails && data.line && (
          <span className="text-[#555] font-mono text-[9px] mt-0.5">Ln {data.line}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}