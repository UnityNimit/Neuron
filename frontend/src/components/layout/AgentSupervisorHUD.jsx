// frontend/src/components/layout/AgentSupervisorHUD.jsx
import React, { useState } from 'react';
import { 
  Bot, Sparkles, RotateCcw, CheckCircle2, ChevronDown, 
  ChevronUp, X, Zap, Network, FileCode2, AlertTriangle, 
  Plus, Minus, RefreshCw, ExternalLink, ShieldAlert 
} from 'lucide-react';

export default function AgentSupervisorHUD({ 
  agentBatch, 
  onRollback, 
  onApprove, 
  onDismiss,
  onWarpToNode,
  onSwitchFile 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  if (!agentBatch || (agentBatch.isRolledBack && !agentBatch.blastProtectionBlocked)) return null;

  const { 
    batchId, 
    modifiedFiles = [], 
    blastRadiusNodeIds = [], 
    affectedApiRoutes = [], 
    fileDeltas = [] 
  } = agentBatch;

  const totalLocDelta = fileDeltas.reduce((acc, f) => acc + (f.locDelta || 0), 0);
  const selectedDelta = fileDeltas[selectedFileIdx] || fileDeltas[0];

  return (
    <div className="fixed bottom-10 right-6 z-[120] max-w-xl w-full select-none animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-[#121212]/95 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.2)] rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col">
        
        {/* ----------------------------------------------------------------- */}
        {/* 1. TOP COMPACT STATUS BAR                                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="px-4 py-3 bg-[#181818]/90 border-b border-[#262626] flex items-center justify-between">
          
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shrink-0">
              {agentBatch.blastProtectionBlocked ? (
                <ShieldAlert size={15} className="text-cyan-400 animate-pulse" />
              ) : (
                <Bot size={15} className="animate-pulse" />
              )}
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
                  {agentBatch.blastProtectionBlocked ? "Blast Protection Intercepted" : "AI Agent Mutation Burst"}
                </span>
                <span className="text-[9px] font-mono font-bold bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/40">
                  {agentBatch.blastProtectionBlocked ? "Codebase Preserved" : `${modifiedFiles.length} Files Modified`}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                {agentBatch.blastProtectionBlocked ? (
                  <span>Neutralized instant AI burst ({modifiedFiles.length} files, {blastRadiusNodeIds.length} blast nodes).</span>
                ) : (
                  <>
                    <Network size={10} className="text-purple-400" /> 
                    <span>Blast Radius: <strong className="text-purple-300">{blastRadiusNodeIds.length}</strong> downstream nodes</span>
                    {affectedApiRoutes.length > 0 && (
                      <>
                        <span>·</span>
                        <Zap size={10} className="text-cyan-400" />
                        <span className="text-cyan-300">{affectedApiRoutes.length} API Routes Impacted</span>
                      </>
                    )}
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-[#282828] text-slate-400 hover:text-slate-200 transition-colors"
              title={isExpanded ? "Collapse Details" : "Expand AST Diffs"}
            >
              {isExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            <button 
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-[#282828] text-slate-400 hover:text-slate-200 transition-colors"
              title="Dismiss Alert"
            >
              <X size={15} />
            </button>
          </div>

        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 2. EXPANDED AST DELTA & CODE DIFF DRAWER                          */}
        {/* ----------------------------------------------------------------- */}
        {isExpanded && (
          <div className="flex flex-row h-72 border-b border-[#262626] bg-[#0c0c0c] divide-x divide-[#222]">
            
            {/* Left Column: Modified Files List */}
            <div className="w-48 overflow-y-auto p-2 divide-y divide-[#1e1e1e] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
              {fileDeltas.map((f, idx) => {
                const isSelected = idx === selectedFileIdx;
                return (
                  <div 
                    key={f.filePath}
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`p-2 rounded-lg cursor-pointer text-[11px] font-mono transition-colors flex flex-col gap-0.5 ${
                      isSelected ? 'bg-cyan-950/40 border border-cyan-800/40 text-cyan-200' : 'hover:bg-[#161616] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate font-semibold">{f.filePath.split('/').pop()}</span>
                      <span className={`text-[9px] ${f.locDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {f.locDelta >= 0 ? `+${f.locDelta}` : f.locDelta}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-600 truncate">{f.filePath}</span>
                  </div>
                );
              })}
            </div>

            {/* Right Column: AST Symbol Diff & Code Inspector */}
            {selectedDelta && (
              <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
                <div className="overflow-hidden flex flex-col gap-2">
                  
                  {/* File Header with Action Link */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-200">
                      <FileCode2 size={13} className="text-blue-400" />
                      <span className="font-semibold">{selectedDelta.filePath}</span>
                    </div>
                    <button 
                      onClick={() => onSwitchFile && onSwitchFile(selectedDelta.filePath)}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <span>Open Editor</span> <ExternalLink size={10} />
                    </button>
                  </div>

                  {/* Modified Symbols Pill Box */}
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                    {(selectedDelta.symbolsAdded || []).map(sym => (
                      <span key={sym} className="text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Plus size={8} /> {sym}()
                      </span>
                    ))}
                    {(selectedDelta.symbolsModified || []).map(sym => (
                      <span key={sym} className="text-[9px] font-mono bg-yellow-950/60 text-yellow-300 border border-yellow-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <RefreshCw size={8} /> {sym}()
                      </span>
                    ))}
                    {(selectedDelta.symbolsDeleted || []).map(sym => (
                      <span key={sym} className="text-[9px] font-mono bg-red-950/60 text-red-300 border border-red-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Minus size={8} /> {sym}()
                      </span>
                    ))}
                  </div>

                  {/* Raw Diff Preview */}
                  {selectedDelta.diffSnippet && (
                    <pre className="p-2 bg-[#121212] rounded-lg border border-[#222] font-mono text-[9px] text-slate-300 overflow-x-auto max-h-36 leading-relaxed [&::-webkit-scrollbar]:hidden">
                      <code>{selectedDelta.diffSnippet}</code>
                    </pre>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 3. BOTTOM ACTION BAR (Rollback vs Approve)                         */}
        {/* ----------------------------------------------------------------- */}
        <div className="px-4 py-2.5 bg-[#141414] flex items-center justify-between text-xs font-mono">
          
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>Net LOC: <strong className={totalLocDelta >= 0 ? "text-emerald-400" : "text-red-400"}>{totalLocDelta >= 0 ? `+${totalLocDelta}` : totalLocDelta}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {agentBatch.blastProtectionBlocked ? (
              <>
                <button 
                  onClick={onDismiss}
                  className="px-3 py-1.5 bg-[#202020] hover:bg-[#2a2a2a] border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1.5 text-[11px] cursor-pointer"
                >
                  <span>Keep Preserved</span>
                </button>

                <button 
                  onClick={() => onApprove && onApprove(batchId)}
                  className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg transition-all flex items-center gap-1.5 text-[11px] font-semibold shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                  title="Override Blast Protection and apply these changes to disk"
                >
                  <CheckCircle2 size={12} />
                  <span>Restore Changes</span>
                </button>
              </>
            ) : (
              <>
                {/* 1-Click Instant Rollback Button */}
                <button 
                  onClick={() => onRollback && onRollback(batchId)}
                  className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300 hover:text-red-100 rounded-lg transition-all flex items-center gap-1.5 text-[11px] shadow-[0_0_12px_rgba(239,68,68,0.2)] cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Rollback Batch</span>
                </button>

                {/* 1-Click Approve / Lock-in Button */}
                <button 
                  onClick={() => onApprove && onApprove(batchId)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1.5 text-[11px] font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
                >
                  <CheckCircle2 size={12} />
                  <span>Approve Changes</span>
                </button>
              </>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}