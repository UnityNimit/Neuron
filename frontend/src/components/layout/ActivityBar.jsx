import React, { useState } from 'react';
import { Files, GitBranch, Brain, Settings, User, LogOut } from 'lucide-react';
import ThemeSelector from './ThemeSelector';

export default function ActivityBar({ 
  layout = {}, 
  setLayout, 
  activeSidebarView = 'explorer',
  setActiveSidebarView,
  gitChangeCount = 0,
  isSettingsOpen = false,
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
      className="w-12 h-full border-r flex flex-col items-center justify-between py-2.5 shrink-0 z-40 select-none"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        borderColor: 'var(--theme-border, #242628)'
      }}
    >
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 w-full items-center">
        
        {/* Explorer Sidebar Toggle */}
        <button 
          onClick={handleToggleExplorer}
          className={`neuron-activity-btn ${
            isExplorerActive 
              ? 'neuron-activity-btn-active' 
              : 'neuron-activity-btn-inactive'
          }`}
          title="Explorer (Ctrl+B)"
        >
          <Files size={19} strokeWidth={isExplorerActive ? 2.2 : 1.65} className="neuron-activity-icon" />
        </button>

        {/* Git Source Control */}
        <button 
          onClick={handleToggleGit}
          className={`neuron-activity-btn ${
            isGitActive 
              ? 'neuron-activity-btn-active' 
              : 'neuron-activity-btn-inactive'
          }`}
          title="Source Control"
        >
          <GitBranch size={19} strokeWidth={isGitActive ? 2.2 : 1.65} className="neuron-activity-icon" />
          {gitChangeCount > 0 && (
            <span 
              className="absolute -top-0.5 -right-0.5 px-1 min-w-[15px] h-[15px] rounded-full text-[9px] font-mono font-semibold text-white flex items-center justify-center"
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                border: '1.5px solid var(--theme-secondary, #191a1b)'
              }}
            >
              {gitChangeCount > 99 ? '99+' : gitChangeCount}
            </span>
          )}
        </button>

        {/* Neuron Agent */}
        <button 
          onClick={handleToggleAi}
          className={`neuron-activity-btn ${
            isAiActive 
              ? 'neuron-activity-btn-active' 
              : 'neuron-activity-btn-inactive'
          }`}
          title="Agent (Ctrl+Shift+A)"
        >
          <Brain size={19} strokeWidth={isAiActive ? 2.2 : 1.65} className="neuron-activity-icon" />
        </button>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. BOTTOM UTILITY ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 w-full items-center">
        
        {/* Dynamic Minimalist Theme Selector */}
        <ThemeSelector />

        {/* Settings */}
        <button 
          onClick={onOpenSettings} 
          className={`neuron-activity-btn ${
            isSettingsOpen
              ? 'neuron-activity-btn-active'
              : 'neuron-activity-btn-inactive'
          }`}
          title="Preferences (Ctrl+,)"
        >
          <Settings size={19} strokeWidth={isSettingsOpen ? 2.2 : 1.65} className="neuron-activity-icon" />
        </button>

        {/* User Account / Profile Action */}
        {isLoggedIn ? (
          <button 
            onClick={onLogout} 
            className="neuron-activity-btn neuron-activity-btn-inactive group" 
            title={`Signed in as ${displayName} (${email || 'Google'})\nClick to Sign Out`}
          >
            {pfp && !imgError ? (
              <img 
                src={pfp} 
                alt={displayName} 
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-5 h-5 object-cover rounded-full neuron-activity-icon group-hover:opacity-0 transition-opacity duration-150" 
              />
            ) : (
              <span 
                className="w-5 h-5 rounded-full font-mono font-semibold text-[10px] flex items-center justify-center uppercase neuron-activity-icon group-hover:opacity-0 transition-opacity duration-150"
                style={{
                  backgroundColor: 'var(--theme-surface-active, #2a2c2e)',
                  color: 'var(--theme-accent, #3b82f6)'
                }}
              >
                {displayName.charAt(0) || 'U'}
              </span>
            )}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
              <LogOut size={18} strokeWidth={1.75} className="neuron-activity-icon" />
            </div>
          </button>
        ) : (
          <button 
            onClick={onLogin} 
            className="neuron-activity-btn neuron-activity-btn-inactive" 
            title="Sign In with Google"
          >
            <User size={19} strokeWidth={1.65} className="neuron-activity-icon" />
          </button>
        )}

      </div>

    </div>
  );
}
