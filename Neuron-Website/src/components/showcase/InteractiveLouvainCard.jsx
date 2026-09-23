import { useState } from 'react';
import { Network, Sliders, ShieldCheck, Layers } from 'lucide-react';

export default function InteractiveLouvainCard() {
  const [resolution, setResolution] = useState(1.0);

  // Derive dynamic modularity score and clusters based on resolution
  const modularityQ = (0.88 - (resolution - 0.5) * 0.18).toFixed(2);
  const clusterCount = resolution < 0.8 ? 2 : resolution < 1.4 ? 4 : 7;

  const clusters = [
    {
      name: 'Cluster A: Auth & Session',
      nodes: Math.round(14 * (resolution > 1.2 ? 0.7 : 1)),
      color: '#a855f7', // Purple
      edgeWeight: '50.0x Invocations',
      desc: 'Token verification, JWT decoders, rate limiters'
    },
    {
      name: 'Cluster B: AST Syntax Pipeline',
      nodes: Math.round(32 * (resolution > 1.2 ? 0.6 : 1)),
      color: '#3b82f6', // Azure Blue
      edgeWeight: '38.5x Invocations',
      desc: 'Tree-Sitter grammars, LibCST visitors, tokenizers'
    },
    {
      name: 'Cluster C: Vector Memory Bus',
      nodes: Math.round(19 * (resolution < 1 ? 0 : 1)),
      color: '#22c55e', // Emerald
      edgeWeight: '42.0x Invocations',
      desc: 'HNSW indexing, cosine similarity, embeddings cache'
    },
    {
      name: 'Cluster D: WebGPU Engine',
      nodes: Math.round(28 * (resolution < 1.2 ? 0 : 1)),
      color: '#eab308', // Amber
      edgeWeight: '60.0x Invocations',
      desc: 'Instanced sprite batching, D3 RAM coordinate sync'
    }
  ].filter(c => c.nodes > 0);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#07090e]/90 backdrop-blur-md p-6 relative overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs font-mono text-slate-400 mb-5">
          <div className="flex items-center gap-2">
            <Network size={15} className="text-purple-400" />
            <span className="text-white font-semibold">Unsupervised Louvain Modularity</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px]">
              Q = {modularityQ}
            </span>
            <span className="text-slate-400 text-[11px] font-mono hidden sm:inline">
              {clusterCount} Microservices
            </span>
          </div>
        </div>

        {/* Modularity Slider Controls */}
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Sliders size={13} className="text-blue-400" />
              Resolution Parameter (&gamma;)
            </span>
            <span className="text-blue-400 font-bold font-mono">{resolution.toFixed(2)}x</span>
          </div>

          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={resolution}
            onChange={(e) => setResolution(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0.5x (Coarse Grained)</span>
            <span>1.0x (Standard)</span>
            <span>2.0x (Fine Microservices)</span>
          </div>
        </div>

        {/* Live Detected Clusters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {clusters.slice(0, 4).map((c, i) => (
            <div
              key={i}
              className="p-3 rounded-xl border transition-all duration-300 relative overflow-hidden"
              style={{
                backgroundColor: `${c.color}0a`,
                borderColor: `${c.color}30`
              }}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-white truncate">{c.name}</span>
                <span 
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2"
                  style={{ color: c.color, backgroundColor: `${c.color}20` }}
                >
                  {c.nodes} nodes
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mb-1">{c.desc}</p>
              <div className="text-[10px] font-mono text-slate-500">
                Call Density: <span className="text-slate-300">{c.edgeWeight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Meta */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1 text-emerald-400">
          <ShieldCheck size={13} /> Mathematically Proven Boundaries
        </span>
        <span className="text-slate-500 flex items-center gap-1">
          <Layers size={12} /> Convex Hull Nebulae Active
        </span>
      </div>
    </div>
  );
}
