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
  spatialLineScale: 2.5,
  spatialTextScale: 1.0,
  spatialSelectedLineWidth: 1.0,
  spatialBridgeLineWidth: 1.0,
  spatialPurpleLineWidth: 1.0,
  spatialFolderLabelZoom: 0.05,
  spatialFileLabelZoom: 0.25,
  spatialFuncLabelZoom: 1.2,
  spatialMergeRepulsion: 1.5,
  spatialTransitionSpeed: 0.28,
  spatialLod1Zoom: 0.35,
  spatialLod2Zoom: 0.07,
  spatialLod3Zoom: 0.03,
  spatialLod4Zoom: 0.001,
  _spatialSettingsVersion: 2,

  // Physics Simulation Laws
  physicsSimulation: true,
  physicsGravity: 0.008,
  physicsRepulsionFolder: -1800,
  physicsRepulsionFile: -600,
  physicsRepulsionFunction: -150,
  physicsMaxRepulsionDistance: 2600,
  physicsSpringMoonDistance: 45,
  physicsSpringPlanetDistance: 95,
  physicsSpringNeuralDistance: 180,
  physicsSpringBridgeDistance: 216,
  physicsSpringHierarchyStrength: 0.95,
  physicsSpringCallStrength: 0.25,
  physicsSpringBridgeStrength: 0.35,
  physicsCollisionFolder: 40,
  physicsCollisionFile: 22,
  physicsCollisionFunction: 12,
  physicsCollisionPadding: 10,
  physicsCollisionIterations: 2,
  physicsAlphaDecay: 0.012,
  physicsVelocityDecay: 0.54,
  physicsRestingAlpha: 0.018,
  physicsDraggingAlpha: 0.25,
  physicsSpawnFileSpeed: 6.5,
  physicsSpawnFuncSpeed: 3.5,

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

        // Ensure any missing physics settings default gracefully
        const physicsKeys = [
          'physicsSimulation', 'physicsGravity', 'physicsRepulsionFolder', 'physicsRepulsionFile',
          'physicsRepulsionFunction', 'physicsMaxRepulsionDistance', 'physicsSpringMoonDistance',
          'physicsSpringPlanetDistance', 'physicsSpringNeuralDistance', 'physicsSpringBridgeDistance',
          'physicsSpringHierarchyStrength', 'physicsSpringCallStrength', 'physicsSpringBridgeStrength',
          'physicsCollisionFolder', 'physicsCollisionFile', 'physicsCollisionFunction',
          'physicsCollisionPadding', 'physicsCollisionIterations', 'physicsAlphaDecay',
          'physicsVelocityDecay', 'physicsRestingAlpha', 'physicsDraggingAlpha',
          'physicsSpawnFileSpeed', 'physicsSpawnFuncSpeed'
        ];
        let hasMissingPhysics = false;
        physicsKeys.forEach(k => {
          if (merged[k] === undefined) {
            merged[k] = defaultSettings[k];
            hasMissingPhysics = true;
          }
        });
        if (hasMissingPhysics) {
          try {
            localStorage.setItem('neuron-settings', JSON.stringify(merged));
          } catch {}
        }

        // Migrate spatial defaults if on old version to ensure new defaults apply smoothly
        if (parsed._spatialSettingsVersion !== 2) {
          if (parsed.spatialLineScale === 1.0 || parsed.spatialLineScale === undefined) merged.spatialLineScale = 2.5;
          if (parsed.spatialSelectedLineWidth === 3.8 || parsed.spatialSelectedLineWidth === undefined) merged.spatialSelectedLineWidth = 1.0;
          if (parsed.spatialBridgeLineWidth === 2.5 || parsed.spatialBridgeLineWidth === undefined) merged.spatialBridgeLineWidth = 1.0;
          if (parsed.spatialPurpleLineWidth === 1.6 || parsed.spatialPurpleLineWidth === undefined) merged.spatialPurpleLineWidth = 1.0;
          if (parsed.spatialFolderLabelZoom === 0.10 || parsed.spatialFolderLabelZoom === undefined) merged.spatialFolderLabelZoom = 0.05;
          if (parsed.spatialFileLabelZoom === undefined) merged.spatialFileLabelZoom = 0.25;
          if (parsed.spatialFuncLabelZoom === 0.55 || parsed.spatialFuncLabelZoom === undefined) merged.spatialFuncLabelZoom = 1.2;
          if (parsed.spatialLod1Zoom === undefined) merged.spatialLod1Zoom = 0.35;
          if (parsed.spatialLod2Zoom === 0.22 || parsed.spatialLod2Zoom === undefined) merged.spatialLod2Zoom = 0.07;
          if (parsed.spatialLod3Zoom === 0.12 || parsed.spatialLod3Zoom === undefined) merged.spatialLod3Zoom = 0.03;
          if (parsed.spatialLod4Zoom === 0.05 || parsed.spatialLod4Zoom === undefined) merged.spatialLod4Zoom = 0.001;
          merged._spatialSettingsVersion = 2;
          try {
            localStorage.setItem('neuron-settings', JSON.stringify(merged));
          } catch {}
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
        setSettings((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(e.detail)) return prev;
          return e.detail;
        });
      }
    };
    window.addEventListener('neuron-settings-sync', handleSync);
    return () => window.removeEventListener('neuron-settings-sync', handleSync);
  }, []);

  const updateSetting = (key, value) => {
    setSettings((prev) => {
      const updates = typeof key === 'object' && key !== null ? key : { [key]: value };
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('neuron-settings', JSON.stringify(next));
        queueMicrotask(() => {
          try {
            const latestRaw = localStorage.getItem('neuron-settings');
            if (latestRaw) {
              const latest = JSON.parse(latestRaw);
              window.dispatchEvent(new CustomEvent('neuron-settings-sync', { detail: latest }));
            }
          } catch {}
        });
      } catch (e) {
        console.error("Failed to save settings:", e);
      }
      return next;
    });
  };

  return { settings, updateSetting };
}