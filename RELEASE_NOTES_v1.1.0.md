# Neuron Spatial IDE — v1.1.0 Release Notes

**Version:** 1.1.0  
**Release Date:** September 30, 2026  
**Target Platform:** Windows x64 (`Neuron_1.1.0_x64-setup.exe` / Standalone Sidecar Engine)  
**Official Website & Web Portal:** [https://neuron-website-ruby.vercel.app/](https://neuron-website-ruby.vercel.app/)  
**Source Repository:** [https://github.com/UnityNimit/Neuron](https://github.com/UnityNimit/Neuron)

---

## Overview

Neuron v1.1.0 updates the spatial canvas with procedural 4-stage Level of Detail (LOD) aggregation, adds a draggable real-time settings window, stabilizes editor cursor and scroll state across saves, implements structured tool execution metadata for the autonomous AI agent, and unifies the tab and navigation bar styling across all panels.

---

## Downloads & Links

* **Official Web Portal:** [https://neuron-website-ruby.vercel.app/](https://neuron-website-ruby.vercel.app/)
* **Direct Windows Installer:** `Neuron_1.1.0_x64-setup.exe` (Available on the [Web Portal](https://neuron-website-ruby.vercel.app/) and [GitHub Releases](https://github.com/UnityNimit/Neuron/releases))
* **GitHub Repository:** [https://github.com/UnityNimit/Neuron](https://github.com/UnityNimit/Neuron)

---

## Detailed Changes

### 1. Procedural Hierarchical Spatial Engine

The spatial canvas replaces static node groupings with a continuous 4-stage procedural aggregation and division engine:

$$\text{Function} \longrightarrow \text{File} \longrightarrow \text{Subfolder} \longrightarrow \text{Root Folder} \longrightarrow \text{Core Hub}$$

* **Continuous Mass-Based Coalescence & Division:**
  * Zooming out aggregates child nodes into their parent container. Parent orbs dynamically increase in radius (`worldRadius`) based on cumulative child mass, accompanied by perimeter pulse indicators.
  * Zooming in partitions parent nodes back into constituent children using damped spring physics (`easeOutBack`).
  * Default zoom transition cutoffs:
    * Functions coalesce into Files below zoom `0.35` (`spatialLod1Zoom`).
    * Files coalesce into Subfolders below zoom `0.22` (`spatialLod2Zoom`).
    * Subfolders and root-level files coalesce into Top-Level Folders below zoom `0.12` (`spatialLod3Zoom`).
    * Top-level folders coalesce into the Core Hub below zoom `0.05` (`spatialLod4Zoom`).
* **Zoom-Adaptive Link Conduits:**
  * Structural lines (`hierarchy`, `call`, and `network_bridge`) automatically scale stroke width and opacity with camera zoom (`viewport.scale.x`).
  * Converged lines between merged parent orbs are automatically deduplicated and rendered as bundled conduits (`massConduitBoost`), eliminating visual clutter and sub-pixel aliasing.
* **High-DPI Node Typography:**
  * Node labels render using dynamic texture resolution:
    $$\text{Resolution} = \max\left(2, \min\left(4, \text{devicePixelRatio} \times 2.5\right)\right)$$
  * Text scales with both camera zoom and orb radius (`nodeLabelScale = baseTextZoomScale * orbTextBoost`), keeping labels legible across micro and macro zoom ranges.
  * Function labels smoothly fade out below zoom `0.55` (`spatialFuncLabelZoom`).
  * File and folder labels remain visible down to zoom `0.25` (`spatialFileLabelZoom`) and `0.10` (`spatialFolderLabelZoom`).
* **Organic Community Nebulas:**
  * Machine learning community hulls (`nebulaLayer`) update on every frame of the 300 FPS render loop.
  * Computed via 12-point circular perimeter halo sampling weighted by node mass and merge progress, connected with continuous quadratic B-spline curves (`quadraticCurveTo`).
* **D3 Physics Synchronization:**
  * Node mass and collision radii are bound directly to D3's `forceCollide`, `forceManyBody`, and `forceLink` solvers, preventing node overlap and solver oscillations.
  * Canvas resize observer binds to `app.renderer.resize`, `app.stage.hitArea`, and `viewport.resize` without displacing the active camera center.

---

### 2. Live Spatial Map Settings

The Settings modal is draggable via its top bar and features a translucent background, allowing developers to inspect spatial canvas adjustments in real time.

Settings located under **Settings -> Spatial Map**:

| Setting | Configuration Key | Default | Configurable Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| Global Circle Size | `spatialNodeScale` | `1.0` | `0.1 – 4.0` | Multiplier for base node radius across all canvas elements. |
| Global Line Size | `spatialLineScale` | `1.0` | `0.1 – 4.0` | Multiplier for edge stroke width and connection lines. |
| Global Text Size | `spatialTextScale` | `1.0` | `0.1 – 4.0` | Multiplier for node label font sizes. |
| Merged Orb Repulsion | `spatialMergeRepulsion` | `1.5` | `0.2 – 5.0` | Electrostatic repulsion strength between coalesced parent orbs. |
| LOD Transition Speed | `spatialTransitionSpeed` | `0.28` | `0.05 – 1.0` | Interpolation speed for merge and split animations. |
| LOD 1 Zoom Threshold | `spatialLod1Zoom` | `0.35` | `0.15 – 0.90` | Camera zoom level where Functions merge into Files. |
| LOD 2 Zoom Threshold | `spatialLod2Zoom` | `0.22` | `0.08 – 0.60` | Camera zoom level where Files merge into Subfolders. |
| LOD 3 Zoom Threshold | `spatialLod3Zoom` | `0.12` | `0.03 – 0.40` | Camera zoom level where Subfolders merge into Root Folders. |
| LOD 4 Zoom Threshold | `spatialLod4Zoom` | `0.05` | `0.01 – 0.25` | Camera zoom level where Root Folders merge into the Core Hub. |
| Function Label Zoom | `spatialFuncLabelZoom` | `0.55` | `0.10 – 2.50` | Camera zoom level below which function labels fade out. |
| File Label Zoom | `spatialFileLabelZoom` | `0.25` | `0.05 – 1.50` | Camera zoom level below which file labels fade out. |
| Folder Label Zoom | `spatialFolderLabelZoom` | `0.10` | `0.01 – 1.00` | Camera zoom level below which folder labels fade out. |
| Selected Line Width | `spatialSelectedLineWidth` | `3.8` | `1.0 – 10.0` | Line thickness for selected node relationships. |
| Bridge Line Width | `spatialBridgeLineWidth` | `2.5` | `0.5 – 8.0` | Line thickness for cross-cluster bridge edges. |
| Structural Line Width | `spatialPurpleLineWidth` | `1.6` | `0.5 – 6.0` | Base line thickness for hierarchy structural links. |

---

### 3. Editor Cursor & Save Pipeline

* **Zero-Reset Save Pipeline:**
  * Fixed an issue where saving (`Ctrl+S`) or background auto-save reset the active cursor position and scroll coordinates.
  * File updates now sync non-destructively through Monaco's `pushEditOperations` API, preserving cursor line, column coordinates, multi-cursor selections (`getSelections`), and vertical/horizontal scroll offsets (`getScrollTop`, `getScrollLeft`).
* **Dynamic Theme Accent Binding:**
  * Monaco editor theme parameters (`editorCursor.foreground`, `editorLineNumber.activeForeground`, active indent guides, selection background, and scrollbar slider hover states) dynamically update when switching themes.
* **Explorer Tree Formatting:**
  * Standardized row heights to 22px.
  * Preserved the original folder name casing on root workspace headers.
  * Added aligned 1px visual depth guide lines (`indentLevel = depth + 1`) for nested directories.

---

### 4. Tab Navigation & UI Layout

* **Unified Floating Card Tabs:**
  * Standardized tab navigation across the Center Spatial/Editor View, Terminal Panel, and Right AI Panel.
  * Uses detached floating card tabs (`.neuron-tab-card`) with rounded top corners, sharp bottom corners, and a 2.5px bottom highlight line (`.neuron-tab-indicator`) styled with the active theme accent.
  * Eliminates layout shifts between active and inactive tab states.
* **Activity Bar:**
  * Replaced side-line indicators and drop shadows with 34x34px theme-adaptive buttons (`.neuron-activity-btn`).
  * Added a custom geometric vector icon (`NeuronNodeIcon`) for the AI Studio button, matching the line weight of standard development icons.

---

### 5. Autonomous AI Engine & Backend

* **Structured Tool Call Metadata:**
  * The backend (`backend/services/ai_service.py` and `backend/api/websocket_router.py`) now streams structured metadata for each tool execution:
    * `tool`: Exact tool identifier (`tool_run_command`, `tool_write_to_file`, `tool_replace_file_content`).
    * `file`: Target file path extracted from tool parameters.
    * `command`: Exact command line dispatched for execution.
* **Manual Approval Mode:**
  * When running in manual approval mode, mutating tool calls stream full parameter payloads prior to execution, allowing the user to review target files and commands before approving or rejecting.
* **API Quota & Diagnostic Guidance:**
  * Added explicit diagnostic guidance when cloud models encounter rate limits or 503 load-shedding:
    * Differentiates Google AI Studio developer API keys from consumer Google One / Gemini Advanced chat subscriptions.
    * Explains pay-as-you-go project configuration in Google Cloud.
    * Documents free alternatives including Groq API and local offline Ollama models (`qwen2.5-coder:7b`).

---

### 6. Terminal & Git Source Control

* **Theme-Aware Git Stream Highlighting:**
  * Standard Git informational outputs (`git push`, `Enumerating objects`, branch tracking) stream in the active theme accent color rather than stderr red, reserving red strictly for fatal exceptions.
* **Consolidated Process Controls:**
  * Added an icon-only stop button in the terminal header to terminate running processes.
* **Automatic Git Synchronization:**
  * Workspace load, file saves, and switching to the Source Control tab automatically refresh branch status, modified files, and commit logs without requiring manual reload.

---

### 7. Brand Assets & Optimization

* **Vector SVG Logo:**
  * Replaced raster images (`logo.png`, `favicon.png`) with an inline SVG component (`NeuronLogo.jsx` / `logon.svg`) utilizing CSS `currentColor` to dynamically reflect theme highlight colors.
* **Icon Asset Compression:**
  * Rebuilt and compressed application icon sets across Windows (`.ico`), macOS (`.icns`), iOS, and Android formats, reducing the overall application bundle footprint.

---

## Subsystem Architecture Mapping

| Component | Files Modified | Summary of Implementation |
| :--- | :--- | :--- |
| Spatial Canvas | `PixiSpatialEngine.jsx`, `usePhysicsEngine.js`, `SpatialMinimap.jsx` | 4-stage procedural LOD, dynamic line scaling, 300 FPS B-spline nebulas. |
| Settings | `SettingsModal.jsx`, `useSettings.js` | Draggable modal, transparent backdrop, live spatial tuning controls. |
| Code Editor | `CodeEditor.jsx`, `themeConfig.js`, `Sidebar.jsx` | Cursor-preserving save pipeline, Monaco theme sync, compact explorer. |
| Layout & Tabs | `App.jsx`, `ActivityBar.jsx`, `TerminalPanel.jsx`, `RightPanelContainer.jsx` | Unified floating card tabs, 2.5px bottom indicators, geometric activity bar icon. |
| AI Engine | `ai_service.py`, `websocket_router.py`, `AiChatView.jsx` | Structured tool metadata, parameter inspection on approval, quota guidance. |
| Terminal / Git | `SourceControlPanel.jsx`, `TerminalPanel.jsx` | Theme-aware stderr coloring, automated Git status refresh. |
| Brand Assets | `NeuronLogo.jsx`, `logon.svg`, `src-tauri/icons/` | Theme-reactive vector logo, compressed platform icons. |

---

## Installation & Upgrade

### Windows x64 Installer
1. Download **`Neuron_1.1.0_x64-setup.exe`** from the [Neuron Web Portal](https://neuron-website-ruby.vercel.app/) or [GitHub Releases](https://github.com/UnityNimit/Neuron/releases).
2. Run the installer. Existing instances of the IDE and background sidecar will be automatically terminated and upgraded.
3. Launch **Neuron Spatial IDE**.

### Building from Source
```bash
# 1. Clone or pull latest main branch
git checkout main
git pull origin main

# 2. Setup backend sidecar
cd backend
pip install -r requirements.txt

# 3. Setup and run frontend desktop client
cd ../frontend
npm install
npm run tauri dev
```
