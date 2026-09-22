// frontend/src/components/ai/AiChatView.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import ModelSelectorDropdown from './ModelSelectorDropdown';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true
});

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderCustomMarkdown(content) {
  if (!content) return '';
  try {
    const renderer = new marked.Renderer();
    renderer.code = function({ text, lang }) {
      const language = lang || 'code';
      const encoded = encodeURIComponent(text);
      return `<div class="code-block-wrapper my-2 rounded-lg border border-[var(--theme-border)] overflow-hidden bg-[var(--theme-background,#141516)]">
        <div class="flex items-center justify-between px-3 py-1 bg-[var(--theme-secondary,#191a1b)] border-b border-[var(--theme-border,#242628)] text-[10px] font-mono text-[var(--theme-text-muted,#94a3b8)] select-none">
          <span class="font-medium uppercase">${escapeHtml(language)}</span>
          <button type="button" class="copy-code-btn px-2 py-0.5 rounded text-[10px] hover:text-[var(--theme-text-bright)] transition-colors cursor-pointer" data-code="${encoded}">Copy</button>
        </div>
        <pre class="p-3 text-[11px] font-mono overflow-x-auto leading-tight"><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre>
      </div>`;
    };
    return marked(content, { renderer });
  } catch {
    return `<div class="whitespace-pre-wrap">${escapeHtml(content)}</div>`;
  }
}

function MarkdownView({ content }) {
  const containerRef = useRef(null);

  const handleClick = (e) => {
    const btn = e.target.closest('.copy-code-btn');
    if (!btn) return;
    const raw = btn.getAttribute('data-code');
    if (!raw) return;
    try {
      const decoded = decodeURIComponent(raw);
      navigator.clipboard.writeText(decoded);
      const prevText = btn.innerText;
      btn.innerText = '✓ Copied';
      btn.style.color = '#4ade80';
      setTimeout(() => {
        btn.innerText = prevText;
        btn.style.color = '';
      }, 2000);
    } catch {}
  };

  const html = useMemo(() => renderCustomMarkdown(content), [content]);

  return (
    <div 
      ref={containerRef}
      onClick={handleClick}
      className="ai-markdown-rendered text-[12px] leading-relaxed select-text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function AiChatView({
  conversation,
  activeModelId,
  onSelectModel,
  onSendMessage,
  onStopGeneration,
  onRollback,
  onApplyRefactor,
  isStreaming = false,
  streamingThought = "",
  streamingDelta = "",
  streamingSteps = [],
  activeFile = "",
  fileContent = "",
  projectName = "Neuron",
  onOpenSettings,
  pendingApproval = null,
  onApproveAction,
  onRejectAction
}) {
  const [inputValue, setInputValue] = useState("");
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [refactorStatuses, setRefactorStatuses] = useState({}); // { [msgId]: 'applied' | 'rejected' }
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = conversation?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingDelta, streamingThought, streamingSteps]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage?.(trimmed);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleThought = (idx) => {
    setExpandedThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleApplyClick = (refactor, msgKey) => {
    if (!refactor) return;
    setRefactorStatuses(prev => ({ ...prev, [msgKey]: 'applied' }));
    onApplyRefactor?.(refactor);
  };

  const handleRejectClick = (msgKey) => {
    setRefactorStatuses(prev => ({ ...prev, [msgKey]: 'rejected' }));
  };

  return (
    <div 
      className="flex-1 h-full flex flex-col min-w-0 select-none"
      style={{
        backgroundColor: 'var(--theme-background, #141516)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      <style>{`
        .ai-markdown-rendered p { margin-bottom: 0.5rem; }
        .ai-markdown-rendered p:last-child { margin-bottom: 0; }
        .ai-markdown-rendered h1, .ai-markdown-rendered h2, .ai-markdown-rendered h3, .ai-markdown-rendered h4 {
          font-weight: 600;
          color: var(--theme-text-bright, #ffffff);
          margin-top: 0.65rem;
          margin-bottom: 0.35rem;
        }
        .ai-markdown-rendered h1 { font-size: 1.15rem; }
        .ai-markdown-rendered h2 { font-size: 1.05rem; }
        .ai-markdown-rendered h3 { font-size: 0.95rem; }
        .ai-markdown-rendered ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .ai-markdown-rendered ol { list-style-type: decimal; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .ai-markdown-rendered li { margin-bottom: 0.2rem; }
        .ai-markdown-rendered code:not(pre code) {
          background: var(--theme-surfaceHover, #282a2d);
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-size: 11px;
          border: 1px solid var(--theme-border, #242628);
          color: var(--theme-accent, #38bdf8);
        }
        .ai-markdown-rendered blockquote {
          border-left: 2px solid var(--theme-accent, #3b82f6);
          padding-left: 0.65rem;
          opacity: 0.85;
          margin: 0.4rem 0;
          font-style: italic;
        }
      `}</style>

      {/* ------------------------------------------------------------- */}
      {/* CHAT HEADER: Model Selector, Conversation Title               */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-10 shrink-0 px-3 border-b flex items-center justify-between gap-2"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
        }}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="text-[12px] font-mono font-medium truncate max-w-[240px]">
            {conversation?.title || 'Antigravity Studio'}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <ModelSelectorDropdown 
            selectedModelId={activeModelId}
            onSelectModel={onSelectModel}
            projectName={projectName}
            disabled={isStreaming}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MESSAGES FEED                                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4 font-mono text-[12px]">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const msgKey = msg.id || `msg_${idx}`;
          const isThoughtOpen = expandedThoughts[msgKey] ?? false;
          const refactorStatus = refactorStatuses[msgKey] || (msg.refactor?.applied ? 'applied' : null);

          return (
            <div 
              key={msgKey}
              className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Role label & timestamp */}
              <div 
                className="flex items-center gap-2 text-[10px] px-1"
                style={{ color: 'var(--theme-text-muted, #64748b)' }}
              >
                <span>{isUser ? 'You' : 'Antigravity'}</span>
                {msg.timestamp && (
                  <span className="opacity-50">
                    {typeof msg.timestamp === 'string' && msg.timestamp.includes('T') 
                      ? msg.timestamp.split('T')[1]?.slice(0, 5) 
                      : ''}
                  </span>
                )}
              </div>

              {/* Message Content Bubble */}
              <div 
                className="max-w-[95%] rounded-xl p-3 border leading-relaxed select-text flex flex-col gap-2.5 transition-colors"
                style={{
                  backgroundColor: isUser 
                    ? 'var(--theme-surface-active, var(--theme-surfaceActive, #282a2d))' 
                    : 'var(--theme-surface, #161719)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
              >
                {/* 1. Agentic Action Steps Badges */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="flex flex-col gap-1 border-b pb-2 mb-0.5" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                    {msg.steps.map((stepItem, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold text-[10px] shrink-0">✓</span>
                        <span className="text-[var(--theme-text-secondary,#94a3b8)] opacity-90">
                          {stepItem.step}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Collapsible Thinking Process Accordion */}
                {msg.thoughts && (
                  <div 
                    className="rounded-lg border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--theme-background, #141516)',
                      borderColor: 'var(--theme-border, #242628)'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleThought(msgKey)}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider transition-colors hover:bg-[var(--theme-surfaceHover)] cursor-pointer"
                      style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px]">{isThoughtOpen ? '▼' : '▶'}</span>
                        <span>Thinking Process</span>
                      </div>
                      <span className="text-[9px] opacity-60">Thought trace</span>
                    </button>
                    {isThoughtOpen && (
                      <div 
                        className="px-3 py-2 text-[11px] leading-relaxed border-t opacity-80 whitespace-pre-wrap font-mono"
                        style={{
                          borderColor: 'var(--theme-border, #242628)',
                          color: 'var(--theme-text-secondary, #94a3b8)'
                        }}
                      >
                        {msg.thoughts}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Rendered Markdown Message Body */}
                {isUser ? (
                  <div className="whitespace-pre-wrap text-[12px] leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <MarkdownView content={msg.content} />
                )}

                {/* 4. Interactive Refactor Approval Card */}
                {msg.refactor && (
                  <div 
                    className="rounded-xl border p-3 flex flex-col gap-2 mt-1 shadow-sm"
                    style={{
                      backgroundColor: 'var(--theme-background, #141516)',
                      borderColor: refactorStatus === 'applied' 
                        ? 'rgba(34, 197, 94, 0.4)' 
                        : refactorStatus === 'rejected'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'var(--theme-accent, #3b82f6)'
                    }}
                  >
                    <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold">Proposed Code Refactor</span>
                        <span 
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono border"
                          style={{
                            backgroundColor: 'var(--theme-surface, #161719)',
                            borderColor: 'var(--theme-border, #242628)',
                            color: 'var(--theme-text-primary, #cbd5e1)'
                          }}
                        >
                          {msg.refactor.filePath}
                        </span>
                      </div>
                      {refactorStatus === 'applied' && (
                        <span className="text-[10px] font-mono text-emerald-400 font-medium">✓ Applied</span>
                      )}
                      {refactorStatus === 'rejected' && (
                        <span className="text-[10px] font-mono text-red-400 font-medium">✕ Rejected</span>
                      )}
                    </div>

                    {/* Code Preview snippet */}
                    <div 
                      className="max-h-40 overflow-y-auto p-2 rounded text-[11px] font-mono leading-tight whitespace-pre border"
                      style={{
                        backgroundColor: 'var(--theme-surface, #161719)',
                        borderColor: 'var(--theme-border, #242628)',
                        color: 'var(--theme-text-secondary, #94a3b8)'
                      }}
                    >
                      {msg.refactor.proposedCode}
                    </div>

                    {/* Action Approval Buttons */}
                    {!refactorStatus ? (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRejectClick(msgKey)}
                          className="px-2.5 py-1 rounded border text-[11px] font-mono transition-colors hover:bg-[var(--theme-surfaceHover)] cursor-pointer"
                          style={{
                            borderColor: 'var(--theme-border, #242628)',
                            color: 'var(--theme-text-muted, #94a3b8)'
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyClick(msg.refactor, msgKey)}
                          className="px-3 py-1 rounded text-[11px] font-mono font-medium transition-all shadow-sm flex items-center gap-1.5 hover:brightness-110 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--theme-accent, #3b82f6)',
                            color: '#ffffff'
                          }}
                        >
                          <span>Apply Changes</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div className="flex flex-col gap-1.5 items-start">
            <div 
              className="flex items-center gap-2 text-[10px] px-1"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
            >
              <span>Antigravity</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-pulse" />
            </div>

            <div 
              className="max-w-[95%] rounded-xl p-3 border leading-relaxed select-text flex flex-col gap-2.5 transition-colors"
              style={{
                backgroundColor: 'var(--theme-surface, #161719)',
                borderColor: 'var(--theme-border, #242628)',
                color: 'var(--theme-text-primary, #cbd5e1)'
              }}
            >
              {/* Live Action Steps */}
              {streamingSteps && streamingSteps.length > 0 && (
                <div className="flex flex-col gap-1 border-b pb-2 mb-1" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[10px] uppercase font-semibold text-[var(--theme-text-muted)] tracking-wider">
                      Agent Execution Steps
                    </span>
                    {isStreaming && (
                      <button
                        type="button"
                        onClick={() => onStopGeneration?.()}
                        className="px-2 py-0.5 rounded border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25 text-[10px] font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Stop execution mid-flight"
                      >
                        <span className="w-1.5 h-1.5 rounded-sm bg-rose-400" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                  {streamingSteps.map((stepItem, sIdx) => {
                    const isRunning = stepItem.status === 'running';
                    return (
                      <div key={sIdx} className="flex items-center gap-2 text-[11px] font-mono">
                        {isRunning ? (
                          <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-ping shrink-0" />
                        ) : (
                          <span className="text-emerald-400 font-bold text-[10px] shrink-0">✓</span>
                        )}
                        <span className={isRunning ? 'text-[var(--theme-text-bright,#ffffff)] font-medium' : 'text-[var(--theme-text-secondary,#94a3b8)] opacity-90'}>
                          {stepItem.step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Streaming Thought Drawer */}
              {streamingThought && (
                <div 
                  className="rounded-lg border p-2.5 text-[11px] leading-relaxed font-mono opacity-80"
                  style={{
                    backgroundColor: 'var(--theme-background, #141516)',
                    borderColor: 'var(--theme-border, #242628)',
                    color: 'var(--theme-text-secondary, #94a3b8)'
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-[var(--theme-accent)] mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] animate-ping" />
                    <span>Thinking...</span>
                  </div>
                  <div className="whitespace-pre-wrap">{streamingThought}</div>
                </div>
              )}

              {/* Streaming Content Tokens */}
              <div className="text-[12px] leading-relaxed">
                <MarkdownView content={streamingDelta} />
                <span className="inline-block w-1.5 h-3.5 bg-[var(--theme-accent,#3b82f6)] ml-0.5 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        {/* 4. Interactive Tool Execution Approval Card */}
        {pendingApproval && (
          <div 
            className="rounded-xl border p-3 flex flex-col gap-2 my-2 shadow-sm"
            style={{
              backgroundColor: 'var(--theme-surface, #161719)',
              borderColor: 'var(--theme-accent, #3b82f6)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-pulse" />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--theme-text-bright, #ffffff)' }}>
                  Action Approval Required
                </span>
                <span 
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono border uppercase"
                  style={{
                    backgroundColor: 'var(--theme-background, #141516)',
                    borderColor: 'var(--theme-border, #242628)',
                    color: 'var(--theme-accent, #38bdf8)'
                  }}
                >
                  {pendingApproval.tool}
                </span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: 'var(--theme-text-muted, #64748b)' }}>
                Manual Mode
              </span>
            </div>

            <div className="text-[11px] font-medium" style={{ color: 'var(--theme-text-secondary, #94a3b8)' }}>
              {pendingApproval.description}
            </div>

            {/* Action Details: Terminal command or File path */}
            {pendingApproval.args?.command && (
              <div 
                className="p-2 rounded font-mono text-[11px] border leading-relaxed whitespace-pre-wrap select-text break-all"
                style={{
                  backgroundColor: 'var(--theme-background, #141516)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-bright, #ffffff)'
                }}
              >
                <span className="text-[var(--theme-accent)] select-none">$ </span>
                {pendingApproval.args.command}
              </div>
            )}

            {pendingApproval.args?.file_path && (
              <div 
                className="p-2 rounded font-mono text-[11px] border flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--theme-background, #141516)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
              >
                <span className="truncate">{pendingApproval.args.file_path}</span>
                {pendingApproval.args?.content && (
                  <span className="text-[10px] text-[var(--theme-text-muted)] shrink-0 ml-2">
                    {pendingApproval.args.content.split('\n').length} lines
                  </span>
                )}
              </div>
            )}

            {/* Action Approval Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              <button
                type="button"
                onClick={() => onRejectAction?.(pendingApproval.actionId)}
                className="px-2.5 py-1 rounded border text-[11px] font-mono transition-colors hover:bg-[var(--theme-surfaceHover)] cursor-pointer"
                style={{
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-muted, #94a3b8)'
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => onApproveAction?.(pendingApproval.actionId)}
                className="px-3.5 py-1 rounded text-[11px] font-mono font-medium transition-all shadow-sm flex items-center gap-1.5 hover:brightness-110 cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-accent, #3b82f6)',
                  color: '#ffffff'
                }}
              >
                ✓ Approve & Run
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONTEXT BAR (Active File Context)                             */}
      {/* ------------------------------------------------------------- */}
      {activeFile && (
        <div 
          className="px-3 py-1 border-t flex items-center justify-between text-[10px] font-mono select-none"
          style={{
            backgroundColor: 'var(--theme-secondary, #191a1b)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-muted, #64748b)'
          }}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span>Context:</span>
            <span 
              className="px-1.5 py-0.2 rounded border truncate max-w-[240px]"
              style={{
                backgroundColor: 'var(--theme-surface, #161719)',
                borderColor: 'var(--theme-border, #242628)',
                color: 'var(--theme-text-primary, #cbd5e1)'
              }}
            >
              @{activeFile}
            </span>
          </div>
          <span className="opacity-60 shrink-0">Attached</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PROMPT INPUT BAR                                              */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="p-3 border-t flex flex-col gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
        }}
      >
        <div 
          className="rounded-xl border p-2 flex items-end gap-2 focus-within:border-[var(--theme-accent)] transition-colors"
          style={{
            backgroundColor: 'var(--theme-background, #141516)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Antigravity or request refactor (Enter to send)..."
            spellCheck={false}
            className="flex-1 text-[12px] font-mono outline-none resize-none bg-transparent leading-relaxed placeholder:text-slate-600 [&::-webkit-scrollbar]:w-1"
            style={{
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={() => onStopGeneration?.()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all shrink-0 flex items-center gap-1.5 bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer shadow-sm animate-pulse"
              title="Stop Generation (Emergency Break)"
            >
              <span className="w-2 h-2 rounded-sm bg-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all shrink-0 flex items-center justify-center disabled:opacity-30 hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor: inputValue.trim() 
                  ? 'var(--theme-accent, #3b82f6)' 
                  : 'var(--theme-surfaceHover, #222426)',
                color: inputValue.trim() 
                  ? '#ffffff' 
                  : 'var(--theme-text-muted, #94a3b8)'
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

