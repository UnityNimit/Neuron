// src/hooks/useSettings.js
import { useState } from 'react';

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
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    // CRASH PROTECTION: Wrap in try/catch in case localStorage is corrupt
    try {
      const saved = localStorage.getItem('neuron-settings');
      if (saved && saved !== "undefined") {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to parse settings from localStorage:", e);
    }
    return defaultSettings;
  });

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem('neuron-settings', JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
      return next;
    });
  };

  return { settings, updateSetting };
}