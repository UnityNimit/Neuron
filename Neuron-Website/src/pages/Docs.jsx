// src/pages/Docs.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Terminal, Cpu, Network, Zap, 
  ChevronRight, Search, Menu, X, Box, Code2
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel';

// Documentation Modules
import GettingStarted from './docs/GettingStarted';
import Architecture from './docs/Architecture';
import MachineLearning from './docs/MachineLearning';
import Reference from './docs/Reference';

// --- NAVIGATION SCHEMA ---
const DOCS_NAVIGATION = [
  {
    category: "Getting Started",
    items: [
      { id: "intro", label: "Introduction", icon: BookOpen },
      { id: "install", label: "Installation & Setup", icon: Terminal },
      { id: "quickstart", label: "Quickstart Guide", icon: Zap },
    ]
  },
  {
    category: "Core Architecture",
    items: [
      { id: "spatial-engine", label: "Spatial Rendering Engine", icon: Box },
      { id: "physics", label: "D3 Physics & Gravity", icon: Network },
      { id: "ast-parser", label: "AST Multi-Modal Parser", icon: Code2 },
    ]
  },
  {
    category: "Machine Learning",
    items: [
      { id: "ml-overview", label: "AI & ML Overview", icon: Cpu },
      { id: "louvain", label: "Louvain Community Nebulas", icon: Network },
      { id: "risk-model", label: "Random Forest Risk Heuristics", icon: Zap },
      { id: "llm-peel", label: "Local LLM Semantic Peel", icon: BookOpen },
    ]
  },
  {
    category: "Reference",
    items: [
      { id: "shortcuts", label: "Keyboard Shortcuts", icon: Terminal },
      { id: "terminal-cli", label: "Terminal & CLI Guide", icon: Code2 },
    ]
  }
];

// --- DYNAMIC TABLE OF CONTENTS MAPPER ---
const getTableOfContents = (pageId) => {
  const tocMap = {
    'intro': ['Core Philosophy', 'Dual-Engine Architecture'],
    'install': ['System Prerequisites', 'Python AI Daemon', 'WebGPU Client'],
    'quickstart': ['Navigating the Map', 'AI Code Analysis', 'Code Execution'],
    'spatial-engine': ['Bypassing the React DOM', 'Pure RAM D3 Physics', 'O(1) BFS Focus-Ray'],
    'ml-overview': ['Multi-Modal AST Extraction', 'Cyclomatic Complexity', 'Semantic Resolution'],
    'louvain': ['Unsupervised Microservice Discovery', 'Modularity Maximization'],
    'risk-model': ['The Ensemble Risk Equation', 'Code Smell Diagnosis'],
    'shortcuts': ['Spatial Map Engine', 'File Operations', 'Edit & Navigation', 'View Controls'],
    'terminal-cli': ['Terminal Emulation', 'Process Management', 'Multi-Shell Support']
  };
  return tocMap[pageId] || [];
};

export default function Docs() {
  const [activePage, setActivePage] = useState('intro');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [openSections, setOpenSections] = useState(() => {
    const initialState = {};
    DOCS_NAVIGATION.forEach(sec => initialState[sec.category] = true);
    return initialState;
  });

  const toggleSection = (category) => {
    setOpenSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

  useEffect(() => {
    if (isMobileNavOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => document.body.style.overflow = 'auto';
  }, [isMobileNavOpen]);

  // Derived current active TOC
  const currentTOC = useMemo(() => getTableOfContents(activePage), [activePage]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-8 relative group">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        <input 
          type="text" 
          placeholder="Search documentation..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#111111] border border-white/10 focus:border-blue-500/50 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 outline-none transition-all placeholder:text-slate-600 shadow-inner"
        />
      </div>

      <nav className="flex-1 overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {DOCS_NAVIGATION.map((section, idx) => (
          <div key={idx} className="mb-6">
            <button 
              onClick={() => toggleSection(section.category)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-[0.15em] mb-2 px-1 group transition-colors outline-none"
            >
              <span>{section.category}</span>
              <ChevronRight size={14} className={`transition-transform duration-300 ease-in-out ${openSections[section.category] ? 'rotate-90 text-slate-400' : 'text-slate-600'}`} />
            </button>
            
            <div className={`grid transition-all duration-300 ease-in-out ${openSections[section.category] ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <ul className="overflow-hidden space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activePage === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => { setActivePage(item.id); setIsMobileNavOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 whitespace-nowrap outline-none ${isActive ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans relative flex pt-16">
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-500">
          {isMobileNavOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileNavOpen(false)} />
          <div className="w-80 h-full max-h-screen relative flex flex-col p-6 bg-[#0a0a0a]">
            <SidebarContent />
          </div>
        </div>
      )}

      <aside className="hidden lg:block w-80 h-[calc(100vh-4rem)] sticky top-16 bg-[#0a0a0a] px-8 py-8 z-20 shrink-0">
        <SidebarContent />
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 lg:px-12 xl:px-20 relative z-10 min-h-screen">
        
        {/* 🚀 MODULAR CONTENT ROUTING */}
        {['intro', 'install', 'quickstart'].includes(activePage) && <GettingStarted activeSection={activePage} />}
        
        {activePage === 'spatial-engine' && <Architecture />}
        
        {['ml-overview', 'louvain', 'risk-model', 'llm-peel'].includes(activePage) && <MachineLearning activeSection={activePage} />}
        
        {['shortcuts', 'terminal-cli'].includes(activePage) && <Reference activeSection={activePage} />}

        {/* CATCH-ALL FOR PENDING MODULES */}
        {(!['intro', 'install', 'quickstart', 'spatial-engine', 'ml-overview', 'louvain', 'risk-model', 'llm-peel', 'shortcuts', 'terminal-cli'].includes(activePage)) && (
          <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center justify-center h-96 text-slate-500 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
            <Box size={48} className="mb-4 opacity-20" />
            <h2 className="text-xl font-medium text-white mb-2">Module Pending Deployment</h2>
            <p className="text-sm">The documentation vector for this segment is currently compiling.</p>
          </div>
        )}

      </main>

      {/* DYNAMIC RIGHT SIDEBAR (Table of Contents) */}
      <aside className="hidden xl:block w-64 h-[calc(100vh-4rem)] sticky top-16 py-12 pr-8 shrink-0">
        {currentTOC.length > 0 ? (
          <>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">On this page</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              {currentTOC.map((heading, i) => (
                <li key={i} className="pl-4 border-l border-white/10 hover:border-blue-500 hover:text-white cursor-pointer transition-colors">
                  {heading}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </aside>

    </div>
  );
}