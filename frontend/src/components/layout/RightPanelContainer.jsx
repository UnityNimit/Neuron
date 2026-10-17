// frontend/src/components/layout/RightPanelContainer.jsx
import React from 'react';
import AiChatView from '../ai/AiChatView';
import ModelSelectorDropdown from '../ai/ModelSelectorDropdown';

export default function RightPanelContainer({
  activeFile = "",
  fileContent = "",
  aiStudio,
  projectName = "Neuron",
  onOpenSettings
}) {
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
      {/* TOP BAR: AI Agent + Model Selector (Explorer Normal Texts)   */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 px-3 text-[11px] font-mono font-medium tracking-wide flex items-center justify-between shrink-0 border-b select-none"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium tracking-wide" style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}>
            AI Agent
          </span>
          {isStreaming && (
            <span 
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
              style={{ backgroundColor: 'var(--theme-accent, #38bdf8)' }}
            />
          )}
        </div>

        <div className="shrink-0 flex items-center pr-0 relative z-20">
          <ModelSelectorDropdown 
            activeModelId={aiStudio?.selectedModel || aiStudio?.activeModelId}
            onSelectModel={aiStudio?.handleSelectModel || aiStudio?.setActiveModelId}
            projectName={projectName}
            isStreaming={isStreaming}
            disabled={isStreaming}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* AI CHAT VIEW                                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden relative">
        <AiChatView
          conversation={aiStudio?.activeConversation}
          activeModelId={aiStudio?.selectedModel || aiStudio?.activeModelId}
          onSelectModel={aiStudio?.handleSelectModel || aiStudio?.setActiveModelId}
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
  );
}
