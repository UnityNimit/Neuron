import { useState, useMemo, useEffect } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';
import Footer from '../components/Footer';
import { useDocsSearch } from '../context/DocsSearchContext';

// --- COMPREHENSIVE DOCUMENTATION REGISTRY (Inspired by media_1789742450965.png & media_1789742457799.png) ---
const DOCS_DATA = {
  'welcome': {
    category: 'Get Started',
    title: 'Welcome to Neuron',
    subtitle: 'Neuron is an applied AI and graph machine learning development environment that visualizes Python and JavaScript codebases onto a high-performance 2D spatial canvas.',
    sections: [
      {
        id: 'core-philosophy',
        title: 'Core Philosophy',
        desc: 'Traditional text editors treat source code as linear flat files. Neuron models your codebase as an interconnected topological graph.',
        points: [
          { label: 'Spatial Comprehension', text: 'Navigate functions, imports, and classes as visual 2D nodes organized by structural relationship.' },
          { label: '100% Localhost Execution', text: 'Tree-Sitter parsing, NetworkX clustering, and physics simulation run completely on your workstation with zero telemetry.' },
          { label: 'Bidirectional Synchronization', text: 'Edits in physical files immediately re-relax the spatial graph, while dragging and connecting nodes updates AST conduits.' }
        ]
      },
      {
        id: 'workstation-requirements',
        title: 'System Requirements',
        desc: 'Neuron is optimized for multi-core workstations with dedicated hardware acceleration.',
        points: [
          { label: 'Operating System', text: 'Windows 10 / 11 (64-bit x64 architecture).' },
          { label: 'Graphics Acceleration', text: 'DirectX 12 or Vulkan compatible GPU with WebGPU hardware acceleration.' },
          { label: 'Runtime Dependency', text: 'Zero external dependencies required. Standalone desktop installer packages all necessary runtimes.' }
        ]
      }
    ]
  },

  'quickstart': {
    category: 'Get Started',
    title: 'Quickstart Guide',
    subtitle: 'Get up and running with Neuron in under two minutes.',
    sections: [
      {
        id: 'installation-steps',
        title: 'Installation',
        desc: 'Follow these steps to launch the native desktop application:',
        points: [
          { label: '1. Download Installer', text: 'Grab the latest release from the Downloads page (Neuron-Setup.exe).' },
          { label: '2. Launch Setup', text: 'Run the setup file. Neuron installs cleanly into your local user app directory without administrator privileges.' },
          { label: '3. Open Workspace', text: 'Click File -> Open Project and select any repository folder containing Python or JavaScript code.' },
          { label: '4. Initial AST Index', text: 'The local Tree-Sitter daemon parses all abstract syntax trees and renders the initial 2D spatial layout in under 500ms.' }
        ]
      },
      {
        id: 'navigating-canvas',
        title: 'Navigating the Spatial Canvas',
        desc: 'Basic viewport navigation controls:',
        points: [
          { label: 'Pan & Scroll', text: 'Click and drag on empty canvas space to pan across your codebase graph.' },
          { label: 'Zoom In / Out', text: 'Use the mouse scroll wheel or top-right +/- controls to scale between macro architecture and individual AST symbols.' },
          { label: 'Focus Isolation', text: 'Click any node to focus its immediate callers, callees, and Louvain modularity neighborhood while dimming unrelated nodes.' }
        ]
      }
    ]
  },

  'architecture': {
    category: 'Get Started',
    title: 'Localhost Architecture',
    subtitle: 'A decoupled, high-performance architecture engineered for sub-millisecond AST responsiveness.',
    sections: [
      {
        id: 'subsystems',
        title: 'Engine Subsystems',
        desc: 'Neuron combines low-level native parsing with hardware-accelerated rendering:',
        points: [
          { label: 'Tree-Sitter Daemon', text: 'In-memory multi-language parsing engine executing queries in under 4ms per module.' },
          { label: 'Pure-RAM D3 Relaxation', text: 'Force-directed spring equilibrium running on worker threads without React DOM rendering bottlenecks.' },
          { label: 'Neuron Agent Runtime', text: 'Local agent supervisor coordinating BYOK prompts with concrete AST context.' },
          { label: 'Local SQLite Store', text: 'Transactional caching of code embeddings and modularity partitions with zero cloud ingestion.' }
        ]
      }
    ]
  },

  'changelog': {
    category: 'Get Started',
    title: 'Changelog',
    subtitle: 'Milestones, performance improvements, and release notes for Neuron.',
    sections: [
      {
        id: 'v100-beta',
        title: 'v1.0.0 Beta Release',
        desc: 'Released September 2026',
        points: [
          { label: 'Spatial Canvas Engine', text: 'Full bidirectional mapping between physical filesystems and real-time 2D AST topological graphs.' },
          { label: 'Localhost Architecture', text: '100% on-device Tree-Sitter AST parsing, NetworkX modularity clustering, and physics relaxation.' },
          { label: 'Multi-Language Support', text: 'First-class AST intelligence for Python, JavaScript, TypeScript, and modern web frameworks.' },
          { label: 'Autonomous Agent Studio', text: 'Context-aware LLM agents orchestrated with concrete AST topological graph context.' }
        ]
      }
    ]
  },

  'spatial-overview': {
    category: 'Spatial Engine',
    title: 'Spatial Canvas Engine',
    subtitle: 'Observability beyond the flat file tree. Inspect code as an interconnected 2D topological graph.',
    sections: [
      {
        id: 'node-types',
        title: 'Topological Node Semantics',
        desc: 'Every node in the spatial canvas represents a distinct structural unit:',
        points: [
          { label: 'Blue Module Nodes', text: 'Represent directory containers and package boundaries (e.g. Coding_Skills/, backend/).' },
          { label: 'Gold File Nodes', text: 'Represent physical files (.py, .jsx, .ts) with 1-to-1 synchronization to the explorer.' },
          { label: 'Purple Symbol Nodes', text: 'Represent callable functions, class declarations, and decorated API endpoints.' },
          { label: 'Red Risk Nodes', text: 'Highlight high-cyclomatic complexity functions, unbounded loops, or God object anti-patterns.' },
          { label: 'Emerald Invariant Nodes', text: 'Signify pure functions, verified cache layers, and deterministic utility routines.' }
        ]
      }
    ]
  },

  'physics-relaxation': {
    category: 'Spatial Engine',
    title: 'Physics & Graph Relaxation',
    subtitle: 'Calm, balanced force-directed spring equilibrium that groups related code without erratic behavior.',
    sections: [
      {
        id: 'physics-rules',
        title: 'Relaxation Mechanics',
        desc: 'How the physical simulation keeps your canvas balanced and readable:',
        points: [
          { label: 'Hooke Spring Attraction', text: 'Edges exert spring forces (K = 0.0035) drawing dependent symbols together.' },
          { label: 'Coulomb Repulsion', text: 'Moderate repulsive forces (1400 / distSq) prevent node overlap while preserving natural clustering.' },
          { label: 'No Mouse Avoidance', text: 'Nodes do not flee when touched or hovered, allowing precise clicking, dragging, and pin operations.' },
          { label: 'Manual Pinning', text: 'Drag any node to a custom coordinate; pinned nodes anchor surrounding call conduits in place.' }
        ]
      }
    ]
  },

  'louvain-clusters': {
    category: 'Spatial Engine',
    title: 'Louvain Modularity Partitioning',
    subtitle: 'Unsupervised graph machine learning to detect implicit microservice boundaries and tight clusters.',
    sections: [
      {
        id: 'louvain-computation',
        title: 'Community Detection',
        desc: 'How Neuron partitions monolithic repositories:',
        points: [
          { label: 'Modularity Optimization', text: 'NetworkX Louvain algorithms evaluate adjacency matrices to find partitions with modularity Q > 0.8.' },
          { label: 'Ambient Color Clouds', text: 'Clusters receive distinct radial glow halos (Coding_Skills, backend, frontend, root).' },
          { label: 'Coupling Warnings', text: 'Long-range call conduits between distant clusters are visually flagged to prevent architectural rot.' }
        ]
      }
    ]
  },

  'agent-overview': {
    category: 'Agent',
    title: 'Autonomous Agents & BYOK Integration',
    subtitle: 'Integrated agent supervisor capable of reasoning over your entire abstract syntax tree. Neuron does not vend or host models—bring your own keys or run locally.',
    sections: [
      {
        id: 'byok-architecture',
        title: 'BYOK (Bring Your Own Key) & Offline Runtimes',
        desc: 'Neuron does not mark up token pricing, vend AI models, or proxy user requests:',
        points: [
          { label: 'Zero Model Markup', text: 'Neuron does not vend proprietary models or charge subscriptions for token usage. You connect directly to API providers.' },
          { label: 'Direct API Key Connections', text: 'Use your own API keys for Google Gemini (3.8, 3.7, 3.6, 3.1 Pro), Anthropic Claude (Sonnet 4.6, Opus 4.6), OpenAI, and Groq.' },
          { label: 'Local Offline Inference', text: 'Connect locally running models via Ollama (qwen2.5-coder, deepseek-coder, llama3) with zero internet connectivity and zero telemetry.' },
          { label: 'Local Encrypted Keychain', text: 'API keys are stored exclusively in your local OS credential vault, never transmitted to any Neuron server.' }
        ]
      },
      {
        id: 'agent-capabilities',
        title: 'Core Capabilities',
        desc: 'Neuron agents go beyond simple text autocomplete:',
        points: [
          { label: 'Topological Context', text: 'Perceives upstream callers and downstream callees before generating refactoring diffs.' },
          { label: 'AST-Preserving Edits', text: 'Synthesizes code edits accompanied by automated syntax validation to prevent regressions.' },
          { label: 'Explicit Change Approval', text: 'All proposed edits are displayed as color-coded side-by-side unified diffs for manual review.' }
        ]
      }
    ]
  },

  'prompting': {
    category: 'Agent',
    title: 'Prompting agents',
    subtitle: 'Direct Agent with text prompts in the chat input. You can attach context, topological conduits, and terminals, and switch models at any point.',
    sections: [
      {
        id: 'mentions',
        title: '@ mentions',
        desc: 'Type @ in the chat input to attach specific context to your prompt. Start typing after @ and Neuron shows matching suggestions.',
        points: [
          { label: 'Files & Folders', text: '@App.jsx or @backend/parser.py to include files or folders (type / after selecting a folder to navigate deeper).' },
          { label: 'Terminals', text: '@terminals to include terminal emulator output and daemon health status as context.' },
          { label: 'Chats', text: '@chats to reference context, thoughts, and decisions from a previous conversation.' },
          { label: 'Git diffs', text: '@commit (Diff of Working State) for uncommitted changes, or @branch (Diff with Main) for full branch diff.' },
          { label: 'AST Conduits', text: '@conduits to include active call hierarchy, Louvain modularity clusters, and cyclomatic risk metrics.' }
        ]
      },
      {
        id: 'prompting-best-practices',
        title: 'Prompting Best Practices',
        desc: 'Maximize agent accuracy when modifying spatial codebases:',
        points: [
          { label: 'Specify Boundary Nodes', text: 'Mention both the entry point and expected callee (e.g. "Refactor @range_sum.py to connect pure_ram_cache").' },
          { label: 'Leverage Planning Mode', text: 'For multi-file modifications, ask the agent to formulate an implementation plan before writing code.' },
          { label: 'Verify Synthesized Diffs', text: 'Review AST validation badges before accepting changes to prevent syntax regression.' }
        ]
      }
    ]
  },

  'debugging': {
    category: 'Agent',
    title: 'Debug Mode',
    subtitle: 'Debug Mode helps you find root causes and fix tricky bugs that are hard to reproduce or understand. Instead of immediately writing code, the agent generates hypotheses, inspects topological conduits, and uses runtime information to pinpoint the exact issue before making a targeted fix.',
    sections: [
      {
        id: 'when-to-use',
        title: 'When to use Debug Mode',
        desc: 'Debug Mode works best for:',
        points: [
          { label: 'Bugs you can reproduce but cannot figure out', text: 'When you know something is wrong but the cause is not obvious from reading the code.' },
          { label: 'Race conditions and timing issues', text: 'Problems that depend on execution order or async behavior across conduits.' },
          { label: 'Performance problems and memory leaks', text: 'Issues that require runtime profiling and spatial node traversal to understand.' },
          { label: 'Cyclomatic coupling deadlocks', text: 'Circular dependency cycles where two modules recursively invoke one another.' }
        ]
      },
      {
        id: 'how-it-works',
        title: 'How it works',
        desc: 'The agent follows a rigorous 3-step diagnosis loop:',
        points: [
          { label: '1. Hypothesis Generation', text: 'Generates prioritized theories by analyzing caller-callee call graphs.' },
          { label: '2. Runtime Probe Injection', text: 'Temporarily adds logging statements and assertion monitors to verify invariant states.' },
          { label: '3. Targeted AST Fix', text: 'Applies minimal surgical refactor with zero collateral impact on surrounding nodes.' }
        ]
      }
    ]
  },

  'planning': {
    category: 'Agent',
    title: 'Planning Mode',
    subtitle: 'Deconstruct complex refactors into verifiable, multi-step execution plans before writing code.',
    sections: [
      {
        id: 'planning-workflow',
        title: 'Workflow',
        desc: 'Recommended workflow for extensive architecture changes:',
        points: [
          { label: 'Phase 1 - Exploration', text: 'Agent inspects dependent files and Louvain clusters to draft an implementation plan.' },
          { label: 'Phase 2 - User Review', text: 'Interactive approval modal lets you refine requirements or reject specific modifications.' },
          { label: 'Phase 3 - Stepwise Execution', text: 'Each step is executed individually with automated Tree-Sitter compilation checks.' }
        ]
      }
    ]
  },

  'security': {
    category: 'Agent',
    title: 'Security & CSP Guardrails',
    subtitle: 'Deterministic guardrails and Content Security Policy invariants ensuring autonomous agents operate safely within workstation boundaries.',
    sections: [
      {
        id: 'security-guardrails',
        title: 'Workstation Protection',
        desc: 'Standard security guarantees enforced by the Neuron runtime:',
        points: [
          { label: 'Workspace Sandbox', text: 'Agents are prevented from accessing or modifying paths outside the active project root.' },
          { label: 'CSP AST Inspection', text: 'Synthesized code is analyzed for dangerous system calls, unauthorized shell escapes, or network egress.' },
          { label: 'Zero Cloud Storage', text: 'Source code, AST nodes, and agent tokens remain strictly stored on your local disk.' }
        ]
      },
      {
        id: 'csp-invariants',
        title: 'CSP Guardrail Invariants',
        desc: 'Every code mutation is statically verified prior to filesystem writes:',
        points: [
          { label: 'Prohibited Subprocess Invocations', text: 'Disallows raw eval(), exec(), and unauthorized subprocess calls unless explicitly whitelisted.' },
          { label: 'Diff Verification Window', text: 'Interactive visual diff modal requires user confirmation for cross-module structural modifications.' },
          { label: 'Atomic Rollback Snapshots', text: 'Every file modification creates an automatic in-memory undo point for instantaneous state recovery.' }
        ]
      }
    ]
  },

  'daemon-setup': {
    category: 'Localhost Core',
    title: 'Python Daemon & Tree-Sitter',
    subtitle: 'High-speed localhost daemon powering AST extraction, symbol indexing, and vector similarity.',
    sections: [
      {
        id: 'daemon-pipeline',
        title: 'Parsing Pipeline',
        desc: 'How the background service indexes codebases in real time:',
        points: [
          { label: 'Sub-4ms Parse Latency', text: 'Tree-Sitter C bindings extract abstract syntax trees instantly upon file save.' },
          { label: 'LibCST Formatting Retention', text: 'Preserves exact indentation, comments, and docstrings during automated refactors.' },
          { label: 'FastAPI Localhost Endpoint', text: 'Communicates with the desktop client over high-throughput local Unix sockets or 127.0.0.1 IPC.' }
        ]
      },
      {
        id: 'ipc-synchronization',
        title: 'IPC & AST Conduits',
        desc: 'Zero-overhead communication between the Python daemon and WebGPU canvas:',
        points: [
          { label: 'Binary WebSocket Conduits', text: 'AST deltas stream over raw binary WebSockets to prevent JSON parsing overhead.' },
          { label: 'Louvain Graph Partitioning', text: 'NetworkX computes community partitions on background worker threads at 60 FPS.' },
          { label: 'Watchdog File Surveillance', text: 'Native OS filesystem notifications trigger incremental AST updates without full project rescans.' }
        ]
      }
    ]
  },

  'zero-telemetry': {
    category: 'Localhost Core',
    title: 'Zero Cloud Telemetry',
    subtitle: '100% offline privacy architecture ensuring your proprietary code never leaves your computer.',
    sections: [
      {
        id: 'telemetry-policy',
        title: 'Privacy Policy & Isolation',
        desc: 'Our strict localhost guarantee:',
        points: [
          { label: 'No Remote Analytics', text: 'Neuron contains zero analytics trackers, telemetry pings, or usage reporting.' },
          { label: 'Local Invariants', text: 'All embeddings and graph partitions are computed and stored in memory.' },
          { label: 'Air-Gapped Operation', text: 'Neuron functions with complete feature parity on offline workstations without internet access.' }
        ]
      }
    ]
  },

  'installation': {
    category: 'Get Started',
    title: 'Installation & Setup',
    subtitle: 'Detailed setup instructions, verified binaries, and environment prerequisites for Windows.',
    sections: [
      {
        id: 'installer-walkthrough',
        title: 'Windows Desktop Installer',
        desc: 'Recommended installation workflow for standard developer workstations:',
        points: [
          { label: 'Download Verified Binary', text: 'Obtain Neuron-Setup.exe directly from the official downloads portal or GitHub releases.' },
          { label: 'User Directory Sandbox', text: 'Installs per-user in %LOCALAPPDATA%/Programs/Neuron with zero admin UAC prompts required.' },
          { label: 'Automatic Path Integration', text: 'Registers the "neuron" command in PowerShell and Windows Terminal automatically.' }
        ]
      },
      {
        id: 'hardware-prerequisites',
        title: 'Hardware & GPU Verification',
        desc: 'Ensure your graphics drivers support hardware WebGPU acceleration:',
        points: [
          { label: 'Graphics Driver', text: 'NVIDIA Game Ready / Studio 535+, AMD Adrenalin 23.7+, or Intel Arc latest drivers.' },
          { label: 'DirectX 12 / Vulkan', text: 'Hardware feature level 12_0 or Vulkan 1.3 required for WebGPU canvas rendering.' },
          { label: 'System Memory', text: '8 GB RAM minimum recommended for codebases exceeding 50,000 AST symbols.' }
        ]
      }
    ]
  },

  'webgpu-pipeline': {
    category: 'Spatial Engine',
    title: 'WebGPU Hardware Pipeline',
    subtitle: 'High-performance GPU compute shaders and instanced geometry rendering 100K nodes at 60 FPS.',
    sections: [
      {
        id: 'gpu-architecture',
        title: 'Compute Architecture',
        desc: 'How the WebGPU engine offloads spatial calculations from the CPU:',
        points: [
          { label: 'Instanced Sprite Buffers', text: 'All AST nodes and folder suns share a single uniform buffer object drawn in one GPU call.' },
          { label: 'Laser Photon Compute', text: 'Dual-conduit photon motion is evaluated in GPU vertex stages without CPU animation tick overhead.' },
          { label: 'Zero Garbage Collection', text: 'Node coordinates mutate in pre-allocated TypedArrays to prevent V8 GC stutters.' }
        ]
      }
    ]
  },

  'ast-conduits': {
    category: 'Spatial Engine',
    title: 'AST Conduits & Dependency Rays',
    subtitle: 'Mathematical representation of function calls, variable references, and cross-file imports in 2D space.',
    sections: [
      {
        id: 'conduit-types',
        title: 'Conduit Classification',
        desc: 'Different edge colors represent distinct architectural relationships:',
        points: [
          { label: 'White Thin Lines', text: 'Represent direct parent-child filesystem containment in project directories.' },
          { label: 'Cyan Dual Laser Conduits', text: 'Represent active bi-directional network routes, WebSockets, or client-server pipelines.' },
          { label: 'Purple Call Conduits', text: 'Represent inter-function invocations and cross-module method dispatch.' },
          { label: 'Orange Warning Rays', text: 'Indicate circular dependencies, tight coupling, or un-isolated global side effects.' }
        ]
      }
    ]
  },

  'keybindings': {
    category: 'Localhost Core',
    title: 'Keyboard Shortcuts',
    subtitle: 'Fast keyboard navigation for panning, searching, node focusing, and agent execution.',
    sections: [
      {
        id: 'canvas-shortcuts',
        title: 'Canvas Navigation',
        desc: 'Speed up exploration across large 2D topological codebases:',
        points: [
          { label: 'Space + Drag', text: 'Pan smoothly across the spatial canvas without selecting nodes.' },
          { label: 'Ctrl + / Ctrl -', text: 'Zoom incrementally between architecture macro view and symbol moons.' },
          { label: 'Ctrl + 0', text: 'Reset viewport zoom and center view on the root project node.' },
          { label: 'Shift + Drag', text: 'Pull an interactive conduit ray from any node to link with another symbol.' },
          { label: 'F', text: 'Focus and smoothly camera-warp onto the currently selected node.' }
        ]
      },
      {
        id: 'terminal-shortcuts',
        title: 'Terminal & Workspace',
        desc: 'Terminal and editor hotkeys:',
        points: [
          { label: 'Ctrl + `', text: 'Toggle bottom PowerShell and engine diagnostics panel.' },
          { label: 'Ctrl + P', text: 'Quick open file search with instantaneous spatial camera pan.' },
          { label: 'Ctrl + L', text: 'Clear terminal output history.' }
        ]
      }
    ]
  },

  'troubleshooting': {
    category: 'Localhost Core',
    title: 'Troubleshooting & Diagnostics',
    subtitle: 'Solutions for common setup questions, GPU driver fallbacks, and port configuration.',
    sections: [
      {
        id: 'gpu-issues',
        title: 'WebGPU Acceleration Fallback',
        desc: 'If the spatial canvas displays a software fallback notice:',
        points: [
          { label: 'Driver Update', text: 'Update your display drivers to ensure Vulkan or DirectX 12 WebGPU capabilities are active.' },
          { label: 'Hardware Acceleration Flag', text: 'Ensure "Use hardware acceleration when available" is enabled in your system graphics settings.' },
          { label: 'WebGL 2.0 Fallback', text: 'Neuron automatically falls back to 2D Canvas / WebGL 2.0 if WebGPU is unavailable.' }
        ]
      },
      {
        id: 'daemon-connectivity',
        title: 'Daemon Port 8000 Conflicts',
        desc: 'If the local Tree-Sitter daemon reports port 8000 already bound:',
        points: [
          { label: 'Custom Port Flag', text: 'Launch Neuron with --daemon-port 8080 to bind the AST engine to an alternate port.' },
          { label: 'Task Manager Verification', text: 'Verify no orphaned python.exe or neuron-daemon instances are running in the background.' }
        ]
      }
    ]
  },
};

// --- NAVIGATION SCHEMA ---
const DOCS_NAV_GROUPS = [
  {
    category: 'Get Started',
    items: [
      { id: 'welcome', label: 'Welcome' },
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'installation', label: 'Installation & Setup' },
      { id: 'architecture', label: 'Architecture' },
      { id: 'changelog', label: 'Changelog' }
    ]
  },
  {
    category: 'Spatial Engine',
    items: [
      { id: 'spatial-overview', label: 'Canvas Overview' },
      { id: 'physics-relaxation', label: 'Physics & Relaxation' },
      { id: 'louvain-clusters', label: 'Louvain Clusters' },
      { id: 'webgpu-pipeline', label: 'WebGPU Pipeline' },
      { id: 'ast-conduits', label: 'AST Conduits & Rays' }
    ]
  },
  {
    category: 'Autonomous Agents',
    items: [
      { id: 'agent-overview', label: 'Agent Architecture & BYOK' },
      { id: 'prompting', label: 'Topological Prompting' },
      { id: 'debugging', label: 'Autonomous Debugging' },
      { id: 'planning', label: 'Strategic Planning' },
      { id: 'security', label: 'Security & Sandbox' }
    ]
  },
  {
    category: 'Localhost Core',
    items: [
      { id: 'daemon-setup', label: 'Daemon & Tree-Sitter' },
      { id: 'zero-telemetry', label: 'Zero Telemetry' },
      { id: 'keybindings', label: 'Keyboard Shortcuts' },
      { id: 'troubleshooting', label: 'Troubleshooting' }
    ]
  }
];

const ALL_DOC_IDS = DOCS_NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

// Helper for comprehensive deep text search across sections and bullet points
const docMatchesQuery = (doc, q) => {
  if (!doc) return false;
  if (doc.title?.toLowerCase().includes(q)) return true;
  if (doc.subtitle?.toLowerCase().includes(q)) return true;
  if (doc.category?.toLowerCase().includes(q)) return true;
  if (Array.isArray(doc.sections)) {
    for (const sec of doc.sections) {
      if (sec.title?.toLowerCase().includes(q)) return true;
      if (sec.desc?.toLowerCase().includes(q)) return true;
      if (Array.isArray(sec.points)) {
        for (const pt of sec.points) {
          if (pt.label?.toLowerCase().includes(q)) return true;
          if (pt.text?.toLowerCase().includes(q)) return true;
        }
      }
    }
  }
  return false;
};

export default function Docs() {
  const getInitialDocId = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').trim();
      if (ALL_DOC_IDS.includes(hash)) {
        return hash;
      }
    }
    return 'welcome';
  };

  const [activeDocId, setActiveDocId] = useState(getInitialDocId);
  const { searchQuery, setSearchQuery } = useDocsSearch();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync hash to activeDocId and listen to back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && ALL_DOC_IDS.includes(hash)) {
        setActiveDocId(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activeDocId && window.location.hash !== `#${activeDocId}`) {
      window.location.hash = activeDocId;
    }
  }, [activeDocId]);

  const selectDoc = (id) => {
    setActiveDocId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeDoc = DOCS_DATA[activeDocId] || DOCS_DATA['welcome'];

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return DOCS_NAV_GROUPS;
    const q = searchQuery.toLowerCase().trim();
    return DOCS_NAV_GROUPS.map(group => {
      const items = group.items.filter(item => {
        const doc = DOCS_DATA[item.id];
        return (
          item.label.toLowerCase().includes(q) ||
          group.category.toLowerCase().includes(q) ||
          docMatchesQuery(doc, q)
        );
      });
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }, [searchQuery]);

  // Previous and Next navigation
  const currentIndex = ALL_DOC_IDS.indexOf(activeDocId);
  const prevDocId = currentIndex > 0 ? ALL_DOC_IDS[currentIndex - 1] : null;
  const nextDocId = currentIndex < ALL_DOC_IDS.length - 1 ? ALL_DOC_IDS[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans relative selection:bg-[#3B82F6]/30 selection:text-white flex flex-col justify-between">
      
      {/* Edge-to-edge full-width container with zero outer margin */}
      <div className="w-full flex-1 flex flex-col md:flex-row px-0 pt-14 pb-0">
        
        {/* LEFT SIDEBAR (Desktop - Docked flush to left edge) */}
        <aside className="w-56 lg:w-64 border-r border-white/[0.08] hidden md:flex flex-col justify-between pt-6 pb-8 px-5 shrink-0 font-sans text-xs">
          <div>
            {/* Navigation Groups or Empty State */}
            {filteredGroups.length === 0 ? (
              <div className="py-8 px-2 text-center text-slate-500 text-xs space-y-2">
                <p className="text-slate-300 font-medium">No results found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">Try keywords like GPU, Tree-Sitter, shortcuts, or Ollama.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 inline-block text-[11px] text-[#60A5FA] hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredGroups.map(group => (
                  <div key={group.category} className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1">
                      {group.category}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map(item => {
                        const isActive = activeDocId === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => selectDoc(item.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer flex items-center justify-between ${
                              isActive
                                ? 'text-white font-semibold'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Header / Drawer Toggle */}
        <div className="md:hidden w-full py-2.5 px-4 border-b border-white/[0.08] flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400 flex items-center gap-2 truncate pr-2">
            <span>Docs</span>
            <span>/</span>
            <span className="text-[#60A5FA] font-medium truncate">{activeDoc.title}</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Toggle docs navigation"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Split Screen / Mobile Horizontal Doc Tabs */}
        <div className="md:hidden w-full overflow-x-auto flex items-center gap-1.5 px-4 pb-2 mb-4 scrollbar-none border-b border-white/[0.06]">
          {ALL_DOC_IDS.map(id => {
            const doc = DOCS_DATA[id];
            if (!doc) return null;
            const isActive = activeDocId === id;
            return (
              <button
                key={id}
                onClick={() => selectDoc(id)}
                className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                  isActive
                    ? 'text-white font-medium bg-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 bg-white/[0.02]'
                }`}
              >
                {doc.title}
              </button>
            );
          })}
        </div>

        {/* Mobile Drawer with Search */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-14 bg-[#050505] z-40 p-6 overflow-y-auto">
            {/* Mobile Search Box */}
            <div className="mb-6 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs (e.g. GPU, Tree-Sitter)..."
                className="w-full bg-[#0d0e12] border border-white/[0.12] focus:border-[#60A5FA]/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>

            {filteredGroups.length === 0 ? (
              <div className="py-6 px-2 text-center text-slate-500 text-xs space-y-2">
                <p className="text-slate-300 font-medium">No results found for &ldquo;{searchQuery}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs text-[#60A5FA] hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroups.map(group => (
                  <div key={group.category} className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                      {group.category}
                    </div>
                    <div className="space-y-1 pl-2">
                      {group.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            selectDoc(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full text-left py-1.5 text-sm ${
                            activeDocId === item.id ? 'text-white font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MAIN DOCUMENTATION CONTENT */}
        <main className="flex-1 px-6 sm:px-10 md:px-14 lg:px-18 pt-6 pb-12 min-h-[calc(100vh-12rem)] flex flex-col justify-between">
          <div>
            {/* Category Tag */}
            <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">
              {activeDoc.category}
            </div>

            {/* Large Title */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-4 leading-tight">
              {activeDoc.title}
            </h1>

            {/* Subtitle / Intro Paragraph */}
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 font-normal">
              {activeDoc.subtitle}
            </p>

            {/* Document Sections */}
            <div className="space-y-10">
              {activeDoc.sections.map(sec => (
                <section key={sec.id} id={sec.id} className="scroll-mt-24">
                  <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white mb-2">
                    {sec.title}
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 font-normal">
                    {sec.desc}
                  </p>

                  {/* Pointwise Specification */}
                  <ul className="space-y-2.5 pl-1">
                    {sec.points.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start text-xs sm:text-sm leading-relaxed text-slate-300">
                        <span className="text-[#60A5FA] mr-2 select-none">•</span>
                        <div>
                          <strong className="text-white font-medium mr-1.5">{pt.label}:</strong>
                          <span>{pt.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          {/* Bottom Pagination */}
          <div className="mt-12 pt-6 border-t border-white/[0.08] flex items-center justify-between text-xs">
            {prevDocId ? (
              <button
                onClick={() => selectDoc(prevDocId)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>{DOCS_DATA[prevDocId]?.title}</span>
              </button>
            ) : <div />}

            {nextDocId ? (
              <button
                onClick={() => selectDoc(nextDocId)}
                className="flex items-center gap-1.5 text-[#60A5FA] hover:text-[#93c5fd] transition-colors cursor-pointer"
              >
                <span>{DOCS_DATA[nextDocId]?.title}</span>
                <ChevronRight size={14} />
              </button>
            ) : <div />}
          </div>
        </main>

      </div>

      <Footer className="mt-0" />
    </div>
  );
}