// src/hooks/useSettings.js
import { useState, useEffect } from 'react';

const defaultSettings = {
  fontSize: 13,
  wordWrap: 'off',
  lineNumbers: 'on',
  minimap: false,
  formatOnPaste: true,
};

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('neuron-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('neuron-settings', JSON.stringify(next));
      return next;
    });
  };

  return { settings, updateSetting };
}