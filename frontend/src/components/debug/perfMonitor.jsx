// src/components/debug/PerfMonitor.jsx
import React, { useEffect, useState } from 'react';
import { perfTracker } from '../../services/perfTracker';
import { Activity, Download, Trash2 } from 'lucide-react';

export default function PerfMonitor() {
  const [metrics, setMetrics] = useState({ fps: 0, heap: '0MB' });

  useEffect(() => {
    perfTracker.start();
    const interval = setInterval(() => {
      setMetrics({
        fps: perfTracker.fps,
        heap: perfTracker.logs[perfTracker.logs.length - 1]?.heapUsed || '0MB'
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-12 right-4 z-[9999] bg-[#141414]/90 border border-[#333] p-2 rounded-lg text-[10px] font-mono flex flex-col gap-2 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Activity size={12} className={metrics.fps < 50 ? "text-red-500" : "text-green-500"} />
          <span className={metrics.fps < 50 ? "text-red-400 font-bold" : "text-slate-300"}>
            {metrics.fps} FPS
          </span>
        </div>
        <div className="text-blue-400">{metrics.heap}</div>
      </div>
      
      <div className="flex gap-2 border-t border-[#333] pt-2">
        <button 
          onClick={() => perfTracker.exportLogs()}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          <Download size={10} /> Export CSV
        </button>
        <button 
          onClick={() => { perfTracker.logs = []; }}
          className="flex items-center gap-1 hover:text-red-400 transition-colors"
        >
          <Trash2 size={10} /> Clear
        </button>
      </div>
    </div>
  );
}