// frontend/src/components/layout/RightPanelContainer.jsx
import React, { useState, useEffect } from 'react';
import StdinPanel from './StdinPanel';
import AiChatView from '../ai/AiChatView';
import ModelSelectorDropdown from '../ai/ModelSelectorDropdown';

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
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* TOP TAB BAR: [ Input ] vs [ AI ] + Model Selector             */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-0 select-none relative z-30"
        style={{
          backgroundColor: 'var(--theme-secondary)'
        }}
      >
        {/* Full-width 1px bottom joining line (hidden under active tab) */}
        <div 
          className="absolute bottom-0 left-0 right-0 border-b z-0 pointer-events-none"
          style={{ borderColor: 'var(--theme-border)' }}
        />

        <div className="h-full flex items-end pt-1 px-1.5 gap-1 overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden relative z-10">
          {/* Input Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('stdin')}
            className={`relative px-3.5 flex items-center gap-1.5 text-[11px] font-mono rounded-t-[6px] transition-all duration-150 ease-out shrink-0 cursor-pointer ${
              activeTab === 'stdin' 
                ? 'h-[28px] mb-0 z-10 font-semibold border-t border-l border-r border-b-0' 
                : 'h-[25px] mb-[1px] font-medium border-t border-l border-r border-b-0 border-transparent hover:bg-[var(--theme-surface-hover)]/60 hover:text-[var(--theme-text-bright)]'
            }`}
            style={{
              backgroundColor: activeTab === 'stdin' ? 'var(--theme-background)' : 'transparent',
              borderColor: activeTab === 'stdin' ? 'var(--theme-border)' : 'transparent',
              color: activeTab === 'stdin' ? 'var(--theme-text-bright)' : 'var(--theme-text-secondary)'
            }}
          >
            <span
              className={`pointer-events-none absolute -top-[1px] rounded-full border-t-2 transition-all duration-150 ease-out ${
                activeTab === 'stdin' ? 'left-[6px] right-[6px] opacity-100' : 'left-1/2 right-1/2 opacity-0'
              }`}
              style={{ borderColor: 'var(--theme-accent)' }}
            />
            {activeTab === 'stdin' && (
              <span
                className="pointer-events-none absolute bottom-0 left-0 right-0 border-b"
                style={{ borderColor: 'var(--theme-background)' }}
              />
            )}
            <span>Input</span>
          </button>

          {/* AI Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('ai')}
            className={`relative px-3.5 flex items-center gap-1.5 text-[11px] font-mono rounded-t-[6px] transition-all duration-150 ease-out shrink-0 cursor-pointer ${
              activeTab === 'ai' 
                ? 'h-[28px] mb-0 z-10 font-semibold border-t border-l border-r border-b-0' 
                : 'h-[25px] mb-[1px] font-medium border-t border-l border-r border-b-0 border-transparent hover:bg-[var(--theme-surface-hover)]/60 hover:text-[var(--theme-text-bright)]'
            }`}
            style={{
              backgroundColor: activeTab === 'ai' ? 'var(--theme-background)' : 'transparent',
              borderColor: activeTab === 'ai' ? 'var(--theme-border)' : 'transparent',
              color: activeTab === 'ai' ? 'var(--theme-text-bright)' : 'var(--theme-text-secondary)'
            }}
          >
            <span
              className={`pointer-events-none absolute -top-[1px] rounded-full border-t-2 transition-all duration-150 ease-out ${
                activeTab === 'ai' ? 'left-[6px] right-[6px] opacity-100' : 'left-1/2 right-1/2 opacity-0'
              }`}
              style={{ borderColor: 'var(--theme-accent)' }}
            />
            {activeTab === 'ai' && (
              <span
                className="pointer-events-none absolute bottom-0 left-0 right-0 border-b"
                style={{ borderColor: 'var(--theme-background)' }}
              />
            )}
            <span>AI</span>
            {isStreaming && (
              <span 
                className="w-1.5 h-1.5 rounded-full animate-pulse" 
                style={{ backgroundColor: 'var(--theme-accent)' }}
              />
            )}
          </button>
        </div>

        <div className="shrink-0 flex items-center pr-2 relative z-20">
          <ModelSelectorDropdown 
            selectedModelId={aiStudio?.activeModelId}
            onSelectModel={aiStudio?.setActiveModelId}
            projectName={projectName}
            disabled={isStreaming}
            onOpenSettings={onOpenSettings}
          />
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
