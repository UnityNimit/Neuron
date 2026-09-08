// src/components/canvas/SpatialMinimap.jsx
import React, { useMemo } from 'react';

export default function SpatialMinimap({ nodes = [], simDataRef }) {
  // Compute bounds and scaled positions of celestial nodes
  const radarNodes = useMemo(() => {
    const rawNodes = simDataRef?.current?.nodes || nodes;
    if (!rawNodes || rawNodes.length === 0) return [];

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rawNodes.forEach(n => {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);

    const svgWidth = 112;
    const svgHeight = 64;

    return rawNodes.slice(0, 150).map(n => {
      const isFolder = n.data?.nodeType === 'folder';
      const isFile = n.data?.nodeType === 'file';
      const isHighRisk = n.data?.risk === 'high';

      let color = '#a855f7';
      if (isHighRisk) color = '#ef4444';
      else if (isFolder) color = '#3b82f6';
      else if (isFile) color = '#eab308';

      const normX = ((n.x ?? 0) - minX) / spanX;
      const normY = ((n.y ?? 0) - minY) / spanY;

      return {
        id: n.id,
        cx: 8 + normX * svgWidth,
        cy: 6 + normY * svgHeight,
        r: isFolder ? 2.5 : isFile ? 1.8 : 1.2,
        color
      };
    });
  }, [nodes, simDataRef]);

  return (
    <div 
      className="absolute bottom-4 right-4 z-30 w-32 h-20 rounded-xl border shadow-xl overflow-hidden pointer-events-none select-none backdrop-blur-md flex items-center justify-center p-1.5 animate-in fade-in zoom-in-95 duration-200"
      style={{
        backgroundColor: 'var(--theme-surface, #161719)',
        borderColor: 'var(--theme-border, #242628)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
      }}
    >
      <svg width="100%" height="100%" className="overflow-visible">
        {/* Node dots */}
        {radarNodes.map(rn => (
          <circle 
            key={rn.id} 
            cx={rn.cx} 
            cy={rn.cy} 
            r={rn.r} 
            fill={rn.color} 
            opacity={0.85}
          />
        ))}
      </svg>
    </div>
  );
}
