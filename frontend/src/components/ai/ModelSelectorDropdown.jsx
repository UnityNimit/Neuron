// frontend/src/components/ai/ModelSelectorDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../../hooks/useSettings';

export default function ModelSelectorDropdown({
  selectedModelId,
  onSelectModel,
  disabled = false,
  onOpenSettings
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { settings, updateSetting } = useSettings();

  const apiKeys = settings?.apiKeys || [];
  const activeKeyId = selectedModelId || settings?.activeApiKeyId || (apiKeys.length > 0 ? apiKeys[0].id : 'local-ollama');

  const isLocalActive =
    activeKeyId === 'local-ollama' ||
    (typeof activeKeyId === 'string' && activeKeyId.startsWith('local')) ||
    !apiKeys.some(k => k.id === activeKeyId);
  const activeKey = apiKeys.find(k => k.id === activeKeyId);

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

  const handleSelect = (id) => {
    onSelectModel?.(id);
    updateSetting('activeApiKeyId', id);
    setIsOpen(false);
  };

  const handleOpenSettingsTab = () => {
    setIsOpen(false);
    if (onOpenSettings) {
      onOpenSettings('ai');
    } else {
      window.dispatchEvent(new CustomEvent('neuron-open-settings', { detail: { tab: 'ai' } }));
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Minimalist Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`h-6 px-2 rounded flex items-center gap-1.5 text-[11px] font-mono border transition-colors select-none ${
          disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:border-[var(--theme-accent)] cursor-pointer'
        }`}
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: isOpen ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-border, #242628)',
          color: 'var(--theme-text-primary, #cbd5e1)'
        }}
      >
        <span className="truncate max-w-[140px]">
          {!isLocalActive && activeKey ? activeKey.alias : 'Local AI'}
        </span>
        <span className="text-[8px] opacity-60">▼</span>
      </button>

      {/* Minimalist Dropdown List */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[150px] rounded-lg border shadow-xl z-[200] py-1 flex flex-col select-none"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)',
          }}
        >
          <div className="max-h-60 overflow-y-auto flex flex-col">
            {apiKeys.map((k) => {
              const isSelected = !isLocalActive && activeKeyId === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handleSelect(k.id)}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-mono truncate transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover)]"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--theme-surface-active, #282a2d)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--theme-accent, #3b82f6)'
                      : 'var(--theme-text-primary, #cbd5e1)',
                  }}
                >
                  {k.alias}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleSelect('local-ollama')}
              className="w-full text-left px-3 py-1.5 text-[11px] font-mono truncate transition-colors cursor-pointer hover:bg-[var(--theme-surface-hover)]"
              style={{
                backgroundColor: isLocalActive
                  ? 'var(--theme-surface-active, #282a2d)'
                  : 'transparent',
                color: isLocalActive
                  ? 'var(--theme-accent, #3b82f6)'
                  : 'var(--theme-text-primary, #cbd5e1)',
              }}
            >
              Local AI
            </button>
          </div>

          <div
            className="mt-0.5 pt-0.5 border-t flex items-center justify-center"
            style={{ borderColor: 'var(--theme-border, #242628)' }}
          >
            <button
              type="button"
              onClick={handleOpenSettingsTab}
              className="w-full py-1 text-[13px] font-mono leading-none flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)] transition-colors cursor-pointer"
              title="Manage API Keys"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
