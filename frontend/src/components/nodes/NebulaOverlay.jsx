// src/components/nodes/NebulaOverlay.jsx
import React, { useMemo } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { polygonHull } from 'd3-polygon';

// ==========================================
// 🛠️ TWEAK THESE TO CHANGE NEBULA AESTHETICS
// ==========================================
const NEBULA_BLUR = '30px';     
const NEBULA_PADDING = 80;      
const NEBULA_STROKE_WIDTH = 20;
// Set to '0s' for INSTANT tracking, or '0.1s' for a slightly fluid, ghostly drag.
const NEBULA_TRACKING_SPEED = '0s'; 
// ==========================================

const NEBULA_COLORS = [
  { fill: 'rgba(59, 130, 246, 0.08)', stroke: 'rgba(59, 130, 246, 0.2)' }, // Blue
  { fill: 'rgba(168, 85, 247, 0.08)', stroke: 'rgba(168, 85, 247, 0.2)' }, // Purple
  { fill: 'rgba(34, 197, 94, 0.08)', stroke: 'rgba(34, 197, 94, 0.2)' },   // Green
  { fill: 'rgba(236, 72, 153, 0.08)', stroke: 'rgba(236, 72, 153, 0.2)' }, // Pink
  { fill: 'rgba(234, 179, 8, 0.08)', stroke: 'rgba(234, 179, 8, 0.2)' },   // Yellow
  { fill: 'rgba(249, 115, 22, 0.08)', stroke: 'rgba(249, 115, 22, 0.2)' }, // Orange
];

export default function NebulaOverlay() {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();

  const hulls = useMemo(() => {
    const groups = {};
    
    nodes.forEach(n => {
      const comm = n.data?.community;
      if (comm !== undefined && comm !== null) {
        if (!groups[comm]) groups[comm] = [];
        groups[comm].push(n);
      }
    });

    const generatedHulls = [];
    
    Object.entries(groups).forEach(([commId, commNodes]) => {
      if (commNodes.length < 3) return;

      const points = [];
      
      commNodes.forEach(n => {
        const nx = n.position?.x ?? 0;
        const ny = n.position?.y ?? 0;
        
        points.push([nx - NEBULA_PADDING, ny - NEBULA_PADDING]);
        points.push([nx + NEBULA_PADDING, ny - NEBULA_PADDING]);
        points.push([nx - NEBULA_PADDING, ny + NEBULA_PADDING]);
        points.push([nx + NEBULA_PADDING, ny + NEBULA_PADDING]);
      });

      const hull = polygonHull(points);
      if (hull) {
        generatedHulls.push({
          id: commId,
          path: `M${hull.join('L')}Z`, 
          colorIdx: parseInt(commId) % NEBULA_COLORS.length
        });
      }
    });

    return generatedHulls;
  }, [nodes]);

  const isTooClose = zoom > 1.2;

  if (hulls.length === 0 || isTooClose) return null;

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700" 
      style={{ zIndex: 0 }} 
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {hulls.map(hull => (
          <path
            key={hull.id}
            d={hull.path}
            fill={NEBULA_COLORS[hull.colorIdx].fill}
            stroke={NEBULA_COLORS[hull.colorIdx].stroke}
            strokeWidth={NEBULA_STROKE_WIDTH} 
            strokeLinejoin="round" 
            // FIX: Target the CSS transition specifically!
            style={{ 
              filter: `blur(${NEBULA_BLUR})`,
              transition: `d ${NEBULA_TRACKING_SPEED} linear, fill 0.5s, stroke 0.5s`
            }} 
          />
        ))}
      </g>
    </svg>
  );
}