// src/components/nodes/NebulaOverlay.jsx
import React, { useMemo, useRef, useState, useEffect, memo } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { polygonHull } from 'd3-polygon';

const NEBULA_BLUR = '15px'; // Reduced from 30px for GPU relief
const NEBULA_PADDING = 70;
const NEBULA_TRACKING_SPEED = '0s';

export default function NebulaOverlay() {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();
  const [hulls, setHulls] = useState([]);
  const frameCounter = useRef(0);

  useEffect(() => {
    frameCounter.current++;
    // Only calculate hulls every 5th update to save CPU
    if (frameCounter.current % 5 !== 0) return;

    const groups = {};
    nodes.forEach(n => {
      const comm = n.data?.community;
      if (comm !== undefined) {
        if (!groups[comm]) groups[comm] = [];
        groups[comm].push(n);
      }
    });

    const newHulls = Object.entries(groups).map(([id, commNodes]) => {
      if (commNodes.length < 3) return null;
      // Extract points
      const pts = [];
      commNodes.forEach(n => {
        pts.push([n.position.x - NEBULA_PADDING, n.position.y - NEBULA_PADDING]);
        pts.push([n.position.x + NEBULA_PADDING, n.position.y + NEBULA_PADDING]);
      });
      const hull = polygonHull(pts);
      return hull ? { id, path: `M${hull.join('L')}Z`, colorIdx: parseInt(id) % 5 } : null;
    }).filter(Boolean);

    setHulls(newHulls);
  }, [nodes]);

  if (zoom > 1.1) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
        {hulls.map(h => (
          <path
            key={h.id}
            d={h.path}
            fill="rgba(59, 130, 246, 0.05)"
            stroke="rgba(59, 130, 246, 0.1)"
            strokeWidth={10}
            style={{ filter: `blur(${NEBULA_BLUR})`, transition: `d ${NEBULA_TRACKING_SPEED} linear` }}
          />
        ))}
      </g>
    </svg>
  );
}