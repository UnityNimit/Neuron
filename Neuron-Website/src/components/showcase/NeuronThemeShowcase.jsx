import { useState, useEffect, useRef } from 'react';
import { 
  Files, GitBranch, Sparkles, Settings, 
  Folder, FileCode2, ChevronDown, Minus, Square, X, Bell
} from 'lucide-react';
import { ScrollWriteHeading } from '../ScrollReveal';

// The 5 official themes directly from frontend/src/config/themeConfig.js
const THEMES = [
  {
    id: 'black',
    name: 'Obsidian Black',
    circleColor: '#121212',
    circleBorder: '#4b5563',
    primary: '#121212',
    secondary: '#191a1b',
    background: '#121314',
    border: '#242628',
    accent: '#3b82f6',
    text: '#e2e8f0',
    textMuted: '#64748b',
    folderColor: '#dcb67a',
    isDark: true
  },
  {
    id: 'white',
    name: 'Alabaster White',
    circleColor: '#ffffff',
    circleBorder: '#cbd5e1',
    primary: '#e8eaed',
    secondary: '#f1f3f4',
    background: '#ffffff',
    border: '#dadce0',
    accent: '#2563eb',
    text: '#1f2937',
    textMuted: '#6b7280',
    folderColor: '#b45309',
    isDark: false
  },
  {
    id: 'pink',
    name: 'Sakura Rose',
    circleColor: '#f472b6',
    circleBorder: '#fb7185',
    primary: '#1e111a',
    secondary: '#271622',
    background: '#180c14',
    border: '#3c1e33',
    accent: '#ec4899',
    text: '#fce7f3',
    textMuted: '#9d6a89',
    folderColor: '#f472b6',
    isDark: true
  },
  {
    id: 'galaxy',
    name: 'Galaxy Dark Blue',
    circleColor: '#0e172a',
    circleBorder: '#38bdf8',
    primary: '#090d16',
    secondary: '#0e1422',
    background: '#080b12',
    border: '#1c2842',
    accent: '#38bdf8',
    text: '#cbd5e1',
    textMuted: '#506689',
    folderColor: '#38bdf8',
    isDark: true
  },
  {
    id: 'rosewater',
    name: 'Sakura Mist',
    circleColor: '#fce7ec',
    circleBorder: '#db2777',
    primary: '#fdf2f4',
    secondary: '#fff1f4',
    background: '#ffffff',
    border: '#f4d3dc',
    accent: '#db2777',
    text: '#36222e',
    textMuted: '#967285',
    folderColor: '#db2777',
    isDark: false
  }
];

// File row with theme-aware hover color (never disappears in light pink or dark themes)
function ShowcaseFileItem({ activeTheme, iconColor, name }) {
  const [hovered, setHovered] = useState(false);
  const hoverColor = activeTheme.isDark ? '#ffffff' : activeTheme.accent;

  return (
    <div 
      className="flex items-center gap-1.5 transition-colors cursor-pointer select-none"
      style={{ color: hovered ? hoverColor : activeTheme.textMuted }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FileCode2 size={12} className={iconColor} />
      <span>{name}</span>
    </div>
  );
}

// Activity bar icon with theme-aware hover
function ShowcaseActivityIcon({ activeTheme, icon: Icon, size = 16 }) {
  const [hovered, setHovered] = useState(false);
  const hoverColor = activeTheme.isDark ? '#ffffff' : activeTheme.accent;

  return (
    <div 
      className="p-1 transition-colors cursor-pointer"
      style={{ 
        color: hovered ? hoverColor : activeTheme.textMuted,
        opacity: hovered ? 1 : 0.7 
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={size} />
    </div>
  );
}

export default function NeuronThemeShowcase() {
  const [activeThemeIndex, setActiveThemeIndex] = useState(0); // Starts on Sakura Rose matching screenshot
  const [userInterrupted, setUserInterrupted] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (userInterrupted) return;

    timerRef.current = setInterval(() => {
      setActiveThemeIndex(prev => (prev + 1) % THEMES.length);
    }, 3800);

    return () => clearInterval(timerRef.current);
  }, [userInterrupted]);

  const activeTheme = THEMES[activeThemeIndex];

  const handleSelectTheme = (index) => {
    setUserInterrupted(true);
    setActiveThemeIndex(index);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <section className="mb-24 sm:mb-28 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Authentic IDE Frame Replicating media_1789740052941.png      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 order-2 lg:order-1">
          <div 
            className="rounded-2xl border transition-all duration-700 shadow-2xl relative overflow-hidden flex flex-col font-sans select-none"
            style={{ 
              backgroundColor: activeTheme.background,
              borderColor: activeTheme.border,
              boxShadow: `0 25px 60px -15px ${activeTheme.isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.12)'}`
            }}
          >
            {/* TopBar matching TopBar.jsx */}
            <div 
              className="h-9 border-b flex items-center justify-between px-3 text-[11px] font-mono shrink-0 select-none transition-colors duration-700"
              style={{
                backgroundColor: activeTheme.primary,
                borderColor: activeTheme.border,
                color: activeTheme.textMuted
              }}
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: activeTheme.accent }} 
                  title="Neuron IDE"
                />
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="font-semibold text-[11px]" style={{ color: activeTheme.text }}>Neuron</span>
                  <span className="opacity-30">|</span>
                  <span className="cursor-pointer transition-colors hover:opacity-100" style={{ color: activeTheme.textMuted }}>File</span>
                  <span className="cursor-pointer transition-colors hover:opacity-100" style={{ color: activeTheme.textMuted }}>Edit</span>
                  <span className="cursor-pointer transition-colors hover:opacity-100" style={{ color: activeTheme.textMuted }}>Layout</span>
                  <span className="cursor-pointer transition-colors hover:opacity-100" style={{ color: activeTheme.textMuted }}>Help</span>
                </div>
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-2" style={{ color: activeTheme.textMuted }}>
                <Minus size={11} className="cursor-pointer hover:opacity-100" />
                <Square size={10} className="cursor-pointer hover:opacity-100" />
                <X size={12} className="cursor-pointer hover:opacity-100" />
              </div>
            </div>

            {/* Main Area: ActivityBar + Explorer + Center Code Viewport */}
            <div className="flex flex-1 min-h-[380px] sm:min-h-[420px] relative">
              
              {/* Left ActivityBar */}
              <div 
                className="w-11 border-r flex flex-col justify-between py-3 items-center shrink-0 transition-colors duration-700"
                style={{ 
                  backgroundColor: activeTheme.secondary,
                  borderColor: activeTheme.border 
                }}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="p-1 rounded" style={{ color: activeTheme.accent }}>
                    <Files size={16} />
                  </div>
                  <ShowcaseActivityIcon activeTheme={activeTheme} icon={GitBranch} size={16} />
                  <ShowcaseActivityIcon activeTheme={activeTheme} icon={Sparkles} size={16} />
                </div>

                <div className="flex flex-col items-center gap-3 relative">
                  <ShowcaseActivityIcon activeTheme={activeTheme} icon={Settings} size={15} />

                  {/* Avatar S */}
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: activeTheme.accent }}
                  >
                    S
                  </div>
                </div>
              </div>

              {/* Explorer Sidebar with Single Theme Pill (Always visible) */}
              <div 
                className="w-40 sm:w-48 border-r flex flex-col justify-between p-2.5 font-mono text-[11px] transition-colors duration-700 shrink-0 flex"
                style={{ 
                  backgroundColor: activeTheme.secondary,
                  borderColor: activeTheme.border,
                  color: activeTheme.text 
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-sans uppercase tracking-wider pb-1" style={{ color: activeTheme.textMuted }}>
                    <span>Explorer</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: activeTheme.text }}>
                    <ChevronDown size={12} />
                    <span>NEURON</span>
                  </div>

                  {/* Folder: backend */}
                  <div className="pl-2.5 pt-1 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium" style={{ color: activeTheme.folderColor }}>
                      <Folder size={13} style={{ color: activeTheme.folderColor }} />
                      <span>backend</span>
                    </div>
                    <div className="pl-4 space-y-1" style={{ color: activeTheme.textMuted }}>
                      <ShowcaseFileItem activeTheme={activeTheme} iconColor="text-[#ef4444]" name="parser.py" />
                      <ShowcaseFileItem activeTheme={activeTheme} iconColor="text-[#f97316]" name="server.py" />
                    </div>
                  </div>

                  {/* Folder: frontend */}
                  <div className="pl-2.5 pt-1 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium" style={{ color: activeTheme.folderColor }}>
                      <Folder size={13} style={{ color: activeTheme.folderColor }} />
                      <span>frontend</span>
                    </div>
                    <div className="pl-4 space-y-1" style={{ color: activeTheme.textMuted }}>
                      <ShowcaseFileItem activeTheme={activeTheme} iconColor="text-[#ef4444]" name="App.jsx" />
                      <ShowcaseFileItem activeTheme={activeTheme} iconColor="text-[#f97316]" name="usePhysicsEngine.js" />
                    </div>
                  </div>
                </div>

                {/* FLOATING THEME PILL */}
                <div 
                  className="p-1.5 rounded-full border flex items-center justify-between gap-1 shadow-2xl backdrop-blur-md transition-all duration-500 mt-2"
                  style={{
                    backgroundColor: activeTheme.primary,
                    borderColor: activeTheme.border
                  }}
                >
                  {THEMES.map((th, idx) => {
                    const isActive = activeThemeIndex === idx;
                    return (
                      <button
                        key={th.id}
                        onClick={() => handleSelectTheme(idx)}
                        className={`w-5 h-5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center relative ${
                          isActive ? 'scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: th.circleColor,
                          border: `1.5px solid ${th.circleBorder}`
                        }}
                        title={th.name}
                      >
                        {isActive && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: th.accent }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center Canvas Viewport */}
              <div 
                className="flex-1 flex flex-col justify-between relative overflow-hidden transition-colors duration-700"
                style={{ backgroundColor: activeTheme.background }}
              >
                {/* Document Tabs */}
                <div 
                  className="h-8 border-b flex items-center justify-between px-3 text-[11px] font-mono transition-colors duration-700"
                  style={{ 
                    backgroundColor: activeTheme.primary,
                    borderColor: activeTheme.border 
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="px-2.5 py-1 rounded-t border-b-2 flex items-center gap-1.5 font-medium"
                      style={{ 
                        color: activeTheme.accent,
                        borderColor: activeTheme.accent,
                        backgroundColor: activeTheme.background
                      }}
                    >
                      <FileCode2 size={12} />
                      <span>App.jsx</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: activeTheme.textMuted }}>
                    <span>UTF-8</span>
                    <span>JavaScript (React)</span>
                  </div>
                </div>

                {/* THEME-ADAPTIVE CODE EDITOR VIEWPORT */}
                <div 
                  className="flex-1 p-4 font-mono text-xs leading-relaxed overflow-hidden select-none flex flex-col justify-start transition-colors duration-700"
                  style={{ backgroundColor: activeTheme.background }}
                >
                  <pre className="whitespace-pre overflow-hidden space-y-0.5">
                    {[
                      { num: 1, text: "import React, { useEffect, useRef } from 'react';", type: 'import' },
                      { num: 2, text: "import { useSpatialEngine } from './hooks/useSpatialEngine';", type: 'import' },
                      { num: 3, text: "import { LouvainCommunityDetector } from './ml/analyzer';", type: 'import' },
                      { num: 4, text: "", type: 'empty' },
                      { num: 5, text: "export default function SpatialCanvas({ codebasePath }) {", type: 'decl' },
                      { num: 6, text: "  const canvasRef = useRef(null);", type: 'hook' },
                      { num: 7, text: "  const { nodes, conduits, relaxation } = useSpatialEngine(codebasePath);", type: 'hook' },
                      { num: 8, text: "", type: 'empty' },
                      { num: 9, text: "  useEffect(() => {", type: 'hook' },
                      { num: 10, text: "    // 60 FPS WebGPU spatial force relaxation loop", type: 'comment' },
                      { num: 11, text: "    const detector = new LouvainCommunityDetector({ modularityThreshold: 0.84 });", type: 'code' },
                      { num: 12, text: "    const clusters = detector.partition(nodes, conduits);", type: 'code' },
                      { num: 13, text: "    relaxation.stabilize(clusters);", type: 'code' },
                      { num: 14, text: "  }, [codebasePath]);", type: 'close' },
                      { num: 15, text: "", type: 'empty' },
                      { num: 16, text: "  return <canvas ref={canvasRef} className=\"spatial-canvas\" />;", type: 'return' },
                      { num: 17, text: "}", type: 'close' }
                    ].map((line) => {
                      if (line.type === 'empty') {
                        return (
                          <div key={line.num} className="flex leading-5">
                            <span className="w-6 select-none text-right mr-4 shrink-0 text-[11px] opacity-40" style={{ color: activeTheme.textMuted }}>{line.num}</span>
                            <span>&nbsp;</span>
                          </div>
                        );
                      }
                      if (line.type === 'comment') {
                        return (
                          <div key={line.num} className="flex leading-5">
                            <span className="w-6 select-none text-right mr-4 shrink-0 text-[11px] opacity-40" style={{ color: activeTheme.textMuted }}>{line.num}</span>
                            <span className="italic opacity-60" style={{ color: activeTheme.textMuted }}>{line.text}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={line.num} className="flex leading-5 truncate">
                          <span className="w-6 select-none text-right mr-4 shrink-0 text-[11px] opacity-40" style={{ color: activeTheme.textMuted }}>{line.num}</span>
                          <span style={{ color: activeTheme.text }}>
                            {line.text.split(/('.*?'|".*?"|\bimport\b|\bfrom\b|\bexport\b|\bdefault\b|\bfunction\b|\bconst\b|\bnew\b|\breturn\b)/g).map((token, idx) => {
                              if (!token) return null;
                              if (['import', 'from', 'export', 'default', 'function', 'const', 'new', 'return'].includes(token)) {
                                return (
                                  <span key={idx} className="font-semibold" style={{ color: activeTheme.accent }}>
                                    {token}
                                  </span>
                                );
                              }
                              if (token.startsWith("'") || token.startsWith('"')) {
                                return (
                                  <span key={idx} style={{ color: activeTheme.isDark ? '#34d399' : '#059669' }}>
                                    {token}
                                  </span>
                                );
                              }
                              if (token.includes('useRef') || token.includes('useEffect') || token.includes('useSpatialEngine')) {
                                return (
                                  <span key={idx} style={{ color: activeTheme.isDark ? '#38bdf8' : '#2563eb' }}>
                                    {token}
                                  </span>
                                );
                              }
                              if (token.includes('SpatialCanvas') || token.includes('LouvainCommunityDetector')) {
                                return (
                                  <span key={idx} style={{ color: activeTheme.isDark ? '#fcd34d' : '#b45309' }}>
                                    {token}
                                  </span>
                                );
                              }
                              return <span key={idx}>{token}</span>;
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </pre>
                </div>

                {/* Terminal Panel */}
                <div 
                  className="border-t p-2 text-[10px] font-mono transition-colors duration-700 flex flex-col gap-1"
                  style={{ 
                    backgroundColor: activeTheme.secondary,
                    borderColor: activeTheme.border,
                    color: activeTheme.text 
                  }}
                >
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" style={{ color: activeTheme.accent }}>Output</span>
                      <span className="opacity-60 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> PowerShell 1
                      </span>
                    </div>
                  </div>
                  <div className="truncate text-[10px] leading-tight" style={{ color: activeTheme.textMuted }}>
                    Ready
                  </div>
                </div>

              </div>

            </div>

            {/* StatusBar matching StatusBar.jsx */}
            <div 
              className="h-6 border-t flex items-center justify-between px-3 text-[10px] font-mono shrink-0 select-none transition-colors duration-700"
              style={{
                backgroundColor: activeTheme.secondary,
                borderColor: activeTheme.border,
                color: activeTheme.textMuted
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: activeTheme.accent }}>3 bridges</span>
                <span className="opacity-40">·</span>
                <span>42 nodes</span>
                <span className="opacity-40">·</span>
                <span className="text-emerald-500">0 errors</span>
              </div>
              <div className="flex items-center gap-2">
                <span>main*</span>
                <span className="opacity-40">·</span>
                <span>UTF-8</span>
                <span className="opacity-40">·</span>
                <span style={{ color: activeTheme.accent }}>Neuron v1.0.0</span>
                <span className="opacity-40">·</span>
                <Bell size={10} />
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Simple theme presentation */}
        <div className="lg:col-span-5 order-1 lg:order-2 text-left flex flex-col justify-center">
          <ScrollWriteHeading
            text="Customizable themes"
            as="h2"
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2 leading-snug"
          />
        </div>

      </div>
    </section>
  );
}
