// src/components/layout/CommandPalette.jsx
import React, { useMemo } from 'react';
import { Search, FileCode2, Box, Play, Settings } from 'lucide-react';

export default function CommandPalette({ 
  isOpen, onClose, searchQuery, setSearchQuery, 
  workspace, onRunCode, onOpenSettings 
}) {
  if (!isOpen) return null;

  // Search Engine Logic
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    const results = [];
    
    workspace.files.forEach(f => {
      if (f.toLowerCase().includes(query)) results.push({ type: 'file', label: f, icon: <FileCode2 size={14} className="text-blue-400"/> });
    });
    
    workspace.nodes.forEach(n => {
      if (n.id.toLowerCase().includes(query)) results.push({ type: 'node', label: n.id, id: n.id, icon: <Box size={14} className="text-purple-400"/> });
    });
    
    const commands = [
      { type: 'command', label: 'Run Code', action: onRunCode, icon: <Play size={14} className="text-green-400"/> },
      { type: 'command', label: 'Open Settings', action: onOpenSettings, icon: <Settings size={14} className="text-slate-400"/> },
    ];
    
    commands.forEach(c => {
      if (c.label.toLowerCase().includes(query)) results.push(c);
    });

    return results;
  }, [searchQuery, workspace.files, workspace.nodes, onRunCode, onOpenSettings]);

  const handleSelect = (result) => {
    onClose();
    if (result.type === 'file') {
      if (result.label !== workspace.currentFile) {
        workspace.setIsGraphLoaded(false);
        workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: result.label }));
      }
    } else if (result.type === 'node') {
      workspace.setNodes(nds => nds.map(n => ({ ...n, selected: n.id === result.id })));
    } else if (result.type === 'command') {
      result.action();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-start justify-center pt-24">
      <div className="bg-[#1e1e1e] w-[600px] border border-[#333] shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in slide-in-from-top-4 duration-150">
        <div className="flex items-center px-4 py-3 border-b border-[#333]">
          <Search size={18} className="text-blue-400 mr-3" />
          <input 
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files, functions, and commands..."
            className="w-full bg-transparent text-slate-200 outline-none placeholder-slate-500"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
        </div>
        {searchQuery && (
          <div className="max-h-[300px] overflow-y-auto py-2">
            {searchResults.length === 0 ? (
              <div className="text-center text-slate-500 py-4 text-sm">No results found.</div>
            ) : (
              searchResults.map((res, i) => (
                <div key={i} onClick={() => handleSelect(res)} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2a2d31] cursor-pointer text-sm">
                  {res.icon}
                  <span className="text-slate-300">{res.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">{res.type}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}