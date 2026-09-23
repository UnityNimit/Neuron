# Neuron

The local-first 2D spatial development environment and graph topological IDE.

Neuron is an applied AI and graph machine learning development environment that visualizes Python, JavaScript, and TypeScript codebases onto a high-performance 2D spatial canvas. By modeling source code as an interconnected topological graph rather than flat linear text files, Neuron gives developers instant structural comprehension over massive codebases.

---

## Core Philosophy

Traditional code editors treat source code as static files organized in linear disk directories. Neuron transforms your repository into a live topological graph:

- Spatial Comprehension: Functions, modules, classes, and decorated endpoints are visual nodes connected by directional invocation conduits and modularity clusters.
- 100% Localhost Execution: Abstract syntax tree parsing, Louvain community partitioning, force-directed graph relaxation, and vector caches run completely on your local workstation with zero telemetry.
- Bidirectional Synchronization: Edits in physical files immediately re-index the spatial graph, while interactions on the canvas update code structures deterministically.

---

## Architectural Highlights

### 1. Spatial AST Canvas Engine
- In-memory Tree-Sitter daemon parsing syntax symbols in sub-4ms intervals.
- Directional call-graph adjacency matrices powered by NetworkX graph algorithms.
- Pure-RAM force-directed equilibrium providing zero-latency 60+ FPS navigation.

### 2. Microservice & Module Clustering
- Automated Louvain modularity maximization partitions codebases into cohesive functional clusters.
- Dynamic color-coded semantics:
  - Blue: Directory packages and module containers
  - Gold: Physical source files (.py, .jsx, .ts)
  - Purple: Callable functions and symbol nodes
  - Red: High-cyclomatic complexity and architectural risk hotspots
  - Emerald: Pure functions, invariants, and deterministic utilities

### 3. Integrated AI Assistant Studio
- Context-aware local agent orchestration referencing concrete AST topological graphs.
- First-class support for Bring-Your-Own-Key (BYOK) providers and local offline runtimes such as Ollama.
- Deterministic diff synthesis with local AST sanity checks to prevent regressions.

### 4. Calibrated Theme Engine
- 5 official built-in themes engineered for spatial visual clarity:
  - Obsidian Black
  - Alabaster White
  - Sakura Rose
  - Galaxy Dark Blue
  - Sakura Mist

---

## Releases & Downloads

- Current Version: v1.0.0 Beta Release (September 2026)
- Target Platform: Windows 10 / 11 (64-bit x64)
- Installer: Standalone executable setup (Neuron-Setup.exe) with zero external runtime dependencies.

---

## Website & Development Setup

This repository contains the official frontend marketing and documentation platform for Neuron, built with React, Vite, and Tailwind CSS.

### Prerequisites

- Node.js (v18.0 or higher recommended)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/UnityNimit/Neuron-Website.git

# Navigate into the project root
cd Neuron-Website

# Install dependencies
npm install
```

### Local Development

```bash
# Start the local development server with Hot Module Replacement
npm run dev
```

The application will be accessible at http://localhost:5173.

### Production Build

```bash
# Compile and bundle optimized production assets
npm run build

# Preview the production build locally
npm run preview
```

---

## Documentation Structure

The documentation platform provides comprehensive technical guides covering:

- Welcome & Core Philosophy
- Quickstart & Installation Guide
- Localhost Architecture & Daemon Subsystems
- Spatial Canvas Engine & Physics Rules
- Modularity & Louvain Partitions
- Multi-Language AST Support
- Autonomous Agent Studio & Prompt Grounding
- Hotkey Reference & Command Palette

---

## Security & Privacy Invariants

- Zero Telemetry: No keystrokes, source code, embeddings, or project directories are ever transmitted to external servers.
- Loopback Isolation: Local daemons bind strictly to loopback interfaces (127.0.0.1) with session authorization handshakes.
- Responsible Disclosure: Security vulnerabilities should be disclosed responsibly to neuron.spatial.ide@gmail.com.

---

## License

Neuron is 100% complete open-source software licensed under the permissive [MIT License](LICENSE).
