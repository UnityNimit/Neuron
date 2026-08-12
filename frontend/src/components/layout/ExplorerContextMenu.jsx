// src/components/layout/ExplorerContextMenu.jsx
import React, { useEffect, useRef } from 'react';
import { 
  Play, Scissors, Copy, Clipboard, Trash2, Edit3, 
  Link, FileCode, ExternalLink, Columns 
} from 'lucide-react';

export default function ExplorerContextMenu({ 
  x, y, item, absPath, onClose, onRun, onOpenSide, onRename, onDelete, 
  onCopyPath, onCopyRelPath, onReveal, onCut, onCopy, onPaste, hasClipboard 
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

  if (!item) return null;

  return (
    <div 
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-[200] w-56 bg-[#1e1e1e] border border-[#333] shadow-2xl rounded-lg py-1.5 text-xs text-slate-300 font-sans animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Run File */}
      {item.type === 'file' && (
        <button onClick={() => { onRun(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Play size={13} fill="currentColor" /> Run File</span>
        </button>
      )}

      {/* Open to Side */}
      {item.type === 'file' && (
        <button onClick={() => { onOpenSide(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
          <span className="flex items-center gap-2"><Columns size={13} /> Open to the Side</span>
        </button>
      )}

      {/* Reveal in File Explorer */}
      <button onClick={() => { onReveal(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><ExternalLink size={13} /> Reveal in File Explorer</span>
      </button>

      <div className="my-1 border-t border-[#333]" />

      {/* Cut / Copy / Paste */}
      <button onClick={() => { onCut(item); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Scissors size={13} /> Cut</span>
        <span className="text-[10px] text-slate-500">Ctrl+X</span>
      </button>

      <button onClick={() => { onCopy(item); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Copy size={13} /> Copy</span>
        <span className="text-[10px] text-slate-500">Ctrl+C</span>
      </button>

      {item.type === 'folder' && (
        <button disabled={!hasClipboard} onClick={() => { onPaste(item); onClose(); }} className={`w-full px-3 py-1.5 flex items-center justify-between transition-colors ${hasClipboard ? 'hover:bg-blue-600 hover:text-white' : 'opacity-40 cursor-not-allowed'}`}>
          <span className="flex items-center gap-2"><Clipboard size={13} /> Paste</span>
          <span className="text-[10px] text-slate-500">Ctrl+V</span>
        </button>
      )}

      <div className="my-1 border-t border-[#333]" />

      {/* Copy Path / Relative Path */}
      <button onClick={() => { onCopyPath(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Link size={13} /> Copy Path</span>
      </button>

      <button onClick={() => { onCopyRelPath(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><FileCode size={13} /> Copy Relative Path</span>
      </button>

      <div className="my-1 border-t border-[#333]" />

      {/* Rename */}
      <button onClick={() => { onRename(item); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-blue-600 hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Edit3 size={13} /> Rename...</span>
        <span className="text-[10px] text-slate-500">F2</span>
      </button>

      {/* Delete */}
      <button onClick={() => { onDelete(item.path); onClose(); }} className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-red-600 hover:text-white text-red-400 transition-colors">
        <span className="flex items-center gap-2"><Trash2 size={13} /> Delete</span>
        <span className="text-[10px] text-slate-500">Delete</span>
      </button>
    </div>
  );
}