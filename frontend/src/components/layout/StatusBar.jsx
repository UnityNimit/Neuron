// frontend/src/components/layout/StatusBar.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, Bell, Code2, XCircle, CheckCircle2, X, 
  Zap, GitBranch, Network, Activity, Cpu, Sparkles 
} from 'lucide-react';

export default function StatusBar({ 
  activeFile = "", 
  errorCount = 0, 
  warningCount = 0, 
  lineCount = 0, 
  wordCount = 0,
  encoding = "UTF-8",
  nodes = [],
  edges = [],
  gitStatuses = {},
  isWsConnected = true,
  isCompiling = false,
  onCenterSpatialMap
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef(null);

  // Calculate live Cross-Stack Protocol Bridges & Graph Topology
  const bridgeCount = useMemo(() => {
    return (edges || []).filter(e => e.type === 'network_bridge').length;
  }, [edges]);

  const totalNodesCount = useMemo(() => (nodes || []).length, [nodes]);
  const totalEdgesCount = useMemo(() => (edges || []).length, [edges]);

  const modifiedGitCount = useMemo(() => {
    return Object.values(gitStatuses || {}).filter(s => s === 'M' || s === 'U').length;
  }, [gitStatuses]);

  // Real-time notification queue
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", text: "PixiJS 100K WebGPU Engine active (60 FPS)", time: "Just now" },
    { id: 2, type: "bridge", text: `${bridgeCount || 1} Cross-Stack API Bridges compiled`, time: "Live" },
    { id: 3, type: "info", text: "AC-3 Refactoring Shield armed", time: "Ready" }
  ]);

  // Update notification on bridge updates
  useEffect(() => {
    if (bridgeCount > 0) {
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== 2);
        return [
          ...filtered,
          { id: 2, type: "bridge", text: `${bridgeCount} Cross-Stack API Laser Conduits active`, time: "Live" }
        ];
      });
    }
  }, [bridgeCount]);

  // Click outside listener for notifications popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearNotification = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Smart File Type Resolver
  const getFileType = (filename) => {
    if (!filename) return "Spatial Map";
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'py': 'Python',
      'js': 'JavaScript',
      'jsx': 'JavaScript React',
      'ts': 'TypeScript',
      'tsx': 'TypeScript React',
      'json': 'JSON',
      'html': 'HTML',
      'css': 'CSS',
      'txt': 'Plain Text',
      'md': 'Markdown',
      'csv': 'CSV'
    };
    return map[ext] || ext.toUpperCase();
  };

  return (
    <div className="h-6 shrink-0 bg-[#0f0f0f] border-t border-[#262626] text-slate-400 flex items-center justify-between px-3 text-[11px] font-sans select-none z-50">
      
      {/* ------------------------------------------------------------------- */}
      {/* LEFT SECTION: System Status, WebSocket, API Bridges, Diagnostics     */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-3 h-full overflow-hidden">
        
        {/* Neuron Brand & Version */}
        <div className="flex items-center gap-1 px-1.5 h-full hover:bg-[#1f1f1f] hover:text-slate-200 cursor-pointer transition-colors">
          <span className="font-bold tracking-wider text-slate-200 font-mono text-[10px]">NEURON</span>
          <span className="bg-blue-500/20 text-blue-400 font-mono text-[9px] px-1 rounded border border-blue-500/30">v2.4</span>
        </div>

        {/* Live WebSocket Status Pulse */}
        <div className="flex items-center gap-1.5 px-1.5 h-full" title={isWsConnected ? "WebSocket Connected (0ms)" : "Reconnecting to Backend..."}>
          <span className="relative flex h-2 w-2">
            {isWsConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isWsConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </span>
          <span className={`text-[10px] font-mono ${isWsConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {isWsConnected ? 'ONLINE' : 'DISCONNECTED'}
          </span>
        </div>

        {/* 🚀 CROSS-STACK PROTOCOL BRIDGE HUD (Electric Cyan) */}
        <div 
          onClick={onCenterSpatialMap}
          className="flex items-center gap-1.5 px-2 h-full bg-cyan-950/40 hover:bg-cyan-900/60 border-x border-cyan-800/40 text-cyan-300 font-mono text-[10px] cursor-pointer transition-all shadow-[0_0_12px_rgba(6,182,212,0.15)]"
          title="Cross-Stack Frontend <--> Backend Laser Conduits Active"
        >
          <Zap size={11} className="text-cyan-400 animate-pulse fill-cyan-400/40" />
          <span className="font-bold">{bridgeCount}</span>
          <span className="text-[9px] uppercase tracking-wider text-cyan-400/80 hidden sm:inline">Bridges</span>
        </div>

        {/* Graph Celestial Density Metric */}
        {totalNodesCount > 0 && (
          <div className="hidden lg:flex items-center gap-1 px-1.5 text-[10px] font-mono text-slate-400">
            <Network size={11} className="text-purple-400" />
            <span>{totalNodesCount} Nodes</span>
            <span className="text-slate-600">·</span>
            <span>{totalEdgesCount} Links</span>
          </div>
        )}

        {/* Errors & Warnings */}
        <div className="flex items-center gap-2 h-full">
          <button className="flex items-center gap-1 px-1.5 h-full hover:bg-[#1f1f1f] hover:text-slate-200 transition-colors" title="Diagnostics">
            <XCircle size={12} className={errorCount > 0 ? "text-red-400" : "text-slate-500"} />
            <span>{errorCount}</span>
          </button>
          <button className="flex items-center gap-1 px-1.5 h-full hover:bg-[#1f1f1f] hover:text-slate-200 transition-colors" title="Warnings">
            <AlertTriangle size={12} className={warningCount > 0 ? "text-yellow-400" : "text-slate-500"} />
            <span>{warningCount}</span>
          </button>
        </div>

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RIGHT SECTION: Git Churn, File Metrics, Encoding, Notifications     */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 h-full shrink-0">
        
        {/* Git Branch & Churn Indicator */}
        <div className="flex items-center gap-1 px-2 h-full hover:bg-[#1f1f1f] hover:text-slate-200 text-[10px] font-mono text-slate-400 cursor-pointer">
          <GitBranch size={11} className="text-blue-400" />
          <span>main</span>
          {modifiedGitCount > 0 && (
            <span className="ml-1 bg-yellow-500/20 text-yellow-400 px-1 rounded text-[9px] border border-yellow-500/30">
              {modifiedGitCount}*
            </span>
          )}
        </div>

        {/* Active File Coordinates */}
        {activeFile ? (
          <>
            <div className="px-2 h-full flex items-center text-slate-300 font-mono text-[10px] hidden md:flex">
              Ln {lineCount}, Col 1 ({wordCount} words)
            </div>
            <div className="px-1.5 h-full flex items-center text-slate-400 font-mono text-[10px] uppercase hidden sm:flex">
              {encoding}
            </div>
            <div className="px-2 h-full flex items-center gap-1.5 text-slate-300 font-mono text-[10px] hover:bg-[#1f1f1f] cursor-pointer">
              <Code2 size={12} className="text-yellow-400" /> 
              <span>{getFileType(activeFile)}</span>
            </div>
          </>
        ) : (
          <div className="px-2 h-full flex items-center gap-1.5 text-blue-400 font-mono text-[10px]">
            <Sparkles size={11} />
            <span>WebGL Cosmos Active</span>
          </div>
        )}

        {/* Pyodide / WASM Engine Status */}
        <div className="px-2 h-full flex items-center gap-1 text-[10px] font-mono text-emerald-400 hidden xl:flex">
          <Cpu size={11} />
          <span>WASM Py3.11</span>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* NOTIFICATIONS HUD                                                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative h-full flex items-center" ref={notifRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`px-2 h-full flex items-center justify-center transition-colors relative ${isNotificationsOpen ? 'bg-[#262626] text-slate-200' : 'hover:bg-[#1f1f1f] hover:text-slate-200'}`} 
            title="System Notifications"
          >
            <Bell size={12} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotificationsOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-84 bg-[#141414]/95 border border-[#333] rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 z-[100]">
              <div className="px-3 py-2 border-b border-[#262626] flex items-center justify-between bg-[#1a1a1a]">
                <span className="text-[10px] font-bold text-slate-200 uppercase font-mono tracking-widest flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-400" /> Neural System Alerts
                </span>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => setNotifications([])} 
                    className="text-[9px] font-mono text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto divide-y divide-[#222]">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500 text-xs font-mono">
                    All neural subsystems operating at nominal capacity.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="px-3 py-2.5 hover:bg-[#1c1c1c] transition-colors flex items-start justify-between group">
                      <div className="flex items-start gap-2.5">
                        {notif.type === 'success' ? (
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : notif.type === 'bridge' ? (
                          <Zap size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                        ) : (
                          <Bell size={13} className="text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-300 text-xs leading-tight font-sans">{notif.text}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{notif.time}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => clearNotification(notif.id, e)} 
                        className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5 transition-opacity text-slate-500"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}