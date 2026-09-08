// src/components/layout/ActivityBar.jsx
import React, { useState } from 'react';
import { Files, GitBranch, Palette, Settings, UserCircle, LogOut } from 'lucide-react';

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

  const user = session?.user || (session?.email ? session : null);
  const metadata = user?.user_metadata || {};
  const pfp = metadata.avatar_url || metadata.picture || user?.avatar_url || user?.picture;
  const displayName = metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'Developer';
  const email = user?.email || '';
  const isLoggedIn = Boolean(user && (user.email || metadata.full_name));

  return (
    <div className="w-12 h-full bg-[#191a1b] border-r border-[#242628] flex flex-col items-center justify-between py-3 shrink-0 z-40 select-none">
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Explorer Sidebar Toggle */}
        <button 
          onClick={handleToggleExplorer}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isExplorerActive ? 'text-white bg-[#222426]/50' : 'text-slate-500 hover:text-slate-200 hover:bg-[#222426]'
          }`}
          title="Explorer (Ctrl+B)"
        >
          {isExplorerActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          )}
          <Files size={20} strokeWidth={1.6} />
        </button>

        {/* Git Source Control */}
        <button 
          onClick={handleToggleGit}
          className={`p-2 rounded-xl transition-all relative group cursor-pointer ${
            isGitActive ? 'text-white bg-[#222426]/50' : 'text-slate-500 hover:text-slate-200 hover:bg-[#222426]'
          }`}
          title="Source Control"
        >
          {isGitActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          )}
          <GitBranch size={20} strokeWidth={1.6} />
          {gitChangeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[15px] h-[15px] rounded-full bg-blue-600 text-[9px] font-mono font-bold text-white flex items-center justify-center shadow">
              {gitChangeCount > 99 ? '99+' : gitChangeCount}
            </span>
          )}
        </button>

      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. BOTTOM UTILITY ACTIONS                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 w-full items-center">
        
        {/* Color Palette Info */}
        <button 
          onClick={() => alert("Neuron Color System:\n• Primary (TopBar): #121212\n• Secondary (Bars): #191a1b\n• Background (Canvas & Editor): #121314")} 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-[#222426] transition-colors cursor-pointer" 
          title="Color Theme Matrix"
        >
          <Palette size={20} strokeWidth={1.6} />
        </button>

        {/* Settings */}
        <button 
          onClick={onOpenSettings} 
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-[#222426] transition-colors cursor-pointer" 
          title="Preferences (Ctrl+,)"
        >
          <Settings size={20} strokeWidth={1.6} />
        </button>

        {/* User Account / PFP Profile Action */}
        {isLoggedIn ? (
          <button 
            onClick={onLogout} 
            className="w-8 h-8 rounded-full overflow-hidden border border-blue-500/70 hover:border-red-500 transition-all cursor-pointer relative group flex items-center justify-center p-0 shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:shadow-[0_0_12px_rgba(239,68,68,0.4)] shrink-0" 
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
            className="p-2 rounded-xl text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer relative group" 
            title="Sign In with Google"
          >
            <UserCircle size={20} strokeWidth={1.6} />
          </button>
        )}

      </div>

    </div>
  );
}