// engineConfig.js
export const ENGINE_CONFIG = {
  PHYSICS: {
    GRAVITY_PULL: 0.025,
    REPULSION: {
      folder: -1800,  // Sun nodes push outward
      file: -600,     // Planet nodes space cleanly
      function: -150  // Orbiting leaf nodes
    },
    SPRING_DISTANCE: {
      moonOrbit: 45,    // Distance: function -> file
      planetOrbit: 95,  // Distance: file -> folder
      neuralCall: 180   // Distance: cross-file function calls
    },
    SPRING_STRENGTH: {
      structural: 0.9,
      neural: 0.25
    },
    COLLISION_RADIUS: {
      folder: 40,
      file: 22,
      function: 12
    },
    ALPHA_DECAY: 0.02,
    VELOCITY_DECAY: 0.45
  },
  LOD: {
    LABELS: { folder: 0.15, file: 0.4, function: 0.7 }
  },
  THEME: {
    nodes: {
      folder: '#e4ef61',   // Neon yellow
      file: '#3b82f6',     // Azure blue
      function: '#8b5cf6', // Electric violet
    },
    sizes: {
      folder: { px: 36 },
      file: { px: 18 },
      function: { px: 10 }
    },
    edges: {
      hierarchy: '#334155',
      call: '#9f00ad',
      hierarchyGlow: '#60a5fa',
      callGlow: '#c084fc',
      opacityNormal: 0.45,
      opacityDimmed: 0.05,
      widthHierarchy: 1.0,
      widthCall: 1.5,
      widthHoverGlow: 3.5
    },
    nebula: {
      blurRadius: 35,
      padding: 80,
      fillOpacity: 0.08,
      strokeOpacity: 0.22,
      colors: [
        { fill: '#3b82f6', stroke: '#3b82f6' },
        { fill: '#a855f7', stroke: '#a855f7' },
        { fill: '#22c55e', stroke: '#22c55e' },
        { fill: '#ec4899', stroke: '#ec4899' },
        { fill: '#eab308', stroke: '#eab308' }
      ]
    }
  }
};
