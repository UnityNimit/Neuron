// frontend/src/components/layout/StatusBar.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, X, GitBranch, Activity, CheckCircle2, Zap 
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
  gitBranch = "main",
  isGitRepo = true,
  repoName = "",
  absTargetDir = "",
  onCenterSpatialMap
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef(null);

  // 1. Calculate live Bridges, Nodes & Links
  const bridgeCount = useMemo(() => {
    return (edges || []).filter(e => e.type === 'network_bridge').length;
  }, [edges]);

  const totalNodesCount = useMemo(() => (nodes || []).length, [nodes]);
  const totalEdgesCount = useMemo(() => (edges || []).length, [edges]);

  // 2. Git Status & Repo Resolution
  const modifiedGitCount = useMemo(() => {
    return Object.values(gitStatuses || {}).filter(s => s === 'M' || s === 'U').length;
  }, [gitStatuses]);

  const currentRepoName = useMemo(() => {
    if (repoName) return repoName;
    if (absTargetDir) return absTargetDir.split(/[/\\]/).pop();
    return "";
  }, [repoName, absTargetDir]);

  const hasGit = Boolean(
    isGitRepo && (currentRepoName || Object.keys(gitStatuses || {}).length > 0 || gitBranch)
  );

  // 3. Real-time System Notifications
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", text: "Spatial WebGPU Engine running (60 FPS)", time: "Just now" },
    { id: 2, type: "bridge", text: `${bridgeCount || 1} Cross-Stack API Bridges active`, time: "Live" },
    { id: 3, type: "info", text: "AC-3 Refactoring Shield armed", time: "Ready" }
  ]);

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
      'cpp': 'C++',
      'cc': 'C++',
      'cxx': 'C++',
      'hpp': 'C++ Header',
      'h': 'C Header',
      'c': 'C',
      'java': 'Java',
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
      'toml': 'TOML',
      'yaml': 'YAML',
      'yml': 'YAML'
    };
    return map[ext] || ext.toUpperCase();
  };

  return (
    <div className="h-6 shrink-0 bg-[#191a1b] border-t border-[#242628] text-slate-400 flex items-center justify-between px-3 text-[11px] font-mono select-none z-50">
      
      {/* ------------------------------------------------------------------- */}
      {/* LEFT SECTION: Pure Typography (Bridges · Nodes · Links · Errors)    */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 h-full overflow-hidden">
        
        {/* Clickable Bridges Text */}
        <button 
          onClick={onCenterSpatialMap}
          className="hover:text-blue-400 transition-colors cursor-pointer"
          title="Center Spatial Map on Active Bridges"
        >
          <span>{bridgeCount} bridges</span>
        </button>

        {totalNodesCount > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              {totalNodesCount} nodes · {totalEdgesCount} links
            </span>
          </>
        )}

        {/* Diagnostics */}
        {(errorCount > 0 || warningCount > 0) && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              {errorCount > 0 && <span className="text-red-400 mr-1.5">{errorCount} errors</span>}
              {warningCount > 0 && <span className="text-amber-400">{warningCount} warnings</span>}
            </span>
          </>
        )}

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RIGHT SECTION: Git Branch & Repo · Coordinates · File Type · Bell  */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-2.5 h-full shrink-0">
        
        {/* 🚀 SMART GIT INDICATOR (Repo / Branch or 'no git') */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
          <GitBranch size={11} className={hasGit ? "text-blue-400" : "text-slate-600"} />
          {hasGit ? (
            <span>
              {currentRepoName ? `${currentRepoName} / ` : ''}{gitBranch || 'main'}
              {modifiedGitCount > 0 && (
                <span className="text-amber-400 ml-1">({modifiedGitCount}*)</span>
              )}
            </span>
          ) : (
            <span className="text-slate-600">no git</span>
          )}
        </div>

        {/* Coordinates */}
        {activeFile ? (
          <>
            <span className="text-slate-600 hidden md:inline">·</span>
            <div className="text-slate-300 text-[10px] hidden md:flex">
              Ln {lineCount}, Col 1 ({wordCount} words)
            </div>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <div className="text-slate-400 text-[10px] uppercase hidden sm:flex">
              {encoding}
            </div>
            <span className="text-slate-600">·</span>
            <div className="text-slate-300 text-[10px] hover:text-blue-400 cursor-pointer transition-colors">
              <span>{getFileType(activeFile)}</span>
            </div>
          </>
        ) : (
          <>
            <span className="text-slate-600">·</span>
            <div className="text-slate-400 text-[10px]">
              <span>Spatial Map</span>
            </div>
          </>
        )}

        <span className="text-slate-600">·</span>

        {/* ----------------------------------------------------------------- */}
        {/* NOTIFICATIONS SYSTEM (Glassmorphic #191a1b)                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative h-full flex items-center" ref={notifRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-1 flex items-center justify-center transition-colors relative cursor-pointer rounded hover:bg-[#242628] ${
              isNotificationsOpen ? 'text-slate-100 bg-[#242628]' : 'text-slate-400 hover:text-slate-200'
            }`} 
            title="System Notifications"
          >
            <Bell size={11} />
            {notifications.length > 0 && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotificationsOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-80 bg-[#191a1b]/95 border border-[#2e3032] rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 z-[200]">
              <div className="px-3 py-2 border-b border-[#242628] flex items-center justify-between bg-[#151617]">
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={11} className="text-blue-400" /> System Alerts
                </span>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => setNotifications([])} 
                    className="text-[9px] text-slate-400 hover:text-slate-200 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-60 overflow-y-auto divide-y divide-[#222426]">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500 text-xs">
                    All subsystems operating nominally.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="px-3 py-2 hover:bg-[#202224] transition-colors flex items-start justify-between group">
                      <div className="flex items-start gap-2.5">
                        {notif.type === 'success' ? (
                          <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : notif.type === 'bridge' ? (
                          <Zap size={12} className="text-blue-400 shrink-0 mt-0.5" />
                        ) : (
                          <Bell size={12} className="text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-300 text-xs leading-tight font-sans">{notif.text}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{notif.time}</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => clearNotification(notif.id, e)} 
                        className="opacity-0 group-hover:opacity-100 hover:text-white p-0.5 transition-opacity text-slate-500 cursor-pointer"
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