// src/components/layout/NewItemModal.jsx
import React, { useState, useEffect } from 'react';
import { FilePlus, FolderPlus, X } from 'lucide-react';

export default function NewItemModal({ isOpen, onClose, onCreate, initialType = 'file' }) {
  const [itemType, setItemType] = useState(initialType);
  const [itemName, setItemName] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setItemType(initialType);
      setItemName('');
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    onCreate(itemName.trim(), itemType);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center font-sans">
      <div className="bg-[#181818] w-[450px] border border-[#333] shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-[#1e1e1e] p-4 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            {itemType === 'file' ? <FilePlus size={18} className="text-blue-400" /> : <FolderPlus size={18} className="text-blue-400" />}
            Create New {itemType === 'file' ? 'File' : 'Folder'}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700/50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 bg-[#141414]">
          <div className="flex bg-[#252526] p-1 rounded-lg border border-[#333]">
            <button
              type="button"
              onClick={() => setItemType('file')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                itemType === 'file' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FilePlus size={14} /> File
            </button>
            <button
              type="button"
              onClick={() => setItemType('folder')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
                itemType === 'folder' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderPlus size={14} /> Folder
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-slate-400 text-xs font-medium">
              {itemType === 'file' ? 'File Path (e.g. src/utils/helpers.py)' : 'Folder Name (e.g. src/controllers)'}
            </label>
            <input
              type="text"
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={itemType === 'file' ? 'e.g. main.py' : 'e.g. utils'}
              className="w-full bg-[#252526] border border-[#3c3c3c] focus:border-blue-500 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none transition-colors font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg">
              Create {itemType === 'file' ? 'File' : 'Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}