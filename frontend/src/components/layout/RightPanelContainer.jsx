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
      {/* TOP TAB BAR: [ AI Agent ] + Model Selector                    */}
      {/* ------------------------------------------------------------- */}
      <div 
        className="h-8 shrink-0 flex items-center justify-between px-0 border-b select-none relative z-30"
        style={{
          backgroundColor: 'var(--theme-secondary)',
          borderColor: 'var(--theme-border)'
        }}
      >
        <div className="h-full flex items-center px-1.5 gap-1.5 overflow-x-auto flex-grow [&::-webkit-scrollbar]:hidden relative z-10">
          <div
            className="neuron-tab-card px-3 gap-1.5 font-mono shrink-0 cursor-default group neuron-tab-card-active"
          >
            <span className="leading-normal py-0.5">AI Agent</span>
            {isStreaming && (
              <span 
                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
                style={{ backgroundColor: 'var(--theme-accent)' }}
              />
            )}
            <span className="neuron-tab-indicator neuron-tab-indicator-active" />
          </div>
        </div>

        <div className="shrink-0 flex items-center pr-2 relative z-20">
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
