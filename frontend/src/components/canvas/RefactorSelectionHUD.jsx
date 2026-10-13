// frontend/src/components/canvas/RefactorSelectionHUD.jsx
import React from 'react';
import { X } from 'lucide-react';

export default function RefactorSelectionHUD({
  selectedNodes = [],
  onDivideFile,
  onCombineFiles,
  onMoveFunctions,
  onExtractFunctions,
  onClearSelection
}) {
  if (!selectedNodes || selectedNodes.length === 0) return null;

  const fileNodes = selectedNodes.filter(n => n.data?.nodeType === 'file');
  const funcNodes = selectedNodes.filter(n => n.data?.nodeType === 'function');

  return (
    <div 
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 h-7 flex items-center gap-2.5 px-3 rounded-full border shadow-lg backdrop-blur-md text-[11px] font-mono select-none animate-in fade-in duration-150"
      style={{
        backgroundColor: 'rgba(18, 19, 22, 0.94)',
        borderColor: 'var(--theme-border, rgba(255, 255, 255, 0.12))',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* SELECTION COUNT */}
      <span className="text-zinc-400 font-medium">
        {selectedNodes.length} selected
      </span>

      {/* THIN VERTICAL SEPARATOR */}
      <div className="w-px h-3 bg-white/10" />

      {/* CONTEXTUAL ACTIONS (PLAIN TEXT) */}
      <div className="flex items-center gap-1.5 font-sans">
        {/* 1 File: Divide File */}
        {fileNodes.length === 1 && funcNodes.length === 0 && (
          <button
            type="button"
            onClick={() => onDivideFile(fileNodes[0])}
            className="text-zinc-200 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            Divide
          </button>
        )}

        {/* 2+ Files: Combine Files */}
        {fileNodes.length >= 2 && (
          <button
            type="button"
            onClick={() => onCombineFiles(fileNodes)}
            className="text-zinc-200 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            Combine {fileNodes.length}
          </button>
        )}

        {/* 1 File + Functions: Move Functions */}
        {fileNodes.length === 1 && funcNodes.length >= 1 && (
          <button
            type="button"
            onClick={() => onMoveFunctions(funcNodes, fileNodes[0])}
            className="text-zinc-200 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            Move
          </button>
        )}

        {/* 1+ Functions Only: Extract Functions */}
        {funcNodes.length >= 1 && fileNodes.length === 0 && (
          <button
            type="button"
            onClick={() => onExtractFunctions(funcNodes)}
            className="text-zinc-200 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            Extract
          </button>
        )}
      </div>

      {/* THIN VERTICAL SEPARATOR */}
      <div className="w-px h-3 bg-white/10" />

      {/* CLEAR SELECTION (ONLY CROSS ICON, ZERO TEXT) */}
      <button
        type="button"
        onClick={onClearSelection}
        className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10"
        title="Deselect All (Esc)"
      >
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
