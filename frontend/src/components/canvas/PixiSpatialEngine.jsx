// frontend/src/components/canvas/PixiSpatialEngine.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from '../../config/engineConfig';

const { THEME, LOD } = ENGINE_CONFIG;

// Parse Hex color string to WebGL Hex integer
const hexToNumber = (hex) => {
  if (typeof hex === 'number') return hex;
  if (!hex) return 0xffffff;
  const clean = hex.replace('bg-[', '').replace(']', '').replace('#', '0x').trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0xffffff : parsed;
};

// Elastic bounce pop easing function for celestial emergence
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// Quintic Ease-In-Out for cinematic camera flight
const easeInOutQuintic = (t) => {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
};

const FUNCTION_CAPTURE_PROXIMITY_PX = 85;
const FILE_MERGE_PROXIMITY_PX = 110;

export default function PixiSpatialEngine({ 
  simDataRef, 
  activeRay, 
  focusIsolationId, 
  blastRadius,
  cspRejectionEvent,
  warpTargetNodeId,
  onDragStart, 
  onDragMove, 
  onDragEnd,
  onRefactorDrop,
  onFileMergeDrop,
  onNodeDoubleClick, 
  onNodeHover,
  refactorEnabled = false
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const cameraWarpRef = useRef(null);
  
  const stateRef = useRef({ 
    activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
    onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
    onRefactorDrop, onFileMergeDrop, refactorEnabled 
  });
  
  useEffect(() => {
    stateRef.current = { 
      activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
      onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
      onRefactorDrop, onFileMergeDrop, refactorEnabled 
    };
  }, [
    activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
    onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
    onRefactorDrop, onFileMergeDrop, refactorEnabled
  ]);

  useEffect(() => {
    if (!containerRef.current || !simDataRef?.current) return;

    let isMounted = true;
    let viewport;
    const spriteMap = new Map();
    const superNodeSpriteMap = new Map();
    const shockwaves = [];
    const snapBackQueue = new Map();

    const initWebGPU = async () => {
      const app = new PIXI.Application();
      
      await app.init({
        resizeTo: containerRef.current,
        backgroundColor: 0x121314,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: false,
        preference: 'webgpu' 
      });

      if (!isMounted) { 
        app.destroy(true); 
        return; 
      }
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // 1. INFINITE CAMERA VIEWPORT
      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 300000, 
        worldHeight: 300000,
        events: app.renderer.events
      });
      
      viewport.drag().pinch().wheel().decelerate();
      viewport.moveCenter(0, 0);
      viewport.setZoom(0.45);
      app.stage.addChild(viewport);

      // 2. LAYER PIPELINE (Optimized Depth Z-Ordering)
      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const bridgePhotonLayer = new PIXI.Graphics(); // 🚀 High-Voltage Laser Photons
      const refactorOverlay = new PIXI.Graphics();
      const blastRadiusOverlay = new PIXI.Graphics();
      const superNodeLayer = new PIXI.Container();
      const nodeLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      
      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = THEME.nebula?.blurRadius || 35;
      nebulaLayer.filters = [blurFilter];

      viewport.addChild(nebulaLayer);
      viewport.addChild(edgeLayer);
      viewport.addChild(bridgePhotonLayer);
      viewport.addChild(refactorOverlay);
      viewport.addChild(blastRadiusOverlay);
      viewport.addChild(superNodeLayer);
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      // Reusable Hardware Textures
      const circleGfx = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGfx);

      const superGfx = new PIXI.Graphics()
        .circle(0, 0, 128).fill({ color: 0xffffff, alpha: 0.12 })
        .circle(0, 0, 64).fill({ color: 0xffffff, alpha: 0.85 });
      const superTexture = app.renderer.generateTexture(superGfx);

      let globalDraggingNodeId = null;
      let dragOriginPos = { x: 0, y: 0 };
      let currentCaptureTarget = null;
      let isFileMergeMode = false;
      let lastWarpProcessedId = null;

      // HELPER: Creates a node entity sprite with zero-latency hardware event listeners
      const createNodeSprite = (node) => {
        const isFolder = node.data?.nodeType === 'folder';
        const isFile = node.data?.nodeType === 'file';
        
        let baseSize = THEME.sizes?.function?.px || 14;
        if (isFolder) baseSize = THEME.sizes?.folder?.px || 44;
        if (isFile) baseSize = THEME.sizes?.file?.px || 26;

        const targetScale = baseSize / 64; 
        
        let color = hexToNumber(THEME.nodes?.function || '#a855f7');
        if (isFolder) color = hexToNumber(THEME.nodes?.folder || '#3b82f6');
        if (isFile) color = hexToNumber(THEME.nodes?.file || '#eab308');
        
        if (node.data?.risk === 'high') color = 0xef4444; 
        else if (node.data?.risk === 'medium') color = 0xf59e0b;
        
        const sprite = new PIXI.Sprite(circleTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(node.spawnProgress > 0 ? targetScale : 0); 
        sprite.tint = color; 
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        // DRAG & HIT TESTING
        sprite.on('pointerdown', (e) => {
          globalDraggingNodeId = node.id;
          dragOriginPos = { x: node.x || 0, y: node.y || 0 };
          currentCaptureTarget = null;
          isFileMergeMode = false;
          viewport.pause = true; 
          
          const pos = viewport.toLocal(e.global);
          stateRef.current.onDragStart(node.id, pos.x, pos.y);
          stateRef.current.onNodeHover(true, node.id);
        });
        
        sprite.on('globalpointermove', (e) => {
          if (globalDraggingNodeId === node.id) {
            const pos = viewport.toLocal(e.global);
            stateRef.current.onDragMove(node.id, pos.x, pos.y);

            const isCurrentFunction = node.data?.nodeType === 'function';
            const isCurrentFile = node.data?.nodeType === 'file';

            let nearestCandidate = null;
            let shortestDist = isCurrentFile ? FILE_MERGE_PROXIMITY_PX : FUNCTION_CAPTURE_PROXIMITY_PX;

            if (stateRef.current.refactorEnabled) {
              (simDataRef.current.nodes || []).forEach(candidate => {
                if (candidate.data?.nodeType === 'file' && candidate.id !== node.id) {
                  if (isCurrentFunction && candidate.data?.filePath === node.data?.filePath) return;
                  
                  const dx = (candidate.x || 0) - pos.x;
                  const dy = (candidate.y || 0) - pos.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < shortestDist) {
                    shortestDist = dist;
                    nearestCandidate = candidate;
                  }
                }
              });

              currentCaptureTarget = nearestCandidate;
              isFileMergeMode = isCurrentFile && !!nearestCandidate;
            } else {
              currentCaptureTarget = null;
              isFileMergeMode = false;
            }
          }
        });
        
        const stopDrag = () => { 
          if (globalDraggingNodeId === node.id) { 
            const targetFile = currentCaptureTarget;
            const origin = { ...dragOriginPos };
            const draggedId = node.id;
            const wasFileMerge = isFileMergeMode;
            
            globalDraggingNodeId = null; 
            currentCaptureTarget = null;
            isFileMergeMode = false;
            viewport.pause = false; 

            stateRef.current.onDragEnd(draggedId);

            if (targetFile && stateRef.current.refactorEnabled) {
              if (wasFileMerge && stateRef.current.onFileMergeDrop) {
                stateRef.current.onFileMergeDrop({
                  sourceFile: node.data?.filePath || node.id,
                  destFile: targetFile.data?.filePath || targetFile.id
                });
              } else if (node.data?.nodeType === 'function' && stateRef.current.onRefactorDrop) {
                const rawLabel = node.data?.label || node.id;
                const funcName = rawLabel.replace('def ', '').split('(')[0].trim().split('.').pop();
                stateRef.current.onRefactorDrop({
                  symbolName: funcName,
                  sourceFile: node.data?.filePath,
                  destFile: targetFile.data?.filePath,
                  nodeId: draggedId,
                  originalPos: origin
                });
              }
            }

            stateRef.current.onNodeHover(false, null);
          } 
        };
        
        sprite.on('pointerup', stopDrag);
        sprite.on('pointerupoutside', stopDrag);
        
        let lastClickTime = 0;
        sprite.on('pointerdown', () => {
          const now = Date.now();
          if (now - lastClickTime < 320) {
            stateRef.current.onNodeDoubleClick(node.data?.filePath || node.id, node.data?.line || 1);
          }
          lastClickTime = now;
        });
        
        sprite.on('pointerover', () => {
          if (!globalDraggingNodeId) stateRef.current.onNodeHover(true, node.id);
        });
        sprite.on('pointerout', () => {
          if (globalDraggingNodeId !== node.id) stateRef.current.onNodeHover(false, null);
        });

        const label = new PIXI.Text({
          text: node.data?.label || node.id.split('::').slice(-2).join(' · ') || 'unnamed',
          style: { 
            fontFamily: 'monospace', 
            fontSize: isFolder ? 16 : 11, 
            fill: isFolder ? 0xe2e8f0 : 0x94a3b8, 
            fontWeight: isFolder ? 'bold' : 'normal' 
          }
        });
        label.anchor.set(0.5, 0);
        label.alpha = 0;

        nodeLayer.addChild(sprite);
        labelLayer.addChild(label);
        
        spriteMap.set(node.id, { sprite, label, baseSize, targetScale, color });
      };

      // 3. INITIAL POPULATION
      (simDataRef.current.nodes || []).forEach(createNodeSprite);

      // 4. SUPER-NODES (Macro LOD Clusters)
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
            fontSize: 15,
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

      // -----------------------------------------------------------------------
      // 5. THE 300 FPS HARDWARE TICK LOOP
      // -----------------------------------------------------------------------
      app.ticker.add(() => {
        frameCount++;
        const zoom = viewport.scale.x;
        const currentActiveRay = stateRef.current.activeRay;
        const currentBlastRadius = stateRef.current.blastRadius;
        const rejectionEvt = stateRef.current.cspRejectionEvent;
        const targetWarpId = stateRef.current.warpTargetNodeId;
        const visibleBounds = viewport.getVisibleBounds();

        // 🚀 A. TRIGGER 3D CAMERA WARP FLIGHT (Horizon 2 Omni-Search)
        if (targetWarpId && targetWarpId !== lastWarpProcessedId) {
          lastWarpProcessedId = targetWarpId;
          const targetNode = (simDataRef.current.nodes || []).find(n => n.id === targetWarpId);
          
          if (targetNode && typeof targetNode.x === 'number' && !isNaN(targetNode.x)) {
            const currentCenter = viewport.center;
            cameraWarpRef.current = {
              nodeId: targetWarpId,
              startX: currentCenter.x,
              startY: currentCenter.y,
              startZoom: viewport.scale.x,
              targetX: targetNode.x,
              targetY: targetNode.y,
              targetZoom: 1.55, // Deep Z-Level 3 Zoom
              progress: 0
            };
          }
        }

        // Execute Quintic Camera Warp Trajectory
        if (cameraWarpRef.current) {
          const warp = cameraWarpRef.current;
          warp.progress += 0.028;
          const t = Math.min(1, warp.progress);
          const ease = easeInOutQuintic(t);

          const curX = warp.startX + (warp.targetX - warp.startX) * ease;
          const curY = warp.startY + (warp.targetY - warp.startY) * ease;
          const curZoom = warp.startZoom + (warp.targetZoom - warp.startZoom) * ease;

          viewport.moveCenter(curX, curY);
          viewport.setZoom(curZoom);

          if (t >= 1) {
            const finalTargetId = warp.nodeId;
            cameraWarpRef.current = null;
            stateRef.current.onNodeHover(true, finalTargetId);
          }
        }

        // 🚀 B. SPRITE ENTITY RECONCILIATION
        if (frameCount % 6 === 0) {
          const currentGraphNodes = simDataRef.current.nodes || [];
          const currentIdSet = new Set(currentGraphNodes.map(n => n.id));

          spriteMap.forEach((obj, id) => {
            if (!currentIdSet.has(id)) {
              nodeLayer.removeChild(obj.sprite);
              labelLayer.removeChild(obj.label);
              obj.sprite.destroy();
              obj.label.destroy();
              spriteMap.delete(id);
            }
          });

          currentGraphNodes.forEach(n => {
            if (!spriteMap.has(n.id)) {
              createNodeSprite(n);
            }
          });
        }

        // C. PROCESS CSP REJECTION SHOCKWAVES & SNAP-BACK
        if (rejectionEvt && rejectionEvt.timestamp && !rejectionEvt.processed) {
          rejectionEvt.processed = true;
          shockwaves.push({
            x: rejectionEvt.x || 0,
            y: rejectionEvt.y || 0,
            radius: 25,
            maxRadius: 200,
            alpha: 1.0,
            color: 0xef4444
          });

          if (rejectionEvt.nodeId && rejectionEvt.originalPos) {
            const simNode = (simDataRef.current.nodes || []).find(n => n.id === rejectionEvt.nodeId);
            if (simNode) {
              snapBackQueue.set(rejectionEvt.nodeId, {
                node: simNode,
                startX: simNode.x,
                startY: simNode.y,
                targetX: rejectionEvt.originalPos.x,
                targetY: rejectionEvt.originalPos.y,
                progress: 0
              });
            }
          }
        }

        // D. RENDER OVERLAYS (Capture Rings, Shockwaves, Blast Radius)
        refactorOverlay.clear();
        blastRadiusOverlay.clear();

        // 1. Refactor Capture Rings
        if (currentCaptureTarget && typeof currentCaptureTarget.x === 'number' && !isNaN(currentCaptureTarget.x)) {
          const pulse = (Math.sin(frameCount * 0.18) + 1) * 0.5;
          const ringRadius = (THEME.sizes?.file?.px || 26) / 2 + (isFileMergeMode ? 30 : 22) + (pulse * 8);
          const ringColor = isFileMergeMode ? 0xf59e0b : 0x38bdf8;
          
          refactorOverlay.circle(Math.round(currentCaptureTarget.x), Math.round(currentCaptureTarget.y), ringRadius);
          refactorOverlay.stroke({ width: 2.5, color: ringColor, alpha: 0.9 });
          refactorOverlay.circle(Math.round(currentCaptureTarget.x), Math.round(currentCaptureTarget.y), ringRadius - 6);
          refactorOverlay.fill({ color: ringColor, alpha: 0.15 });
        }

        // 2. Shockwave Rings
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.radius += 5;
          sw.alpha -= 0.024;
          
          if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
            shockwaves.splice(i, 1);
            continue;
          }

          refactorOverlay.circle(Math.round(sw.x), Math.round(sw.y), sw.radius);
          refactorOverlay.stroke({ width: 3.5, color: sw.color, alpha: sw.alpha });
        }

        // 3. Horizon 3: AI Blast Radius Glow Rings
        if (Array.isArray(currentBlastRadius) && currentBlastRadius.length > 0) {
          const blastSet = new Set(currentBlastRadius);
          const pulse = (Math.sin(frameCount * 0.12) + 1) * 0.5;

          (simDataRef.current.nodes || []).forEach(n => {
            if (blastSet.has(n.id) && !isNaN(n.x) && !isNaN(n.y)) {
              const r = ((n.data?.nodeType === 'file' ? 26 : 14) / 2) + 12 + (pulse * 6);
              blastRadiusOverlay.circle(Math.round(n.x), Math.round(n.y), r);
              blastRadiusOverlay.stroke({ width: 2.0, color: 0x00ffff, alpha: 0.8 });
              blastRadiusOverlay.circle(Math.round(n.x), Math.round(n.y), r - 4);
              blastRadiusOverlay.fill({ color: 0x00ffff, alpha: 0.12 });
            }
          });
        }

        // 4. Snap Back Interpolation
        snapBackQueue.forEach((snap, id) => {
          snap.progress += 0.065;
          const t = Math.min(1, snap.progress);
          const ease = 1 - Math.pow(1 - t, 3);
          
          snap.node.x = snap.startX + (snap.targetX - snap.startX) * ease;
          snap.node.y = snap.startY + (snap.targetY - snap.startY) * ease;
          snap.node.fx = snap.node.x;
          snap.node.fy = snap.node.y;

          if (t >= 1) {
            snap.node.fx = null;
            snap.node.fy = null;
            snapBackQueue.delete(id);
          }
        });

        // E. DYNAMIC SUPER-NODE MACRO LOD (Zoom < 0.22)
        const isMacroView = zoom < 0.22;
        const macroTransitionAlpha = Math.max(0, Math.min(1, (0.26 - zoom) / 0.1));

        superNodeLayer.visible = macroTransitionAlpha > 0.01;
        superNodeLayer.alpha = macroTransitionAlpha;

        const atomicLayerAlpha = 1 - macroTransitionAlpha;
        nodeLayer.alpha = atomicLayerAlpha;
        labelLayer.alpha = atomicLayerAlpha;

        if (isMacroView && simDataRef.current.superNodes) {
          const nodeMap = new Map((simDataRef.current.nodes || []).map(n => [n.id, n]));

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

        // F. ML NEBULA CONVEX HULLS
        if (frameCount % 3 === 0 && zoom > 0.14 && zoom <= 1.3) {
          nebulaLayer.clear();
          const groups = {};
          
          (simDataRef.current.nodes || []).forEach(n => {
            const comm = n.data?.community;
            if (comm !== undefined && comm !== null && !isNaN(n.x) && !isNaN(n.y) && (n.spawnProgress || 0) > 0.3) {
              if (!groups[comm]) groups[comm] = [];
              groups[comm].push(n);
            }
          });

          const nebulaColors = THEME.nebula?.colors || [];
          Object.entries(groups).forEach(([commId, commNodes]) => {
            if (commNodes.length < 3) return;
            
            const pts = [];
            const pad = THEME.nebula?.padding || 85;
            commNodes.forEach(n => {
              pts.push([n.x - pad, n.y - pad]);
              pts.push([n.x + pad, n.y - pad]);
              pts.push([n.x - pad, n.y + pad]);
              pts.push([n.x + pad, n.y + pad]);
            });

            const hull = polygonHull(pts);
            if (hull && nebulaColors.length > 0) {
              const colorObj = nebulaColors[parseInt(commId, 10) % nebulaColors.length];
              nebulaLayer.moveTo(hull[0][0], hull[0][1]);
              for (let idx = 1; idx < hull.length; idx++) {
                nebulaLayer.lineTo(hull[idx][0], hull[idx][1]);
              }
              nebulaLayer.closePath();
              
              nebulaLayer.fill({ color: hexToNumber(colorObj.fill), alpha: THEME.nebula?.fillOpacity || 0.08 });
              nebulaLayer.stroke({ color: hexToNumber(colorObj.stroke), alpha: THEME.nebula?.strokeOpacity || 0.22, width: 80, join: 'round' });
            }
          });
        } else if (zoom <= 0.14 || zoom > 1.3) {
          nebulaLayer.clear();
        }

        // ---------------------------------------------------------------------
        // G. EDGE & CROSS-STACK LASER BRIDGE PIPELINE (With Flowing Photons)
        // ---------------------------------------------------------------------
        edgeLayer.clear();
        bridgePhotonLayer.clear();

        (simDataRef.current.edges || []).forEach(edge => {
          const sx = typeof edge.source === 'object' ? edge.source.x : null;
          const sy = typeof edge.source === 'object' ? edge.source.y : null;
          const tx = typeof edge.target === 'object' ? edge.target.x : null;
          const ty = typeof edge.target === 'object' ? edge.target.y : null;

          if (sx === null || sy === null || tx === null || ty === null || isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return;
          
          // Frustum Culling for Edges (Skip lines entirely off-screen)
          const minX = Math.min(sx, tx);
          const maxX = Math.max(sx, tx);
          const minY = Math.min(sy, ty);
          const maxY = Math.max(sy, ty);
          if (
            maxX < visibleBounds.x - 80 ||
            minX > visibleBounds.x + visibleBounds.width + 80 ||
            maxY < visibleBounds.y - 80 ||
            minY > visibleBounds.y + visibleBounds.height + 80
          ) {
            return;
          }

          const srcSpawn = edge.source.spawnProgress ?? 1;
          const tgtSpawn = edge.target.spawnProgress ?? 1;
          const edgeSpawnAlpha = Math.min(srcSpawn, tgtSpawn);
          if (edgeSpawnAlpha < 0.05) return;

          const isCall = edge.type === 'call';
          const isBridge = edge.type === 'network_bridge';
          const isHoveredHighlight = currentActiveRay?.activeE?.has(edge.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;

          let edgeColor = hexToNumber(isCall ? (THEME.edges?.call || '#8b5cf6') : isBridge ? '#00f0ff' : (THEME.edges?.hierarchy || '#334155'));
          let edgeAlpha = (THEME.edges?.opacityNormal || 0.45) * edgeSpawnAlpha * atomicLayerAlpha;
          let edgeWidth = isCall ? (THEME.edges?.widthCall || 1.6) : isBridge ? 2.5 : (THEME.edges?.widthHierarchy || 1.0);

          if (isHoveredHighlight) {
            edgeColor = hexToNumber(isCall ? (THEME.edges?.callGlow || '#c084fc') : isBridge ? '#00ffff' : (THEME.edges?.hierarchyGlow || '#60a5fa'));
            edgeAlpha = 1.0;
            edgeWidth = THEME.edges?.widthHoverGlow || 3.8; 
          } else if (isDimmedByRay) {
            edgeAlpha = (THEME.edges?.opacityDimmed || 0.04) * edgeSpawnAlpha * atomicLayerAlpha;
          }

          // 1. Draw Edge Conduit Line
          edgeLayer.moveTo(Math.round(sx), Math.round(sy));
          edgeLayer.lineTo(Math.round(tx), Math.round(ty));
          edgeLayer.stroke({ width: edgeWidth, color: edgeColor, alpha: edgeAlpha });

          // 2. 🚀 RENDER TRAVELING ENERGY PHOTONS ON CROSS-STACK BRIDGES (Frontend -> Backend)
          if (isBridge && edgeSpawnAlpha > 0.4) {
            // Draw Wide Neon Glow Aura for Laser Conduits
            edgeLayer.moveTo(Math.round(sx), Math.round(sy));
            edgeLayer.lineTo(Math.round(tx), Math.round(ty));
            edgeLayer.stroke({ width: 8.0, color: 0x00f0ff, alpha: 0.18 * edgeSpawnAlpha });

            // Stream 2 Traveling High-Speed Photons per Bridge
            for (let pIdx = 0; pIdx < 2; pIdx++) {
              const photonT = ((frameCount * 0.018) + (pIdx * 0.5)) % 1.0;
              const px = sx + (tx - sx) * photonT;
              const py = sy + (ty - sy) * photonT;

              bridgePhotonLayer.circle(Math.round(px), Math.round(py), 3.5);
              bridgePhotonLayer.fill({ color: 0xffffff, alpha: 0.95 });
              bridgePhotonLayer.circle(Math.round(px), Math.round(py), 7.0);
              bridgePhotonLayer.fill({ color: 0x00f0ff, alpha: 0.35 });
            }
          }
        });

        // ---------------------------------------------------------------------
        // H. ATOMIC CELESTIAL ORBS & LABELS (Hardware Frustum-Culled)
        // ---------------------------------------------------------------------
        const showFolderText = zoom > (LOD.LABELS?.folder || 0.28);
        const showFileText = zoom > (LOD.LABELS?.file || 0.45);
        const showFuncText = zoom > (LOD.LABELS?.function || 0.85);

        const blastSet = Array.isArray(currentBlastRadius) && currentBlastRadius.length > 0 ? new Set(currentBlastRadius) : null;

        (simDataRef.current.nodes || []).forEach(node => {
          const obj = spriteMap.get(node.id);
          if (!obj || typeof node.x !== 'number' || isNaN(node.x)) return;

          if (node.isSpawned && (node.spawnProgress || 0) < 1) {
            node.spawnProgress = Math.min(1, (node.spawnProgress || 0) + 0.038);
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

          // Frustum Culling for Text Labels (Skips off-screen rendering)
          const inFrustum = (
            finalX >= visibleBounds.x - 120 && 
            finalX <= visibleBounds.x + visibleBounds.width + 120 &&
            finalY >= visibleBounds.y - 120 && 
            finalY <= visibleBounds.y + visibleBounds.height + 120
          );

          obj.label.x = finalX;
          obj.label.y = finalY + obj.baseSize + 4;
          
          const isFolder = node.data?.nodeType === 'folder';
          const isFile = node.data?.nodeType === 'file';
          const isTextVisible = (isFolder && showFolderText) || (isFile && showFileText) || (!isFolder && !isFile && showFuncText);
          
          obj.label.visible = inFrustum && isTextVisible && (node.spawnProgress || 0) > 0.85;

          const isHoveredHighlight = currentActiveRay?.activeN?.has(node.id);
          const isBlastHighlight = blastSet?.has(node.id);
          const isDimmedByRay = (currentActiveRay && !isHoveredHighlight) || (blastSet && !isBlastHighlight);
          
          const baseAlpha = isDimmedByRay ? (THEME.edges?.opacityDimmed || 0.04) : 1.0;
          obj.sprite.alpha = baseAlpha;
          obj.label.alpha = baseAlpha;

          // Electric highlight tints
          if (isHoveredHighlight) {
            obj.sprite.tint = 0x60a5fa;
          } else if (isBlastHighlight) {
            obj.sprite.tint = 0x00ffff;
          } else {
            obj.sprite.tint = obj.color;
          }
        });
      });
    };

    initWebGPU();

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && appRef.current && appRef.current.renderer) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
      }
    };
  }, [simDataRef]); 

  return <div ref={containerRef} className="w-full h-full absolute inset-0 outline-none overflow-hidden" />;
}