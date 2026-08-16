// src/config/engineConfig.js

export const ENGINE_CONFIG = {
  // 🪐 THE WEBGPU PHYSICS ENGINE LAWS
  PHYSICS: {
    GRAVITY_PULL: 0.025,         // Gentle centering (prevents black-hole crushing)
    REPULSION: {
      folder: -1800,             // Suns push outwards firmly
      file: -600,                // Planets space out cleanly
      function: -150             // Moons orbit smoothly without exploding
    },
    SPRING_DISTANCE: {
      moonOrbit: 45,             // Tight, clean functional orbits
      planetOrbit: 95,           // Space between files and directories
      neuralCall: 180            // Long cross-file call conduits
    },
    SPRING_STRENGTH: {
      structural: 0.9,           // Elastic spring tension
      neural: 0.15               // Flexible call pathways
    },
    COLLISION_RADIUS: {
      folder: 40, file: 22, function: 12
    },
    ALPHA_DECAY: 0.02,           // Smooth natural settling
    VELOCITY_DECAY: 0.45         // Fluid momentum with clean friction
  },

  // 📷 THE LEVEL-OF-DETAIL (LOD) CAMERA BREAKPOINTS
  LOD: {
    Z_LEVELS: { L1: 0.03, L2: 0.8, L3: 4.5 },
    LABELS: { folder: 0.15, file: 0.4, function: 0.7 }
  },

  // 🎨 THE VISUAL THEME ENGINE
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