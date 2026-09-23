import { useState } from 'react';
import { FolderTree, Network, AlertTriangle, CheckCircle2, CornerDownRight, Folder, FileCode2 } from 'lucide-react';

export default function InteractiveCallGraphVsTree() {
  const [activeMode, setActiveMode] = useState('spatial'); // 'tree' | 'spatial'
  const [selectedFile, setSelectedFile] = useState('auth_middleware.py');

  const files = [
    { name: 'auth_middleware.py', loc: 142, calls: ['verify_jwt()', 'rate_limiter()', 'db_pool.acquire()'], callers: 18, risk: 'High' },
    { name: 'payment_gateway.py', loc: 380, calls: ['stripe_client()', 'audit_logger()'], callers: 7, risk: 'Medium' },
    { name: 'data_pipeline.py', loc: 520, calls: ['s3_upload()', 'clean_schema()'], callers: 4, risk: 'Low' },
  ];

  const currentFile = files.find(f => f.name === selectedFile) || files[0];

  return (
    <div className="w-full bg-[#0a0a0a] border border-white/[0.08] rounded-2xl overflow-hidden font-mono text-xs">
      {/* Top Toggle Switch */}
      <div className="h-12 bg-[#0e0e0e] border-b border-white/[0.08] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-white font-semibold">Architectural Observability</span>
          <span className="text-white/20">/</span>
          <span>Show, Don't Tell</span>
        </div>

        <div className="flex items-center p-1 bg-black/60 border border-white/[0.08] rounded-lg">
          <button
            onClick={() => setActiveMode('tree')}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'tree' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FolderTree size={12} />
            <span>Conventional Tree</span>
          </button>
          <button
            onClick={() => setActiveMode('spatial')}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'spatial' ? 'bg-[#60A5FA]/20 text-[#60A5FA] border border-[#60A5FA]/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Network size={12} />
            <span>Neuron Spatial Graph</span>
          </button>
        </div>
      </div>

      {/* Main Comparative View */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.08] min-h-[300px]">
        {/* Left: Interactive File List */}
        <div className="p-4 bg-[#080808] flex flex-col justify-between">
          <div>
            <div className="text-slate-400 text-[11px] uppercase tracking-wider mb-3 font-semibold">
              Select Module Under Review
            </div>
            <div className="space-y-1.5">
              {files.map(f => (
                <button
                  key={f.name}
                  onClick={() => setSelectedFile(f.name)}
                  className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    selectedFile === f.name 
                      ? 'bg-white/[0.04] border-[#60A5FA]/40 text-white' 
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      f.risk === 'High' ? 'bg-red-400' : f.risk === 'Medium' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    <span className="font-medium text-slate-200">{f.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{f.loc} LOC</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] text-[11px] text-slate-400">
            Click files to inspect how conventional IDEs conceal blast radius while Neuron exposes call conduits.
          </div>
        </div>

        {/* Right: Comparative Representation */}
        <div className="p-5 bg-[#050505] flex flex-col justify-between">
          {activeMode === 'tree' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={14} />
                <span className="font-semibold text-xs text-white">Flat Hierarchy Limitation</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Conventional editors display files linearly by alphabet or directory. They provide zero indication that modifying <code className="text-slate-200">{currentFile.name}</code> impacts <strong className="text-white">{currentFile.callers} downstream callers</strong> across separate repositories.
              </p>
              
              <div className="p-3 bg-[#0d0d0d] border border-white/[0.08] rounded-lg text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5"><Folder size={12} className="text-slate-500" /><span>src/</span></div>
                <div className="pl-4 flex items-center gap-1.5"><Folder size={12} className="text-slate-500" /><span>middleware/</span></div>
                <div className="pl-8 text-slate-300 flex items-center gap-1.5"><FileCode2 size={12} className="text-slate-400" /><span>{currentFile.name} (Silent dependencies)</span></div>
                <div className="pl-4 flex items-center gap-1.5"><Folder size={12} className="text-slate-500" /><span>services/ (18 callers unseen)</span></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#60A5FA]">
                <CheckCircle2 size={14} />
                <span className="font-semibold text-xs text-white">Multi-Modal Directed AST Graph</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Neuron traces Tree-Sitter invocation vectors in real time. Hovering over <code className="text-[#60A5FA]">{currentFile.name}</code> instantly illuminates its <strong className="text-white">{currentFile.callers} cross-boundary conduits</strong> and calculates cyclomatic risk before execution.
              </p>

              <div className="p-3 bg-[#0a0f16] border border-[#60A5FA]/20 rounded-lg text-[11px] text-slate-300 space-y-2">
                <div className="flex justify-between items-center text-[#60A5FA]">
                  <span>Active Call Conduits:</span>
                  <span className="font-bold">{currentFile.calls.length} outgoing · {currentFile.callers} incoming</span>
                </div>
                <div className="space-y-1 text-slate-400 text-[10px]">
                  {currentFile.calls.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 pl-2">
                      <CornerDownRight size={10} className="text-[#60A5FA]" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-white/[0.06]">
            <span>Algorithm: Tree-Sitter AST Traversal</span>
            <span className="text-emerald-400 font-mono">Parse time: 0.38ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
