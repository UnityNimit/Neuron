# Changelog

All notable changes, architectural upgrades, and UI/UX refinements to **Neuron Spatial IDE** are documented in this file.

---

## [v1.1.0] - 2026-09-30

### Spatial Map Engine & Procedural Hierarchical LOD (`PixiSpatialEngine.jsx`, `usePhysicsEngine.js`, `SpatialMinimap.jsx`)
- **4-Stage Procedural Hierarchical Merging & Division Engine**:
  - Replaced legacy static super-node overlays with a continuous, topological 4-stage hierarchical coalescence and division system:
    1. **LOD Stage 1 (`Function -> File`)**: Function orbs smoothly spiral and absorb into their parent File orbs, transferring mass so File orbs swell proportionally.
    2. **LOD Stage 2 (`File -> Subfolder`)**: File orbs coalesce into their parent Subfolder orbs with boundary activity pulses.
    3. **LOD Stage 3 (`Subfolder -> Root Folder`)**: Subfolder and root-level file orbs merge into top-level Root Folder hubs.
    4. **LOD Stage 4 (`Root Folder -> Core Hub`)**: Top-level folders coalesce into the primary workspace core hub at macro zoom.
  - Zooming in reverses the hierarchy with smooth procedural division and `easeOutBack` spring physics.
- **Dynamic Zoom & Mass-Responsive Connecting Lines**:
  - Implemented `dynamicZoomLineScale` so connecting conduits (`hierarchy`, `call`, and `network_bridge` edges) automatically scale thickness and opacity with camera zoom (`viewport.scale.x`) and `spatialLineScale`.
  - Added converged-edge deduplication and `massConduitBoost` so bundled connections between merged parent orbs render as clean, high-clarity structural conduits without alpha overdraw.
- **Dynamic Zoom & Mass-Responsive Node Typography**:
  - Upgraded `PIXI.Text` labels to high-DPI texture resolution (`Math.max(2, Math.min(4, devicePixelRatio * 2.5))`) with distinct typographic hierarchy for folders, files, and functions.
  - Implemented `nodeLabelScale` (`baseTextZoomScale * orbTextBoost`) so node names stay crisp and readable across a 28x zoom range and scale proportionally as parent orbs grow in radius.
  - Added smooth zoom-threshold alpha fading (`funcZoomAlpha`) for function labels around `spatialFuncLabelZoom`.
- **Dynamic Every-Frame ML Community Nebulas**:
  - Synchronized ML community convex hulls (`nebulaLayer`) with the 300 FPS render loop (updating every frame instead of every 3 frames).
  - Replaced static 4-corner square bounding boxes with 12-point circular perimeter halo sampling weighted by `worldRadius` and `mergeProgress`, rendered via continuous midpoint quadratic B-spline curves (`quadraticCurveTo`).
  - Added WebGPU `BlurFilter` empty-layer guard and safe texture cleanup on unmount.
- **Velocity-Damped D3 Physics Integration & Resize Perfection**:
  - Wired merged orb `worldRadius` and `repulseStrength` directly into D3's velocity-damped `forceCollide`, `forceManyBody`, and `forceLink` solvers in `usePhysicsEngine.js`, eliminating secondary solver jitter while preventing merged orb overlap.
  - Synchronized `ResizeObserver` with `app.renderer.resize`, `app.stage.hitArea`, and `viewport.resize` while preserving camera center so resizing terminal or side panels never clips hit-testing or lags the canvas.
- **Real-Time Spatial Map Settings Controls & Draggable Settings Window (`SettingsModal.jsx`, `useSettings.js`)**:
  - Made the Settings window freely draggable across the IDE viewport via its top headers with pass-through background visibility so changes can be inspected in real time.
  - Added live sliders and numeric inputs in **Settings -> Spatial Map** for:
    - **Global Circle Size** (`spatialNodeScale`)
    - **Global Connecting Line Size** (`spatialLineScale`)
    - **Global Text Size** (`spatialTextScale`)
    - **Merged Orb Repulsion & Spacing** (`spatialMergeRepulsion`)
    - **LOD Merge / Divide Transition Speed** (`spatialTransitionSpeed`)
    - **LOD 1-4 Zoom Thresholds** (`spatialLod1Zoom`, `spatialLod2Zoom`, `spatialLod3Zoom`, `spatialLod4Zoom`) & **Function Label Visibility Zoom** (`spatialFuncLabelZoom`).

### Code Editor & Explorer Refinements (`CodeEditor.jsx`, `themeConfig.js`, `Sidebar.jsx`, `App.jsx`)
- **Dynamic Monaco Theme Accents**:
  - Implemented dynamic `syncMonacoTheme` in `themeConfig.js` so `editorCursor.foreground`, `editorLineNumber.activeForeground`, active indent guides, selection background, and scrollbar slider hover states dynamically bind to the active theme's accent color on mount and theme switch.
- **Zero-Reset Save & Auto-Save Pipeline**:
  - Fixed cursor and scroll reset during manual save (`Ctrl+S`) and debounced auto-save by synchronizing saved content into `workspace.nodes` immediately and preserving Monaco cursor position, selections, and scroll state across model updates (`pushEditOperations`).
- **Compact Explorer Typography & Level Depth Distinction**:
  - Removed all-capitals and bold styling from the root workspace folder header, preserving the folder's true case with clean `font-medium` typography.
  - Implemented consistent compact row spacing (`22px` height) and level depth distinction (`indentLevel = depth + 1`) so files and folders directly inside the parent folder and nested subdirectories are clearly indented with aligned 1px visual guide lines.


### Unified Navigation Bars & Theme-Aware UI Architecture (`App.jsx`, `ActivityBar.jsx`, `ThemeSelector.jsx`, `TerminalPanel.jsx`, `RightPanelContainer.jsx`, `index.css`)
- **Detached Floating Card Tab System & Bottom Highlight Indicator**:
  - Redesigned the top navigation bars across the **Center Spatial/Editor View**, **Terminal Panel**, and **Right AI/Input Panel** with vertically centered (`25px`) detached floating card tabs (`.neuron-tab-card`) featuring top-rounded corners, sharp bottom corners, and a full-width smooth-cornered `2.5px` bottom highlight line (`.neuron-tab-indicator`) inside `32px` (`1px` bottom-bordered) headers.
  - Eliminated vertical and horizontal text shifting between active and inactive states and locked GPU rasterization thickness across transitions.
- **Minimalist Activity Bar & Custom Neuron AI Icon**:
  - Removed legacy vertical side-line indicators and glow shadows from the left Activity Bar in favor of a unified `34x34px` theme-adaptive button system (`.neuron-activity-btn` / `.neuron-activity-icon`) with smooth `cubic-bezier` hover/press micro-animations across **Explorer**, **Git**, **AI**, **Theme**, **Settings**, and **Profile**.
  - Replaced the generic sparkles icon with a custom geometric **Neuron Node SVG icon** (`NeuronNodeIcon`) matched to the exact stroke weight and proportions of the Activity Bar icon set.


### Terminal & Execution Engine Refinements (`TerminalPanel.jsx`, `websocket_router.py`)
- **Theme-Aware Diagnostic & Git Output Coloring**:
  - Fixed stderr stream classification so standard Git progress messages (e.g., `git push`, `Enumerating objects`, branch updates) render in the active theme's highlight color instead of error red, reserving red strictly for genuine fatal/error diagnostics.
- **Minimalist Process Control Bar**:
  - Streamlined the running-process **Stop** action into a clean, borderless red icon positioned to the left of the `+` (New Terminal) button in the terminal header, removing redundant secondary stop containers.

### Minimalist AI Studio & Model Selector (`AiChatView.jsx`, `ModelSelectorDropdown.jsx`)
- **Frameless Model Selector**:
  - Replaced the boxed dropdown container with a clean typographic model label and minimalist chevron matching the header action icon palette.
- **Gradient-Faded Chat Input & Clean Message Stream**:
  - Replaced the solid bottom chat box container with a smooth dark vertical gradient backdrop so scrolling conversation text fades naturally behind the input bar.
  - Removed redundant sender name headers, timestamps, and outer boxes on AI responses while keeping user prompts in sleek bubble containers.

### Source Control Auto-Synchronization (`SourceControlPanel.jsx`, `App.jsx`, `websocket_router.py`)
- **Automatic Git Status & History Fetching**:
  - Added automatic `git_status` and `git_log` synchronization on workspace load, file save, and when switching to the **Source Control (Git)** tab so commit history, branches, and modified files appear immediately without requiring a manual reload click.

### Official Vector Logo & Complete Brand Modernization (`NeuronLogo.jsx`, `logon.svg`, `TopBar.jsx`, `SplashScreen.jsx`, `SettingsModal.jsx`)
- **Sharp Vector SVG Architecture**:
  - Encapsulated the official brand geometry into a scalable, zero-dependency React component (`NeuronLogo.jsx`) utilizing `stroke="currentColor"`.
  - Fully reactive to active theme highlight colors (`var(--theme-accent)`) across Obsidian Blue, Emerald, Cyberpunk, and Amber themes.
  - Replaced legacy bitmap images (`logo.png`, `favicon.png`) across TopBar, SplashScreen, SettingsModal, and the application favicon in `index.html`.
  - Removed all obsolete bitmap assets from public asset directories and eliminated emojis from all layout code comments and UI elements.

