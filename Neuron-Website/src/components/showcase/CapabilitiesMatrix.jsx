import { Check, X, Compass, FolderTree } from 'lucide-react';
import GlassPanel from '../GlassPanel';

const COMPARISON_ROWS = [
  {
    dimension: 'Mental Model & Navigation',
    traditional: '1D alphabetical folder tree with 40+ disconnected open tabs',
    neuron: '2D spatial galaxy where code distance reflects real execution affinity',
    neuronWins: true
  },
  {
    dimension: 'Microservice Discovery',
    traditional: 'Manual guessing based on human directory structures',
    neuron: 'Unsupervised Louvain modularity with 50x weighted call conduits',
    neuronWins: true
  },
  {
    dimension: 'Call Graph Exploration',
    traditional: 'Slow static "Find All References" text listicles',
    neuron: 'Instantaneous O(1) BFS focus-ray illuminating bidirectional execution paths',
    neuronWins: true
  },
  {
    dimension: 'Tech Debt & God Objects',
    traditional: 'Subjective code reviews and buried sonar reports',
    neuron: 'Radioactive Red hotspot halos based on AST density, centrality, and churn',
    neuronWins: true
  },
  {
    dimension: 'Rendering & Performance',
    traditional: 'DOM tree reflows choke on >500 rendered elements',
    neuron: 'Zero-DOM PixiJS v8 instanced sprites simulating 100,000+ nodes at 300 FPS',
    neuronWins: true
  },
  {
    dimension: 'Privacy & Data Ownership',
    traditional: 'Proprietary source code streamed to remote cloud servers',
    neuron: '100% local workstation computation via Python daemon and Pyodide WASM',
    neuronWins: true
  }
];

export default function CapabilitiesMatrix() {
  return (
    <section className="max-w-7xl mx-auto mb-40 pointer-events-auto">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold mb-4 border border-blue-500/20">
          <Compass size={13} /> The Paradigm Shift
        </div>
        <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-4">
          Built for Software Beyond the 1D File Tree
        </h2>
        <p className="text-slate-400 text-lg leading-relaxed">
          How Neuron replaces the cognitive friction of legacy code editors with tangible spatial mathematics.
        </p>
      </div>

      <GlassPanel className="rounded-3xl overflow-hidden p-0 border border-white/10 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="py-5 px-6 text-xs font-mono font-bold uppercase text-slate-400 w-1/4">
                  Capability
                </th>
                <th className="py-5 px-6 text-xs font-mono font-bold uppercase text-slate-500 w-[37.5%]">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <FolderTree size={14} /> Traditional Editors (VS Code / IDEs)
                  </span>
                </th>
                <th className="py-5 px-6 text-xs font-mono font-bold uppercase text-blue-400 w-[37.5%] bg-blue-500/[0.04]">
                  <span className="flex items-center gap-1.5 text-white">
                    <Compass size={14} className="text-blue-400" /> Neuron Spatial IDE
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-6 font-medium text-white font-mono text-xs">
                    {row.dimension}
                  </td>
                  <td className="py-4 px-6 text-slate-400 flex items-start gap-2.5">
                    <X size={16} className="text-red-400/70 shrink-0 mt-0.5" />
                    <span>{row.traditional}</span>
                  </td>
                  <td className="py-4 px-6 text-slate-200 bg-blue-500/[0.02]">
                    <div className="flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="font-medium text-white">{row.neuron}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </section>
  );
}
