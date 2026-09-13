// frontend/src/components/ai/AntigravitySidebar.jsx
import React, { useState } from 'react';

export default function AntigravitySidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  projectName = 'Neuron',
  isCollapsed = false,
  onToggleCollapse,
  onOpenSettings,
  isStreaming = false
}) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isConversationsExpanded, setIsConversationsExpanded] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);

  // Filter conversations
  const filteredConversations = conversations.filter(c => 
    !searchFilter || c.title?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Compute relative time string
  const formatTime = (isoString) => {
    if (!isoString) return 'now';
    if (isoString === 'now') return 'now';
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'now';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      return `${days}d`;
    } catch {
      return 'now';
    }
  };

  if (isCollapsed) {
    return (
      <div 
        className="w-10 h-full flex flex-col items-center py-3 border-r select-none shrink-0 transition-all duration-150"
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: 'var(--theme-border, #242628)',
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded border transition-colors hover:border-[var(--theme-accent)] mb-3"
          style={{
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-muted, #94a3b8)'
          }}
          title="Expand Sidebar"
        >
          <span className="text-xs font-mono font-bold">⊞</span>
        </button>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => !isStreaming && onCreateConversation?.()}
          className={`w-7 h-7 flex items-center justify-center rounded border transition-colors ${
            isStreaming ? 'opacity-40 cursor-not-allowed' : 'hover:border-[var(--theme-accent)] cursor-pointer'
          }`}
          style={{
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-primary, #cbd5e1)'
          }}
          title={isStreaming ? "Generation in progress..." : "New Conversation"}
        >
          <span className="text-sm font-mono leading-none">+</span>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full flex flex-col select-none transition-all duration-150"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        borderColor: 'var(--theme-border, #242628)',
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP ACTIONS                                                   */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="p-2.5 flex flex-col gap-1.5 border-b"
        style={{ borderColor: 'var(--theme-border, #242628)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 py-0.5">
            <span 
              className="text-[11px] font-mono font-medium tracking-wide uppercase"
              style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
            >
              Antigravity
            </span>
          </div>
        </div>

        {/* + New Conversation Button */}
        <button
          type="button"
          disabled={isStreaming}
          onClick={() => !isStreaming && onCreateConversation?.()}
          className={`w-full h-7 rounded border flex items-center justify-center gap-1.5 text-[11px] font-mono font-medium transition-all shadow-sm mt-1 ${
            isStreaming 
              ? 'opacity-40 cursor-not-allowed' 
              : 'hover:border-[var(--theme-accent)] cursor-pointer'
          }`}
          style={{
            backgroundColor: 'var(--theme-secondary, #191a1b)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-primary, #cbd5e1)',
          }}
          title={isStreaming ? "Cannot create new conversation while agent is generating" : "New Conversation"}
        >
          <span className="text-[13px] leading-none">+</span>
          <span>New Conversation</span>
        </button>

        {/* Action Pills */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="h-6 px-1.5 rounded border text-[10px] font-mono truncate transition-colors hover:border-[var(--theme-accent)] text-center"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-muted, #94a3b8)'
            }}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setIsTasksModalOpen(true)}
            className="h-6 px-1.5 rounded border text-[10px] font-mono truncate transition-colors hover:border-[var(--theme-accent)] text-center"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-muted, #94a3b8)'
            }}
          >
            Scheduled
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SESSIONS & PROJECTS TREE                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-3 font-mono text-[11px]">
        {/* PROJECTS SECTION */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
            className="flex items-center justify-between text-[10px] uppercase font-semibold px-1 py-0.5 tracking-wider transition-colors"
            style={{ color: 'var(--theme-text-muted, #64748b)' }}
          >
            <span>Project</span>
            <svg 
              className={`w-3.5 h-3.5 transition-transform duration-150 ${isProjectsExpanded ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.75" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {isProjectsExpanded && (
            <div className="flex flex-col gap-0.5 pl-1">
              <div 
                className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{
                  backgroundColor: 'var(--theme-surfaceActive, #282a2d)',
                  color: 'var(--theme-text-bright, #ffffff)'
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate font-medium">{projectName}</span>
              </div>
            </div>
          )}
        </div>

        {/* CONVERSATIONS SECTION */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setIsConversationsExpanded(!isConversationsExpanded)}
            className="flex items-center justify-between text-[10px] uppercase font-semibold px-1 py-0.5 tracking-wider transition-colors"
            style={{ color: 'var(--theme-text-muted, #64748b)' }}
          >
            <span>Conversations</span>
            <svg 
              className={`w-3.5 h-3.5 transition-transform duration-150 ${isConversationsExpanded ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.75" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {isConversationsExpanded && (
            <div className="flex flex-col gap-0.5">
              {filteredConversations.length === 0 ? (
                <div 
                  className="px-2 py-3 text-[10px] text-center italic opacity-60"
                  style={{ color: 'var(--theme-text-muted, #64748b)' }}
                >
                  No conversations yet
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  const isClickDisabled = isStreaming && !isActive;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (isClickDisabled) return;
                        onSelectConversation?.(conv.id);
                      }}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                        isClickDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title={isClickDisabled ? "Cannot switch conversations while generation is active" : (conv.title || 'Untitled Conversation')}
                      style={{
                        backgroundColor: isActive
                          ? 'var(--theme-surfaceActive, #282a2d)'
                          : 'transparent',
                        color: isActive
                          ? 'var(--theme-text-bright, #ffffff)'
                          : 'var(--theme-text-primary, #cbd5e1)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive && !isClickDisabled) e.currentTarget.style.backgroundColor = 'var(--theme-surfaceHover, #222426)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-2 truncate flex-1 pr-1">
                        {/* Blue Active Status Dot */}
                        <div 
                          className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                          style={{
                            backgroundColor: isActive ? 'var(--theme-accent, #3b82f6)' : 'transparent',
                            boxShadow: isActive ? '0 0 6px var(--theme-accent, #3b82f6)' : 'none'
                          }}
                        />
                        <span className="truncate text-[11px]">
                          {conv.title || 'Untitled Conversation'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span 
                          className="text-[9px] opacity-40 group-hover:hidden"
                          style={{ color: 'var(--theme-text-muted, #64748b)' }}
                        >
                          {formatTime(conv.updated_at)}
                        </span>
                        {/* Delete button visible on hover only when not streaming */}
                        {!isStreaming && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation?.(conv.id);
                            }}
                            className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-[10px] opacity-60 hover:opacity-100 hover:text-red-400 transition-opacity"
                            title="Delete thread"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FOOTER: SETTINGS LINK                                         */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="p-2 border-t flex items-center justify-between"
        style={{ borderColor: 'var(--theme-border, #242628)' }}
      >
        <button
          type="button"
          onClick={() => onOpenSettings?.('ai')}
          className="w-full py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 text-[11px] font-mono transition-colors hover:border-[var(--theme-accent)]"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-secondary, #94a3b8)'
          }}
        >
          <span className="text-xs">⚙</span>
          <span>Settings</span>
        </button>
      </div>

      {/* Conversation History Modal */}
      {isHistoryModalOpen && (
        <div 
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 select-none"
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div 
            className="w-80 max-h-96 rounded-xl border p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              <span className="text-[12px] font-semibold font-mono">Conversation History</span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-[11px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search conversations..."
              className="w-full text-[11px] font-mono rounded px-2.5 py-1 border outline-none focus:border-[var(--theme-accent)]"
              style={{
                backgroundColor: 'var(--theme-surface, #161719)',
                borderColor: 'var(--theme-border, #242628)',
                color: 'var(--theme-text-primary, #cbd5e1)'
              }}
            />
            <div className="flex-1 overflow-y-auto max-h-48 flex flex-col gap-1">
              {filteredConversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectConversation?.(c.id);
                    setIsHistoryModalOpen(false);
                  }}
                  className="px-2 py-1.5 rounded cursor-pointer text-[11px] font-mono hover:bg-[var(--theme-surfaceHover)] flex justify-between"
                >
                  <span className="truncate flex-1">{c.title}</span>
                  <span className="text-[9px] opacity-40 ml-2 shrink-0">{formatTime(c.updated_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Tasks Modal */}
      {isTasksModalOpen && (
        <div 
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 select-none"
          onClick={() => setIsTasksModalOpen(false)}
        >
          <div 
            className="w-80 rounded-xl border p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              <span className="text-[12px] font-semibold font-mono">Scheduled Tasks</span>
              <button
                type="button"
                onClick={() => setIsTasksModalOpen(false)}
                className="text-[11px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
            <div className="text-[11px] font-mono opacity-70 leading-relaxed">
              No recurring background tasks scheduled in this workspace. Use the <code className="text-[var(--theme-accent)]">/schedule</code> command to register automated cron jobs.
            </div>
            <button
              type="button"
              onClick={() => setIsTasksModalOpen(false)}
              className="w-full py-1 rounded text-[11px] font-mono font-medium"
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                color: '#ffffff'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
