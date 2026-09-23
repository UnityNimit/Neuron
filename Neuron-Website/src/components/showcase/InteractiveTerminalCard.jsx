import { useState } from 'react';
import { Terminal, Play, CheckCircle2, RotateCw } from 'lucide-react';

const TASKS = {
  ast: {
    command: 'neuron ast --target ./src --depth recursive',
    logs: [
      '[0.000s] Initializing Tree-Sitter & LibCST language grammars...',
      '[0.014s] Discovered 1,420 AST syntax symbols across 84 source files.',
      '[0.038s] Constructing directional invocation call-graph matrix...',
      '[0.062s] Calculating PageRank and cyclomatic complexity indices...',
      '[OK] AST extraction complete: 1,420 nodes, 3,892 edges indexed in 62ms.'
    ]
  },
  louvain: {
    command: 'neuron cluster --algorithm louvain --weighted-calls 50x',
    logs: [
      '[0.000s] Loading in-memory call graph adjacency matrix...',
      '[0.018s] Executing modularity maximization with gamma=1.0...',
      '[0.041s] Pass 1 complete: 14 microservice communities discovered (Q=0.72)',
      '[0.076s] Pass 2 complete: Consolidated to 4 core clusters (Modularity Q=0.84)',
      '[OK] Microservices detected: Auth (14n), Pipeline (32n), Memory (19n), WebGPU (28n).'
    ]
  },
  benchmark: {
    command: 'neuron benchmark --nodes 100000 --renderer webgpu',
    logs: [
      '[0.000s] Allocating pure RAM TypedArrays for 100,000 node coordinates...',
      '[0.021s] Initializing PixiJS v8 instanced sprite batching pipeline...',
      '[0.045s] Starting D3-force physical integration loop (144 Hz)...',
      '[0.089s] GPU Frame Time: 3.32ms (300.9 FPS) | DOM Garbage Collection: 0ms',
      '[OK] Benchmark passed: 100k nodes rendering at 300 FPS with zero frame drops.'
    ]
  }
};

export default function InteractiveTerminalCard() {
  const [selectedTask, setSelectedTask] = useState('ast');
  const [running, setRunning] = useState(false);

  const handleRun = (key) => {
    setSelectedTask(key);
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
    }, 450);
  };

  const current = TASKS[selectedTask];

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#07090e]/90 backdrop-blur-md p-6 relative overflow-hidden font-mono flex flex-col justify-between">
      <div>
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs text-slate-400 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <Terminal size={14} className="text-blue-400 ml-1" />
            <span className="text-white font-semibold">Neuron In-Browser Runtime</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400">Pyodide WASM Ready</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleRun('ast')}
            disabled={running}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedTask === 'ast'
                ? 'bg-blue-600/30 border border-blue-500/50 text-white'
                : 'bg-white/[0.04] border border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Play size={11} className={selectedTask === 'ast' ? 'text-blue-400 fill-blue-400' : 'text-slate-500'} />
            <span>AST Parse</span>
          </button>

          <button
            onClick={() => handleRun('louvain')}
            disabled={running}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedTask === 'louvain'
                ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                : 'bg-white/[0.04] border border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Play size={11} className={selectedTask === 'louvain' ? 'text-purple-400 fill-purple-400' : 'text-slate-500'} />
            <span>Louvain Cluster</span>
          </button>

          <button
            onClick={() => handleRun('benchmark')}
            disabled={running}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedTask === 'benchmark'
                ? 'bg-emerald-600/30 border border-emerald-500/50 text-white'
                : 'bg-white/[0.04] border border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Play size={11} className={selectedTask === 'benchmark' ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'} />
            <span>100k FPS Benchmark</span>
          </button>
        </div>

        {/* Interactive Shell Output */}
        <div className="p-4 rounded-xl bg-black/80 border border-white/5 text-xs text-slate-300 space-y-1.5 min-h-[170px]">
          <div className="text-blue-400 font-bold flex items-center gap-2 pb-1 border-b border-white/5">
            <span className="text-slate-500">$</span>
            <span>{current.command}</span>
            {running && <RotateCw size={12} className="text-blue-400 animate-spin ml-auto" />}
          </div>

          {running ? (
            <div className="py-8 text-center text-slate-500 animate-pulse text-xs">
              Executing in WebAssembly sandbox...
            </div>
          ) : (
            current.logs.map((line, i) => (
              <p
                key={i}
                className={
                  line.startsWith('[OK]')
                    ? 'text-emerald-400 font-semibold pt-1 flex items-center gap-1.5'
                    : 'text-slate-400 leading-relaxed text-[11px]'
                }
              >
                {line.startsWith('[OK]') && <CheckCircle2 size={13} className="shrink-0" />}
                <span>{line}</span>
              </p>
            ))
          )}
        </div>
      </div>

      {/* Terminal Footer */}
      <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
        <span>WebAssembly CPython 3.11</span>
        <span className="text-slate-400">Zero Network Telemetry</span>
      </div>
    </div>
  );
}
