// src/config/engineConfig.js

export const ENGINE_CONFIG = {
  // 🪐 THE WEBGPU PHYSICS ENGINE LAWS
  PHYSICS: {
    GRAVITY_PULL: 0.15,           // Strong Black Hole pull to keep the galaxy dense
    REPULSION: {
      folder: -9000,             // Massive Suns repel heavily to create space
      file: -7000,               // Planets repel moderately
      function: -5000             // Moons pack tightly
    },
    SPRING_DISTANCE: {
      moonOrbit: 70,             // Distance from Function to File
      planetOrbit: 100,          // Distance from File to Folder
      neuralCall: 200            // Distance between Cross-File Function Calls
    },
    SPRING_STRENGTH: {
      structural: 1.0,           // Hierarchy lines are rigid
      neural: 0.2                // Call lines are loose and stretchy
    },
    COLLISION_RADIUS: {
      folder: 45, file: 25, function: 15
    },
    ALPHA_DECAY: 0.01,           // How fast the galaxy settles down
    VELOCITY_DECAY: 0.5,         // Friction (prevents infinite jiggling)
    
    // --- NEW UNLEASHED TWEAKS ---
    SPAWN_SCATTER: 500,           // How wide nodes spawn initially (Prevents Big Bang explosions)
    MAX_REPULSION_DISTANCE: 1500, // Optimization: Nodes further than this ignore each other's gravity (Saves CPU)
    DRAG_KINETIC_HEAT: 0.02,      // How much the galaxy wobbles when dragging. (0.02 = Solid/Cold, 0.3 = Jelly)
    TAB_WAKEUP_HEAT: 0.0,         // Heat injected when returning to tab. (0.0 fixes the "swirling center" glitch!)
  },

  // 📷 THE LEVEL-OF-DETAIL (LOD) CAMERA BREAKPOINTS
  LOD: {
    Z_LEVELS: { L1: 0.3, L2: 0.8, L3: 1.5 },
    LABELS: { folder: 0.5, file: 0.7, function: 0.9 }
  },

  // 🎨 THE VISUAL THEME ENGINE
  THEME: {
    nodes: {
      folder: 'bg-[#e4ef61]',    
      file: 'bg-[#3b82f6]',      
      function: 'bg-[#8b5cf6]',  
    },
    sizes: {
      folder: { class: 'w-40 h-40', px: 60 },
      file: { class: 'w-23 h-23', px: 45 },
      function: { class: 'w-7 h-7', px: 35 }
    },
    edges: {
      hierarchy: '#b1b1b1',
      call: '#9f00ad',
      hierarchyGlow: '#60a5fa',
      callGlow: '#ff0000',
      opacityNormal: 0.4,
      opacityDimmed: 0.05,
      widthHierarchy: 11.0,       
      widthCall: 11.0,            
      widthHoverGlow: 15.0        
    },
    risk: {
      high: 'bg-[#ef4444]',      
      impact: 'bg-[#fb923c]'     
    },
    nebula: {
      blurRadius: 20,            
      padding: 80,               
      strokeWidth: 80,           
      fillOpacity: 0.4,         
      strokeOpacity: 0.2,        
      colors: [
        { fill: '#3b82f6', stroke: '#3b82f6' },
        { fill: '#a855f7', stroke: '#a855f7' },
        { fill: '#22c55e', stroke: '#22c55e' },
        { fill: '#ec4899', stroke: '#ec4899' },
        { fill: '#eab308', stroke: '#eab308' },
        { fill: '#f97316', stroke: '#f97316' },
      ]
    }
  }
};