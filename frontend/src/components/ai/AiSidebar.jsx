// frontend/src/components/ai/AiSidebar.jsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export default function AiSidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  isCollapsed = false,
  onToggleCollapse,
  isStreaming = false
}) {
  const [isConversationsExpanded, setIsConversationsExpanded] = useState(true);

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
          <Plus size={13} />
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
      {/* TOP HEADER & PLUS ICON                                        */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b"
        style={{ borderColor: 'var(--theme-border, #242628)' }}
      >
        <span 
          className="font-medium tracking-wide"
          style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
        >
          AI
        </span>

        <button
          type="button"
          disabled={isStreaming}
          onClick={() => !isStreaming && onCreateConversation?.()}
          className={`p-1 rounded-md transition-colors text-[var(--theme-text-muted)] ${
            isStreaming 
              ? 'opacity-40 cursor-not-allowed' 
              : 'hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] cursor-pointer'
          }`}
          title={isStreaming ? "Cannot create new conversation while agent is generating" : "New Conversation"}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONVERSATIONS LIST                                            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-2 font-mono text-[11px]">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setIsConversationsExpanded(!isConversationsExpanded)}
            className="flex items-center justify-between text-[10px] uppercase font-semibold px-1 py-0.5 tracking-wider transition-colors cursor-pointer"
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
              {conversations.length === 0 ? (
                <div 
                  className="px-2 py-3 text-[10px] text-center italic opacity-60"
                  style={{ color: 'var(--theme-text-muted, #64748b)' }}
                >
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => {
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
                        <div 
                          className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                          style={{
                            backgroundColor: isActive ? 'var(--theme-accent, #3b82f6)' : 'transparent'
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
                        {!isStreaming && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation?.(conv.id);
                            }}
                            className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-[10px] opacity-60 hover:opacity-100 transition-opacity"
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
    </div>
  );
}
