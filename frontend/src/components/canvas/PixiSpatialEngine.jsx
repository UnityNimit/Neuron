// src/components/canvas/PixiSpatialEngine.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { THEME, LOD } = ENGINE_CONFIG;

// Parse Hex color string to WebGL Hex integer
const hexToNumber = (hex) => parseInt(hex.replace('bg-[', '').replace(']', '').replace('#', '0x'), 16);

// 🚀 ELASTIC BOUNCE POP EASING FUNCTION (Video Game Particle Curve)
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export default function PixiSpatialEngine({ 
  simDataRef, 
  activeRay, focusIsolationId, blastRadius, 
  onDragStart, onDragMove, onDragEnd,
  onNodeDoubleClick, onNodeHover
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  
  const stateRef = useRef({ 
    activeRay, focusIsolationId, blastRadius, 
    onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd 
  });
  
  useEffect(() => {
    stateRef.current = { 
      activeRay, focusIsolationId, blastRadius, 
      onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd 
    };
  }, [activeRay, focusIsolationId, blastRadius, onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd]);

  useEffect(() => {
    if (!containerRef.current || !simDataRef?.current) return;

    let isMounted = true;
    let viewport;
    const spriteMap = new Map();
    const superNodeSpriteMap = new Map();

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
        worldWidth: 200000, 
        worldHeight: 200000,
        events: app.renderer.events
      });
      
      viewport.drag().pinch().wheel().decelerate();
      viewport.moveCenter(0, 0);
      viewport.setZoom(0.5);
      app.stage.addChild(viewport);

      // 🚀 Z-INDEX LAYERS
      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const superNodeLayer = new PIXI.Container();
      const nodeLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      
      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = THEME.nebula?.blurRadius || 35;
      nebulaLayer.filters = [blurFilter];

      viewport.addChild(nebulaLayer);
      viewport.addChild(edgeLayer);
      viewport.addChild(superNodeLayer);
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      const circleGfx = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGfx);

      const superGfx = new PIXI.Graphics()
        .circle(0, 0, 128).fill({ color: 0xffffff, alpha: 0.12 })
        .circle(0, 0, 64).fill({ color: 0xffffff, alpha: 0.85 });
      const superTexture = app.renderer.generateTexture(superGfx);

      let globalDraggingNodeId = null;

      // 1. ATOMIC NODES
      simDataRef.current.nodes.forEach(node => {
        const isFolder = node.data?.nodeType === 'folder';
        const isFile = node.data?.nodeType === 'file';
        
        let baseSize = THEME.sizes.function.px;
        if (isFolder) baseSize = THEME.sizes.folder.px;
        if (isFile) baseSize = THEME.sizes.file.px;

        const targetScale = baseSize / 64; 
        
        let color = hexToNumber(THEME.nodes.function);
        if (isFolder) color = hexToNumber(THEME.nodes.folder);
        if (isFile) color = hexToNumber(THEME.nodes.file);
        if (node.data?.risk === 'high') color = 0xef4444; 
        
        const sprite = new PIXI.Sprite(circleTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(0); 
        sprite.tint = color; 
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        sprite.on('pointerdown', (e) => {
          globalDraggingNodeId = node.id;
          viewport.pause = true; 
          const pos = viewport.toLocal(e.global);
          stateRef.current.onDragStart(node.id, pos.x, pos.y);
          stateRef.current.onNodeHover(true, node.id);
        });
        
        sprite.on('globalpointermove', (e) => {
          if (globalDraggingNodeId === node.id) {
            const pos = viewport.toLocal(e.global);
            stateRef.current.onDragMove(node.id, pos.x, pos.y);
          }
        });
        
        const stopDrag = () => { 
          if (globalDraggingNodeId === node.id) { 
            globalDraggingNodeId = null; 
            viewport.pause = false; 
            stateRef.current.onDragEnd(node.id); 
            stateRef.current.onNodeHover(false, null);
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
        
        sprite.on('pointerover', () => {
          if (!globalDraggingNodeId) stateRef.current.onNodeHover(true, node.id);
        });
        sprite.on('pointerout', () => {
          if (globalDraggingNodeId !== node.id) stateRef.current.onNodeHover(false, null);
        });

        const label = new PIXI.Text({
          text: node.data?.label || 'unnamed',
          style: { 
            fontFamily: 'monospace', 
            fontSize: isFolder ? 18 : 12, 
            fill: isFolder ? 0xe5e5e5 : 0xa3a3a3, 
            fontWeight: isFolder ? 'bold' : 'normal' 
          }
        });
        label.anchor.set(0.5, 0);
        label.alpha = 0;

        nodeLayer.addChild(sprite);
        labelLayer.addChild(label);
        
        spriteMap.set(node.id, { sprite, label, baseSize, targetScale, color });
      });

      // 2. SUPER-NODES
      (simDataRef.current.superNodes || []).forEach(superNode => {
        const sprite = new PIXI.Sprite(superTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(superNode.radius / 128);
        sprite.tint = 0x38bdf8; 
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        const label = new PIXI.Text({
          text: `${superNode.label.toUpperCase()} · ${superNode.totalLOC} LOC`,
          style: {
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0x38bdf8,
            fontWeight: 'bold',
            letterSpacing: 2
          }
        });
        label.anchor.set(0.5, 0);

        superNodeLayer.addChild(sprite);
        superNodeLayer.addChild(label);
        superNodeSpriteMap.set(superNode.id, { sprite, label, superNode });
      });

      let frameCount = 0;

      // 3. THE 300 FPS TICK LOOP
      app.ticker.add(() => {
        frameCount++;
        const zoom = viewport.scale.x;
        const currentActiveRay = stateRef.current.activeRay;

        // Fission/Fusion Transition
        const isMacroView = zoom < 0.2;
        const macroTransitionAlpha = Math.max(0, Math.min(1, (0.25 - zoom) / 0.1));

        superNodeLayer.visible = macroTransitionAlpha > 0.01;
        superNodeLayer.alpha = macroTransitionAlpha;

        const atomicLayerAlpha = 1 - macroTransitionAlpha;
        nodeLayer.alpha = atomicLayerAlpha;
        labelLayer.alpha = atomicLayerAlpha;

        // Centroid Update for Super-Nodes
        if (isMacroView && simDataRef.current.superNodes) {
          const nodeMap = new Map(simDataRef.current.nodes.map(n => [n.id, n]));

          simDataRef.current.superNodes.forEach(sNode => {
            const sprites = superNodeSpriteMap.get(sNode.id);
            if (!sprites) return;

            let sumX = 0, sumY = 0, validCount = 0;
            sNode.childIds.forEach(cId => {
              const child = nodeMap.get(cId);
              if (child && !isNaN(child.x)) {
                sumX += child.x;
                sumY += child.y;
                validCount++;
              }
            });

            if (validCount > 0) {
              const cx = Math.round(sumX / validCount);
              const cy = Math.round(sumY / validCount);
              sprites.sprite.x = cx;
              sprites.sprite.y = cy;
              sprites.label.x = cx;
              sprites.label.y = cy + sNode.radius + 8;
            }
          });
        }

        // ML Nebulas
        if (frameCount % 3 === 0 && zoom > 0.15 && zoom <= 1.2) {
          nebulaLayer.clear();
          const groups = {};
          
          simDataRef.current.nodes.forEach(n => {
            const comm = n.data?.community;
            if (comm !== undefined && comm !== null && !isNaN(n.x) && !isNaN(n.y) && (n.spawnProgress || 0) > 0.4) {
              if (!groups[comm]) groups[comm] = [];
              groups[comm].push(n);
            }
          });

          const nebulaColors = THEME.nebula?.colors || [];
          Object.entries(groups).forEach(([commId, commNodes]) => {
            if (commNodes.length < 3) return;
            
            const pts = [];
            const pad = THEME.nebula?.padding || 80;
            commNodes.forEach(n => {
              pts.push([n.x - pad, n.y - pad]);
              pts.push([n.x + pad, n.y - pad]);
              pts.push([n.x - pad, n.y + pad]);
              pts.push([n.x + pad, n.y + pad]);
            });

            const hull = polygonHull(pts);
            if (hull && nebulaColors.length > 0) {
              const colorObj = nebulaColors[parseInt(commId) % nebulaColors.length];
              nebulaLayer.moveTo(hull[0][0], hull[0][1]);
              for(let i = 1; i < hull.length; i++) { nebulaLayer.lineTo(hull[i][0], hull[i][1]); }
              nebulaLayer.closePath();
              
              nebulaLayer.fill({ color: hexToNumber(colorObj.fill), alpha: THEME.nebula?.fillOpacity || 0.08 });
              nebulaLayer.stroke({ color: hexToNumber(colorObj.stroke), alpha: THEME.nebula?.strokeOpacity || 0.2, width: THEME.nebula?.strokeWidth || 80, join: 'round' });
            }
          });
        } else if (zoom <= 0.15 || zoom > 1.2) {
          nebulaLayer.clear();
        }

        // Edges
        edgeLayer.clear();
        simDataRef.current.edges.forEach(edge => {
          if (isNaN(edge.source.x) || isNaN(edge.target.x)) return;
          
          const srcSpawn = edge.source.spawnProgress ?? 1;
          const tgtSpawn = edge.target.spawnProgress ?? 1;
          const edgeSpawnAlpha = Math.min(srcSpawn, tgtSpawn);
          if (edgeSpawnAlpha < 0.05) return;

          const isCall = edge.type === 'call';
          const isBridge = edge.type === 'network_bridge';
          const isHoveredHighlight = currentActiveRay?.activeE.has(edge.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;

          let edgeColor = hexToNumber(isCall ? THEME.edges.call : isBridge ? '#00f0ff' : THEME.edges.hierarchy);
          let edgeAlpha = (THEME.edges.opacityNormal || 0.45) * edgeSpawnAlpha * atomicLayerAlpha;
          let edgeWidth = isCall || isBridge ? (THEME.edges.widthCall || 1.5) : (THEME.edges.widthHierarchy || 1.0);

          if (isHoveredHighlight) {
            edgeColor = hexToNumber(isCall ? THEME.edges.callGlow : isBridge ? '#00ffff' : THEME.edges.hierarchyGlow);
            edgeAlpha = 1.0;
            edgeWidth = THEME.edges.widthHoverGlow || 3.5; 
          } else if (isDimmedByRay) {
            edgeAlpha = (THEME.edges.opacityDimmed || 0.05) * edgeSpawnAlpha * atomicLayerAlpha;
          }

          const sx = Math.round(edge.source.x);
          const sy = Math.round(edge.source.y);
          const tx = Math.round(edge.target.x);
          const ty = Math.round(edge.target.y);

          edgeLayer.moveTo(sx, sy);
          edgeLayer.lineTo(tx, ty);
          edgeLayer.stroke({ width: edgeWidth, color: edgeColor, alpha: edgeAlpha });
        });

        // 🚀 ATOMIC ORBS (With Elastic Bounce Easing)
        const showFolderText = zoom > LOD.LABELS.folder;
        const showFileText = zoom > LOD.LABELS.file;
        const showFuncText = zoom > LOD.LABELS.function;

        simDataRef.current.nodes.forEach(node => {
          const obj = spriteMap.get(node.id);
          if (!obj || isNaN(node.x)) return;

          // Elastic bounce progress step
          if (node.isSpawned && node.spawnProgress < 1) {
            node.spawnProgress = Math.min(1, (node.spawnProgress || 0) + 0.035);
          }

          const p = Math.max(0, Math.min(1, node.spawnProgress || 0));
          const bounceMultiplier = p > 0 ? easeOutBack(p) : 0;
          const currentScale = obj.targetScale * Math.max(0, bounceMultiplier);

          const finalX = Math.round(node.x);
          const finalY = Math.round(node.y);

          obj.sprite.x = finalX;
          obj.sprite.y = finalY;
          obj.sprite.scale.set(currentScale);
          obj.sprite.visible = (node.spawnProgress || 0) > 0.01;

          obj.label.x = finalX;
          obj.label.y = finalY + obj.baseSize + 4;
          
          const isFolder = node.data?.nodeType === 'folder';
          const isFile = node.data?.nodeType === 'file';
          const isTextVisible = (isFolder && showFolderText) || (isFile && showFileText) || (!isFolder && !isFile && showFuncText);
          
          obj.label.visible = isTextVisible && (node.spawnProgress || 0) > 0.85;

          const isHoveredHighlight = currentActiveRay?.activeN.has(node.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;
          
          const baseAlpha = isDimmedByRay ? (THEME.edges.opacityDimmed || 0.05) : 1.0;
          obj.sprite.alpha = baseAlpha;
          obj.label.alpha = baseAlpha;
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