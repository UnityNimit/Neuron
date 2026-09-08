// frontend/src/components/layout/StatusBar.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, X, GitBranch, CheckCircle2, Loader2 
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
  isDirty = false,
  isSaving = false,
  refactorEnabled = false,
  onToggleRefactor,
  blastProtectionEnabled = false,
  onToggleBlastProtection,
  onCenterSpatialMap,
  notifications = [],
  onClearNotifications,
  onDismissNotification,
  onMarkAllNotificationsRead
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
    return Object.values(gitStatuses || {}).filter(s => s === 'M' || s === 'U' || s === 'A' || s === 'D').length;
  }, [gitStatuses]);

  const currentRepoName = useMemo(() => {
    if (!isGitRepo) return "";
    if (repoName) return repoName;
    if (absTargetDir) return absTargetDir.split(/[/\\]/).pop();
    return "";
  }, [repoName, absTargetDir, isGitRepo]);

  const hasGit = Boolean(isGitRepo);

  // 3. Dynamic Relative Time & Unread Computations
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isNotificationsOpen) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [isNotificationsOpen]);

  const unreadCount = useMemo(() => {
    return (notifications || []).filter(n => !n.read).length;
  }, [notifications]);

  const hasUnreadError = useMemo(() => {
    return (notifications || []).some(n => !n.read && n.type === 'error');
  }, [notifications]);

  const hasUnreadWarning = useMemo(() => {
    return (notifications || []).some(n => !n.read && n.type === 'warning');
  }, [notifications]);

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
    <div 
      className="h-6 shrink-0 border-t flex items-center justify-between px-3 text-[11px] font-mono select-none z-50"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        borderColor: 'var(--theme-border, #242628)',
        color: 'var(--theme-text-secondary, #94a3b8)'
      }}
    >
      
      {/* ------------------------------------------------------------------- */}
      {/* LEFT SECTION: Pure Typography (Bridges · Nodes · Links · Errors)    */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 h-full overflow-hidden">
        
        {/* Clickable Bridges Text */}
        <button 
          onClick={onCenterSpatialMap}
          className="hover:text-[var(--theme-accent)] transition-colors cursor-pointer text-[var(--theme-text-secondary)]"
          title="Center Spatial Map on Active Bridges"
        >
          <span>{bridgeCount} bridges</span>
        </button>

        {totalNodesCount > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-[var(--theme-text-secondary)]">
              {totalNodesCount} nodes · {totalEdgesCount} links
            </span>
          </>
        )}

        {/* Diagnostics */}
        {(errorCount > 0 || warningCount > 0) && (
          <>
            <span className="opacity-40">·</span>
            <span className="text-[var(--theme-text-secondary)]">
              {errorCount > 0 && <span className="text-red-500 mr-1.5">{errorCount} errors</span>}
              {warningCount > 0 && <span className="text-amber-500">{warningCount} warnings</span>}
            </span>
          </>
        )}

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RIGHT SECTION: Git Branch & Repo · Coordinates · File Type · Bell  */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center gap-2.5 h-full shrink-0">
        
        {/* 🚀 SMART GIT INDICATOR (Repo / Branch or 'Not a git folder') */}
        <div className="flex items-center gap-1.5 text-[10px] transition-colors">
          <GitBranch size={11} className={hasGit ? "text-[var(--theme-accent)]" : "text-[var(--theme-text-muted)]"} />
          {hasGit ? (
            <span className="text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)] cursor-pointer">
              {currentRepoName ? `${currentRepoName} / ` : ''}{gitBranch || 'main'}
              {modifiedGitCount > 0 && (
                <span className="text-amber-500 ml-1">({modifiedGitCount}*)</span>
              )}
            </span>
          ) : (
            <span className="text-[var(--theme-text-muted)]">Not a git folder</span>
          )}
        </div>

        {/* Active File Save Status, AutoSave Toggle & Coordinates */}
        {activeFile ? (
          <>
            {/* Live Save Status Indicator */}
            <span className="opacity-40">·</span>
            <div className="flex items-center gap-1.5 text-[10px]">
              {isSaving ? (
                <span className="text-[var(--theme-accent)] flex items-center gap-1 font-mono">
                  <Loader2 size={10} className="animate-spin" /> Saving...
                </span>
              ) : isDirty ? (
                <span className="text-amber-500 font-semibold flex items-center gap-1 font-mono" title="Unsaved changes in active file (Ctrl+S to save)">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unsaved
                </span>
              ) : (
                <span className="text-[var(--theme-text-secondary)] flex items-center gap-1 font-mono" title="All changes saved to disk">
                  <CheckCircle2 size={10} className="text-emerald-500" /> Saved
                </span>
              )}
            </div>

            {/* Minimalist Refactor ON/OFF Toggle */}
            {onToggleRefactor && (
              <>
                <span className="opacity-40 hidden sm:inline">·</span>
                <button
                  onClick={onToggleRefactor}
                  className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors font-mono flex items-center gap-1 cursor-pointer"
                  title={`Spatial Code Refactoring is ${refactorEnabled ? 'Active' : 'Disabled'} (Click to toggle)`}
                >
                  <span>Refactor:</span>
                  <span className={refactorEnabled ? "text-[var(--theme-accent)] font-semibold" : "text-[var(--theme-text-muted)] font-semibold"}>
                    {refactorEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </>
            )}

            {/* Minimalist Blast Protection ON/OFF Toggle */}
            {onToggleBlastProtection && (
              <>
                <span className="opacity-40 hidden sm:inline">·</span>
                <button
                  onClick={onToggleBlastProtection}
                  className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors font-mono flex items-center gap-1 cursor-pointer"
                  title={`Blast Protection is ${blastProtectionEnabled ? 'Active (Guards code against rapid AI mutation bursts)' : 'Disabled'} (Click to toggle)`}
                >
                  <span className="hidden sm:inline">Blast Protection:</span>
                  <span className="sm:hidden">Blast:</span>
                  <span className={blastProtectionEnabled ? "text-[var(--theme-accent)] font-semibold" : "text-[var(--theme-text-muted)] font-semibold"}>
                    {blastProtectionEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </>
            )}

            <span className="opacity-40 hidden md:inline">·</span>
            <div className="text-[var(--theme-text-primary)] text-[10px] hidden md:flex">
              Ln {lineCount}, Col 1 ({wordCount} words)
            </div>
            <span className="opacity-40 hidden sm:inline">·</span>
            <div className="text-[var(--theme-text-muted)] text-[10px] uppercase hidden sm:flex">
              {encoding}
            </div>
            <span className="opacity-40">·</span>
            <div className="text-[var(--theme-text-primary)] text-[10px] hover:text-[var(--theme-accent)] cursor-pointer transition-colors">
              <span>{getFileType(activeFile)}</span>
            </div>
          </>
        ) : (
          <>
            {/* Minimalist Refactor ON/OFF Toggle for Spatial Map view */}
            {onToggleRefactor && (
              <>
                <span className="opacity-40 hidden sm:inline">·</span>
                <button
                  onClick={onToggleRefactor}
                  className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors font-mono flex items-center gap-1 cursor-pointer"
                  title={`Spatial Code Refactoring is ${refactorEnabled ? 'Active' : 'Disabled'} (Click to toggle)`}
                >
                  <span>Refactor:</span>
                  <span className={refactorEnabled ? "text-[var(--theme-accent)] font-semibold" : "text-[var(--theme-text-muted)] font-semibold"}>
                    {refactorEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </>
            )}

            {/* Minimalist Blast Protection ON/OFF Toggle for Spatial Map view */}
            {onToggleBlastProtection && (
              <>
                <span className="opacity-40 hidden sm:inline">·</span>
                <button
                  onClick={onToggleBlastProtection}
                  className="text-[10px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors font-mono flex items-center gap-1 cursor-pointer"
                  title={`Blast Protection is ${blastProtectionEnabled ? 'Active (Guards code against rapid AI mutation bursts)' : 'Disabled'} (Click to toggle)`}
                >
                  <span className="hidden sm:inline">Blast Protection:</span>
                  <span className="sm:hidden">Blast:</span>
                  <span className={blastProtectionEnabled ? "text-[var(--theme-accent)] font-semibold" : "text-[var(--theme-text-muted)] font-semibold"}>
                    {blastProtectionEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </>
            )}
            <span className="opacity-40">·</span>
            <div className="text-[var(--theme-text-muted)] text-[10px]">
              <span>Spatial Map</span>
            </div>
          </>
        )}

        <span className="opacity-40">·</span>

        {/* ----------------------------------------------------------------- */}
        {/* NOTIFICATIONS SYSTEM                                              */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative h-full flex items-center" ref={notifRef}>
          <button 
            onClick={() => {
              const nextState = !isNotificationsOpen;
              setIsNotificationsOpen(nextState);
              if (nextState && onMarkAllNotificationsRead) {
                onMarkAllNotificationsRead();
              }
            }}
            className={`p-1 flex items-center justify-center transition-colors relative cursor-pointer rounded hover:bg-[var(--theme-surface-hover)] ${
              isNotificationsOpen 
                ? 'text-[var(--theme-text-bright)] bg-[var(--theme-surface-active)]' 
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)]'
            }`} 
            title="System Alerts & Notifications"
          >
            <Bell size={12} />
            {unreadCount > 0 && (
              <span 
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: 'var(--theme-accent, #3b82f6)' }}
              />
            )}
          </button>

          {/* Notifications Popover Menu */}
          {isNotificationsOpen && (
            <div 
              className="absolute bottom-full right-0 mb-2 w-88 max-w-[92vw] rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 z-[200] border"
              style={{
                backgroundColor: 'var(--theme-surface, #191a1b)',
                borderColor: 'var(--theme-border-subtle, #2e3032)',
                color: 'var(--theme-text-primary, #cbd5e1)'
              }}
            >
              <div 
                className="px-3.5 py-2 border-b flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--theme-surface-active, #151617)',
                  borderColor: 'var(--theme-border, #242628)'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-[var(--theme-text-bright)] tracking-wide">
                    System Alerts
                  </span>
                  <span 
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded-full border text-[var(--theme-text-muted)]"
                    style={{
                      backgroundColor: 'var(--theme-surface-hover, #222426)',
                      borderColor: 'var(--theme-border, #242628)'
                    }}
                  >
                    {notifications.length}
                  </span>
                </div>
                {notifications.length > 0 && onClearNotifications && (
                  <button 
                    onClick={onClearNotifications} 
                    className="text-[10px] font-mono text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div 
                className="max-h-72 overflow-y-auto divide-y divide-[var(--theme-border)] [&::-webkit-scrollbar]:w-1"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 flex flex-col items-center justify-center gap-2 text-center text-[var(--theme-text-muted)] text-xs font-mono">
                    <span>No notifications</span>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="px-3.5 py-2.5 hover:bg-[var(--theme-surface-hover)] transition-colors flex items-start justify-between gap-2 group">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-mono font-semibold truncate ${
                            notif.type === 'error' ? 'text-red-400' : notif.type === 'warning' ? 'text-amber-400' : 'text-[var(--theme-text-bright)]'
                          }`}>
                            {notif.title || (notif.type === 'error' ? 'System Alert' : 'Notification')}
                          </span>
                          {notif.source && (
                            <span 
                              className="text-[8px] font-mono uppercase px-1 py-0.2 rounded border text-[var(--theme-text-muted)]"
                              style={{
                                backgroundColor: 'var(--theme-surface-active)',
                                borderColor: 'var(--theme-border)'
                              }}
                            >
                              {notif.source}
                            </span>
                          )}
                        </div>
                        <span className="text-[var(--theme-text-secondary)] text-[11px] leading-snug break-words font-sans">
                          {notif.message || notif.text}
                        </span>
                        <span className="text-[9px] text-[var(--theme-text-muted)] font-mono mt-0.5">
                          {notif.timestamp ? getRelativeTime(notif.timestamp) : (notif.time || 'Just now')}
                        </span>
                      </div>
                      {onDismissNotification && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismissNotification(notif.id);
                          }} 
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--theme-text-bright)] p-1 rounded hover:bg-[var(--theme-surface-active)] transition-all text-[var(--theme-text-muted)] cursor-pointer shrink-0 mt-0.5"
                          title="Dismiss Alert"
                        >
                          <X size={11} />
                        </button>
                      )}
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