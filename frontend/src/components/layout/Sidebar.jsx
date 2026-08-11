import React from 'react';
import { FolderOpen, FileCode2, Plus, X } from 'lucide-react';

export default function Sidebar({ files, currentFile, onSwitchFile, onCreateFile, onDeleteFile }) {
  return (
    <div className="w-full h-full bg-[#1e1e1e] flex flex-col">
      <div className="p-3 text-[11px] font-bold tracking-widest text-slate-400 flex items-center justify-between uppercase shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} /> Explorer
        </div>
        <button onClick={onCreateFile} className="hover:text-white transition-colors">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto px-2 pb-4">
        {files.map(file => (
          <div 
            key={file} 
            onClick={() => onSwitchFile(file)} 
            className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer text-sm mb-0.5 group transition-all ${
              currentFile === file 
                ? 'bg-blue-600/20 text-blue-400 font-medium' 
                : 'hover:bg-[#2a2d31] text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <FileCode2 size={14} className={currentFile === file ? "text-blue-400" : "text-slate-500"} />
              <span className="truncate">{file}</span>
            </div>
            <button 
              onClick={(e) => onDeleteFile(file, e)} 
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}