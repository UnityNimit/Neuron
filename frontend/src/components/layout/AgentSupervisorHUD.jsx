// frontend/src/components/layout/AgentSupervisorHUD.jsx
import React, { useState } from 'react';

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
    <div className="fixed bottom-8 right-6 z-[120] max-w-lg w-full select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div 
        className="border rounded-xl overflow-hidden flex flex-col font-sans transition-colors"
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: 'var(--theme-border, #242628)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.32)'
        }}
      >
        
        {/* ----------------------------------------------------------------- */}
        {/* 1. TOP COMPACT STATUS BAR                                         */}
        {/* ----------------------------------------------------------------- */}
        <div 
          className="px-3.5 py-2.5 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--theme-secondary, #191a1b)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span 
                className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: 'var(--theme-surface-hover, #222426)',
                  borderColor: 'var(--theme-border-subtle, #2e3032)',
                  color: 'var(--theme-accent, #3b82f6)'
                }}
              >
                {agentBatch.blastProtectionBlocked ? "BLAST SHIELD" : "AI MUTATION"}
              </span>
              <span 
                className="text-xs font-mono font-semibold truncate"
                style={{ color: 'var(--theme-text-bright, #f8fafc)' }}
              >
                {agentBatch.blastProtectionBlocked ? "Changes Intercepted" : "Burst Detected"}
              </span>
            </div>
            
            <span 
              className="text-[11px] font-mono mt-0.5 truncate"
              style={{ color: 'var(--theme-text-secondary, #94a3b8)' }}
            >
              {agentBatch.blastProtectionBlocked ? (
                `${modifiedFiles.length} files preserved · ${blastRadiusNodeIds.length} downstream nodes guarded`
              ) : (
                `${modifiedFiles.length} files modified · ${blastRadiusNodeIds.length} blast nodes${affectedApiRoutes.length > 0 ? ` · ${affectedApiRoutes.length} APIs` : ''}`
              )}
            </span>
          </div>

          {/* Action triggers: Details & Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 py-1 text-[11px] font-mono rounded transition-colors hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-surface-hover, #222426)',
                color: 'var(--theme-text-primary, #e2e8f0)',
                border: '1px solid var(--theme-border-subtle, #2e3032)'
              }}
            >
              {isExpanded ? "Hide" : "Details"}
            </button>
            <button 
              onClick={onDismiss}
              className="px-2 py-1 text-[11px] font-mono rounded transition-colors hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--theme-text-muted, #64748b)'
              }}
              title="Dismiss Alert"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 2. EXPANDED AST DELTA & CODE DIFF DRAWER                          */}
        {/* ----------------------------------------------------------------- */}
        {isExpanded && (
          <div 
            className="flex flex-row h-64 border-b divide-x"
            style={{
              backgroundColor: 'var(--theme-background, #121314)',
              borderColor: 'var(--theme-border, #242628)'
            }}
          >
            {/* Left Column: Modified Files List */}
            <div 
              className="w-44 overflow-y-auto p-1.5 flex flex-col gap-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10"
              style={{ backgroundColor: 'var(--theme-background, #121314)' }}
            >
              {fileDeltas.map((f, idx) => {
                const isSelected = idx === selectedFileIdx;
                return (
                  <div 
                    key={f.filePath}
                    onClick={() => setSelectedFileIdx(idx)}
                    className="p-1.5 rounded cursor-pointer text-[11px] font-mono transition-all flex flex-col gap-0.5"
                    style={{
                      backgroundColor: isSelected ? 'var(--theme-surface-active, #2a2c2e)' : 'transparent',
                      border: isSelected ? '1px solid var(--theme-accent, #3b82f6)' : '1px solid transparent',
                      color: isSelected ? 'var(--theme-text-bright, #f8fafc)' : 'var(--theme-text-secondary, #94a3b8)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium">{f.filePath.split('/').pop()}</span>
                      <span className="text-[10px] font-mono" style={{ color: f.locDelta >= 0 ? '#10b981' : '#ef4444' }}>
                        {f.locDelta >= 0 ? `+${f.locDelta}` : f.locDelta}
                      </span>
                    </div>
                    <span 
                      className="text-[9px] truncate"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      {f.filePath}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right Column: AST Symbol Diff & Code Inspector */}
            {selectedDelta && (
              <div 
                className="flex-1 p-2.5 flex flex-col justify-between overflow-hidden"
                style={{ backgroundColor: 'var(--theme-surface, #161719)' }}
              >
                <div className="overflow-hidden flex flex-col gap-2">
                  
                  {/* File Header with Action Link */}
                  <div className="flex items-center justify-between">
                    <span 
                      className="font-mono text-xs font-semibold truncate"
                      style={{ color: 'var(--theme-text-bright, #f8fafc)' }}
                    >
                      {selectedDelta.filePath}
                    </span>
                    <button 
                      onClick={() => onSwitchFile && onSwitchFile(selectedDelta.filePath)}
                      className="text-[10px] font-mono hover:underline cursor-pointer"
                      style={{ color: 'var(--theme-accent, #3b82f6)' }}
                    >
                      Open Editor
                    </button>
                  </div>

                  {/* Modified Symbols Pill Box */}
                  <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                    {(selectedDelta.symbolsAdded || []).map(sym => (
                      <span 
                        key={sym} 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: 'var(--theme-surface-hover, #222426)',
                          borderColor: 'var(--theme-border-subtle, #2e3032)',
                          color: '#10b981'
                        }}
                      >
                        + {sym}()
                      </span>
                    ))}
                    {(selectedDelta.symbolsModified || []).map(sym => (
                      <span 
                        key={sym} 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: 'var(--theme-surface-hover, #222426)',
                          borderColor: 'var(--theme-border-subtle, #2e3032)',
                          color: '#f59e0b'
                        }}
                      >
                        ~ {sym}()
                      </span>
                    ))}
                    {(selectedDelta.symbolsDeleted || []).map(sym => (
                      <span 
                        key={sym} 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: 'var(--theme-surface-hover, #222426)',
                          borderColor: 'var(--theme-border-subtle, #2e3032)',
                          color: '#ef4444'
                        }}
                      >
                        - {sym}()
                      </span>
                    ))}
                  </div>

                  {/* Raw Diff Preview */}
                  {selectedDelta.diffSnippet && (
                    <pre 
                      className="p-2 rounded border font-mono text-[9px] overflow-x-auto max-h-28 leading-relaxed [&::-webkit-scrollbar]:hidden"
                      style={{
                        backgroundColor: 'var(--theme-background, #121314)',
                        borderColor: 'var(--theme-border, #242628)',
                        color: 'var(--theme-text-primary, #e2e8f0)'
                      }}
                    >
                      <code>{selectedDelta.diffSnippet}</code>
                    </pre>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 3. BOTTOM ACTION BAR (Rollback vs Keep)                           */}
        {/* ----------------------------------------------------------------- */}
        <div 
          className="px-3.5 py-2 border-t flex items-center justify-between text-xs font-mono"
          style={{
            backgroundColor: 'var(--theme-secondary, #191a1b)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--theme-text-secondary, #94a3b8)' }}>
            <span>Net LOC:</span>
            <span className="font-semibold" style={{ color: totalLocDelta >= 0 ? '#10b981' : '#ef4444' }}>
              {totalLocDelta >= 0 ? `+${totalLocDelta}` : totalLocDelta}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {agentBatch.blastProtectionBlocked ? (
              <>
                <button 
                  onClick={onDismiss}
                  className="px-2.5 py-1 rounded text-[11px] font-mono transition-all hover:opacity-90 cursor-pointer border"
                  style={{
                    backgroundColor: 'var(--theme-surface-hover, #222426)',
                    borderColor: 'var(--theme-border, #242628)',
                    color: 'var(--theme-text-primary, #e2e8f0)'
                  }}
                >
                  Keep Preserved
                </button>

                <button 
                  onClick={() => onApprove && onApprove(batchId)}
                  className="px-3 py-1 rounded text-[11px] font-mono font-medium transition-all hover:opacity-90 cursor-pointer text-white"
                  style={{
                    backgroundColor: 'var(--theme-accent, #3b82f6)'
                  }}
                  title="Override Blast Protection and apply these changes to disk"
                >
                  Restore Changes
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => onRollback && onRollback(batchId)}
                  className="px-2.5 py-1 rounded text-[11px] font-mono transition-all hover:opacity-90 cursor-pointer border"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#f87171'
                  }}
                >
                  Rollback
                </button>

                <button 
                  onClick={() => onApprove && onApprove(batchId)}
                  className="px-3 py-1 rounded text-[11px] font-mono font-medium transition-all hover:opacity-90 cursor-pointer text-white"
                  style={{
                    backgroundColor: 'var(--theme-accent, #3b82f6)'
                  }}
                >
                  Keep Changes
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}