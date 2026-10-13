// frontend/src/components/canvas/FileMergeModal.jsx
import React, { useState } from 'react';
import { Layers, X, AlertCircle, RefreshCw, Check, ArrowRight } from 'lucide-react';

export default function FileMergeModal({
  isOpen,
  selectedFiles = [],
  workspace,
  onClose,
  onMergeSuccess
}) {
  const [destFile, setDestFile] = useState(
    selectedFiles.length > 0 ? (selectedFiles[0]?.data?.filePath || selectedFiles[0]?.id || '') : ''
  );
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || selectedFiles.length < 2) return null;

  const handleExecuteMerge = () => {
    if (!workspace?.wsRef?.current || executing || !destFile) return;

    setExecuting(true);
    setErrorMsg(null);

    const sourceFiles = selectedFiles
      .map(f => f.data?.filePath || f.id)
      .filter(p => p !== destFile);

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'REFACTOR_FILE_MERGE_SUCCESS') {
          workspace.wsRef.current.removeEventListener('message', handleMessage);
          setExecuting(false);
          workspace.addNotification?.('success', 'Files Combined', data.message || 'Files merged successfully.', 'ai');
          if (onMergeSuccess) onMergeSuccess(data);
          onClose();
        } else if (data.event === 'REFACTOR_FILE_MERGE_ERROR') {
          workspace.wsRef.current.removeEventListener('message', handleMessage);
          setExecuting(false);
          setErrorMsg(data.reason || 'Failed to combine files.');
        }
      } catch (err) {
        // ignore
      }
    };

    workspace.wsRef.current.addEventListener('message', handleMessage);

    workspace.wsRef.current.send(JSON.stringify({
      event: 'REFACTOR_FILE_MERGE',
      source_files: sourceFiles,
      dest_file: destFile
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-mono text-xs select-none"
        style={{
          backgroundColor: '#141517',
          borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.12))',
          color: 'var(--theme-text-bright, #f1f5f9)'
        }}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Combine {selectedFiles.length} Selected Files
              </h2>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Merge functions, deduplicate imports, and redirect workspace references.
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

        {/* BODY */}
        <div className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 flex items-start gap-2.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1 font-sans text-xs">
                <span className="font-semibold block font-mono">Merge Error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Select Primary Destination File
            </span>
            <div className="flex flex-col gap-2">
              {selectedFiles.map(f => {
                const p = f.data?.filePath || f.id;
                const isSelected = p === destFile;
                return (
                  <label
                    key={p}
                    onClick={() => setDestFile(p)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-blue-400 bg-blue-500' : 'border-white/20'
                      }`}>
                        {isSelected && <Check size={10} className="text-black font-bold" />}
                      </div>
                      <span className="font-semibold">{p}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                        Destination
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* SUMMARY NOTE */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 font-sans text-[11px] text-slate-400 leading-relaxed">
            All code from other files will be cleanly appended into <strong className="text-slate-200 font-mono">{destFile}</strong>. All workspace imports pointing to the merged source files will be atomically updated, and the source files will be safely removed.
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3.5 border-t border-[var(--theme-border)] flex items-center justify-end gap-2.5 bg-white/[0.02]">
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
            onClick={handleExecuteMerge}
            disabled={executing || !destFile}
            className="px-4 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:pointer-events-none"
          >
            {executing ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Combining...</span>
              </>
            ) : (
              <>
                <Layers size={13} />
                <span>Confirm & Combine Files</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
