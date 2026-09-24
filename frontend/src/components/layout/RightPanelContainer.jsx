// frontend/src/components/layout/RightPanelContainer.jsx
import React, { useState, useEffect } from 'react';
import StdinPanel from './StdinPanel';
import AiChatView from '../ai/AiChatView';

export default function RightPanelContainer({
  stdin = "",
  setStdin,
  activeFile = "",
  fileContent = "",
  aiStudio,
  projectName = "Neuron",
  onOpenSettings
}) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('neuron-right-panel-tab') || 'ai';
    } catch {
      return 'ai';
    }
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('neuron-right-panel-tab', tab);
    } catch {}
  };

  useEffect(() => {
    const handleSwitchTab = (e) => {
      const tab = e.detail;
      if (tab === 'ai' || tab === 'stdin') {
        setActiveTab(tab);
        try {
          localStorage.setItem('neuron-right-panel-tab', tab);
        } catch {}
      }
    };
    window.addEventListener('neuron-switch-right-panel-tab', handleSwitchTab);
    return () => window.removeEventListener('neuron-switch-right-panel-tab', handleSwitchTab);
  }, []);

  const isStreaming = Boolean(aiStudio?.isStreaming);

  return (
    <div 
      className="w-full h-full flex flex-col select-none overflow-hidden"
      style={{
        backgroundColor: 'var(--theme-secondary, #191a1b)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP TAB BAR: [ Input ] vs [ AI ]                              */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 border-b flex items-center justify-between px-0 select-none"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
        }}
      >
        <div className="flex items-center overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden">
          {/* Input Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('stdin')}
            className={`h-8 px-3 flex items-center text-[11px] font-mono font-medium border-r transition-colors shrink-0 cursor-pointer ${
              activeTab === 'stdin' 
                ? 'font-semibold border-t-2 border-t-[var(--theme-accent)]' 
                : 'hover:text-[var(--theme-text-bright)]'
            }`}
            style={{
              backgroundColor: activeTab === 'stdin' 
                ? 'var(--theme-background, #121314)' 
                : 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: activeTab === 'stdin' 
                ? 'var(--theme-accent, #3b82f6)' 
                : 'var(--theme-text-secondary, #94a3b8)'
            }}
          >
            <span>Input</span>
          </button>

          {/* AI Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('ai')}
            className={`h-8 px-3 flex items-center gap-1.5 text-[11px] font-mono font-medium border-r transition-colors shrink-0 cursor-pointer ${
              activeTab === 'ai' 
                ? 'font-semibold border-t-2 border-t-[var(--theme-accent)]' 
                : 'hover:text-[var(--theme-text-bright)]'
            }`}
            style={{
              backgroundColor: activeTab === 'ai' 
                ? 'var(--theme-background, #121314)' 
                : 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: activeTab === 'ai' 
                ? 'var(--theme-accent, #3b82f6)' 
                : 'var(--theme-text-secondary, #94a3b8)'
            }}
          >
            <span>AI</span>
            {isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent,#3b82f6)] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PANEL CONTENTS                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden relative">
        {/* VIEW 1: STDIN PANEL (Kept mounted to preserve typed test cases) */}
        <div className={`w-full h-full ${activeTab === 'stdin' ? 'block' : 'hidden'}`}>
          <StdinPanel stdin={stdin} setStdin={setStdin} />
        </div>

        {/* VIEW 2: AI (Full-width clean chat view) */}
        <div className={`w-full h-full ${activeTab === 'ai' ? 'block' : 'hidden'}`}>
          <AiChatView
            conversation={aiStudio?.activeConversation}
            activeModelId={aiStudio?.activeModelId}
            onSelectModel={aiStudio?.setActiveModelId}
            onSendMessage={aiStudio?.handleSendMessage}
            onStopGeneration={aiStudio?.handleStopGeneration}
            onRollback={aiStudio?.handleRollback}
            onApplyRefactor={aiStudio?.handleApplyRefactor}
            isStreaming={aiStudio?.isStreaming}
            streamingThought={aiStudio?.streamingThought}
            streamingDelta={aiStudio?.streamingDelta}
            streamingSteps={aiStudio?.streamingSteps}
            activeFile={activeFile}
            fileContent={fileContent}
            projectName={projectName}
            onOpenSettings={onOpenSettings}
            pendingApproval={aiStudio?.pendingApproval}
            onApproveAction={aiStudio?.handleApproveAction}
            onRejectAction={aiStudio?.handleRejectAction}
          />
        </div>
      </div>
    </div>
  );
}
