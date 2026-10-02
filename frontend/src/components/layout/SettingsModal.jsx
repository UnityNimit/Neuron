import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '../../config/themeConfig';
import NeuronLogo from '../common/NeuronLogo';

function MinimalToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-150 ease-out focus:outline-none"
      style={{
        backgroundColor: checked 
          ? 'var(--theme-accent, #3b82f6)' 
          : 'var(--theme-border-subtle, #2e3032)',
      }}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-150 ease-out ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function MinimalSelect({ value, options, onChange }) {
  return (
    <div className="relative inline-block shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] font-mono rounded-lg px-2.5 py-1 border outline-none cursor-pointer transition-colors focus:border-[var(--theme-accent)]"
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: 'var(--theme-border, #242628)',
          color: 'var(--theme-text-primary, #e2e8f0)'
        }}
      >
        {options.map(opt => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const label = typeof opt === 'object' ? opt.label : opt;
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
    </div>
  );
}

function ThemedNumberInput({ value, min = 0, max = 100, step = 1, onChange, className = "w-20" }) {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : min;
  const [textValue, setTextValue] = useState(String(safeVal));

  useEffect(() => {
    setTextValue(String(safeVal));
  }, [safeVal]);

  const stepStr = step.toString();
  const precision = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;

  const handleStep = (direction) => {
    let nextVal = direction === 'up' ? safeVal + step : safeVal - step;
    nextVal = Math.max(min, Math.min(max, nextVal));
    nextVal = Number(nextVal.toFixed(precision));
    setTextValue(String(nextVal));
    onChange(nextVal);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    setTextValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(textValue);
    if (isNaN(parsed)) {
      setTextValue(String(safeVal));
    } else {
      const clamped = Math.max(min, Math.min(max, parsed));
      const rounded = Number(clamped.toFixed(precision));
      setTextValue(String(rounded));
      onChange(rounded);
    }
  };

  return (
    <div 
      className={`inline-flex items-center rounded-lg border transition-colors shrink-0 ${className} overflow-hidden focus-within:border-[var(--theme-accent)]`}
      style={{
        backgroundColor: 'var(--theme-surface, #161719)',
        borderColor: 'var(--theme-border, #242628)',
      }}
    >
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={textValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-full bg-transparent text-[11px] font-mono px-2 py-1 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none select-text"
        style={{
          color: 'var(--theme-text-primary, #e2e8f0)'
        }}
      />
      <div 
        className="flex flex-col border-l self-stretch justify-center shrink-0"
        style={{ borderColor: 'var(--theme-border, #242628)' }}
      >
        <button
          type="button"
          onClick={() => handleStep('up')}
          aria-label="Increase value"
          className="px-1.5 py-0.5 hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] transition-colors flex items-center justify-center cursor-pointer select-none"
        >
          <ChevronUp size={10} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => handleStep('down')}
          aria-label="Decrease value"
          className="px-1.5 py-0.5 hover:bg-[var(--theme-surface-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] transition-colors flex items-center justify-center cursor-pointer select-none border-t"
          style={{ borderColor: 'var(--theme-border, #242628)' }}
        >
          <ChevronDown size={10} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function MinimalNumberInput({ value, min = 10, max = 28, step = 1, onChange }) {
  return (
    <ThemedNumberInput
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
      className="w-20"
    />
  );
}

function MinimalSliderNumberInput({ value, min = 0.01, max = 3.0, step = 0.01, onChange }) {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : min;
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeVal}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent,#3b82f6)]"
        style={{
          backgroundColor: 'var(--theme-border, #242628)'
        }}
      />
      <ThemedNumberInput
        min={min}
        max={max}
        step={step}
        value={safeVal}
        onChange={onChange}
        className="w-20"
      />
    </div>
  );
}

const THEME_COLOR_TOKENS = [
  { key: 'background', label: 'Canvas & Editor Background', desc: 'Main canvas and code editor background' },
  { key: 'primary', label: 'Top Bar Background', desc: 'Background color of the top application header' },
  { key: 'secondary', label: 'Panels & Sidebar Background', desc: 'Background color for file tree, status bar, and terminal' },
  { key: 'surface', label: 'Surface Background', desc: 'Background for dropdown menus, modals, and tooltips' },
  { key: 'surfaceHover', label: 'Surface Hover', desc: 'Hover state background for interactive items and lists' },
  { key: 'surfaceActive', label: 'Surface Active', desc: 'Active pressed state background for buttons and tabs' },
  { key: 'border', label: 'Border Color', desc: 'Primary structural dividers, panel borders, and frames' },
  { key: 'accent', label: 'Accent Color', desc: 'Active tabs, highlights, toggle switches, and focus states' },
  { key: 'textBright', label: 'Bright Text', desc: 'Active file titles, headings, and high-emphasis labels' },
  { key: 'textPrimary', label: 'Primary Text', desc: 'Main body copy, editor code text, and active labels' },
  { key: 'textSecondary', label: 'Secondary Text', desc: 'Subheadings, inactive tab labels, and descriptions' },
  { key: 'textMuted', label: 'Muted Text', desc: 'Dimmed notes, keyboard shortcuts, and subtle hints' },
];

const normalizeHex = (val) => {
  if (!val || typeof val !== 'string') return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
  return '#000000';
};

const SHORTCUT_GROUPS = [
  {
    group: 'Navigation & File Management',
    shortcuts: [
      { label: 'Omni-Search', desc: 'Search symbols, workspace files, actions, and AST nodes', keys: ['Ctrl', 'K'] },
      { label: 'Save Active File', desc: 'Save modifications in the currently open editor tab', keys: ['Ctrl', 'S'] },
      { label: 'Open Workspace Folder', desc: 'Select and load a new repository into the canvas', keys: ['Ctrl', 'K', 'Ctrl', 'O'] },
      { label: 'Preferences & Settings', desc: 'Open the settings and configuration window', keys: ['Ctrl', ','] },
      { label: 'Toggle Fullscreen', desc: 'Switch window between standard and borderless fullscreen', keys: ['F11'] },
    ]
  },
  {
    group: 'Code Editing',
    shortcuts: [
      { label: 'Toggle Line Comment', desc: 'Comment or uncomment the current line or selection', keys: ['Ctrl', '/'] },
      { label: 'Toggle Block Comment', desc: 'Surround selection in multi-line block comment', keys: ['Shift', 'Alt', 'A'] },
      { label: 'Undo', desc: 'Revert the last editor modification', keys: ['Ctrl', 'Z'] },
      { label: 'Redo', desc: 'Reapply the previously reverted editor modification', keys: ['Ctrl', 'Y'] },
      { label: 'Cut Line / Selection', desc: 'Cut current line or selection to system clipboard', keys: ['Ctrl', 'X'] },
      { label: 'Copy Line / Selection', desc: 'Copy current line or selection to system clipboard', keys: ['Ctrl', 'C'] },
      { label: 'Paste Clipboard', desc: 'Insert clipboard content at editor cursor', keys: ['Ctrl', 'V'] },
      { label: 'Rename Symbol / File', desc: 'Trigger inline rename for files in tree or explorer', keys: ['F2'] },
    ]
  },
  {
    group: 'Panels & Layout',
    shortcuts: [
      { label: 'Toggle Explorer Sidebar', desc: 'Show or collapse file explorer and project tree', keys: ['Ctrl', 'B'] },
      { label: 'Toggle Interactive Terminal', desc: 'Show or collapse the built-in terminal bottom panel', keys: ['Ctrl', '`'] },
      { label: 'Run Active Python Script', desc: 'Execute the currently active python file in terminal', keys: ['F5'] },
      { label: 'Stop Running Process', desc: 'Send interrupt signal (SIGINT) to running terminal task', keys: ['Ctrl', 'C'] },
    ]
  },
  {
    group: 'Spatial AST Map & Graph',
    shortcuts: [
      { label: 'AI Impact Analysis', desc: 'Analyze blast radius and downstream dependencies of node', keys: ['Alt', 'I'] },
      { label: 'Focus Isolation', desc: 'Isolate celestial camera view onto the hovered node', keys: ['F'] },
      { label: 'Clear Focus / Alerts', desc: 'Clear node highlights, blast radius, and alert banners', keys: ['Esc'] },
      { label: 'Warp Camera to Node', desc: 'Smoothly fly camera to matched AST node in search', keys: ['↵'] },
      { label: 'Open Node in Editor', desc: 'Navigate directly to function or class definition in code', keys: ['Double Click'] },
      { label: 'Spatial Undo', desc: 'Revert last automated AST structural transformation', keys: ['Ctrl', 'Z'] },
    ]
  }
];

export default function SettingsModal({ isOpen, onClose, settings, updateSetting, initialTab = 'general' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { 
    currentThemeId, 
    setTheme, 
    themes, 
    defaultThemes, 
    saveThemeOverrides, 
    restoreThemeDefaults, 
    restoreAllThemesDefaults 
  } = useTheme();

  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);
  const [tokenEdits, setTokenEdits] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState(new Set());
  const [detectingIds, setDetectingIds] = useState({});
  const detectTimersRef = useRef({});
  const apiKeysRef = useRef(settings?.apiKeys || []);

  const apiKeys = settings?.apiKeys || [];
  const activeApiKeyId = settings?.activeApiKeyId || 'local-ollama';

  useEffect(() => {
    apiKeysRef.current = settings?.apiKeys || [];
  }, [settings?.apiKeys]);

  const detectKeyAndModels = async (id, rawKey, customBaseUrl = null) => {
    const cleanKey = (rawKey || '').trim();
    if (!cleanKey || cleanKey.length < 8) return;

    setDetectingIds(prev => ({ ...prev, [id]: true }));
    try {
      const resp = await fetch('http://127.0.0.1:8000/api/ai/discover-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          api_key: cleanKey,
          base_url: (customBaseUrl || '').trim() || undefined
        })
      });
      const data = await resp.json();
      const latestKeys = apiKeysRef.current || [];
      if (data && data.valid && data.best_model) {
        const updated = latestKeys.map(k => k.id === id ? {
          ...k,
          detectedProvider: data.provider,
          detectedModel: data.best_model,
          modelCount: (data.models || []).length,
          status: 'verified',
          errorMessage: null
        } : k);
        updateSetting('apiKeys', updated);
      } else {
        const updated = latestKeys.map(k => k.id === id ? {
          ...k,
          detectedProvider: null,
          detectedModel: null,
          modelCount: 0,
          status: 'error',
          errorMessage: data?.error || 'Unable to detect available models for this key'
        } : k);
        updateSetting('apiKeys', updated);
      }
    } catch (err) {
      const latestKeys = apiKeysRef.current || [];
      const updated = latestKeys.map(k => k.id === id ? {
        ...k,
        status: 'error',
        errorMessage: 'Backend offline — will auto-detect on next request'
      } : k);
      updateSetting('apiKeys', updated);
    } finally {
      setDetectingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAddApiKey = () => {
    const newKey = {
      id: `key_${Date.now()}`,
      alias: `Key ${apiKeys.length + 1}`,
      key: '',
      baseUrl: '',
      detectedProvider: null,
      detectedModel: null,
      modelCount: 0,
      status: 'idle'
    };
    const updated = [...apiKeys, newKey];
    updateSetting('apiKeys', updated);
    if (apiKeys.length === 0 || activeApiKeyId === 'local-ollama') {
      updateSetting('activeApiKeyId', newKey.id);
    }
  };

  const handleUpdateApiKey = (id, field, value) => {
    let keyForDetect = null;
    let urlForDetect = null;

    const updated = apiKeys.map(k => {
      if (k.id === id) {
        const updatedKey = { ...k, [field]: value };
        if (field === 'key' || field === 'baseUrl') {
          updatedKey.detectedProvider = null;
          updatedKey.detectedModel = null;
          updatedKey.modelCount = 0;
          updatedKey.status = (updatedKey.key || '').trim().length >= 8 ? 'detecting' : 'idle';
          updatedKey.errorMessage = null;
        }
        keyForDetect = updatedKey.key;
        urlForDetect = updatedKey.baseUrl;
        return updatedKey;
      }
      return k;
    });
    updateSetting('apiKeys', updated);

    if (field === 'key' || field === 'baseUrl') {
      if (detectTimersRef.current[id]) {
        clearTimeout(detectTimersRef.current[id]);
      }
      if (keyForDetect && keyForDetect.trim().length >= 8) {
        detectTimersRef.current[id] = setTimeout(() => {
          detectKeyAndModels(id, keyForDetect, urlForDetect);
        }, 550);
      }
    }
  };

  const handleDeleteApiKey = (id) => {
    if (detectTimersRef.current[id]) {
      clearTimeout(detectTimersRef.current[id]);
    }
    const updated = apiKeys.filter(k => k.id !== id);
    updateSetting('apiKeys', updated);
    if (activeApiKeyId === id) {
      updateSetting('activeApiKeyId', updated.length > 0 ? updated[0].id : 'local-ollama');
    }
  };

  const handleSetActiveApiKey = (id) => {
    updateSetting('activeApiKeyId', id);
  };

  const toggleRevealKey = (id) => {
    setRevealedKeyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-detect any saved keys that haven't been probed yet when Agent settings tab opens
  useEffect(() => {
    if (isOpen && activeTab === 'ai') {
      apiKeys.forEach(k => {
        if (k.key && k.key.trim().length >= 8 && !k.detectedModel && !detectingIds[k.id] && k.status !== 'error') {
          detectKeyAndModels(k.id, k.key, k.baseUrl);
        }
      });
    }
  }, [isOpen, activeTab]);

  // Sync activeTab when initialTab changes or modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Sync token edits when theme changes or modal opens
  useEffect(() => {
    setSelectedThemeId(currentThemeId);
  }, [currentThemeId, isOpen]);

  useEffect(() => {
    if (themes && themes[selectedThemeId]) {
      const t = themes[selectedThemeId];
      setTokenEdits({
        background: t.background || '#121314',
        primary: t.primary || '#090a0a',
        secondary: t.secondary || '#191a1b',
        surface: t.surface || '#161719',
        surfaceHover: t.surfaceHover || '#222426',
        surfaceActive: t.surfaceActive || '#282a2d',
        border: t.border || '#242628',
        accent: t.accent || '#3b82f6',
        textBright: t.textBright || '#ffffff',
        textPrimary: t.textPrimary || '#cbd5e1',
        textSecondary: t.textSecondary || '#94a3b8',
        textMuted: t.textMuted || '#64748b',
      });
    }
  }, [selectedThemeId, themes]);

  const handleSelectTheme = (id) => {
    setSelectedThemeId(id);
    setTheme(id);
    setSaveStatus(null);
  };

  const handleTokenChange = (tokenKey, val) => {
    setTokenEdits(prev => ({
      ...prev,
      [tokenKey]: val
    }));
  };

  const handleSaveTheme = () => {
    saveThemeOverrides(selectedThemeId, tokenEdits);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleRestoreTheme = () => {
    restoreThemeDefaults(selectedThemeId);
    if (defaultThemes && defaultThemes[selectedThemeId]) {
      const base = defaultThemes[selectedThemeId];
      setTokenEdits({
        background: base.background,
        primary: base.primary,
        secondary: base.secondary,
        surface: base.surface,
        surfaceHover: base.surfaceHover,
        surfaceActive: base.surfaceActive,
        border: base.border,
        accent: base.accent,
        textBright: base.textBright,
        textPrimary: base.textPrimary,
        textSecondary: base.textSecondary,
        textMuted: base.textMuted,
      });
    }
    setSaveStatus('restored');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleRestoreAll = () => {
    restoreAllThemesDefaults();
    if (defaultThemes && defaultThemes[selectedThemeId]) {
      const base = defaultThemes[selectedThemeId];
      setTokenEdits({
        background: base.background,
        primary: base.primary,
        secondary: base.secondary,
        surface: base.surface,
        surfaceHover: base.surfaceHover,
        surfaceActive: base.surfaceActive,
        border: base.border,
        accent: base.accent,
        textBright: base.textBright,
        textPrimary: base.textPrimary,
        textSecondary: base.textSecondary,
        textMuted: base.textMuted,
      });
    }
    setSaveStatus('restored_all');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const modalRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initX: 0, initY: 0 });

  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, textarea, [role="button"]')) return;

    e.preventDefault();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: dragPosition.x,
      initY: dragPosition.y
    };
    setIsDragging(true);

    let latestX = dragPosition.x;
    let latestY = dragPosition.y;

    const handlePointerMove = (moveEvt) => {
      const dx = moveEvt.clientX - dragStartRef.current.startX;
      const dy = moveEvt.clientY - dragStartRef.current.startY;

      const modalEl = modalRef.current;
      const modalW = modalEl ? modalEl.offsetWidth : 760;
      const modalH = modalEl ? modalEl.offsetHeight : 520;

      const maxOffsetX = Math.max(20, (window.innerWidth - modalW) / 2 + (modalW * 0.45));
      const minOffsetX = -maxOffsetX;
      const maxOffsetY = Math.max(20, (window.innerHeight - modalH) / 2 + (modalH * 0.45));
      const minOffsetY = -Math.max(20, (window.innerHeight - modalH) / 2 - 10);

      latestX = Math.max(minOffsetX, Math.min(maxOffsetX, dragStartRef.current.initX + dx));
      latestY = Math.max(minOffsetY, Math.min(maxOffsetY, dragStartRef.current.initY + dy));

      if (modalEl) {
        modalEl.style.transform = `translate3d(${latestX}px, ${latestY}px, 0)`;
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragPosition({ x: latestX, y: latestY });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [dragPosition]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    { id: 'general', label: 'General', desc: 'Workspace preferences, auto-saving, and system safety' },
    { id: 'ai', label: 'Agent', desc: 'API keys, model discovery, and agent configuration' },
    { id: 'editor', label: 'Editor', desc: 'Code editing, typography, formatting, and layout' },
    { id: 'spatial', label: 'Spatial Map', desc: '3D celestial canvas, radar minimap, and physics simulation' },
    { id: 'appearance', label: 'Appearance', desc: 'Visual theme, color palettes, and custom theme token overrides' },
    { id: 'reference', label: 'Reference', desc: 'Complete keyboard shortcuts and interactive command reference' },
  ];

  const currentCategory = categories.find(c => c.id === activeTab) || categories[0];

  return (
    /* Transparent pass-through container so the Settings window can be dragged anywhere over the editor */
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans select-none pointer-events-none"
    >
      {/* Draggable Settings Window Frame */}
      <div 
        ref={modalRef}
        className="w-[780px] h-[530px] max-w-[95vw] max-h-[90vh] rounded-xl border flex overflow-hidden shadow-2xl pointer-events-auto will-change-transform"
        style={{
          backgroundColor: 'var(--theme-secondary, #191a1b)',
          borderColor: 'var(--theme-border, #242628)',
          transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ----------------------------------------------------------------- */}
        {/* LEFT BAR: Category Sidebar                                        */}
        {/* ----------------------------------------------------------------- */}
        <div 
          className="w-48 shrink-0 border-r flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)',
          }}
        >
          <div className="flex flex-col">
            {/* Sidebar Top Title (Draggable Handle) */}
            <div 
              onPointerDown={handleDragStart}
              className="h-10 px-3.5 border-b flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
              style={{ borderColor: 'var(--theme-border, #242628)' }}
              title="Drag to move Settings window"
            >
              <span 
                className="font-medium text-[12px] font-mono tracking-wide pointer-events-none"
                style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
              >
                Settings
              </span>
            </div>

            {/* Category Navigation Items */}
            <div className="p-1.5 flex flex-col gap-0.5">
              {categories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveTab(cat.id)}
                    className={`w-full flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors text-left cursor-pointer border ${
                      isActive 
                        ? 'font-medium shadow-xs' 
                        : 'border-transparent hover:bg-[var(--theme-surface-hover)]'
                    }`}
                    style={{
                      backgroundColor: isActive ? 'var(--theme-surface-hover, #222426)' : 'transparent',
                      borderColor: isActive ? 'var(--theme-border, #242628)' : 'transparent',
                      color: isActive ? 'var(--theme-text-bright, #f8fafc)' : 'var(--theme-text-secondary, #94a3b8)',
                    }}
                  >
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Bottom Version Indicator */}
          <div 
            className="h-9 px-3.5 border-t flex items-center justify-between text-[10px] font-mono"
            style={{
              borderColor: 'var(--theme-border, #242628)',
              color: 'var(--theme-text-muted, #64748b)'
            }}
          >
            <div className="flex items-center gap-1.5">
              <NeuronLogo size={13} color="var(--theme-accent, #3b82f6)" />
              <span>Neuron</span>
            </div>
            <span style={{ color: 'var(--theme-accent, #3b82f6)' }}>v1.1.0</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* RIGHT CONTENT PANEL: Category Settings Details                   */}
        {/* ----------------------------------------------------------------- */}
        <div 
          className="flex-1 flex flex-col min-w-0"
          style={{ backgroundColor: 'var(--theme-secondary, #191a1b)' }}
        >
          {/* Content Header (Draggable Handle) */}
          <div 
            onPointerDown={handleDragStart}
            className="h-10 px-5 border-b flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
            style={{ borderColor: 'var(--theme-border, #242628)' }}
            title="Drag to move Settings window"
          >
            <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
              <span 
                className="text-[11.5px] font-mono font-medium truncate"
                style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
              >
                {currentCategory.label}
              </span>
              <span 
                className="text-[11px] font-mono truncate hidden sm:inline"
                style={{ color: 'var(--theme-text-muted, #64748b)' }}
              >
                · {currentCategory.desc}
              </span>
            </div>

            <button 
              type="button"
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]"
              title="Close Settings (Esc)"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Settings List Body */}
          <div 
            className="flex-1 overflow-y-auto px-5 py-2 flex flex-col divide-y divide-[var(--theme-border)] [&::-webkit-scrollbar]:w-1"
            style={{ borderColor: 'var(--theme-border, #242628)' }}
          >

            {/* ============================================================= */}
            {/* 1. GENERAL SETTINGS                                           */}
            {/* ============================================================= */}
            {activeTab === 'general' && (
              <>
                {/* Auto Save */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Auto Save
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Automatically save dirty files after typing and when switching focus.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.autoSave ?? true} 
                    onChange={(val) => updateSetting('autoSave', val)} 
                  />
                </div>

                {/* AI Blast Protection */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      AI Blast Protection
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Guards project against uncontrolled rapid multi-file AI mutation bursts.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.blastProtection ?? false} 
                    onChange={(val) => updateSetting('blastProtection', val)} 
                  />
                </div>

                {/* Confirm on Delete */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Confirm on Delete
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Display a confirmation prompt before permanently deleting files from disk.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.confirmDelete ?? true} 
                    onChange={(val) => updateSetting('confirmDelete', val)} 
                  />
                </div>
              </>
            )}

            {/* ============================================================= */}
            {/* 1.5. AI & MODELS SETTINGS                                     */}
            {/* ============================================================= */}
            {activeTab === 'ai' && (
              <div className="flex flex-col gap-6 py-2">
                {/* 1. API Keys & Aliases Section */}
                <div className="flex flex-col gap-3">
                  <div 
                    className="flex items-center justify-between pb-2 border-b"
                    style={{ borderColor: 'var(--theme-border, #242628)' }}
                  >
                    <div className="flex flex-col gap-0.5 max-w-[420px]">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[11.5px] font-mono font-medium"
                          style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                        >
                          API Keys & Custom Aliases
                        </span>
                      </div>
                      <span 
                        className="text-[11px] font-sans leading-relaxed"
                        style={{ color: 'var(--theme-text-muted, #64748b)' }}
                      >
                        Supports Google Gemini (AIza, AQ), Grok / xAI, Groq, OpenRouter, Cerebras, DeepSeek, Mistral, and custom OpenAI-compatible endpoints. Neuron discovers and selects the best model dynamically.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddApiKey}
                      className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer border hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-bright)] text-[var(--theme-text-muted)] shrink-0"
                      style={{
                        backgroundColor: 'var(--theme-surface, #161719)',
                        borderColor: 'var(--theme-border, #242628)',
                      }}
                      title="Add API Key"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* List of Configured Keys */}
                  {apiKeys.length === 0 ? (
                    <div 
                      className="p-4 rounded-lg border border-dashed flex flex-col items-center justify-center text-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--theme-surface, #161719)',
                        borderColor: 'var(--theme-border, #242628)',
                        color: 'var(--theme-text-muted, #64748b)'
                      }}
                    >
                      <span className="text-[11.5px] font-mono font-medium">No API keys configured yet</span>
                      <p className="text-[11px] max-w-xs font-sans">
                        Add an API key to automatically discover its best available model, or use local offline models below.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddApiKey}
                        className="mt-1 w-6 h-6 rounded-lg flex items-center justify-center border hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-bright)] text-[var(--theme-text-muted)] transition-colors cursor-pointer"
                        style={{
                          backgroundColor: 'var(--theme-secondary, #191a1b)',
                          borderColor: 'var(--theme-border, #242628)',
                        }}
                        title="Add API Key"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {apiKeys.map((k) => {
                        const isActive = activeApiKeyId === k.id;
                        const isRevealed = revealedKeyIds.has(k.id);
                        const isDetecting = Boolean(detectingIds[k.id] || k.status === 'detecting');

                        return (
                          <div 
                            key={k.id}
                            className="p-2.5 rounded-lg border flex flex-col gap-2 transition-all"
                            style={{
                              backgroundColor: 'var(--theme-surface, #161719)',
                              borderColor: isActive ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-border, #242628)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Left: Active Toggle + Alias */}
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleSetActiveApiKey(k.id)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer border shrink-0 ${
                                    isActive 
                                      ? 'font-semibold' 
                                      : 'hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-bright)]'
                                  }`}
                                  style={{
                                    backgroundColor: isActive
                                      ? 'var(--theme-surface-active, #282a2d)'
                                      : 'var(--theme-background, #121314)',
                                    borderColor: isActive
                                      ? 'var(--theme-accent, #3b82f6)'
                                      : 'var(--theme-border, #242628)',
                                    color: isActive
                                      ? 'var(--theme-text-bright, #ffffff)'
                                      : 'var(--theme-text-muted, #64748b)'
                                  }}
                                  title={isActive ? "Active" : "Set Active"}
                                >
                                  <span>{isActive ? 'Active' : 'Set Active'}</span>
                                </button>

                                <input
                                  type="text"
                                  value={k.alias || ""}
                                  onChange={(e) => handleUpdateApiKey(k.id, 'alias', e.target.value)}
                                  placeholder="Key Alias (e.g. Work Key)..."
                                  className="text-[11px] font-mono font-medium px-2 py-1 rounded-lg border outline-none focus:border-[var(--theme-accent)] transition-colors flex-1 max-w-[220px]"
                                  style={{
                                    backgroundColor: 'var(--theme-background, #121314)',
                                    borderColor: 'var(--theme-border, #242628)',
                                    color: 'var(--theme-text-bright, #ffffff)'
                                  }}
                                />
                              </div>

                              {/* Right: Auto-Detected Model Status + Delete */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isDetecting ? (
                                  <span 
                                    className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md border"
                                    style={{
                                      backgroundColor: 'var(--theme-background, #121314)',
                                      borderColor: 'var(--theme-border, #242628)',
                                      color: 'var(--theme-text-secondary, #94a3b8)'
                                    }}
                                  >
                                    <RefreshCw size={10} className="animate-spin" />
                                    <span>Detecting best model...</span>
                                  </span>
                                ) : k.detectedModel ? (
                                  <div className="flex items-center gap-1">
                                    <span 
                                      className="text-[10px] font-mono px-2 py-0.5 rounded-md border max-w-[220px] truncate"
                                      style={{
                                        backgroundColor: 'var(--theme-background, #121314)',
                                        borderColor: 'var(--theme-border, #242628)',
                                        color: 'var(--theme-text-secondary, #94a3b8)'
                                      }}
                                      title={`Auto-selected best model: ${k.detectedModel}${k.modelCount ? ` (${k.modelCount} available)` : ''}`}
                                    >
                                      {k.detectedProvider ? `${k.detectedProvider} · ` : ''}{k.detectedModel}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => detectKeyAndModels(k.id, k.key)}
                                      className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors cursor-pointer"
                                      title="Re-scan available models for this key"
                                    >
                                      <RefreshCw size={11} />
                                    </button>
                                  </div>
                                ) : k.status === 'error' ? (
                                  <div className="flex items-center gap-1">
                                    <span 
                                      className="text-[10px] font-mono px-2 py-0.5 rounded-md border max-w-[200px] truncate"
                                      style={{
                                        backgroundColor: 'var(--theme-background, #121314)',
                                        borderColor: 'var(--theme-border, #242628)',
                                        color: 'var(--theme-text-muted, #64748b)'
                                      }}
                                      title={k.errorMessage || 'Could not detect models'}
                                    >
                                      {k.errorMessage || 'Detection failed'}
                                    </span>
                                    {k.key && k.key.trim().length >= 8 && (
                                      <button
                                        type="button"
                                        onClick={() => detectKeyAndModels(k.id, k.key)}
                                        className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors cursor-pointer"
                                        title="Retry model detection"
                                      >
                                        <RefreshCw size={11} />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span 
                                    className="text-[10px] font-mono px-2 py-0.5 rounded-md border"
                                    style={{
                                      backgroundColor: 'var(--theme-background, #121314)',
                                      borderColor: 'var(--theme-border, #242628)',
                                      color: 'var(--theme-text-muted, #64748b)'
                                    }}
                                  >
                                    Auto-selects best model
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteApiKey(k.id)}
                                  className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete API Key"
                                >
                                  <Trash2 size={12} strokeWidth={1.75} />
                                </button>
                              </div>
                            </div>

                            {/* API Key Input Line */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={isRevealed ? "text" : "password"}
                                  value={k.key || ""}
                                  onChange={(e) => handleUpdateApiKey(k.id, 'key', e.target.value)}
                                  placeholder="API key (Google Gemini, Grok, Groq, OpenRouter, Cerebras, DeepSeek, OpenAI...)"
                                  spellCheck={false}
                                  className="w-full text-[11px] font-mono rounded-lg pl-2.5 pr-8 py-1 border outline-none focus:border-[var(--theme-accent)] transition-colors"
                                  style={{
                                    backgroundColor: 'var(--theme-background, #121314)',
                                    borderColor: 'var(--theme-border, #242628)',
                                    color: 'var(--theme-text-primary, #e2e8f0)'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => toggleRevealKey(k.id)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors p-0.5 cursor-pointer"
                                  title={isRevealed ? "Hide key" : "Show key"}
                                >
                                  {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              </div>
                            </div>

                            {/* Custom Base URL Line (Optional) */}
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={k.baseUrl || ""}
                                onChange={(e) => handleUpdateApiKey(k.id, 'baseUrl', e.target.value)}
                                placeholder="Custom Base URL (optional, e.g. https://api.deepseek.com or http://localhost:1234/v1)"
                                spellCheck={false}
                                className="w-full text-[10.5px] font-mono rounded-lg px-2.5 py-1 border outline-none focus:border-[var(--theme-accent)] transition-colors text-[var(--theme-text-secondary)] placeholder:text-[var(--theme-text-muted)] placeholder:text-[10px]"
                                style={{
                                  backgroundColor: 'var(--theme-background, #121314)',
                                  borderColor: 'var(--theme-border, #242628)'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Local Models (Ollama) */}
                <div 
                  className="pt-3 border-t flex flex-col gap-2"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex items-center justify-between pb-1 border-b" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[11.5px] font-mono font-medium"
                          style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                        >
                          Local Models (Ollama)
                        </span>
                      </div>
                      <span 
                        className="text-[11px] font-sans leading-relaxed"
                        style={{ color: 'var(--theme-text-muted, #64748b)' }}
                      >
                        Run inference 100% offline on your local hardware. Automatically discovers and selects the best installed local model.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSetActiveApiKey('local-ollama')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors cursor-pointer border shrink-0 ${
                        activeApiKeyId === 'local-ollama'
                          ? 'font-semibold'
                          : 'hover:border-[var(--theme-accent)] hover:text-[var(--theme-text-bright)]'
                      }`}
                      style={{
                        backgroundColor: activeApiKeyId === 'local-ollama'
                          ? 'var(--theme-surface-active, #282a2d)'
                          : 'var(--theme-surface, #161719)',
                        borderColor: activeApiKeyId === 'local-ollama'
                          ? 'var(--theme-accent, #3b82f6)'
                          : 'var(--theme-border, #242628)',
                        color: activeApiKeyId === 'local-ollama'
                          ? 'var(--theme-text-bright, #ffffff)'
                          : 'var(--theme-text-muted, #64748b)'
                      }}
                    >
                      {activeApiKeyId === 'local-ollama' ? 'Active' : 'Set Active'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-[10.5px] font-mono text-[var(--theme-text-muted)]">
                    <span>Model Discovery</span>
                    <span className="text-[var(--theme-text-secondary)]">Automatic via http://127.0.0.1:11434/api/tags</span>
                  </div>
                </div>

                {/* 3. Autonomous Execution Guard */}
                <div 
                  className="pt-3 border-t flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Require Tool Execution Approval
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      When enabled, the agent pauses and asks for confirmation before executing terminal commands or modifying files.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.requireRefactorApproval ?? true} 
                    onChange={(val) => updateSetting('requireRefactorApproval', val)} 
                  />
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* 2. EDITOR SETTINGS                                            */}
            {/* ============================================================= */}
            {activeTab === 'editor' && (
              <>
                {/* Font Size */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Font Size
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Controls the font size in pixels for the Monaco code editor.
                    </span>
                  </div>
                  <MinimalNumberInput 
                    value={settings?.fontSize || 13} 
                    min={8} 
                    max={64} 
                    step={1}
                    onChange={(val) => updateSetting('fontSize', val)} 
                  />
                </div>

                {/* Tab Size */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Tab Size
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      The number of spaces a tab is equal to.
                    </span>
                  </div>
                  <MinimalSelect 
                    value={settings?.tabSize || 2} 
                    options={[
                      { value: 2, label: '2 Spaces' },
                      { value: 4, label: '4 Spaces' },
                      { value: 8, label: '8 Spaces' }
                    ]} 
                    onChange={(val) => updateSetting('tabSize', Number(val))} 
                  />
                </div>

                {/* Word Wrap */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Word Wrap
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Controls how lines should wrap in the code editor.
                    </span>
                  </div>
                  <MinimalSelect 
                    value={settings?.wordWrap || 'off'} 
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                      { value: 'bounded', label: 'Bounded' }
                    ]} 
                    onChange={(val) => updateSetting('wordWrap', val)} 
                  />
                </div>

                {/* Line Numbers */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Line Numbers
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Controls the display and format of line numbers in the gutter.
                    </span>
                  </div>
                  <MinimalSelect 
                    value={settings?.lineNumbers || 'on'} 
                    options={[
                      { value: 'on', label: 'On' },
                      { value: 'off', label: 'Off' },
                      { value: 'relative', label: 'Relative' }
                    ]} 
                    onChange={(val) => updateSetting('lineNumbers', val)} 
                  />
                </div>

                {/* Code Minimap */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Code Minimap
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Shows an overview minimap alongside code in the editor scrollbar.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.minimap ?? false} 
                    onChange={(val) => updateSetting('minimap', val)} 
                  />
                </div>

                {/* Format On Paste */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Format On Paste
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Automatically formats pasted code blocks according to syntax conventions.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.formatOnPaste ?? true} 
                    onChange={(val) => updateSetting('formatOnPaste', val)} 
                  />
                </div>
              </>
            )}

            {/* ============================================================= */}
            {/* 3. SPATIAL MAP SETTINGS                                       */}
            {/* ============================================================= */}
            {activeTab === 'spatial' && (
              <>
                {/* Global Circle (Node) Size */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Global Circle Size
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Global scale multiplier for all folder, file, and function circles on the spatial map.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialNodeScale ?? 1.0} 
                    min={0.05} 
                    max={10.0} 
                    step={0.05} 
                    onChange={(val) => updateSetting('spatialNodeScale', val)} 
                  />
                </div>

                {/* Global Connecting Line Size */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Global Connecting Line Size
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Global thickness multiplier for all hierarchy, call, and bridge connecting lines.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialLineScale ?? 1.0} 
                    min={0.05} 
                    max={10.0} 
                    step={0.05} 
                    onChange={(val) => updateSetting('spatialLineScale', val)} 
                  />
                </div>

                {/* Global Text (Label) Size */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Global Text Size
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Global font size multiplier for all node text labels in the spatial map.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialTextScale ?? 1.0} 
                    min={0.05} 
                    max={8.0} 
                    step={0.05} 
                    onChange={(val) => updateSetting('spatialTextScale', val)} 
                  />
                </div>

                {/* Animation Speed */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Animation Speed
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Global animation speed multiplier for node spawning, merge transitions, photons, and pulses.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialAnimationSpeed ?? 1.0} 
                    min={0.05} 
                    max={5.0} 
                    step={0.05} 
                    onChange={(val) => updateSetting('spatialAnimationSpeed', val)} 
                  />
                </div>

                {/* Selected Connection Line Thickness */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Selected Blue Line Thickness
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Stroke thickness for actively selected, hovered, and ray-traced celestial connection lines.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialSelectedLineWidth ?? 3.8} 
                    min={0.2} 
                    max={20.0} 
                    step={0.1} 
                    onChange={(val) => updateSetting('spatialSelectedLineWidth', val)} 
                  />
                </div>

                {/* Bridging Line Thickness */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Bridging Line Thickness
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Stroke thickness for cross-stack network bridge lines between frontend and backend architectures.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialBridgeLineWidth ?? 2.5} 
                    min={0.2} 
                    max={20.0} 
                    step={0.1} 
                    onChange={(val) => updateSetting('spatialBridgeLineWidth', val)} 
                  />
                </div>

                {/* Purple Call Line Thickness */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Purple Call Line Thickness
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Stroke thickness for purple function call and cross-file invocation dependency lines.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialPurpleLineWidth ?? 1.6} 
                    min={0.2} 
                    max={20.0} 
                    step={0.1} 
                    onChange={(val) => updateSetting('spatialPurpleLineWidth', val)} 
                  />
                </div>

                {/* Folder Names Visibility Distance */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Folder Names Visibility Distance
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom distance threshold where directory and module folder names become visible.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialFolderLabelZoom ?? 0.10} 
                    min={0.005} 
                    max={3.0} 
                    step={0.005} 
                    onChange={(val) => updateSetting('spatialFolderLabelZoom', val)} 
                  />
                </div>

                {/* File Names Visibility Distance */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      File Names Visibility Distance
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom distance threshold where source code file names become visible.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialFileLabelZoom ?? 0.25} 
                    min={0.01} 
                    max={4.0} 
                    step={0.01} 
                    onChange={(val) => updateSetting('spatialFileLabelZoom', val)} 
                  />
                </div>

                {/* Function Names Visibility Distance */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Function Names Visibility Distance
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom distance threshold where individual function and symbol names become visible.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialFuncLabelZoom ?? 0.55} 
                    min={0.01} 
                    max={5.0} 
                    step={0.01} 
                    onChange={(val) => updateSetting('spatialFuncLabelZoom', val)} 
                  />
                </div>

                {/* Merged Orb Repulsion & Spacing */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Merged Orb Repulsion & Spacing
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Controls how strongly enlarged and merged orbs repulse each other to prevent overlapping.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialMergeRepulsion ?? 1.5} 
                    min={0.05} 
                    max={15.0} 
                    step={0.05} 
                    onChange={(val) => updateSetting('spatialMergeRepulsion', val)} 
                  />
                </div>

                {/* LOD Transition Speed */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      LOD Merge / Divide Transition Speed
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Controls how fast circles snap through the procedural merge and division transition.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialTransitionSpeed ?? 0.28} 
                    min={0.01} 
                    max={2.0} 
                    step={0.01} 
                    onChange={(val) => updateSetting('spatialTransitionSpeed', val)} 
                  />
                </div>

                {/* LOD 1: Functions -> Files */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      LOD Level 1 (Functions ↔ Files Zoom)
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom threshold where function orbs merge into and divide from their parent file orbs.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialLod1Zoom ?? 0.35} 
                    min={0.01} 
                    max={3.0} 
                    step={0.01} 
                    onChange={(val) => updateSetting('spatialLod1Zoom', val)} 
                  />
                </div>

                {/* LOD 2: Files -> Folders */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      LOD Level 2 (Files ↔ Folders Zoom)
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom threshold where file orbs merge into and divide from their parent folder orbs.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialLod2Zoom ?? 0.22} 
                    min={0.005} 
                    max={2.0} 
                    step={0.005} 
                    onChange={(val) => updateSetting('spatialLod2Zoom', val)} 
                  />
                </div>

                {/* LOD 3: Subfolders -> Parent Folders */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      LOD Level 3 (Subfolders ↔ Root Folders Zoom)
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Camera zoom threshold where nested subfolders merge up into their parent/root folder orbs.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialLod3Zoom ?? 0.12} 
                    min={0.002} 
                    max={1.5} 
                    step={0.005} 
                    onChange={(val) => updateSetting('spatialLod3Zoom', val)} 
                  />
                </div>

                {/* LOD 4: Root Folders -> Core Hub */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      LOD Level 4 (Root Folders ↔ Core Hub Zoom)
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Farthest camera zoom threshold where top-level folders coalesce into the primary workspace core.
                    </span>
                  </div>
                  <MinimalSliderNumberInput 
                    value={settings?.spatialLod4Zoom ?? 0.05} 
                    min={0.001} 
                    max={1.0} 
                    step={0.002} 
                    onChange={(val) => updateSetting('spatialLod4Zoom', val)} 
                  />
                </div>

                {/* Spatial Minimap (Radar) */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Spatial Minimap (Radar)
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Displays a high-performance radar minimap card in the corner of the canvas.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.spatialMinimap ?? true} 
                    onChange={(val) => updateSetting('spatialMinimap', val)} 
                  />
                </div>

                {/* Show Node Labels */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Show Node Labels
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Renders file and function identifier labels above celestial nodes.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.showNodeLabels ?? true} 
                    onChange={(val) => updateSetting('showNodeLabels', val)} 
                  />
                </div>

                {/* Laser Bridge Photons */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Laser Bridge Photons
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Renders high-speed traveling photon energy packets across dependency bridges.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.spatialParticles ?? true} 
                    onChange={(val) => updateSetting('spatialParticles', val)} 
                  />
                </div>

                {/* Physics Simulation */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Physics Simulation
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Enables real-time WebGPU node repulsion, collision, and spring physics.
                    </span>
                  </div>
                  <MinimalToggle 
                    checked={settings?.physicsSimulation ?? true} 
                    onChange={(val) => updateSetting('physicsSimulation', val)} 
                  />
                </div>
              </>
            )}

            {/* ============================================================= */}
            {/* 4. APPEARANCE SETTINGS                                        */}
            {/* ============================================================= */}
            {activeTab === 'appearance' && (
              <>
                {/* Theme Preset Dropdown */}
                <div 
                  className="py-3 flex items-center justify-between gap-6"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex flex-col gap-0.5 max-w-[420px]">
                    <span 
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                    >
                      Theme Preset
                    </span>
                    <span 
                      className="text-[11px] font-sans leading-relaxed"
                      style={{ color: 'var(--theme-text-muted, #64748b)' }}
                    >
                      Select an active theme preset to view, live test, and tweak its color tokens.
                    </span>
                  </div>
                  <MinimalSelect 
                    value={selectedThemeId}
                    options={[
                      { value: 'black', label: 'Obsidian (Dark)' },
                      { value: 'white', label: 'Pure White (Light)' },
                      { value: 'pink', label: 'Sakura Rose (Pink)' },
                      { value: 'galaxy', label: 'Galaxy Dark Blue' },
                      { value: 'rosewater', label: 'Sakura Mist (Pink & White)' }
                    ]}
                    onChange={handleSelectTheme}
                  />
                </div>

                {/* Theme Actions Toolbar: Save, Reset Current, Reset All */}
                <div 
                  className="py-3 flex items-center justify-between gap-4 border-b"
                  style={{ borderColor: 'var(--theme-border, #242628)' }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTheme}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium text-white transition-opacity cursor-pointer shadow-sm hover:opacity-90 active:opacity-80"
                      style={{ backgroundColor: 'var(--theme-accent, #3b82f6)' }}
                    >
                      Save Theme Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreTheme}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: 'var(--theme-surface, #161719)',
                        borderColor: 'var(--theme-border, #242628)',
                        color: 'var(--theme-text-secondary, #94a3b8)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-surface-hover, #222426)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--theme-surface, #161719)'}
                      title="Restore selected theme to its default palette"
                    >
                      Restore to Default
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {saveStatus === 'saved' && (
                      <span className="text-[11px] font-mono text-emerald-400 animate-in fade-in duration-150">
                        Theme saved
                      </span>
                    )}
                    {saveStatus === 'restored' && (
                      <span className="text-[11px] font-mono text-cyan-400 animate-in fade-in duration-150">
                        Theme restored
                      </span>
                    )}
                    {saveStatus === 'restored_all' && (
                      <span className="text-[11px] font-mono text-cyan-400 animate-in fade-in duration-150">
                        All defaults restored
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRestoreAll}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-colors cursor-pointer border border-transparent hover:border-red-800/40 hover:bg-red-950/30 text-[var(--theme-text-muted)] hover:text-red-400"
                      title="Reset all themes to original defaults"
                    >
                      Restore All Defaults
                    </button>
                  </div>
                </div>

                {/* Individual Color Token Tweakers */}
                {THEME_COLOR_TOKENS.map(token => {
                  const hexVal = tokenEdits[token.key] || '#000000';
                  return (
                    <div 
                      key={token.key}
                      className="py-3 flex items-center justify-between gap-6"
                      style={{ borderColor: 'var(--theme-border, #242628)' }}
                    >
                      <div className="flex flex-col gap-0.5 max-w-[420px]">
                        <span 
                          className="text-[11.5px] font-mono font-medium"
                          style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                        >
                          {token.label}
                        </span>
                        <span 
                          className="text-[11px] font-sans leading-relaxed"
                          style={{ color: 'var(--theme-text-muted, #64748b)' }}
                        >
                          {token.desc}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Native color picker swatch */}
                        <div 
                          className="relative w-6 h-6 rounded-lg overflow-hidden border cursor-pointer shrink-0 shadow-sm transition-transform hover:scale-105"
                          style={{ borderColor: 'var(--theme-border, #242628)' }}
                          title="Click to pick color"
                        >
                          <input 
                            type="color" 
                            value={normalizeHex(hexVal)}
                            onChange={(e) => handleTokenChange(token.key, e.target.value)}
                            className="absolute -inset-2 w-12 h-12 cursor-pointer border-0 p-0 opacity-100"
                          />
                        </div>

                        {/* Hex text input */}
                        <input 
                          type="text" 
                          maxLength={7}
                          value={hexVal}
                          onChange={(e) => handleTokenChange(token.key, e.target.value)}
                          className="w-20 text-[11px] font-mono uppercase rounded-lg px-2 py-1 border outline-none text-center transition-colors focus:border-[var(--theme-accent)]"
                          style={{
                            backgroundColor: 'var(--theme-surface, #161719)',
                            borderColor: 'var(--theme-border, #242628)',
                            color: 'var(--theme-text-primary, #e2e8f0)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* ============================================================= */}
            {/* 5. REFERENCE SETTINGS (KEYBOARD SHORTCUTS)                    */}
            {/* ============================================================= */}
            {activeTab === 'reference' && (
              <div className="flex flex-col gap-6 py-2">
                {SHORTCUT_GROUPS.map((grp) => (
                  <div key={grp.group} className="flex flex-col">
                    <div 
                      className="pb-1.5 mb-1 border-b flex items-center justify-between" 
                      style={{ borderColor: 'var(--theme-border, #242628)' }}
                    >
                      <span 
                        className="text-[11px] font-mono font-semibold uppercase tracking-wider" 
                        style={{ color: 'var(--theme-accent, #3b82f6)' }}
                      >
                        {grp.group}
                      </span>
                      <span 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded leading-none" 
                        style={{ 
                          backgroundColor: 'var(--theme-surface-active, #222426)',
                          color: 'var(--theme-text-muted, #64748b)' 
                        }}
                      >
                        {grp.shortcuts.length} shortcuts
                      </span>
                    </div>

                    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--theme-border, #242628)' }}>
                      {grp.shortcuts.map((sc) => (
                        <div 
                          key={sc.label} 
                          className="py-2.5 flex items-center justify-between gap-4"
                          style={{ borderColor: 'var(--theme-border, #242628)' }}
                        >
                          <div className="flex flex-col gap-0.5 max-w-[420px]">
                            <span 
                              className="text-[11.5px] font-mono font-medium" 
                              style={{ color: 'var(--theme-text-primary, #cbd5e1)' }}
                            >
                              {sc.label}
                            </span>
                            <span 
                              className="text-[11px] font-sans leading-relaxed" 
                              style={{ color: 'var(--theme-text-muted, #64748b)' }}
                            >
                              {sc.desc}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {sc.keys.map((k, i) => (
                              <kbd
                                key={i}
                                className="px-2 py-0.5 rounded-md border text-[10.5px] font-mono font-medium shadow-xs"
                                style={{
                                  backgroundColor: 'var(--theme-surface, #161719)',
                                  borderColor: 'var(--theme-border, #242628)',
                                  color: 'var(--theme-text-bright, #ffffff)'
                                }}
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}