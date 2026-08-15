// src/components/canvas/PixiSpatialEngine.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { THEME, LOD } = ENGINE_CONFIG;
const hexToNumber = (hex) => parseInt(hex.replace('bg-[', '').replace(']', '').replace('#', '0x'), 16);

export default function PixiSpatialEngine({ 
  simDataRef, 
  activeRay, focusIsolationId, blastRadius, 
  onDragStart, onDragMove, onDragEnd,
  onNodeDoubleClick, onNodeHover
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  
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
        antialias: false, 
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

      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const nodeLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      
      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = THEME.nebula.blurRadius; 
      nebulaLayer.filters = [blurFilter];

      viewport.addChild(nebulaLayer);
      viewport.addChild(edgeLayer);
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      const circleGraphics = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGraphics);

      // 🚀 GLOBAL DRAG LOCK (Fixes high-speed highlight flickering)
      let globalDraggingNodeId = null;

      simDataRef.current.nodes.forEach(node => {
        const isFolder = node.data?.nodeType === 'folder';
        const isFile = node.data?.nodeType === 'file';
        
        let baseSize = THEME.sizes.function.px;
        if (isFolder) baseSize = THEME.sizes.folder.px;
        if (isFile) baseSize = THEME.sizes.file.px;

        const scale = baseSize / 64; 
        
        let color = hexToNumber(THEME.nodes.function);
        if (isFolder) color = hexToNumber(THEME.nodes.folder);
        if (isFile) color = hexToNumber(THEME.nodes.file);
        if (node.data?.risk === 'high') color = hexToNumber(THEME.risk.high); 
        
        const sprite = new PIXI.Sprite(circleTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(scale);
        sprite.tint = color; 
        
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        // --- THE PERFECTED EVENT ROUTER ---
        sprite.on('pointerdown', (e) => {
          globalDraggingNodeId = node.id; // Lock it!
          viewport.pause = true; 
          const pos = viewport.toLocal(e.global);
          stateRef.current.onDragStart(node.id, pos.x, pos.y);
          stateRef.current.onNodeHover(true, node.id); // Ensure highlight fires instantly
        });
        
        sprite.on('globalpointermove', (e) => {
          if (globalDraggingNodeId === node.id) {
            const pos = viewport.toLocal(e.global);
            stateRef.current.onDragMove(node.id, pos.x, pos.y);
          }
        });
        
        const stopDrag = () => { 
          if (globalDraggingNodeId === node.id) { 
            globalDraggingNodeId = null; // Unlock it!
            viewport.pause = false; 
            stateRef.current.onDragEnd(node.id); 
            stateRef.current.onNodeHover(false, null); // Clear highlight cleanly on drop
          } 
        };
        
        sprite.on('pointerup', stopDrag);
        sprite.on('pointerupoutside', stopDrag);
        
        let lastClickTime = 0;
        sprite.on('pointerdown', () => {
          const now = Date.now();
          if (now - lastClickTime < 300) stateRef.current.onNodeDoubleClick(node.data?.filePath, node.data?.line || 1);
          lastClickTime = now;
        });
        
        // Only process hover events if we aren't actively dragging an orb!
        sprite.on('pointerover', () => {
          if (!globalDraggingNodeId) stateRef.current.onNodeHover(true, node.id);
        });
        sprite.on('pointerout', () => {
          if (globalDraggingNodeId !== node.id) stateRef.current.onNodeHover(false, null);
        });

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

      app.ticker.add(() => {
        frameCount++;
        const zoom = viewport.scale.x;
        const showFolderText = zoom > LOD.LABELS.folder;
        const showFileText = zoom > LOD.LABELS.file;
        const showFuncText = zoom > LOD.LABELS.function;

        const currentActiveRay = stateRef.current.activeRay;

        // 1. RENDER NEBULAS
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
              pts.push([n.x - THEME.nebula.padding, n.y - THEME.nebula.padding]);
              pts.push([n.x + THEME.nebula.padding, n.y - THEME.nebula.padding]);
              pts.push([n.x - THEME.nebula.padding, n.y + THEME.nebula.padding]);
              pts.push([n.x + THEME.nebula.padding, n.y + THEME.nebula.padding]);
            });

            const hull = polygonHull(pts);
            if (hull) {
              const colorObj = THEME.nebula.colors[parseInt(commId) % THEME.nebula.colors.length];
              nebulaLayer.moveTo(hull[0][0], hull[0][1]);
              for(let i = 1; i < hull.length; i++) { nebulaLayer.lineTo(hull[i][0], hull[i][1]); }
              nebulaLayer.closePath();
              
              nebulaLayer.fill({ color: hexToNumber(colorObj.fill), alpha: THEME.nebula.fillOpacity });
              nebulaLayer.stroke({ color: hexToNumber(colorObj.stroke), alpha: THEME.nebula.strokeOpacity, width: THEME.nebula.strokeWidth, join: 'round' });
            }
          });
        } else if (zoom > 1.2) {
          nebulaLayer.clear(); 
        }

        // 2. RENDER EDGES
        edgeLayer.clear();
        simDataRef.current.edges.forEach(edge => {
          if (isNaN(edge.source.x) || isNaN(edge.target.x)) return;
          
          const isCall = edge.type === 'call';
          const isHoveredHighlight = currentActiveRay?.activeE.has(edge.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;

          let edgeColor = hexToNumber(isCall ? THEME.edges.call : THEME.edges.hierarchy);
          let edgeAlpha = THEME.edges.opacityNormal;
          let edgeWidth = isCall ? THEME.edges.widthCall : THEME.edges.widthHierarchy;

          if (isHoveredHighlight) {
            edgeColor = hexToNumber(isCall ? THEME.edges.callGlow : THEME.edges.hierarchyGlow);
            edgeAlpha = 1.0;
            edgeWidth = THEME.edges.widthHoverGlow; 
          } else if (isDimmedByRay) {
            edgeAlpha = THEME.edges.opacityDimmed;
          }

          const sx = Math.round(edge.source.x);
          const sy = Math.round(edge.source.y);
          const tx = Math.round(edge.target.x);
          const ty = Math.round(edge.target.y);

          edgeLayer.moveTo(sx, sy);
          edgeLayer.lineTo(tx, ty);
          edgeLayer.stroke({ width: edgeWidth, color: edgeColor, alpha: edgeAlpha });
        });

        // 3. RENDER ORBS & LABELS
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
          
          obj.sprite.alpha = isDimmedByRay ? THEME.edges.opacityDimmed : 1.0;
          obj.label.alpha = isDimmedByRay ? THEME.edges.opacityDimmed : 1.0;
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