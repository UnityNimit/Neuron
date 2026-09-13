// frontend/src/components/ai/ModelSelectorDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';

export const ANTIGRAVITY_MODELS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    quota: 'High',
    speed: 'Fast',
    hasInfo: true,
    desc: 'Next-gen frontier reasoning with instant token delivery and large context window.',
    isDefault: true,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    quota: 'Medium',
    speed: 'Fast',
    hasInfo: true,
    desc: 'High-speed balanced code generation and AST analysis.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    quota: 'Medium',
    speed: 'Fast',
    hasInfo: true,
    desc: 'Low-latency code transformations and syntax verification.',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    quota: 'Low',
    speed: null,
    hasInfo: false,
    desc: 'Deep multi-file architectural planning and high-complexity reasoning.',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    quota: null,
    speed: null,
    badge: 'Thinking',
    hasInfo: false,
    desc: 'Deep chain-of-thought analysis with internal reasoning trace streaming.',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6 (Thinking)',
    quota: null,
    speed: null,
    badge: 'Thinking',
    hasInfo: false,
    desc: 'Frontier reasoning engine for complex algorithm design and system refactors.',
  },
  {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B (Medium)',
    quota: 'Medium',
    speed: null,
    hasInfo: false,
    desc: 'Open-weights foundation intelligence with transparent code reasoning.',
  },
  {
    id: 'local-ollama',
    name: 'Ollama (qwen2.5-coder)',
    quota: 'Unlimited',
    speed: 'Fast',
    badge: 'Local',
    hasInfo: false,
    desc: 'Runs locally on your machine with 0ms network latency via Ollama.',
  }
];

export default function ModelSelectorDropdown({
  selectedModelId = 'gemini-3.8-flash',
  onSelectModel,
  projectName = 'Neuron',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeModel = ANTIGRAVITY_MODELS.find(m => m.id === selectedModelId) || ANTIGRAVITY_MODELS[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getQuotaBadgeStyle = (quota) => {
    switch (quota) {
      case 'High':
        return {
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          color: '#4ade80',
          borderColor: 'rgba(34, 197, 94, 0.25)'
        };
      case 'Medium':
        return {
          backgroundColor: 'rgba(234, 179, 8, 0.12)',
          color: '#facc15',
          borderColor: 'rgba(234, 179, 8, 0.25)'
        };
      case 'Low':
        return {
          backgroundColor: 'rgba(168, 85, 247, 0.12)',
          color: '#c084fc',
          borderColor: 'rgba(168, 85, 247, 0.25)'
        };
      default:
        return {
          backgroundColor: 'var(--theme-surfaceHover, #222426)',
          color: 'var(--theme-text-muted, #94a3b8)',
          borderColor: 'var(--theme-border, #242628)'
        };
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Active Model Pill Selector */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`h-7 px-2.5 rounded flex items-center gap-1.5 text-[11px] font-mono border transition-all duration-150 select-none ${
          disabled 
            ? 'opacity-40 cursor-not-allowed' 
            : 'hover:border-[var(--theme-accent)] cursor-pointer'
        }`}
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: isOpen ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-border, #242628)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
        title={disabled ? "Cannot change model while agent is generating" : "Select Antigravity AI Model"}
      >
        <span className="truncate max-w-[140px] font-medium">{activeModel.name}</span>
        <span className="text-[9px] opacity-60">▼</span>
      </button>

      {/* Model Selection Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-2xl z-[150] py-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col select-none"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)',
          }}
        >
          {/* Models List */}
          <div className="max-h-72 overflow-y-auto py-0.5">
            {ANTIGRAVITY_MODELS.map((model) => {
              const isSelected = model.id === selectedModelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel?.(model.id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center justify-between text-[11px] font-mono transition-colors group"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--theme-surfaceActive, #282a2d)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--theme-text-bright, #ffffff)'
                      : 'var(--theme-text-primary, #cbd5e1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--theme-surfaceHover, #222426)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex flex-col gap-0.5 flex-1 pr-2">
                    <span className={`truncate font-medium ${isSelected ? 'text-[var(--theme-accent,#3b82f6)]' : ''}`}>
                      {model.name}
                    </span>
                    <span
                      className="text-[10px] leading-tight truncate opacity-60"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      {model.desc}
                    </span>
                  </div>

                  {/* Badges on Right */}
                  <div className="flex items-center gap-1 shrink-0">
                    {model.quota && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tight"
                        style={getQuotaBadgeStyle(model.quota)}
                      >
                        {model.quota}
                      </span>
                    )}
                    {model.speed && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tight"
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          borderColor: 'rgba(56, 189, 248, 0.25)'
                        }}
                      >
                        {model.speed}
                      </span>
                    )}
                    {model.badge && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-tight"
                        style={{
                          backgroundColor: 'rgba(147, 51, 234, 0.12)',
                          color: '#c084fc',
                          borderColor: 'rgba(147, 51, 234, 0.25)'
                        }}
                      >
                        {model.badge}
                      </span>
                    )}
                    {model.hasInfo && (
                      <span
                        className="text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
                        title="Frontier optimized model"
                      >
                        ⓘ
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div
            className="h-[1px] my-1"
            style={{ backgroundColor: 'var(--theme-border, #242628)' }}
          />

          {/* Bottom Action: View Usage */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsUsageModalOpen(true);
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center justify-between transition-colors hover:bg-[var(--theme-surfaceHover)]"
            style={{ color: 'var(--theme-text-muted, #94a3b8)' }}
          >
            <span>View Usage</span>
            <span className="text-[10px] opacity-70">Pro Plan →</span>
          </button>
        </div>
      )}

      {/* Usage Modal Dialog */}
      {isUsageModalOpen && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 select-none"
          onClick={() => setIsUsageModalOpen(false)}
        >
          <div
            className="w-80 rounded-xl border p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: 'var(--theme-secondary, #191a1b)',
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--theme-border, #242628)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold">Usage & Quotas</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Pro Plan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="text-[11px] opacity-60 hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 text-[11px] font-mono">
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>Project Context</span>
                <span className="font-medium">{projectName}</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>Gemini 3.8 Flash</span>
                <span className="text-emerald-400 font-medium">High (1,500 RPM)</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>Gemini 3.7 / 3.6</span>
                <span className="text-yellow-400 font-medium">Medium (1,000 RPM)</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>Gemini 3.1 Pro</span>
                <span className="text-purple-400 font-medium">Low (360 RPM)</span>
              </div>
              <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>Claude 4.6 Thinking</span>
                <span className="text-purple-400 font-medium">Pro Unlimited Steps</span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ color: 'var(--theme-text-muted, #64748b)' }}>GPT-OSS 120B</span>
                <span className="text-yellow-400 font-medium">Medium Tier</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsUsageModalOpen(false)}
              className="mt-1 w-full py-1.5 rounded text-[11px] font-mono font-medium transition-colors"
              style={{
                backgroundColor: 'var(--theme-accent, #3b82f6)',
                color: '#ffffff'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
