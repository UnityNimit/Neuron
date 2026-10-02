# Neuron Spatial IDE — v1.1.0 Release Notes

**Release Tag:** `v1.1.0`  
**Build Target:** Windows x64 (`Neuron_1.1.0_x64-setup.exe` / Standalone Embedded Sidecar Engine)

---

## Highlights in v1.1.0

### Next-Gen Procedural Hierarchical Spatial Map
- **4-Stage Procedural Merging & Division (`Function -> File -> Subfolder -> Root Folder -> Core Hub`)**:
  Zooming out organically coalesces child orbs into their parent orbs with conservation-of-mass swelling and boundary activity pulses, while zooming in smoothly divides orbs back into their constituent nodes.
- **Dynamic Zoom-Adaptive Connecting Lines**:
  Connecting conduits (`hierarchy`, `call`, and `network_bridge` laser links) dynamically scale their thickness and opacity with camera zoom and merged orb mass, bundling converged child connections cleanly without sub-pixel flickering or overdraw.
- **High-DPI Dynamic Node Typography**:
  Node labels render at high-DPI resolution and scale dynamically with both camera zoom and merged orb size (`massSwell`), keeping folder, file, and function names razor-sharp at every zoom level.
- **Every-Frame Organic ML Community Nebulas**:
  Community nebulas track procedural merging at 300 FPS using 12-point circular halo sampling and continuous quadratic B-spline curves that wrap and contract around merged orbs in real time.
- **Live Spatial Map Tuning & Draggable Settings Window**:
  Added real-time sliders and numeric inputs under **Settings -> Spatial Map** for Global Circle Size, Global Line Size, Global Text Size, Merged Orb Repulsion, Transition Speed, and all 5 LOD Zoom Thresholds, inside a freely draggable Settings window.

### Unified Theme-Aware Navigation & Minimalist UI
- **Unified Curved Tab Architecture**:
  The Center Spatial/Editor bar, Terminal bar, and Right AI/Input bar share an identical, theme-reactive curved tab design with seamless bottom-border joining and a `2px` theme-accent top indicator.
- **Cursor-Preserving Save & Auto-Save**:
  Manual saves (`Ctrl+S`) and debounced auto-saves preserve exact cursor position, active selections, and scroll offset without interruption.
- **Minimalist AI Chat & Frameless Model Selector**:
  Redesigned the AI Studio with a frameless typographic model selector, a borderless AI response stream, and a smooth dark gradient backdrop behind the prompt input.
- **Refined Terminal Controls & Smart Git Output**:
  Git progress streams (`git push`, `git pull`, branch status) highlight in your active theme's accent color rather than error red, paired with a clean icon-only Stop button in the terminal header.
- **Official Vector SVG Branding & Theme Reactivity**:
  Replaced all legacy bitmap logos and icons with a razor-sharp, scalable SVG logo component (`NeuronLogo.jsx` / `logon.svg`) that dynamically inherits the active theme highlight colors across the TopBar, SplashScreen, SettingsModal, and favicon.

### Instant Git Source Control & Zero-Lag Panel Resizing
- **Auto-Loaded Git History**:
  Opening a Git workspace or switching to the Source Control tab automatically loads full commit history, branch status, and staged/unstaged changes without manual refreshing.
- **Full-Surface Canvas Resize & Touch Synchronization**:
  Resizing the terminal, sidebar, or AI panels immediately updates the WebGPU canvas viewport and hit-testing area with zero lag, clipping, or camera shift.

---

## Installation
1. Download **`Neuron_1.1.0_x64-setup.exe`** from the Assets section below.
2. Run the installer (any running instance of Neuron IDE or its background engine is automatically closed during upgrade).
3. Launch **Neuron Spatial IDE** (`v1.1.0`).
