// src/components/canvas/SpatialMinimap.jsx
import React, { useEffect, useRef } from 'react';

const MINIMAP_WIDTH = 136;
const MINIMAP_HEIGHT = 84;
const PADDING_PX = 8;

export default function SpatialMinimap({ nodes = [], simDataRef }) {
  const canvasRef = useRef(null);
  const fallbackNodesRef = useRef(nodes);

  useEffect(() => {
    fallbackNodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId;
    let isMounted = true;

    const renderFrame = () => {
      if (!isMounted) return;

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.floor(MINIMAP_WIDTH * dpr);
      const targetH = Math.floor(MINIMAP_HEIGHT * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

      const rawNodes = simDataRef?.current?.nodes?.length
        ? simDataRef.current.nodes
        : fallbackNodesRef.current;

      if (rawNodes && rawNodes.length > 0) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < rawNodes.length; i++) {
          const n = rawNodes[i];
          const x = typeof n.x === 'number' && !isNaN(n.x) ? n.x : 0;
          const y = typeof n.y === 'number' && !isNaN(n.y) ? n.y : 0;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }

        const worldPad = 60;
        minX -= worldPad;
        maxX += worldPad;
        minY -= worldPad;
        maxY += worldPad;

        const spanX = Math.max(maxX - minX, 1);
        const spanY = Math.max(maxY - minY, 1);

        const drawW = MINIMAP_WIDTH - PADDING_PX * 2;
        const drawH = MINIMAP_HEIGHT - PADDING_PX * 2;

        // Preserve aspect ratio and center inside minimap
        const scale = Math.min(drawW / spanX, drawH / spanY);
        const offsetX = PADDING_PX + (drawW - spanX * scale) * 0.5;
        const offsetY = PADDING_PX + (drawH - spanY * scale) * 0.5;

        for (let i = 0; i < rawNodes.length; i++) {
          const n = rawNodes[i];
          const nx = typeof n.x === 'number' && !isNaN(n.x) ? n.x : 0;
          const ny = typeof n.y === 'number' && !isNaN(n.y) ? n.y : 0;

          const cx = offsetX + (nx - minX) * scale;
          const cy = offsetY + (ny - minY) * scale;

          const nodeType = n.data?.nodeType;
          const risk = n.data?.risk;

          let color = '#8b5cf6'; // Function
          let r = 0.75;

          if (nodeType === 'folder') {
            color = '#e4ef61';
            r = 1.35;
          } else if (nodeType === 'file') {
            color = '#3b82f6';
            r = 1.0;
          }

          if (risk === 'high') {
            color = '#ef4444';
          } else if (risk === 'medium') {
            color = '#f59e0b';
          }

          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      ctx.restore();
      animFrameId = requestAnimationFrame(renderFrame);
    };

    animFrameId = requestAnimationFrame(renderFrame);

    return () => {
      isMounted = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [simDataRef]);

  return (
    <div
      className="absolute bottom-3 right-3 z-30 border rounded-none shadow-none overflow-hidden pointer-events-none select-none flex items-center justify-center"
      style={{
        width: `${MINIMAP_WIDTH}px`,
        height: `${MINIMAP_HEIGHT}px`,
        backgroundColor: 'var(--theme-surface, #161719)',
        borderColor: 'var(--theme-border, #242628)',
        boxShadow: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${MINIMAP_WIDTH}px`,
          height: `${MINIMAP_HEIGHT}px`,
          display: 'block'
        }}
      />
    </div>
  );
}
