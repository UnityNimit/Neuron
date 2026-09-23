import { useState, useMemo } from 'react';
import { usePhysicsEngine } from './usePhysicsEngine';
import PixiSpatialEngine from './PixiSpatialEngine';
import { Code2, Compass, Zap, Sparkles, Activity, RotateCcw } from 'lucide-react';

// Mock Codebase for Interactive Demo
const MOCK_FILES = {
  'src/agent/orchestrator.ts': `// Autonomous Agent Orchestration Loop
export class AgentOrchestrator {
  private memory: VectorMemory;
  private tools: ToolRegistry;

  async executePlan(prompt: string) {
    const context = await this.memory.retrieve(prompt);
    const plan = await this.generateSteps(prompt, context);
    for (const step of plan) {
      await this.tools.dispatch(step);
    }
  }

  async generateSteps(prompt: string, context: Context) {
    return await this.planner.synthesize(prompt, context);
  }
}`,
  'src/agent/tools.ts': `// Tool Registry & Safe Sandboxed Execution
export class ToolRegistry {
  async dispatch(action: Action) {
    console.log("Invoking sandboxed tool:", action.toolName);
    return await executeSandbox(action);
  }
}`,
  'src/memory/vector.ts': `// HNSW Vector Embedding Cache
export class VectorMemory {
  async retrieve(query: string) {
    const embedding = await embedText(query);
    return this.findKNearest(embedding, 5);
  }

  async embedText(text: string) {
    return await transformer.encode(text);
  }
}`
};

const MOCK_NODES = [
  // Directories
  { id: 'src', label: 'src', nodeType: 'folder', data: { nodeType: 'folder' } },
  { id: 'agent', label: 'agent', nodeType: 'folder', data: { nodeType: 'folder' } },
  { id: 'memory', label: 'memory', nodeType: 'folder', data: { nodeType: 'folder' } },
  // Files
  { id: 'orchestrator.ts', label: 'orchestrator.ts', nodeType: 'file', data: { nodeType: 'file', filePath: 'src/agent/orchestrator.ts', community: 0, complexity: 12.4 } },
  { id: 'tools.ts', label: 'tools.ts', nodeType: 'file', data: { nodeType: 'file', filePath: 'src/agent/tools.ts', community: 0, complexity: 6.2 } },
  { id: 'vector.ts', label: 'vector.ts', nodeType: 'file', data: { nodeType: 'file', filePath: 'src/memory/vector.ts', community: 1, complexity: 8.9 } },
  // Functions / AST
  { id: 'executePlan()', label: 'executePlan()', nodeType: 'function', data: { nodeType: 'function', filePath: 'src/agent/orchestrator.ts', community: 0, betweenness: 0.84 } },
  { id: 'generateSteps()', label: 'generateSteps()', nodeType: 'function', data: { nodeType: 'function', filePath: 'src/agent/orchestrator.ts', community: 0, betweenness: 0.45 } },
  { id: 'dispatch()', label: 'dispatch()', nodeType: 'function', data: { nodeType: 'function', filePath: 'src/agent/tools.ts', community: 0, betweenness: 0.61 } },
  { id: 'retrieve()', label: 'retrieve()', nodeType: 'function', data: { nodeType: 'function', filePath: 'src/memory/vector.ts', community: 1, betweenness: 0.72 } },
  { id: 'embedText()', label: 'embedText()', nodeType: 'function', data: { nodeType: 'function', filePath: 'src/memory/vector.ts', community: 1, betweenness: 0.38 } },
];

const MOCK_EDGES = [
  // Hierarchy
  { id: 'e1', source: 'src', target: 'agent', type: 'hierarchy' },
  { id: 'e2', source: 'src', target: 'memory', type: 'hierarchy' },
  { id: 'e3', source: 'agent', target: 'orchestrator.ts', type: 'hierarchy' },
  { id: 'e4', source: 'agent', target: 'tools.ts', type: 'hierarchy' },
  { id: 'e5', source: 'memory', target: 'vector.ts', type: 'hierarchy' },
  { id: 'e6', source: 'orchestrator.ts', target: 'executePlan()', type: 'hierarchy' },
  { id: 'e7', source: 'orchestrator.ts', target: 'generateSteps()', type: 'hierarchy' },
  { id: 'e8', source: 'tools.ts', target: 'dispatch()', type: 'hierarchy' },
  { id: 'e9', source: 'vector.ts', target: 'retrieve()', type: 'hierarchy' },
  { id: 'e10', source: 'vector.ts', target: 'embedText()', type: 'hierarchy' },
  // Cross-File Function Calls
  { id: 'call-1', source: 'executePlan()', target: 'retrieve()', type: 'call' },
  { id: 'call-2', source: 'executePlan()', target: 'dispatch()', type: 'call' },
  { id: 'call-3', source: 'retrieve()', target: 'embedText()', type: 'call' },
];

export default function InteractiveGraphIDE() {
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(MOCK_NODES[6]); // default: executePlan()
  const [activeTab, setActiveTab] = useState('code');

  // Physics Simulation
  const { simDataRef, onDragStart, onDragMove, onDragEnd } = usePhysicsEngine(
    MOCK_NODES,
    MOCK_EDGES,
    true
  );

  // Active-Ray BFS Pathfinding
  const activeRay = useMemo(() => {
    const focusId = hoveredNodeId || selectedNode?.id;
    if (!focusId) return null;

    const activeN = new Set([focusId]);
    const activeE = new Set();

    MOCK_EDGES.forEach(e => {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      if (s === focusId || t === focusId) {
        activeN.add(s);
        activeN.add(t);
        activeE.add(e.id);
      }
    });

    return { activeN, activeE };
  }, [hoveredNodeId, selectedNode]);

  const activeFilePath = selectedNode?.data?.filePath || 'src/agent/orchestrator.ts';
  const currentCode = MOCK_FILES[activeFilePath] || '// Select a function or file on the graph';

  return (
    <div className="w-full h-[620px] md:h-[680px] bg-[#0c0e12] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative group">
      {/* Top Bar Chrome */}
      <div className="h-11 bg-[#11141a] border-b border-white/10 px-4 flex items-center justify-between z-10 select-none">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 mr-1">
            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:opacity-100 transition-opacity" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:opacity-100 transition-opacity" />
            <div className="w-3 h-3 rounded-full bg-green-500/80 hover:opacity-100 transition-opacity" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-white">Neuron Spatial IDE</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">PixiJS v8 · Pure RAM D3 Force</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <span className="hidden md:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#e4ef61]" /> Folder
          </span>
          <span className="hidden md:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> File
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> AST Function
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
            300 FPS
          </span>
        </div>
      </div>

      {/* Main Split Area */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Left: WebGL Spatial Canvas */}
        <div className="flex-1 relative h-full min-h-[340px]">
          <PixiSpatialEngine
            simDataRef={simDataRef}
            activeRay={activeRay}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={(node) => setSelectedNode(node)}
            onNodeHover={setHoveredNodeId}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />

          {/* Floating Instruction / Quick Controls */}
          <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono text-slate-300 pointer-events-none flex items-center gap-2 shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse shrink-0" />
            <span>Interactive: Drag nodes or hover to trace BFS call conduits</span>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
            <button 
              onClick={() => setSelectedNode(MOCK_NODES[6])}
              className="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/90 border border-white/10 text-[11px] font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset selected focus"
            >
              <RotateCcw className="w-3 h-3 text-blue-400" /> Focus Engine
            </button>
          </div>
        </div>

        {/* Right: Floating Cursor-Style Code & Telemetry Inspector */}
        <div className="w-full md:w-[380px] lg:w-[420px] h-64 md:h-full bg-[#0e1117]/95 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 flex flex-col z-10">
          {/* File Tab Header */}
          <div className="px-4 py-2.5 bg-[#13161e] border-b border-white/10 flex items-center justify-between text-xs font-mono select-none">
            <div className="flex items-center gap-2 text-slate-300 truncate">
              <Code2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate text-white font-medium">{activeFilePath}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded uppercase font-bold">
                {selectedNode?.data?.nodeType || 'node'}
              </span>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-white/5 bg-[#0b0e13] px-3 pt-2 gap-4 text-xs font-mono">
            <button
              onClick={() => setActiveTab('code')}
              className={`pb-2 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'code'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              AST Code
            </button>
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`pb-2 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'telemetry'
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Graph Telemetry
            </button>
          </div>

          {/* Code Viewer */}
          {activeTab === 'code' ? (
            <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300 leading-relaxed bg-[#0a0c10]">
              <pre className="text-slate-300 whitespace-pre">
                {currentCode.split('\n').map((line, i) => (
                  <div key={i} className="flex leading-5 hover:bg-white/[0.03] px-1 rounded">
                    <span className="w-6 text-slate-600 select-none text-right mr-3 shrink-0 text-[11px]">{i + 1}</span>
                    <span className={
                      line.startsWith('//') ? 'text-slate-500 italic' :
                      line.includes('export') || line.includes('class') || line.includes('async') || line.includes('return') ? 'text-blue-400' :
                      line.includes('executePlan') || line.includes('generateSteps') || line.includes('dispatch') || line.includes('retrieve') ? 'text-purple-300' :
                      line.includes('string') || line.includes('Action') || line.includes('Context') ? 'text-emerald-300' :
                      'text-slate-200'
                    }>
                      {line}
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-[#0a0c10] space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Cyclomatic Complexity</span>
                  <span className="text-white font-bold">{selectedNode?.data?.complexity ?? 7.4}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, ((selectedNode?.data?.complexity ?? 7.4) / 15) * 100)}%` }} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Betweenness Centrality</span>
                  <span className="text-purple-300 font-bold">{selectedNode?.data?.betweenness ?? 0.52}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${((selectedNode?.data?.betweenness ?? 0.52) * 100)}%` }} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>Louvain Community Q</span>
                  <span className="text-emerald-400 font-bold">Modularity 0.84</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Calculated using 50x weighted AST invocation conduits across services.
                </div>
              </div>
            </div>
          )}

          {/* Active Ray Telemetry Footer Panel */}
          <div className="p-3.5 bg-[#12151d] border-t border-white/10 text-xs font-mono">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Active Ray BFS Conduits</span>
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Activity size={12} /> Live Trace
              </span>
            </div>
            <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-2 mt-1">
              <div>Selected: <span className="text-white font-medium">{selectedNode?.label || 'None'}</span></div>
              <div>Conduits: <span className="text-purple-300 font-bold">{activeRay ? activeRay.activeE.size : 0} links</span></div>
              <div>Community: <span className="text-blue-400">Cluster #{selectedNode?.data?.community ?? 0}</span></div>
              <div>Status: <span className="text-emerald-400 font-medium">Synchronized</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
