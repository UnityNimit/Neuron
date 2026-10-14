// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2, X, Play, AlertOctagon, Terminal } from 'lucide-react';

// Authentication & Core Services
import { 
  supabase, 
  isTauriApp, 
  triggerGoogleLogin, 
  triggerLogout 
} from './supabaseClient';
import { loadPyodideEngine } from './services/pyodideService';

// Hooks & State
import { useWorkspace } from './hooks/useWorkspace';
import { useSettings } from './hooks/useSettings';
import { usePersistentState } from './hooks/usePersistentState';
import { usePhysicsEngine } from './hooks/usePhysicsEngine';
import { useAiStudio } from './hooks/useAiStudio';

// Modular Multi-Pane Layout System
import ModularWorkspace from './components/layout/modular/ModularWorkspace';
import {
  getAllPanes,
  findPaneById,
  findPaneByTabId,
  addTabToPane,
  removeTabFromPane,
  setActiveTabInPane,
  splitPane,
  moveTab,
  closePane,
  loadLayoutFromStorage,
  saveLayoutToStorage,
  createDefaultModularLayout,
  createMapAndCodeLayout,
  createTwoCodeFilesLayout,
  createMapCodeCodeLayout,
  createThreeCodeFilesLayout,
  createCompetitiveProgrammingLayout,
  isMapPane,
  isEditorPane,
  getCandidateEditorPane
} from './components/layout/modular/layoutModel';

import { applyTheme, getCurrentThemeId } from './config/themeConfig';
import AiSidebar from './components/ai/AiSidebar';

// Layout & UI
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SourceControlPanel from './components/layout/SourceControlPanel';
import SettingsModal from './components/layout/SettingsModal';
import StatusBar from './components/layout/StatusBar';
import CommandPalette from './components/layout/CommandPalette';
import AgentSupervisorHUD from './components/layout/AgentSupervisorHUD';
import SplashScreen from './components/layout/SplashScreen'; 

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'ico', 'bmp', 'tiff', 'tif', 'avif']);
const UNSUPPORTED_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'msi', 'iso', 'dmg', 'o', 'obj', 'class', 'jar',
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  'zip', 'tar', 'gz', '7z', 'rar', 'bz2', 'xz',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'db', 'sqlite', 'sqlite3', 'mdb'
]);

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem('neuron_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const workspace = useWorkspace(session);
  const { settings, updateSetting } = useSettings();
  
  const { 
    layout, setLayout, 
    activeSidebarView, setActiveSidebarView,
    centerView, setCenterView, 
    stdin, setStdin 
  } = usePersistentState();

  // Modular Multi-Pane Layout Tree State (Preserved in localStorage)
  const [layoutTree, setLayoutTree] = useState(() => {
    return loadLayoutFromStorage(workspace.openFiles, workspace.currentFile);
  });
  const [activePaneId, setActivePaneId] = useState(() => {
    const panes = getAllPanes(layoutTree);
    return panes[0]?.id || null;
  });
  const [lastActiveEditorPaneId, setLastActiveEditorPaneId] = useState(() => {
    const panes = getAllPanes(layoutTree);
    const candidate = panes.find(p => isEditorPane(p) && (p.tabs || []).some(t => t.type === 'file')) || panes.find(isEditorPane);
    return candidate?.id || null;
  });

  const handleActivatePane = useCallback((paneId) => {
    setActivePaneId(paneId);
    if (!layoutTree) return;
    const target = findPaneById(layoutTree, paneId);
    if (target && isEditorPane(target)) {
      setLastActiveEditorPaneId(paneId);
    }
  }, [layoutTree]);

  const isSpatialActive = useMemo(() => {
    const panes = getAllPanes(layoutTree);
    return panes.some(p => p.activeTabId === 'spatial' || (p.tabs || []).some(t => t.id === 'spatial'));
  }, [layoutTree]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('general');

  const handleOpenSettings = useCallback((tab = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  // 5-second minimum display guarantee on startup and whenever the splash screen appears
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const splashLockSessionRef = useRef(false);
  const splashLockTimerRef = useRef(null);

  const rawSplashNeeded = !workspace.isGraphLoaded || workspace.isFolderLoading;

  useEffect(() => {
    if (rawSplashNeeded) {
      if (!splashLockSessionRef.current) {
        splashLockSessionRef.current = true;
        setMinSplashElapsed(false);

        if (splashLockTimerRef.current) {
          clearTimeout(splashLockTimerRef.current);
        }

        splashLockTimerRef.current = setTimeout(() => {
          setMinSplashElapsed(true);
          splashLockSessionRef.current = false;
        }, 5000);
      }
    }
  }, [rawSplashNeeded]);

  // Initial startup splash timer
  useEffect(() => {
    splashLockSessionRef.current = true;
    const timer = setTimeout(() => {
      setMinSplashElapsed(true);
      splashLockSessionRef.current = false;
    }, 5000);
    return () => {
      clearTimeout(timer);
      if (splashLockTimerRef.current) clearTimeout(splashLockTimerRef.current);
    };
  }, []);
  
  const [editorFocusLine, setEditorFocusLine] = useState(null);
  const [focusIsolationId, setFocusIsolationId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // ---  HORIZON 2: CAMERA WARP TARGET STATE ---
  const [warpTargetNodeId, setWarpTargetNodeId] = useState(null);

  // --- VS CODE-STYLE DIRTY/UNSAVED FILES TRACKER ---
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const currentCodeBufferRef = useRef({});
  const autoSaveTimerRef = useRef(null);
  const handleRunCodeRef = useRef(null);

  // --- AI & REFACTORING TRANSACTION REFS ---
  const hoverTimerRef = useRef(null);
  const pendingRefactorRef = useRef(null);
  const [cspRejection, setCspRejection] = useState(null);
  const [refactorFeedback, setRefactorFeedback] = useState(null);
  const refactorFeedbackTimerRef = useRef(null);

  const showRefactorFeedback = useCallback((feedback) => {
    if (refactorFeedbackTimerRef.current) {
      clearTimeout(refactorFeedbackTimerRef.current);
    }
    setRefactorFeedback(feedback);
    const duration = feedback.status === 'done' ? 3000 : 4500;
    refactorFeedbackTimerRef.current = setTimeout(() => {
      setRefactorFeedback(null);
    }, duration);
  }, []);
  const [refactorEnabled, setRefactorEnabled] = useState(false);
  const [blastProtectionEnabled, setBlastProtectionEnabled] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('neuron-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.blastProtection !== undefined) return Boolean(parsed.blastProtection);
      }
      return localStorage.getItem('neuron-blast-protection') === 'true';
    } catch {
      return false; // Default OFF ("fault off")
    }
  });

  const handleToggleBlastProtection = useCallback(() => {
    setBlastProtectionEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('neuron-blast-protection', String(next));
      } catch {}
      updateSetting('blastProtection', next);
      if (!next) {
        workspace.dismissAgentBatch?.();
        workspace.setBlastRadius?.(null);
      }
      if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
        workspace.wsRef.current.send(JSON.stringify({
          event: 'SET_BLAST_PROTECTION',
          enabled: next
        }));
      }
      workspace.addNotification?.(
        'info',
        next ? 'Blast Protection Active' : 'Blast Protection Disabled',
        next 
          ? 'Guarding code against rapid multi-file AI mutation bursts.' 
          : 'Blast protection disabled. AI mutations will apply directly.',
        'blast'
      );
      return next;
    });
  }, [workspace.wsRef, workspace.addNotification, workspace.dismissAgentBatch, workspace.setBlastRadius, updateSetting]);

  // Sync blast protection status over WebSocket and with settings
  useEffect(() => {
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'SET_BLAST_PROTECTION',
        enabled: blastProtectionEnabled
      }));
    }
  }, [workspace.wsRef, workspace.isGraphLoaded, blastProtectionEnabled]);

  // Sync settings.blastProtection with blastProtectionEnabled when changed from SettingsModal
  useEffect(() => {
    if (settings?.blastProtection !== undefined && settings.blastProtection !== blastProtectionEnabled) {
      const next = settings.blastProtection;
      setBlastProtectionEnabled(next);
      try {
        localStorage.setItem('neuron-blast-protection', String(next));
      } catch {}
      if (!next) {
        workspace.dismissAgentBatch?.();
        workspace.setBlastRadius?.(null);
      }
      if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
        workspace.wsRef.current.send(JSON.stringify({
          event: 'SET_BLAST_PROTECTION',
          enabled: next
        }));
      }
    }
  }, [settings?.blastProtection, workspace.dismissAgentBatch, workspace.setBlastRadius]);

  // Apply active theme on mount
  useEffect(() => {
    applyTheme(getCurrentThemeId());
  }, []);

  const isSplashVisible = !minSplashElapsed || rawSplashNeeded;

  // --- ACTIVATE WEBGPU PURE-RAM PHYSICS ENGINE ---
  const { simDataRef, onDragStart, onDragMove, onDragEnd } = usePhysicsEngine(
    workspace.nodes || [], 
    workspace.edges || [], 
    workspace.wsRef, 
    workspace.isGraphLoaded, 
    isSpatialActive ? 'spatial' : 'editor',
    !isSplashVisible && (settings?.physicsSimulation ?? true),
    settings?.spatialAnimationSpeed ?? 1.0
  );

  // ---  PERMANENT DESKTOP & WEB AUTH RESOLVER ---
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 1. Check local storage for persistent user session
      try {
        const saved = localStorage.getItem('neuron_user_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (isMounted && parsed) {
            setSession(parsed);
            return;
          }
        }
      } catch (e) {}

      // 2. Fetch session from local backend if already active
      try {
        const resp = await fetch('http://127.0.0.1:8000/auth/session');
        if (resp.ok) {
          const data = await resp.json();
          if (isMounted && data?.session) {
            setSession(data.session);
            localStorage.setItem('neuron_user_session', JSON.stringify(data.session));
            return;
          }
        }
      } catch (e) {}

      // 3. Fallback to Supabase if web session exists
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (isMounted && existingSession) {
          setSession(existingSession);
        }
      } catch (err) {}
    };

    initAuth();
    return () => { isMounted = false; };
  }, []);

  // Sync session if remoteAuthSession updates from backend WebSocket
  useEffect(() => {
    if (workspace.remoteAuthSession) {
      setSession(prev => {
        if (prev && JSON.stringify(prev) === JSON.stringify(workspace.remoteAuthSession)) {
          return prev;
        }
        return workspace.remoteAuthSession;
      });
      try {
        localStorage.setItem('neuron_user_session', JSON.stringify(workspace.remoteAuthSession));
      } catch (e) {}
    }
  }, [workspace.remoteAuthSession]);

  const handleLogin = useCallback(async () => {
    await triggerGoogleLogin();
  }, []);

  const handleLogout = useCallback(async () => {
    setSession(null);
    try {
      localStorage.removeItem('neuron_user_session');
      localStorage.removeItem('neuron_desktop_session');
    } catch (e) {}
    await triggerLogout();
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({ event: 'LOGOUT' }));
    }
    workspace.addNotification?.('info', 'Signed Out', 'You have been signed out.', 'auth');
  }, [workspace]);

  // --- RECENT WORKSPACES RECORDER & FOLDER SWITCH CLEANUP ---
  const prevTargetDirRef = useRef(workspace.absTargetDir);
  useEffect(() => {
    if (workspace.absTargetDir) {
      if (prevTargetDirRef.current && prevTargetDirRef.current !== workspace.absTargetDir) {
        setCenterView('spatial');
        setDirtyFiles(new Set());
        currentCodeBufferRef.current = {};
      }
      prevTargetDirRef.current = workspace.absTargetDir;
      try {
        const saved = JSON.parse(localStorage.getItem('neuron_recent_projects') || '[]');
        const updated = [workspace.absTargetDir, ...saved.filter(p => p !== workspace.absTargetDir)].slice(0, 10);
        localStorage.setItem('neuron_recent_projects', JSON.stringify(updated));
      } catch (e) {}
    }
  }, [workspace.absTargetDir, setCenterView]);

  const handleOpenRecentWorkspace = useCallback((folderPath) => {
    if (folderPath && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      if (workspace.setIsFolderLoading) {
        workspace.setIsFolderLoading(true);
      }
      workspace.wsRef.current.send(JSON.stringify({
        event: 'OPEN_FOLDER_DIALOG',
        target_dir: folderPath
      }));
    }
  }, [workspace]);

  // Memoized nodes lookup map for O(1) node resolution
  const nodesMap = useMemo(() => {
    const map = new Map();
    (workspace.nodes || []).forEach(n => {
      if (n?.id) map.set(n.id, n);
    });
    return map;
  }, [workspace.nodes]);

  // ---  ATOMIC SAVE & AUTO-SAVE CONTROLLER ---
  const activeCodeStr = useMemo(() => {
    if (!workspace.currentFile) return "";
    const fileNode = nodesMap.get(workspace.currentFile);
    return (fileNode && fileNode.data?.nodeType === 'file') ? (fileNode.data?.code || "") : "";
  }, [nodesMap, workspace.currentFile]);

  const getCodeForFile = useCallback((filePath) => {
    if (!filePath) return "";
    if (currentCodeBufferRef.current[filePath] !== undefined) {
      return currentCodeBufferRef.current[filePath];
    }
    const fileNode = nodesMap.get(filePath);
    return (fileNode && fileNode.data?.nodeType === 'file') ? (fileNode.data?.code || "") : "";
  }, [nodesMap]);

  // ---  FILE TYPE CLASSIFIER (Images, Unsupported Binaries, Code) ---
  const fileExt = useMemo(() => {
    if (!workspace.currentFile) return "";
    const clean = workspace.currentFile.split('?')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }, [workspace.currentFile]);

  const isImageFile = useMemo(() => IMAGE_EXTENSIONS.has(fileExt), [fileExt]);
  const isUnsupportedFile = useMemo(() => UNSUPPORTED_EXTENSIONS.has(fileExt), [fileExt]);

  const handleSaveFile = useCallback((fileToSave, codeContent) => {
    const target = fileToSave || workspace.currentFile;
    if (!target) return;

    const content = codeContent !== undefined 
      ? codeContent 
      : (currentCodeBufferRef.current[target] ?? activeCodeStr);
    
    // Clear pending auto-save timer for this file
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      setIsSaving(true);
      workspace.wsRef.current.send(JSON.stringify({
        event: 'SAVE_FILE',
        filename: target,
        content: content
      }));

      // Synchronize the file node's code in workspace.nodes immediately so activeCodeStr matches saved content
      if (workspace.setNodes) {
        workspace.setNodes(prev => prev.map(n => {
          if (n.id === target && n.data) {
            return { ...n, data: { ...n.data, code: content } };
          }
          return n;
        }));
      }

      // Optimistically clear dirty indicator if no newer edits occurred
      setDirtyFiles(prev => {
        if (!prev.has(target)) return prev;
        const next = new Set(prev);
        next.delete(target);
        return next;
      });
      if (currentCodeBufferRef.current[target] === content) {
        delete currentCodeBufferRef.current[target];
      }

      // Reset saving indicator after brief visual feedback
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [workspace.currentFile, workspace.wsRef, workspace.setNodes, activeCodeStr]);

  const handleCodeChange = useCallback((arg1, arg2) => {
    let file = workspace.currentFile;
    let newCode = "";
    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      if (arg1.includes('/') || arg1.includes('.') || arg1.includes('\\')) {
        file = arg1;
        newCode = arg2;
      } else if (arg2.includes('/') || arg2.includes('.') || arg2.includes('\\')) {
        newCode = arg1;
        file = arg2;
      } else {
        file = arg1;
        newCode = arg2;
      }
    } else if (typeof arg1 === 'string') {
      newCode = arg1;
    }
    if (!file) return;

    currentCodeBufferRef.current[file] = newCode;
    
    // Always immediately mark file as dirty on any code edit (0ms latency)
    setDirtyFiles(prev => {
      if (prev.has(file)) return prev;
      const next = new Set(prev);
      next.add(file);
      return next;
    });

    const isAutoSaveActive = settings?.autoSave ?? true;
    if (isAutoSaveActive) {
      // Auto-save on debounced idle (750ms)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveFile(file, newCode);
      }, 750);
    }
  }, [workspace.currentFile, settings?.autoSave, handleSaveFile]);

  // AI Refactor Live Mutator & Persister
  const handleApplyCodeFromAi = useCallback((filePath, newCode) => {
    const file = filePath || workspace.currentFile;
    if (!file) return;

    // 1. Dispatch event to Monaco Editor to immediately update the in-memory model
    window.dispatchEvent(new CustomEvent('neuron-update-editor-code', {
      detail: { filePath: file, code: newCode }
    }));

    // 2. Synchronize currentCodeBufferRef immediately
    currentCodeBufferRef.current[file] = newCode;

    // 3. Mark dirty and trigger atomic save
    handleCodeChange(newCode, file);
    handleSaveFile(file, newCode);

    // 4. Update node's code in workspace.nodes so AST and mini-map sync reactively
    if (workspace.setNodes) {
      workspace.setNodes(prev => prev.map(n => {
        if (n.id === file && n.data) {
          return { ...n, data: { ...n.data, code: newCode } };
        }
        return n;
      }));
    }

    workspace.addNotification?.('success', 'Refactor Applied', `Updated ${file} successfully.`, 'ai');
  }, [workspace, handleCodeChange, handleSaveFile]);

  // Centralized AI State Controller
  const aiStudio = useAiStudio({
    wsRef: workspace.wsRef,
    isWsConnected: workspace.isWsConnected,
    settings,
    addNotification: workspace.addNotification,
    activeFile: workspace.currentFile,
    fileContent: currentCodeBufferRef.current[workspace.currentFile] ?? activeCodeStr,
    onApplyCode: handleApplyCodeFromAi
  });

  const handleToggleAutoSave = useCallback(() => {
    const nextVal = !(settings?.autoSave ?? true);
    updateSetting('autoSave', nextVal);
    // If turning autoSave ON and active file is dirty, save immediately
    if (nextVal && workspace.currentFile && dirtyFiles.has(workspace.currentFile)) {
      handleSaveFile(workspace.currentFile, currentCodeBufferRef.current[workspace.currentFile]);
    }
  }, [settings?.autoSave, updateSetting, workspace.currentFile, dirtyFiles, handleSaveFile]);

  // Flush in-memory unsaved changes before git commit
  const handleGitCommit = useCallback(async (message, options) => {
    if (dirtyFiles.size > 0 && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      dirtyFiles.forEach(file => {
        const content = currentCodeBufferRef.current[file];
        if (content !== undefined) {
          workspace.wsRef.current.send(JSON.stringify({
            event: 'SAVE_FILE',
            filename: file,
            content: content
          }));
        }
      });
      setDirtyFiles(new Set());
      await new Promise(r => setTimeout(r, 80));
    }
    return workspace.commitGitChanges(message, options);
  }, [dirtyFiles, workspace]);

  // Modular Layout Computations & Menu Toggles
  const effectiveLayout = useMemo(() => ({
    sidebar: layout.sidebar,
    terminal: Boolean(findPaneByTabId(layoutTree, 'terminal') || findPaneByTabId(layoutTree, 'output')),
    stdin: Boolean(findPaneByTabId(layoutTree, 'stdin'))
  }), [layout.sidebar, layoutTree]);

  const handleToggleLayout = useCallback((key) => {
    if (key === 'sidebar') {
      setLayout(prev => ({ ...prev, sidebar: !prev.sidebar }));
    } else if (key === 'terminal') {
      setLayoutTree(prev => {
        const pane = findPaneByTabId(prev, 'terminal') || findPaneByTabId(prev, 'output');
        if (pane) {
          if ((pane.activeTabId === 'terminal' || pane.activeTabId === 'output') && getAllPanes(prev).length > 1) {
            return closePane(prev, pane.id);
          } else {
            setActivePaneId(pane.id);
            const targetTab = (pane.tabs || []).some(t => t.id === 'terminal') ? 'terminal' : (pane.tabs?.[0]?.id || 'output');
            return setActiveTabInPane(prev, pane.id, targetTab);
          }
        } else {
          const active = findPaneById(prev, activePaneId) || getAllPanes(prev)[0];
          if (!active) return prev;
          const res = splitPane(prev, active.id, 'vertical', { id: 'terminal', type: 'terminal', title: 'Terminal' }, false);
          setActivePaneId(res.newPaneId);
          return res.tree;
        }
      });
    } else if (key === 'stdin') {
      setLayoutTree(prev => {
        const pane = findPaneByTabId(prev, 'stdin');
        if (pane) {
          if (pane.activeTabId === 'stdin' && getAllPanes(prev).length > 1) {
            return closePane(prev, pane.id);
          } else {
            setActivePaneId(pane.id);
            return setActiveTabInPane(prev, pane.id, 'stdin');
          }
        } else {
          const active = findPaneById(prev, activePaneId) || getAllPanes(prev)[0];
          if (!active) return prev;
          const res = splitPane(prev, active.id, 'horizontal', { id: 'stdin', type: 'stdin', title: 'Input' }, false);
          setActivePaneId(res.newPaneId);
          return res.tree;
        }
      });
    }
  }, [activePaneId, setLayout]);

  const handleFocusSpatialMap = useCallback(() => {
    setCenterView('spatial');
    setLayoutTree(prev => {
      const pane = findPaneByTabId(prev, 'spatial');
      if (pane) {
        setActivePaneId(pane.id);
        return setActiveTabInPane(prev, pane.id, 'spatial');
      }
      const targetPane = findPaneById(prev, activePaneId) || getAllPanes(prev)[0];
      if (!targetPane) return prev;
      return addTabToPane(prev, targetPane.id, {
        id: 'spatial',
        type: 'spatial',
        title: 'Spatial Map'
      });
    });
  }, [activePaneId, setCenterView]);

  const handleApplyLayoutPreset = useCallback((presetId) => {
    const openFiles = workspace.openFiles || [];
    const activeFile = workspace.currentFile;
    const workspaceFiles = workspace.files || [];

    let newLayout;
    if (presetId === 'default') {
      newLayout = createDefaultModularLayout(openFiles, activeFile, true, true);
    } else if (presetId === 'map-code') {
      newLayout = createMapAndCodeLayout(openFiles, activeFile, workspaceFiles);
    } else if (presetId === 'two-code') {
      newLayout = createTwoCodeFilesLayout(openFiles, activeFile, workspaceFiles);
    } else if (presetId === 'map-code-code') {
      newLayout = createMapCodeCodeLayout(openFiles, activeFile, workspaceFiles);
    } else if (presetId === 'three-code') {
      newLayout = createThreeCodeFilesLayout(openFiles, activeFile, workspaceFiles);
    } else if (presetId === 'competitive') {
      newLayout = createCompetitiveProgrammingLayout(openFiles, activeFile, workspaceFiles);
    }

    if (newLayout) {
      setLayoutTree(newLayout);
      saveLayoutToStorage(newLayout);
      const all = getAllPanes(newLayout);
      if (all.length > 0) {
        const activePane = all.find(p => (p.tabs || []).some(t => t.id === `file:${activeFile}`)) || all[0];
        setActivePaneId(activePane.id);
      }
      workspace.addNotification?.('info', 'Layout Reset', `Applied ${presetId} layout preset.`, 'layout');
    }
  }, [workspace.openFiles, workspace.currentFile, workspace.files, workspace.addNotification]);

  // --- OPTIMIZATION 1: O(1) ADJACENCY CACHE ---
  const adjLists = useMemo(() => {
    const hierarchyAdj = {}; 
    const callAdjForward = {}; 
    const callAdjBackward = {}; 

    (workspace.edges || []).forEach(e => {
      const srcId = typeof e.source === 'object' ? String(e.source.id) : String(e.source);
      const tgtId = typeof e.target === 'object' ? String(e.target.id) : String(e.target);
      const edgeId = e.id || `edge-${srcId}-${tgtId}`;

      if (e.type === 'hierarchy') {
        if (!hierarchyAdj[srcId]) hierarchyAdj[srcId] = [];
        if (!hierarchyAdj[tgtId]) hierarchyAdj[tgtId] = [];
        hierarchyAdj[srcId].push({ id: tgtId, edgeId });
        hierarchyAdj[tgtId].push({ id: srcId, edgeId });
      } else {
        if (!callAdjForward[srcId]) callAdjForward[srcId] = [];
        if (!callAdjBackward[tgtId]) callAdjBackward[tgtId] = [];
        callAdjForward[srcId].push({ id: tgtId, edgeId });
        callAdjBackward[tgtId].push({ id: srcId, edgeId });
      }
    });

    return { hierarchyAdj, callAdjForward, callAdjBackward };
  }, [workspace.edges]);

  // --- OPTIMIZATION 2: BFS PATHFINDING FOR WEBGPU FOCUS-RAY ---
  const activeRay = useMemo(() => {
    if (!hoveredNodeId) return null;
    
    const activeN = new Set([hoveredNodeId]);
    const activeE = new Set();
    const { hierarchyAdj, callAdjForward, callAdjBackward } = adjLists;
    
    (hierarchyAdj[hoveredNodeId] || []).forEach(n => { 
      activeN.add(n.id); 
      activeE.add(n.edgeId); 
    });

    const trace = (startId, adjMap) => {
      const queue = [startId];
      const visited = new Set([startId]);
      while (queue.length > 0) {
        const curr = queue.shift();
        (adjMap[curr] || []).forEach(n => {
          if (!visited.has(n.id)) { 
            visited.add(n.id); 
            activeN.add(n.id); 
            activeE.add(n.edgeId); 
            queue.push(n.id); 
          }
        });
      }
    };
    
    trace(hoveredNodeId, callAdjForward); 
    trace(hoveredNodeId, callAdjBackward); 
    
    return { activeN, activeE };
  }, [hoveredNodeId, adjLists]);

  // --- NATIVE HARDWARE KEYBINDS (Ctrl+S, Ctrl+K, Alt+I, F, Escape) ---
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      // Command Palette (Ctrl+K / Cmd+K) - Captures everywhere in the IDE
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { 
        e.preventDefault(); 
        e.stopPropagation();
        setIsCommandPaletteOpen(true); 
        return;
      }
      // Save Active File (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { 
        e.preventDefault(); 
        handleSaveFile(); 
      }
      // Run Active File in Output (F5)
      if (e.key === 'F5') {
        e.preventDefault();
        if (handleRunCodeRef.current) {
          handleRunCodeRef.current();
        }
      }
      // AI Impact Analysis (Alt+I)
      if (e.altKey && e.key.toLowerCase() === 'i' && hoveredNodeId) {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          workspace.wsRef.current.send(JSON.stringify({ event: 'IMPACT_ANALYSIS', node_id: hoveredNodeId }));
        }
      }
      // Focus Isolation (F)
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (hoveredNodeId) setFocusIsolationId(hoveredNodeId);
      }
      // Clear Map & Alerts (Escape)
      if (e.key === 'Escape') {
        workspace.setBlastRadius(null);
        setFocusIsolationId(null);
        setCspRejection(null);
        setWarpTargetNodeId(null);
      }
      // Canvas Refactor Undo (Ctrl+Z / Cmd+Z on Spatial Map)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        if (centerView === 'spatial' && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          e.preventDefault();
          workspace.wsRef.current.send(JSON.stringify({ event: 'REFACTOR_UNDO' }));
        }
      }
      // Toggle Terminal (Ctrl+` / Cmd+`)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        handleToggleLayout('terminal');
      }
      // Toggle Sidebar (Ctrl+B / Cmd+B)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleToggleLayout('sidebar');
      }
      // Fullscreen Toggle (F11)
      if (e.key === 'F11') {
        e.preventDefault();
        try {
          import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
            const win = getCurrentWindow();
            win.isFullscreen().then(isFull => win.setFullscreen(!isFull));
          });
        } catch (err) {}
      }
    };

    window.addEventListener('keydown', handleGlobalKeys, true);
    const handleOpenPaletteEvent = () => setIsCommandPaletteOpen(true);
    window.addEventListener('neuron-open-command-palette', handleOpenPaletteEvent);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeys, true);
      window.removeEventListener('neuron-open-command-palette', handleOpenPaletteEvent);
    };
  }, [hoveredNodeId, workspace, centerView, handleSaveFile]);

  // --- WEBSOCKET EVENT LISTENER ---
  useEffect(() => {
    const ws = workspace.wsRef.current;
    if (!ws || !workspace.isWsConnected) return;

    const handleWsEvents = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'SAVE_FILE_SUCCESS') {
          setIsSaving(false);
          setDirtyFiles(prev => {
            if (data.filename && prev.has(data.filename)) {
              const next = new Set(prev);
              next.delete(data.filename);
              return next;
            }
            return prev;
          });
        }
        else if (data.event === 'SAVE_FILE_ERROR') {
          setIsSaving(false);
          console.error(`[SAVE ERROR] Failed saving ${data.filename}:`, data.reason);
        }
        else if (data.event === 'LLM_SUMMARY_READY') {
          if (hoveredNodeId === data.node_id) {
            workspace.setAiInsight({
              nodeId: data.node_id,
              summary: data.summary
            });
          }
        }
        else if (data.event === 'REFACTOR_CSP_VIOLATION') {
          const payload = data.payload || {};
          const pending = pendingRefactorRef.current;
          const rawReason = payload.reason || payload.error || "cyclic dependency detected";
          const cleanReason = rawReason.replace(/^Constraint Violation:\s*/i, '').toLowerCase();
          showRefactorFeedback({ status: 'cant', reason: cleanReason });
          
          setCspRejection({
            timestamp: Date.now(),
            processed: false,
            reason: payload.reason || "Constraint Violation: Cyclic dependency detected.",
            violationType: payload.violation_type || "CSP_VIOLATION",
            cyclePath: payload.cycle_path || [],
            suggestedFix: payload.suggested_fix,
            nodeId: pending?.nodeId,
            originalPos: pending?.originalPos
          });
        }
        else if (data.event === 'REFACTOR_ERROR') {
          const rawReason = data.payload?.reason || data.reason || "refactor failed";
          showRefactorFeedback({ status: 'cant', reason: rawReason.toLowerCase() });
        }
        else if (data.event === 'REFACTOR_SUCCESS' || data.event === 'REFACTOR_FILE_MERGE_SUCCESS' || data.event === 'REFACTOR_FILE_SPLIT_SUCCESS') {
          showRefactorFeedback({ status: 'done' });
          setCspRejection(null);
          pendingRefactorRef.current = null;
        }
        else if (data.event === 'REFACTOR_FILE_MERGE_ERROR') {
          const rawReason = data.reason || "merge failed";
          showRefactorFeedback({ status: 'cant', reason: rawReason.toLowerCase() });
        }
        else if (data.event === 'REFACTOR_FILE_SPLIT_ERROR') {
          const rawReason = data.reason || "split failed";
          showRefactorFeedback({ status: 'cant', reason: rawReason.toLowerCase() });
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleWsEvents);
    return () => ws.removeEventListener('message', handleWsEvents);
  }, [workspace.isWsConnected, hoveredNodeId, showRefactorFeedback]);

  // --- FUNCTION-TO-FILE AST TRANSPLANT DISPATCHER ---
  const handleRefactorDrop = useCallback(({ symbolName, sourceFile, destFile, nodeId, originalPos, force }) => {
    if (!refactorEnabled && !force) {
      showRefactorFeedback({ status: 'cant', reason: 'refactor mode is disabled' });
      return;
    }
    if (!destFile) {
      showRefactorFeedback({ status: 'cant', reason: 'no destination file selected' });
      return;
    }
    const normSrc = (sourceFile || '').replace(/\\/g, '/').toLowerCase();
    const normDst = (destFile || '').replace(/\\/g, '/').toLowerCase();
    if (normSrc && normDst && (normSrc === normDst || normSrc.endsWith('/' + normDst) || normDst.endsWith('/' + normSrc))) {
      showRefactorFeedback({ status: 'cant', reason: 'already in this file' });
      return;
    }
    showRefactorFeedback({ status: 'moving' });
    pendingRefactorRef.current = { symbolName, sourceFile, destFile, nodeId, originalPos };
    
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_SYMBOL_MOVE',
        symbol_name: symbolName,
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef, refactorEnabled, showRefactorFeedback]);

  // --- FILE-TO-FILE FUSION DISPATCHER ---
  const handleFileMergeDrop = useCallback(({ sourceFile, destFile, force }) => {
    if (!refactorEnabled && !force) {
      showRefactorFeedback({ status: 'cant', reason: 'refactor mode is disabled' });
      return;
    }
    if (!destFile) {
      showRefactorFeedback({ status: 'cant', reason: 'no destination file selected' });
      return;
    }
    const normSrc = (sourceFile || '').replace(/\\/g, '/').toLowerCase();
    const normDst = (destFile || '').replace(/\\/g, '/').toLowerCase();
    if (normSrc && normDst && (normSrc === normDst || normSrc.endsWith('/' + normDst) || normDst.endsWith('/' + normSrc))) {
      showRefactorFeedback({ status: 'cant', reason: 'cannot merge file into itself' });
      return;
    }
    showRefactorFeedback({ status: 'moving' });
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_FILE_MERGE',
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef, refactorEnabled, showRefactorFeedback]);

  // ---  3D CAMERA WARP DISPATCHER ---
  const handleWarpToNode = useCallback((nodeId) => {
    handleFocusSpatialMap();
    setWarpTargetNodeId(nodeId);
    setHoveredNodeId(nodeId);

    setTimeout(() => {
      setWarpTargetNodeId(null);
    }, 250);
  }, [handleFocusSpatialMap]);

// Universal Polyglot Runner command mapping for interactive terminal sessions
function getTerminalRunCommand(filePath, shellType = 'powershell') {
  if (!filePath) return '';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const cleanPath = filePath.replace(/\\/g, '/');
  const isPs = shellType === 'powershell';
  const isCmd = shellType === 'cmd';

  switch (ext) {
    case 'py':
    case 'pyw':
      return `python -u "${cleanPath}"`;
    case 'js':
    case 'mjs':
    case 'cjs':
      return `node "${cleanPath}"`;
    case 'ts':
    case 'mts':
    case 'cts':
      return `npx tsx "${cleanPath}"`;
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c++':
      if (isPs) return `g++ -O2 "${cleanPath}" -o "a.exe"; if ($?) { & ".\\a.exe" }`;
      if (isCmd) return `g++ -O2 "${cleanPath}" -o a.exe && a.exe`;
      return `g++ -O2 "${cleanPath}" -o a.out && ./a.out`;
    case 'c':
      if (isPs) return `gcc -O2 "${cleanPath}" -o "a.exe"; if ($?) { & ".\\a.exe" }`;
      if (isCmd) return `gcc -O2 "${cleanPath}" -o a.exe && a.exe`;
      return `gcc -O2 "${cleanPath}" -o a.out && ./a.out`;
    case 'rs':
      if (isPs) return `rustc -O "${cleanPath}" -o "a.exe"; if ($?) { & ".\\a.exe" }`;
      if (isCmd) return `rustc -O "${cleanPath}" -o a.exe && a.exe`;
      return `rustc -O "${cleanPath}" -o a.out && ./a.out`;
    case 'go':
      return `go run "${cleanPath}"`;
    case 'java':
      return `java "${cleanPath}"`;
    case 'cs':
      return `dotnet run`;
    case 'php':
      return `php "${cleanPath}"`;
    case 'rb':
      return `ruby "${cleanPath}"`;
    case 'lua':
      return `lua "${cleanPath}"`;
    case 'pl':
      return `perl "${cleanPath}"`;
    case 'sh':
      return `bash "${cleanPath}"`;
    case 'ps1':
      return `powershell -ExecutionPolicy Bypass -File "${cleanPath}"`;
    case 'bat':
    case 'cmd':
      return isPs ? `& "${cleanPath}"` : `"${cleanPath}"`;
    case 'exe':
      return isPs ? `& ".\\${cleanPath}"` : `"${cleanPath}"`;
    default:
      return isPs ? `& "${cleanPath}"` : `"${cleanPath}"`;
  }
}

  // UNIVERSAL POLYGLOT CODE RUNNER (Subfolder & Multi-Language Engine with Stdin)
  const handleRunCode = useCallback(async (targetFileOverride) => {
    const fileToRun = (typeof targetFileOverride === 'string' && targetFileOverride)
      ? targetFileOverride
      : workspace.currentFile;

    if (!fileToRun || isImageFile || isUnsupportedFile) return;

    // If active file is dirty, save it before executing so latest changes run
    if (dirtyFiles.has(fileToRun)) {
      handleSaveFile(fileToRun, currentCodeBufferRef.current[fileToRun]);
    }

    // Always reveal the bottom execution panel
    setLayout(prev => ({ ...prev, terminal: true }));

    // Switch to the dedicated Output tab for clean compilation and execution streaming
    workspace.setActiveSessionId('output');

    const activeExt = fileToRun.split('.').pop()?.toLowerCase();
    const isCompiled = ['cpp', 'cc', 'cxx', 'c++', 'c', 'rs', 'go', 'java', 'cs', 'kt', 'swift', 'scala', 'hs'].includes(activeExt);
    const actionText = isCompiled ? 'Compiling & Running' : 'Running';

    // 1. Primary: Universal Backend Polyglot Runner with STDIN
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.addNotification?.('info', actionText, `${fileToRun}`, 'runtime');
      workspace.setTerminalLogs([
        { text: `[${actionText}] ${fileToRun}`, isSystem: true }
      ]);
      workspace.wsRef.current.send(JSON.stringify({
        event: 'RUN_CODE',
        filename: fileToRun,
        stdin: stdin || ""
      }));
      return;
    }

    // 2. Web browser fallback for Python via Pyodide WASM
    if (activeExt === 'py' && isCompilerReady && window.pyodide) {
      workspace.addNotification?.('info', 'Running', `${fileToRun} (Browser WASM)`, 'runtime');
      workspace.setTerminalLogs([{ text: `[Running] ${fileToRun} (Browser WASM)`, isSystem: true }]);
      try {
        window.pyodide.setStdin({ 
          stdin: () => { 
            const lines = (stdin || "").split('\n'); 
            return lines.length > 0 ? lines.shift() : ""; 
          }
        });
        await window.pyodide.runPythonAsync(activeCodeStr);
        workspace.setTerminalLogs(prev => [...prev, { text: `[Done] exited with code 0`, isSystem: true }]);
        workspace.addNotification?.('success', 'Execution Succeeded', `${fileToRun} exited with code 0`, 'runtime');
      } catch (error) { 
        workspace.setTerminalLogs(prev => [...prev, { text: error.message, isError: true }]); 
        workspace.addNotification?.('error', 'Execution Error', error.message, 'runtime');
      }
    }
  }, [workspace, setLayout, isCompilerReady, stdin, activeCodeStr, dirtyFiles, handleSaveFile, isImageFile, isUnsupportedFile]);

  handleRunCodeRef.current = handleRunCode;

  // INTERACTIVE TERMINAL CODE RUNNER (Persistent Games, Servers, REPLs)
  const handleRunInTerminal = useCallback((targetFileOverride) => {
    const fileToRun = (typeof targetFileOverride === 'string' && targetFileOverride)
      ? targetFileOverride
      : workspace.currentFile;

    if (!fileToRun || isImageFile || isUnsupportedFile) return;

    // If active file is dirty, save it before executing
    if (dirtyFiles.has(fileToRun)) {
      handleSaveFile(fileToRun, currentCodeBufferRef.current[fileToRun]);
    }

    // Reveal the bottom execution panel
    setLayout(prev => ({ ...prev, terminal: true }));

    // Find an idle interactive terminal session, or create a new one
    let targetSession = workspace.terminalSessions.find(s => s.id !== 'output' && !s.isRunning);
    let sessionId;
    let shellType;

    if (targetSession) {
      sessionId = targetSession.id;
      shellType = targetSession.shellType || 'powershell';
      workspace.setActiveSessionId(sessionId);
    } else {
      const created = workspace.createTerminalSession('powershell');
      sessionId = created.id;
      shellType = created.shellType;
    }

    const runCmd = getTerminalRunCommand(fileToRun, shellType);
    if (runCmd && sessionId) {
      workspace.sendTerminalCommand(sessionId, runCmd, shellType);
      workspace.addNotification?.('info', 'Terminal Launch', `Running ${fileToRun} in ${shellType}`, 'runtime');
    }
  }, [workspace, setLayout, dirtyFiles, handleSaveFile, isImageFile, isUnsupportedFile]);

  const handleSwitchFile = useCallback((filename) => { 
    if (!filename) return;
    const cleanFile = filename.replace(/\\/g, '/');
    if ((settings?.autoSave ?? true) && workspace.currentFile && workspace.currentFile !== cleanFile && dirtyFiles.has(workspace.currentFile)) {
      handleSaveFile(workspace.currentFile, currentCodeBufferRef.current[workspace.currentFile]);
    }
    //  0ms Optimistic UI updates: instantly select tab, update path & breadcrumbs
    workspace.setCurrentFile(cleanFile);
    workspace.setOpenFiles(prev => prev.includes(cleanFile) ? prev : [...prev, cleanFile]);
    if (cleanFile !== workspace.currentFile) { 
      workspace.setIsFileSyncing(true); 
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: cleanFile })); 
    }

    setLayoutTree(prev => {
      const tabId = `file:${cleanFile}`;
      const all = getAllPanes(prev);

      // Check 1: Is this file ALREADY OPEN in any pane?
      const existingPane = findPaneByTabId(prev, tabId);
      if (existingPane) {
        setActivePaneId(existingPane.id);
        if (isEditorPane(existingPane)) {
          setLastActiveEditorPaneId(existingPane.id);
        }
        return setActiveTabInPane(prev, existingPane.id, tabId);
      }

      // Check 2: Determine target editor pane (strictly an editor pane - never map, never terminal, never agent/input)
      const targetEditorPane = getCandidateEditorPane(prev, activePaneId, lastActiveEditorPaneId);

      const baseName = cleanFile.split('/').pop();
      const newTab = {
        id: tabId,
        type: 'file',
        path: cleanFile,
        title: baseName
      };

      if (targetEditorPane) {
        setActivePaneId(targetEditorPane.id);
        setLastActiveEditorPaneId(targetEditorPane.id);
        return addTabToPane(prev, targetEditorPane.id, newTab);
      }

      // Check 3: If NO editor pane exists (e.g. only Map + Terminal + Agent are open),
      // automatically split the Map horizontally!
      const mapPane = all.find(isMapPane);
      if (mapPane) {
        const splitResult = splitPane(prev, mapPane.id, 'horizontal', newTab, false);
        setActivePaneId(splitResult.newPaneId);
        setLastActiveEditorPaneId(splitResult.newPaneId);
        return splitResult.tree;
      }

      const fallbackPane = all[0];
      if (fallbackPane) {
        const splitResult = splitPane(prev, fallbackPane.id, 'horizontal', newTab, false);
        setActivePaneId(splitResult.newPaneId);
        setLastActiveEditorPaneId(splitResult.newPaneId);
        return splitResult.tree;
      }

      return prev;
    });
  }, [workspace, settings?.autoSave, dirtyFiles, handleSaveFile, activePaneId, lastActiveEditorPaneId]);

  const handleCloseTab = useCallback((fileToClose, e) => {
    if (e) e.stopPropagation();
    setDirtyFiles(prev => {
      if (!prev.has(fileToClose)) return prev;
      const next = new Set(prev);
      next.delete(fileToClose);
      return next;
    });
    delete currentCodeBufferRef.current[fileToClose];
    if (workspace.closeFile) {
      workspace.closeFile(fileToClose, (newActive) => {
        if (!newActive) {
          handleFocusSpatialMap();
        }
      });
    }

    setLayoutTree(prev => {
      const tabId = `file:${fileToClose}`;
      const panesWithTab = getAllPanes(prev).filter(p => (p.tabs || []).some(t => t.id === tabId));
      let cur = prev;
      for (const p of panesWithTab) {
        cur = removeTabFromPane(cur, p.id, tabId);
      }
      return cur;
    });
  }, [workspace, handleFocusSpatialMap]);

  const handleOpenFolder = useCallback(() => { 
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) { 
      workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' })); 
    } 
  }, [workspace]);

  const handleCreateItem = useCallback((name, type = 'file') => { 
    workspace.setIsFileSyncing(true); 
    workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); 
    if (type === 'file' || !type) {
      handleSwitchFile(name);
    }
  }, [workspace, handleSwitchFile]);

  const handleDeleteFile = useCallback((f, e) => { 
    if (e) e.stopPropagation(); 
    const shouldConfirm = settings?.confirmDelete ?? true;
    if (!shouldConfirm || window.confirm(`Delete ${f}?`)) {
      workspace.wsRef.current?.send(JSON.stringify({ event: 'DELETE_FILE', filename: f })); 
    }
  }, [workspace, settings?.confirmDelete]);

  const onDoubleClickNode = useCallback((filePath, line) => {
    if (filePath) {
      handleSwitchFile(filePath);
    }
    setEditorFocusLine(line || 1);
  }, [handleSwitchFile]);

  // STABLE WEBGPU HOVER ROUTER
  const handleNodeHover = useCallback((isHovering, id) => {
    const nextHoverId = (isHovering && id) ? id : null;
    setHoveredNodeId(nextHoverId);
    
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    
    if (nextHoverId) {
      workspace.setAiInsight(null);
      hoverTimerRef.current = setTimeout(() => {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          const targetNode = nodesMap.get(nextHoverId);
          if (targetNode?.data?.code) {
            workspace.setAiInsight({
              nodeId: nextHoverId,
              summary: "Analyzing AST topology & dependencies..." 
            });
            workspace.wsRef.current.send(JSON.stringify({ 
              event: 'REQUEST_LLM_SUMMARY', 
              node_id: nextHoverId, 
              code: targetNode.data.code 
            }));
          }
        }
      }, 550);
    } else {
      workspace.setAiInsight(null);
    }
  }, [workspace.wsRef, nodesMap, workspace]);

  // --- INIT PYODIDE ENGINE (Deferred until splash completes so startup animation runs at full 60fps) ---
  useEffect(() => { 
    if (!minSplashElapsed) return;

    const timer = setTimeout(() => {
      loadPyodideEngine(
        (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]), 
        (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])
      ).then(() => setIsCompilerReady(true)).catch(() => {}); 
    }, 600);

    return () => clearTimeout(timer);
  }, [minSplashElapsed, workspace]);

    const allModularPanes = useMemo(() => getAllPanes(layoutTree), [layoutTree]);
  const canCloseSplit = allModularPanes.length > 1;

  const handleSplitActivePane = useCallback((direction) => {
    setLayoutTree(prev => {
      const active = findPaneById(prev, activePaneId) || getAllPanes(prev)[0];
      if (!active) return prev;

      const activeTab = (active.tabs || []).find(t => t.id === active.activeTabId) || active.tabs?.[0];
      if (!activeTab) return prev;

      if ((active.tabs || []).length > 1) {
        const moved = moveTab(prev, active.id, active.id, activeTab.id, direction === 'horizontal' ? 'right' : 'bottom');
        setActivePaneId(moved.activePaneId);
        return moved.tree;
      }

      const duplicateTab = {
        ...activeTab,
        id: activeTab.type === 'file' ? activeTab.id : `${activeTab.id}_split_${Date.now()}`
      };
      const result = splitPane(prev, active.id, direction, duplicateTab, false);
      setActivePaneId(result.newPaneId);
      return result.tree;
    });
  }, [activePaneId]);

  const handleCloseActivePane = useCallback(() => {
    setLayoutTree(prev => {
      const all = getAllPanes(prev);
      if (all.length <= 1) return prev;
      const targetPane = findPaneById(prev, activePaneId) || all[0];
      if (!targetPane) return prev;
      const updated = closePane(prev, targetPane.id);
      const remaining = getAllPanes(updated);
      if (remaining.length > 0) {
        setActivePaneId(remaining[0].id);
      }
      return updated;
    });
  }, [activePaneId]);

  const handleAddTabToActivePane = useCallback((tab) => {
    if (tab.type === 'file' && tab.path) {
      handleSwitchFile(tab.path);
      return;
    }
    setLayoutTree(prev => {
      const all = getAllPanes(prev);
      let targetPane = findPaneById(prev, activePaneId) || all[0];
      if (tab.type === 'spatial') {
        const existingMapPane = all.find(isMapPane);
        if (existingMapPane) {
          setActivePaneId(existingMapPane.id);
          return setActiveTabInPane(prev, existingMapPane.id, 'spatial');
        }
      } else if (targetPane && isMapPane(targetPane)) {
        const candidate = getCandidateEditorPane(prev, activePaneId, lastActiveEditorPaneId);
        if (candidate) {
          targetPane = candidate;
        }
      }
      if (!targetPane) return prev;
      setActivePaneId(targetPane.id);
      if (!isMapPane(targetPane)) {
        setLastActiveEditorPaneId(targetPane.id);
      }
      return addTabToPane(prev, targetPane.id, tab);
    });
  }, [activePaneId, lastActiveEditorPaneId, handleSwitchFile]);

  if (isSplashVisible) {
    return (
      <SplashScreen 
        session={session} 
        isGraphLoaded={workspace.isGraphLoaded} 
        isCompilerReady={isCompilerReady} 
        onLogin={handleLogin} 
      />
    );
  }
  
  return (
    <div 
      className="w-screen h-screen flex flex-col font-sans overflow-hidden relative select-none overscroll-none"
      style={{
        backgroundColor: 'var(--theme-background, #121314)',
        color: 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        updateSetting={updateSetting} 
        initialTab={settingsInitialTab} 
      />
      
      {/*  Sleek Custom TopBar (With Active Save, Auto Save & Open Recent) */}
      <TopBar 
        onOpenFolder={handleOpenFolder} 
        onOpenRecent={handleOpenRecentWorkspace}
        onSave={() => handleSaveFile()}
        autoSave={settings?.autoSave ?? true}
        onToggleAutoSave={handleToggleAutoSave}
        onCreateFile={() => { const name = prompt("Enter new file name:"); if (name) handleCreateItem(name, 'file'); }} 
        onOpenSettings={handleOpenSettings} 
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} 
        layout={effectiveLayout} 
        setLayout={handleToggleLayout} 
        onApplyLayoutPreset={handleApplyLayoutPreset}
        isCommandPaletteOpen={isCommandPaletteOpen}
        setIsCommandPaletteOpen={setIsCommandPaletteOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        workspace={workspace}
        onRunCode={handleRunCode}
        onRunInTerminal={handleRunInTerminal}
        onWarpToNode={handleWarpToNode}
        onSwitchFile={handleSwitchFile}
        onSplitPane={handleSplitActivePane}
        onClosePane={handleCloseActivePane}
        onAddTabToPane={handleAddTabToActivePane}
        canCloseSplit={canCloseSplit}
      />
      
      <div className="flex flex-row flex-grow overflow-hidden">
        <ActivityBar 
          layout={layout} 
          setLayout={setLayout} 
          activeSidebarView={activeSidebarView}
          setActiveSidebarView={setActiveSidebarView}
          gitChangeCount={(() => {
            const staged = workspace.gitDetailedStatus?.staged || [];
            const unstaged = workspace.gitDetailedStatus?.unstaged || [];
            const knownPaths = new Set([...staged.map(f => f.path), ...unstaged.map(f => f.path)]);
            let extraDirty = 0;
            dirtyFiles.forEach(df => {
              if (!knownPaths.has(df)) extraDirty++;
            });
            const total = staged.length + unstaged.length + extraDirty;
            return total > 0 ? total : Object.values(workspace.gitStatuses || {}).filter(s => s === 'M' || s === 'U' || s === 'A' || s === 'D').length;
          })()}
          isSettingsOpen={isSettingsOpen}
          onOpenSettings={() => isSettingsOpen ? setIsSettingsOpen(false) : handleOpenSettings('general')} 
          session={session}
          onLogin={handleLogin}
          onLogout={handleLogout} 
        />
        <Group orientation="horizontal" className="flex-grow overflow-hidden" autoSaveId="neuron-layout-v12">
          {layout.sidebar && (
            <>
              <Panel 
                id="sidebar" 
                order={1} 
                defaultSize={200} 
                minSize={100} 
                maxSize={500} 
                style={{ backgroundColor: 'var(--theme-secondary, #191a1b)' }}
              >
                {activeSidebarView === 'git' ? (
                  <SourceControlPanel 
                    isGitRepo={workspace.isGitRepo}
                    gitBranch={workspace.gitBranch}
                    repoName={workspace.repoName}
                    gitDetailedStatus={workspace.gitDetailedStatus}
                    gitGraph={workspace.gitGraph}
                    dirtyFiles={dirtyFiles}
                    onSwitchFile={handleSwitchFile}
                    onCommit={handleGitCommit}
                    onPush={workspace.pushGitChanges}
                    onStageFile={workspace.stageGitFile}
                    onUnstageFile={workspace.unstageGitFile}
                    onDiscardFile={workspace.discardGitFile}
                    onStageAll={workspace.stageAllGit}
                    onDiscardAll={workspace.discardAllGit}
                    onRefresh={workspace.refreshGitGraph}
                  />
                ) : activeSidebarView === 'ai' ? (
                  <AiSidebar 
                    conversations={aiStudio.conversations}
                    activeConversationId={aiStudio.activeConversationId}
                    isStreaming={aiStudio.isStreaming}
                    onSelectConversation={(id) => {
                      if (aiStudio.isStreaming) {
                        workspace.addNotification?.('warning', 'Agent Busy', 'Please wait for current generation to finish or click Stop before switching conversations.', 'ai');
                        return;
                      }
                      aiStudio.handleSelectConversation(id);
                      setLayout(prev => ({ ...prev, stdin: true }));
                      window.dispatchEvent(new CustomEvent('neuron-switch-right-panel-tab', { detail: 'ai' }));
                    }}
                    onCreateConversation={() => {
                      if (aiStudio.isStreaming) {
                        workspace.addNotification?.('warning', 'Agent Busy', 'Please wait for current generation to finish or click Stop before creating a new conversation.', 'ai');
                        return;
                      }
                      aiStudio.handleCreateConversation();
                      setLayout(prev => ({ ...prev, stdin: true }));
                      window.dispatchEvent(new CustomEvent('neuron-switch-right-panel-tab', { detail: 'ai' }));
                    }}
                    onDeleteConversation={aiStudio.handleDeleteConversation}
                    projectName={workspace.repoName || (workspace.absTargetDir ? workspace.absTargetDir.split(/[\\/]/).pop() : "Neuron")}
                    isCollapsed={false}
                    onToggleCollapse={() => setActiveSidebarView('explorer')}
                  />
                ) : (
                  <Sidebar 
                    items={workspace.items} 
                    currentFile={workspace.currentFile} 
                    absTargetDir={workspace.absTargetDir} 
                    gitStatuses={workspace.gitStatuses} 
                    dirtyFiles={dirtyFiles}
                    onSwitchFile={handleSwitchFile} 
                    onCreateItem={handleCreateItem} 
                    onDeleteFile={handleDeleteFile} 
                    onRunFile={handleRunCode} 
                    onRunFileInTerminal={handleRunInTerminal}
                    onRenameItem={(item) => { 
                      const oldPath = item.old_path || item.path;
                      const newPath = item.new_path || item.newPath;
                      if (oldPath && newPath && workspace.wsRef.current?.readyState === WebSocket.OPEN) {
                        workspace.wsRef.current.send(JSON.stringify({ 
                          event: 'RENAME_ITEM', 
                          old_path: oldPath, 
                          new_path: newPath 
                        }));
                      }
                    }} 
                    onMoveItem={(src, dest) => workspace.wsRef.current?.send(JSON.stringify({ event: 'MOVE_ITEM', src_path: src, dest_folder: dest }))} 
                    onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))} 
                    onRefresh={() => workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename: workspace.currentFile }))} 
                  />
                )}
              </Panel>
              {/* RAZOR-THIN 1PX RESIZE DIVIDER (Sidebar) */}
              <Separator 
                className="w-[1px] h-full shrink-0 hover:bg-[var(--theme-accent)] cursor-col-resize z-50 flex justify-center transition-colors outline-none" 
                style={{ backgroundColor: 'var(--theme-border, #242628)' }}
              />
            </>
          )}

          <Panel id="modular-workspace" order={2} className="flex flex-col min-w-0 min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--theme-background, #121314)' }}>
            <ModularWorkspace
              layoutTree={layoutTree}
              setLayoutTree={setLayoutTree}
              activePaneId={activePaneId}
              setActivePaneId={setActivePaneId}
              onActivatePane={handleActivatePane}
              lastActiveEditorPaneId={lastActiveEditorPaneId}
              onActiveFileChange={handleSwitchFile}
              workspace={workspace}
              simDataRef={simDataRef}
              activeRay={activeRay}
              focusIsolationId={focusIsolationId}
              warpTargetNodeId={warpTargetNodeId}
              refactorEnabled={refactorEnabled}
              refactorFeedback={refactorFeedback}
              setRefactorFeedback={showRefactorFeedback}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              handleRefactorDrop={handleRefactorDrop}
              handleFileMergeDrop={handleFileMergeDrop}
              handleNodeHover={handleNodeHover}
              onDoubleClickNode={onDoubleClickNode}
              hoveredNodeId={hoveredNodeId}
              cspRejection={cspRejection}
              setCspRejection={setCspRejection}
              handleCreateItem={handleCreateItem}
              getCodeForFile={getCodeForFile}
              dirtyFiles={dirtyFiles}
              settings={settings}
              editorFocusLine={editorFocusLine}
              setEditorFocusLine={setEditorFocusLine}
              handleCodeChange={handleCodeChange}
              handleSaveFile={handleSaveFile}
              stdin={stdin}
              setStdin={setStdin}
              aiStudio={aiStudio}
              handleOpenSettings={handleOpenSettings}
              onRunCode={handleRunCode}
              onRunInTerminal={handleRunInTerminal}
            />
          </Panel>

        </Group>
      </div>

      {/*  HORIZON 3: AI AGENT SUPERVISOR LIVE PR BLAST RADIUS HUD */}
      {blastProtectionEnabled && workspace.agentBatch && (
        <AgentSupervisorHUD 
          agentBatch={workspace.agentBatch}
          onRollback={workspace.rollbackAgentBatch}
          onApprove={workspace.approveAgentBatch}
          onDismiss={workspace.dismissAgentBatch}
          onWarpToNode={handleWarpToNode}
          onSwitchFile={handleSwitchFile}
        />
      )}

      {/*  BOTTOM STATUS BAR (#191a1b Secondary Theme) */}
      <StatusBar 
        activeFile={workspace.currentFile} 
        lineCount={isImageFile || isUnsupportedFile ? "" : (activeCodeStr?.split("\n").length || 0).toString()} 
        wordCount={isImageFile || isUnsupportedFile ? "" : (activeCodeStr?.trim().split(/\s+/).length || 0).toString()} 
        language={workspace.currentFile?.split('.').pop() || 'plaintext'} 
        nodes={workspace.nodes || []}
        edges={workspace.edges || []}
        gitStatuses={workspace.gitStatuses || {}}
        gitBranch={workspace.gitBranch || "main"}
        isGitRepo={Boolean(workspace.isGitRepo)}
        repoName={workspace.repoName || ""}
        absTargetDir={workspace.absTargetDir || ""}
        isDirty={dirtyFiles.has(workspace.currentFile)}
        isSaving={isSaving}
        refactorEnabled={refactorEnabled}
        onToggleRefactor={() => setRefactorEnabled(prev => !prev)}
        blastProtectionEnabled={blastProtectionEnabled}
        onToggleBlastProtection={handleToggleBlastProtection}
        onCenterSpatialMap={handleFocusSpatialMap}
        notifications={workspace.notifications}
        onClearNotifications={workspace.clearNotifications}
        onDismissNotification={workspace.dismissNotification}
        onMarkAllNotificationsRead={workspace.markAllNotificationsRead}
      />
    </div>
  );
}