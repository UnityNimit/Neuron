// frontend/src/components/layout/SourceControlPanel.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  GitBranch, Check, ChevronDown, ChevronRight, Plus, Minus, 
  RotateCcw, RotateCw, Cloud, FileCode2, Loader2, ArrowDown, ArrowUp, Target
} from 'lucide-react';

export default function SourceControlPanel({
  isGitRepo = true,
  gitBranch = "main",
  repoName = "",
  gitDetailedStatus = { staged: [], unstaged: [] },
  gitGraph = [],
  dirtyFiles = new Set(),
  onSwitchFile,
  onCommit,
  onPush,
  onStageFile,
  onUnstageFile,
  onDiscardFile,
  onStageAll,
  onDiscardAll,
  onRefresh
}) {
  const [commitMessage, setCommitMessage] = useState("");
  const [commitAction, setCommitAction] = useState("commit"); // "commit" | "commit_push" | "commit_amend"
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isChangesOpen, setIsChangesOpen] = useState(true);
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isGraphOpen, setIsGraphOpen] = useState(true);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen]);

  const stagedFiles = gitDetailedStatus?.staged || [];
  
  // Real-time 0ms merge: include any dirtyFiles currently in memory
  const unstagedFiles = useMemo(() => {
    const list = [...(gitDetailedStatus?.unstaged || [])];
    const stagedSet = new Set(stagedFiles.map(f => f.path));
    const unstagedSet = new Set(list.map(f => f.path));
    
    if (dirtyFiles && dirtyFiles.size > 0) {
      dirtyFiles.forEach(df => {
        if (!stagedSet.has(df) && !unstagedSet.has(df)) {
          const parts = df.split('/');
          const name = parts.pop();
          const dir = parts.join('/');
          list.unshift({
            path: df,
            name: name,
            dir: dir,
            status: 'M'
          });
        }
      });
    }
    return list;
  }, [gitDetailedStatus?.unstaged, stagedFiles, dirtyFiles]);

  const handleExecuteCommit = async (actionType = commitAction) => {
    if (isCommitting) return;
    if (!commitMessage.trim() && actionType !== 'commit_amend') return;
    
    setIsCommitting(true);
    setIsDropdownOpen(false);
    try {
      if (onCommit) {
        await onCommit(commitMessage.trim(), {
          push: actionType === 'commit_push',
          amend: actionType === 'commit_amend'
        });
      }
      setCommitMessage("");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecuteCommit(commitAction);
    }
  };

  const getFileIconColor = (filename) => {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['jsx', 'tsx'].includes(ext)) return 'text-cyan-400';
    if (['js', 'ts'].includes(ext)) return 'text-amber-400';
    if (['py'].includes(ext)) return 'text-blue-400';
    if (['cpp', 'c', 'h', 'hpp'].includes(ext)) return 'text-indigo-400';
    if (['json', 'toml', 'yaml', 'yml'].includes(ext)) return 'text-emerald-400';
    return 'text-slate-400';
  };

  const getStatusColor = (status) => {
    if (status === 'M') return 'text-amber-400';
    if (status === 'U' || status === 'A') return 'text-emerald-400';
    if (status === 'D') return 'text-red-400';
    return 'text-slate-400';
  };

  const actionLabels = {
    commit: "Commit",
    commit_push: "Commit & Push",
    commit_amend: "Commit (Amend)"
  };

  if (!isGitRepo) {
    return (
      <div className="w-full h-full bg-[#191a1b] text-slate-300 flex flex-col select-none overflow-hidden font-mono text-[11px]">
        {/* TOP HEADER MATCHING EXPLORER */}
        <div className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide text-slate-300 flex items-center justify-between shrink-0 border-b border-[#242628]">
          <span className="text-slate-300 font-medium tracking-wide">Source Control</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <GitBranch size={32} className="text-slate-600 mb-3" />
          <div className="text-xs font-semibold text-slate-300 mb-1">No Git Repository Found</div>
          <div className="text-[11px] text-slate-500 leading-relaxed max-w-xs">
            The folder currently open is not a Git repository.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#191a1b] text-slate-300 flex flex-col select-none overflow-hidden font-mono text-[11px]">
      
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP HEADER (Identical to Explorer Header)                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide text-slate-300 flex items-center justify-between shrink-0 border-b border-[#242628]">
        <span className="text-slate-300 font-medium tracking-wide">Source Control</span>
        <div className="flex items-center gap-0.5">
          <button 
            onClick={onRefresh}
            className="p-1 hover:bg-[#242628] hover:text-white rounded-md transition-colors text-slate-400 cursor-pointer"
            title="Refresh"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. COMMIT SECTION (No sparkles, Working Split Button Dropdown)    */}
      {/* ----------------------------------------------------------------- */}
      <div className="px-3 py-2.5 border-b border-[#242628] flex flex-col gap-2 shrink-0 bg-[#191a1b]">
        
        {/* Commit Input Field */}
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message (Ctrl+Enter to commit on "${gitBranch || 'main'}")`}
          rows={2}
          className="w-full bg-[#121314] text-slate-200 text-[11px] font-mono rounded border border-[#2e3135] focus:border-blue-500 focus:outline-none p-2 resize-none placeholder-slate-500 transition-colors shadow-inner"
        />

        {/* Primary Commit Split Button with Working Dropdown */}
        <div className="relative flex items-stretch rounded overflow-visible shadow-sm" ref={dropdownRef}>
          <button
            onClick={() => handleExecuteCommit(commitAction)}
            disabled={isCommitting || (!commitMessage.trim() && commitAction !== 'commit_amend')}
            className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-1 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[11px] rounded-l disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCommitting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Working...</span>
              </>
            ) : (
              <>
                <Check size={12} strokeWidth={2.5} />
                <span>{actionLabels[commitAction]}</span>
              </>
            )}
          </button>
          <div className="w-[1px] bg-blue-700" />
          <button
            onClick={() => setIsDropdownOpen(prev => !prev)}
            disabled={isCommitting}
            className="bg-blue-600 hover:bg-blue-500 px-2 flex items-center justify-center text-white transition-colors cursor-pointer rounded-r disabled:opacity-50"
            title="More Commit Options"
          >
            <ChevronDown size={12} />
          </button>

          {/* Working Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1e20] border border-[#2e3135] rounded shadow-2xl py-1 z-50 flex flex-col text-[11px] font-mono animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setCommitAction('commit');
                  handleExecuteCommit('commit');
                }}
                className={`px-3 py-1.5 text-left hover:bg-[#282a2d] transition-colors flex items-center justify-between cursor-pointer ${
                  commitAction === 'commit' ? 'text-blue-400 font-semibold' : 'text-slate-300'
                }`}
              >
                <span>Commit</span>
                <span className="text-[10px] text-slate-500">Ctrl+Enter</span>
              </button>
              <button
                onClick={() => {
                  setCommitAction('commit_push');
                  handleExecuteCommit('commit_push');
                }}
                className={`px-3 py-1.5 text-left hover:bg-[#282a2d] transition-colors flex items-center justify-between cursor-pointer ${
                  commitAction === 'commit_push' ? 'text-blue-400 font-semibold' : 'text-slate-300'
                }`}
              >
                <span>Commit & Push</span>
              </button>
              <button
                onClick={() => {
                  setCommitAction('commit_amend');
                  handleExecuteCommit('commit_amend');
                }}
                className={`px-3 py-1.5 text-left hover:bg-[#282a2d] transition-colors flex items-center justify-between cursor-pointer ${
                  commitAction === 'commit_amend' ? 'text-blue-400 font-semibold' : 'text-slate-300'
                }`}
              >
                <span>Commit (Amend)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. SCROLLABLE ACCORDION: STAGED, CHANGES & GRAPH                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-[#242628]/50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-[#191a1b] [&::-webkit-scrollbar-thumb]:bg-[#2a2c2e] [&::-webkit-scrollbar-thumb:hover]:bg-[#3b82f6]">

        {/* --- STAGED CHANGES SECTION (If Any Staged) --- */}
        {stagedFiles.length > 0 && (
          <div className="flex flex-col">
            <div 
              onClick={() => setIsStagedOpen(prev => !prev)}
              className="px-2.5 py-1 text-[11px] font-mono font-bold text-slate-200 tracking-wider flex items-center justify-between shrink-0 hover:bg-[#222426] cursor-pointer transition-colors select-none group"
            >
              <div className="flex items-center gap-1 min-w-0">
                {isStagedOpen ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                <span className="truncate font-bold">STAGED CHANGES</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onUnstageFile && onUnstageFile("all"); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#2a2c2e] hover:text-white rounded transition-all text-slate-400"
                  title="Unstage All Changes"
                >
                  <Minus size={12} />
                </button>
                <span className="px-1.5 py-0.2 rounded-full bg-[#242628] text-slate-300 text-[10px] font-mono font-bold">
                  {stagedFiles.length}
                </span>
              </div>
            </div>

            {isStagedOpen && (
              <div className="flex flex-col">
                {stagedFiles.map(file => (
                  <div 
                    key={file.path}
                    onClick={() => onSwitchFile && onSwitchFile(file.path)}
                    className="flex items-center justify-between px-3 py-1 hover:bg-[#202224] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-2">
                      <FileCode2 size={13} className={`${getFileIconColor(file.name)} shrink-0`} />
                      <span className="text-slate-200 font-mono text-[11px] truncate">{file.name}</span>
                      {file.dir && (
                        <span className="text-slate-500 text-[10px] font-mono truncate ml-1 shrink-0">{file.dir}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onUnstageFile && onUnstageFile(file.path); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity text-slate-400"
                        title="Unstage Changes"
                      >
                        <Minus size={12} />
                      </button>
                      <span className={`text-[10px] font-mono font-bold ${getStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- UNSTAGED CHANGES SECTION --- */}
        <div className="flex flex-col">
          <div 
            onClick={() => setIsChangesOpen(prev => !prev)}
            className="px-2.5 py-1 text-[11px] font-mono font-bold text-slate-200 tracking-wider flex items-center justify-between shrink-0 hover:bg-[#222426] cursor-pointer transition-colors select-none group"
          >
            <div className="flex items-center gap-1 min-w-0">
              {isChangesOpen ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
              <span className="truncate font-bold">CHANGES</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onDiscardAll && onDiscardAll(); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#2a2c2e] hover:text-white rounded transition-all text-slate-400"
                title="Discard All Changes"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onStageAll && onStageAll(); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#2a2c2e] hover:text-white rounded transition-all text-slate-400"
                title="Stage All Changes"
              >
                <Plus size={13} />
              </button>
              <span className="px-1.5 py-0.2 rounded-full bg-[#242628] text-slate-300 text-[10px] font-mono font-bold">
                {unstagedFiles.length}
              </span>
            </div>
          </div>

          {isChangesOpen && (
            <div className="flex flex-col">
              {unstagedFiles.length === 0 ? (
                <div className="px-4 py-2 text-slate-500 text-[10px] italic">
                  No changes detected
                </div>
              ) : (
                unstagedFiles.map(file => (
                  <div 
                    key={file.path}
                    onClick={() => onSwitchFile && onSwitchFile(file.path)}
                    className="flex items-center justify-between px-3 py-1 hover:bg-[#202224] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden flex-1 mr-2">
                      <FileCode2 size={13} className={`${getFileIconColor(file.name)} shrink-0`} />
                      <span className="text-slate-200 font-mono text-[11px] truncate">{file.name}</span>
                      {file.dir && (
                        <span className="text-slate-500 text-[10px] font-mono truncate ml-1 shrink-0">{file.dir}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDiscardFile && onDiscardFile(file.path); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity text-slate-400"
                        title="Discard Changes"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onStageFile && onStageFile(file.path); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity text-slate-400"
                        title="Stage Changes"
                      >
                        <Plus size={13} />
                      </button>
                      <span className={`text-[10px] font-mono font-bold ${getStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* --- 🚀 GIT COMMIT GRAPH SECTION (Exact VS Code Layout) --- */}
        <div className="flex flex-col">
          <div 
            onClick={() => setIsGraphOpen(prev => !prev)}
            className="px-2.5 py-1 text-[11px] font-mono font-bold text-slate-200 tracking-wider flex items-center justify-between shrink-0 hover:bg-[#222426] cursor-pointer transition-colors select-none group"
          >
            <div className="flex items-center gap-1 min-w-0">
              {isGraphOpen ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
              <span className="truncate font-bold">COMMIT GRAPH</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="flex items-center gap-0.5 text-[10px] hover:text-white">
                <GitBranch size={11} /> Auto
              </span>
              <Target size={12} className="hover:text-white" />
              <ArrowDown size={12} className="hover:text-white" />
              <ArrowUp size={12} className="hover:text-white" />
              <button 
                onClick={(e) => { e.stopPropagation(); onRefresh && onRefresh(); }}
                className="hover:text-white"
                title="Refresh Graph"
              >
                <RotateCw size={12} />
              </button>
            </div>
          </div>

          {isGraphOpen && (
            <div className="flex flex-col overflow-x-auto [&::-webkit-scrollbar]:hidden py-1 font-mono text-[11px]">
              {gitGraph.length === 0 ? (
                <div className="px-4 py-3 text-slate-500 text-[10px] italic">
                  No commit history available
                </div>
              ) : (
                gitGraph.map((row, idx) => {
                  if (row.type === 'connector') {
                    const isFork = row.graph_chars?.includes('\\');
                    const isJoin = row.graph_chars?.includes('/');
                    return (
                      <div key={`conn_${idx}`} className="h-5 flex items-center px-2">
                        <svg width="34" height="20" className="shrink-0 overflow-visible">
                          {/* Rail Line 0 (Cyan Spine) */}
                          <line x1="12" y1="0" x2="12" y2="20" stroke="#38bdf8" strokeWidth="2" />
                          {/* Fork branch to Yellow Rail */}
                          {isFork && (
                            <path d="M 12 2 C 12 10 24 10 24 18" fill="none" stroke="#f59e0b" strokeWidth="2" />
                          )}
                          {/* Merge branch from Yellow Rail back to Spine */}
                          {isJoin && (
                            <path d="M 24 2 C 24 10 12 10 12 18" fill="none" stroke="#f59e0b" strokeWidth="2" />
                          )}
                        </svg>
                      </div>
                    );
                  }

                  const isLane0 = row.lane === 0;
                  const dotX = isLane0 ? 12 : 24;
                  const dotColor = isLane0 ? '#38bdf8' : '#f59e0b';

                  return (
                    <div 
                      key={row.hash || `row_${idx}`}
                      className="h-6 flex items-center hover:bg-[#202224] px-2 cursor-pointer transition-colors group select-none whitespace-nowrap overflow-hidden"
                      title={`${row.hash} • ${row.author} • ${row.relative_date}\n${row.message}`}
                    >
                      {/* SVG Branch Graph Rail */}
                      <svg width="34" height="24" className="shrink-0 overflow-visible">
                        {/* Main Spine Rail */}
                        <line x1="12" y1="0" x2="12" y2="24" stroke="#38bdf8" strokeWidth="2" />
                        
                        {/* Secondary Branch Rail (if on Lane 1 or branch exists) */}
                        {!isLane0 && (
                          <line x1="24" y1="0" x2="24" y2="24" stroke="#f59e0b" strokeWidth="2" />
                        )}

                        {/* Active HEAD: Double-Circle Ring */}
                        {row.is_head ? (
                          <>
                            <circle cx={dotX} cy="12" r="5.5" fill="#191a1b" stroke="#38bdf8" strokeWidth="2" />
                            <circle cx={dotX} cy="12" r="2.5" fill="#38bdf8" />
                          </>
                        ) : (
                          /* Normal Commit Dot */
                          <circle cx={dotX} cy="12" r="3.5" fill={dotColor} />
                        )}
                      </svg>

                      {/* Commit Details */}
                      <div className="flex items-center gap-1.5 overflow-hidden flex-1 pl-1">
                        {/* If HEAD commit: show Date, Author, and Branch badge */}
                        {row.is_head ? (
                          <>
                            <span className="font-semibold text-slate-200 shrink-0">{row.date}</span>
                            <span className="text-slate-400 shrink-0">{row.author}</span>
                            <span className="px-1.5 py-0.2 rounded-full border border-cyan-500/60 bg-cyan-950/40 text-cyan-300 text-[10px] flex items-center gap-1 font-mono shrink-0">
                              <GitBranch size={10} /> {row.branch_names?.[0] || 'main'}
                            </span>
                            {row.has_cloud && (
                              <Cloud size={12} className="text-purple-400 shrink-0 ml-0.5" />
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-slate-300 truncate group-hover:text-white transition-colors">
                              {row.message}
                            </span>
                            <span className="text-slate-500 text-[10px] shrink-0 ml-auto pr-2">
                              {row.author}
                            </span>
                          </>
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
