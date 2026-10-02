// frontend/src/components/canvas/PixiSpatialEngine.jsx
import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from '../../config/engineConfig';
import { THEMES, getCurrentThemeId } from '../../config/themeConfig';

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
  refactorEnabled = false,
  settings = {}
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const cameraWarpRef = useRef(null);
  
  const stateRef = useRef({ 
    activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
    onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
    onRefactorDrop, onFileMergeDrop, refactorEnabled, settings 
  });
  
  useEffect(() => {
    stateRef.current = { 
      activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
      onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
      onRefactorDrop, onFileMergeDrop, refactorEnabled, settings 
    };
  }, [
    activeRay, focusIsolationId, blastRadius, cspRejectionEvent, warpTargetNodeId,
    onNodeHover, onNodeDoubleClick, onDragStart, onDragMove, onDragEnd, 
    onRefactorDrop, onFileMergeDrop, refactorEnabled, settings
  ]);

  useEffect(() => {
    if (!containerRef.current || !simDataRef?.current) return;

    let isMounted = true;
    let viewport;
    const spriteMap = new Map();
    const shockwaves = [];
    const snapBackQueue = new Map();

    const initWebGPU = async () => {
      const app = new PIXI.Application();
      const currentTheme = THEMES[getCurrentThemeId()] || THEMES.black;
      const initialBg = currentTheme?.webgl?.canvasBackground ?? 0x121314;
      const initW = Math.max(1, Math.floor(containerRef.current?.clientWidth || 800));
      const initH = Math.max(1, Math.floor(containerRef.current?.clientHeight || 600));
      
      await app.init({
        width: initW,
        height: initH,
        backgroundColor: initialBg,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: false,
        preference: 'webgpu' 
      });

      if (!isMounted || !containerRef.current) { 
        app.destroy(true); 
        return; 
      }
      app.canvas.style.display = 'block';
      app.canvas.style.touchAction = 'none';
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      const curW = Math.max(1, Math.floor(containerRef.current.clientWidth || initW));
      const curH = Math.max(1, Math.floor(containerRef.current.clientHeight || initH));
      if (curW !== initW || curH !== initH) {
        app.renderer.resize(curW, curH);
      }

      // 1. INFINITE CAMERA VIEWPORT
      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 300000, 
        worldHeight: 300000,
        events: app.renderer.events
      });
      viewport.eventMode = 'static';
      
      viewport.drag().pinch().wheel().decelerate();
      viewport.moveCenter(0, 0);
      viewport.setZoom(0.45);
      viewport.update(0);
      app.stage.addChild(viewport);

      // 2. LAYER PIPELINE (Optimized Depth Z-Ordering)
      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const bridgePhotonLayer = new PIXI.Graphics(); //  High-Voltage Laser Photons
      const refactorOverlay = new PIXI.Graphics();
      const blastRadiusOverlay = new PIXI.Graphics();
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
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      // High-resolution circle texture (radius 256) so enlarged merged orbs remain razor-sharp at all zoom levels
      const CIRCLE_TEX_RADIUS = 256;
      const circleGfx = new PIXI.Graphics().circle(0, 0, CIRCLE_TEX_RADIUS).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGfx);

      let globalDraggingNodeId = null;
      let dragOriginPos = { x: 0, y: 0 };
      let currentCaptureTarget = null;
      let isFileMergeMode = false;
      let lastWarpProcessedId = null;

      // Deterministic [0, 1) hash from node ID for organic stagger and swirl direction
      const hashString01 = (str) => {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return ((h >>> 0) % 10000) / 10000;
      };

      // Cached Hierarchical Topology for Procedural Multi-Stage Merging & Division
      let hierarchyCache = {
        signature: '',
        parentMap: new Map(),
        nodeMetaMap: new Map(),
        topDownOrder: [],
        bottomUpOrder: [],
        primaryRootId: null
      };

      const rebuildHierarchyTopology = (nodes, edges) => {
        const nodeById = new Map();
        nodes.forEach(n => nodeById.set(n.id, n));

        const parentMap = new Map();

        // 1. Direct hierarchy edges from AST/Filesystem graph (source = parent, target = child)
        edges.forEach(e => {
          if (e.type !== 'hierarchy') return;
          const srcId = typeof e.source === 'object' ? e.source.id : e.source;
          const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
          if (srcId && tgtId && srcId !== tgtId && nodeById.has(srcId) && nodeById.has(tgtId)) {
            parentMap.set(tgtId, srcId);
          }
        });

        // 2. Fallback path-based resolution for any nodes missing an explicit hierarchy edge
        nodes.forEach(n => {
          if (parentMap.has(n.id)) return;
          const nType = n.data?.nodeType;

          if (nType === 'function') {
            const fileCandidate = n.data?.filePath || (n.id.includes('::') ? n.id.split('::')[0] : null);
            if (fileCandidate && nodeById.has(fileCandidate) && fileCandidate !== n.id) {
              parentMap.set(n.id, fileCandidate);
            }
          } else if (nType === 'file') {
            const cleanPath = (n.data?.filePath || n.id).replace(/\\/g, '/');
            let slashIdx = cleanPath.lastIndexOf('/');
            while (slashIdx > 0) {
              const sub = cleanPath.substring(0, slashIdx);
              const dirCandidate = nodeById.has(sub) ? sub : `folder::${sub}`;
              if (nodeById.has(dirCandidate) && dirCandidate !== n.id) {
                parentMap.set(n.id, dirCandidate);
                break;
              }
              slashIdx = cleanPath.lastIndexOf('/', slashIdx - 1);
            }
          } else if (nType === 'folder') {
            const rawFolder = n.id.startsWith('folder::') ? n.id.slice(8) : n.id;
            const cleanFolder = rawFolder.replace(/\\/g, '/');
            let slashIdx = cleanFolder.lastIndexOf('/');
            while (slashIdx > 0) {
              const sub = cleanFolder.substring(0, slashIdx);
              const parentFolderCandidate = nodeById.has(sub) ? sub : `folder::${sub}`;
              if (nodeById.has(parentFolderCandidate) && parentFolderCandidate !== n.id) {
                parentMap.set(n.id, parentFolderCandidate);
                break;
              }
              slashIdx = cleanFolder.lastIndexOf('/', slashIdx - 1);
            }
          }
        });

        // 3. Identify top-level roots and select the primary workspace hub
        const childCountMap = new Map();
        parentMap.forEach((pId) => {
          childCountMap.set(pId, (childCountMap.get(pId) || 0) + 1);
        });

        const topFolders = nodes.filter(n => n.data?.nodeType === 'folder' && !parentMap.has(n.id));
        let primaryRootId = null;

        if (topFolders.length > 0) {
          topFolders.sort((a, b) => (childCountMap.get(b.id) || 0) - (childCountMap.get(a.id) || 0));
          primaryRootId = topFolders[0].id;
        } else {
          const topFiles = nodes.filter(n => n.data?.nodeType === 'file' && !parentMap.has(n.id));
          if (topFiles.length > 0) {
            topFiles.sort((a, b) => (childCountMap.get(b.id) || 0) - (childCountMap.get(a.id) || 0));
            primaryRootId = topFiles[0].id;
          } else if (nodes.length > 0) {
            primaryRootId = nodes[0].id;
          }
        }

        // 4. Compute natural folder depths before attaching root-level orphans to primaryRootId
        const folderDepthMap = new Map();
        let maxFolderDepth = 1;

        nodes.forEach(n => {
          if (n.data?.nodeType !== 'folder') return;
          let d = 0;
          let curr = n.id;
          const seen = new Set([curr]);
          while (parentMap.has(curr)) {
            const next = parentMap.get(curr);
            if (seen.has(next)) {
              parentMap.delete(curr);
              break;
            }
            seen.add(next);
            d++;
            curr = next;
          }
          folderDepthMap.set(n.id, d);
          if (d > maxFolderDepth) maxFolderDepth = d;
        });

        // 5. Connect root-level files and secondary top-level folders to primaryRootId for ultimate macro coalescence
        const rootLevelFileSet = new Set();
        if (primaryRootId) {
          nodes.forEach(n => {
            if (n.id === primaryRootId || parentMap.has(n.id)) return;
            if (n.data?.nodeType === 'file') {
              parentMap.set(n.id, primaryRootId);
              rootLevelFileSet.add(n.id);
            } else if (n.data?.nodeType === 'folder') {
              parentMap.set(n.id, primaryRootId);
            } else if (n.data?.nodeType === 'function') {
              parentMap.set(n.id, primaryRootId);
            }
          });
        }

        // 6. Build cycle-free children adjacency and top-down / bottom-up topological ordering
        const childrenListMap = new Map();
        parentMap.forEach((pId, cId) => {
          if (!childrenListMap.has(pId)) childrenListMap.set(pId, []);
          childrenListMap.get(pId).push(cId);
        });

        const topDownOrder = [];
        const visited = new Set();
        const queue = [];

        if (primaryRootId && nodeById.has(primaryRootId)) {
          queue.push(primaryRootId);
          visited.add(primaryRootId);
        }
        nodes.forEach(n => {
          if (!parentMap.has(n.id) && !visited.has(n.id)) {
            queue.push(n.id);
            visited.add(n.id);
          }
        });

        let qIdx = 0;
        while (qIdx < queue.length) {
          const currId = queue[qIdx++];
          topDownOrder.push(currId);
          const kids = childrenListMap.get(currId) || [];
          for (let i = 0; i < kids.length; i++) {
            const kId = kids[i];
            if (!visited.has(kId)) {
              visited.add(kId);
              queue.push(kId);
            }
          }
        }

        // Fallback for any isolated cycle remnants
        nodes.forEach(n => {
          if (!visited.has(n.id)) {
            visited.add(n.id);
            topDownOrder.push(n.id);
          }
        });

        const bottomUpOrder = [...topDownOrder].reverse();

        // 7. Store per-node structural metadata so live Settings LOD changes apply immediately every frame
        const nodeMetaMap = new Map();
        nodes.forEach(n => {
          if (n.id === primaryRootId || !parentMap.has(n.id)) {
            nodeMetaMap.set(n.id, { role: 'primaryRoot', stagger: 0, depthOffset: 0 });
            return;
          }

          const nType = n.data?.nodeType;
          const h = hashString01(n.id);
          const stagger = (h - 0.5) * 0.035;

          if (nType === 'function') {
            nodeMetaMap.set(n.id, { role: 'function', stagger, depthOffset: 0 });
          } else if (nType === 'file') {
            if (rootLevelFileSet.has(n.id) && topFolders.length > 0) {
              nodeMetaMap.set(n.id, { role: 'rootFile', stagger, depthOffset: 0 });
            } else {
              nodeMetaMap.set(n.id, { role: 'file', stagger, depthOffset: 0 });
            }
          } else if (nType === 'folder') {
            const d = folderDepthMap.get(n.id) ?? 0;
            if (d >= 1) {
              const depthOffset = maxFolderDepth > 1 ? ((d - 1) / (maxFolderDepth - 1)) * 0.22 : 0;
              nodeMetaMap.set(n.id, { role: 'subfolder', stagger, depthOffset });
            } else {
              nodeMetaMap.set(n.id, { role: 'topFolder', stagger, depthOffset: 0 });
            }
          }
        });

        hierarchyCache = {
          signature: `${nodes.length}:${edges.length}:${primaryRootId || ''}`,
          parentMap,
          nodeMetaMap,
          topDownOrder,
          bottomUpOrder,
          primaryRootId
        };
      };

      // HELPER: Creates a node entity sprite with zero-latency hardware event listeners
      const createNodeSprite = (node) => {
        const isFolder = node.data?.nodeType === 'folder';
        const isFile = node.data?.nodeType === 'file';
        
        let baseSize = THEME.sizes?.function?.px || 14;
        if (isFolder) baseSize = THEME.sizes?.folder?.px || 44;
        if (isFile) baseSize = THEME.sizes?.file?.px || 26;

        const targetScale = baseSize / CIRCLE_TEX_RADIUS; 
        
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
                  
                  const cx = typeof candidate.rx === 'number' ? candidate.rx : (candidate.x || 0);
                  const cy = typeof candidate.ry === 'number' ? candidate.ry : (candidate.y || 0);
                  const dx = cx - pos.x;
                  const dy = cy - pos.y;
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
          resolution: Math.max(2, Math.min(4, (window.devicePixelRatio || 1) * 2.5)),
          style: { 
            fontFamily: 'monospace', 
            fontSize: isFolder ? 16 : isFile ? 12.5 : 11, 
            fill: isFolder ? 0xe2e8f0 : isFile ? 0xcbd5e1 : 0x94a3b8, 
            fontWeight: isFolder ? 'bold' : isFile ? '600' : 'normal' 
          }
        });
        label.anchor.set(0.5, 0);
        label.alpha = 0;

        nodeLayer.addChild(sprite);
        labelLayer.addChild(label);

        const hVal = hashString01(node.id);
        const swirlFactor = (hVal >= 0.5 ? 1 : -1) * (0.08 + (hVal % 0.06));
        const intrinsicMass = isFolder ? 3.2 : isFile ? 2.0 : 1.0;
        const initX = typeof node.x === 'number' && !isNaN(node.x) ? node.x : 0;
        const initY = typeof node.y === 'number' && !isNaN(node.y) ? node.y : 0;
        
        spriteMap.set(node.id, {
          node,
          sprite,
          label,
          baseSize,
          targetScale,
          color,
          mergeProgress: 0,
          absorbedMass: 0,
          massSwell: 1,
          activityPulse: 0,
          currentScale: targetScale,
          worldRadius: baseSize,
          childMergeAlpha: 1,
          spawnP: 0,
          expX: initX,
          expY: initY,
          solverX: initX,
          solverY: initY,
          unmergedX: initX,
          unmergedY: initY,
          rx: initX,
          ry: initY,
          swirlFactor,
          hVal,
          intrinsicMass
        });
      };

      // 3. INITIAL POPULATION
      const initialNodes = simDataRef.current.nodes || [];
      const initialEdges = simDataRef.current.edges || [];
      initialNodes.forEach(createNodeSprite);
      rebuildHierarchyTopology(initialNodes, initialEdges);

      let frameCount = 0;

      // -----------------------------------------------------------------------
      // 4. THE 300 FPS HARDWARE TICK LOOP
      // -----------------------------------------------------------------------
      app.ticker.add(() => {
        frameCount++;
        if (viewport.screenWidth !== app.screen.width || viewport.screenHeight !== app.screen.height) {
          const prevC = viewport.center;
          viewport.resize(app.screen.width, app.screen.height, 300000, 300000);
          if (prevC && !isNaN(prevC.x) && !isNaN(prevC.y)) {
            viewport.moveCenter(prevC.x, prevC.y);
          }
          viewport.update(0);
        }
        const zoom = viewport.scale.x;
        const curSettings = stateRef.current.settings || {};
        const currentActiveRay = stateRef.current.activeRay;
        const currentBlastRadius = stateRef.current.blastRadius;
        const rejectionEvt = stateRef.current.cspRejectionEvent;
        const targetWarpId = stateRef.current.warpTargetNodeId;
        const visibleBounds = viewport.getVisibleBounds();
        const allowLabels = curSettings.showNodeLabels ?? true;

        // Live Configurable Spatial & LOD Parameters from Settings
        const animSpeed = Math.max(0.05, Math.min(10.0, Number(curSettings.spatialAnimationSpeed ?? 1.0)));
        const globalNodeScale = Math.max(0.05, Number(curSettings.spatialNodeScale ?? 1.0));
        const globalLineScale = Math.max(0.05, Number(curSettings.spatialLineScale ?? 1.0));
        const globalTextScale = Math.max(0.05, Number(curSettings.spatialTextScale ?? 1.0));
        const selectedLineWidth = Math.max(0.1, Number(curSettings.spatialSelectedLineWidth ?? 3.8));
        const bridgeLineWidth = Math.max(0.1, Number(curSettings.spatialBridgeLineWidth ?? 2.5));
        const purpleLineWidth = Math.max(0.1, Number(curSettings.spatialPurpleLineWidth ?? 1.6));
        const folderLabelZoom = Math.max(0.005, Number(curSettings.spatialFolderLabelZoom ?? 0.10));
        const fileLabelZoom = Math.max(0.01, Number(curSettings.spatialFileLabelZoom ?? 0.25));
        const funcLabelZoom = Math.max(0.01, Number(curSettings.spatialFuncLabelZoom ?? 0.55));
        const repulseStrength = Math.max(0.05, Number(curSettings.spatialMergeRepulsion ?? 1.5));
        const transitionSpeed = Math.max(0.01, Math.min(2.0, Number(curSettings.spatialTransitionSpeed ?? 0.28)));
        const lod1Zoom = Math.max(0.01, Number(curSettings.spatialLod1Zoom ?? 0.35));
        const lod2Zoom = Math.max(0.005, Number(curSettings.spatialLod2Zoom ?? 0.22));
        const lod3Zoom = Math.max(0.002, Number(curSettings.spatialLod3Zoom ?? 0.12));
        const lod4Zoom = Math.max(0.001, Number(curSettings.spatialLod4Zoom ?? 0.05));

        const currentGraphNodes = simDataRef.current.nodes || [];
        const currentGraphEdges = simDataRef.current.edges || [];

        //  A. TRIGGER 3D CAMERA WARP FLIGHT (Horizon 2 Omni-Search)
        if (targetWarpId && targetWarpId !== lastWarpProcessedId) {
          lastWarpProcessedId = targetWarpId;
          const targetNode = currentGraphNodes.find(n => n.id === targetWarpId);
          
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
          warp.progress += 0.028 * animSpeed;
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

        //  B. SPRITE ENTITY & HIERARCHY TOPOLOGY RECONCILIATION
        if (frameCount % 6 === 0) {
          const currentIdSet = new Set(currentGraphNodes.map(n => n.id));
          let topologyDirty = false;

          spriteMap.forEach((obj, id) => {
            if (!currentIdSet.has(id)) {
              nodeLayer.removeChild(obj.sprite);
              labelLayer.removeChild(obj.label);
              obj.sprite.destroy();
              obj.label.destroy();
              spriteMap.delete(id);
              topologyDirty = true;
            }
          });

          currentGraphNodes.forEach(n => {
            const existing = spriteMap.get(n.id);
            if (!existing) {
              createNodeSprite(n);
              topologyDirty = true;
            } else {
              existing.node = n;
            }
          });

          const expectedSig = `${currentGraphNodes.length}:${currentGraphEdges.length}:${hierarchyCache.primaryRootId || ''}`;
          if (topologyDirty || hierarchyCache.signature !== expectedSig) {
            rebuildHierarchyTopology(currentGraphNodes, currentGraphEdges);
          }
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
            const simNode = currentGraphNodes.find(n => n.id === rejectionEvt.nodeId);
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

        // 4. Snap Back Interpolation
        snapBackQueue.forEach((snap, id) => {
          snap.progress += 0.065 * animSpeed;
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

        // ---------------------------------------------------------------------
        // D. PROCEDURAL HIERARCHICAL MERGING & DIVISION ENGINE
        // ---------------------------------------------------------------------
        const { parentMap, nodeMetaMap, topDownOrder, bottomUpOrder } = hierarchyCache;

        // Pass 1: Compute snappy threshold-driven mergeProgress per node & reset frame mass accumulators
        const frameMassAccum = new Map();
        const framePulseAccum = new Map();

        for (let i = 0; i < topDownOrder.length; i++) {
          const id = topDownOrder[i];
          const obj = spriteMap.get(id);
          if (!obj) continue;

          let targetMerge = 0;
          const meta = nodeMetaMap.get(id);
          if (meta && meta.role !== 'primaryRoot' && globalDraggingNodeId !== id) {
            let threshold = 0;
            if (meta.role === 'function') {
              threshold = lod1Zoom * (1 + meta.stagger);
            } else if (meta.role === 'file') {
              threshold = lod2Zoom * (1 + meta.stagger);
            } else if (meta.role === 'subfolder' || meta.role === 'rootFile') {
              threshold = lod3Zoom * (1 + meta.depthOffset + meta.stagger);
            } else if (meta.role === 'topFolder') {
              threshold = lod4Zoom * (1 + meta.stagger * 0.5);
            }

            if (threshold > 0) {
              const hyst = Math.max(0.002, threshold * 0.035);
              if (obj.isMerged === undefined) {
                // Initialize based on current camera zoom
                obj.isMerged = zoom < threshold;
                obj.mergeProgress = obj.isMerged ? 1.0 : 0.0;
              } else if (!obj.isMerged && zoom < threshold - hyst) {
                // Trigger combining: camera reached threshold while zooming out
                obj.isMerged = true;
              } else if (obj.isMerged && zoom > threshold + hyst) {
                // Trigger dividing: camera reached threshold while zooming in
                obj.isMerged = false;
              }

              targetMerge = obj.isMerged ? 1.0 : 0.0;
            }
          }

          const prevM = obj.mergeProgress ?? 0;
          const diff = targetMerge - prevM;
          if (Math.abs(diff) > 0.0005) {
            // Autonomous procedural animation: starts at threshold and completes smoothly
            const animRate = Math.max(0.02, Math.min(0.25, transitionSpeed * animSpeed * 0.16));
            const ease = Math.sin(prevM * Math.PI) * 0.8 + 0.2;
            const step = Math.sign(diff) * Math.max(0.018 * animSpeed, animRate * ease);
            if (Math.abs(step) >= Math.abs(diff)) {
              obj.mergeProgress = targetMerge;
            } else {
              obj.mergeProgress = prevM + step;
            }
          } else {
            obj.mergeProgress = targetMerge;
          }

          frameMassAccum.set(id, 0);
          framePulseAccum.set(id, 0);
        }

        // Pass 2 (Bottom-Up): Accumulate absorbed child mass & compute worldRadius for every orb
        for (let i = 0; i < bottomUpOrder.length; i++) {
          const id = bottomUpOrder[i];
          const obj = spriteMap.get(id);
          if (!obj) continue;

          const node = obj.node;
          if (node.isSpawned && (node.spawnProgress || 0) < 1) {
            node.spawnProgress = Math.min(1, (node.spawnProgress || 0) + 0.038 * animSpeed);
          }

          const p = Math.max(0, Math.min(1, node.spawnProgress || 0));
          const bounceMultiplier = p > 0 ? easeOutBack(p) : 0;

          const targetMass = frameMassAccum.get(id) || 0;
          const massDiff = targetMass - obj.absorbedMass;
          if (Math.abs(massDiff) > 0.005) {
            obj.absorbedMass += massDiff * Math.min(0.45, transitionSpeed * 1.15 * animSpeed);
          } else {
            obj.absorbedMass = targetMass;
          }

          const targetPulse = framePulseAccum.get(id) || 0;
          obj.activityPulse += (targetPulse - obj.activityPulse) * 0.26;

          const m = obj.mergeProgress;
          const pId = parentMap.get(id);
          if (pId && frameMassAccum.has(pId)) {
            if (m > 0.001) {
              const transferWeight = m * m;
              const contributedMass = transferWeight * (obj.intrinsicMass + targetMass);
              frameMassAccum.set(pId, (frameMassAccum.get(pId) || 0) + contributedMass);

              const boundaryActivity = Math.sin(Math.max(0, Math.min(1, (m - 0.25) / 0.70)) * Math.PI);
              if (boundaryActivity > 0.05) {
                framePulseAccum.set(pId, Math.max(framePulseAccum.get(pId) || 0, boundaryActivity));
              }
            } else if (targetMass > 0.01) {
              // When files swell from absorbing functions, folders also swell proportionally so hierarchy sizes stay balanced
              frameMassAccum.set(pId, (frameMassAccum.get(pId) || 0) + targetMass * 0.35);
            }
          }

          // Orbs grow in world space when children merge into them (without canceling camera zoom)
          const massSwell = 1.0 + Math.min(3.6, Math.pow(Math.max(0, obj.absorbedMass), 0.52) * 0.42);
          const pulseSwell = 1.0 + (obj.activityPulse * 0.12);

          let childMergeScale = 1.0;
          let childMergeAlpha = 1.0;
          if (m > 0.40) {
            const coreT = Math.min(1, (m - 0.40) / 0.60);
            const smoothCore = coreT * coreT * (3 - 2 * coreT);
            childMergeScale = 1.0 - smoothCore * 0.88;
          }
          if (m > 0.52) {
            const alphaT = Math.min(1, (m - 0.52) / 0.45);
            childMergeAlpha = 1.0 - alphaT * alphaT;
          }

          const currentScale = obj.targetScale * Math.max(0, bounceMultiplier) * globalNodeScale * massSwell * pulseSwell * childMergeScale;
          obj.massSwell = massSwell;
          obj.currentScale = currentScale;
          obj.worldRadius = CIRCLE_TEX_RADIUS * currentScale;
          obj.childMergeAlpha = childMergeAlpha;
          obj.spawnP = p;

          // Sync worldRadius & repulseStrength to D3 physics node for smooth, jitter-free forceCollide & forceManyBody
          node.worldRadius = obj.worldRadius;
          node.repulseStrength = repulseStrength;
        }

        // Pass 3 (Top-Down): Interpolate rendered position (rx, ry) cleanly from D3 home position into parent orb
        for (let i = 0; i < topDownOrder.length; i++) {
          const id = topDownOrder[i];
          const obj = spriteMap.get(id);
          if (!obj) continue;

          const node = obj.node;
          const homeX = typeof node.x === 'number' && !isNaN(node.x) ? node.x : 0;
          const homeY = typeof node.y === 'number' && !isNaN(node.y) ? node.y : 0;

          const pId = parentMap.get(id);
          const parentObj = pId ? spriteMap.get(pId) : null;
          const m = obj.mergeProgress;

          if (parentObj && m > 0.0005 && globalDraggingNodeId !== id) {
            const px = parentObj.rx;
            const py = parentObj.ry;
            const dx = homeX - px;
            const dy = homeY - py;

            const pullEase = m * m * (3 - 2 * m);
            const swirl = m * (1 - m) * obj.swirlFactor;

            obj.rx = px + dx * (1 - pullEase) - dy * swirl;
            obj.ry = py + dy * (1 - pullEase) + dx * swirl;
          } else {
            obj.rx = homeX;
            obj.ry = homeY;
          }

          // Expose rendered coordinates & merge state on the node for the real-time Minimap & hit testing
          node.rx = obj.rx;
          node.ry = obj.ry;
          node.mergeProgress = m;
          node.absorbedMass = obj.absorbedMass;
        }

        // Dynamic zoom scaling factors for lines and text labels
        const zoomLineRatio = 0.45 / Math.max(0.015, zoom);
        const dynamicZoomLineScale = zoom < 0.45
          ? Math.pow(zoomLineRatio, 0.68)
          : Math.pow(zoomLineRatio, 0.42);
        const edgeZoomBoost = globalLineScale * dynamicZoomLineScale;
        const zoomAlphaBoost = zoom < 0.45 ? Math.min(1.45, Math.pow(zoomLineRatio, 0.22)) : 1.0;

        const zoomTextRatio = 0.70 / Math.max(0.02, zoom);
        const baseTextZoomScale = (zoom < 0.70
          ? Math.pow(zoomTextRatio, 0.66)
          : Math.pow(zoomTextRatio, 0.48)) * globalTextScale;

        // ---------------------------------------------------------------------
        // E. RENDER OVERLAYS (Capture Rings, Shockwaves, Blast Radius)
        // ---------------------------------------------------------------------
        refactorOverlay.clear();
        blastRadiusOverlay.clear();

        // 1. Refactor Capture Rings
        if (currentCaptureTarget) {
          const capX = typeof currentCaptureTarget.rx === 'number' ? currentCaptureTarget.rx : currentCaptureTarget.x;
          const capY = typeof currentCaptureTarget.ry === 'number' ? currentCaptureTarget.ry : currentCaptureTarget.y;
          if (typeof capX === 'number' && !isNaN(capX)) {
            const pulse = (Math.sin(frameCount * 0.18 * animSpeed) + 1) * 0.5;
            const capObj = spriteMap.get(currentCaptureTarget.id);
            const baseR = capObj ? capObj.worldRadius : (THEME.sizes?.file?.px || 26) * globalNodeScale;
            const ringRadius = baseR + (isFileMergeMode ? 30 : 22) + (pulse * 8);
            const ringColor = isFileMergeMode ? 0xf59e0b : 0x38bdf8;
            
            refactorOverlay.circle(Math.round(capX), Math.round(capY), ringRadius);
            refactorOverlay.stroke({ width: 2.5 * edgeZoomBoost, color: ringColor, alpha: 0.9 });
            refactorOverlay.circle(Math.round(capX), Math.round(capY), Math.max(4, ringRadius - 6));
            refactorOverlay.fill({ color: ringColor, alpha: 0.15 });
          }
        }

        // 2. Shockwave Rings
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.radius += 5 * animSpeed;
          sw.alpha -= 0.024 * animSpeed;
          
          if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
            shockwaves.splice(i, 1);
            continue;
          }

          refactorOverlay.circle(Math.round(sw.x), Math.round(sw.y), sw.radius);
          refactorOverlay.stroke({ width: 3.2 * dynamicZoomLineScale, color: sw.color, alpha: sw.alpha });
        }

        // 3. Horizon 3: AI Blast Radius Glow Rings
        if (Array.isArray(currentBlastRadius) && currentBlastRadius.length > 0) {
          const blastSet = new Set(currentBlastRadius);
          const pulse = (Math.sin(frameCount * 0.12 * animSpeed) + 1) * 0.5;

          currentGraphNodes.forEach(n => {
            const obj = spriteMap.get(n.id);
            if (blastSet.has(n.id) && obj && obj.mergeProgress < 0.85) {
              const r = obj.worldRadius + 12 + (pulse * 6);
              blastRadiusOverlay.circle(Math.round(obj.rx), Math.round(obj.ry), r);
              blastRadiusOverlay.stroke({ width: 2.0 * edgeZoomBoost, color: 0x00ffff, alpha: 0.8 * (1 - obj.mergeProgress) });
              blastRadiusOverlay.circle(Math.round(obj.rx), Math.round(obj.ry), Math.max(2, r - 4));
              blastRadiusOverlay.fill({ color: 0x00ffff, alpha: 0.12 * (1 - obj.mergeProgress) });
            }
          });
        }

        // ---------------------------------------------------------------------
        // F. DYNAMIC ML NEBULA CONVEX HULLS (Synchronized With Procedural Merging)
        // ---------------------------------------------------------------------
        nebulaLayer.clear();
        let drewAnyNebula = false;
        if (zoom <= 1.65) {
          const closeUpFade = zoom > 1.15 ? Math.max(0, 1 - (zoom - 1.15) / 0.50) : 1.0;
          const nebulaZoomScale = Math.pow(0.45 / Math.max(0.02, zoom), 0.25) * globalNodeScale;
          const groups = {};
          const groupWeights = {};

          currentGraphNodes.forEach(n => {
            const comm = n.data?.community;
            const obj = spriteMap.get(n.id);
            if (comm === undefined || comm === null || !obj || (n.spawnProgress || 0) <= 0.3) return;

            const m = obj.mergeProgress;
            const pId = parentMap.get(n.id);
            const pObj = pId ? spriteMap.get(pId) : null;
            const sameCommParent = pObj && pObj.node?.data?.community === comm;

            // If this node has fully merged into a parent of the SAME community, the parent orb already carries the hull
            if (sameCommParent && m > 0.94) return;

            // If merging into a parent of a DIFFERENT community (e.g. final root hub), smoothly fade this node's contribution
            const memberWeight = (!sameCommParent && pObj) ? Math.max(0, 1 - m * 1.15) : (1 - m * 0.4);
            if (memberWeight <= 0.04) return;

            if (!groups[comm]) {
              groups[comm] = [];
              groupWeights[comm] = 0;
            }
            groups[comm].push({ obj, m, sameCommParent, memberWeight });
            if (memberWeight > groupWeights[comm]) {
              groupWeights[comm] = memberWeight;
            }
          });

          const nebulaColors = THEME.nebula?.colors || [];
          const baseNebulaPad = (THEME.nebula?.padding || 65) * 0.55 * nebulaZoomScale;
          const NEBULA_ANGLES = 12;

          Object.entries(groups).forEach(([commId, entries]) => {
            if (entries.length === 0 || nebulaColors.length === 0) return;
            const commAlphaWeight = Math.min(1, groupWeights[commId] || 0) * closeUpFade;
            if (commAlphaWeight <= 0.02) return;

            const pts = [];
            for (let i = 0; i < entries.length; i++) {
              const { obj: o, m, memberWeight } = entries[i];
              // Dynamic halo radius around each orb that swells with worldRadius and contracts as children merge in
              const padRadius = (o.worldRadius * 1.35 + baseNebulaPad * (1 - m * 0.70)) * Math.max(0.25, memberWeight);
              for (let a = 0; a < NEBULA_ANGLES; a++) {
                const theta = (a * Math.PI * 2) / NEBULA_ANGLES;
                pts.push([
                  o.rx + Math.cos(theta) * padRadius,
                  o.ry + Math.sin(theta) * padRadius
                ]);
              }
            }

            const hull = pts.length >= 3 ? polygonHull(pts) : null;
            if (hull && hull.length >= 3) {
              drewAnyNebula = true;
              const colorObj = nebulaColors[parseInt(commId, 10) % nebulaColors.length];
              const hLen = hull.length;

              // Render a C1-continuous rounded B-spline curve through the convex hull midpoints
              const startMidX = (hull[hLen - 1][0] + hull[0][0]) * 0.5;
              const startMidY = (hull[hLen - 1][1] + hull[0][1]) * 0.5;
              nebulaLayer.moveTo(startMidX, startMidY);

              for (let idx = 0; idx < hLen; idx++) {
                const curr = hull[idx];
                const next = hull[(idx + 1) % hLen];
                const midX = (curr[0] + next[0]) * 0.5;
                const midY = (curr[1] + next[1]) * 0.5;
                nebulaLayer.quadraticCurveTo(curr[0], curr[1], midX, midY);
              }
              nebulaLayer.closePath();

              const fillAlpha = (THEME.nebula?.fillOpacity || 0.08) * commAlphaWeight;
              const strokeAlpha = (THEME.nebula?.strokeOpacity || 0.22) * commAlphaWeight;
              const strokeWidth = Math.max(12, 34 * nebulaZoomScale);

              nebulaLayer.fill({ color: hexToNumber(colorObj.fill), alpha: fillAlpha });
              nebulaLayer.stroke({
                color: hexToNumber(colorObj.stroke),
                alpha: strokeAlpha,
                width: strokeWidth,
                join: 'round',
                cap: 'round'
              });
            }
          });
        }
        nebulaLayer.visible = drewAnyNebula;

        // ---------------------------------------------------------------------
        // G. EDGE & CROSS-STACK LASER BRIDGE PIPELINE (Dynamic Zoom & Mass Scaling)
        // ---------------------------------------------------------------------
        edgeLayer.clear();
        bridgePhotonLayer.clear();

        const drawnConduits = new Set();

        currentGraphEdges.forEach(edge => {
          const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
          const srcObj = spriteMap.get(srcId);
          const tgtObj = spriteMap.get(tgtId);

          if (!srcObj || !tgtObj) return;

          const sx = srcObj.rx;
          const sy = srcObj.ry;
          const tx = tgtObj.rx;
          const ty = tgtObj.ry;

          if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return;

          // Skip edges whose endpoints have merged into the same orb
          const dx = tx - sx;
          const dy = ty - sy;
          const edgeLen = Math.sqrt(dx * dx + dy * dy);
          if (edgeLen < 2.5) return;
          
          // Frustum Culling for Edges (Skip lines entirely off-screen)
          const minX = Math.min(sx, tx);
          const maxX = Math.max(sx, tx);
          const minY = Math.min(sy, ty);
          const maxY = Math.max(sy, ty);
          if (
            maxX < visibleBounds.x - 160 ||
            minX > visibleBounds.x + visibleBounds.width + 160 ||
            maxY < visibleBounds.y - 160 ||
            minY > visibleBounds.y + visibleBounds.height + 160
          ) {
            return;
          }

          const srcSpawn = srcObj.node.spawnProgress ?? 1;
          const tgtSpawn = tgtObj.node.spawnProgress ?? 1;
          const edgeSpawnAlpha = Math.min(srcSpawn, tgtSpawn);
          if (edgeSpawnAlpha < 0.05) return;

          const isCall = edge.type === 'call';
          const isBridge = edge.type === 'network_bridge';
          const isHierarchy = edge.type === 'hierarchy';

          // Rapidly fade hierarchy edges as child orbs merge into their parent orb so transitions stay clean
          let mergeEdgeFade = 1.0;
          if (isHierarchy) {
            const childM = Math.max(srcObj.mergeProgress, tgtObj.mergeProgress);
            mergeEdgeFade = Math.max(0, 1 - childM * 1.65);
          } else {
            // For call/bridge edges, fade only if the two endpoints physically converge into the same parent orb
            mergeEdgeFade = Math.min(1, edgeLen / Math.max(18, (srcObj.worldRadius + tgtObj.worldRadius) * 0.6));
          }
          if (mergeEdgeFade < 0.02) return;

          const isHoveredHighlight = currentActiveRay?.activeE?.has(edge.id);
          const isDimmedByRay = currentActiveRay && !isHoveredHighlight;

          // Deduplicate converged non-highlighted edges when child connections bundle between merged parent orbs
          if (!isHoveredHighlight && !isBridge) {
            const qx1 = Math.round(sx * 0.25);
            const qy1 = Math.round(sy * 0.25);
            const qx2 = Math.round(tx * 0.25);
            const qy2 = Math.round(ty * 0.25);
            const pairKey = (qx1 < qx2 || (qx1 === qx2 && qy1 <= qy2))
              ? `${edge.type}:${qx1},${qy1}-${qx2},${qy2}`
              : `${edge.type}:${qx2},${qy2}-${qx1},${qy1}`;
            if (drawnConduits.has(pairKey)) return;
            drawnConduits.add(pairKey);
          }

          const combinedMass = (srcObj.absorbedMass || 0) + (tgtObj.absorbedMass || 0);
          const massConduitBoost = 1.0 + Math.min(0.75, Math.pow(Math.max(0, combinedMass), 0.38) * 0.14);

          let edgeColor = hexToNumber(isCall ? (THEME.edges?.call || '#8b5cf6') : isBridge ? '#00f0ff' : (THEME.edges?.hierarchy || '#334155'));
          let edgeAlpha = Math.min(0.92, (THEME.edges?.opacityNormal || 0.45) * zoomAlphaBoost) * edgeSpawnAlpha * mergeEdgeFade;
          let edgeWidth = (isCall ? purpleLineWidth : isBridge ? bridgeLineWidth : (THEME.edges?.widthHierarchy || 1.0)) * globalLineScale * edgeZoomBoost * massConduitBoost;

          if (isHoveredHighlight) {
            edgeColor = hexToNumber(isCall ? (THEME.edges?.callGlow || '#c084fc') : isBridge ? '#00ffff' : (THEME.edges?.hierarchyGlow || '#60a5fa'));
            edgeAlpha = 1.0 * mergeEdgeFade;
            edgeWidth = selectedLineWidth * globalLineScale * edgeZoomBoost * massConduitBoost; 
          } else if (isDimmedByRay) {
            edgeAlpha = (THEME.edges?.opacityDimmed || 0.04) * edgeSpawnAlpha * mergeEdgeFade;
          }

          // 1. Draw Edge Conduit Line
          edgeLayer.moveTo(Math.round(sx), Math.round(sy));
          edgeLayer.lineTo(Math.round(tx), Math.round(ty));
          edgeLayer.stroke({ width: edgeWidth, color: edgeColor, alpha: edgeAlpha });

          // 2.  RENDER TRAVELING ENERGY PHOTONS ON CROSS-STACK BRIDGES (Frontend -> Backend)
          const allowPhotons = curSettings.spatialParticles ?? true;
          if (isBridge && edgeSpawnAlpha > 0.4 && mergeEdgeFade > 0.2 && allowPhotons) {
            edgeLayer.moveTo(Math.round(sx), Math.round(sy));
            edgeLayer.lineTo(Math.round(tx), Math.round(ty));
            edgeLayer.stroke({ width: Math.max(4.0, bridgeLineWidth * 3.0) * globalLineScale * edgeZoomBoost, color: 0x00f0ff, alpha: 0.18 * edgeSpawnAlpha * mergeEdgeFade });

            for (let pIdx = 0; pIdx < 2; pIdx++) {
              const photonT = ((frameCount * 0.018 * animSpeed) + (pIdx * 0.5)) % 1.0;
              const px = sx + (tx - sx) * photonT;
              const py = sy + (ty - sy) * photonT;

              bridgePhotonLayer.circle(Math.round(px), Math.round(py), Math.max(1.5, bridgeLineWidth * 1.4) * edgeZoomBoost);
              bridgePhotonLayer.fill({ color: 0xffffff, alpha: 0.95 * mergeEdgeFade });
              bridgePhotonLayer.circle(Math.round(px), Math.round(py), Math.max(3.0, bridgeLineWidth * 2.8) * edgeZoomBoost);
              bridgePhotonLayer.fill({ color: 0x00f0ff, alpha: 0.35 * mergeEdgeFade });
            }
          }
        });

        // ---------------------------------------------------------------------
        // H. PROCEDURAL CELESTIAL ORBS & LABELS (Dynamic Zoom & Mass Scaling)
        // ---------------------------------------------------------------------
        nodeLayer.alpha = 1.0;
        labelLayer.alpha = 1.0;
        labelLayer.visible = allowLabels;

        const blastSet = Array.isArray(currentBlastRadius) && currentBlastRadius.length > 0 ? new Set(currentBlastRadius) : null;

        currentGraphNodes.forEach(node => {
          const obj = spriteMap.get(node.id);
          if (!obj || typeof node.x !== 'number' || isNaN(node.x)) return;

          const isFolder = node.data?.nodeType === 'folder';
          const isFile = node.data?.nodeType === 'file';
          const m = obj.mergeProgress;
          const p = obj.spawnP;
          const currentScale = obj.currentScale;
          const currentWorldRadius = obj.worldRadius;
          const childMergeAlpha = obj.childMergeAlpha;

          const finalX = Math.round(obj.rx);
          const finalY = Math.round(obj.ry);

          obj.sprite.x = finalX;
          obj.sprite.y = finalY;
          obj.sprite.scale.set(currentScale);
          obj.sprite.visible = p > 0.01 && childMergeAlpha > 0.01;
          obj.sprite.eventMode = m > 0.45 ? 'none' : 'static';

          // Dynamic per-node text scale: responds smoothly to camera zoom AND merged orb mass swell
          const orbTextBoost = 1.0 + ((obj.massSwell || 1) - 1) * 0.28;
          const nodeLabelScale = baseTextZoomScale * orbTextBoost;

          // Frustum Culling for Text Labels (Skips off-screen rendering)
          const cullMargin = 180 * nodeLabelScale;
          const inFrustum = (
            finalX >= visibleBounds.x - cullMargin && 
            finalX <= visibleBounds.x + visibleBounds.width + cullMargin &&
            finalY >= visibleBounds.y - cullMargin && 
            finalY <= visibleBounds.y + visibleBounds.height + cullMargin
          );

          obj.label.scale.set(nodeLabelScale);
          obj.label.x = finalX;
          obj.label.y = finalY + currentWorldRadius + (5 * nodeLabelScale);
          
          const folderZoomAlpha = Math.max(0, Math.min(1, (zoom - folderLabelZoom * 0.85) / Math.max(0.02, folderLabelZoom * 0.25)));
          const fileZoomAlpha = Math.max(0, Math.min(1, (zoom - fileLabelZoom * 0.85) / Math.max(0.02, fileLabelZoom * 0.25)));
          const funcZoomAlpha = Math.max(0, Math.min(1, (zoom - funcLabelZoom * 0.85) / Math.max(0.02, funcLabelZoom * 0.25)));

          const showFolderText = isFolder && folderZoomAlpha > 0.01 && m < 0.22;
          const showFileText = isFile && fileZoomAlpha > 0.01 && m < 0.22;
          const showFuncText = !isFolder && !isFile && funcZoomAlpha > 0.01 && m < 0.16;
          const isTextVisible = allowLabels && (showFolderText || showFileText || showFuncText);
          
          obj.label.visible = allowLabels && inFrustum && isTextVisible && p > 0.85;

          const isHoveredHighlight = currentActiveRay?.activeN?.has(node.id);
          const isBlastHighlight = blastSet?.has(node.id);
          const isDimmedByRay = (currentActiveRay && !isHoveredHighlight) || (blastSet && !isBlastHighlight);
          
          const baseAlpha = isDimmedByRay ? (THEME.edges?.opacityDimmed || 0.04) : 1.0;
          const nodeZoomAlpha = isFolder ? folderZoomAlpha : isFile ? fileZoomAlpha : funcZoomAlpha;
          const labelMergeAlpha = Math.max(0, 1 - m * 4.8) * nodeZoomAlpha;
          obj.sprite.alpha = baseAlpha * childMergeAlpha;
          obj.label.alpha = baseAlpha * labelMergeAlpha;

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

    const handleThemeChange = (e) => {
      if (appRef.current && appRef.current.renderer && e.detail?.theme?.webgl?.canvasBackground !== undefined) {
        try {
          appRef.current.renderer.background.color = e.detail.theme.webgl.canvasBackground;
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('neuron-theme-change', handleThemeChange);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!containerRef.current || !appRef.current || !appRef.current.renderer) return;
      const entry = entries?.[0];
      const w = Math.max(1, Math.floor(entry?.contentRect?.width ?? containerRef.current.clientWidth));
      const h = Math.max(1, Math.floor(entry?.contentRect?.height ?? containerRef.current.clientHeight));

      if (appRef.current.screen.width === w && appRef.current.screen.height === h) return;

      const prevCenter = viewport ? { x: viewport.center.x, y: viewport.center.y } : null;

      appRef.current.renderer.resize(w, h);
      if (appRef.current.stage) {
        appRef.current.stage.hitArea = appRef.current.screen;
      }

      if (viewport) {
        viewport.resize(w, h, 300000, 300000);
        if (prevCenter && !isNaN(prevCenter.x) && !isNaN(prevCenter.y)) {
          viewport.moveCenter(prevCenter.x, prevCenter.y);
        }
        viewport.update(0);
      }

      try {
        appRef.current.render();
      } catch {
        // ignore if renderer is mid-init
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isMounted = false;
      window.removeEventListener('neuron-theme-change', handleThemeChange);
      resizeObserver.disconnect();
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [simDataRef]); 

  return <div ref={containerRef} className="w-full h-full absolute inset-0 outline-none overflow-hidden" />;
}