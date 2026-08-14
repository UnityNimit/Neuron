// src/hooks/usePersistentState.js
import { useState, useEffect } from 'react';

export function usePersistentState() {
  // 1. Persistent Panel Layout Toggles
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('neuron-layout-toggles');
      return saved ? JSON.parse(saved) : { sidebar: true, terminal: true, stdin: true };
    } catch {
      return { sidebar: true, terminal: true, stdin: true };
    }
  });

  // 2. Persistent Center View (Spatial vs Editor)
  const [centerView, setCenterView] = useState(() => {
    return localStorage.getItem('neuron-center-view') || 'spatial';
  });

  // 3. Persistent Standard Input (Test Cases)
  const [stdin, setStdin] = useState(() => {
    return localStorage.getItem('neuron-stdin') || "";
  });

  // Auto-save whenever these change
  useEffect(() => {
    localStorage.setItem('neuron-layout-toggles', JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    localStorage.setItem('neuron-center-view', centerView);
  }, [centerView]);

  useEffect(() => {
    localStorage.setItem('neuron-stdin', stdin);
  }, [stdin]);

  return { 
    layout, setLayout, 
    centerView, setCenterView, 
    stdin, setStdin 
  };
}