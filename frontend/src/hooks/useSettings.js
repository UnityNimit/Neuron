// src/hooks/useSettings.js
import { useState, useEffect } from 'react';

const defaultSettings = {
  // General
  autoSave: true,
  blastProtection: false,
  confirmDelete: true,

  // Editor
  fontSize: 13,
  tabSize: 2,
  wordWrap: 'off',
  lineNumbers: 'on',
  minimap: false,
  formatOnPaste: true,

  // Spatial Map
  spatialMinimap: true,
  showNodeLabels: true,
  spatialParticles: true,
  physicsSimulation: true,
  spatialAnimationSpeed: 1.0,
  spatialNodeScale: 1.0,
  spatialLineScale: 1.0,
  spatialTextScale: 1.0,
  spatialSelectedLineWidth: 3.8,
  spatialBridgeLineWidth: 2.5,
  spatialPurpleLineWidth: 1.6,
  spatialFolderLabelZoom: 0.10,
  spatialFileLabelZoom: 0.25,
  spatialFuncLabelZoom: 0.55,
  spatialMergeRepulsion: 1.5,
  spatialTransitionSpeed: 0.28,
  spatialLod1Zoom: 0.35,
  spatialLod2Zoom: 0.22,
  spatialLod3Zoom: 0.12,
  spatialLod4Zoom: 0.05,

  // AI & Multi-Key Provider Settings (Zero hardcoded models)
  apiKeys: [],                        // Array of { id, alias, key, detectedProvider?, detectedModel?, modelCount? }
  activeApiKeyId: 'local-ollama',     // Active API Key ID or 'local-ollama'
  requireRefactorApproval: true,
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('neuron-settings');
      if (saved && saved !== "undefined") {
        const parsed = JSON.parse(saved);
        const merged = { ...defaultSettings, ...parsed };

        if (!merged.apiKeys) {
          merged.apiKeys = [];
        }

        if (!merged.activeApiKeyId) {
          merged.activeApiKeyId = merged.apiKeys.length > 0 ? merged.apiKeys[0].id : 'local-ollama';
        }

        return merged;
      }
    } catch (e) {
      console.error("Failed to parse settings from localStorage:", e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail) {
        setSettings(e.detail);
      }
    };
    window.addEventListener('neuron-settings-sync', handleSync);
    return () => window.removeEventListener('neuron-settings-sync', handleSync);
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem('neuron-settings', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('neuron-settings-sync', { detail: next }));
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
      return next;
    });
  };

  return { settings, updateSetting };
}