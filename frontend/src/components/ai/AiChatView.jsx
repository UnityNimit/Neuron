// frontend/src/components/ai/AiChatView.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowUp, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  FileCode, 
  FilePlus, 
  Terminal, 
  Search, 
  CheckCircle2, 
  RotateCcw 
} from 'lucide-react';
import { marked } from 'marked';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '1s';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function summarizeSteps(steps = []) {
  const filesExplored = new Set();
  const commandsRun = [];
  const filesModified = new Map();
  const items = [];

  const pushOrUpdateItem = (newItem) => {
    const existingIdx = items.findIndex(it => {
      if (newItem.type === 'command' && it.type === 'command' && newItem.command && it.command) {
        return it.command === newItem.command;
      }
      if ((newItem.type === 'edit' || newItem.type === 'create' || newItem.type === 'read') &&
          (it.type === 'edit' || it.type === 'create' || it.type === 'read' || it.type === 'general') &&
          newItem.file && (it.file === newItem.file || it.label.toLowerCase().includes(newItem.file.toLowerCase()))) {
        return true;
      }
      if (newItem.type === 'general' && it.type === 'general') {
        const c1 = newItem.label.toLowerCase();
        const c2 = it.label.toLowerCase();
        if (c1.startsWith('engaging autonomous agent') && c2.startsWith('engaging autonomous agent')) return true;
        if (c1.includes('workspace') && c2.includes('workspace')) return true;
        if (c1 === c2) return true;
      }
      return false;
    });

    if (existingIdx !== -1) {
      items[existingIdx] = { ...items[existingIdx], ...newItem };
    } else {
      items.push(newItem);
    }
  };

  for (const s of steps) {
    if (!s) continue;
    const stepText = typeof s === 'string' ? s : (s.step || '');
    if (!stepText) continue;
    const sObj = typeof s === 'object' ? s : {};
    const lower = stepText.toLowerCase();
    const tool = sObj.tool;
    const status = sObj.status || 'done';
    const added = sObj.added ?? 0;
    const removed = sObj.removed ?? 0;

    if (tool === 'tool_run_command' || lower.startsWith('running:') || lower.startsWith('ran ')) {
      const cmd = sObj.command || stepText.replace(/^(running:|ran\s*)/i, '').replace(/\.{3}$/, '').trim();
      if (cmd && !commandsRun.includes(cmd)) {
        commandsRun.push(cmd);
      }
      pushOrUpdateItem({
        type: 'command',
        label: status === 'running' ? `Running ${cmd}...` : `Ran ${cmd}`,
        status,
        command: cmd
      });
    } else if (tool === 'tool_replace_file_content' || lower.startsWith('modifying ') || lower.startsWith('edited ')) {
      const fName = sObj.file || stepText.replace(/^(modifying|edited)\s+/i, '').split(' ')[0].replace(/\.{3}$/, '').trim();
      if (fName) {
        const prev = filesModified.get(fName) || { added: 0, removed: 0, op: 'edit' };
        filesModified.set(fName, {
          added: added > 0 ? added : prev.added,
          removed: removed > 0 ? removed : prev.removed,
          op: 'edit'
        });
      }
      pushOrUpdateItem({
        type: 'edit',
        label: status === 'running' ? `Modifying ${fName}...` : `Edited ${fName}`,
        file: fName,
        added,
        removed,
        status
      });
    } else if (tool === 'tool_write_to_file' || lower.startsWith('creating ') || lower.startsWith('wrote ')) {
      const fName = sObj.file || stepText.replace(/^(creating|wrote)\s+/i, '').split(' ')[0].replace(/\.{3}$/, '').trim();
      if (fName) {
        const prev = filesModified.get(fName) || { added: 0, removed: 0, op: 'create' };
        filesModified.set(fName, {
          added: added > 0 ? added : prev.added,
          removed: removed > 0 ? removed : prev.removed,
          op: 'create'
        });
      }
      pushOrUpdateItem({
        type: 'create',
        label: status === 'running' ? `Creating ${fName}...` : `Created ${fName}`,
        file: fName,
        added,
        removed,
        status
      });
    } else if (tool === 'tool_view_file' || tool === 'tool_get_file_outline' || lower.startsWith('reading ') || lower.startsWith('inspected ') || lower.startsWith('outline of ')) {
      const fName = sObj.file || stepText.replace(/^(reading|inspected|outline of)\s+/i, '').split(' ')[0].replace(/\.{3}$/, '').trim();
      if (fName) filesExplored.add(fName);
      pushOrUpdateItem({
        type: 'read',
        label: status === 'running' ? `Reading ${fName}...` : `Read ${fName}`,
        file: fName,
        status
      });
    } else if (tool === 'tool_grep_search' || lower.startsWith('searching')) {
      pushOrUpdateItem({
        type: 'search',
        label: stepText.replace(/\.{3}$/, '').trim(),
        status
      });
    } else {
      pushOrUpdateItem({
        type: 'general',
        label: stepText.replace(/\.{3}$/, '').trim(),
        status
      });
    }
  }

  return {
    exploredCount: filesExplored.size,
    commandsCount: commandsRun.length,
    commandsRun,
    filesModified: Array.from(filesModified.entries()).map(([file, stats]) => ({ file, ...stats })),
    items
  };
}

function getApprovalPromptText(pendingApproval) {
  if (!pendingApproval) return '';
  const { tool, args = {}, description = '' } = pendingApproval;
  if (tool === 'tool_replace_file_content' || tool === 'tool_write_to_file') {
    const f = args.file_path || args.path || description.replace(/^(creating|modifying)\s+/i, '').trim();
    return `Wants to edit ${f || 'file'}`;
  }
  if (tool === 'tool_run_command') {
    const cmd = args.command || args.cmd || description.replace(/^running:\s*/i, '').trim();
    return `Wants to execute ${cmd || 'command'}`;
  }
  return `Wants to ${description || tool || 'perform action'}`;
}

function WorkedSummaryDrawer({
  steps = [],
  durationSeconds = null,
  isLive = false,
  defaultExpanded = false
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (isLive) {
      setIsExpanded(true);
    }
  }, [isLive, steps?.length]);

  const summary = useMemo(() => summarizeSteps(steps), [steps]);

  if (!steps || steps.length === 0) return null;

  const durationLabel = isLive 
    ? (durationSeconds ? `Working... (${durationSeconds}s)` : 'Working...') 
    : `Worked for ${formatDuration(durationSeconds)}`;

  return (
    <div 
      className="my-2 rounded-xl border overflow-hidden transition-all duration-150 select-text"
      style={{
        backgroundColor: 'var(--theme-surface, #151617)',
        borderColor: 'var(--theme-border, #242628)'
      }}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--theme-surface-hover,#1b1c1e)] transition-colors select-none group"
      >
        <div className="flex items-center gap-2 overflow-hidden mr-2 flex-wrap">
          {isLive ? (
            <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-pulse shrink-0" />
          ) : (
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
          )}

          <span className="text-[11px] font-mono font-semibold" style={{ color: 'var(--theme-text-bright, #ffffff)' }}>
            {durationLabel}
          </span>

          <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
            {summary.exploredCount > 0 && (
              <span 
                className="px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: 'var(--theme-background, #121314)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-secondary, #94a3b8)'
                }}
              >
                Explored {summary.exploredCount} {summary.exploredCount === 1 ? 'file' : 'files'}
              </span>
            )}

            {summary.commandsCount > 0 && (
              <span 
                className="px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: 'var(--theme-background, #121314)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-secondary, #94a3b8)'
                }}
              >
                Ran {summary.commandsCount} {summary.commandsCount === 1 ? 'command' : 'commands'}
              </span>
            )}

            {summary.filesModified.map((f, idx) => (
              <span 
                key={idx}
                className="px-1.5 py-0.5 rounded border flex items-center gap-1"
                style={{
                  backgroundColor: 'var(--theme-background, #121314)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
              >
                <span>{f.file}</span>
                {f.added > 0 && (
                  <span className="text-emerald-400 font-semibold">+{f.added}</span>
                )}
                {f.removed > 0 && (
                  <span className="text-rose-400 font-semibold">-{f.removed}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text-bright)] transition-colors shrink-0">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {isExpanded && (
        <div 
          className="px-3 py-2 border-t flex flex-col gap-1.5 text-[11px] font-mono leading-relaxed max-h-64 overflow-y-auto"
          style={{
            borderColor: 'var(--theme-border, #242628)',
            backgroundColor: 'var(--theme-background, #121314)'
          }}
        >
          {summary.items.map((item, idx) => {
            const isItemRunning = item.status === 'running';
            return (
              <div key={idx} className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                  {item.type === 'read' && <FileText size={12} className="text-sky-400 shrink-0" />}
                  {item.type === 'edit' && <FileCode size={12} className="text-emerald-400 shrink-0" />}
                  {item.type === 'create' && <FilePlus size={12} className="text-emerald-400 shrink-0" />}
                  {item.type === 'command' && <Terminal size={12} className="text-purple-400 shrink-0" />}
                  {item.type === 'search' && <Search size={12} className="text-amber-400 shrink-0" />}
                  {item.type === 'general' && <RotateCcw size={12} className="text-slate-400 shrink-0" />}

                  <span className={`truncate ${isItemRunning ? 'text-[var(--theme-text-bright)] font-medium' : 'text-[var(--theme-text-secondary,#94a3b8)]'}`}>
                    {item.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                  {isItemRunning ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] animate-ping" />
                  ) : (
                    <>
                      {item.added > 0 && <span className="text-emerald-400 font-semibold">+{item.added}</span>}
                      {item.removed > 0 && <span className="text-rose-400 font-semibold">-{item.removed}</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      btn.innerText = 'Copied';
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
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [refactorStatuses, setRefactorStatuses] = useState({}); // { [msgId]: 'applied' | 'rejected' }
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    let interval = null;
    if (isStreaming) {
      setLiveElapsedSeconds(1);
      interval = setInterval(() => {
        setLiveElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLiveElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  const activeRunningCommand = useMemo(() => {
    if (!isStreaming || !Array.isArray(streamingSteps)) return null;
    const runningStep = [...streamingSteps].reverse().find(
      s => s.status === 'running' && s.step && s.step.toLowerCase().startsWith('running:')
    );
    if (!runningStep) return null;
    return runningStep.step.replace(/\.{3}$/, '');
  }, [isStreaming, streamingSteps]);

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
      if (pendingApproval) {
        onApproveAction?.(pendingApproval.actionId);
        return;
      }
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
      className="flex-1 h-full flex flex-col min-w-0 select-none relative"
      style={{
        backgroundColor: 'var(--theme-background, #121314)',
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
      {/* MESSAGES FEED                                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-20 flex flex-col gap-4 font-mono text-[12px]">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const msgKey = msg.id || `msg_${idx}`;
          const isThoughtOpen = expandedThoughts[msgKey] ?? false;
          const refactorStatus = refactorStatuses[msgKey] || (msg.refactor?.applied ? 'applied' : null);

          return (
            <div 
              key={msgKey}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Message Content (Container ONLY for User messages; containerless for AI replies) */}
              <div 
                className={
                  isUser
                    ? "max-w-[90%] rounded-xl px-3.5 py-2.5 border leading-relaxed select-text flex flex-col gap-2 transition-colors"
                    : "w-full leading-relaxed select-text flex flex-col gap-2.5"
                }
                style={
                  isUser
                    ? {
                        backgroundColor: 'var(--theme-surface-active, var(--theme-surfaceActive, #282a2d))',
                        borderColor: 'var(--theme-border, #242628)',
                        color: 'var(--theme-text-primary, #cbd5e1)'
                      }
                    : {
                        color: 'var(--theme-text-primary, #cbd5e1)'
                      }
                }
              >
                {/* 1. Agentic Action Steps Drawer */}
                {msg.steps && msg.steps.length > 0 && (
                  <WorkedSummaryDrawer
                    steps={msg.steps}
                    durationSeconds={msg.durationSeconds}
                    defaultExpanded={false}
                  />
                )}

                {/* 2. Collapsible Thinking Process Accordion */}
                {msg.thoughts && (
                  <div 
                    className="rounded-lg border overflow-hidden"
                    style={{
                      backgroundColor: 'var(--theme-surface, #161719)',
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
                        <span className="text-[10px] font-mono text-emerald-400 font-medium">Applied</span>
                      )}
                      {refactorStatus === 'rejected' && (
                        <span className="text-[10px] font-mono text-red-400 font-medium">Rejected</span>
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

        {/* Live Streaming Assistant Message (Containerless) */}
        {isStreaming && (
          <div className="flex flex-col items-start">
            <div 
              className="w-full leading-relaxed select-text flex flex-col gap-2.5"
              style={{
                color: 'var(--theme-text-primary, #cbd5e1)'
              }}
            >
              {/* Live Action Steps Drawer */}
              {streamingSteps && streamingSteps.length > 0 && (
                <div className="w-full">
                  <div className="flex items-center justify-end pb-1">
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
                  <WorkedSummaryDrawer
                    steps={streamingSteps}
                    durationSeconds={liveElapsedSeconds}
                    isLive={true}
                    defaultExpanded={true}
                  />
                </div>
              )}

              {/* Streaming Thought Drawer */}
              {streamingThought && (
                <div 
                  className="rounded-lg border p-2.5 text-[11px] leading-relaxed font-mono opacity-80"
                  style={{
                    backgroundColor: 'var(--theme-surface, #161719)',
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
                <Check size={13} strokeWidth={2.5} />
                <span>Allow</span>
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PROMPT INPUT BAR (Dark Gradient Fade Behind Textbox)          */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 pointer-events-none z-20"
        style={{
          background: 'linear-gradient(to top, var(--theme-background, #121314) 55%, transparent 100%)'
        }}
      >
        {pendingApproval ? (
          <div 
            className="pointer-events-auto mb-2 px-3 py-1.5 rounded-lg border flex items-center justify-between text-[11px] font-mono shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150"
            style={{
              backgroundColor: 'var(--theme-surface, #18191b)',
              borderColor: 'var(--theme-accent, #3b82f6)'
            }}
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-pulse shrink-0" />
              <span className="text-[var(--theme-text-bright,#ffffff)] truncate font-medium">
                {getApprovalPromptText(pendingApproval)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRejectAction?.(pendingApproval.actionId)}
              className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 shrink-0 cursor-pointer shadow-sm active:scale-95"
              title="Reject action"
            >
              Reject
            </button>
          </div>
        ) : activeRunningCommand ? (
          <div 
            className="pointer-events-auto mb-2 px-3 py-1.5 rounded-lg border flex items-center justify-between text-[11px] font-mono shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150"
            style={{
              backgroundColor: 'var(--theme-surface, #18191b)',
              borderColor: 'var(--theme-border, #242628)'
            }}
          >
            <div className="flex items-center gap-2 overflow-hidden mr-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[var(--theme-text-secondary,#94a3b8)] shrink-0 font-medium">Running:</span>
              <span className="text-[var(--theme-text-bright,#ffffff)] truncate">
                {activeRunningCommand.replace(/^Running:\s*/i, '')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onStopGeneration?.()}
              className="px-2.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all bg-rose-600/90 hover:bg-rose-600 text-white shrink-0 cursor-pointer shadow-sm hover:brightness-110 active:scale-95"
              title="Terminate running command"
            >
              Terminate
            </button>
          </div>
        ) : null}
        <div 
          className="pointer-events-auto rounded-xl border px-3 py-2 flex items-center gap-2 focus-within:border-[var(--theme-accent)] transition-colors"
          style={{
            backgroundColor: 'var(--theme-background, #121314)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            placeholder={pendingApproval ? "Press Enter or click Allow to approve..." : ""}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="flex-1 text-[12px] font-mono outline-none resize-none bg-transparent leading-relaxed [&::-webkit-scrollbar]:w-1"
            style={{
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
          />

          {pendingApproval ? (
            <button
              type="button"
              onClick={() => onApproveAction?.(pendingApproval.actionId)}
              className="px-3 h-7 rounded-lg transition-all shrink-0 flex items-center gap-1.5 hover:brightness-110 cursor-pointer shadow-sm text-[11px] font-mono font-semibold text-white animate-in fade-in duration-150 active:scale-95"
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)'
              }}
              title="Allow and run action (Enter)"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Allow</span>
            </button>
          ) : isStreaming ? (
            <button
              type="button"
              onClick={() => onStopGeneration?.()}
              className="w-7 h-7 rounded-full transition-all shrink-0 flex items-center justify-center bg-rose-600/90 hover:bg-rose-600 text-white cursor-pointer shadow-sm animate-pulse"
              title="Stop Generation"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="w-7 h-7 rounded-full transition-all shrink-0 flex items-center justify-center disabled:opacity-40 hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                color: '#ffffff'
              }}
            >
              <ArrowUp size={14} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

