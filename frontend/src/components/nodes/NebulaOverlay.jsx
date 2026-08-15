// src/components/nodes/NebulaOverlay.jsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { polygonHull } from 'd3-polygon';

const NEBULA_PADDING = 80;
const NEBULA_TRACKING_SPEED = '0s'; // Instant tracking to avoid CSS lag

const NEBULA_COLORS = [
  { fill: 'rgba(59, 130, 246, 0.08)', stroke: 'rgba(59, 130, 246, 0.15)' }, // Blue
  { fill: 'rgba(168, 85, 247, 0.08)', stroke: 'rgba(168, 85, 247, 0.15)' }, // Purple
  { fill: 'rgba(34, 197, 94, 0.08)', stroke: 'rgba(34, 197, 94, 0.15)' },   // Green
  { fill: 'rgba(236, 72, 153, 0.08)', stroke: 'rgba(236, 72, 153, 0.15)' }, // Pink
  { fill: 'rgba(234, 179, 8, 0.08)', stroke: 'rgba(234, 179, 8, 0.15)' },   // Yellow
];

export default function NebulaOverlay() {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();
  const [hulls, setHulls] = useState([]);
  const frameCounter = useRef(0);

  useEffect(() => {
    frameCounter.current++;
    // CPU SAVER: Only recalculate boundaries every 5 physics frames
    if (frameCounter.current % 5 !== 0) return;

    const groups = {};
    nodes.forEach(n => {
      const comm = n.data?.community;
      if (comm !== undefined && comm !== null) {
        if (!groups[comm]) groups[comm] = [];
        groups[comm].push(n);
      }
    });

    const newHulls = Object.entries(groups).map(([id, commNodes]) => {
      if (commNodes.length < 3) return null;
      
      const pts = [];
      commNodes.forEach(n => {
        const nx = n.position?.x ?? 0;
        const ny = n.position?.y ?? 0;
        // Draw boundaries safely away from the nodes
        pts.push([nx - NEBULA_PADDING, ny - NEBULA_PADDING]);
        pts.push([nx + NEBULA_PADDING, ny - NEBULA_PADDING]);
        pts.push([nx - NEBULA_PADDING, ny + NEBULA_PADDING]);
        pts.push([nx + NEBULA_PADDING, ny + NEBULA_PADDING]);
      });
      
      const hull = polygonHull(pts);
      return hull ? { id, path: `M${hull.join('L')}Z`, colorIdx: parseInt(id) % NEBULA_COLORS.length } : null;
    }).filter(Boolean);

    setHulls(newHulls);
  }, [nodes]);

  // LOD: Hide clouds if zoomed in close to read code
  if (zoom > 1.2) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {hulls.map(h => (
          <path
            key={h.id}
            d={h.path}
            fill={NEBULA_COLORS[h.colorIdx].fill}
            stroke={NEBULA_COLORS[h.colorIdx].stroke}
            strokeWidth={100} // This replaces Blur! Massive rounded borders create the cloud effect!
            strokeLinejoin="round"
            style={{ transition: `d ${NEBULA_TRACKING_SPEED} linear` }}
          />
        ))}
      </g>
    </svg>
  );
}