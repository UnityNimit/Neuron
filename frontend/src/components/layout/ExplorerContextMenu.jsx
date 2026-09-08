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
      style={{ 
        top: clampedY, 
        left: clampedX,
        backgroundColor: 'var(--theme-surface, #191a1b)',
        borderColor: 'var(--theme-border-subtle, #2e3032)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
      className="fixed z-[200] w-56 border shadow-2xl rounded-xl py-1.5 text-xs font-mono backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Execution & Layout */}
      {!isFolder && onRun && (
        <button 
          onClick={() => { onRun(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left group"
        >
          <span className="flex items-center gap-2">
            <Play size={12} fill="currentColor" className="text-emerald-500" />
            <span>Run File</span>
          </span>
          <span className="text-[10px] text-[var(--theme-text-muted)]">F5</span>
        </button>
      )}

      {!isFolder && onOpenSide && (
        <button 
          onClick={() => { onOpenSide(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <Columns size={12} className="text-[var(--theme-accent)]" />
            <span>Open to Side</span>
          </span>
        </button>
      )}

      {onReveal && (
        <button 
          onClick={() => { onReveal(item.path); onClose(); }} 
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <ExternalLink size={12} className="text-[var(--theme-text-muted)]" />
            <span>Reveal in Explorer</span>
          </span>
        </button>
      )}

      <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />

      {/* 2. Clipboard Operations (Cut / Copy / Paste) */}
      <button 
        onClick={() => { if (onCut) onCut(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Scissors size={12} className="text-[var(--theme-text-muted)]" />
          <span>Cut</span>
        </span>
        <span className="text-[10px] text-[var(--theme-text-muted)]">Ctrl+X</span>
      </button>

      <button 
        onClick={() => { if (onCopy) onCopy(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Copy size={12} className="text-[var(--theme-text-muted)]" />
          <span>Copy</span>
        </span>
        <span className="text-[10px] text-[var(--theme-text-muted)]">Ctrl+C</span>
      </button>

      {isFolder && (
        <button 
          disabled={!hasClipboard} 
          onClick={() => { if (onPaste) onPaste(item); onClose(); }} 
          className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors text-left ${
            hasClipboard 
              ? 'hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] cursor-pointer' 
              : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clipboard size={12} className="text-[var(--theme-text-muted)]" />
            <span>Paste</span>
          </span>
          <span className="text-[10px] text-[var(--theme-text-muted)]">Ctrl+V</span>
        </button>
      )}

      <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />

      {/* 3. Path Copying */}
      <button 
        onClick={() => { if (onCopyPath) onCopyPath(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Link size={12} className="text-[var(--theme-text-muted)]" />
          <span>Copy Path</span>
        </span>
      </button>

      <button 
        onClick={() => { if (onCopyRelPath) onCopyRelPath(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <FileCode size={12} className="text-[var(--theme-text-muted)]" />
          <span>Copy Relative Path</span>
        </span>
      </button>

      <div className="my-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }} />

      {/* 4. Rename & Delete */}
      <button 
        onClick={() => { if (onRename) onRename(item); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer text-left"
      >
        <span className="flex items-center gap-2">
          <Edit3 size={12} className="text-[var(--theme-accent)]" />
          <span>Rename...</span>
        </span>
        <span className="text-[10px] text-[var(--theme-text-muted)]">F2</span>
      </button>

      <button 
        onClick={() => { if (onDelete) onDelete(item.path); onClose(); }} 
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-red-600 hover:text-white text-red-500 transition-colors cursor-pointer text-left group"
      >
        <span className="flex items-center gap-2">
          <Trash2 size={12} className="text-red-500 group-hover:text-white" />
          <span>Delete</span>
        </span>
        <span className="text-[10px] text-[var(--theme-text-muted)] group-hover:text-white/80">Del</span>
      </button>
    </div>
  );
}