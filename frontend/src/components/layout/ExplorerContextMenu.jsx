// src/components/layout/ExplorerContextMenu.jsx
import React, { useEffect, useRef, useMemo } from 'react';
import { 
  Play, Scissors, Copy, Clipboard, Trash2, Edit3, 
  Link, FileCode, ExternalLink, Columns 
} from 'lucide-react';

export default function ExplorerContextMenu({ 
  x = 0, 
  y = 0, 
  item, 
  absPath, 
  onClose, 
  onRun, 
  onOpenSide, 
  onRename, 
  onDelete, 
  onCopyPath, 
  onCopyRelPath, 
  onReveal, 
  onCut, 
  onCopy, 
  onPaste, 
  hasClipboard 
}) {
  const menuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Viewport Edge Clamping (Prevents off-screen clipping)
  const { clampedX, clampedY } = useMemo(() => {
    if (typeof window === 'undefined') return { clampedX: x, clampedY: y };
    const menuWidth = 230;
    const menuHeight = 330;
    const safeX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 12));
    const safeY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 12));
    return { clampedX: safeX, clampedY: safeY };
  }, [x, y]);

  if (!item) return null;

  const isFolder = item.type === 'folder';

  return (
    <div 
      ref={menuRef}
      style={{ top: clampedY, left: clampedX }}
      className="fixed z-[200] w-56 bg-[#191a1b]/95 border border-[#2e3032] shadow-2xl rounded-xl py-1.5 text-xs text-slate-300 font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Execution & Layout */}
      {!isFolder && onRun && (
        <button 
          onClick={() => { onRun(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left group"
        >
          <span className="flex items-center gap-2">
            <Play size={12} fill="currentColor" className="text-emerald-400 group-hover:text-emerald-300" />
            <span>Run File</span>
          </span>
          <span className="text-[10px] text-slate-500">F5</span>
        </button>
      )}

      {!isFolder && onOpenSide && (
        <button 
          onClick={() => { onOpenSide(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Columns size={12} className="text-blue-400" />
            <span>Open to Side</span>
          </span>
        </button>
      )}

      {onReveal && (
        <button 
          onClick={() => { onReveal(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <ExternalLink size={12} className="text-slate-400" />
            <span>Reveal in Explorer</span>
          </span>
        </button>
      )}

      <div className="my-1 border-t border-[#242628]" />

      {/* 2. Clipboard Operations (Cut / Copy / Paste) */}
      <button 
        onClick={() => { if (onCut) onCut(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Scissors size={12} className="text-slate-400" />
          <span>Cut</span>
        </span>
        <span className="text-[10px] text-slate-500">Ctrl+X</span>
      </button>

      <button 
        onClick={() => { if (onCopy) onCopy(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Copy size={12} className="text-slate-400" />
          <span>Copy</span>
        </span>
        <span className="text-[10px] text-slate-500">Ctrl+C</span>
      </button>

      {isFolder && (
        <button 
          disabled={!hasClipboard} 
          onClick={() => { if (onPaste) onPaste(item); onClose(); }} 
          className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors text-left ${
            hasClipboard 
              ? 'hover:bg-blue-600/20 hover:text-white cursor-pointer' 
              : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clipboard size={12} className="text-slate-400" />
            <span>Paste</span>
          </span>
          <span className="text-[10px] text-slate-500">Ctrl+V</span>
        </button>
      )}

      <div className="my-1 border-t border-[#242628]" />

      {/* 3. Path Copying */}
      <button 
        onClick={() => { if (onCopyPath) onCopyPath(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Link size={12} className="text-slate-400" />
          <span>Copy Path</span>
        </span>
      </button>

      <button 
        onClick={() => { if (onCopyRelPath) onCopyRelPath(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <FileCode size={12} className="text-slate-400" />
          <span>Copy Relative Path</span>
        </span>
      </button>

      <div className="my-1 border-t border-[#242628]" />

      {/* 4. Rename & Delete */}
      <button 
        onClick={() => { if (onRename) onRename(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600/20 hover:text-white transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Edit3 size={12} className="text-blue-400" />
          <span>Rename...</span>
        </span>
        <span className="text-[10px] text-slate-500">F2</span>
      </button>

      <button 
        onClick={() => { if (onDelete) onDelete(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-red-600 hover:text-white text-red-400 transition-colors cursor-pointer text-left group"
      >
        <span className="flex items-center gap-2">
          <Trash2 size={12} className="text-red-400 group-hover:text-white" />
          <span>Delete</span>
        </span>
        <span className="text-[10px] text-slate-500 group-hover:text-white/80">Del</span>
      </button>
    </div>
  );
}