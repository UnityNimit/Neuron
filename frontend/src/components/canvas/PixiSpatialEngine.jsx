// src/components/canvas/PixiSpatialEngine.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { THEME, LOD } = ENGINE_CONFIG;

// Parse Tailwind Hex string to WebGL Hex Number
const hexToNumber = (hex) => parseInt(hex.replace('bg-[', '').replace(']', '').replace('#', '0x'), 16);

// ML Nebula Colors (Hex format for PixiJS)
const NEBULA_COLORS = [
  { fill: 0x3b82f6, stroke: 0x3b82f6 }, // Blue
  { fill: 0xa855f7, stroke: 0xa855f7 }, // Purple
  { fill: 0x22c55e, stroke: 0x22c55e }, // Green
  { fill: 0xec4899, stroke: 0xec4899 }, // Pink
  { fill: 0xeab308, stroke: 0xeab308 }, // Yellow
  { fill: 0xf97316, stroke: 0xf97316 }, // Orange
];
const NEBULA_PADDING = 80;

export default function PixiSpatialEngine({ 
  simDataRef, 
  activeRay, focusIsolationId, blastRadius, 
  onDragStart, onDragMove, onDragEnd,
  onNodeDoubleClick, onNodeHover
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  
  // 🚀 ANTI-BLINK: Mutable state ref prevents WebGPU from rebooting on hover!
  const stateRef = useRef({ activeRay, focusIsolationId, blastRadius, onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd });
  
  useEffect(() => {
    stateRef.current = { activeRay, focusIsolationId, blastRadius, onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd };
  }, [activeRay, focusIsolationId, blastRadius, onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd]);

  useEffect(() => {
    if (!containerRef.current || !simDataRef?.current) return;

    let isMounted = true;
    let viewport;
    const spriteMap = new Map();

    const initWebGPU = async () => {
      const app = new PIXI.Application();
      
      await app.init({
        resizeTo: containerRef.current,
        backgroundColor: 0x0a0a0a,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: false, // Saves massive VRAM
        preference: 'webgpu' 
      });

      if (!isMounted) { app.destroy(true); return; }
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 100000, 
        worldHeight: 100000,
        events: app.renderer.events
      });
      
      viewport.drag().pinch().wheel().decelerate();
      viewport.moveCenter(0, 0);
      viewport.setZoom(0.5);
      app.stage.addChild(viewport);

      // 🚀 Z-INDEX LAYERS
      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const nodeLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      
      // 🌌 GPU NEBULA BLUR FILTER
      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = 40; // Soft gas cloud glow
      nebulaLayer.filters = [blurFilter];

      viewport.addChild(nebulaLayer);
      viewport.addChild(edgeLayer);
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      const circleGraphics = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGraphics);

      simDataRef.current.nodes.forEach(node => {
        const isFolder = node.data?.nodeType === 'folder';
        const isFile = node.data?.nodeType === 'file';
        
        // 🚀 FIX: Reads exact dimensions from your ENGINE_CONFIG!
        let baseSize = THEME.sizes.function.px;
        if (isFolder) baseSize = THEME.sizes.folder.px;
        if (isFile) baseSize = THEME.sizes.file.px;

        const scale = baseSize / 64; 
        
        let color = hexToNumber(THEME.nodes.function);
        if (isFolder) color = hexToNumber(THEME.nodes.folder);
        if (isFile) color = hexToNumber(THEME.nodes.file);
        if (node.data?.risk === 'high') color = 0xef4444; 
        
        const sprite = new PIXI.Sprite(circleTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(scale);
        sprite.tint = color; 
        
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        let dragging = false;
        sprite.on('pointerdown', (e) => {
          dragging = true; viewport.pause = true; 
          const pos = viewport.toLocal(e.global);
          stateRef.current.onDragStart(node.id, pos.x, pos.y);
        });
        
        sprite.on('globalpointermove', (e) => {
          if (dragging) {
            const pos = viewport.toLocal(e.global);
            stateRef.current.onDragMove(node.id, pos.x, pos.y);
          }
        });
        
        const stopDrag = () => { if (dragging) { dragging = false; viewport.pause = false; stateRef.current.onDragEnd(node.id); } };
        sprite.on('pointerup', stopDrag);
        sprite.on('pointerupoutside', stopDrag);
        
        let lastClickTime = 0;
        sprite.on('pointerdown', () => {
          const now = Date.now();
          if (now - lastClickTime < 300) stateRef.current.onNodeDoubleClick(node.data?.filePath, node.data?.line || 1);
          lastClickTime = now;
        });
        
        sprite.on('pointerover', () => stateRef.current.onNodeHover(true, node.id));
        sprite.on('pointerout', () => stateRef.current.onNodeHover(false, null));

        const label = new PIXI.Text({
          text: node.data?.label || 'unnamed',
          style: { fontFamily: 'monospace', fontSize: isFolder ? 18 : 12, fill: isFolder ? 0xe5e5e5 : 0xa3a3a3, fontWeight: isFolder ? 'bold' : 'normal' }
        });
        label.anchor.set(0.5, 0);

        nodeLayer.addChild(sprite);
        labelLayer.addChild(label);
        
        spriteMap.set(node.id, { sprite, label, baseSize, color });
      });

      let frameCount = 0;

      // 🚀 THE 300 FPS RENDER LOOP
      app.ticker.add(() => {
        frameCount++;
        const zoom = viewport.scale.x;
        const showFolderText = zoom > LOD.LABELS.folder;
        const showFileText = zoom > LOD.LABELS.file;
        const showFuncText = zoom > LOD.LABELS.function;

        const currentActiveRay = stateRef.current.activeRay;

        // 1. 🌌 RENDER ML NEBULAS (Every 3 frames for optimization)
        if (frameCount % 3 === 0 && zoom <= 1.2) {
          nebulaLayer.clear();
          const groups = {};
          
          simDataRef.current.nodes.forEach(n => {
            const comm = n.data?.community;
            if (comm !== undefined && comm !== null && !isNaN(n.x) && !isNaN(n.y)) {
              if (!groups[comm]) groups[comm] = [];
              groups[comm].push(n);
            }
          });

          Object.entries(groups).forEach(([commId, commNodes]) => {
            if (commNodes.length < 3) return;
            
            const pts = [];
            commNodes.forEach(n => {
              pts.push([n.x - NEBULA_PADDING, n.y - NEBULA_PADDING]);
              pts.push([n.x + NEBULA_PADDING, n.y - NEBULA_PADDING]);
              pts.push([n.x - NEBULA_PADDING, n.y + NEBULA_PADDING]);
              pts.push([n.x + NEBULA_PADDING, n.y + NEBULA_PADDING]);
            });

            const hull = polygonHull(pts);
            if (hull) {
              const colorObj = NEBULA_COLORS[parseInt(commId) % NEBULA_COLORS.length];
              
              // Draw the Convex Hull Natively on WebGPU
              nebulaLayer.moveTo(hull[0][0], hull[0][1]);
              for(let i = 1; i < hull.length; i++) {
                nebulaLayer.lineTo(hull[i][0], hull[i][1]);
              }
              nebulaLayer.closePath();
              
              nebulaLayer.fill({ color: colorObj.fill, alpha: 0.08 });
              nebulaLayer.stroke({ color: colorObj.stroke, alpha: 0.2, width: 80, join: 'round' });
            }
          });
        } else if (zoom > 1.2) {
          nebulaLayer.clear(); // Hide if zoomed in too close
        }

        // 2. ⚡ RENDER EDGES
        edgeLayer.clear();
        simDataRef.current.edges.forEach(edge => {
          if (isNaN(edge.source.x) || isNaN(edge.target.x)) return;
          
          const isCall = edge.type === 'call';
          const isHoveredHighlight = currentActiveRay?.activeE.has(edge.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;

          let edgeColor = hexToNumber(isCall ? THEME.edges.call : THEME.edges.hierarchy);
          let edgeAlpha = THEME.edges.opacityNormal;
          let edgeWidth = isCall ? 1.5 : 1;

          if (isHoveredHighlight) {
            edgeColor = hexToNumber(isCall ? THEME.edges.callGlow : THEME.edges.hierarchyGlow);
            edgeAlpha = 1.0;
            edgeWidth = 2.5;
          } else if (isDimmedByRay) {
            edgeAlpha = THEME.edges.opacityDimmed;
          }

          // Sub-pixel jitter fix
          const sx = Math.round(edge.source.x);
          const sy = Math.round(edge.source.y);
          const tx = Math.round(edge.target.x);
          const ty = Math.round(edge.target.y);

          edgeLayer.moveTo(sx, sy);
          edgeLayer.lineTo(tx, ty);
          edgeLayer.stroke({ width: edgeWidth, color: edgeColor, alpha: edgeAlpha });
        });

        // 3. 🪐 RENDER ORBS & LABELS
        simDataRef.current.nodes.forEach(node => {
          const obj = spriteMap.get(node.id);
          if (!obj || isNaN(node.x)) return;

          const finalX = Math.round(node.x);
          const finalY = Math.round(node.y);

          obj.sprite.x = finalX;
          obj.sprite.y = finalY;

          obj.label.x = finalX;
          obj.label.y = finalY + obj.baseSize + 4;
          
          const isFolder = node.data?.nodeType === 'folder';
          const isFile = node.data?.nodeType === 'file';
          obj.label.visible = (isFolder && showFolderText) || (isFile && showFileText) || (!isFolder && !isFile && showFuncText);

          const isHoveredHighlight = currentActiveRay?.activeN.has(node.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;
          
          obj.sprite.alpha = isDimmedByRay ? 0.15 : 1.0;
          obj.label.alpha = isDimmedByRay ? 0.15 : 1.0;
        });
      });
    };

    initWebGPU();

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && appRef.current) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (appRef.current) appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [simDataRef]); 

  return <div ref={containerRef} className="w-full h-full absolute inset-0 outline-none overflow-hidden" />;
}