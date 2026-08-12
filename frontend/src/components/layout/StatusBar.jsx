// src/components/layout/StatusBar.jsx
import React from 'react';
import { AlertCircle, AlertTriangle, Bell, Radio, Code2 } from 'lucide-react';

export default function StatusBar({ 
  activeFile = "server.py", 
  errorCount = 0, 
  warningCount = 0, 
  lineCount = 35, 
  wordCount = 142,
  language = "Python", 
  encoding = "UTF-8" 
}) {
  return (
    <div className="h-6 shrink-0 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] font-sans select-none z-50">
      
      {/* Left Side Metrics */}
      <div className="flex items-center gap-3">
        {/* Live AI Engine Health */}
        <div className="flex items-center gap-1.5 hover:bg-black/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors" title="AI Engine Status">
          <Radio size={12} className="text-green-300 animate-pulse" />
          <span className="font-semibold tracking-wide">Neuron: Active</span>
        </div>

        {/* Problems & Warnings */}
        <div className="flex items-center gap-2 border-l border-white/20 pl-3">
          <button className="flex items-center gap-1 hover:bg-black/20 px-1.5 py-0.5 rounded transition-colors" title="Problems">
            <AlertCircle size={12} className="text-red-200" />
            <span>{errorCount}</span>
          </button>
          <button className="flex items-center gap-1 hover:bg-black/20 px-1.5 py-0.5 rounded transition-colors" title="Warnings">
            <AlertTriangle size={12} className="text-yellow-200" />
            <span>{warningCount}</span>
          </button>
        </div>
      </div>

      {/* Right Side Metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="hover:bg-black/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors">
            Ln {lineCount}, Col 1 ({wordCount} words)
          </span>
          <span className="hover:bg-black/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors uppercase">
            {encoding}
          </span>
          <span className="hover:bg-black/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors capitalize flex items-center gap-1">
            <Code2 size={12} /> {language}
          </span>
        </div>

        {/* Notifications Trigger */}
        <button className="hover:bg-black/20 p-1 rounded transition-colors relative ml-1" title="Notifications">
          <Bell size={12} />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-ping"></span>
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-yellow-300 rounded-full"></span>
        </button>
      </div>

    </div>
  );
}