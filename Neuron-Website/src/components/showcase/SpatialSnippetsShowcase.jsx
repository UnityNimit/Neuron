import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { ScrollWriteHeading } from '../ScrollReveal';
import { polygonHull } from '../../utils/polygonHull';

// =========================================================================
// NEURON FEATURE SHOWCASE: 3 DEDICATED LEFT/RIGHT INTERACTIVE SECTIONS
// -------------------------------------------------------------------------
// Feature 1: Critical Hotspot Detection (Bullet line trajectory -> ball turns red)
// Feature 2: Interactive Coupling (Drag to connect, one critical blocked node)
// Feature 3: Deep Code Inspection (Zoomed node with live code summary card)
//
// Rules strictly enforced:
// - NO "SPATIAL OBSERVABILITY" kicker text anywhere
// - NO zoom percentage labels ("remov eht xxoom thing")
// - NO word "telemetry" anywhere
// - NO "Neuron v0.9.4"
// - NO green dots in headers
// - Bottom trays: "OUTPUT" and "powershell" only with clean PS prompt (no text walls)
// - Realistic file names (ast_scanner.py, etc.)
// - Solid colors: crisp yellow (#facc15), blue (#38bdf8), red (#ef4444) without blurry glowing bloom
// =========================================================================

// -------------------------------------------------------------------------
// COMPONENT 1: CRITICAL HOTSPOT DETECTION
// -------------------------------------------------------------------------
function HotspotDetectionBox() {
  const [activeTab, setActiveTab] = useState('powershell');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const nodesRef = useRef([]);
  const draggedNodeRef = useRef(null);
  const hoveredNodeRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startTimeRef = useRef(performance.now());
  const isVisibleRef = useRef(false);

  // Scroll-triggered activation: animation triggers only when user scrolls on it
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisibleRef.current = true;
            startTimeRef.current = performance.now();
          } else {
            isVisibleRef.current = false;
          }
        });
      },
      { threshold: 0.20 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 420;
    const cy = height * 0.50;

    // GIGANTIC Yellow Folder Sun (Affixated / pinned permanently at the left edge of the box)
    const folderNode = {
      id: 'folder_core',
      label: 'core',
      type: 'folder',
      radius: 68, // Biggest ball in the box!
      color: '#facc15',
      x: 55, // Anchored at the left edge of the box
      y: cy,
      baseX: 55,
      baseY: cy,
      isFixed: true, // AFFIXATED - Immovable
      vx: 0,
      vy: 0,
      seedX: 14,
      seedY: 28
    };

    // Authentic satellite files: 2 blue balls + 1 target red ball (parser.py hotspot)
    const files = [
      { name: 'parser.py', relX: 320, relY: -10, radius: 30, isTarget: true },
      { name: 'mutator.py', relX: 200, relY: -95, radius: 24, isTarget: false },
      { name: 'state.py', relX: 190, relY: 95, radius: 24, isTarget: false }
    ];

    const childNodes = files.map((f, idx) => {
      const tx = folderNode.x + f.relX;
      const ty = folderNode.y + f.relY;
      return {
        id: `file_${idx}`,
        label: f.name,
        type: 'file',
        radius: f.radius, // All balls are huge!
        color: '#38bdf8',
        isTarget: f.isTarget,
        x: tx,
        y: ty,
        baseX: tx,
        baseY: ty,
        restDist: Math.hypot(f.relX, f.relY),
        vx: 0,
        vy: 0,
        seedX: 30 + idx * 17,
        seedY: 50 + idx * 23
      };
    });

    nodesRef.current = [folderNode, ...childNodes];
    startTimeRef.current = performance.now();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prevTime = performance.now();

    const render = (now) => {
      prevTime = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep space canvas background
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid coordinate lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        animFrameRef.current = requestAnimationFrame(render);
        ctx.restore();
        return;
      }

      const folder = nodes[0];
      const satellites = nodes.slice(1);

      // Red ball slowly turning red animation (only triggers when user scrolls onto the box)
      const loopTime = 6500;
      const elapsed = isVisibleRef.current ? ((now - startTimeRef.current) % loopTime) : 0;
      let ballRedProgress = 0;

      if (isVisibleRef.current) {
        if (elapsed >= 1000 && elapsed < 3500) {
          // Slowly turning red
          const u = (elapsed - 1000) / 2500;
          ballRedProgress = 1 - Math.pow(1 - u, 2.2);
        } else if (elapsed >= 3500 && elapsed < 5500) {
          // Deep solid red
          ballRedProgress = 1.0;
        } else if (elapsed >= 5500) {
          // Return to blue
          const u = (elapsed - 5500) / 1000;
          ballRedProgress = 1.0 - u;
        }
      }

      // Physics update (folder is affixated at edge, satellite files can be dragged)
      nodes.forEach(node => {
        if (node.isFixed) {
          node.x = node.baseX;
          node.y = node.baseY;
          node.vx = 0;
          node.vy = 0;
          return;
        }

        if (draggedNodeRef.current?.id === node.id) return;

        const dx = node.x - folder.x;
        const dy = node.y - folder.y;
        const dist = Math.hypot(dx, dy) || 1;
        const delta = dist - node.restDist;
        node.vx -= (dx / dist) * delta * 0.035;
        node.vy -= (dy / dist) * delta * 0.035;

        if (isVisibleRef.current) {
          node.vx += Math.sin(now * 0.0012 + node.seedX) * 0.02;
          node.vy += Math.cos(now * 0.0010 + node.seedY) * 0.02;
        }
        node.vx *= 0.88;
        node.vy *= 0.88;
        node.x += node.vx;
        node.y += node.vy;
      });

      // Atmospheric Cosmic Background Gradients behind the balls (just like main graph)
      const targetSat = satellites.find(s => s.isTarget) || satellites[0];
      if (targetSat) {
        const redGrad = ctx.createRadialGradient(targetSat.x, targetSat.y, 15, targetSat.x, targetSat.y, 185);
        redGrad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
        redGrad.addColorStop(0.50, 'rgba(220, 38, 38, 0.08)');
        redGrad.addColorStop(0.80, 'rgba(185, 28, 28, 0.02)');
        redGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = redGrad;
        ctx.beginPath();
        ctx.arc(targetSat.x, targetSat.y, 185, 0, Math.PI * 2);
        ctx.fill();
      }

      const yelGrad = ctx.createRadialGradient(folder.x, folder.y, 25, folder.x, folder.y, 195);
      yelGrad.addColorStop(0, 'rgba(250, 204, 21, 0.20)');
      yelGrad.addColorStop(0.50, 'rgba(250, 204, 21, 0.07)');
      yelGrad.addColorStop(0.80, 'rgba(250, 204, 21, 0.015)');
      yelGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = yelGrad;
      ctx.beginPath();
      ctx.arc(folder.x, folder.y, 195, 0, Math.PI * 2);
      ctx.fill();

      // Draw Conduit Lines (clean conduits, no laser shooting)
      satellites.forEach(sat => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(folder.x, folder.y);
        ctx.lineTo(sat.x, sat.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
      });

      // Draw Satellite File Balls (Huge balls)
      satellites.forEach(sat => {
        ctx.save();
        let fillColor = sat.color;
        if (sat.isTarget && ballRedProgress > 0) {
          const r = Math.round(56 + (239 - 56) * ballRedProgress);
          const g = Math.round(189 + (68 - 189) * ballRedProgress);
          const b = Math.round(248 + (68 - 248) * ballRedProgress);
          fillColor = `rgb(${r}, ${g}, ${b})`;
        }

        // Clean solid vector disc (NO double border)
        ctx.beginPath();
        ctx.arc(sat.x, sat.y, sat.radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.restore();
      });

      // Draw Gigantic Affixated Simple Yellow Ball at the Edge of the Box
      ctx.save();
      ctx.beginPath();
      ctx.arc(folder.x, folder.y, folder.radius, 0, Math.PI * 2);
      ctx.fillStyle = folder.color;
      ctx.fill();
      ctx.restore();

      if (isVisible) {
        animFrameRef.current = requestAnimationFrame(render);
      }
      ctx.restore();
    };

    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = requestAnimationFrame(render);
        }
      });
    }, { rootMargin: '120px 0px 120px 0px' });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.isFixed) continue; // Yellow ball is affixated - cannot be dragged!
      if (Math.hypot(node.x - mx, node.y - my) <= node.radius + 8) {
        draggedNodeRef.current = node;
        isDraggingRef.current = true;
        break;
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDraggingRef.current && draggedNodeRef.current) {
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    const nodes = nodesRef.current;
    let found = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (Math.hypot(nodes[i].x - mx, nodes[i].y - my) <= nodes[i].radius + 8) {
        found = nodes[i];
        break;
      }
    }
    hoveredNodeRef.current = found;
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      {/* Left Column: Single Heading (matching chatbot layout) */}
      <div className="lg:col-span-5 flex flex-col justify-center select-none text-left">
        <ScrollWriteHeading
          text="Critical Hotspot Detection"
          as="h2"
          className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-sans leading-tight"
        />
      </div>

      {/* Right Column: Interactive Box (as big as chatbot box: h-[460px] sm:h-[480px]) */}
      <div className="lg:col-span-7 w-full">
        <div className="w-full bg-[#08090c] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[460px] sm:h-[480px] relative font-sans text-left">
          {/* Header */}
          <div className="h-9 bg-[#0e1017] border-b border-white/[0.08] px-4 flex items-center justify-between text-xs text-slate-400 select-none shrink-0">
            <span className="text-slate-300 font-mono text-[11px] font-medium">
              Critical Hotspot Detection
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500">core</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">parser.py</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 w-full relative overflow-hidden bg-[#08090c]">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
            />
          </div>

          {/* Bottom Tray */}
          <div className="h-20 bg-[#090b10] border-t border-white/[0.08] flex flex-col shrink-0 select-none">
            <div className="h-6 bg-[#0c0e14] border-b border-white/[0.06] px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('OUTPUT')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'OUTPUT' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <Terminal size={10} />
                  <span>OUTPUT</span>
                </button>
                <button
                  onClick={() => setActiveTab('powershell')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'powershell' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <span>powershell</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-2.5 font-mono text-[11px] text-slate-300 flex items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">PS C:\Neuron\core&gt;</span>
                <span className="text-amber-400/90 text-[10.5px]">parser.py: high cyclomatic risk detected</span>
                <span className="w-1.5 h-3 bg-[#38bdf8] animate-pulse inline-block" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT 2: INTERACTIVE COUPLING (Connecting balls, critical node blocked)
// -------------------------------------------------------------------------
function InteractiveCouplingBox() {
  const [activeTab, setActiveTab] = useState('powershell');
  const [showHarmfulPopup, setShowHarmfulPopup] = useState(false);
  const showHarmfulPopupRef = useRef(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const shockwavesRef = useRef([]);
  const dragConnectRef = useRef({
    isConnecting: false,
    fromNode: null,
    currentPos: { x: 0, y: 0 },
    hoverTarget: null,
    isBlockedTarget: false
  });
  const startTimeRef = useRef(performance.now());
  const isVisibleRef = useRef(false);

  // Scroll-triggered activation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisibleRef.current = true;
            startTimeRef.current = performance.now();
          } else {
            isVisibleRef.current = false;
            setShowHarmfulPopup(false);
            showHarmfulPopupRef.current = false;
          }
        });
      },
      { threshold: 0.20 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 420;
    const cx = width * 0.48;
    const cy = height * 0.50;

    // Authentic Yellow Folder Hubs from Neuron
    const yellowHub1 = {
      id: 'dir_frontend',
      label: 'frontend',
      type: 'folder',
      radius: 46,
      color: '#facc15',
      x: cx - 145,
      y: cy - 20,
      vx: 0,
      vy: 0,
      seedX: 11,
      seedY: 21
    };

    const yellowHub2 = {
      id: 'dir_backend',
      label: 'backend',
      type: 'folder',
      radius: 46,
      color: '#facc15',
      x: cx + 145,
      y: cy + 20,
      vx: 0,
      vy: 0,
      seedX: 33,
      seedY: 44
    };

    // Authentic Blue Satellite Files matching Neuron codebase
    const blueNodes = [
      // Left: Frontend Cluster
      { id: 'f_ws', label: 'useWorkspace.js', x: cx - 75, y: cy - 95, radius: 21, color: '#38bdf8', parent: 'dir_frontend', seedX: 12, seedY: 14 },
      { id: 'f_phys', label: 'usePhysicsEngine.js', x: cx - 225, y: cy - 70, radius: 21, color: '#38bdf8', parent: 'dir_frontend', seedX: 18, seedY: 22 },
      { id: 'f_editor', label: 'CodeEditor.jsx', x: cx - 200, y: cy + 85, radius: 21, color: '#38bdf8', parent: 'dir_frontend', seedX: 25, seedY: 31 },
      { id: 'f_term', label: 'TerminalPanel.jsx', x: cx - 110, y: cy + 105, radius: 19, color: '#38bdf8', parent: 'dir_frontend', seedX: 29, seedY: 36 },
      { id: 'f_app', label: 'App.jsx', x: cx - 245, y: cy + 15, radius: 19, color: '#38bdf8', parent: 'dir_frontend', seedX: 34, seedY: 42 },
      { id: 'f_top', label: 'TopBar.jsx', x: cx - 155, y: cy - 110, radius: 19, color: '#38bdf8', parent: 'dir_frontend', seedX: 39, seedY: 47 },

      // Right: Backend Cluster
      { id: 'b_ws', label: 'websocket_router.py', x: cx + 75, y: cy + 95, radius: 21, color: '#38bdf8', parent: 'dir_backend', seedX: 51, seedY: 58 },
      { id: 'b_parser', label: 'parser.py', x: cx + 225, y: cy + 70, radius: 21, color: '#38bdf8', parent: 'dir_backend', seedX: 56, seedY: 63 },
      { id: 'b_state', label: 'state.py', x: cx + 195, y: cy - 80, radius: 21, color: '#38bdf8', parent: 'dir_backend', seedX: 62, seedY: 69 },
      { id: 'b_analyzer', label: 'analyzer.py', x: cx + 115, y: cy - 105, radius: 19, color: '#38bdf8', parent: 'dir_backend', seedX: 67, seedY: 74 },
      { id: 'b_ai', label: 'ai_service.py', x: cx + 250, y: cy - 10, radius: 19, color: '#38bdf8', parent: 'dir_backend', seedX: 72, seedY: 79 },
      { id: 'b_term', label: 'terminal_service.py', x: cx + 155, y: cy + 115, radius: 19, color: '#38bdf8', parent: 'dir_backend', seedX: 77, seedY: 84 }
    ];

    // ONE Critical Node: mutator.py (Direct AST mutation rejected by CSP Guard)
    const criticalNode = {
      id: 'b_mutator',
      label: 'mutator.py',
      type: 'critical',
      radius: 23,
      color: '#ef4444',
      isCritical: true,
      x: cx,
      y: cy - 10,
      vx: 0,
      vy: 0,
      seedX: 88,
      seedY: 99
    };

    const initialLinks = [
      { source: 'dir_frontend', target: 'f_ws' },
      { source: 'dir_frontend', target: 'f_phys' },
      { source: 'dir_frontend', target: 'f_editor' },
      { source: 'dir_frontend', target: 'f_term' },
      { source: 'dir_frontend', target: 'f_app' },
      { source: 'dir_frontend', target: 'f_top' },
      { source: 'dir_backend', target: 'b_ws' },
      { source: 'dir_backend', target: 'b_parser' },
      { source: 'dir_backend', target: 'b_state' },
      { source: 'dir_backend', target: 'b_analyzer' },
      { source: 'dir_backend', target: 'b_ai' },
      { source: 'dir_backend', target: 'b_term' }
    ];

    nodesRef.current = [yellowHub1, yellowHub2, ...blueNodes, criticalNode];
    linksRef.current = initialLinks;
    startTimeRef.current = performance.now();
  }, []);

  // 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastShockwaveTime = 0;

    const render = (now) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep space canvas background
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map();
      nodes.forEach(n => nodeMap.set(n.id, n));

      // Automated joining demonstration when user is idle
      const loopTime = 3200;
      const elapsed = isVisibleRef.current ? ((now - startTimeRef.current) % loopTime) : 0;
      let isAutoDemo = !dragConnectRef.current.isConnecting && isVisibleRef.current;

      const originNode = nodeMap.get('f_ws') || nodes[2];
      const critNode = nodeMap.get('b_mutator');

      // Check for blocked coupling attempt to trigger "Harmful Coupling" popup
      const isAutoBlocked = isAutoDemo && (elapsed >= 1700 && elapsed < 2650);
      const isUserBlocked = dragConnectRef.current.isConnecting && dragConnectRef.current.isBlockedTarget;
      const shouldShowBlocked = isVisibleRef.current && (isAutoBlocked || isUserBlocked);

      if (shouldShowBlocked !== showHarmfulPopupRef.current) {
        showHarmfulPopupRef.current = shouldShowBlocked;
        setShowHarmfulPopup(shouldShowBlocked);
      }

      // Trigger CSP rejection shockwave
      if (shouldShowBlocked && critNode && now - lastShockwaveTime > 600) {
        lastShockwaveTime = now;
        shockwavesRef.current.push({
          x: critNode.x,
          y: critNode.y,
          radius: 20,
          maxRadius: 180,
          alpha: 1.0
        });
      }

      // Physics micro-drift
      if (isVisibleRef.current) {
        nodes.forEach(node => {
          node.vx += Math.sin(now * 0.0012 + (node.seedX || 0)) * 0.015;
          node.vy += Math.cos(now * 0.0010 + (node.seedY || 0)) * 0.015;
          node.vx *= 0.88;
          node.vy *= 0.88;
          node.x += node.vx;
          node.y += node.vy;
        });
      }

      // Atmospheric Cosmic Background Gradients behind the clusters
      const hubFrontend = nodeMap.get('dir_frontend');
      const hubBackend = nodeMap.get('dir_backend');
      if (hubFrontend) {
        const gradFrontend = ctx.createRadialGradient(hubFrontend.x, hubFrontend.y, 20, hubFrontend.x, hubFrontend.y, 185);
        gradFrontend.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
        gradFrontend.addColorStop(0.50, 'rgba(6, 182, 212, 0.07)');
        gradFrontend.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = gradFrontend;
        ctx.beginPath();
        ctx.arc(hubFrontend.x, hubFrontend.y, 185, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hubBackend) {
        const gradBackend = ctx.createRadialGradient(hubBackend.x, hubBackend.y, 20, hubBackend.x, hubBackend.y, 185);
        gradBackend.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
        gradBackend.addColorStop(0.50, 'rgba(56, 189, 248, 0.07)');
        gradBackend.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = gradBackend;
        ctx.beginPath();
        ctx.arc(hubBackend.x, hubBackend.y, 185, 0, Math.PI * 2);
        ctx.fill();
      }

      if (critNode) {
        const gradCrit = ctx.createRadialGradient(critNode.x, critNode.y, 10, critNode.x, critNode.y, 110);
        gradCrit.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
        gradCrit.addColorStop(0.50, 'rgba(239, 68, 68, 0.06)');
        gradCrit.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = gradCrit;
        ctx.beginPath();
        ctx.arc(critNode.x, critNode.y, 110, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render CSP Rejection Expanding Shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 4.5;
        sw.alpha -= 0.024;
        if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
          shockwavesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${sw.alpha * 0.85})`;
        ctx.lineWidth = 3.0;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Existing Links
      links.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (!s || !t) return;

        if (l.isLaserBridge) {
          // Cyan Laser Bridge with Wide Neon Aura
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.20)';
          ctx.lineWidth = 8.0;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Stream 2 Traveling High-Speed Photons
          for (let pIdx = 0; pIdx < 2; pIdx++) {
            const photonT = ((now * 0.0018) + (pIdx * 0.5)) % 1.0;
            const px = s.x + (t.x - s.x) * photonT;
            const py = s.y + (t.y - s.y) * photonT;

            ctx.beginPath();
            ctx.arc(px, py, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 240, 255, 0.40)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(px, py, 3.0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = l.isCoupled ? '#00f0ff' : 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = l.isCoupled ? 2.2 : 1.2;
          ctx.stroke();
        }
      });

      // Automated Demo: Repeatedly attempts to connect to mutator.py, recoiling upon CSP rejection
      if (isAutoDemo && originNode && critNode) {
        if (elapsed >= 300 && elapsed < 2100) {
          // Tether reaching out towards mutator.py
          const u = (elapsed - 300) / 1800;
          const p = 1 - Math.pow(1 - u, 2.2);
          const curX = originNode.x + (critNode.x - originNode.x) * p;
          const curY = originNode.y + (critNode.y - originNode.y) * p;
          const isNearCrit = u > 0.75;

          ctx.beginPath();
          ctx.moveTo(originNode.x, originNode.y);
          ctx.lineTo(curX, curY);
          ctx.strokeStyle = isNearCrit ? '#ef4444' : '#00f0ff';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = isNearCrit ? '#ef4444' : '#00f0ff';
          ctx.fill();
        } else if (elapsed >= 2100 && elapsed < 2650) {
          // Rejection recoil / snap back
          const u = (elapsed - 2100) / 550;
          const recoilProgress = 1.0 - Math.pow(u, 2.2);
          const curX = originNode.x + (critNode.x - originNode.x) * recoilProgress;
          const curY = originNode.y + (critNode.y - originNode.y) * recoilProgress;

          ctx.beginPath();
          ctx.moveTo(originNode.x, originNode.y);
          ctx.lineTo(curX, curY);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
        }
      }

      // Draw User Live Interactive Dragging Tether
      if (dragConnectRef.current.isConnecting && dragConnectRef.current.fromNode) {
        const from = dragConnectRef.current.fromNode;
        const cur = dragConnectRef.current.currentPos;
        const isBlocked = dragConnectRef.current.isBlockedTarget;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.strokeStyle = isBlocked ? '#ef4444' : '#00f0ff';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tether bead
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = isBlocked ? '#ef4444' : '#00f0ff';
        ctx.fill();
        ctx.restore();
      }

      // Draw Nodes
      nodes.forEach(node => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.restore();
      });

      if (isVisible) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = requestAnimationFrame(render);
        }
      });
    }, { rootMargin: '120px 0px 120px 0px' });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // User Drag & Connect Interaction
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (Math.hypot(node.x - mx, node.y - my) <= node.radius + 8) {
        dragConnectRef.current.isConnecting = true;
        dragConnectRef.current.fromNode = node;
        dragConnectRef.current.currentPos = { x: mx, y: my };
        dragConnectRef.current.isBlockedTarget = node.isCritical || false;
        break;
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragConnectRef.current.isConnecting) {
      dragConnectRef.current.currentPos = { x: mx, y: my };

      const nodes = nodesRef.current;
      const from = dragConnectRef.current.fromNode;
      let target = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.id !== from?.id && Math.hypot(n.x - mx, n.y - my) <= n.radius + 12) {
          target = n;
          break;
        }
      }
      dragConnectRef.current.hoverTarget = target;
      // Prohibit connection in BOTH directions if either from or target is critical!
      dragConnectRef.current.isBlockedTarget = Boolean(from?.isCritical || target?.isCritical);
    }
  };

  const handleMouseUp = () => {
    if (dragConnectRef.current.isConnecting) {
      const target = dragConnectRef.current.hoverTarget;
      const from = dragConnectRef.current.fromNode;

      if (target && from && target.id !== from.id) {
        // Disallow coupling if either node is critical!
        const isBlocked = from.isCritical || target.isCritical;
        if (!isBlocked) {
          const isLaser = (from.id === 'f_ws' && target.id === 'b_ws') || (from.id === 'b_ws' && target.id === 'f_ws');
          linksRef.current.push({
            source: from.id,
            target: target.id,
            isCoupled: true,
            isLaserBridge: isLaser
          });
        }
      }
    }

    dragConnectRef.current.isConnecting = false;
    dragConnectRef.current.fromNode = null;
    dragConnectRef.current.hoverTarget = null;
    dragConnectRef.current.isBlockedTarget = false;
  };

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      {/* Box on Left on desktop (order-2 on mobile, lg:order-1 on desktop) */}
      <div className="lg:col-span-7 w-full order-2 lg:order-1">
        <div className="w-full bg-[#08090c] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[460px] sm:h-[480px] relative font-sans text-left">
          {/* Header */}
          <div className="h-9 bg-[#0e1017] border-b border-white/[0.08] px-4 flex items-center justify-between text-xs text-slate-400 select-none shrink-0">
            <span className="text-slate-300 font-mono text-[11px] font-medium">
              Interactive Coupling
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500">topology</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">laser_conduits</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 w-full relative overflow-hidden bg-[#08090c]">
            {/* CSP Guard Blocked Coupling Alert Badge */}
            {showHarmfulPopup && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#18080a]/95 border border-red-500/40 text-red-200 text-xs font-mono shadow-lg shadow-red-950/50 backdrop-blur-sm transition-all duration-150 animate-in fade-in">
                <ShieldAlert size={14} className="text-red-400 shrink-0" />
                <span>CSP Guard: Direct Mutation Blocked. Must route via websocket_router.py</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full block touch-none cursor-crosshair"
            />
          </div>

          {/* Bottom Tray */}
          <div className="h-20 bg-[#090b10] border-t border-white/[0.08] flex flex-col shrink-0 select-none">
            <div className="h-6 bg-[#0c0e14] border-b border-white/[0.06] px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('OUTPUT')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'OUTPUT' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <Terminal size={10} />
                  <span>OUTPUT</span>
                </button>
                <button
                  onClick={() => setActiveTab('powershell')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'powershell' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <span>powershell</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-2.5 font-mono text-[11px] text-slate-300 flex items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">PS C:\Neuron\coupling&gt;</span>
                <span className="text-emerald-400 text-[10.5px]">conduit_guard: active (laser bridge ready)</span>
                <span className="w-1.5 h-3 bg-[#38bdf8] animate-pulse inline-block" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heading on Right on desktop (order-1 on mobile, lg:order-2 on desktop) */}
      <div className="lg:col-span-5 flex flex-col justify-center select-none text-left order-1 lg:order-2">
        <ScrollWriteHeading
          text="Interactive Coupling"
          as="h2"
          className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-sans leading-tight"
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT 3: DEEP CODE INSPECTION (Click to inspect, focused ball highlights, others dull)
// -------------------------------------------------------------------------
const INSPECTION_NODES_DATA = [
  {
    id: 'parser',
    label: 'parser.py',
    path: 'backend/core/parser.py',
    relX: 0,
    relY: 0,
    radius: 26,
    color: '#38bdf8',
    community: 0,
    metrics: {
      community: 'Community 0 (Core Backend)',
      entropy: '4.82 bits',
      pagerank: '0.048',
      betweenness: '0.035',
      fanInOut: 'In: 4 | Out: 7'
    },
    codeSnippet: [
      'def parse_ast(self, content: str):',
      '    tree = ast.parse(content)',
      '    return self.extract_symbols(tree)'
    ]
  },
  {
    id: 'mutator',
    label: 'mutator.py',
    path: 'backend/core/mutator.py',
    relX: -92,
    relY: -68,
    radius: 21,
    color: '#38bdf8',
    community: 0,
    metrics: {
      community: 'Community 0 (Core Backend)',
      entropy: '4.15 bits',
      pagerank: '0.032',
      betweenness: '0.021',
      fanInOut: 'In: 3 | Out: 5'
    },
    codeSnippet: [
      'def apply_refactor(self, mutation):',
      '    self.backup_state()',
      '    return self.execute_ast_transform(mutation)'
    ]
  },
  {
    id: 'state',
    label: 'state.py',
    path: 'backend/core/state.py',
    relX: -85,
    relY: 75,
    radius: 20,
    color: '#38bdf8',
    community: 0,
    metrics: {
      community: 'Community 0 (Core Backend)',
      entropy: '3.62 bits',
      pagerank: '0.028',
      betweenness: '0.019',
      fanInOut: 'In: 5 | Out: 2'
    },
    codeSnippet: [
      'class WorkspaceState:',
      '    active_graph = {}',
      '    undo_stack = []'
    ]
  },
  {
    id: 'analyzer',
    label: 'analyzer.py',
    path: 'backend/ml/analyzer.py',
    relX: 86,
    relY: -72,
    radius: 22,
    color: '#a855f7',
    community: 1,
    metrics: {
      community: 'Community 1 (Graph ML)',
      entropy: '4.95 bits',
      pagerank: '0.065',
      betweenness: '0.058',
      fanInOut: 'In: 6 | Out: 8'
    },
    codeSnippet: [
      'def analyze_graph_ml(nodes, edges):',
      '    communities = louvain_communities(G)',
      '    return {"communities": communities}'
    ]
  },
  {
    id: 'router',
    label: 'websocket_router.py',
    path: 'backend/api/websocket_router.py',
    relX: 92,
    relY: 68,
    radius: 21,
    color: '#38bdf8',
    community: 0,
    metrics: {
      community: 'Community 0 (Core Backend)',
      entropy: '3.91 bits',
      pagerank: '0.041',
      betweenness: '0.031',
      fanInOut: 'In: 2 | Out: 6'
    },
    codeSnippet: [
      'async def ws_handler(websocket):',
      '    async for msg in websocket:',
      '        await dispatch_action(msg)'
    ]
  }
];

const INSPECTION_LINKS = [
  { source: 'mutator', target: 'parser' },
  { source: 'parser', target: 'state' },
  { source: 'parser', target: 'router' },
  { source: 'mutator', target: 'analyzer' },
  { source: 'analyzer', target: 'parser' }
];

function DeepCodeInspectionBox() {
  const [activeTab, setActiveTab] = useState('powershell');
  const [activeFile, setActiveFile] = useState('parser.py');
  const [isHoveringBall, setIsHoveringBall] = useState(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const focusedIdRef = useRef('parser');
  const userClickedRef = useRef(false);
  const camXRef = useRef(0);
  const camYRef = useRef(0);
  const zoomRef = useRef(1.0);
  const cardAlphaRef = useRef(0);
  const isVisibleRef = useRef(false);

  // Dragging support: balls only move when touched/dragged!
  const draggedNodeRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Scroll-triggered activation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisibleRef.current = true;
          } else {
            isVisibleRef.current = false;
          }
        });
      },
      { threshold: 0.20 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isFirst = true;

    const render = (now) => {
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 420;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep space background
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const baseCx = width * 0.28;
      const baseCy = height * 0.50;

      // Nodes do not move on their own - only when touched or dragged!
      const nodes = INSPECTION_NODES_DATA.map(f => ({
        ...f,
        x: baseCx + f.relX,
        y: baseCy + f.relY
      }));
      const nodeMap = new Map();
      nodes.forEach(n => nodeMap.set(n.id, n));

      const focusedNode = nodeMap.get(focusedIdRef.current) || nodes[0];

      if (isFirst) {
        camXRef.current = focusedNode.x;
        camYRef.current = focusedNode.y;
        zoomRef.current = 1.75;
        cardAlphaRef.current = 1.0;
        isFirst = false;
      }

      // Smooth camera lerp to centered focused node
      const targetCamX = focusedNode.x;
      const targetCamY = focusedNode.y;
      const targetZoom = 1.75;

      camXRef.current += (targetCamX - camXRef.current) * 0.085;
      camYRef.current += (targetCamY - camYRef.current) * 0.085;
      zoomRef.current += (targetZoom - zoomRef.current) * 0.085;
      cardAlphaRef.current += (1.0 - cardAlphaRef.current) * 0.1;

      const screenTargetX = width * 0.26;
      const screenTargetY = height * 0.50;

      ctx.save();
      ctx.translate(screenTargetX, screenTargetY);
      ctx.scale(zoomRef.current, zoomRef.current);
      ctx.translate(-camXRef.current, -camYRef.current);

      // 1. Render Louvain Modularity Convex Hull Nebula behind the cluster
      const pts = [];
      const pad = 85;
      nodes.forEach(n => {
        pts.push([n.x - pad, n.y - pad]);
        pts.push([n.x + pad, n.y - pad]);
        pts.push([n.x - pad, n.y + pad]);
        pts.push([n.x + pad, n.y + pad]);
      });
      const hull = polygonHull(pts);
      if (hull) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(hull[0][0], hull[0][1]);
        for (let idx = 1; idx < hull.length; idx++) {
          ctx.lineTo(hull[idx][0], hull[idx][1]);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
        ctx.fill();
        ctx.lineWidth = 75;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Conduits between nodes (Incident edges to focused node highlighted)
      INSPECTION_LINKS.forEach(link => {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (!s || !t) return;
        const isLinkedToFocus = s.id === focusedNode.id || t.id === focusedNode.id;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = isLinkedToFocus ? 'rgba(0, 240, 255, 0.90)' : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = (isLinkedToFocus ? 2.5 : 0.8) / zoomRef.current;
        ctx.stroke();
      });

      // 3. Draw Nodes (Focused ball highlights with crisp vector aura, others dim to 0.04)
      nodes.forEach(n => {
        const isFocused = n.id === focusedNode.id;
        ctx.save();

        if (isFocused) {
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.fill();

          // Focused node label
          ctx.font = '600 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + n.radius + 12 / zoomRef.current);
        } else {
          // Dimmed non-focused node (matching opacityDimmed 0.04 law)
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = n.color;
          ctx.fill();

          ctx.font = '400 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + n.radius + 11 / zoomRef.current);
        }

        ctx.restore();
      });

      ctx.restore();

      // 4. Draw Official ML Telemetry Card for the Focused Ball
      if (cardAlphaRef.current > 0.05) {
        ctx.save();
        ctx.globalAlpha = cardAlphaRef.current;

        const cardX = Math.max(width * 0.44, 250);
        const cardY = height * 0.12;
        const cardW = Math.min(width * 0.52, 310);
        const cardH = 190;

        // Card backdrop
        ctx.fillStyle = 'rgba(10, 13, 20, 0.94)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();

        // Card header
        ctx.fillStyle = '#00f0ff';
        ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText('ML TELEMETRY · ' + focusedNode.metrics.community.toUpperCase(), cardX + 14, cardY + 20);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(focusedNode.path, cardX + 14, cardY + 36);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(cardX + 14, cardY + 44);
        ctx.lineTo(cardX + cardW - 14, cardY + 44);
        ctx.stroke();

        // ML Telemetry Grid
        ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Entropy: ${focusedNode.metrics.entropy}`, cardX + 14, cardY + 62);
        ctx.fillText(`PageRank: ${focusedNode.metrics.pagerank}`, cardX + 150, cardY + 62);
        ctx.fillText(`Betweenness: ${focusedNode.metrics.betweenness}`, cardX + 14, cardY + 78);
        ctx.fillText(`Degree: ${focusedNode.metrics.fanInOut}`, cardX + 150, cardY + 78);

        // AST Code Snippet Box
        ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.roundRect(cardX + 14, cardY + 92, cardW - 28, 84, 5);
        ctx.fill();
        ctx.stroke();

        ctx.font = '400 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        focusedNode.codeSnippet.forEach((line, idx) => {
          ctx.fillStyle = idx === 0 ? '#c084fc' : (idx === 1 ? '#e2e8f0' : '#4ade80');
          ctx.fillText(line, cardX + 22, cardY + 112 + idx * 18);
        });

        ctx.restore();
      }

      if (isVisible) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = requestAnimationFrame(render);
        }
      });
    }, { rootMargin: '120px 0px 120px 0px' });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Pointer Click & Drag on Any Ball to Focus & Zoom
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const baseCx = width * 0.28;
    const baseCy = height * 0.50;
    const screenTargetX = width * 0.26;
    const screenTargetY = height * 0.50;

    const curZoom = zoomRef.current || 1.75;
    const curCamX = camXRef.current || baseCx;
    const curCamY = camYRef.current || baseCy;

    const wx = curCamX + (mx - screenTargetX) / curZoom;
    const wy = curCamY + (my - screenTargetY) / curZoom;

    for (let i = INSPECTION_NODES_DATA.length - 1; i >= 0; i--) {
      const f = INSPECTION_NODES_DATA[i];
      const nx = baseCx + f.relX;
      const ny = baseCy + f.relY;
      if (Math.hypot(nx - wx, ny - wy) <= f.radius + 12) {
        userClickedRef.current = true;
        focusedIdRef.current = f.id;
        setActiveFile(f.label);
        draggedNodeRef.current = f;
        isDraggingRef.current = true;
        break;
      }
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const baseCx = width * 0.28;
    const baseCy = height * 0.50;
    const screenTargetX = width * 0.26;
    const screenTargetY = height * 0.50;

    const curZoom = zoomRef.current || 1.75;
    const curCamX = camXRef.current || baseCx;
    const curCamY = camYRef.current || baseCy;

    const wx = curCamX + (mx - screenTargetX) / curZoom;
    const wy = curCamY + (my - screenTargetY) / curZoom;

    if (isDraggingRef.current && draggedNodeRef.current) {
      draggedNodeRef.current.relX = wx - baseCx;
      draggedNodeRef.current.relY = wy - baseCy;
      return;
    }

    let hit = false;
    for (let i = INSPECTION_NODES_DATA.length - 1; i >= 0; i--) {
      const f = INSPECTION_NODES_DATA[i];
      const nx = baseCx + f.relX;
      const ny = baseCy + f.relY;
      if (Math.hypot(nx - wx, ny - wy) <= f.radius + 12) {
        hit = true;
        break;
      }
    }
    setIsHoveringBall(hit);
  };

  const handlePointerUp = () => {
    draggedNodeRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      {/* Left Column: Heading with AI Summary */}
      <div className="lg:col-span-5 flex flex-col justify-center select-none text-left">
        <ScrollWriteHeading
          text="Deep Code Inspection"
          as="h2"
          className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-sans leading-tight"
        />
        <p className="text-sm sm:text-base text-slate-400 font-sans mt-2 tracking-normal">
          Interactive AST Topology & ML Telemetry
        </p>
      </div>

      {/* Right Column: Interactive Box */}
      <div className="lg:col-span-7 w-full">
        <div className="w-full bg-[#08090c] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[460px] sm:h-[480px] relative font-sans text-left">
          {/* Header */}
          <div className="h-9 bg-[#0e1017] border-b border-white/[0.08] px-4 flex items-center justify-between text-xs text-slate-400 select-none shrink-0">
            <span className="text-slate-300 font-mono text-[11px] font-medium">
              Deep Code Inspection: ML Telemetry
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500">core</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">{activeFile}</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 w-full relative overflow-hidden bg-[#08090c]">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`w-full h-full block touch-none ${isHoveringBall ? 'cursor-pointer' : 'cursor-default'}`}
            />
            <div className="absolute bottom-2.5 right-3 pointer-events-none text-[10px] font-mono text-slate-500/70 select-none">
              click any node to inspect
            </div>
          </div>

          {/* Bottom Tray */}
          <div className="h-20 bg-[#090b10] border-t border-white/[0.08] flex flex-col shrink-0 select-none">
            <div className="h-6 bg-[#0c0e14] border-b border-white/[0.06] px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('OUTPUT')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'OUTPUT' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <Terminal size={10} />
                  <span>OUTPUT</span>
                </button>
                <button
                  onClick={() => setActiveTab('powershell')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'powershell' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <span>powershell</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-2.5 font-mono text-[11px] text-slate-300 flex items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">PS C:\Neuron\inspect\{activeFile}&gt;</span>
                <span className="text-emerald-400 text-[10.5px]">ast_parsed: 58 symbols · 0 errors</span>
                <span className="w-1.5 h-3 bg-[#38bdf8] animate-pulse inline-block" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// COMPONENT 4: CLUSTER DETECTION (Official Louvain Community Modularity)
// -------------------------------------------------------------------------
function ClusterDetectionBox() {
  const [activeTab, setActiveTab] = useState('powershell');
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const draggedNodeRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startTimeRef = useRef(performance.now());
  const isVisibleRef = useRef(false);

  // Community configurations matching backend/ml/analyzer.py & engineConfig.js
  const COMMUNITIES = [
    {
      id: 0,
      name: 'Core Backend',
      color: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.08)',
      stroke: 'rgba(59, 130, 246, 0.22)'
    },
    {
      id: 1,
      name: 'Graph ML Engine',
      color: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.08)',
      stroke: 'rgba(168, 85, 247, 0.22)'
    },
    {
      id: 2,
      name: 'Services & AI',
      color: '#22c55e',
      fill: 'rgba(34, 197, 94, 0.08)',
      stroke: 'rgba(34, 197, 94, 0.22)'
    }
  ];

  // Scroll-triggered activation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisibleRef.current = true;
          } else {
            isVisibleRef.current = false;
          }
        });
      },
      { threshold: 0.20 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 420;
    const cx = width * 0.48;
    const cy = height * 0.50;

    // Authentic Community 0: Core Backend (Left, #3b82f6)
    const c0x = cx - 150;
    const c0y = cy + 18;
    const hub0 = {
      id: 'core_hub',
      label: 'core',
      type: 'folder',
      radius: 30,
      color: '#facc15',
      x: c0x,
      y: c0y,
      vx: 0,
      vy: 0,
      seedX: 12,
      seedY: 22,
      isHub: true,
      community: 0
    };
    const c0Nodes = [
      { id: 'parser.py', label: 'parser.py', x: c0x - 65, y: c0y - 45, radius: 17, color: '#ef4444', isCritical: true, seedX: 14, seedY: 18, community: 0 },
      { id: 'mutator.py', label: 'mutator.py', x: c0x - 65, y: c0y + 45, radius: 16, color: '#3b82f6', seedX: 20, seedY: 26, community: 0 },
      { id: 'state.py', label: 'state.py', x: c0x + 5, y: c0y + 68, radius: 15, color: '#3b82f6', seedX: 28, seedY: 34, community: 0 },
      { id: 'js_mutator.py', label: 'js_mutator.py', x: c0x + 5, y: c0y - 68, radius: 15, color: '#3b82f6', seedX: 36, seedY: 42, community: 0 }
    ];

    // Authentic Community 1: Graph ML (Top-Right, #a855f7)
    const c1x = cx + 25;
    const c1y = cy - 75;
    const hub1 = {
      id: 'ml_hub',
      label: 'ml',
      type: 'folder',
      radius: 30,
      color: '#facc15',
      x: c1x,
      y: c1y,
      vx: 0,
      vy: 0,
      seedX: 44,
      seedY: 52,
      isHub: true,
      community: 1
    };
    const c1Nodes = [
      { id: 'analyzer.py', label: 'analyzer.py', x: c1x - 60, y: c1y - 35, radius: 17, color: '#a855f7', isLaserEndpoint: true, seedX: 48, seedY: 56, community: 1 },
      { id: 'layout.py', label: 'layout.py', x: c1x + 60, y: c1y - 35, radius: 16, color: '#a855f7', seedX: 58, seedY: 64, community: 1 },
      { id: 'modularity.py', label: 'modularity.py', x: c1x + 65, y: c1y + 35, radius: 16, color: '#a855f7', seedX: 68, seedY: 72, community: 1 },
      { id: 'tensor_model.py', label: 'tensor_model.py', x: c1x - 55, y: c1y + 35, radius: 15, color: '#a855f7', seedX: 76, seedY: 82, community: 1 }
    ];

    // Authentic Community 2: Services & AI (Bottom-Right, #22c55e)
    const c2x = cx + 155;
    const c2y = cy + 42;
    const hub2 = {
      id: 'services_hub',
      label: 'services',
      type: 'folder',
      radius: 30,
      color: '#facc15',
      x: c2x,
      y: c2y,
      vx: 0,
      vy: 0,
      seedX: 84,
      seedY: 92,
      isHub: true,
      community: 2
    };
    const c2Nodes = [
      { id: 'websocket_router.py', label: 'websocket_router.py', x: c2x - 65, y: c2y - 20, radius: 17, color: '#00f0ff', isLaserEndpoint: true, seedX: 88, seedY: 96, community: 2 },
      { id: 'ai_service.py', label: 'ai_service.py', x: c2x + 60, y: c2y - 28, radius: 16, color: '#22c55e', seedX: 98, seedY: 104, community: 2 },
      { id: 'terminal_service.py', label: 'terminal_service.py', x: c2x + 55, y: c2y + 48, radius: 15, color: '#22c55e', seedX: 108, seedY: 114, community: 2 },
      { id: 'file_service.py', label: 'file_service.py', x: c2x - 15, y: c2y + 65, radius: 15, color: '#22c55e', seedX: 118, seedY: 124, community: 2 }
    ];

    // Authentic Graph Links (Intra-Community + Cross-Community Conduits)
    const links = [
      // Community 0 Intra Links
      { source: 'core_hub', target: 'parser.py' },
      { source: 'core_hub', target: 'mutator.py' },
      { source: 'core_hub', target: 'state.py' },
      { source: 'core_hub', target: 'js_mutator.py' },
      { source: 'parser.py', target: 'mutator.py' },
      { source: 'mutator.py', target: 'state.py' },

      // Community 1 Intra Links
      { source: 'ml_hub', target: 'analyzer.py' },
      { source: 'ml_hub', target: 'layout.py' },
      { source: 'ml_hub', target: 'modularity.py' },
      { source: 'ml_hub', target: 'tensor_model.py' },
      { source: 'analyzer.py', target: 'modularity.py' },
      { source: 'layout.py', target: 'tensor_model.py' },

      // Community 2 Intra Links
      { source: 'services_hub', target: 'websocket_router.py' },
      { source: 'services_hub', target: 'ai_service.py' },
      { source: 'services_hub', target: 'terminal_service.py' },
      { source: 'services_hub', target: 'file_service.py' },
      { source: 'ai_service.py', target: 'terminal_service.py' },
      { source: 'websocket_router.py', target: 'file_service.py' },

      // Cross-Community Laser Bridge (websocket_router.py <-> analyzer.py)
      { source: 'websocket_router.py', target: 'analyzer.py', isLaserBridge: true },

      // Cross-Community Conduits
      { source: 'analyzer.py', target: 'parser.py', isConduit: true, color: '#a855f7' },
      { source: 'ai_service.py', target: 'mutator.py', isConduit: true, color: '#22c55e' }
    ];

    const allNodes = [hub0, ...c0Nodes, hub1, ...c1Nodes, hub2, ...c2Nodes];
    const nodeLookup = new Map();
    allNodes.forEach(n => nodeLookup.set(n.id, n));

    links.forEach(l => {
      const s = nodeLookup.get(l.source);
      const t = nodeLookup.get(l.target);
      if (s && t) {
        l.restDist = Math.hypot(t.x - s.x, t.y - s.y);
      }
    });

    nodesRef.current = allNodes;
    linksRef.current = links;
    startTimeRef.current = performance.now();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (now) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep space backdrop
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const nodeMap = new Map();
      nodes.forEach(n => nodeMap.set(n.id, n));

      // 1. DYNAMIC LOUVAIN COMMUNITY CONVEX HULLS (Calculated live via polygonHull!)
      COMMUNITIES.forEach(comm => {
        const commNodes = nodes.filter(n => n.community === comm.id);
        if (commNodes.length >= 3) {
          const pts = [];
          const pad = 52;
          commNodes.forEach(n => {
            pts.push([n.x - pad, n.y - pad]);
            pts.push([n.x + pad, n.y - pad]);
            pts.push([n.x - pad, n.y + pad]);
            pts.push([n.x + pad, n.y + pad]);
          });

          const hull = polygonHull(pts);
          if (hull && hull.length >= 3) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(hull[0][0], hull[0][1]);
            for (let i = 1; i < hull.length; i++) {
              ctx.lineTo(hull[i][0], hull[i][1]);
            }
            ctx.closePath();
            ctx.fillStyle = comm.fill;
            ctx.fill();

            // Rounded thick border for organic nebula shape
            ctx.lineWidth = 68;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = comm.stroke;
            ctx.stroke();
            ctx.restore();
          }

          // Community Centroid Label
          let sumX = 0, sumY = 0;
          commNodes.forEach(n => { sumX += n.x; sumY += n.y; });
          const cX = sumX / commNodes.length;
          const cY = sumY / commNodes.length;

          ctx.save();
          ctx.font = '600 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = comm.color;
          ctx.textAlign = 'center';
          ctx.fillText(comm.name, cX, cY - 58);
          ctx.restore();
        }
      });

      // 2. Elastic Spring Physics & Micro-Drift
      links.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;
        const rest = l.restDist || 75;
        const delta = dist - rest;
        const k = l.isLaserBridge ? 0.012 : (l.isConduit ? 0.015 : 0.035);
        const fx = (dx / dist) * delta * k;
        const fy = (dy / dist) * delta * k;

        if (draggedNodeRef.current?.id !== s.id) { s.vx += fx; s.vy += fy; }
        if (draggedNodeRef.current?.id !== t.id) { t.vx -= fx; t.vy -= fy; }
      });

      nodes.forEach(node => {
        if (draggedNodeRef.current?.id === node.id) return;
        node.vx += Math.sin(now * 0.0011 + (node.seedX || 0)) * 0.010;
        node.vy += Math.cos(now * 0.0009 + (node.seedY || 0)) * 0.010;
        node.vx *= 0.86;
        node.vy *= 0.86;
        node.x += node.vx;
        node.y += node.vy;
      });

      // 3. Draw Links & Cross-Community Conduits
      links.forEach(l => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (!s || !t) return;

        if (l.isLaserBridge) {
          // Cyan laser bridge with streaming photons
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.20)';
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Traveling photons
          const p1 = (now * 0.00075) % 1;
          const p2 = ((now * 0.00075) + 0.5) % 1;
          [p1, p2].forEach(p => {
            const px = s.x + (t.x - s.x) * p;
            const py = s.y + (t.y - s.y) * p;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 240, 255, 0.40)';
            ctx.fill();
          });
          ctx.restore();
        } else if (l.isConduit) {
          // Dashed Cross-Community Conduit
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = l.color ? `${l.color}66` : 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        } else {
          // Intra-Community Links
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
      });

      // 4. Draw Nodes (Hubs + Authentic Files)
      nodes.forEach(node => {
        ctx.save();
        if (node.isHub) {
          // Hub disc
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.fill();

          // Subtle hub halo
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Hub label
          ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = '#090b10';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, node.x, node.y);
        } else {
          // File disc
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.fill();

          if (node.isCritical) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.40)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (node.isLaserEndpoint) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // File label below node
          ctx.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(node.label, node.x, node.y + node.radius + 6);
        }
        ctx.restore();
      });

      if (isVisible) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    let isVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = requestAnimationFrame(render);
        }
      });
    }, { rootMargin: '120px 0px 120px 0px' });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (Math.hypot(node.x - mx, node.y - my) <= node.radius + 10) {
        draggedNodeRef.current = node;
        isDraggingRef.current = true;
        break;
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDraggingRef.current && draggedNodeRef.current) {
      const dragged = draggedNodeRef.current;
      const dx = mx - dragged.x;
      const dy = my - dragged.y;

      dragged.x = mx;
      dragged.y = my;
      dragged.vx = 0;
      dragged.vy = 0;

      // When dragging a hub, smoothly translate all community child nodes together!
      if (dragged.isHub) {
        const commId = dragged.community;
        const nodes = nodesRef.current;
        nodes.forEach(n => {
          if (n.community === commId && n.id !== dragged.id) {
            n.x += dx;
            n.y += dy;
            n.vx = 0;
            n.vy = 0;
          }
        });
      }
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      {/* Box on Left on desktop (order-2 on mobile, lg:order-1 on desktop) */}
      <div className="lg:col-span-7 w-full order-2 lg:order-1">
        <div className="w-full bg-[#08090c] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[460px] sm:h-[480px] relative font-sans text-left">
          {/* Header */}
          <div className="h-9 bg-[#0e1017] border-b border-white/[0.08] px-4 flex items-center justify-between text-xs text-slate-400 select-none shrink-0">
            <span className="text-slate-300 font-mono text-[11px] font-medium">
              Cluster Detection
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500">backend</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-500">ml</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">modularity.py</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 w-full relative overflow-hidden bg-[#08090c]">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
            />
            <div className="absolute bottom-2.5 right-3 pointer-events-none text-[10px] font-mono text-slate-500/70 select-none">
              drag hubs or nodes to reshape nebulae
            </div>
          </div>

          {/* Bottom Tray */}
          <div className="h-20 bg-[#090b10] border-t border-white/[0.08] flex flex-col shrink-0 select-none">
            <div className="h-6 bg-[#0c0e14] border-b border-white/[0.06] px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('OUTPUT')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'OUTPUT' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <Terminal size={10} />
                  <span>OUTPUT</span>
                </button>
                <button
                  onClick={() => setActiveTab('powershell')}
                  className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'powershell' ? 'text-[#38bdf8] font-semibold' : 'text-slate-500'
                  }`}
                >
                  <span>powershell</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-2.5 font-mono text-[11px] text-slate-300 flex items-center">
              {activeTab === 'powershell' ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">PS C:\Neuron\clusters&gt;</span>
                  <span className="text-emerald-400 text-[10.5px]">[Neuron ML] Louvain Modularity: 3 community nebulae detected (Q=0.742)</span>
                  <span className="w-1.5 h-3 bg-[#38bdf8] animate-pulse inline-block" />
                </div>
              ) : (
                <div className="flex flex-col text-[10px] text-slate-400 space-y-0.5">
                  <span className="text-slate-300">[INFO] Louvain partitioning converged in 3 iterations (Q = 0.742).</span>
                  <span className="text-slate-500">3 community clusters identified across 15 active nodes.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Heading on Right on desktop (order-1 on mobile, lg:order-2 on desktop) */}
      <div className="lg:col-span-5 flex flex-col justify-center select-none text-left order-1 lg:order-2">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-sans leading-tight">
          Cluster Detection
        </h2>
        {/* 3-4 word description explaining what this cluster is (no full paragraph) */}
        <p className="text-sm sm:text-base text-slate-400 font-sans mt-2 tracking-normal">
          Automated Architectural Community Discovery
        </p>
      </div>
    </div>
  );
}

// =========================================================================
// MAIN EXPORT: STACKS ALL 4 DEDICATED FEATURE BOXES IN ALTERNATING RHYTHM
// =========================================================================
export default function SpatialSnippetsShowcase() {
  return (
    <section className="mb-24 sm:mb-32 w-full space-y-20 sm:space-y-28 text-left">
      {/* Box 1: Critical Hotspot Detection (Heading Left, Box Right) */}
      <HotspotDetectionBox />

      {/* Box 2: Interactive Coupling (Box Left, Heading Right) */}
      <InteractiveCouplingBox />

      {/* Box 3: Deep Code Inspection (Heading Left, Box Right) */}
      <DeepCodeInspectionBox />

      {/* Box 4: Cluster Detection (Box Left, Heading Right) */}
      <ClusterDetectionBox />
    </section>
  );
}
