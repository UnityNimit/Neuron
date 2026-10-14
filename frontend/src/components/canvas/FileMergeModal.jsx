// frontend/src/components/canvas/FileMergeModal.jsx
import React, { useState } from 'react';

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
          setErrorMsg(data.reason || 'failed to combine files');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
      <div 
        className="pointer-events-auto border p-3 flex flex-col gap-2 font-mono text-xs select-none min-w-[280px] max-w-sm rounded-none shadow-2xl animate-in fade-in duration-100"
        style={{
          backgroundColor: 'var(--theme-background, #121314)',
          borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.15))',
          color: 'var(--theme-text-bright, #f1f5f9)'
        }}
      >
        {/* TWO OR MORE FILE OPTIONS WITH TEXT */}
        <div className="flex flex-col gap-1.5">
          {selectedFiles.map(f => {
            const p = f.data?.filePath || f.id;
            const isSelected = p === destFile;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDestFile(p)}
                className={`px-2.5 py-1.5 text-left border transition-colors cursor-pointer font-mono text-xs flex items-center justify-between rounded-none ${
                  isSelected
                    ? 'border-[var(--theme-accent,#3b82f6)] bg-[var(--theme-accent,#3b82f6)]/10 text-[var(--theme-text-bright,#ffffff)]'
                    : 'border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="truncate">{p}</span>
                {isSelected && (
                  <span className="text-[10px] text-[var(--theme-accent,#3b82f6)] font-mono ml-2 shrink-0">dest</span>
                )}
              </button>
            );
          })}
        </div>

        {/* MINIMAL ERROR TEXT IF ANY */}
        {errorMsg && (
          <div className="text-[11px] text-rose-400 font-mono truncate">
            can't · {errorMsg}
          </div>
        )}

        {/* TICK & CROSS BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-1 font-mono">
          <button
            type="button"
            onClick={onClose}
            disabled={executing}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-sm font-bold px-1"
            title="Cancel"
          >
            ✕
          </button>
          <button
            type="button"
            onClick={handleExecuteMerge}
            disabled={executing || !destFile}
            className="text-zinc-200 hover:text-white transition-colors cursor-pointer text-sm font-bold px-1 disabled:opacity-30 disabled:pointer-events-none"
            title="Confirm"
          >
            {executing ? '...' : '✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
