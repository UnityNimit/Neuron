import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { polygonHull } from 'd3-polygon';
import { ENGINE_CONFIG } from './engineConfig';

const { THEME, LOD } = ENGINE_CONFIG;

const hexToNumber = (hex) => {
  if (typeof hex === 'number') return hex;
  if (!hex) return 0xffffff;
  const clean = hex.replace('#', '0x').trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0xffffff : parsed;
};

export default function PixiSpatialEngine({
  simDataRef,
  activeRay,
  hoveredNodeId,
  onNodeClick,
  onNodeHover,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const stateRef = useRef({ activeRay, hoveredNodeId, onNodeClick, onNodeHover, onDragStart, onDragMove, onDragEnd });

  useEffect(() => {
    stateRef.current = { activeRay, hoveredNodeId, onNodeClick, onNodeHover, onDragStart, onDragMove, onDragEnd };
  }, [activeRay, hoveredNodeId, onNodeClick, onNodeHover, onDragStart, onDragMove, onDragEnd]);

  useEffect(() => {
    if (!containerRef.current || !simDataRef?.current) return;

    let isMounted = true;
    let viewport;
    const spriteMap = new Map();

    const initCanvas = async () => {
      const app = new PIXI.Application();
      await app.init({
        resizeTo: containerRef.current,
        backgroundColor: 0x0c0e12,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true
      });

      if (!isMounted) {
        app.destroy(true);
        return;
      }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // 1. Interactive Infinite Viewport
      viewport = new Viewport({
        screenWidth: app.screen.width,
        screenHeight: app.screen.height,
        worldWidth: 30000,
        worldHeight: 30000,
        events: app.renderer.events
      });

      viewport.drag().pinch().wheel().decelerate();
      viewport.moveCenter(0, 0);
      viewport.setZoom(0.85);
      app.stage.addChild(viewport);

      // 2. Layer Pipeline
      const nebulaLayer = new PIXI.Graphics();
      const edgeLayer = new PIXI.Graphics();
      const photonLayer = new PIXI.Graphics();
      const nodeLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();

      const blurFilter = new PIXI.BlurFilter();
      blurFilter.blur = THEME.nebula.blurRadius;
      nebulaLayer.filters = [blurFilter];

      viewport.addChild(nebulaLayer);
      viewport.addChild(edgeLayer);
      viewport.addChild(photonLayer);
      viewport.addChild(nodeLayer);
      viewport.addChild(labelLayer);

      // Master circle texture
      const circleGfx = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
      const circleTexture = app.renderer.generateTexture(circleGfx);

      let draggingNodeId = null;

      // Create Node Sprites
      const createNodeSprite = (node) => {
        const isFolder = node.nodeType === 'folder';
        const isFile = node.nodeType === 'file';
        let baseSize = THEME.sizes.function.px;
        let color = hexToNumber(THEME.nodes.function);

        if (isFolder) {
          baseSize = THEME.sizes.folder.px;
          color = hexToNumber(THEME.nodes.folder);
        } else if (isFile) {
          baseSize = THEME.sizes.file.px;
          color = hexToNumber(THEME.nodes.file);
        }

        const sprite = new PIXI.Sprite(circleTexture);
        sprite.anchor.set(0.5);
        sprite.scale.set(baseSize / 64);
        sprite.tint = color;
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';

        // Drag & Click Events
        sprite.on('pointerdown', (e) => {
          draggingNodeId = node.id;
          viewport.pause = true;
          const pos = viewport.toLocal(e.global);
          stateRef.current.onDragStart?.(node.id, pos.x, pos.y);
          stateRef.current.onNodeClick?.(node);
        });

        sprite.on('globalpointermove', (e) => {
          if (draggingNodeId === node.id) {
            const pos = viewport.toLocal(e.global);
            stateRef.current.onDragMove?.(node.id, pos.x, pos.y);
          }
        });

        const stopDrag = () => {
          if (draggingNodeId === node.id) {
            draggingNodeId = null;
            viewport.pause = false;
            stateRef.current.onDragEnd?.(node.id);
          }
        };

        sprite.on('pointerup', stopDrag);
        sprite.on('pointerupoutside', stopDrag);
        sprite.on('pointerover', () => stateRef.current.onNodeHover?.(node.id));
        sprite.on('pointerout', () => stateRef.current.onNodeHover?.(null));

        // Label
        const label = new PIXI.Text({
          text: node.data?.label || node.id,
          style: {
            fontFamily: 'monospace',
            fontSize: isFolder ? 14 : 11,
            fill: isFolder ? 0xe2e8f0 : 0x94a3b8
          }
        });
        label.anchor.set(0.5, 0);

        nodeLayer.addChild(sprite);
        labelLayer.addChild(label);
        spriteMap.set(node.id, { sprite, label, baseSize, color });
      };

      (simDataRef.current.nodes || []).forEach(createNodeSprite);

      let frameCount = 0;

      // 3. Hardware Tick Loop (60-144 FPS)
      app.ticker.add(() => {
        frameCount++;
        const zoom = viewport.scale.x;
        const currentActiveRay = stateRef.current.activeRay;

        // A. Louvain Community Nebulas (Convex Hulls)
        if (frameCount % 4 === 0 && zoom > 0.2) {
          nebulaLayer.clear();
          const groups = {};
          (simDataRef.current.nodes || []).forEach(n => {
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
              pts.push([n.x - 50, n.y - 50]);
              pts.push([n.x + 50, n.y + 50]);
              pts.push([n.x - 50, n.y + 50]);
              pts.push([n.x + 50, n.y - 50]);
            });

            const hull = polygonHull(pts);
            if (hull) {
              const colorObj = THEME.nebula.colors[parseInt(commId, 10) % THEME.nebula.colors.length];
              nebulaLayer.moveTo(hull[0][0], hull[0][1]);
              for (let i = 1; i < hull.length; i++) nebulaLayer.lineTo(hull[i][0], hull[i][1]);
              nebulaLayer.closePath();
              nebulaLayer.fill({ color: hexToNumber(colorObj.fill), alpha: THEME.nebula.fillOpacity });
              nebulaLayer.stroke({ color: hexToNumber(colorObj.stroke), alpha: THEME.nebula.strokeOpacity, width: 40 });
            }
          });
        }

        // B. Edges & Traveling Photons
        edgeLayer.clear();
        photonLayer.clear();
        (simDataRef.current.edges || []).forEach(edge => {
          const sx = edge.source?.x ?? edge.source;
          const sy = edge.source?.y ?? edge.source;
          const tx = edge.target?.x ?? edge.target;
          const ty = edge.target?.y ?? edge.target;
          if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return;

          const isCall = edge.type === 'call';
          const isRayActive = currentActiveRay?.activeE?.has(edge.id);
          const isDimmed = currentActiveRay && !isRayActive;

          let color = hexToNumber(isCall ? THEME.edges.call : THEME.edges.hierarchy);
          let alpha = isDimmed ? THEME.edges.opacityDimmed : THEME.edges.opacityNormal;
          let width = isCall ? THEME.edges.widthCall : THEME.edges.widthHierarchy;

          if (isRayActive) {
            color = hexToNumber(isCall ? THEME.edges.callGlow : THEME.edges.hierarchyGlow);
            alpha = 1.0;
            width = THEME.edges.widthHoverGlow;
          }

          edgeLayer.moveTo(sx, sy);
          edgeLayer.lineTo(tx, ty);
          edgeLayer.stroke({ width, color, alpha });

          // Stream travelling energy photons for call edges
          if (isCall && !isDimmed) {
            const pProgress = ((frameCount * 0.02) % 1.0);
            const px = sx + (tx - sx) * pProgress;
            const py = sy + (ty - sy) * pProgress;
            photonLayer.circle(px, py, 3);
            photonLayer.fill({ color: 0x38bdf8, alpha: 0.9 });
          }
        });

        // C. Update Node Transforms & Text
        const showLabels = zoom > LOD.LABELS.file;
        (simDataRef.current.nodes || []).forEach(node => {
          const obj = spriteMap.get(node.id);
          if (!obj || isNaN(node.x) || isNaN(node.y)) return;

          obj.sprite.x = node.x;
          obj.sprite.y = node.y;
          obj.label.x = node.x;
          obj.label.y = node.y + obj.baseSize + 4;
          obj.label.visible = showLabels;

          const isRayActive = currentActiveRay?.activeN?.has(node.id);
          const isDimmed = currentActiveRay && !isRayActive;

          obj.sprite.alpha = isDimmed ? 0.08 : 1.0;
          obj.label.alpha = isDimmed ? 0.08 : 1.0;

          if (isRayActive) {
            obj.sprite.tint = 0x60a5fa; // Electric focus glow
          } else {
            obj.sprite.tint = obj.color;
          }
        });
      });
    };

    initCanvas();

    const ro = new ResizeObserver(() => {
      if (containerRef.current && appRef.current?.renderer) {
        appRef.current.renderer.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      isMounted = false;
      ro.disconnect();
      appRef.current?.destroy(true, { children: true, texture: true });
    };
  }, [simDataRef]);

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none" />;
}
