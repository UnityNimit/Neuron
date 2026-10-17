// frontend/src/components/layout/BottomConsolePanel.jsx
import React, { useState, useEffect } from 'react';
import TerminalPanel from './TerminalPanel';
import StdinPanel from './StdinPanel';

export default function BottomConsolePanel({
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
      {/* Top Tab Strip: [ Output ] [ Terminal ] [ Input ]               */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-0 border-b select-none relative z-30"
        style={{
          backgroundColor: 'var(--theme-secondary)',
          borderColor: 'var(--theme-border)'
        }}
      >
        <div className="h-full flex items-center px-1.5 gap-1.5 overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden relative z-10">
          {/* Output Tab */}
          <button
            type="button"
            onClick={() => handleTabClick('output')}
            className={`neuron-tab-card px-3 font-mono shrink-0 cursor-pointer group ${
              currentTab === 'output' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-normal py-0.5">Output</span>
            <span
              className={`neuron-tab-indicator ${
                currentTab === 'output' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
          </button>

          {/* Terminal Tab */}
          <button
            type="button"
            onClick={() => handleTabClick('terminal')}
            className={`neuron-tab-card px-3 font-mono shrink-0 cursor-pointer group ${
              currentTab === 'terminal' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-normal py-0.5">Terminal</span>
            <span
              className={`neuron-tab-indicator ${
                currentTab === 'terminal' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
          </button>

          {/* Input Tab */}
          <button
            type="button"
            onClick={() => handleTabClick('stdin')}
            className={`neuron-tab-card px-3 font-mono shrink-0 cursor-pointer group ${
              currentTab === 'stdin' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-normal py-0.5">Input</span>
            <span
              className={`neuron-tab-indicator ${
                currentTab === 'stdin' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
          </button>
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
