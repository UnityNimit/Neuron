// src/config/engineConfig.js

export const ENGINE_CONFIG = {
  // 🪐 THE WEBGPU PHYSICS ENGINE LAWS
  PHYSICS: {
    GRAVITY_PULL: 0.1,           // Strong Black Hole pull to keep the galaxy dense
    REPULSION: {
      folder: -3000,             // Massive Suns repel heavily to create space
      file: -2000,               // Planets repel moderately
      function: -700             // Moons pack tightly
    },
    SPRING_DISTANCE: {
      moonOrbit: 70,             // Distance from Function to File
      planetOrbit: 100,          // Distance from File to Folder
      neuralCall: 200            // Distance between Cross-File Function Calls
    },
    SPRING_STRENGTH: {
      structural: 1.2,           // Hierarchy lines are rigid
      neural: 0.2                // Call lines are loose and stretchy
    },
    COLLISION_RADIUS: {
      folder: 45, file: 25, function: 15
    },
    ALPHA_DECAY: 0.01,           // How fast the galaxy settles down
    VELOCITY_DECAY: 0.5          // Friction (prevents infinite jiggling)
  },

  // 📷 THE LEVEL-OF-DETAIL (LOD) CAMERA BREAKPOINTS
  LOD: {
    Z_LEVELS: { L1: 0.3, L2: 0.8, L3: 1.5 },
    LABELS: { folder: 0.15, file: 0.4, function: 0.7 }
  },

  // 🎨 THE VISUAL THEME ENGINE (Custom Extreme Aesthetic)
  THEME: {
    nodes: {
      folder: 'bg-[#4b5563]',    // Matte Gray
      file: 'bg-[#3b82f6]',      // Electric Blue
      function: 'bg-[#8b5cf6]',  // Neural Purple
    },
    sizes: {
      folder: { class: 'w-20 h-20', px: 40 },
      file: { class: 'w-13 h-13', px: 20 },
      function: { class: 'w-7 h-7', px: 12 }
    },
    edges: {
      hierarchy: '#6d6d6d',
      call: '#8b5cf6',
      hierarchyGlow: '#60a5fa',
      callGlow: '#c084fc',
      opacityNormal: 1,          // Solid lines
      opacityDimmed: 0.05
    },
    risk: {
      high: 'bg-[#ef4444]',      // Radioactive Red
      impact: 'bg-[#fb923c]'     // Blast Radius Orange
    }
  }
};