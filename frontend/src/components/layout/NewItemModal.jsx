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
      <div 
        className="w-[450px] border shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--theme-surface, #181818)',
          borderColor: 'var(--theme-border, #333)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
      >
        
        <div 
          className="p-4 border-b flex items-center justify-between"
          style={{
            backgroundColor: 'var(--theme-secondary, #1e1e1e)',
            borderColor: 'var(--theme-border, #333)'
          }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--theme-text-bright, #fff)' }}>
            {itemType === 'file' ? <FilePlus size={18} className="text-[var(--theme-accent)]" /> : <FolderPlus size={18} className="text-[var(--theme-accent)]" />}
            Create New {itemType === 'file' ? 'File' : 'Folder'}
          </div>
          <button 
            onClick={onClose} 
            className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors p-1 rounded-md hover:bg-[var(--theme-surface-hover)] cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="p-6 flex flex-col gap-4"
          style={{ backgroundColor: 'var(--theme-background, #141414)' }}
        >
          <div 
            className="flex p-1 rounded-lg border"
            style={{
              backgroundColor: 'var(--theme-surface, #252526)',
              borderColor: 'var(--theme-border-subtle, #333)'
            }}
          >
            <button
              type="button"
              onClick={() => setItemType('file')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                itemType === 'file' 
                  ? 'bg-[var(--theme-accent)] text-white shadow-md' 
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
              }`}
            >
              <FilePlus size={14} /> File
            </button>
            <button
              type="button"
              onClick={() => setItemType('folder')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                itemType === 'folder' 
                  ? 'bg-[var(--theme-accent)] text-white shadow-md' 
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)]'
              }`}
            >
              <FolderPlus size={14} /> Folder
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--theme-text-muted)] text-xs font-medium">
              {itemType === 'file' ? 'File Path (e.g. src/utils/helpers.py)' : 'Folder Name (e.g. src/controllers)'}
            </label>
            <input
              type="text"
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={itemType === 'file' ? 'e.g. main.py' : 'e.g. utils'}
              className="w-full border focus:border-[var(--theme-accent)] text-[var(--theme-text-primary)] text-sm rounded-lg px-3 py-2 outline-none transition-colors font-mono"
              style={{
                backgroundColor: 'var(--theme-surface, #252526)',
                borderColor: 'var(--theme-border, #3c3c3c)'
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-xs font-semibold bg-[var(--theme-accent)] hover:brightness-110 text-white rounded-lg transition-all shadow-lg cursor-pointer"
            >
              Create {itemType === 'file' ? 'File' : 'Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}