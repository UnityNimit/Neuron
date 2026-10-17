// frontend/src/components/layout/BottomConsolePanel.jsx
import React, { useState, useEffect, memo } from 'react';
import { Trash2 } from 'lucide-react';
import TerminalPanel from './TerminalPanel';
import StdinPanel from './StdinPanel';

function BottomConsolePanel({
  activeTab = 'output',
  onSelectTab,
  workspace,
  stdin,
  setStdin
}) {
  const [internalTab, setInternalTab] = useState(activeTab || 'output');

  useEffect(() => {
    if (activeTab && activeTab !== internalTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab, internalTab]);

  const currentTab = onSelectTab ? activeTab : internalTab;

  const handleTabClick = (tabId) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else {
      setInternalTab(tabId);
    }
  };

  const activeTerminalSession = (workspace.terminalSessions || []).find(s => s.id === workspace.activeSessionId) || (workspace.terminalSessions || [])[0];
  const interactiveSessionId = (workspace.activeSessionId && workspace.activeSessionId !== 'output') 
    ? workspace.activeSessionId 
    : (activeTerminalSession?.id && activeTerminalSession.id !== 'output' ? activeTerminalSession.id : ((workspace.terminalSessions || [])[0]?.id || 'output'));

  return (
    <div 
      className="w-full h-full flex flex-col select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* Top Bar: Output   Terminal   Input (Explorer Normal Texts)   */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b select-none"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)'
        }}
      >
        <div className="flex items-center gap-4">
          {/* Output */}
          <button
            type="button"
            onClick={() => handleTabClick('output')}
            className={`font-medium tracking-wide transition-colors cursor-pointer select-none outline-none ${
              currentTab === 'output'
                ? 'text-[var(--theme-text-bright,#f8fafc)]'
                : 'text-[var(--theme-text-muted,#64748b)] hover:text-[var(--theme-text-primary,#cbd5e1)]'
            }`}
          >
            Output
          </button>

          {/* Terminal */}
          <button
            type="button"
            onClick={() => handleTabClick('terminal')}
            className={`font-medium tracking-wide transition-colors cursor-pointer select-none outline-none ${
              currentTab === 'terminal'
                ? 'text-[var(--theme-text-bright,#f8fafc)]'
                : 'text-[var(--theme-text-muted,#64748b)] hover:text-[var(--theme-text-primary,#cbd5e1)]'
            }`}
          >
            Terminal
          </button>

          {/* Input */}
          <button
            type="button"
            onClick={() => handleTabClick('stdin')}
            className={`font-medium tracking-wide transition-colors cursor-pointer select-none outline-none ${
              currentTab === 'stdin'
                ? 'text-[var(--theme-text-bright,#f8fafc)]'
                : 'text-[var(--theme-text-muted,#64748b)] hover:text-[var(--theme-text-primary,#cbd5e1)]'
            }`}
          >
            Input
          </button>
        </div>

        <div className="flex items-center gap-1">
          {currentTab === 'output' && (
            <button
              type="button"
              onClick={() => workspace?.clearTerminalSession && workspace.clearTerminalSession('output')}
              className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded transition-colors text-[var(--theme-text-muted)] cursor-pointer"
              title="Clear Output"
            >
              <Trash2 size={12} />
            </button>
          )}
          {currentTab === 'terminal' && (
            <button
              type="button"
              onClick={() => workspace?.clearTerminalSession && workspace.clearTerminalSession(interactiveSessionId)}
              className="p-1 hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] rounded transition-colors text-[var(--theme-text-muted)] cursor-pointer"
              title="Clear Terminal"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Panel Contents                                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden relative">
        {/* Output Panel View */}
        <div className={`w-full h-full ${currentTab === 'output' ? 'block' : 'hidden'}`}>
          <TerminalPanel 
            logs={workspace.terminalLogs}
            sessions={workspace.terminalSessions || []}
            activeSessionId="output"
            absTargetDir={workspace.absTargetDir}
            isOutputRunning={workspace.isOutputRunning}
            onSelectSession={workspace.setActiveSessionId}
            onCreateSession={workspace.createTerminalSession}
            onCloseSession={workspace.closeTerminalSession}
            onSendTerminalCommand={workspace.sendTerminalCommand}
            onSendStdin={workspace.sendTerminalStdin}
            onKillProcess={workspace.killTerminalProcess}
            onClearOutput={() => workspace.clearTerminalSession && workspace.clearTerminalSession('output')}
            hideTabStrip={true}
          />
        </div>

        {/* Terminal Panel View */}
        <div className={`w-full h-full ${currentTab === 'terminal' ? 'block' : 'hidden'}`}>
          <TerminalPanel 
            logs={workspace.terminalLogs}
            sessions={workspace.terminalSessions || []}
            activeSessionId={interactiveSessionId}
            absTargetDir={workspace.absTargetDir}
            isOutputRunning={workspace.isOutputRunning}
            onSelectSession={workspace.setActiveSessionId}
            onCreateSession={workspace.createTerminalSession}
            onCloseSession={workspace.closeTerminalSession}
            onSendTerminalCommand={workspace.sendTerminalCommand}
            onSendStdin={workspace.sendTerminalStdin}
            onKillProcess={workspace.killTerminalProcess}
            onClearOutput={() => workspace.clearTerminalSession && workspace.clearTerminalSession(interactiveSessionId)}
            hideTabStrip={true}
          />
        </div>

        {/* Stdin (Input) Panel View */}
        <div className={`w-full h-full ${currentTab === 'stdin' ? 'block' : 'hidden'}`}>
          <StdinPanel stdin={stdin} setStdin={setStdin} />
        </div>
      </div>
    </div>
  );
}

export default memo(BottomConsolePanel);
