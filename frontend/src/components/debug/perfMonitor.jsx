// src/components/debug/PerfMonitor.jsx
import React, { useEffect, useState } from 'react';
import { perfTracker } from '../../services/perfTracker';
import { Download } from 'lucide-react';

export default function PerfMonitor() {
  const [m, setM] = useState({ fps: 0, ram: 'N/A', cpu: '0%' });

  useEffect(() => {
    perfTracker.start();
    const i = setInterval(() => {
      const last = perfTracker.logs[perfTracker.logs.length - 1];
      if (last) setM(last);
    }, 500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="fixed bottom-12 right-4 z-[9999] bg-[#0a0a0ae6] border border-[#333] p-3 rounded-lg text-[11px] font-mono shadow-2xl flex flex-col gap-2">
      <div className="flex gap-4">
        <div className="flex flex-col">
          <span className="text-slate-500 uppercase text-[9px]">Frame Rate</span>
          <span className={m.fps < 40 ? "text-red-500 font-bold" : "text-green-400"}>{m.fps} FPS</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 uppercase text-[9px]">CPU Load</span>
          <span className={parseInt(m.cpu) > 40 ? "text-orange-500" : "text-blue-400"}>{m.cpu}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-500 uppercase text-[9px]">Memory</span>
          <span className="text-purple-400">{m.ram}</span>
        </div>
      </div>
      
      <button onClick={() => perfTracker.exportLogs()} className="flex items-center gap-2 bg-[#222] hover:bg-[#333] p-1 rounded justify-center transition-colors">
        <Download size={10} /> Export CSV
      </button>
    </div>
  );
}