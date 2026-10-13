// frontend/src/components/canvas/FileSplitModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  Scissors, X, Code, Check, AlertCircle, FileCode, 
  Layers, ArrowRight, Settings, Eye, RefreshCw, Plus, Trash2
} from 'lucide-react';

export default function FileSplitModal({
  isOpen,
  fileNode,
  workspace,
  onClose,
  onSplitSuccess
}) {
  const [strategy, setStrategy] = useState('modular');
  const [numParts, setNumParts] = useState(2);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Custom partition plan state: { target_file: [symbol_names] }
  const [partitions, setPartitions] = useState({});
  const [keepReexports, setKeepReexports] = useState(true);
  const [rewriteWorkspaceImports, setRewriteWorkspaceImports] = useState(true);
  const [activePreviewTab, setActivePreviewTab] = useState(null);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const filePath = fileNode?.data?.filePath || fileNode?.id || '';

  // Request preview whenever strategy or file changes
  useEffect(() => {
    if (!isOpen || !filePath || !workspace?.wsRef?.current) return;

    setLoading(true);
    setErrorMsg(null);

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'FILE_SPLIT_PREVIEW_RESULT') {
          const payload = data.payload || {};
          if (payload.success) {
            setPreviewData(payload);
            setPartitions(payload.split_plan || {});
            const planKeys = Object.keys(payload.split_plan || {});
            if (planKeys.length > 0) {
              setActivePreviewTab(planKeys[0]);
            }
          } else {
            setErrorMsg(payload.reason || 'Failed to analyze file for splitting.');
          }
          setLoading(false);
        } else if (data.event === 'REFACTOR_FILE_SPLIT_SUCCESS') {
          setExecuting(false);
          workspace.addNotification?.('success', 'File Split Complete', data.message || 'File split successfully.', 'ai');
          if (onSplitSuccess) onSplitSuccess(data);
          onClose();
        } else if (data.event === 'REFACTOR_FILE_SPLIT_ERROR') {
          setExecuting(false);
          setErrorMsg(data.reason || 'File split failed.');
        }
      } catch (err) {
        // ignore
      }
    };

    const ws = workspace.wsRef.current;
    ws.addEventListener('message', handleMessage);

    // Dispatch preview request
    ws.send(JSON.stringify({
      event: 'GET_FILE_SPLIT_PREVIEW',
      file_path: filePath,
      strategy: strategy,
      num_parts: numParts
    }));

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [isOpen, filePath, strategy, numParts, workspace?.wsRef]);

  if (!isOpen || !fileNode) return null;

  const handleExecuteSplit = () => {
    if (!workspace?.wsRef?.current || executing) return;
    if (Object.keys(partitions).length === 0) {
      setErrorMsg('No target partitions defined.');
      return;
    }

    setExecuting(true);
    setErrorMsg(null);

    workspace.wsRef.current.send(JSON.stringify({
      event: 'REFACTOR_FILE_SPLIT',
      source_file: filePath,
      split_plan: partitions,
      keep_reexports: keepReexports,
      rewrite_workspace_imports: rewriteWorkspaceImports
    }));
  };

  const handlePartitionRename = (oldPath, newPath) => {
    if (!newPath || oldPath === newPath) return;
    setPartitions(prev => {
      const updated = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (k === oldPath) updated[newPath] = v;
        else updated[k] = v;
      });
      return updated;
    });
    if (activePreviewTab === oldPath) setActivePreviewTab(newPath);
  };

  const handleMoveSymbol = (symbolName, fromPath, toPath) => {
    setPartitions(prev => {
      const fromSyms = (prev[fromPath] || []).filter(s => s !== symbolName);
      const toSyms = [...(prev[toPath] || []), symbolName];
      return {
        ...prev,
        [fromPath]: fromSyms,
        [toPath]: toSyms
      };
    });
  };

  const partitionKeys = Object.keys(partitions);
  const totalSymbols = previewData?.symbols?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-mono text-xs select-none max-h-[85vh]"
        style={{
          backgroundColor: '#141517',
          borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.12))',
          color: 'var(--theme-text-bright, #f1f5f9)'
        }}
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Scissors size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <span>Divide File</span>
                <span className="font-mono text-xs font-normal text-slate-400">({filePath})</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                AST symbol separation with automatic dependency preservation and re-exports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 flex items-start gap-2.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 font-sans text-xs">
                <span className="font-semibold block font-mono">Split Error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* STRATEGY SELECTOR */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Splitting Strategy
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStrategy('modular')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  strategy === 'modular'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <FileCode size={13} />
                  <span>Modular</span>
                </div>
                <div className="text-[10px] font-sans opacity-80 mt-1 leading-snug">
                  1 file per major class or independent component.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('dependency_clustering')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  strategy === 'dependency_clustering'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <Layers size={13} />
                  <span>Coupled Clusters</span>
                </div>
                <div className="text-[10px] font-sans opacity-80 mt-1 leading-snug">
                  Groups coupled symbols with mutual call dependencies.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStrategy('balanced_size')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  strategy === 'balanced_size'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-xs flex items-center gap-1.5">
                  <Code size={13} />
                  <span>Balanced Size</span>
                </div>
                <div className="text-[10px] font-sans opacity-80 mt-1 leading-snug">
                  Divides lines of code evenly across N partitions.
                </div>
              </button>
            </div>
          </div>

          {/* PARTITION COUNT (If Coupled or Balanced) */}
          {(strategy === 'dependency_clustering' || strategy === 'balanced_size') && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-slate-300">Number of Output Files:</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumParts(n)}
                    className={`w-7 h-7 rounded-lg font-mono text-xs transition-colors cursor-pointer ${
                      numParts === n
                        ? 'bg-amber-500 text-black font-bold'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LOADING STATE */}
          {loading && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw size={22} className="animate-spin text-amber-400" />
              <span>Analyzing AST and symbol dependencies...</span>
            </div>
          )}

          {/* PROPOSED PARTITIONS LIST */}
          {!loading && partitionKeys.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Target Partitions ({partitionKeys.length} Files Planned)
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  {totalSymbols} discovered symbol{totalSymbols > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {partitionKeys.map((pPath, pIdx) => {
                  const syms = partitions[pPath] || [];
                  return (
                    <div 
                      key={pPath}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {pIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={pPath}
                            onChange={(e) => handlePartitionRename(pPath, e.target.value)}
                            className="bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs font-mono text-slate-200 flex-1 outline-none focus:border-amber-400"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-sans shrink-0">
                          {syms.length} symbol{syms.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Symbols list in this partition */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {syms.map(symName => {
                          const symMeta = (previewData?.symbols || []).find(s => s.name === symName);
                          const isCls = symMeta?.kind === 'class';
                          return (
                            <span
                              key={symName}
                              className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 border border-white/5 flex items-center gap-1.5 text-slate-300"
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full" 
                                style={{ backgroundColor: isCls ? '#3b82f6' : '#8b5cf6' }} 
                              />
                              <span className="font-semibold">{symName}</span>
                              {symMeta?.line_count && (
                                <span className="text-[9px] text-slate-500 font-sans">
                                  {symMeta.line_count}L
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SAFETY & REFACTORING TOGGLES */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 font-sans text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={keepReexports}
                onChange={(e) => setKeepReexports(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-white/5 cursor-pointer"
              />
              <div>
                <span className="font-semibold block font-mono text-[11px]">
                  Keep Re-Exports in Source File
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Injects re-exports in {filePath} so all existing files importing from it continue to work without breaking.
                </span>
              </div>
            </label>

            <div className="h-px bg-white/5 my-0.5" />

            <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={rewriteWorkspaceImports}
                onChange={(e) => setRewriteWorkspaceImports(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-white/5 cursor-pointer"
              />
              <div>
                <span className="font-semibold block font-mono text-[11px]">
                  Rewrite Workspace Imports
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Updates other files in the workspace to directly import from the new split files.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-[var(--theme-border)] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-sans">
              Transaction commits atomically with instant rollback on any error.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={executing}
              className="px-3.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteSplit}
              disabled={executing || loading || partitionKeys.length === 0}
              className="px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:pointer-events-none"
            >
              {executing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Splitting...</span>
                </>
              ) : (
                <>
                  <Scissors size={13} />
                  <span>Execute Split</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
