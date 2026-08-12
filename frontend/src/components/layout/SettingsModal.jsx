// src/components/layout/SettingsModal.jsx
import React, { useState } from 'react';
import { Search, X, Settings2 } from 'lucide-react';

const SETTINGS_DEF = [
  { id: 'fontSize', label: 'Editor: Font Size', desc: 'Controls the font size in pixels.', type: 'number', category: 'Text Editor' },
  { id: 'wordWrap', label: 'Editor: Word Wrap', desc: 'Controls how lines should wrap.', type: 'select', options: ['off', 'on', 'bounded'], category: 'Text Editor' },
  { id: 'lineNumbers', label: 'Editor: Line Numbers', desc: 'Controls the display of line numbers.', type: 'select', options: ['on', 'off', 'relative'], category: 'Text Editor' },
  { id: 'minimap', label: 'Editor: Minimap', desc: 'Controls whether the code minimap is shown.', type: 'boolean', category: 'Text Editor' },
  { id: 'formatOnPaste', label: 'Editor: Format On Paste', desc: 'Controls whether the editor should automatically format pasted content.', type: 'boolean', category: 'Formatting' },
];

export default function SettingsModal({ isOpen, onClose, settings, updateSetting }) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredSettings = SETTINGS_DEF.filter(s => 
    s.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center font-sans">
      <div className="bg-[#181818] w-[800px] h-[600px] max-h-[90vh] border border-[#333] shadow-2xl rounded-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header & Search */}
        <div className="bg-[#1e1e1e] p-4 border-b border-[#333] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Settings2 size={18} className="text-blue-400" />
              Settings
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700/50">
              <X size={18} />
            </button>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              autoFocus
              placeholder="Search settings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#252526] border border-[#3c3c3c] focus:border-blue-500 text-slate-200 text-sm rounded px-9 py-2 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Settings List */}
        <div className="flex-grow overflow-y-auto p-6 bg-[#141414]">
          {filteredSettings.length === 0 ? (
            <div className="text-center text-slate-500 mt-10">No settings found.</div>
          ) : (
            <div className="flex flex-col gap-6">
              {filteredSettings.map(setting => (
                <div key={setting.id} className="flex flex-col border-b border-[#222] pb-6 last:border-0">
                  <span className="text-slate-200 font-medium text-sm mb-1">{setting.label}</span>
                  <span className="text-slate-500 text-xs mb-3">{setting.desc}</span>
                  
                  {setting.type === 'number' && (
                    <input 
                      type="number" 
                      value={settings[setting.id]} 
                      onChange={(e) => updateSetting(setting.id, Number(e.target.value))}
                      className="bg-[#3c3c3c] border border-transparent focus:border-blue-500 text-slate-200 text-sm px-3 py-1 rounded outline-none w-32"
                    />
                  )}

                  {setting.type === 'select' && (
                    <select 
                      value={settings[setting.id]} 
                      onChange={(e) => updateSetting(setting.id, e.target.value)}
                      className="bg-[#3c3c3c] border border-transparent focus:border-blue-500 text-slate-200 text-sm px-2 py-1 rounded outline-none w-48 cursor-pointer"
                    >
                      {setting.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}

                  {setting.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer w-max">
                      <input 
                        type="checkbox" 
                        checked={settings[setting.id]} 
                        onChange={(e) => updateSetting(setting.id, e.target.checked)}
                        className="accent-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm text-slate-300">Enabled</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}