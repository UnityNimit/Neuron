// frontend/src/config/themeConfig.js
import { useState, useEffect, useCallback } from 'react';

/**
 * 🌌 NEURON SPATIAL IDE - CENTRAL THEME CONFIGURATION SYSTEM
 * Built-in themes and dynamic user-customizable color token architecture.
 */
export const DEFAULT_THEMES = {
  black: {
    id: 'black',
    name: 'Obsidian Black',
    isDark: true,
    // Foundation colors
    primary: '#121212',      // TopBar
    secondary: '#191a1b',    // StatusBar, ActivityBar, Sidebar, Terminal, Panels
    background: '#121314',   // Spatial Canvas & Monaco Code Editor background
    surface: '#161719',      // Cards, menus
    surfaceHover: '#222426', // Hover items
    surfaceActive: '#2a2c2e',// Active items
    border: '#242628',       // Subtle dividers
    borderSubtle: '#2e3032', // Menu borders
    borderHover: '#343638',  // Active hover borders
    // Typography
    textBright: '#f8fafc',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    // Accent & Folder
    accent: '#3b82f6',
    accentHover: '#60a5fa',
    folderIcon: '#dcb67a',
    // Theme Selector circle styling
    circleColor: '#121212',
    circleBorder: '#4b5563',
    // Monaco & WebGL
    monacoTheme: 'neuron-obsidian',
    webgl: {
      canvasBackground: 0x121314,
      primaryBar: 0x121212,
      secondaryBar: 0x191a1b,
      laserBridge: 0x00f0ff,
      activeRay: 0x60a5fa
    },
    // Scrollbars
    scrollbarTrack: '#0f0f0f',
    scrollbarThumb: '#262626',
    scrollbarThumbHover: '#3b82f6'
  },

  white: {
    id: 'white',
    name: 'Alabaster White',
    isDark: false,
    // Foundation colors
    primary: '#e8eaed',      // TopBar
    secondary: '#f1f3f4',    // StatusBar, ActivityBar, Sidebar, Terminal, Panels
    background: '#ffffff',   // Spatial Canvas & Monaco Code Editor background
    surface: '#ffffff',      // Cards, menus
    surfaceHover: '#e4e7eb', // Hover items
    surfaceActive: '#dadce0',// Active items
    border: '#dadce0',       // Subtle dividers
    borderSubtle: '#d0d4d9', // Menu borders
    borderHover: '#bcc1c7',  // Active hover borders
    // Typography
    textBright: '#111827',
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#6b7280',
    // Accent & Folder
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    folderIcon: '#b45309',
    // Theme Selector circle styling
    circleColor: '#ffffff',
    circleBorder: '#cbd5e1',
    // Monaco & WebGL
    monacoTheme: 'neuron-white',
    webgl: {
      canvasBackground: 0xffffff,
      primaryBar: 0xe8eaed,
      secondaryBar: 0xf1f3f4,
      laserBridge: 0x0284c7,
      activeRay: 0x2563eb
    },
    // Scrollbars
    scrollbarTrack: '#f1f3f4',
    scrollbarThumb: '#cbd5e1',
    scrollbarThumbHover: '#94a3b8'
  },

  pink: {
    id: 'pink',
    name: 'Sakura Rose',
    isDark: true,
    // Foundation colors
    primary: '#1e111a',      // TopBar
    secondary: '#271622',    // StatusBar, ActivityBar, Sidebar, Terminal, Panels
    background: '#180c14',   // Spatial Canvas & Monaco Code Editor background
    surface: '#2e1828',      // Cards, menus
    surfaceHover: '#381b31', // Hover items
    surfaceActive: '#47223e',// Active items
    border: '#3c1e33',       // Subtle dividers
    borderSubtle: '#4a253f', // Menu borders
    borderHover: '#5a2d4d',  // Active hover borders
    // Typography
    textBright: '#fff1f2',
    textPrimary: '#fce7f3',
    textSecondary: '#f472b6',
    textMuted: '#9d6a89',
    // Accent & Folder
    accent: '#ec4899',
    accentHover: '#f472b6',
    folderIcon: '#f472b6',
    // Theme Selector circle styling
    circleColor: '#f472b6',
    circleBorder: '#fb7185',
    // Monaco & WebGL
    monacoTheme: 'neuron-pink',
    webgl: {
      canvasBackground: 0x180c14,
      primaryBar: 0x1e111a,
      secondaryBar: 0x271622,
      laserBridge: 0xf472b6,
      activeRay: 0xfb7185
    },
    // Scrollbars
    scrollbarTrack: '#180c14',
    scrollbarThumb: '#3c1e33',
    scrollbarThumbHover: '#ec4899'
  },

  galaxy: {
    id: 'galaxy',
    name: 'Galaxy Dark Blue',
    isDark: true,
    // Foundation colors
    primary: '#090d16',      // TopBar deep space navy
    secondary: '#0e1422',    // Sidebars, status bar, activity bar, terminal
    background: '#080b12',   // Spatial Canvas & Monaco Editor deep space
    surface: '#121929',      // Cards, dropdown menus
    surfaceHover: '#1a243a', // Hover state
    surfaceActive: '#243252',// Active state
    border: '#1c2842',       // Subtle dividers
    borderSubtle: '#253556', // Menu borders
    borderHover: '#364d7d',  // Border hover
    // Typography
    textBright: '#f0f6fc',
    textPrimary: '#cbd5e1',
    textSecondary: '#8ba2c4',
    textMuted: '#506689',
    // Accent & Folder
    accent: '#38bdf8',       // Starlight Pulsar Cyan
    accentHover: '#60a5fa',
    folderIcon: '#38bdf8',
    // Theme Selector circle styling
    circleColor: '#0e172a',
    circleBorder: '#38bdf8',
    // Monaco & WebGL
    monacoTheme: 'neuron-galaxy',
    webgl: {
      canvasBackground: 0x080b12,
      primaryBar: 0x090d16,
      secondaryBar: 0x0e1422,
      laserBridge: 0x38bdf8,
      activeRay: 0x818cf8
    },
    // Scrollbars
    scrollbarTrack: '#080b12',
    scrollbarThumb: '#1c2842',
    scrollbarThumbHover: '#38bdf8'
  },

  rosewater: {
    id: 'rosewater',
    name: 'Sakura Mist (Pink & White)',
    isDark: false,
    // Foundation colors
    primary: '#fdf2f4',      // Soft blush rose top bar
    secondary: '#fff1f4',    // Panels, sidebars, terminal, status bar
    background: '#ffffff',   // Pure crisp white canvas & editor
    surface: '#ffffff',      // Cards, dropdown menus
    surfaceHover: '#fce7ec', // Soft blush hover
    surfaceActive: '#fad2df',// Blush rose active
    border: '#f4d3dc',       // Soft rose quartz border
    borderSubtle: '#eabecb', // Menu border
    borderHover: '#dc9fad',  // Hover border
    // Typography
    textBright: '#1e141a',   // Deep espresso rose, crisp readability
    textPrimary: '#36222e',   // Deep plum slate body text
    textSecondary: '#6b495d', // Medium rose slate
    textMuted: '#967285',   // Muted rose slate
    // Accent & Folder
    accent: '#db2777',       // Vibrant rose magenta
    accentHover: '#be185d',
    folderIcon: '#db2777',
    // Theme Selector circle styling
    circleColor: '#fce7ec',
    circleBorder: '#db2777',
    // Monaco & WebGL
    monacoTheme: 'neuron-rosewater',
    webgl: {
      canvasBackground: 0xffffff,
      primaryBar: 0xfdf2f4,
      secondaryBar: 0xfff1f4,
      laserBridge: 0xdb2777,
      activeRay: 0xf472b6
    },
    // Scrollbars
    scrollbarTrack: '#fff1f4',
    scrollbarThumb: '#f4d3dc',
    scrollbarThumbHover: '#db2777'
  }
};

/**
 * Loads custom theme token overrides from localStorage
 */
const getStoredCustomThemes = () => {
  try {
    const raw = localStorage.getItem('neuron_custom_themes');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
};

/**
 * Constructs the active THEMES map by merging user overrides onto DEFAULT_THEMES
 */
export const buildThemesMap = () => {
  const custom = getStoredCustomThemes();
  const merged = {};

  Object.keys(DEFAULT_THEMES).forEach(id => {
    const base = DEFAULT_THEMES[id];
    const overrides = custom[id] || {};
    merged[id] = {
      ...base,
      ...overrides,
      // Ensure webgl canvas background syncs if background is customized
      webgl: {
        ...base.webgl,
        ...(overrides.background ? { canvasBackground: hexToWebGLNumber(overrides.background) } : {}),
        ...(overrides.accent ? { laserBridge: hexToWebGLNumber(overrides.accent) } : {})
      }
    };
  });

  return merged;
};

export const THEMES = buildThemesMap();
export const DEFAULT_THEME_ID = 'black';

/**
 * Backward-compatible THEME_PALETTE referencing the default theme
 */
export const THEME_PALETTE = THEMES[DEFAULT_THEME_ID];

/**
 * WebGL / PixiJS Direct Numeric Hex Integers
 */
export const THEME_WEBGL = THEMES[DEFAULT_THEME_ID].webgl;

/**
 * Utility helper to convert any Hex String into a WebGL numeric integer
 */
export const hexToWebGLNumber = (hexStr) => {
  if (typeof hexStr === 'number') return hexStr;
  if (!hexStr) return 0x121314;
  const clean = String(hexStr).replace('#', '0x').trim();
  const parsed = parseInt(clean, 16);
  return isNaN(parsed) ? 0x121314 : parsed;
};

/**
 * Retrieves the currently active theme ID from localStorage
 */
export const getCurrentThemeId = () => {
  try {
    const saved = localStorage.getItem('neuron_theme');
    if (saved && THEMES[saved]) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_THEME_ID;
};

let activeMonacoInstance = null;

/**
 * Registers Monaco themes for all palettes
 */
export const registerMonacoThemes = (monaco) => {
  if (!monaco) return;
  activeMonacoInstance = monaco;

  // 1. Black / Obsidian
  monaco.editor.defineTheme('neuron-obsidian', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'e06c75', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: 'e06c75', fontStyle: 'bold' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'type.identifier', foreground: 'e5c07b' },
      { token: 'type.primitive', foreground: '56b6c2' },
      { token: 'class', foreground: 'e5c07b', fontStyle: 'bold' },
      { token: 'struct', foreground: 'e5c07b', fontStyle: 'bold' },
      { token: 'interface', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'method', foreground: '61afef' },
      { token: 'entity.name.function', foreground: '61afef' },
      { token: 'string', foreground: '98c379' },
      { token: 'string.escape', foreground: '56b6c2' },
      { token: 'character', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'constant', foreground: 'd19a66' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'variable.parameter', foreground: 'abb2bf' },
      { token: 'identifier', foreground: 'abb2bf' },
      { token: 'tag', foreground: 'e06c75' },
      { token: 'tag.attribute', foreground: 'd19a66' },
      { token: 'delimiter', foreground: 'abb2bf' },
      { token: 'delimiter.bracket', foreground: 'abb2bf' }
    ],
    colors: {
      'editor.background': '#121314',
      'editor.foreground': '#e2e8f0',
      'editor.lineHighlightBackground': '#181a1b',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#60a5fa',
      'editorGutter.background': '#121314',
      'editorIndentGuide.background': '#1e2227',
      'editorIndentGuide.activeBackground': '#3b82f680',
      'editorCursor.foreground': '#60a5fa',
      'editor.selectionBackground': '#264f7880',
      'editor.inactiveSelectionBackground': '#3a3d4140',
      'scrollbarSlider.background': '#26262660',
      'scrollbarSlider.hoverBackground': '#3b82f660',
      'scrollbarSlider.activeBackground': '#3b82f6a0',
      'minimap.background': '#121314'
    }
  });

  // 2. White / Alabaster
  monaco.editor.defineTheme('neuron-white', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'dc2626', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: 'dc2626', fontStyle: 'bold' },
      { token: 'type', foreground: 'b45309' },
      { token: 'type.identifier', foreground: 'b45309' },
      { token: 'type.primitive', foreground: '0891b2' },
      { token: 'class', foreground: 'b45309', fontStyle: 'bold' },
      { token: 'struct', foreground: 'b45309', fontStyle: 'bold' },
      { token: 'interface', foreground: 'b45309' },
      { token: 'function', foreground: '2563eb' },
      { token: 'method', foreground: '2563eb' },
      { token: 'entity.name.function', foreground: '2563eb' },
      { token: 'string', foreground: '15803d' },
      { token: 'string.escape', foreground: '0891b2' },
      { token: 'character', foreground: '15803d' },
      { token: 'number', foreground: 'd97706' },
      { token: 'constant', foreground: 'd97706' },
      { token: 'variable', foreground: 'dc2626' },
      { token: 'variable.parameter', foreground: '374151' },
      { token: 'identifier', foreground: '1f2937' },
      { token: 'tag', foreground: 'dc2626' },
      { token: 'tag.attribute', foreground: 'd97706' },
      { token: 'delimiter', foreground: '4b5563' },
      { token: 'delimiter.bracket', foreground: '4b5563' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1f2937',
      'editor.lineHighlightBackground': '#f3f4f6',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#9ca3af',
      'editorLineNumber.activeForeground': '#2563eb',
      'editorGutter.background': '#ffffff',
      'editorIndentGuide.background': '#e5e7eb',
      'editorIndentGuide.activeBackground': '#2563eb80',
      'editorCursor.foreground': '#2563eb',
      'editor.selectionBackground': '#bfdbfe80',
      'editor.inactiveSelectionBackground': '#e5e7eb80',
      'scrollbarSlider.background': '#cbd5e160',
      'scrollbarSlider.hoverBackground': '#2563eb60',
      'scrollbarSlider.activeBackground': '#2563eba0',
      'minimap.background': '#ffffff'
    }
  });

  // 3. Pink / Sakura Rose
  monaco.editor.defineTheme('neuron-pink', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9d6a89', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f472b6', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'fb7185', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: 'fb7185', fontStyle: 'bold' },
      { token: 'type', foreground: 'fcd34d' },
      { token: 'type.identifier', foreground: 'fcd34d' },
      { token: 'type.primitive', foreground: '38bdf8' },
      { token: 'class', foreground: 'fcd34d', fontStyle: 'bold' },
      { token: 'struct', foreground: 'fcd34d', fontStyle: 'bold' },
      { token: 'interface', foreground: 'fcd34d' },
      { token: 'function', foreground: 'ec4899' },
      { token: 'method', foreground: 'ec4899' },
      { token: 'entity.name.function', foreground: 'ec4899' },
      { token: 'string', foreground: 'a7f3d0' },
      { token: 'string.escape', foreground: '38bdf8' },
      { token: 'character', foreground: 'a7f3d0' },
      { token: 'number', foreground: 'fb923c' },
      { token: 'constant', foreground: 'fb923c' },
      { token: 'variable', foreground: 'fda4af' },
      { token: 'variable.parameter', foreground: 'fce7f3' },
      { token: 'identifier', foreground: 'fce7f3' },
      { token: 'tag', foreground: 'fb7185' },
      { token: 'tag.attribute', foreground: 'fb923c' },
      { token: 'delimiter', foreground: 'f472b6' },
      { token: 'delimiter.bracket', foreground: 'f472b6' }
    ],
    colors: {
      'editor.background': '#180c14',
      'editor.foreground': '#fce7f3',
      'editor.lineHighlightBackground': '#24131f',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#7c3f68',
      'editorLineNumber.activeForeground': '#ec4899',
      'editorGutter.background': '#180c14',
      'editorIndentGuide.background': '#33192c',
      'editorIndentGuide.activeBackground': '#ec489980',
      'editorCursor.foreground': '#ec4899',
      'editor.selectionBackground': '#ec489940',
      'editor.inactiveSelectionBackground': '#ec489920',
      'scrollbarSlider.background': '#3c1e3360',
      'scrollbarSlider.hoverBackground': '#ec489960',
      'scrollbarSlider.activeBackground': '#ec4899a0',
      'minimap.background': '#180c14'
    }
  });

  // 4. Galaxy Dark Blue
  monaco.editor.defineTheme('neuron-galaxy', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '506689', fontStyle: 'italic' },
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: '818cf8', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: '818cf8', fontStyle: 'bold' },
      { token: 'type', foreground: 'a5b4fc' },
      { token: 'type.identifier', foreground: 'a5b4fc' },
      { token: 'type.primitive', foreground: '38bdf8' },
      { token: 'class', foreground: 'c7d2fe', fontStyle: 'bold' },
      { token: 'struct', foreground: 'c7d2fe', fontStyle: 'bold' },
      { token: 'interface', foreground: 'c7d2fe' },
      { token: 'function', foreground: '60a5fa' },
      { token: 'method', foreground: '60a5fa' },
      { token: 'entity.name.function', foreground: '60a5fa' },
      { token: 'string', foreground: '34d399' },
      { token: 'string.escape', foreground: '38bdf8' },
      { token: 'character', foreground: '34d399' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'constant', foreground: 'fbbf24' },
      { token: 'variable', foreground: '93c5fd' },
      { token: 'variable.parameter', foreground: 'cbd5e1' },
      { token: 'identifier', foreground: 'cbd5e1' },
      { token: 'tag', foreground: '818cf8' },
      { token: 'tag.attribute', foreground: 'fbbf24' },
      { token: 'delimiter', foreground: '8ba2c4' },
      { token: 'delimiter.bracket', foreground: '8ba2c4' }
    ],
    colors: {
      'editor.background': THEMES.galaxy?.background || '#080b12',
      'editor.foreground': THEMES.galaxy?.textPrimary || '#cbd5e1',
      'editor.lineHighlightBackground': '#101624',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#38bdf8',
      'editorGutter.background': THEMES.galaxy?.background || '#080b12',
      'editorIndentGuide.background': '#162035',
      'editorIndentGuide.activeBackground': '#38bdf880',
      'editorCursor.foreground': '#38bdf8',
      'editor.selectionBackground': '#1e3a8a70',
      'editor.inactiveSelectionBackground': '#1e3a8a30',
      'scrollbarSlider.background': '#1c284260',
      'scrollbarSlider.hoverBackground': '#38bdf860',
      'scrollbarSlider.activeBackground': '#38bdf8a0',
      'minimap.background': THEMES.galaxy?.background || '#080b12'
    }
  });

  // 5. Sakura Mist (Pink & White Mix)
  monaco.editor.defineTheme('neuron-rosewater', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '967285', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'db2777', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'e11d48', fontStyle: 'bold' },
      { token: 'keyword.directive.include', foreground: 'e11d48', fontStyle: 'bold' },
      { token: 'type', foreground: '9333ea' },
      { token: 'type.identifier', foreground: '9333ea' },
      { token: 'type.primitive', foreground: '0284c7' },
      { token: 'class', foreground: '9333ea', fontStyle: 'bold' },
      { token: 'struct', foreground: '9333ea', fontStyle: 'bold' },
      { token: 'interface', foreground: '9333ea' },
      { token: 'function', foreground: '2563eb' },
      { token: 'method', foreground: '2563eb' },
      { token: 'entity.name.function', foreground: '2563eb' },
      { token: 'string', foreground: '059669' },
      { token: 'string.escape', foreground: '0284c7' },
      { token: 'character', foreground: '059669' },
      { token: 'number', foreground: 'd97706' },
      { token: 'constant', foreground: 'd97706' },
      { token: 'variable', foreground: 'be185d' },
      { token: 'variable.parameter', foreground: '36222e' },
      { token: 'identifier', foreground: '36222e' },
      { token: 'tag', foreground: 'db2777' },
      { token: 'tag.attribute', foreground: 'd97706' },
      { token: 'delimiter', foreground: '6b495d' },
      { token: 'delimiter.bracket', foreground: '6b495d' }
    ],
    colors: {
      'editor.background': THEMES.rosewater?.background || '#ffffff',
      'editor.foreground': THEMES.rosewater?.textPrimary || '#36222e',
      'editor.lineHighlightBackground': '#fff1f4',
      'editor.lineHighlightBorder': '#00000000',
      'editorLineNumber.foreground': '#d4a5b8',
      'editorLineNumber.activeForeground': '#db2777',
      'editorGutter.background': THEMES.rosewater?.background || '#ffffff',
      'editorIndentGuide.background': '#fce7ec',
      'editorIndentGuide.activeBackground': '#db277760',
      'editorCursor.foreground': '#db2777',
      'editor.selectionBackground': '#fbcfe880',
      'editor.inactiveSelectionBackground': '#fce7ec80',
      'scrollbarSlider.background': '#f4d3dc60',
      'scrollbarSlider.hoverBackground': '#db277760',
      'scrollbarSlider.activeBackground': '#db2777a0',
      'minimap.background': THEMES.rosewater?.background || '#ffffff'
    }
  });
};

/**
 * Applies a theme by setting CSS custom properties and notifying listeners
 */
export const applyTheme = (themeId) => {
  const currentThemes = buildThemesMap();
  const target = currentThemes[themeId] || currentThemes[DEFAULT_THEME_ID];
  const root = document.documentElement;

  // Foundation colors
  root.style.setProperty('--theme-primary', target.primary);
  root.style.setProperty('--theme-secondary', target.secondary);
  root.style.setProperty('--theme-background', target.background);
  root.style.setProperty('--theme-surface', target.surface);
  root.style.setProperty('--theme-surface-hover', target.surfaceHover);
  root.style.setProperty('--theme-surface-active', target.surfaceActive);
  root.style.setProperty('--theme-border', target.border);
  root.style.setProperty('--theme-border-subtle', target.borderSubtle);
  root.style.setProperty('--theme-border-hover', target.borderHover);

  // Typography
  root.style.setProperty('--theme-text-bright', target.textBright);
  root.style.setProperty('--theme-text-primary', target.textPrimary);
  root.style.setProperty('--theme-text-secondary', target.textSecondary);
  root.style.setProperty('--theme-text-muted', target.textMuted);

  // Accent & Folder
  root.style.setProperty('--theme-accent', target.accent);
  root.style.setProperty('--theme-accent-hover', target.accentHover);
  root.style.setProperty('--theme-folder-icon', target.folderIcon || target.accent);

  // Scrollbars
  root.style.setProperty('--theme-scrollbar-track', target.scrollbarTrack);
  root.style.setProperty('--theme-scrollbar-thumb', target.scrollbarThumb);
  root.style.setProperty('--theme-scrollbar-thumb-hover', target.scrollbarThumbHover);

  // Persist current theme ID
  try {
    localStorage.setItem('neuron_theme', target.id);
  } catch {
    // ignore
  }

  // Switch active monaco theme if initialized
  if (activeMonacoInstance && activeMonacoInstance.editor) {
    try {
      activeMonacoInstance.editor.setTheme(target.monacoTheme);
    } catch {
      // ignore
    }
  }

  // Broadcast event for canvas / non-DOM consumers
  window.dispatchEvent(new CustomEvent('neuron-theme-change', {
    detail: {
      themeId: target.id,
      theme: target
    }
  }));

  return target;
};

/**
 * Saves custom color token overrides for a specific theme
 */
export const saveThemeOverrides = (themeId, tokenOverrides) => {
  try {
    const custom = getStoredCustomThemes();
    custom[themeId] = {
      ...(custom[themeId] || {}),
      ...tokenOverrides
    };
    localStorage.setItem('neuron_custom_themes', JSON.stringify(custom));

    // Update in-memory THEMES reference
    const updated = buildThemesMap();
    Object.assign(THEMES, updated);

    // If this is the active theme, reapply
    if (getCurrentThemeId() === themeId) {
      applyTheme(themeId);
    } else {
      window.dispatchEvent(new CustomEvent('neuron-theme-change', {
        detail: { themeId, theme: THEMES[themeId] }
      }));
    }
    return true;
  } catch (err) {
    console.error('Failed to save theme overrides', err);
    return false;
  }
};

/**
 * Restores a specific theme back to its default built-in values
 */
export const restoreThemeDefaults = (themeId) => {
  try {
    const custom = getStoredCustomThemes();
    delete custom[themeId];
    localStorage.setItem('neuron_custom_themes', JSON.stringify(custom));

    // Reset in-memory THEMES reference
    const updated = buildThemesMap();
    Object.assign(THEMES, updated);

    if (getCurrentThemeId() === themeId) {
      applyTheme(themeId);
    } else {
      window.dispatchEvent(new CustomEvent('neuron-theme-change', {
        detail: { themeId, theme: THEMES[themeId] }
      }));
    }
    return true;
  } catch (err) {
    console.error('Failed to restore theme defaults', err);
    return false;
  }
};

/**
 * Restores all themes back to their default built-in values
 */
export const restoreAllThemesDefaults = () => {
  try {
    localStorage.removeItem('neuron_custom_themes');
    const updated = buildThemesMap();
    Object.assign(THEMES, updated);

    const activeId = getCurrentThemeId();
    applyTheme(activeId);
    return true;
  } catch (err) {
    console.error('Failed to restore all themes defaults', err);
    return false;
  }
};

/**
 * React hook to consume and react to theme changes
 */
export const useTheme = () => {
  const [currentThemeId, setCurrentThemeId] = useState(getCurrentThemeId);
  const [themesState, setThemesState] = useState(THEMES);

  useEffect(() => {
    // Ensure CSS properties are set on mount
    applyTheme(currentThemeId);

    const handleThemeChange = (e) => {
      if (e.detail?.themeId) {
        setCurrentThemeId(e.detail.themeId);
      }
      setThemesState({ ...THEMES });
    };

    window.addEventListener('neuron-theme-change', handleThemeChange);
    return () => window.removeEventListener('neuron-theme-change', handleThemeChange);
  }, [currentThemeId]);

  const setTheme = useCallback((id) => {
    if (THEMES[id]) {
      applyTheme(id);
      setCurrentThemeId(id);
    }
  }, []);

  const saveOverrides = useCallback((themeId, overrides) => {
    const success = saveThemeOverrides(themeId, overrides);
    if (success) {
      setThemesState({ ...THEMES });
    }
    return success;
  }, []);

  const restoreDefaults = useCallback((themeId) => {
    const success = restoreThemeDefaults(themeId);
    if (success) {
      setThemesState({ ...THEMES });
    }
    return success;
  }, []);

  const restoreAll = useCallback(() => {
    const success = restoreAllThemesDefaults();
    if (success) {
      setThemesState({ ...THEMES });
    }
    return success;
  }, []);

  return {
    currentThemeId,
    theme: themesState[currentThemeId] || themesState[DEFAULT_THEME_ID],
    setTheme,
    themes: themesState,
    defaultThemes: DEFAULT_THEMES,
    saveThemeOverrides: saveOverrides,
    restoreThemeDefaults: restoreDefaults,
    restoreAllThemesDefaults: restoreAll
  };
};