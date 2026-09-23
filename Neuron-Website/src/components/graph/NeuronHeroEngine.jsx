import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  forceSimulation, 
  forceLink, 
  forceManyBody, 
  forceCollide, 
  forceX, 
  forceY 
} from '../../utils/spatialPhysicsEngine';
import { polygonHull } from '../../utils/polygonHull';

const d3 = { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY };
import { 
  Folder, FileCode2, ZoomIn, ZoomOut, RotateCcw, Type,
  Minus, Square, X, Files, GitBranch, Sparkles, Settings,
  Palette, ChevronDown, ChevronRight, FilePlus, FolderPlus,
  RefreshCw, ListCollapse, Network, Play, Bell, Check, CheckCircle2
} from 'lucide-react';

// The 5 official built-in themes directly matching frontend/src/config/themeConfig.js
const THEMES_MAP = {
  black: {
    id: 'black',
    name: 'Obsidian Black',
    isDark: true,
    primary: '#121212',
    secondary: '#191a1b',
    background: '#121314',
    surface: '#161719',
    surfaceHover: '#222426',
    surfaceActive: '#2a2c2e',
    border: '#242628',
    borderSubtle: '#2e3032',
    textBright: '#f8fafc',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    accent: '#3b82f6',
    folderIcon: '#dcb67a',
    circleColor: '#121212',
    circleBorder: '#4b5563',
    laserBridge: '#00f0ff'
  },
  white: {
    id: 'white',
    name: 'Alabaster White',
    isDark: false,
    primary: '#e8eaed',
    secondary: '#f1f3f4',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceHover: '#e4e7eb',
    surfaceActive: '#dadce0',
    border: '#dadce0',
    borderSubtle: '#d0d4d9',
    textBright: '#111827',
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#6b7280',
    accent: '#2563eb',
    folderIcon: '#b45309',
    circleColor: '#ffffff',
    circleBorder: '#cbd5e1',
    laserBridge: '#0284c7'
  },
  pink: {
    id: 'pink',
    name: 'Sakura Rose',
    isDark: true,
    primary: '#1e111a',
    secondary: '#271622',
    background: '#180c14',
    surface: '#2e1828',
    surfaceHover: '#381b31',
    surfaceActive: '#47223e',
    border: '#3c1e33',
    borderSubtle: '#4a253f',
    textBright: '#fff1f2',
    textPrimary: '#fce7f3',
    textSecondary: '#f472b6',
    textMuted: '#9d6a89',
    accent: '#ec4899',
    folderIcon: '#f472b6',
    circleColor: '#f472b6',
    circleBorder: '#fb7185',
    laserBridge: '#f472b6'
  },
  galaxy: {
    id: 'galaxy',
    name: 'Galaxy Dark Blue',
    isDark: true,
    primary: '#090d16',
    secondary: '#0e1422',
    background: '#080b12',
    surface: '#121929',
    surfaceHover: '#1a243a',
    surfaceActive: '#243252',
    border: '#1c2842',
    borderSubtle: '#253556',
    textBright: '#f0f6fc',
    textPrimary: '#cbd5e1',
    textSecondary: '#8ba2c4',
    textMuted: '#506689',
    accent: '#38bdf8',
    folderIcon: '#38bdf8',
    circleColor: '#0e172a',
    circleBorder: '#38bdf8',
    laserBridge: '#38bdf8'
  },
  rosewater: {
    id: 'rosewater',
    name: 'Sakura Mist',
    isDark: false,
    primary: '#fdf2f4',
    secondary: '#fff1f4',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceHover: '#fce7ec',
    surfaceActive: '#fad2df',
    border: '#f4d3dc',
    borderSubtle: '#eabecb',
    textBright: '#1e141a',
    textPrimary: '#36222e',
    textSecondary: '#6b495d',
    textMuted: '#967285',
    accent: '#db2777',
    folderIcon: '#db2777',
    circleColor: '#fce7ec',
    circleBorder: '#db2777',
    laserBridge: '#db2777'
  }
};

// Official engine theme and physics constants directly from src/config/engineConfig.js
const ENGINE_LAWS = {
  PHYSICS: {
    GRAVITY_PULL: 0.025,
    REPULSION: {
      folder: -2600,
      file: -900,
      function: -240
    },
    SPRING_DISTANCE: {
      moonOrbit: 45,
      planetOrbit: 95,
      neuralCall: 180
    },
    SPRING_STRENGTH: {
      structural: 0.95,
      bridge: 0.35,
      neural: 0.25
    },
    COLLISION_RADIUS: {
      folder: 58,
      file: 36,
      function: 25
    },
    ALPHA_DECAY: 0.012,
    VELOCITY_DECAY: 0.52,
    RESTING_ALPHA: 0.018,
    DRAGGING_ALPHA: 0.25
  },
  THEME: {
    sizes: {
      folder: 36,
      file: 18,
      function: 10
    },
    nodes: {
      folder: '#e4ef61',
      file: '#3b82f6',
      function: '#8b5cf6',
      riskHigh: '#ef4444',
      riskMedium: '#f59e0b'
    },
    edges: {
      hierarchy: '#6d6d6d',
      call: '#9f00ad',
      bridge: '#00f0ff',
      hierarchyGlow: '#60a5fa',
      callGlow: '#c084fc',
      opacityNormal: 0.45,
      opacityDimmed: 0.04,
      widthHierarchy: 1.0,
      widthCall: 1.5,
      widthBridge: 2.5,
      widthHoverGlow: 3.8
    },
    nebula: {
      blurRadius: 35,
      padding: 85,
      strokeWidth: 80,
      fillOpacity: 0.08,
      strokeOpacity: 0.22,
      colors: [
        { fill: '#3b82f6', stroke: '#3b82f6' }, // Community 0: Core Backend
        { fill: '#a855f7', stroke: '#a855f7' }, // Community 1: Graph ML Analyzer
        { fill: '#22c55e', stroke: '#22c55e' }, // Community 2: AI & Microservices
        { fill: '#ec4899', stroke: '#ec4899' }, // Community 3: Spatial Engine
        { fill: '#eab308', stroke: '#eab308' }, // Community 4: UI & Layout
        { fill: '#f97316', stroke: '#f97316' }  // Community 5: Hooks & State
      ]
    }
  }
};

// Elastic bounce popping easing function for procedural celestial emergence
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// Official Neuron Codebase Graph Specification (Authentic Files & Louvain Modularity)
const NEURON_GRAPH_DATA = {
  nodes: [
    // --- Root Folders (Tier 0) ---
    { id: 'backend', label: 'backend', nodeType: 'folder', tier: 0, community: 0 },
    { id: 'frontend', label: 'frontend', nodeType: 'folder', tier: 0, community: 3 },

    // --- Backend Subfolders ---
    { id: 'backend/api', label: 'api', parentId: 'backend', nodeType: 'folder', tier: 0, community: 0 },
    { id: 'backend/core', label: 'core', parentId: 'backend', nodeType: 'folder', tier: 0, community: 0 },
    { id: 'backend/ml', label: 'ml', parentId: 'backend', nodeType: 'folder', tier: 0, community: 1 },
    { id: 'backend/services', label: 'services', parentId: 'backend', nodeType: 'folder', tier: 0, community: 2 },

    // --- Frontend Subfolders ---
    { id: 'frontend/src', label: 'src', parentId: 'frontend', nodeType: 'folder', tier: 0, community: 3 },
    { id: 'frontend/src/components', label: 'components', parentId: 'frontend/src', nodeType: 'folder', tier: 0, community: 4 },
    { id: 'frontend/src/hooks', label: 'hooks', parentId: 'frontend/src', nodeType: 'folder', tier: 0, community: 5 },

    // --- Community 0: Backend Core & API (Files) ---
    { id: 'backend/core/parser.py', label: 'parser.py', parentId: 'backend/core', nodeType: 'file', tier: 1, community: 0, risk: 'high' },
    { id: 'backend/core/mutator.py', label: 'mutator.py', parentId: 'backend/core', nodeType: 'file', tier: 1, community: 0, risk: 'medium' },
    { id: 'backend/core/state.py', label: 'state.py', parentId: 'backend/core', nodeType: 'file', tier: 1, community: 0 },
    { id: 'backend/core/js_mutator.py', label: 'js_mutator.py', parentId: 'backend/core', nodeType: 'file', tier: 1, community: 0 },
    { id: 'backend/api/websocket_router.py', label: 'websocket_router.py', parentId: 'backend/api', nodeType: 'file', tier: 1, community: 0 },
    { id: 'backend/main.py', label: 'main.py', parentId: 'backend', nodeType: 'file', tier: 1, community: 0 },

    // --- Community 1: ML Analyzer & Layout (Files) ---
    { id: 'backend/ml/analyzer.py', label: 'analyzer.py', parentId: 'backend/ml', nodeType: 'file', tier: 1, community: 1, risk: 'high' },

    // --- Community 2: Services & AI (Files) ---
    { id: 'backend/services/ai_service.py', label: 'ai_service.py', parentId: 'backend/services', nodeType: 'file', tier: 1, community: 2 },
    { id: 'backend/services/terminal_service.py', label: 'terminal_service.py', parentId: 'backend/services', nodeType: 'file', tier: 1, community: 2 },

    // --- Community 3: Frontend Application Core (Files) ---
    { id: 'frontend/src/App.jsx', label: 'App.jsx', parentId: 'frontend/src', nodeType: 'file', tier: 1, community: 3, risk: 'high' },
    { id: 'frontend/src/main.jsx', label: 'main.jsx', parentId: 'frontend/src', nodeType: 'file', tier: 1, community: 3 },
    { id: 'frontend/package.json', label: 'package.json', parentId: 'frontend', nodeType: 'file', tier: 1, community: 3 },
    { id: 'README.md', label: 'README.md', nodeType: 'file', tier: 1, community: 3 },

    // --- Community 4: UI Layout Components (Files) ---
    { id: 'frontend/src/components/CodeEditor.jsx', label: 'CodeEditor.jsx', parentId: 'frontend/src/components', nodeType: 'file', tier: 1, community: 4 },
    { id: 'frontend/src/components/TerminalPanel.jsx', label: 'TerminalPanel.jsx', parentId: 'frontend/src/components', nodeType: 'file', tier: 1, community: 4 },
    { id: 'frontend/src/components/TopBar.jsx', label: 'TopBar.jsx', parentId: 'frontend/src/components', nodeType: 'file', tier: 1, community: 4 },

    // --- Community 5: Reactive Hooks & State (Files) ---
    { id: 'frontend/src/hooks/usePhysicsEngine.js', label: 'usePhysicsEngine.js', parentId: 'frontend/src/hooks', nodeType: 'file', tier: 1, community: 5, risk: 'medium' },
    { id: 'frontend/src/hooks/useWorkspace.js', label: 'useWorkspace.js', parentId: 'frontend/src/hooks', nodeType: 'file', tier: 1, community: 5 },

    // --- Orbiting Functions (Tier 2 Moons) ---
    { id: 'parser.py::parse_ast()', label: 'def parse_ast()', parentId: 'backend/core/parser.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'parser.py::extract_symbols()', label: 'def extract_symbols()', parentId: 'backend/core/parser.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'parser.py::build_call_graph()', label: 'def build_call_graph()', parentId: 'backend/core/parser.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'mutator.py::apply_refactor()', label: 'def apply_refactor()', parentId: 'backend/core/mutator.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'mutator.py::rollback_state()', label: 'def rollback_state()', parentId: 'backend/core/mutator.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'websocket_router.py::ws_handler()', label: 'def ws_handler()', parentId: 'backend/api/websocket_router.py', nodeType: 'function', tier: 2, community: 0 },
    { id: 'analyzer.py::analyze_graph_ml()', label: 'def analyze_graph_ml()', parentId: 'backend/ml/analyzer.py', nodeType: 'function', tier: 2, community: 1 },
    { id: 'analyzer.py::compute_shannon_entropy()', label: 'def compute_shannon_entropy()', parentId: 'backend/ml/analyzer.py', nodeType: 'function', tier: 2, community: 1 },
    { id: 'analyzer.py::detect_communities()', label: 'def detect_communities()', parentId: 'backend/ml/analyzer.py', nodeType: 'function', tier: 2, community: 1 },
    { id: 'ai_service.py::supervise_step()', label: 'def supervise_step()', parentId: 'backend/services/ai_service.py', nodeType: 'function', tier: 2, community: 2 },
    { id: 'ai_service.py::evaluate_csp()', label: 'def evaluate_csp()', parentId: 'backend/services/ai_service.py', nodeType: 'function', tier: 2, community: 2 },
    { id: 'CodeEditor.jsx::handleEditorChange()', label: 'function handleEditorChange()', parentId: 'frontend/src/components/CodeEditor.jsx', nodeType: 'function', tier: 2, community: 4 },
    { id: 'TerminalPanel.jsx::runCommand()', label: 'function runCommand()', parentId: 'frontend/src/components/TerminalPanel.jsx', nodeType: 'function', tier: 2, community: 4 },
    { id: 'usePhysicsEngine.js::usePhysicsEngine()', label: 'function usePhysicsEngine()', parentId: 'frontend/src/hooks/usePhysicsEngine.js', nodeType: 'function', tier: 2, community: 5 },
    { id: 'usePhysicsEngine.js::emitNextNode()', label: 'function emitNextNode()', parentId: 'frontend/src/hooks/usePhysicsEngine.js', nodeType: 'function', tier: 2, community: 5 },
    { id: 'useWorkspace.js::syncNodeMove()', label: 'function syncNodeMove()', parentId: 'frontend/src/hooks/useWorkspace.js', nodeType: 'function', tier: 2, community: 5 },
    { id: 'App.jsx::initWorkspace()', label: 'function initWorkspace()', parentId: 'frontend/src/App.jsx', nodeType: 'function', tier: 2, community: 3 }
  ],
  edges: [
    // Subfolder hierarchy
    { id: 'e-b-api', source: 'backend', target: 'backend/api', type: 'hierarchy' },
    { id: 'e-b-core', source: 'backend', target: 'backend/core', type: 'hierarchy' },
    { id: 'e-b-ml', source: 'backend', target: 'backend/ml', type: 'hierarchy' },
    { id: 'e-b-srv', source: 'backend', target: 'backend/services', type: 'hierarchy' },
    { id: 'e-b-main', source: 'backend', target: 'backend/main.py', type: 'hierarchy' },

    { id: 'e-f-src', source: 'frontend', target: 'frontend/src', type: 'hierarchy' },
    { id: 'e-f-cmp', source: 'frontend/src', target: 'frontend/src/components', type: 'hierarchy' },
    { id: 'e-f-hk', source: 'frontend/src', target: 'frontend/src/hooks', type: 'hierarchy' },
    { id: 'e-f-app', source: 'frontend/src', target: 'frontend/src/App.jsx', type: 'hierarchy' },
    { id: 'e-f-main', source: 'frontend/src', target: 'frontend/src/main.jsx', type: 'hierarchy' },
    { id: 'e-f-pkg', source: 'frontend', target: 'frontend/package.json', type: 'hierarchy' },

    // Files hierarchy
    { id: 'e-p-parse', source: 'backend/core', target: 'backend/core/parser.py', type: 'hierarchy' },
    { id: 'e-p-mut', source: 'backend/core', target: 'backend/core/mutator.py', type: 'hierarchy' },
    { id: 'e-p-state', source: 'backend/core', target: 'backend/core/state.py', type: 'hierarchy' },
    { id: 'e-p-jsm', source: 'backend/core', target: 'backend/core/js_mutator.py', type: 'hierarchy' },
    { id: 'e-p-ws', source: 'backend/api', target: 'backend/api/websocket_router.py', type: 'hierarchy' },
    { id: 'e-p-an', source: 'backend/ml', target: 'backend/ml/analyzer.py', type: 'hierarchy' },
    { id: 'e-p-ais', source: 'backend/services', target: 'backend/services/ai_service.py', type: 'hierarchy' },
    { id: 'e-p-tms', source: 'backend/services', target: 'backend/services/terminal_service.py', type: 'hierarchy' },

    { id: 'e-p-ce', source: 'frontend/src/components', target: 'frontend/src/components/CodeEditor.jsx', type: 'hierarchy' },
    { id: 'e-p-tp', source: 'frontend/src/components', target: 'frontend/src/components/TerminalPanel.jsx', type: 'hierarchy' },
    { id: 'e-p-top', source: 'frontend/src/components', target: 'frontend/src/components/TopBar.jsx', type: 'hierarchy' },
    { id: 'e-p-ph', source: 'frontend/src/hooks', target: 'frontend/src/hooks/usePhysicsEngine.js', type: 'hierarchy' },
    { id: 'e-p-wsy', source: 'frontend/src/hooks', target: 'frontend/src/hooks/useWorkspace.js', type: 'hierarchy' },

    // Functions hierarchy (File to Moon Functions)
    { id: 'e-f1', source: 'backend/core/parser.py', target: 'parser.py::parse_ast()', type: 'hierarchy' },
    { id: 'e-f2', source: 'backend/core/parser.py', target: 'parser.py::extract_symbols()', type: 'hierarchy' },
    { id: 'e-f3', source: 'backend/core/parser.py', target: 'parser.py::build_call_graph()', type: 'hierarchy' },
    { id: 'e-f4', source: 'backend/core/mutator.py', target: 'mutator.py::apply_refactor()', type: 'hierarchy' },
    { id: 'e-f5', source: 'backend/core/mutator.py', target: 'mutator.py::rollback_state()', type: 'hierarchy' },
    { id: 'e-f6', source: 'backend/api/websocket_router.py', target: 'websocket_router.py::ws_handler()', type: 'hierarchy' },
    { id: 'e-f7', source: 'backend/ml/analyzer.py', target: 'analyzer.py::analyze_graph_ml()', type: 'hierarchy' },
    { id: 'e-f8', source: 'backend/ml/analyzer.py', target: 'analyzer.py::compute_shannon_entropy()', type: 'hierarchy' },
    { id: 'e-f9', source: 'backend/ml/analyzer.py', target: 'analyzer.py::detect_communities()', type: 'hierarchy' },
    { id: 'e-f10', source: 'backend/services/ai_service.py', target: 'ai_service.py::supervise_step()', type: 'hierarchy' },
    { id: 'e-f11', source: 'backend/services/ai_service.py', target: 'ai_service.py::evaluate_csp()', type: 'hierarchy' },
    { id: 'e-f12', source: 'frontend/src/components/CodeEditor.jsx', target: 'CodeEditor.jsx::handleEditorChange()', type: 'hierarchy' },
    { id: 'e-f13', source: 'frontend/src/components/TerminalPanel.jsx', target: 'TerminalPanel.jsx::runCommand()', type: 'hierarchy' },
    { id: 'e-f14', source: 'frontend/src/hooks/usePhysicsEngine.js', target: 'usePhysicsEngine.js::usePhysicsEngine()', type: 'hierarchy' },
    { id: 'e-f15', source: 'frontend/src/hooks/usePhysicsEngine.js', target: 'usePhysicsEngine.js::emitNextNode()', type: 'hierarchy' },
    { id: 'e-f16', source: 'frontend/src/hooks/useWorkspace.js', target: 'useWorkspace.js::syncNodeMove()', type: 'hierarchy' },
    { id: 'e-f17', source: 'frontend/src/App.jsx', target: 'App.jsx::initWorkspace()', type: 'hierarchy' },

    // Neural Call Edges (Purple Conduits)
    { id: 'call-1', source: 'backend/api/websocket_router.py', target: 'backend/ml/analyzer.py', type: 'call' },
    { id: 'call-2', source: 'backend/ml/analyzer.py', target: 'backend/core/parser.py', type: 'call' },
    { id: 'call-3', source: 'backend/services/ai_service.py', target: 'backend/core/mutator.py', type: 'call' },
    { id: 'call-4', source: 'frontend/src/App.jsx', target: 'frontend/src/components/CodeEditor.jsx', type: 'call' },
    { id: 'call-5', source: 'frontend/src/components/CodeEditor.jsx', target: 'frontend/src/hooks/useWorkspace.js', type: 'call' },
    { id: 'call-6', source: 'frontend/src/hooks/usePhysicsEngine.js', target: 'frontend/src/hooks/useWorkspace.js', type: 'call' },

    // Cross-Stack Laser Bridges (Cyan High-Speed Conduits with Dual Traveling Photons)
    { id: 'bridge-1', source: 'frontend/src/hooks/useWorkspace.js', target: 'backend/api/websocket_router.py', type: 'network_bridge' },
    { id: 'bridge-2', source: 'frontend/src/components/TerminalPanel.jsx', target: 'backend/services/terminal_service.py', type: 'network_bridge' },
    { id: 'bridge-3', source: 'frontend/src/App.jsx', target: 'backend/services/ai_service.py', type: 'network_bridge' }
  ]
};

export default function NeuronHeroEngine() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Viewport Zoom & Pan
  const zoomRef = useRef(0.95);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoomDisplay, setZoomDisplay] = useState(95);

  // Active theme matching Obsidian Black by default
  const [activeThemeId, setActiveThemeId] = useState('black');
  const activeTheme = THEMES_MAP[activeThemeId] || THEMES_MAP.black;
  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  // Window Menu & Sidebar Layout State
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeSidebarView, setActiveSidebarView] = useState('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeDocTab, setActiveDocTab] = useState('spatial');
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [activeTerminalTab, setActiveTerminalTab] = useState('powershell');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([
    { cmd: 'git status', stdout: 'On branch main\nYour branch is up to date with \'origin/main\'.' },
    { cmd: 'python -m backend.ml.analyzer', stdout: '[Neuron ML] Louvain modularity detected 6 communities (Q=0.742).\n[Neuron Engine] Spatial Graph synchronized with 58 nodes and 56 links.' }
  ]);

  const [openFolders, setOpenFolders] = useState({
    neuron: true,
    backend: true,
    backendApi: false,
    backendCore: true,
    backendMl: false,
    backendServices: false,
    frontend: true,
    frontendSrc: true,
    frontendComponents: true,
    frontendHooks: false
  });

  const [showLabels, setShowLabels] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const menuRef = useRef(null);
  const themePopoverRef = useRef(null);
  const themeButtonRef = useRef(null);

  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;
  const hoveredNodeRef = useRef(hoveredNode);
  hoveredNodeRef.current = hoveredNode;
  const isCanvasFocusedRef = useRef(isCanvasFocused);
  isCanvasFocusedRef.current = isCanvasFocused;
  const userInteractedRef = useRef(false);
  const hintTimeoutRef = useRef(null);

  // Graph Simulation & Lifecycle Refs
  const allNodesRef = useRef([]);
  const allEdgesRef = useRef([]);
  const activeNodesRef = useRef([]);
  const activeEdgesRef = useRef([]);
  const simulationRef = useRef(null);
  const animFrameRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const isSpawningCompleteRef = useRef(false);
  const isVisibleRef = useRef(false);
  const renderTriggerRef = useRef(null);

  const mouseRef = useRef({
    screenX: -1000,
    screenY: -1000,
    worldX: -1000,
    worldY: -1000,
    isDown: false,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    draggedNode: null,
    dragOffset: { x: 0, y: 0 }
  });

  const screenToWorld = useCallback((sx, sy) => {
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current
    };
  }, []);

  // Initialize and Reset the D3 Force Simulation Universe
  const startSimulationAndSpawning = useCallback(() => {
    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // 1. Prepare raw nodes
    const rawNodes = NEURON_GRAPH_DATA.nodes.map((n, idx) => {
      const isFolder = n.nodeType === 'folder';
      const isFile = n.nodeType === 'file';
      const baseRadius = isFolder 
        ? ENGINE_LAWS.THEME.sizes.folder / 2 
        : (isFile ? ENGINE_LAWS.THEME.sizes.file / 2 : ENGINE_LAWS.THEME.sizes.function / 2);

      let color = ENGINE_LAWS.THEME.nodes.function;
      if (isFolder) color = ENGINE_LAWS.THEME.nodes.folder;
      else if (isFile) {
        if (n.risk === 'high') color = ENGINE_LAWS.THEME.nodes.riskHigh;
        else if (n.risk === 'medium') color = ENGINE_LAWS.THEME.nodes.riskMedium;
        else color = ENGINE_LAWS.THEME.nodes.file;
      }

      return {
        ...n,
        id: String(n.id),
        baseRadius,
        radius: 0,
        color,
        x: (Math.cos(idx) * (20 + idx * 4)),
        y: (Math.sin(idx) * (20 + idx * 4)),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        spawnProgress: 0,
        isSpawned: false
      };
    });

    const nodeLookup = new Map(rawNodes.map(n => [n.id, n]));
    const parentMap = new Map();
    const childrenMap = new Map();

    NEURON_GRAPH_DATA.edges.forEach(e => {
      if (e.type === 'hierarchy') {
        parentMap.set(e.target, e.source);
        if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
        childrenMap.get(e.source).push(e.target);
      }
    });

    const rawEdges = NEURON_GRAPH_DATA.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type
    }));

    allNodesRef.current = rawNodes;
    allEdgesRef.current = rawEdges;

    // Active pool starts with Root Folders ('backend' and 'frontend')
    const rootNodes = rawNodes.filter(n => !parentMap.has(n.id) || n.tier === 0);
    const activePool = [];
    const activeNodeIds = new Set();

    rootNodes.forEach((root, idx) => {
      root.isSpawned = true;
      root.spawnProgress = 0;
      root.x = (idx === 0 ? -120 : 120);
      root.y = 0;
      activePool.push(root);
      activeNodeIds.add(root.id);
    });

    const getActiveEdges = () => {
      return rawEdges.filter(e => {
        const s = typeof e.source === 'object' ? e.source.id : e.source;
        const t = typeof e.target === 'object' ? e.target.id : e.target;
        return activeNodeIds.has(s) && activeNodeIds.has(t);
      });
    };

    activeNodesRef.current = activePool;
    activeEdgesRef.current = getActiveEdges();

    // Setup D3 Force Simulation with exact laws from engineConfig.js
    const linkForce = d3.forceLink(activeEdgesRef.current).id(d => d.id)
      .distance(link => {
        const tgt = typeof link.target === 'object' ? link.target : nodeLookup.get(link.target);
        if (link.type === 'hierarchy') {
          return tgt?.nodeType === 'function' 
            ? ENGINE_LAWS.PHYSICS.SPRING_DISTANCE.moonOrbit 
            : ENGINE_LAWS.PHYSICS.SPRING_DISTANCE.planetOrbit;
        }
        if (link.type === 'network_bridge') {
          return ENGINE_LAWS.PHYSICS.SPRING_DISTANCE.neuralCall * 1.2;
        }
        return ENGINE_LAWS.PHYSICS.SPRING_DISTANCE.neuralCall;
      })
      .strength(link => {
        if (link.type === 'hierarchy') return ENGINE_LAWS.PHYSICS.SPRING_STRENGTH.structural;
        if (link.type === 'network_bridge') return ENGINE_LAWS.PHYSICS.SPRING_STRENGTH.bridge;
        return ENGINE_LAWS.PHYSICS.SPRING_STRENGTH.neural;
      });

    const simulation = d3.forceSimulation(activePool)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody()
        .strength(d => {
          return d.nodeType === 'folder' 
            ? ENGINE_LAWS.PHYSICS.REPULSION.folder 
            : d.nodeType === 'file' 
              ? ENGINE_LAWS.PHYSICS.REPULSION.file 
              : ENGINE_LAWS.PHYSICS.REPULSION.function;
        })
        .distanceMax(2200)
      )
      .force("x", d3.forceX(0).strength(ENGINE_LAWS.PHYSICS.GRAVITY_PULL))
      .force("y", d3.forceY(0).strength(ENGINE_LAWS.PHYSICS.GRAVITY_PULL))
      .force("collide", d3.forceCollide()
        .radius(d => {
          const base = d.nodeType === 'folder' 
            ? ENGINE_LAWS.PHYSICS.COLLISION_RADIUS.folder 
            : d.nodeType === 'file' 
              ? ENGINE_LAWS.PHYSICS.COLLISION_RADIUS.file 
              : ENGINE_LAWS.PHYSICS.COLLISION_RADIUS.function;
          return base;
        })
        .iterations(2)
      )
      .alphaDecay(ENGINE_LAWS.PHYSICS.ALPHA_DECAY)
      .velocityDecay(ENGINE_LAWS.PHYSICS.VELOCITY_DECAY);

    simulation.alphaTarget(ENGINE_LAWS.PHYSICS.RESTING_ALPHA).restart();
    simulationRef.current = simulation;

    // Build Ordered BFS Spawning Queue
    const spawnQueue = [];
    const queuedSet = new Set(activeNodeIds);
    const bfsQueue = [...rootNodes];

    while (bfsQueue.length > 0) {
      const current = bfsQueue.shift();
      const childIds = childrenMap.get(current.id) || [];
      childIds.forEach(cId => {
        if (!queuedSet.has(cId)) {
          queuedSet.add(cId);
          const childNode = nodeLookup.get(cId);
          if (childNode) {
            bfsQueue.push(childNode);
            spawnQueue.push(childNode);
          }
        }
      });
    }

    rawNodes.forEach(n => {
      if (!queuedSet.has(n.id)) {
        queuedSet.add(n.id);
        spawnQueue.push(n);
      }
    });

    isSpawningCompleteRef.current = false;
    const totalToSpawn = spawnQueue.length;
    const delayPerNodeMs = Math.max(18, Math.min(95, Math.round(5500 / Math.max(1, totalToSpawn))));

    // Procedural Staggered Emitter
    const emitNextNode = () => {
      if (spawnQueue.length === 0) {
        isSpawningCompleteRef.current = true;
        spawnTimerRef.current = null;
        return;
      }

      const node = spawnQueue.shift();
      const parentId = parentMap.get(node.id);
      const parentNode = parentId ? nodeLookup.get(parentId) : null;

      const angle = Math.random() * Math.PI * 2;
      const birthDist = 12;

      if (!parentNode || !parentNode.isSpawned) {
        node.x = Math.cos(angle) * (40 + Math.random() * 60);
        node.y = Math.sin(angle) * (40 + Math.random() * 60);
        node.vx = Math.cos(angle) * 2;
        node.vy = Math.sin(angle) * 2;
      } else {
        node.x = parentNode.x + Math.cos(angle) * birthDist;
        node.y = parentNode.y + Math.sin(angle) * birthDist;
        const speed = node.nodeType === 'file' ? 6.5 : (node.nodeType === 'folder' ? 7.5 : 3.5);
        node.vx = (parentNode.vx || 0) * 0.2 + Math.cos(angle) * speed;
        node.vy = (parentNode.vy || 0) * 0.2 + Math.sin(angle) * speed;
      }

      node.isSpawned = true;
      node.spawnProgress = 0;

      activePool.push(node);
      activeNodeIds.add(node.id);

      const activeEdges = getActiveEdges();
      activeEdgesRef.current = activeEdges;

      simulation.nodes(activePool);
      linkForce.links(activeEdges);
      simulation.alpha(Math.max(simulation.alpha(), 0.26)).restart();

      spawnTimerRef.current = setTimeout(emitNextNode, delayPerNodeMs);
    };

    spawnTimerRef.current = setTimeout(emitNextNode, 80);
  }, []);

  const handleRefactor = useCallback(() => {
    userInteractedRef.current = false;
    startSimulationAndSpawning();
  }, [startSimulationAndSpawning]);

  // Viewport intersection observer to trigger on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hasStarted = false;
    const startOnce = () => {
      if (hasStarted) return;
      hasStarted = true;
      startSimulationAndSpawning();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isIntersecting = entry.isIntersecting;
          isVisibleRef.current = isIntersecting;
          if (isIntersecting) {
            startOnce();
            if (renderTriggerRef.current) {
              renderTriggerRef.current();
            }
          }
        });
      },
      { threshold: [0, 0.05], rootMargin: '120px 0px 120px 0px' }
    );

    observer.observe(container);

    const rect = container.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
      isVisibleRef.current = true;
      startOnce();
    }

    return () => observer.disconnect();
  }, [startSimulationAndSpawning]);

  // Center viewport on canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCenter = () => {
      if (canvas.clientWidth > 0 && !userInteractedRef.current) {
        const initialZoom = 0.95;
        zoomRef.current = initialZoom;
        panRef.current = {
          x: canvas.clientWidth / 2,
          y: canvas.clientHeight / 2
        };
        setZoomDisplay(Math.round(initialZoom * 100));
      }
    };

    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  // Conflict-free native wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e) => {
      const isZoomGesture = e.ctrlKey || e.metaKey || isCanvasFocusedRef.current;

      if (isZoomGesture) {
        e.preventDefault();
        e.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const currentZoom = zoomRef.current;
        const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.18), 3.0);

        const worldBefore = screenToWorld(mouseX, mouseY);
        userInteractedRef.current = true;
        zoomRef.current = newZoom;
        panRef.current = {
          x: mouseX - worldBefore.x * newZoom,
          y: mouseY - worldBefore.y * newZoom
        };
        setZoomDisplay(Math.round(newZoom * 100));
      } else {
        setShowScrollHint(true);
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = setTimeout(() => setShowScrollHint(false), 1400);
      }
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
    };
  }, [screenToWorld]);

  // 60-120 FPS Main Render Loop with Louvain Nebulae & Photon Conduits
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prevTime = performance.now();

    const render = (time) => {
      if (!isVisibleRef.current) {
        return;
      }
      prevTime = time;

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

      // Background matching active theme
      ctx.fillStyle = activeThemeRef.current ? activeThemeRef.current.background : '#121314';
      ctx.fillRect(0, 0, width, height);

      const activeNodes = activeNodesRef.current || [];
      const activeEdges = activeEdgesRef.current || [];

      // Emerge newly spawned nodes with easeOutBack elastic popping
      activeNodes.forEach(node => {
        if (node.isSpawned && node.spawnProgress < 1) {
          node.spawnProgress = Math.min(1, (node.spawnProgress || 0) + 0.038);
        }
        const p = Math.max(0, Math.min(1, node.spawnProgress || 0));
        const scaleMultiplier = p > 0 ? easeOutBack(p) : 0;
        node.radius = node.baseRadius * Math.max(0, scaleMultiplier);
      });

      // Interactive Hover Ray Tracing Focus
      const activeNode = selectedNodeRef.current || hoveredNodeRef.current;
      const activeId = activeNode?.id;
      const focusedNodeIds = new Set();
      const focusedEdgeIds = new Set();

      if (activeId) {
        focusedNodeIds.add(activeId);
        activeEdges.forEach(e => {
          const sId = typeof e.source === 'object' ? e.source.id : e.source;
          const tId = typeof e.target === 'object' ? e.target.id : e.target;
          if (sId === activeId) {
            focusedNodeIds.add(tId);
            focusedEdgeIds.add(e.id);
          } else if (tId === activeId) {
            focusedNodeIds.add(sId);
            focusedEdgeIds.add(e.id);
          }
        });
      }

      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // 1. RENDER LOUVAIN COMMUNITY NEBULAE (Convex Hulls with padding: 85, strokeWidth: 80, join: round)
      const communityGroups = {};
      activeNodes.forEach(node => {
        if (node.community !== undefined && (node.spawnProgress || 0) > 0.3) {
          if (!communityGroups[node.community]) communityGroups[node.community] = [];
          communityGroups[node.community].push(node);
        }
      });

      const nebulaColors = ENGINE_LAWS.THEME.nebula.colors;
      const pad = ENGINE_LAWS.THEME.nebula.padding;

      Object.entries(communityGroups).forEach(([commId, commNodes]) => {
        if (commNodes.length < 3) return;

        const pts = [];
        commNodes.forEach(n => {
          pts.push([n.x - pad, n.y - pad]);
          pts.push([n.x + pad, n.y - pad]);
          pts.push([n.x - pad, n.y + pad]);
          pts.push([n.x + pad, n.y + pad]);
        });

        const hull = polygonHull(pts);
        if (hull && hull.length > 2) {
          const colorObj = nebulaColors[parseInt(commId, 10) % nebulaColors.length];
          const isCommFocused = !activeId || commNodes.some(n => focusedNodeIds.has(n.id));
          const hullAlphaMultiplier = isCommFocused ? 1.0 : 0.12;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(hull[0][0], hull[0][1]);
          for (let i = 1; i < hull.length; i++) {
            ctx.lineTo(hull[i][0], hull[i][1]);
          }
          ctx.closePath();

          // Fill hull
          ctx.fillStyle = colorObj.fill;
          ctx.globalAlpha = ENGINE_LAWS.THEME.nebula.fillOpacity * hullAlphaMultiplier;
          ctx.fill();

          // Stroke hull with rounded join and wide radius
          ctx.strokeStyle = colorObj.stroke;
          ctx.globalAlpha = ENGINE_LAWS.THEME.nebula.strokeOpacity * hullAlphaMultiplier;
          ctx.lineWidth = ENGINE_LAWS.THEME.nebula.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.restore();
        }
      });

      // 2. RENDER EDGES & CROSS-STACK LASER BRIDGES
      activeEdges.forEach(edge => {
        const source = typeof edge.source === 'object' ? edge.source : activeNodes.find(n => n.id === edge.source);
        const target = typeof edge.target === 'object' ? edge.target : activeNodes.find(n => n.id === edge.target);
        if (!source || !target || source.radius <= 0 || target.radius <= 0) return;

        const edgeSpawnAlpha = Math.min(source.spawnProgress || 1, target.spawnProgress || 1);
        if (edgeSpawnAlpha < 0.05) return;

        const isBridge = edge.type === 'network_bridge';
        const isCall = edge.type === 'call';
        const isFocusedEdge = focusedEdgeIds.has(edge.id);
        const isDimmed = activeId && !isFocusedEdge;

        ctx.save();

        if (isBridge) {
          // --- Cross-Stack Cyan Laser Conduit ---
          const bridgeAlpha = isDimmed ? 0.08 : (edgeSpawnAlpha * (isFocusedEdge ? 1.0 : 0.95));

          // Outer Neon Glow Aura
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 8.0;
          ctx.globalAlpha = 0.18 * bridgeAlpha;
          ctx.stroke();

          // Core Electric Laser Beam
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = ENGINE_LAWS.THEME.edges.widthBridge;
          ctx.globalAlpha = bridgeAlpha;
          ctx.stroke();

          // Dual Traveling High-Speed Photons
          for (let pIdx = 0; pIdx < 2; pIdx++) {
            const photonT = ((time * 0.001) + (pIdx * 0.5)) % 1.0;
            const px = source.x + (target.x - source.x) * photonT;
            const py = source.y + (target.y - source.y) * photonT;

            // Outer cyan halo
            ctx.beginPath();
            ctx.arc(px, py, 7.0, 0, Math.PI * 2);
            ctx.fillStyle = '#00f0ff';
            ctx.globalAlpha = 0.35 * bridgeAlpha;
            ctx.fill();

            // Inner intense white star
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.95 * bridgeAlpha;
            ctx.fill();
          }
        } else {
          // --- Structural Hierarchy / Neural Call Edge ---
          let strokeColor = isCall ? ENGINE_LAWS.THEME.edges.call : ENGINE_LAWS.THEME.edges.hierarchy;
          let lineWidth = isCall ? ENGINE_LAWS.THEME.edges.widthCall : ENGINE_LAWS.THEME.edges.widthHierarchy;
          let alpha = isCall ? 0.55 : ENGINE_LAWS.THEME.edges.opacityNormal;

          if (isFocusedEdge) {
            strokeColor = isCall ? ENGINE_LAWS.THEME.edges.callGlow : ENGINE_LAWS.THEME.edges.hierarchyGlow;
            lineWidth = ENGINE_LAWS.THEME.edges.widthHoverGlow;
            alpha = 1.0;
          } else if (isDimmed) {
            alpha = ENGINE_LAWS.THEME.edges.opacityDimmed;
          }

          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.globalAlpha = alpha * edgeSpawnAlpha;
          ctx.stroke();
        }

        ctx.restore();
      });

      // 3. RENDER CELESTIAL NODES
      activeNodes.forEach(node => {
        if (node.radius <= 0.2) return;

        const isHovered = hoveredNodeRef.current?.id === node.id;
        const isSelected = selectedNodeRef.current?.id === node.id;
        const isFocused = focusedNodeIds.has(node.id);
        const isDimmed = activeId && !isFocused;

        const nodeAlpha = isDimmed ? 0.04 : 1.0;

        ctx.save();
        ctx.globalAlpha = nodeAlpha;

        // Hovered/Selected Outer Aura
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
          ctx.fill();
        }

        // Main Node Disc
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = (isHovered || isSelected) ? '#60a5fa' : node.color;
        ctx.fill();

        // High-Risk Pulsing Ring
        if (node.risk === 'high') {
          const pulse = (Math.sin(time * 0.005) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 3 + pulse * 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Node Labels (Monospace font with LOD breakpoints)
        const isFolder = node.nodeType === 'folder';
        const isFile = node.nodeType === 'file';
        const shouldShow = showLabels && (isFolder || isHovered || isSelected || isFocused || (isFile && zoomRef.current > 0.6) || (!isFolder && !isFile && zoomRef.current > 1.1));

        if (shouldShow && (node.spawnProgress || 0) > 0.75) {
          ctx.font = isFolder 
            ? '600 13px ui-monospace, SFMono-Regular, Menlo, monospace' 
            : (isFile ? '500 11px ui-monospace, SFMono-Regular, Menlo, monospace' : '400 9.5px ui-monospace, SFMono-Regular, Menlo, monospace');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const labelY = node.y + node.radius + 4;
          const labelText = node.label || node.id;

          if (isHovered || isSelected || isFocused) {
            const metrics = ctx.measureText(labelText);
            const padX = 5;
            const padY = 2;
            ctx.fillStyle = 'rgba(10, 12, 16, 0.90)';
            ctx.strokeStyle = isHovered ? '#60a5fa' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.roundRect(node.x - metrics.width / 2 - padX, labelY - padY, metrics.width + padX * 2, 14 + padY * 2, 3);
            ctx.fill();
            ctx.stroke();
          }

          ctx.fillStyle = (isHovered || isSelected || isFocused)
            ? '#ffffff'
            : (isFolder ? '#fde047' : (isFile ? '#cbd5e1' : '#a78bfa'));

          ctx.fillText(labelText, node.x, labelY);
        }

        ctx.restore();
      });

      ctx.restore();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    renderTriggerRef.current = () => {
      cancelAnimationFrame(animFrameRef.current);
      prevTime = performance.now();
      animFrameRef.current = requestAnimationFrame(render);
    };

    if (isVisibleRef.current) {
      animFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      renderTriggerRef.current = null;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [showLabels]);

  // Precise Hit Testing for Pointer Drag and Click
  const findNodeAt = useCallback((screenX, screenY) => {
    const nodes = activeNodesRef.current || [];
    const zoom = zoomRef.current;
    const pan = panRef.current;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.radius <= 0) continue;
      const screenNodeX = n.x * zoom + pan.x;
      const screenNodeY = n.y * zoom + pan.y;
      const screenDist = Math.hypot(screenX - screenNodeX, screenY - screenNodeY);
      const hitRadius = Math.max(n.radius * zoom + 12, n.nodeType === 'folder' ? 32 : 18);
      if (screenDist <= hitRadius) return n;
    }
    return null;
  }, []);

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsCanvasFocused(true);

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    mouseRef.current.screenX = screenX;
    mouseRef.current.screenY = screenY;
    mouseRef.current.worldX = world.x;
    mouseRef.current.worldY = world.y;
    mouseRef.current.isDown = true;
    userInteractedRef.current = true;

    const hit = findNodeAt(screenX, screenY);
    if (hit) {
      setSelectedNode(hit);
      hit.fx = world.x;
      hit.fy = world.y;
      mouseRef.current.draggedNode = hit;
      mouseRef.current.dragOffset = {
        x: hit.x - world.x,
        y: hit.y - world.y
      };
      setIsDragging(true);

      // Awaken D3 simulation with responsive dragging alpha
      simulationRef.current?.alphaTarget(ENGINE_LAWS.PHYSICS.DRAGGING_ALPHA).restart();
    } else {
      setSelectedNode(null);
      mouseRef.current.isPanning = true;
      mouseRef.current.panStart = {
        x: screenX - panRef.current.x,
        y: screenY - panRef.current.y
      };
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    mouseRef.current.screenX = screenX;
    mouseRef.current.screenY = screenY;
    mouseRef.current.worldX = world.x;
    mouseRef.current.worldY = world.y;

    if (mouseRef.current.draggedNode) {
      const node = mouseRef.current.draggedNode;
      const offset = mouseRef.current.dragOffset || { x: 0, y: 0 };
      node.fx = world.x + offset.x;
      node.fy = world.y + offset.y;
      return;
    }

    if (mouseRef.current.isPanning) {
      userInteractedRef.current = true;
      panRef.current = {
        x: screenX - mouseRef.current.panStart.x,
        y: screenY - mouseRef.current.panStart.y
      };
      return;
    }

    const hit = findNodeAt(screenX, screenY);
    setHoveredNode(hit);
  };

  const handlePointerUp = (e) => {
    try {
      if (e?.target && e.pointerId !== undefined) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (mouseRef.current.draggedNode) {
      const node = mouseRef.current.draggedNode;
      node.fx = null;
      node.fy = null;
      mouseRef.current.draggedNode = null;
      setIsDragging(false);

      // Return simulation to gentle resting alpha
      simulationRef.current?.alphaTarget(ENGINE_LAWS.PHYSICS.RESTING_ALPHA);
    }
    mouseRef.current.isDown = false;
    mouseRef.current.isPanning = false;
  };

  const handlePointerLeave = (e) => {
    try {
      if (e?.target && e.pointerId !== undefined) {
        e.target.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
    mouseRef.current.screenX = -1000;
    mouseRef.current.screenY = -1000;
    mouseRef.current.worldX = -1000;
    mouseRef.current.worldY = -1000;
    mouseRef.current.isDown = false;
    mouseRef.current.isPanning = false;
    if (mouseRef.current.draggedNode) {
      const node = mouseRef.current.draggedNode;
      node.fx = null;
      node.fy = null;
      mouseRef.current.draggedNode = null;
      setIsDragging(false);
      simulationRef.current?.alphaTarget(ENGINE_LAWS.PHYSICS.RESTING_ALPHA);
    }
    setHoveredNode(null);
  };

  const handleZoomIn = () => {
    userInteractedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newZoom = Math.min(zoomRef.current * 1.25, 3.0);
    const centerScreenX = canvas.clientWidth / 2;
    const centerScreenY = canvas.clientHeight / 2;
    const worldCenter = screenToWorld(centerScreenX, centerScreenY);

    zoomRef.current = newZoom;
    panRef.current = {
      x: centerScreenX - worldCenter.x * newZoom,
      y: centerScreenY - worldCenter.y * newZoom
    };
    setZoomDisplay(Math.round(newZoom * 100));
  };

  const handleZoomOut = () => {
    userInteractedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newZoom = Math.max(zoomRef.current * 0.8, 0.18);
    const centerScreenX = canvas.clientWidth / 2;
    const centerScreenY = canvas.clientHeight / 2;
    const worldCenter = screenToWorld(centerScreenX, centerScreenY);

    zoomRef.current = newZoom;
    panRef.current = {
      x: centerScreenX - worldCenter.x * newZoom,
      y: centerScreenY - worldCenter.y * newZoom
    };
    setZoomDisplay(Math.round(newZoom * 100));
  };

  const handleResetZoom = () => {
    userInteractedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const defaultZoom = 0.95;
    zoomRef.current = defaultZoom;
    panRef.current = {
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2
    };
    setZoomDisplay(Math.round(defaultZoom * 100));
    simulationRef.current?.alpha(0.2).restart();
  };

  // Scaled radar minimap nodes matching SpatialMinimap.jsx
  const minimapNodes = useMemo(() => {
    const rawNodes = activeNodesRef.current || [];
    if (rawNodes.length === 0) return [];
    
    const svgWidth = 104;
    const svgHeight = 60;
    const span = 600;

    return rawNodes.map(n => {
      const isFolder = n.nodeType === 'folder';
      const isFile = n.nodeType === 'file';
      const normX = Math.max(0, Math.min(1, ((n.x || 0) + span / 2) / span));
      const normY = Math.max(0, Math.min(1, ((n.y || 0) + span / 2) / span));

      return {
        id: n.id,
        cx: 6 + normX * svgWidth,
        cy: 6 + normY * svgHeight,
        r: isFolder ? 2.6 : (isFile ? 1.6 : 1.0),
        color: n.color
      };
    });
  }, [activeNodesRef.current?.length]);

  const handleTerminalSubmit = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = terminalInput.trim();
      if (!cmd) return;
      if (cmd === 'clear' || cmd === 'cls') {
        setTerminalHistory([]);
        setTerminalInput('');
        return;
      }
      let output = '';
      if (cmd === 'git status') {
        output = 'On branch main\nYour branch is up to date with \'origin/main\'.\nChanges not staged for commit:\n  modified:   backend/ml/analyzer.py\n  modified:   frontend/canvas/PixiSpatialEngine.jsx';
      } else if (cmd === 'python -m backend.ml.analyzer') {
        output = '[Neuron ML] Louvain modularity detected 6 communities (Q=0.742).\n[Neuron Engine] Spatial Graph synchronized with 58 nodes and 56 links.';
      } else if (cmd.startsWith('help') || cmd === '?') {
        output = 'Available commands: git status, python -m backend.ml.analyzer, clear, ls, echo <text>';
      } else if (cmd.startsWith('echo ')) {
        output = cmd.slice(5);
      } else if (cmd === 'ls' || cmd === 'dir') {
        output = 'backend/   frontend/   server.py   README.md';
      } else {
        output = `'${cmd}' executed via spatial websocket bridge (exit code 0)`;
      }
      setTerminalHistory(prev => [...prev, { cmd, stdout: output }]);
      setTerminalInput('');
    }
  };

  return (
    <div 
      ref={containerRef}
      onBlur={() => setIsCanvasFocused(false)}
      className="w-full h-[620px] md:h-[680px] rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans select-none relative text-left border transition-colors duration-200"
      style={{
        backgroundColor: activeTheme.background,
        borderColor: activeTheme.border,
        color: activeTheme.textPrimary
      }}
    >
      {/* 1. TOP TITLEBAR */}
      <div 
        className="h-[42px] shrink-0 border-b flex items-center justify-between pl-3 pr-0 text-[12px] font-sans select-none z-[150] relative transition-colors duration-150"
        style={{
          backgroundColor: activeTheme.primary,
          borderColor: activeTheme.border,
          color: activeTheme.textPrimary
        }}
      >
        {/* Left: Logo + Dropdown Menus */}
        <div className="flex items-center gap-3">
          <div className="flex items-center pr-1 cursor-pointer" title="Neuron IDE">
            <img 
              src="/logo.png" 
              alt="Neuron" 
              className="h-5 w-5 object-contain opacity-95" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          <div className="flex items-center text-xs font-mono" ref={menuRef}>
            {['File', 'Edit', 'Layout', 'Help'].map((item) => (
              <div key={item} className="relative">
                <button 
                  onClick={() => setActiveMenu(activeMenu === item ? null : item)}
                  className="px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs"
                  style={{
                    backgroundColor: activeMenu === item ? activeTheme.surfaceActive : 'transparent',
                    color: activeMenu === item ? activeTheme.textBright : activeTheme.textSecondary
                  }}
                >
                  {item}
                </button>

                {activeMenu === item && (
                  <div 
                    className="absolute top-full left-0 mt-1 w-56 border shadow-2xl rounded-xl py-1.5 text-xs font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none z-[200]"
                    style={{
                      backgroundColor: activeTheme.secondary,
                      borderColor: activeTheme.borderSubtle,
                      color: activeTheme.textPrimary
                    }}
                  >
                    {item === 'File' && (
                      <>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>Open Workspace...</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+O</span>
                        </button>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>Save All</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+S</span>
                        </button>
                      </>
                    )}
                    {item === 'Edit' && (
                      <>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>Undo</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+Z</span>
                        </button>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>Redo</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+Y</span>
                        </button>
                      </>
                    )}
                    {item === 'Layout' && (
                      <>
                        <button 
                          onClick={() => { setIsSidebarOpen(!isSidebarOpen); setActiveMenu(null); }} 
                          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                        >
                          <span>Explorer Sidebar</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+B</span>
                        </button>
                        <button 
                          onClick={() => { setIsTerminalOpen(!isTerminalOpen); setActiveMenu(null); }} 
                          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                        >
                          <span>Integrated Terminal</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ctrl+`</span>
                        </button>
                      </>
                    )}
                    {item === 'Help' && (
                      <>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>Spatial IDE Architecture</span>
                        </button>
                        <button onClick={() => setActiveMenu(null)} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer text-left">
                          <span>WebGPU Physics Docs</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Title */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono opacity-70">
          <span>Neuron - Spatial IDE</span>
          <span className="opacity-40">·</span>
          <span className="text-blue-400">Louvain Nebula Engine</span>
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center h-full">
          <button className="w-10 h-full flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer text-slate-400 hover:text-white" title="Minimize">
            <Minus size={13} />
          </button>
          <button className="w-10 h-full flex items-center justify-center hover:bg-white/[0.06] transition-colors cursor-pointer text-slate-400 hover:text-white" title="Maximize">
            <Square size={11} />
          </button>
          <button className="w-10 h-full flex items-center justify-center hover:bg-[#e81123] transition-colors cursor-pointer text-slate-400 hover:text-white" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. WORKSPACE BODY: ActivityBar + Sidebar + Central Viewport */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ActivityBar */}
        <div 
          className="w-12 h-full border-r flex flex-col items-center justify-between py-2.5 shrink-0 z-40 select-none transition-colors duration-150"
          style={{
            backgroundColor: activeTheme.secondary,
            borderColor: activeTheme.border
          }}
        >
          {/* Top Actions */}
          <div className="flex flex-col gap-2 w-full items-center">
            {/* Explorer Toggle */}
            <button 
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setActiveSidebarView('explorer');
                } else if (activeSidebarView === 'explorer') {
                  setIsSidebarOpen(false);
                } else {
                  setActiveSidebarView('explorer');
                }
              }}
              className="p-2 rounded-xl transition-all relative group cursor-pointer"
              style={{
                color: isSidebarOpen && activeSidebarView === 'explorer' ? activeTheme.textBright : activeTheme.textMuted,
                backgroundColor: isSidebarOpen && activeSidebarView === 'explorer' ? activeTheme.surfaceHover : 'transparent'
              }}
              title="Explorer (Ctrl+B)"
            >
              {isSidebarOpen && activeSidebarView === 'explorer' && (
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                  style={{
                    backgroundColor: activeTheme.accent,
                    boxShadow: `0 0 8px ${activeTheme.accent}`
                  }}
                />
              )}
              <Files size={18} strokeWidth={1.6} />
            </button>

            {/* Git Branch Toggle */}
            <button 
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setActiveSidebarView('git');
                } else if (activeSidebarView === 'git') {
                  setIsSidebarOpen(false);
                } else {
                  setActiveSidebarView('git');
                }
              }}
              className="p-2 rounded-xl transition-all relative group cursor-pointer"
              style={{
                color: isSidebarOpen && activeSidebarView === 'git' ? activeTheme.textBright : activeTheme.textMuted,
                backgroundColor: isSidebarOpen && activeSidebarView === 'git' ? activeTheme.surfaceHover : 'transparent'
              }}
              title="Source Control"
            >
              <GitBranch size={18} strokeWidth={1.6} />
              <span 
                className="absolute -top-0.5 -right-0.5 px-1 min-w-[14px] h-[14px] rounded-full text-[9px] font-mono font-bold text-white flex items-center justify-center shadow"
                style={{ backgroundColor: activeTheme.accent }}
              >
                2
              </span>
            </button>

            {/* AI Studio */}
            <button 
              onClick={() => {
                if (!isSidebarOpen) {
                  setIsSidebarOpen(true);
                  setActiveSidebarView('ai');
                } else if (activeSidebarView === 'ai') {
                  setIsSidebarOpen(false);
                } else {
                  setActiveSidebarView('ai');
                }
              }}
              className="p-2 rounded-xl transition-all relative group cursor-pointer"
              style={{
                color: isSidebarOpen && activeSidebarView === 'ai' ? activeTheme.textBright : activeTheme.textMuted,
                backgroundColor: isSidebarOpen && activeSidebarView === 'ai' ? activeTheme.surfaceHover : 'transparent'
              }}
              title="Antigravity AI (Ctrl+Shift+A)"
            >
              <Sparkles size={18} strokeWidth={1.6} />
            </button>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col gap-2 w-full items-center relative">
            {/* Theme Selector Popover */}
            <div className="relative">
              <button 
                ref={themeButtonRef}
                onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
                className="p-2 rounded-xl transition-colors cursor-pointer"
                style={{
                  color: isThemePickerOpen ? activeTheme.textBright : activeTheme.textMuted,
                  backgroundColor: isThemePickerOpen ? activeTheme.surfaceHover : 'transparent'
                }}
                title="Color Themes"
              >
                <Palette size={18} strokeWidth={1.6} />
              </button>

              {isThemePickerOpen && (
                <div
                  ref={themePopoverRef}
                  className="absolute left-14 bottom-0 z-[250] flex items-center gap-2 px-2.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
                  style={{
                    backgroundColor: activeTheme.surface,
                    borderColor: activeTheme.border,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
                  }}
                >
                  {Object.entries(THEMES_MAP).map(([id, t]) => {
                    const isSelected = activeThemeId === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveThemeId(id);
                          setIsThemePickerOpen(false);
                        }}
                        className={`w-5 h-5 rounded-full cursor-pointer transition-all transform hover:scale-115 relative flex items-center justify-center shrink-0 ${
                          isSelected ? 'ring-2 ring-offset-2 scale-105' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: t.circleColor,
                          border: `1.5px solid ${t.circleBorder}`,
                          outline: 'none'
                        }}
                        title={t.name}
                      >
                        {isSelected && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: t.isDark ? '#ffffff' : '#000000' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button 
              className="p-2 rounded-xl transition-colors cursor-pointer"
              style={{ color: activeTheme.textMuted }}
              title="Preferences (Ctrl+,)"
            >
              <Settings size={18} strokeWidth={1.6} />
            </button>

            <div 
              className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-mono font-bold text-[10px] flex items-center justify-center uppercase shadow cursor-pointer"
              title="Developer Workspace"
            >
              N
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <div 
            className="w-52 border-r flex flex-col shrink-0 text-left overflow-hidden select-none transition-colors duration-150"
            style={{
              backgroundColor: activeTheme.secondary,
              borderColor: activeTheme.border,
              color: activeTheme.textPrimary
            }}
          >
            <div 
              className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b"
              style={{ borderColor: activeTheme.border }}
            >
              <span className="font-medium tracking-wide" style={{ color: activeTheme.textPrimary }}>Explorer</span>
              <div className="flex items-center gap-0.5">
                <button className="p-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer" style={{ color: activeTheme.textMuted }} title="New File">
                  <FilePlus size={13} />
                </button>
                <button className="p-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer" style={{ color: activeTheme.textMuted }} title="New Folder">
                  <FolderPlus size={13} />
                </button>
                <button 
                  onClick={handleRefactor}
                  className="p-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer" 
                  style={{ color: activeTheme.textMuted }} 
                  title="Resync Universe"
                >
                  <RefreshCw size={12} />
                </button>
                <button 
                  onClick={() => setOpenFolders({ neuron: true, backend: false, frontend: false })}
                  className="p-1 rounded hover:bg-white/[0.06] transition-colors cursor-pointer" 
                  style={{ color: activeTheme.textMuted }} 
                  title="Collapse All Folders"
                >
                  <ListCollapse size={13} />
                </button>
              </div>
            </div>

            {/* Root Workspace Toggler */}
            <div 
              onClick={() => setOpenFolders(p => ({ ...p, neuron: !p.neuron }))}
              className="px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider flex items-center gap-1 shrink-0 hover:bg-white/[0.04] cursor-pointer transition-colors select-none"
              style={{ color: activeTheme.textPrimary }}
            >
              {openFolders.neuron ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
              <span className="truncate font-bold">NEURON</span>
            </div>

            {openFolders.neuron && (
              <div className="flex-1 overflow-y-auto pb-4 font-mono text-[11px]">
                {/* backend folder */}
                <div 
                  onClick={() => setOpenFolders(p => ({ ...p, backend: !p.backend }))}
                  className="px-4 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  {openFolders.backend ? <ChevronDown size={12} className="text-slate-500 shrink-0" /> : <ChevronRight size={12} className="text-slate-500 shrink-0" />}
                  <Folder size={13} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                  <span className="truncate">backend</span>
                </div>
                {openFolders.backend && (
                  <div className="pl-6 space-y-0.5">
                    {/* api */}
                    <div 
                      onClick={() => setOpenFolders(p => ({ ...p, backendApi: !p.backendApi }))}
                      className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      {openFolders.backendApi ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                      <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                      <span className="truncate">api</span>
                    </div>
                    {openFolders.backendApi && (
                      <div className="pl-4 space-y-0.5">
                        <div onClick={() => setActiveDocTab('spatial')} className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-blue-400" />
                          <span className="truncate">websocket_router.py</span>
                        </div>
                      </div>
                    )}

                    {/* core */}
                    <div 
                      onClick={() => setOpenFolders(p => ({ ...p, backendCore: !p.backendCore }))}
                      className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      {openFolders.backendCore ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                      <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                      <span className="truncate">core</span>
                    </div>
                    {openFolders.backendCore && (
                      <div className="pl-4 space-y-0.5">
                        <div onClick={() => setActiveDocTab('parser')} className="px-2 py-0.5 flex items-center justify-between hover:bg-white/[0.04] cursor-pointer rounded">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode2 size={12} className="text-rose-400" />
                            <span className="truncate text-slate-300">parser.py</span>
                          </div>
                          <span className="text-[10px] text-rose-500 font-bold pr-1">!</span>
                        </div>
                        <div onClick={() => setActiveDocTab('parser')} className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-slate-500" />
                          <span className="truncate">mutator.py</span>
                        </div>
                        <div onClick={() => setActiveDocTab('parser')} className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-slate-500" />
                          <span className="truncate">state.py</span>
                        </div>
                      </div>
                    )}

                    {/* ml */}
                    <div 
                      onClick={() => setOpenFolders(p => ({ ...p, backendMl: !p.backendMl }))}
                      className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      {openFolders.backendMl ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                      <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                      <span className="truncate">ml</span>
                    </div>
                    {openFolders.backendMl && (
                      <div className="pl-4 space-y-0.5">
                        <div onClick={() => setActiveDocTab('analyzer')} className="px-2 py-0.5 flex items-center justify-between hover:bg-white/[0.04] cursor-pointer rounded">
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode2 size={12} className="text-purple-400" />
                            <span className="truncate text-slate-300">analyzer.py</span>
                          </div>
                          <span className="text-[10px] text-amber-500 font-bold pr-1">M</span>
                        </div>
                      </div>
                    )}

                    {/* services */}
                    <div 
                      onClick={() => setOpenFolders(p => ({ ...p, backendServices: !p.backendServices }))}
                      className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      {openFolders.backendServices ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                      <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                      <span className="truncate">services</span>
                    </div>
                    {openFolders.backendServices && (
                      <div className="pl-4 space-y-0.5">
                        <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-emerald-400" />
                          <span className="truncate">ai_service.py</span>
                        </div>
                        <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-emerald-400" />
                          <span className="truncate">terminal_service.py</span>
                        </div>
                      </div>
                    )}

                    <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                      <FileCode2 size={12} className="text-slate-500" />
                      <span className="truncate">main.py</span>
                    </div>
                  </div>
                )}

                {/* frontend folder */}
                <div 
                  onClick={() => setOpenFolders(p => ({ ...p, frontend: !p.frontend }))}
                  className="px-4 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  {openFolders.frontend ? <ChevronDown size={12} className="text-slate-500 shrink-0" /> : <ChevronRight size={12} className="text-slate-500 shrink-0" />}
                  <Folder size={13} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                  <span className="truncate">frontend</span>
                </div>
                {openFolders.frontend && (
                  <div className="pl-6 space-y-0.5">
                    {/* src */}
                    <div 
                      onClick={() => setOpenFolders(p => ({ ...p, frontendSrc: !p.frontendSrc }))}
                      className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      {openFolders.frontendSrc ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                      <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                      <span className="truncate">src</span>
                    </div>
                    {openFolders.frontendSrc && (
                      <div className="pl-4 space-y-0.5">
                        {/* components */}
                        <div 
                          onClick={() => setOpenFolders(p => ({ ...p, frontendComponents: !p.frontendComponents }))}
                          className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                        >
                          {openFolders.frontendComponents ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                          <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                          <span className="truncate">components</span>
                        </div>
                        {openFolders.frontendComponents && (
                          <div className="pl-4 space-y-0.5">
                            <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                              <FileCode2 size={12} className="text-yellow-400" />
                              <span className="truncate">CodeEditor.jsx</span>
                            </div>
                            <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                              <FileCode2 size={12} className="text-yellow-400" />
                              <span className="truncate">TerminalPanel.jsx</span>
                            </div>
                            <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                              <FileCode2 size={12} className="text-yellow-400" />
                              <span className="truncate">TopBar.jsx</span>
                            </div>
                          </div>
                        )}

                        {/* hooks */}
                        <div 
                          onClick={() => setOpenFolders(p => ({ ...p, frontendHooks: !p.frontendHooks }))}
                          className="px-2 py-0.5 flex items-center gap-1.5 hover:bg-white/[0.04] cursor-pointer"
                        >
                          {openFolders.frontendHooks ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                          <Folder size={12} style={{ color: activeTheme.folderIcon }} className="shrink-0" />
                          <span className="truncate">hooks</span>
                        </div>
                        {openFolders.frontendHooks && (
                          <div className="pl-4 space-y-0.5">
                            <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                              <FileCode2 size={12} className="text-orange-400" />
                              <span className="truncate">usePhysicsEngine.js</span>
                            </div>
                            <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                              <FileCode2 size={12} className="text-orange-400" />
                              <span className="truncate">useWorkspace.js</span>
                            </div>
                          </div>
                        )}

                        {/* App.jsx */}
                        <div 
                          onClick={() => setActiveDocTab('app')}
                          className={`px-2 py-0.5 flex items-center justify-between cursor-pointer rounded ${activeDocTab === 'app' ? 'bg-blue-600/20 text-blue-400 font-medium' : 'hover:bg-white/[0.04] text-slate-300'}`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode2 size={12} className={activeDocTab === 'app' ? 'text-blue-400' : 'text-pink-400'} />
                            <span className="truncate">App.jsx</span>
                          </div>
                          <span className="text-[10px] text-emerald-500 font-bold pr-1">Live</span>
                        </div>

                        {/* main.jsx */}
                        <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                          <FileCode2 size={12} className="text-pink-400" />
                          <span className="truncate">main.jsx</span>
                        </div>
                      </div>
                    )}

                    <div className="px-2 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                      <FileCode2 size={12} className="text-slate-500" />
                      <span className="truncate">package.json</span>
                    </div>
                  </div>
                )}

                {/* README.md */}
                <div className="px-4 py-0.5 flex items-center gap-1.5 text-slate-400 hover:bg-white/[0.04] cursor-pointer rounded">
                  <FileCode2 size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate">README.md</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Central Viewport */}
        <div 
          className="flex-1 flex flex-col relative overflow-hidden text-left"
          style={{ backgroundColor: activeTheme.background }}
        >
          {/* Document Tab Strip */}
          <div 
            className="h-8 shrink-0 border-b flex items-center justify-between select-none"
            style={{
              backgroundColor: activeTheme.secondary,
              borderColor: activeTheme.border
            }}
          >
            <div className="flex items-center h-full">
              {/* Spatial Map Tab */}
              <button
                onClick={() => setActiveDocTab('spatial')}
                className={`h-full px-3 flex items-center gap-2 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                  activeDocTab === 'spatial' ? 'font-semibold border-t-2' : 'hover:text-white'
                }`}
                style={{
                  backgroundColor: activeDocTab === 'spatial' ? activeTheme.background : activeTheme.secondary,
                  borderColor: activeTheme.border,
                  borderTopColor: activeDocTab === 'spatial' ? activeTheme.accent : 'transparent',
                  color: activeDocTab === 'spatial' ? activeTheme.textBright : activeTheme.textSecondary
                }}
              >
                <Network size={13} style={{ color: activeDocTab === 'spatial' ? activeTheme.accent : undefined }} />
                <span>Spatial Map</span>
              </button>

              {/* parser.py Tab */}
              <button
                onClick={() => setActiveDocTab('parser')}
                className={`h-full px-3 flex items-center gap-2 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                  activeDocTab === 'parser' ? 'font-semibold border-t-2' : 'hover:text-white'
                }`}
                style={{
                  backgroundColor: activeDocTab === 'parser' ? activeTheme.background : activeTheme.secondary,
                  borderColor: activeTheme.border,
                  borderTopColor: activeDocTab === 'parser' ? activeTheme.accent : 'transparent',
                  color: activeDocTab === 'parser' ? activeTheme.textBright : activeTheme.textSecondary
                }}
              >
                <FileCode2 size={13} style={{ color: activeDocTab === 'parser' ? activeTheme.accent : undefined }} />
                <span>parser.py</span>
              </button>

              {/* App.jsx Tab */}
              <button
                onClick={() => setActiveDocTab('app')}
                className={`h-full px-3 flex items-center gap-2 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                  activeDocTab === 'app' ? 'font-semibold border-t-2' : 'hover:text-white'
                }`}
                style={{
                  backgroundColor: activeDocTab === 'app' ? activeTheme.background : activeTheme.secondary,
                  borderColor: activeTheme.border,
                  borderTopColor: activeDocTab === 'app' ? activeTheme.accent : 'transparent',
                  color: activeDocTab === 'app' ? activeTheme.textBright : activeTheme.textSecondary
                }}
              >
                <FileCode2 size={13} style={{ color: activeDocTab === 'app' ? activeTheme.accent : undefined }} />
                <span>App.jsx</span>
              </button>

              {/* analyzer.py Tab */}
              <button
                onClick={() => setActiveDocTab('analyzer')}
                className={`h-full px-3 flex items-center gap-2 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                  activeDocTab === 'analyzer' ? 'font-semibold border-t-2' : 'hover:text-white'
                }`}
                style={{
                  backgroundColor: activeDocTab === 'analyzer' ? activeTheme.background : activeTheme.secondary,
                  borderColor: activeTheme.border,
                  borderTopColor: activeDocTab === 'analyzer' ? activeTheme.accent : 'transparent',
                  color: activeDocTab === 'analyzer' ? activeTheme.textBright : activeTheme.textSecondary
                }}
              >
                <FileCode2 size={13} style={{ color: activeDocTab === 'analyzer' ? activeTheme.accent : undefined }} />
                <span>analyzer.py</span>
              </button>
            </div>

            {/* Run Button (F5) */}
            <div className="flex items-center pr-3">
              <button 
                onClick={handleRefactor}
                className="w-7 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer" 
                title="Trigger Procedural Emergence (F5)"
              >
                <Play size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Canvas HUD Header */}
          {activeDocTab === 'spatial' && (
            <div 
              className="h-8 border-b flex items-center justify-between px-3 text-xs shrink-0"
              style={{
                backgroundColor: activeTheme.primary,
                borderColor: activeTheme.border
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">WebGPU Active</span>
                <span className="opacity-40">·</span>
                <span className="text-[11px] font-mono" style={{ color: activeTheme.textMuted }}>
                  Louvain Modularity: 6 Nebulae
                </span>
              </div>

              {/* HUD Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1"
                  style={{
                    backgroundColor: showLabels ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderColor: activeTheme.border,
                    color: showLabels ? activeTheme.textBright : activeTheme.textMuted
                  }}
                  title="Toggle node label visibility"
                >
                  <Type size={11} />
                  <span>{showLabels ? 'Labels: ON' : 'Labels: OFF'}</span>
                </button>

                <div className="flex items-center rounded border" style={{ borderColor: activeTheme.border, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-white/[0.08] transition-colors cursor-pointer"
                    style={{ color: activeTheme.textSecondary }}
                    title="Zoom in"
                  >
                    <ZoomIn size={12} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-white/[0.08] transition-colors cursor-pointer"
                    style={{ color: activeTheme.textSecondary }}
                    title="Zoom out"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer border-l"
                    style={{ borderColor: activeTheme.border, color: activeTheme.textMuted }}
                    title="Reset zoom"
                  >
                    {Math.round(zoomDisplay)}%
                  </button>
                </div>

                <button
                  onClick={handleRefactor}
                  className="px-2 py-0.5 rounded border transition-all cursor-pointer text-[10px] font-mono flex items-center gap-1"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderColor: activeTheme.border,
                    color: activeTheme.textSecondary
                  }}
                  title="Refactor graph with procedural BFS emission"
                >
                  <RotateCcw size={10} />
                  <span>Refactor</span>
                </button>
              </div>
            </div>
          )}

          {/* Viewport Content */}
          <div className="flex-1 w-full h-full relative overflow-hidden">
            {activeDocTab === 'spatial' ? (
              <>
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  className={`w-full h-full block touch-none ${isDragging ? 'cursor-grabbing' : (hoveredNode ? 'cursor-pointer' : 'cursor-default')}`}
                />

                {/* Spatial Radar Minimap */}
                <div 
                  className="absolute bottom-3 right-3 z-30 w-32 h-20 rounded-xl border shadow-xl overflow-hidden pointer-events-none select-none backdrop-blur-md flex items-center justify-center p-1.5 animate-in fade-in zoom-in-95 duration-200"
                  style={{
                    backgroundColor: activeTheme.surface,
                    borderColor: activeTheme.border,
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
                  }}
                >
                  <svg width="100%" height="100%" className="overflow-visible">
                    {minimapNodes.map(mn => (
                      <circle key={mn.id} cx={mn.cx} cy={mn.cy} r={mn.r} fill={mn.color} opacity={0.85} />
                    ))}
                  </svg>
                </div>

                {/* Scroll Hint Toast */}
                {showScrollHint && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20 transition-opacity duration-200">
                    <div className="px-3 py-1 bg-black/80 backdrop-blur border border-white/15 rounded-full text-[11px] font-mono text-slate-300 shadow-xl flex items-center gap-1.5">
                      <span className="px-1 py-0.2 bg-white/10 rounded text-[10px] text-slate-200">Ctrl</span>
                      <span>+ scroll to zoom graph</span>
                    </div>
                  </div>
                )}
              </>
            ) : activeDocTab === 'app' ? (
              /* Code Editor View for App.jsx */
              <div 
                className="w-full h-full p-4 overflow-y-auto font-mono text-xs select-text"
                style={{
                  backgroundColor: activeTheme.background,
                  color: activeTheme.textPrimary
                }}
              >
                <div className="space-y-1 leading-relaxed">
                  <p className="text-slate-500">// frontend/src/App.jsx - Spatial IDE Entry & WebGPU Root</p>
                  <p><span className="text-purple-400">import</span> React, &#123; useState, useEffect, useRef &#125; <span className="text-purple-400">from</span> <span className="text-emerald-400">'react'</span>;</p>
                  <p><span className="text-purple-400">import</span> PixiSpatialEngine <span className="text-purple-400">from</span> <span className="text-emerald-400">'./components/canvas/PixiSpatialEngine'</span>;</p>
                  <p><span className="text-purple-400">import</span> &#123; useWorkspace &#125; <span className="text-purple-400">from</span> <span className="text-emerald-400">'./hooks/useWorkspace'</span>;</p>
                  <p><span className="text-purple-400">import</span> &#123; usePhysicsEngine &#125; <span className="text-purple-400">from</span> <span className="text-emerald-400">'./hooks/usePhysicsEngine'</span>;</p>
                  <br />
                  <p><span className="text-blue-400">export default function</span> <span className="text-amber-400">NeuronApp</span>() &#123;</p>
                  <p className="pl-4 text-slate-300">const &#123; workspace, activeGraph, syncRefactor &#125; = <span className="text-blue-400">useWorkspace</span>();</p>
                  <p className="pl-4 text-slate-300">const &#123; physicsWorld, emitNode &#125; = <span className="text-blue-400">usePhysicsEngine</span>();</p>
                  <br />
                  <p className="pl-4"><span className="text-blue-400">useEffect</span>(() =&gt; &#123;</p>
                  <p className="pl-8 text-slate-400">console.log(<span className="text-emerald-400">'[Neuron] Spatial IDE initialized with WebGPU physics acceleration.'</span>);</p>
                  <p className="pl-4 text-slate-300">&#125;, []);</p>
                  <br />
                  <p className="pl-4 text-purple-400">return (</p>
                  <p className="pl-8 text-slate-300">&lt;<span className="text-blue-400">div</span> <span className="text-amber-300">className</span>=<span className="text-emerald-400">"neuron-spatial-ide flex h-screen w-screen"</span>&gt;</p>
                  <p className="pl-12 text-slate-300">&lt;<span className="text-blue-400">PixiSpatialEngine</span> <span className="text-amber-300">graph</span>=&#123;activeGraph&#125; /&gt;</p>
                  <p className="pl-8 text-slate-300">&lt;/<span className="text-blue-400">div</span>&gt;</p>
                  <p className="pl-4 text-purple-400">);</p>
                  <p className="text-slate-300">&#125;</p>
                </div>
              </div>
            ) : activeDocTab === 'analyzer' ? (
              /* Code Editor View for analyzer.py */
              <div 
                className="w-full h-full p-4 overflow-y-auto font-mono text-xs select-text"
                style={{
                  backgroundColor: activeTheme.background,
                  color: activeTheme.textPrimary
                }}
              >
                <div className="space-y-1 leading-relaxed">
                  <p className="text-slate-500"># backend/ml/analyzer.py - Louvain Modularity & Centrality</p>
                  <p><span className="text-purple-400">import</span> networkx <span className="text-purple-400">as</span> nx</p>
                  <p><span className="text-purple-400">from</span> networkx.algorithms.community <span className="text-purple-400">import</span> louvain_communities</p>
                  <p><span className="text-purple-400">import</span> numpy <span className="text-purple-400">as</span> np</p>
                  <br />
                  <p><span className="text-blue-400">def</span> <span className="text-amber-400">analyze_graph_ml</span>(nodes: list, edges: list) -&gt; dict:</p>
                  <p className="pl-4 text-slate-300">G = nx.Graph()</p>
                  <p className="pl-4 text-slate-300">DiG = nx.DiGraph()</p>
                  <p className="pl-4 text-slate-500"># Build dual graph topology with semantic edge weights</p>
                  <p className="pl-4"><span className="text-purple-400">for</span> e <span className="text-purple-400">in</span> edges:</p>
                  <p className="pl-8 text-slate-300">w = 60.0 <span className="text-purple-400">if</span> e.get(<span className="text-emerald-400">"type"</span>) == <span className="text-emerald-400">"network_bridge"</span> <span className="text-purple-400">else</span> 40.0</p>
                  <p className="pl-8 text-slate-300">G.add_edge(e[<span className="text-emerald-400">"source"</span>], e[<span className="text-emerald-400">"target"</span>], weight=w)</p>
                  <p className="pl-8 text-slate-300">DiG.add_edge(e[<span className="text-emerald-400">"source"</span>], e[<span className="text-emerald-400">"target"</span>], weight=w)</p>
                  <br />
                  <p className="pl-4 text-slate-500"># Adaptive Louvain Modularity Clustering</p>
                  <p className="pl-4 text-slate-300">communities = louvain_communities(G, weight=<span className="text-emerald-400">'weight'</span>, resolution=1.05, seed=42)</p>
                  <p className="pl-4 text-slate-300">pagerank = nx.pagerank(DiG, alpha=0.85, weight=<span className="text-emerald-400">'weight'</span>)</p>
                  <p className="pl-4 text-slate-300">betweenness = nx.betweenness_centrality(G, weight=<span className="text-emerald-400">'weight'</span>)</p>
                  <p className="pl-4 text-purple-400">return &#123;<span className="text-emerald-400">"communities"</span>: communities, <span className="text-emerald-400">"pagerank"</span>: pagerank&#125;</p>
                </div>
              </div>
            ) : (
              /* Code Editor View for parser.py */
              <div 
                className="w-full h-full p-4 overflow-y-auto font-mono text-xs select-text"
                style={{
                  backgroundColor: activeTheme.background,
                  color: activeTheme.textPrimary
                }}
              >
                <div className="space-y-1 leading-relaxed">
                  <p className="text-slate-500"># backend/core/parser.py - AST Extraction & Call Graph</p>
                  <p><span className="text-purple-400">import</span> ast</p>
                  <p><span className="text-purple-400">from</span> typing <span className="text-purple-400">import</span> Dict, List, Any</p>
                  <br />
                  <p><span className="text-blue-400">class</span> <span className="text-amber-400">CodebaseASTParser</span>:</p>
                  <p className="pl-4"><span className="text-blue-400">def</span> <span className="text-amber-400">__init__</span>(self, root_path: str):</p>
                  <p className="pl-8 text-slate-300">self.root_path = root_path</p>
                  <p className="pl-8 text-slate-300">self.graph = &#123;"nodes": [], "edges": []&#125;</p>
                  <br />
                  <p className="pl-4"><span className="text-blue-400">def</span> <span className="text-amber-400">parse_ast</span>(self, file_content: str) -&gt; Dict[str, Any]:</p>
                  <p className="pl-8 text-slate-300">tree = ast.parse(file_content)</p>
                  <p className="pl-8 text-slate-300">symbols = self.extract_symbols(tree)</p>
                  <p className="pl-8 text-purple-400">return &#123;"ast": tree, "symbols": symbols&#125;</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Terminal Panel */}
          {isTerminalOpen && (
            <div 
              className="h-24 shrink-0 border-t flex flex-col font-mono text-xs select-none transition-colors duration-150"
              style={{
                backgroundColor: activeTheme.secondary,
                borderColor: activeTheme.border,
                color: activeTheme.textPrimary
              }}
            >
              {/* Terminal Header */}
              <div 
                className="h-7 shrink-0 border-b flex items-center justify-between px-0 select-none"
                style={{ borderColor: activeTheme.border }}
              >
                <div className="flex items-center h-full">
                  <button 
                    onClick={() => setActiveTerminalTab('output')}
                    className={`h-full px-3 flex items-center text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                      activeTerminalTab === 'output' ? 'font-semibold border-t-2' : 'hover:text-white'
                    }`}
                    style={{
                      backgroundColor: activeTerminalTab === 'output' ? activeTheme.background : activeTheme.secondary,
                      borderColor: activeTheme.border,
                      borderTopColor: activeTerminalTab === 'output' ? activeTheme.accent : 'transparent',
                      color: activeTerminalTab === 'output' ? activeTheme.accent : activeTheme.textSecondary
                    }}
                  >
                    Output
                  </button>

                  <button 
                    onClick={() => setActiveTerminalTab('powershell')}
                    className={`h-full px-3 flex items-center gap-1.5 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer ${
                      activeTerminalTab === 'powershell' ? 'font-semibold border-t-2' : 'hover:text-white'
                    }`}
                    style={{
                      backgroundColor: activeTerminalTab === 'powershell' ? activeTheme.background : activeTheme.secondary,
                      borderColor: activeTheme.border,
                      borderTopColor: activeTerminalTab === 'powershell' ? activeTheme.accent : 'transparent',
                      color: activeTerminalTab === 'powershell' ? activeTheme.accent : activeTheme.textSecondary
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    powershell
                  </button>
                </div>

                <div className="flex items-center pr-2 gap-1">
                  <button 
                    onClick={() => setTerminalHistory([])}
                    className="p-1 rounded hover:bg-white/[0.08] transition-colors cursor-pointer text-slate-400 hover:text-white"
                    title="Clear Terminal"
                  >
                    <RefreshCw size={11} />
                  </button>
                  <button 
                    onClick={() => setIsTerminalOpen(false)}
                    className="p-1 rounded hover:bg-white/[0.08] transition-colors cursor-pointer text-slate-400 hover:text-white"
                    title="Close Terminal"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Terminal Logs & Input */}
              <div className="flex-1 overflow-y-auto px-3 py-1.5 text-[11px] font-mono space-y-1">
                {activeTerminalTab === 'powershell' ? (
                  <>
                    {terminalHistory.map((item, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-300">
                          <span className="text-emerald-400">PS C:\Neuron&gt;</span>
                          <span>{item.cmd}</span>
                        </div>
                        {item.stdout && (
                          <pre className="text-slate-400 whitespace-pre-wrap font-mono pl-3 text-[10.5px]">
                            {item.stdout}
                          </pre>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-slate-300 pt-0.5">
                      <span className="text-emerald-400 shrink-0">PS C:\Neuron&gt;</span>
                      <input 
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalSubmit}
                        placeholder="Type 'python -m backend.ml.analyzer' or 'help'..."
                        className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400 space-y-1">
                    <p className="text-blue-400">[Neuron Engine] Spatial Graph synchronized with 58 nodes and 6 community nebulae.</p>
                    <p className="text-emerald-400">[WebGPU] Hardware acceleration verified at 300 FPS.</p>
                    <p className="text-slate-500">[Diagnostics] 0 syntax errors detected.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. STATUS BAR */}
      <div 
        className="h-6 shrink-0 border-t flex items-center justify-between px-3 text-[11px] font-mono select-none z-50 transition-colors duration-150"
        style={{
          backgroundColor: activeTheme.secondary,
          borderColor: activeTheme.border,
          color: activeTheme.textSecondary
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2 h-full overflow-hidden">
          <button 
            onClick={handleResetZoom}
            className="hover:text-blue-400 transition-colors cursor-pointer"
            title="Center Spatial Map on Active Bridges"
          >
            <span>3 bridges</span>
          </button>
          <span className="opacity-40">·</span>
          <span>58 nodes · 56 links</span>
          <span className="opacity-40">·</span>
          <span>6 nebulae</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5 h-full shrink-0">
          <div className="flex items-center gap-1 text-[10px]">
            <GitBranch size={11} className="text-blue-400" />
            <span className="text-slate-300 hover:text-white cursor-pointer">main*</span>
          </div>

          <span className="opacity-40">·</span>
          <div className="flex items-center gap-1 text-[10px]">
            <CheckCircle2 size={10} className="text-emerald-500" />
            <span>Saved</span>
          </div>

          <span className="opacity-40 hidden sm:inline">·</span>
          <button 
            onClick={handleRefactor}
            className="text-[10px] hover:text-white transition-colors font-mono flex items-center gap-1 cursor-pointer"
          >
            <span>Refactor:</span>
            <span className="text-blue-400 font-semibold">ON</span>
          </button>

          <span className="opacity-40 hidden sm:inline">·</span>
          <div className="text-[10px] font-mono flex items-center gap-1">
            <span className="hidden sm:inline">Blast:</span>
            <span className="text-blue-400 font-semibold">ON</span>
          </div>

          <span className="opacity-40 hidden md:inline">·</span>
          <div className="text-[10px] hidden md:flex">
            Ln 42, Col 1
          </div>

          <span className="opacity-40 hidden sm:inline">·</span>
          <div className="text-[10px] uppercase hidden sm:flex">
            UTF-8
          </div>

          <span className="opacity-40">·</span>
          <div className="text-[10px]">
            <span>{activeDocTab === 'spatial' ? 'Spatial Map' : 'Python'}</span>
          </div>

          <span className="opacity-40">·</span>
          <div className="relative flex items-center">
            <Bell size={12} className="text-slate-400 hover:text-white cursor-pointer" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
