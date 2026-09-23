import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, GitCommit, FileCode } from 'lucide-react';

const MODULES = [
  {
    id: 'dispatcher',
    path: 'legacy/dispatcher.py',
    name: 'Event Dispatcher',
    risk: 9.3,
    status: 'God Object (Radioactive)',
    statusColor: '#ef4444',
    cyclomatic: 48.6,
    centrality: 0.94,
    churn: '84 commits / 14d',
    depth: 18,
    advice: 'High blast radius. 42 inbound call edges from uncoupled domains. Refactoring recommended.'
  },
  {
    id: 'engine',
    path: 'src/core/engine.py',
    name: 'Spatial Engine Hub',
    risk: 4.8,
    status: 'Central Hub (Stable)',
    statusColor: '#3b82f6',
    cyclomatic: 14.2,
    centrality: 0.62,
    churn: '12 commits / 14d',
    depth: 8,
    advice: 'Balanced coordination hub. Low coupling with well-defined interface abstractions.'
  },
  {
    id: 'tree_sitter',
    path: 'src/parser/tree_sitter.py',
    name: 'Grammar Parser',
    risk: 1.4,
    status: 'Pure Function (Optimal)',
    statusColor: '#10b981',
    cyclomatic: 4.1,
    centrality: 0.18,
    churn: '2 commits / 14d',
    depth: 4,
    advice: 'Isolated leaf module. Zero side-effects, deterministic execution, and 99.8% test coverage.'
  }
];

export default function InteractiveFragilityCard() {
  const [selectedId, setSelectedId] = useState('dispatcher');
  const activeModule = MODULES.find(m => m.id === selectedId) || MODULES[0];

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[#07090e]/90 backdrop-blur-md p-6 relative overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs font-mono mb-4">
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-red-400" />
            <span className="text-white font-semibold">AST Fragility & Risk Radar</span>
          </div>
          <span 
            className="px-2.5 py-0.5 rounded border text-[11px] font-bold font-mono"
            style={{ 
              color: activeModule.statusColor,
              backgroundColor: `${activeModule.statusColor}15`,
              borderColor: `${activeModule.statusColor}30`
            }}
          >
            Risk Score: {activeModule.risk} / 10
          </span>
        </div>

        {/* Module Selector Chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                selectedId === m.id
                  ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              <FileCode size={13} className={selectedId === m.id ? 'text-blue-400' : 'text-slate-500'} />
              <span>{m.path}</span>
            </button>
          ))}
        </div>

        {/* Diagnostic Card Banner */}
        <div 
          className="p-3.5 rounded-xl border mb-5 transition-colors"
          style={{ 
            backgroundColor: `${activeModule.statusColor}0c`,
            borderColor: `${activeModule.statusColor}35`
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {activeModule.risk > 7 ? (
              <AlertTriangle size={15} className="text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-bold font-mono text-white">
              {activeModule.status}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
            {activeModule.advice}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Cyclomatic Complexity</span>
              <span className="text-white font-bold">{activeModule.cyclomatic}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, (activeModule.cyclomatic / 50) * 100)}%`,
                  backgroundColor: activeModule.statusColor
                }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Betweenness Bottleneck</span>
              <span className="text-white font-bold">{activeModule.centrality}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${activeModule.centrality * 100}%`,
                  backgroundColor: activeModule.statusColor
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1 text-slate-300">
          <GitCommit size={13} className="text-blue-400" /> Churn: {activeModule.churn}
        </span>
        <span className="text-slate-500">AST Depth: {activeModule.depth} levels</span>
      </div>
    </div>
  );
}
