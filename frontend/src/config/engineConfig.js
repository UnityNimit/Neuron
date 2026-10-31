// src/config/engineConfig.js

export const ENGINE_CONFIG = {
  // THE WEBGPU PHYSICS ENGINE LAWS
  PHYSICS: {
    GRAVITY_PULL: 0.008,         // Gentle centering (prevents black-hole crushing)
    REPULSION: {
      folder: -1800,             // Suns push outwards firmly
      file: -600,                // Planets space out cleanly
      function: -150             // Moons orbit smoothly without exploding
    },
    MAX_REPULSION_DISTANCE: 2600,// Max distance for many-body repulsion
    SPRING_DISTANCE: {
      moonOrbit: 45,             // Tight, clean functional orbits
      planetOrbit: 95,           // Space between files and directories
      neuralCall: 180,           // Long cross-file call conduits
      networkBridge: 216         // Cross-stack network conduits
    },
    SPRING_STRENGTH: {
      hierarchy: 0.95,           // Elastic hierarchy spring tension
      neural: 0.25,              // Flexible call pathways
      networkBridge: 0.35        // Cross-stack bridge tension
    },
    COLLISION_RADIUS: {
      folder: 40, file: 22, function: 12
    },
    COLLISION_PADDING: 10,       // Buffer padding around collision circles
    COLLISION_ITERATIONS: 2,     // Solver passes per tick
    ALPHA_DECAY: 0.012,          // Smooth natural settling
    VELOCITY_DECAY: 0.54,        // Fluid momentum with clean friction
    RESTING_ALPHA: 0.018,        // Continuous idle cosmic floating
    DRAGGING_ALPHA: 0.25,        // Responsive dragging alpha target
    SPAWN_SPEED: {
      file: 6.5,
      function: 3.5
    }
  },

  //  THE LEVEL-OF-DETAIL (LOD) CAMERA BREAKPOINTS
  LOD: {
    Z_LEVELS: { L1: 0.03, L2: 0.8, L3: 4.5 },
    LABELS: { folder: 0.15, file: 0.4, function: 0.7 }
  },

  //  THE VISUAL THEME ENGINE
  THEME: {
    nodes: {
      folder: 'bg-[#e4ef61]',    
      file: 'bg-[#3b82f6]',      
      function: 'bg-[#8b5cf6]',  
    },
    sizes: {
      folder: { class: 'w-20 h-20', px: 36 },
      file: { class: 'w-13 h-13', px: 18 },
      function: { class: 'w-7 h-7', px: 10 }
    },
    edges: {
      hierarchy: '#6d6d6d',
      call: '#9f00ad',
      hierarchyGlow: '#60a5fa',
      callGlow: '#ff0000',
      opacityNormal: 0.45,
      opacityDimmed: 0.05,
      widthHierarchy: 1.0,       
      widthCall: 1.5,            
      widthHoverGlow: 3.5        
    },
    risk: {
      high: 'bg-[#ef4444]',      
      impact: 'bg-[#fb923c]'     
    },
    nebula: {
      blurRadius: 35,            
      padding: 80,               
      strokeWidth: 80,           
      fillOpacity: 0.08,         
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