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

import { MachineLearning } from './docs/GettingStarted';
import { Reference } from './docs/MachineLearning';
import { Architecture } from './docs/Architecture';

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
