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
      {/* TOP SEGMENTED SWITCHER: [ Input ] vs [ Antigravity AI ]        */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-2 border-b text-[11px] font-mono tracking-wide"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
        }}
      >
        <div className="flex items-center gap-1">
          {/* Input Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('stdin')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
              activeTab === 'stdin' 
                ? 'font-medium shadow-sm' 
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'stdin' 
                ? 'var(--theme-surfaceActive, #282a2d)' 
                : 'transparent',
              color: activeTab === 'stdin' 
                ? 'var(--theme-text-bright, #ffffff)' 
                : 'var(--theme-text-secondary, #94a3b8)',
              borderBottom: activeTab === 'stdin' ? '2px solid var(--theme-accent, #3b82f6)' : '2px solid transparent'
            }}
          >
            Input
          </button>

          {/* Antigravity AI Tab */}
          <button
            type="button"
            onClick={() => handleTabChange('ai')}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1.5 ${
              activeTab === 'ai' 
                ? 'font-medium shadow-sm' 
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'ai' 
                ? 'var(--theme-surfaceActive, #282a2d)' 
                : 'transparent',
              color: activeTab === 'ai' 
                ? 'var(--theme-text-bright, #ffffff)' 
                : 'var(--theme-text-secondary, #94a3b8)',
              borderBottom: activeTab === 'ai' ? '2px solid var(--theme-accent, #3b82f6)' : '2px solid transparent'
            }}
          >
            <span>Antigravity AI</span>
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

        {/* VIEW 2: ANTIGRAVITY AI STUDIO (Full-width clean chat view) */}
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
