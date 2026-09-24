import React, { useState } from 'react';
import { Files, GitBranch, Sparkles, Settings, UserCircle, LogOut } from 'lucide-react';
import ThemeSelector from './ThemeSelector';

export default function ActivityBar({ 
  layout = {}, 
  setLayout, 
  activeSidebarView = 'explorer',
  setActiveSidebarView,
  gitChangeCount = 0,
  onOpenSettings, 
  session, 
  onLogin, 
  onLogout 
}) {
  const isSidebarOpen = Boolean(layout?.sidebar);
  const isExplorerActive = isSidebarOpen && activeSidebarView === 'explorer';
  const isGitActive = isSidebarOpen && activeSidebarView === 'git';
  const isAiActive = isSidebarOpen && activeSidebarView === 'ai';
  const [imgError, setImgError] = useState(false);

  const handleToggleExplorer = () => {
    if (!isSidebarOpen) {
      setLayout && setLayout(prev => ({ ...prev, sidebar: true }));
      setActiveSidebarView && setActiveSidebarView('explorer');
    } else if (activeSidebarView === 'explorer') {
      setLayout && setLayout(prev => ({ ...prev, sidebar: false }));
    } else {
      setActiveSidebarView && setActiveSidebarView('explorer');
    }
  };

  const handleToggleGit = () => {
    if (!isSidebarOpen) {
      setLayout && setLayout(prev => ({ ...prev, sidebar: true }));
      setActiveSidebarView && setActiveSidebarView('git');
    } else if (activeSidebarView === 'git') {
      setLayout && setLayout(prev => ({ ...prev, sidebar: false }));
    } else {
      setActiveSidebarView && setActiveSidebarView('git');
    }
  };

  const handleToggleAi = () => {
    if (!isSidebarOpen) {
      setLayout && setLayout(prev => ({ ...prev, sidebar: true }));
      setActiveSidebarView && setActiveSidebarView('ai');
    } else if (activeSidebarView === 'ai') {
      setLayout && setLayout(prev => ({ ...prev, sidebar: false }));
    } else {
      setActiveSidebarView && setActiveSidebarView('ai');
    }
  };

  const user = session?.user || (session?.email ? session : null);
  const metadata = user?.user_metadata || {};
  const pfp = metadata.avatar_url || metadata.picture || user?.avatar_url || user?.picture;
  const displayName = metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'Developer';
  const email = user?.email || '';
  const isLoggedIn = Boolean(user && (user.email || metadata.full_name));

  return (
    <div 
      className="w-12 h-full border-r flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        borderColor: 'var(--theme-border, #242628)'
      }}
    >
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Explorer Sidebar Toggle */}
        <button 
          onClick={handleToggleExplorer}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isExplorerActive 
              ? 'text-[var(--theme-text-bright)] bg-[var(--theme-surface-hover)]' 
              : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]'
          }`}
          title="Explorer (Ctrl+B)"
        >
          {isExplorerActive && (
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" 
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                boxShadow: '0 0 8px var(--theme-accent, #3b82f6)'
              }}
            />
          )}
          <Files size={20} strokeWidth={1.6} />
        </button>

        {/* Git Source Control */}
        <button 
          onClick={handleToggleGit}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isGitActive 
              ? 'text-[var(--theme-text-bright)] bg-[var(--theme-surface-hover)]' 
              : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]'
          }`}
          title="Source Control"
        >
          {isGitActive && (
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" 
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                boxShadow: '0 0 8px var(--theme-accent, #3b82f6)'
              }}
            />
          )}
          <GitBranch size={20} strokeWidth={1.6} />
          {gitChangeCount > 0 && (
            <span 
              className="absolute -top-0.5 -right-0.5 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-mono font-bold text-white flex items-center justify-center shadow"
              style={{ backgroundColor: 'var(--theme-accent, #2563eb)' }}
            >
              {gitChangeCount > 99 ? '99+' : gitChangeCount}
            </span>
          )}
        </button>

        {/* AI */}
        <button 
          onClick={handleToggleAi}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isAiActive 
              ? 'text-[var(--theme-text-bright)] bg-[var(--theme-surface-hover)]' 
              : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]'
          }`}
          title="AI (Ctrl+Shift+A)"
        >
          {isAiActive && (
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" 
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                boxShadow: '0 0 8px var(--theme-accent, #3b82f6)'
              }}
            />
          )}
          <Sparkles size={20} strokeWidth={1.6} />
        </button>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. BOTTOM UTILITY ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Dynamic Minimalist Theme Selector */}
        <ThemeSelector />

        {/* Settings */}
        <button 
          onClick={onOpenSettings} 
          className="p-2 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)] transition-colors cursor-pointer" 
          title="Preferences (Ctrl+,)"
        >
          <Settings size={20} strokeWidth={1.6} />
        </button>

        {/* User Account / PFP Profile Action */}
        {isLoggedIn ? (
          <button 
            onClick={onLogout} 
            className="w-8 h-8 rounded-full overflow-hidden transition-all cursor-pointer relative group flex items-center justify-center p-0 shrink-0" 
            title={`Signed in as ${displayName} (${email || 'Google'})\nClick to Sign Out`}
          >
            {pfp && !imgError ? (
              <img 
                src={pfp} 
                alt={displayName} 
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover rounded-full" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-mono font-bold text-[11px] flex items-center justify-center uppercase">
                {displayName.charAt(0) || 'U'}
              </div>
            )}
            {/* Hover overlay with sign-out indicator */}
            <div className="absolute inset-0 bg-red-950/85 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-red-300">
              <LogOut size={13} strokeWidth={2} />
            </div>
          </button>
        ) : (
          <button 
            onClick={onLogin} 
            className="p-2 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)] transition-all cursor-pointer relative group" 
            title="Sign In with Google"
          >
            <UserCircle size={20} strokeWidth={1.6} />
          </button>
        )}

      </div>

    </div>
  );
}