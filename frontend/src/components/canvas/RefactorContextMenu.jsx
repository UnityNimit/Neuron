// frontend/src/components/canvas/RefactorContextMenu.jsx
import React, { useEffect, useRef } from 'react';
import { Scissors, Layers, ArrowRight, FileCode, CheckSquare, X, ExternalLink } from 'lucide-react';

export default function RefactorContextMenu({
  isOpen,
  position,
  selectedNodes = [],
  targetNode = null,
  onClose,
  onDivideFile,
  onCombineFiles,
  onMoveFunctions,
  onExtractFunctions,
  onOpenInEditor,
  onClearSelection
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  // Classify selected nodes
  const fileNodes = selectedNodes.filter(n => n.data?.nodeType === 'file');
  const funcNodes = selectedNodes.filter(n => n.data?.nodeType === 'function');
  const folderNodes = selectedNodes.filter(n => n.data?.nodeType === 'folder');

  const hasFiles = fileNodes.length > 0;
  const hasFunctions = funcNodes.length > 0;

  // Viewport boundary clamping for smooth positioning
  const menuWidth = 240;
  const menuHeight = 220;
  const clampedX = Math.min(position.x, window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(position.y, window.innerHeight - menuHeight - 12);

  const primaryTargetNode = targetNode || selectedNodes[0] || null;
  const isPrimaryFile = primaryTargetNode?.data?.nodeType === 'file';
  const primaryFileName = primaryTargetNode?.data?.label || primaryTargetNode?.id?.split(/[\\/]/).pop() || 'Node';

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-xl border shadow-2xl p-1.5 flex flex-col gap-0.5 text-xs font-mono select-none backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        backgroundColor: 'rgba(20, 21, 23, 0.95)',
        borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.12))',
        color: 'var(--theme-text-bright, #f1f5f9)',
        boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
      }}
    >
      {/* HEADER: Target & Selection Summary */}
      <div className="px-2.5 py-1.5 mb-1 border-b border-[var(--theme-border)] flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span 
            className="w-2 h-2 rounded-full shrink-0" 
            style={{ 
              backgroundColor: isPrimaryFile ? '#3b82f6' : (primaryTargetNode?.data?.nodeType === 'function' ? '#8b5cf6' : '#e4ef61') 
            }} 
          />
          <span className="font-semibold truncate max-w-[140px] text-slate-200">
            {primaryFileName}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-sans px-1.5 py-0.5 rounded bg-white/5 border border-white/5 shrink-0">
          {selectedNodes.length} orb{selectedNodes.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* ACTION 1: DIVIDE FILE INTO SEPARATE PARTS (Single File Selected) */}
      {fileNodes.length === 1 && !hasFunctions && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onDivideFile(fileNodes[0]);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover,rgba(255,255,255,0.08))] text-slate-200 hover:text-white"
        >
          <Scissors size={14} className="text-amber-400 shrink-0" />
          <span className="flex-1">Divide File into Parts...</span>
        </button>
      )}

      {/* ACTION 2: COMBINE SELECTED FILES (2+ Files Selected) */}
      {fileNodes.length >= 2 && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onCombineFiles(fileNodes);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover,rgba(255,255,255,0.08))] text-slate-200 hover:text-white"
        >
          <Layers size={14} className="text-blue-400 shrink-0" />
          <span className="flex-1">Combine {fileNodes.length} Files...</span>
        </button>
      )}

      {/* ACTION 3: MOVE FUNCTIONS TO TARGET FILE (1 File + 1+ Functions) */}
      {fileNodes.length === 1 && funcNodes.length >= 1 && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onMoveFunctions(funcNodes, fileNodes[0]);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover,rgba(255,255,255,0.08))] text-slate-200 hover:text-white"
        >
          <ArrowRight size={14} className="text-purple-400 shrink-0" />
          <span className="flex-1">Move {funcNodes.length} Function{funcNodes.length > 1 ? 's' : ''} to File</span>
        </button>
      )}

      {/* ACTION 4: EXTRACT FUNCTIONS TO NEW FILE (1+ Functions Only) */}
      {funcNodes.length >= 1 && fileNodes.length === 0 && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onExtractFunctions(funcNodes);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover,rgba(255,255,255,0.08))] text-slate-200 hover:text-white"
        >
          <FileCode size={14} className="text-purple-400 shrink-0" />
          <span className="flex-1">Extract {funcNodes.length} Function{funcNodes.length > 1 ? 's' : ''} to New File...</span>
        </button>
      )}

      {/* ACTION 5: OPEN IN CODE EDITOR */}
      {isPrimaryFile && onOpenInEditor && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenInEditor(primaryTargetNode.data?.filePath || primaryTargetNode.id);
          }}
          className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover,rgba(255,255,255,0.08))] text-slate-300 hover:text-white"
        >
          <ExternalLink size={14} className="text-slate-400 shrink-0" />
          <span className="flex-1">Open in Editor</span>
        </button>
      )}

      <div className="h-px bg-[var(--theme-border)] my-1 opacity-60" />

      {/* ACTION: DESELECT ALL */}
      <button
        type="button"
        onClick={() => {
          onClose();
          onClearSelection();
        }}
        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-white/5 text-slate-400 hover:text-slate-200"
      >
        <span className="flex items-center gap-2">
          <X size={13} className="shrink-0" />
          <span>Clear Selection</span>
        </span>
        <kbd className="text-[10px] font-sans px-1 rounded bg-white/5 text-slate-400">Esc</kbd>
      </button>
    </div>
  );
}
