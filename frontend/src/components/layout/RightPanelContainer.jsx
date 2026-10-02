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
      {/* TOP TAB BAR: [ Input ] vs [ Agent ] + Model Selector          */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-0 border-b select-none relative z-30"
        style={{
          backgroundColor: 'var(--theme-secondary)',
          borderColor: 'var(--theme-border)'
        }}
      >
        <div className="h-full flex items-center px-1.5 gap-1.5 overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden relative z-10">
          {/* Input Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('stdin')}
            className={`neuron-tab-card px-3 gap-1.5 font-mono shrink-0 cursor-pointer group ${
              activeTab === 'stdin' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-none">Input</span>
            <span
              className={`neuron-tab-indicator ${
                activeTab === 'stdin' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
          </button>

          {/* Agent Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('ai')}
            className={`neuron-tab-card px-3 gap-1.5 font-mono shrink-0 cursor-pointer group ${
              activeTab === 'ai' 
                ? 'neuron-tab-card-active' 
                : 'neuron-tab-card-inactive'
            }`}
          >
            <span className="leading-none">Agent</span>
            {isStreaming && (
              <span 
                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
                style={{ backgroundColor: 'var(--theme-accent)' }}
              />
            )}
            <span
              className={`neuron-tab-indicator ${
                activeTab === 'ai' ? 'neuron-tab-indicator-active' : 'neuron-tab-indicator-inactive'
              }`}
            />
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
