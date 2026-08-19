// frontend/src/config/themeConfig.js

/**
 * 🌌 NEURON SPATIAL IDE - CENTRAL THEME CONFIGURATION
 * Edit these 3 core color constants to instantly restyle the entire IDE.
 */
export const THEME_PALETTE = {
  // -----------------------------------------------------------------------
  // 1. THE 3 CORE FOUNDATION COLORS
  // -----------------------------------------------------------------------
  primary: '#121212',      // TopBar only
  secondary: '#191a1b',    // StatusBar, ActivityBar, Sidebar, Terminal, Panels
  background: '#121314',   // Spatial WebGPU Canvas & Monaco Code Editor background

  // -----------------------------------------------------------------------
  // 2. UNIFIED ACCENT SYSTEM (Blue System)
  // -----------------------------------------------------------------------
  accent: {
    primary: '#3b82f6',        // Electric Blue Accent
    hover: '#60a5fa',          // Hover State
    glow: 'rgba(59,130,246,0.3)',
    activeGlow: 'rgba(59,130,246,0.8)',
    laserCyan: '#00f0ff',      // Full-Stack Protocol Bridges
    success: '#10b981',        // Green / Nominal
    warning: '#f59e0b',        // Amber / Medium Risk
    danger: '#ef4444',         // Red / High Risk / CSP Violation
  },

  // -----------------------------------------------------------------------
  // 3. BORDERS & STRUCTURAL DIVIDERS
  // -----------------------------------------------------------------------
  border: {
    base: '#242628',           // Subtle separator lines
    hover: '#343638',          // Interactive hover borders
    active: '#3b82f6',         // Focus / Selection borders
    glass: 'rgba(255,255,255,0.06)',
  },

  // -----------------------------------------------------------------------
  // 4. TYPOGRAPHY HIERARCHY
  // -----------------------------------------------------------------------
  text: {
    bright: '#f8fafc',
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#64748b',
    code: '#cbd5e1',
  }
};

/**
 * WebGL / PixiJS Direct Numeric Hex Integers (Zero String Parsing Overhead)
 */
export const THEME_WEBGL = {
  canvasBackground: 0x121314,
  primaryBar: 0x121212,
  secondaryBar: 0x191a1b,
  laserBridge: 0x00f0ff,
  activeRay: 0x60a5fa,
  folderOrb: 0x3b82f6,
  fileOrb: 0xeab308,
  functionOrb: 0xa855f7,
  highRiskOrb: 0xef4444,
};

/**
 * Utility helper to convert any Hex String into a WebGL numeric integer
 */
export const hexToWebGLNumber = (hexStr) => {
  if (typeof hexStr === 'number') return hexStr;
  if (!hexStr) return 0x121314;
  const clean = hexStr.replace('#', '0x').trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0x121314 : parsed;
};