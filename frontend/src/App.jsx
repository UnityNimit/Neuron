// src/App.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { FileCode2, Network, Loader2, X, Play, AlertOctagon } from 'lucide-react';

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

// THE 100K NODE WEBGPU ENGINE (Pure Hardware Acceleration)
import PixiSpatialEngine from './components/canvas/PixiSpatialEngine';
import SpatialMinimap from './components/canvas/SpatialMinimap';
import { applyTheme, getCurrentThemeId } from './config/themeConfig';
import AntigravitySidebar from './components/ai/AntigravitySidebar';

// Layout & UI
import CodeEditor from './components/layout/CodeEditor';
import ImageViewer from './components/layout/ImageViewer';
import UnsupportedFileViewer from './components/layout/UnsupportedFileViewer';
import TopBar from './components/layout/TopBar';
import ActivityBar from './components/layout/ActivityBar';
import Sidebar from './components/layout/Sidebar';
import SourceControlPanel from './components/layout/SourceControlPanel';
import SettingsModal from './components/layout/SettingsModal';
import StatusBar from './components/layout/StatusBar';
import TerminalPanel from './components/layout/TerminalPanel';
import RightPanelContainer from './components/layout/RightPanelContainer';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('general');

  const handleOpenSettings = useCallback((tab = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompilerReady, setIsCompilerReady] = useState(false);
  
  const [editorFocusLine, setEditorFocusLine] = useState(null);
  const [focusIsolationId, setFocusIsolationId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // --- 🚀 HORIZON 2: CAMERA WARP TARGET STATE ---
  const [warpTargetNodeId, setWarpTargetNodeId] = useState(null);

  // --- VS CODE-STYLE DIRTY/UNSAVED FILES TRACKER ---
  const [dirtyFiles, setDirtyFiles] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const currentCodeBufferRef = useRef({});
  const autoSaveTimerRef = useRef(null);

  // --- AI & REFACTORING TRANSACTION REFS ---
  const hoverTimerRef = useRef(null);
  const pendingRefactorRef = useRef(null);
  const [cspRejection, setCspRejection] = useState(null);
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

  // --- ACTIVATE WEBGPU PURE-RAM PHYSICS ENGINE ---
  const { simDataRef, onDragStart, onDragMove, onDragEnd } = usePhysicsEngine(
    workspace.nodes || [], 
    workspace.edges || [], 
    workspace.wsRef, 
    workspace.isGraphLoaded, 
    centerView,
    settings?.physicsSimulation ?? true
  );

  // --- 🛡️ PERMANENT DESKTOP & WEB AUTH RESOLVER ---
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

  // --- 🚀 ATOMIC SAVE & AUTO-SAVE CONTROLLER ---
  const activeCodeStr = useMemo(() => {
    if (!workspace.currentFile) return "";
    const fileNode = nodesMap.get(workspace.currentFile);
    return (fileNode && fileNode.data?.nodeType === 'file') ? (fileNode.data?.code || "") : "";
  }, [nodesMap, workspace.currentFile]);

  // --- 🚀 FILE TYPE CLASSIFIER (Images, Unsupported Binaries, Code) ---
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

      // Optimistically clear dirty indicator
      setDirtyFiles(prev => {
        if (!prev.has(target)) return prev;
        const next = new Set(prev);
        next.delete(target);
        return next;
      });

      // Reset saving indicator after brief visual feedback
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [workspace.currentFile, workspace.wsRef, activeCodeStr]);

  const handleCodeChange = useCallback((newCode, targetFile) => {
    const file = targetFile || workspace.currentFile;
    if (!file) return;

    currentCodeBufferRef.current[file] = newCode;
    
    // 🚀 ALWAYS immediately mark file as dirty on any code edit (0ms latency)
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

  // Centralized Google Antigravity Studio State Controller
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
      // 🚀 Save Active File (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { 
        e.preventDefault(); 
        handleSaveFile(); 
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
        else if (data.event === 'REFACTOR_SUCCESS' || data.event === 'REFACTOR_FILE_MERGE_SUCCESS') {
          setCspRejection(null);
          pendingRefactorRef.current = null;
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleWsEvents);
    return () => ws.removeEventListener('message', handleWsEvents);
  }, [workspace.isWsConnected, hoveredNodeId]);

  // --- FUNCTION-TO-FILE AST TRANSPLANT DISPATCHER ---
  const handleRefactorDrop = useCallback(({ symbolName, sourceFile, destFile, nodeId, originalPos }) => {
    if (!refactorEnabled) {
      workspace.addNotification?.('info', 'Refactor Disabled', 'Toggle Refactor ON in the bottom status bar to move functions or merge files.', 'ai');
      return;
    }
    pendingRefactorRef.current = { symbolName, sourceFile, destFile, nodeId, originalPos };
    
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_SYMBOL_MOVE',
        symbol_name: symbolName,
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef, refactorEnabled, workspace.addNotification]);

  // --- FILE-TO-FILE FUSION DISPATCHER ---
  const handleFileMergeDrop = useCallback(({ sourceFile, destFile }) => {
    if (!refactorEnabled) {
      workspace.addNotification?.('info', 'Refactor Disabled', 'Toggle Refactor ON in the bottom status bar to move functions or merge files.', 'ai');
      return;
    }
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      workspace.wsRef.current.send(JSON.stringify({
        event: 'REFACTOR_FILE_MERGE',
        source_file: sourceFile,
        dest_file: destFile
      }));
    }
  }, [workspace.wsRef, refactorEnabled, workspace.addNotification]);

  // --- 🚀 3D CAMERA WARP DISPATCHER ---
  const handleWarpToNode = useCallback((nodeId) => {
    setCenterView('spatial');
    setWarpTargetNodeId(nodeId);
    setHoveredNodeId(nodeId);

    setTimeout(() => {
      setWarpTargetNodeId(null);
    }, 250);
  }, [setCenterView]);

  // 🚀 UNIVERSAL POLYGLOT CODE RUNNER (C++, C, Java, Python, JS)
  const handleRunCode = useCallback(async () => {
    if (!workspace.currentFile || isImageFile || isUnsupportedFile) return;

    // If active file is dirty, save it before executing so latest changes run
    if (workspace.currentFile && dirtyFiles.has(workspace.currentFile)) {
      handleSaveFile(workspace.currentFile, currentCodeBufferRef.current[workspace.currentFile]);
    }
    workspace.setActiveSessionId('output');
    const activeExt = workspace.currentFile?.split('.').pop()?.toLowerCase();

    // 1. Primary: Run via Backend Compiler Engine with STDIN
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
      const isCompiled = ['cpp', 'cc', 'cxx', 'c', 'rs'].includes(activeExt);
      const actionText = isCompiled ? 'Compiling & Running' : 'Running';

      workspace.addNotification?.('info', actionText, `${workspace.currentFile}`, 'runtime');
      workspace.setTerminalLogs([
        { text: `[${actionText}] ${workspace.currentFile}`, isSystem: true }
      ]);
      workspace.wsRef.current.send(JSON.stringify({
        event: 'RUN_CODE',
        filename: workspace.currentFile,
        stdin: stdin
      }));
      return;
    }

    // 2. Web browser fallback for Python via Pyodide WASM
    if (activeExt === 'py' && isCompilerReady && window.pyodide) {
      workspace.addNotification?.('info', 'Running', `${workspace.currentFile} (Browser WASM)`, 'runtime');
      workspace.setTerminalLogs([{ text: `[Running] ${workspace.currentFile} (Browser WASM)`, isSystem: true }]);
      try {
        window.pyodide.setStdin({ 
          stdin: () => { 
            const lines = stdin.split('\n'); 
            return lines.length > 0 ? lines.shift() : ""; 
          }
        });
        await window.pyodide.runPythonAsync(activeCodeStr);
        workspace.setTerminalLogs(prev => [...prev, { text: `[Done] exited with code 0`, isSystem: true }]);
        workspace.addNotification?.('success', 'Execution Succeeded', `${workspace.currentFile} exited with code 0`, 'runtime');
      } catch (error) { 
        workspace.setTerminalLogs(prev => [...prev, { text: error.message, isError: true }]); 
        workspace.addNotification?.('error', 'Execution Error', error.message, 'runtime');
      }
    }
  }, [workspace, isCompilerReady, stdin, activeCodeStr, dirtyFiles, handleSaveFile, isImageFile, isUnsupportedFile]);

  const handleSwitchFile = useCallback((filename) => { 
    if (!filename) return;
    setCenterView('editor');
    if ((settings?.autoSave ?? true) && workspace.currentFile && workspace.currentFile !== filename && dirtyFiles.has(workspace.currentFile)) {
      handleSaveFile(workspace.currentFile, currentCodeBufferRef.current[workspace.currentFile]);
    }
    // 🚀 0ms Optimistic UI updates: instantly select tab, update path & breadcrumbs
    workspace.setCurrentFile(filename);
    workspace.setOpenFiles(prev => prev.includes(filename) ? prev : [...prev, filename]);
    if (filename !== workspace.currentFile) { 
      workspace.setIsFileSyncing(true); 
      workspace.wsRef.current?.send(JSON.stringify({ event: 'SWITCH_FILE', filename })); 
    }
  }, [workspace, settings?.autoSave, dirtyFiles, handleSaveFile, setCenterView]);

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
          setCenterView('spatial');
        }
      });
    }
  }, [workspace, setCenterView]);

  const handleOpenFolder = useCallback(() => { 
    if (workspace.wsRef.current?.readyState === WebSocket.OPEN) { 
      workspace.wsRef.current.send(JSON.stringify({ event: 'OPEN_FOLDER_DIALOG' })); 
    } 
  }, [workspace]);

  const handleCreateItem = useCallback((name, type) => { 
    workspace.setIsFileSyncing(true); 
    workspace.wsRef.current?.send(JSON.stringify({ event: 'CREATE_ITEM', item_name: name, item_type: type })); 
  }, [workspace]);

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
    setCenterView('editor');
  }, [handleSwitchFile, setCenterView]);

  // STABLE WEBGPU HOVER ROUTER
  const handleNodeHover = useCallback((isHovering, id) => {
    setHoveredNodeId(isHovering ? id : null);
    
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    
    if (isHovering && id) {
      hoverTimerRef.current = setTimeout(() => {
        if (workspace.wsRef.current?.readyState === WebSocket.OPEN) {
          const targetNode = nodesMap.get(id);
          if (targetNode?.data?.code) {
            workspace.setAiInsight({
              nodeId: id,
              summary: "Analyzing AST topology & dependencies..." 
            });
            workspace.wsRef.current.send(JSON.stringify({ 
              event: 'REQUEST_LLM_SUMMARY', 
              node_id: id, 
              code: targetNode.data.code 
            }));
          }
        }
      }, 550);
    }
  }, [workspace.wsRef, nodesMap, workspace]);

  // --- INIT PYODIDE ENGINE ---
  useEffect(() => { 
    loadPyodideEngine(
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]), 
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])
    ).then(() => setIsCompilerReady(true)); 
  }, [workspace]);

  if (!workspace.isGraphLoaded || !isCompilerReady || workspace.isFolderLoading) {
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
      
      {/* Omni-Search Command Palette */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => { setIsCommandPaletteOpen(false); setSearchQuery(""); }} 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        workspace={workspace} 
        onRunCode={handleRunCode} 
        onOpenSettings={() => handleOpenSettings('general')} 
        onWarpToNode={handleWarpToNode}
        onSwitchFile={handleSwitchFile}
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        updateSetting={updateSetting} 
        initialTab={settingsInitialTab} 
      />
      
      {/* 🚀 Sleek Custom TopBar (With Active Save, Auto Save & Open Recent) */}
      <TopBar 
        onOpenFolder={handleOpenFolder} 
        onOpenRecent={handleOpenRecentWorkspace}
        onSave={() => handleSaveFile()}
        autoSave={settings?.autoSave ?? true}
        onToggleAutoSave={handleToggleAutoSave}
        onCreateFile={() => { const name = prompt("Enter new file name:"); if (name) handleCreateItem(name, 'file'); }} 
        onOpenSettings={handleOpenSettings} 
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} 
        layout={layout} 
        setLayout={setLayout} 
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
          onOpenSettings={() => handleOpenSettings('general')} 
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
                  <AntigravitySidebar 
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
                    onOpenSettings={() => handleOpenSettings('ai')}
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
              {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (Sidebar) */}
              <Separator 
                className="w-[1px] hover:bg-[var(--theme-accent)] cursor-col-resize z-50 flex justify-center transition-colors outline-none" 
                style={{ backgroundColor: 'var(--theme-border, #242628)' }}
              />
            </>
          )}

          <Panel id="main-canvas" order={2} className="flex flex-col" style={{ backgroundColor: 'var(--theme-background, #121314)' }}>
            <Group orientation="vertical" autoSaveId="neuron-vertical-v12">
              <Panel id="canvas-area" order={1} className="relative flex flex-col" style={{ backgroundColor: 'var(--theme-background, #121314)' }}>
                
                {/* ----------------------------------------------------------- */}
                {/* CENTER TAB STRIP (#191a1b & Blue Accent)                    */}
                {/* ----------------------------------------------------------- */}
                <div 
                  className="h-8 shrink-0 flex items-center overflow-x-auto [&::-webkit-scrollbar]:hidden border-b z-40 relative select-none"
                  style={{
                    backgroundColor: 'var(--theme-secondary, #191a1b)',
                    borderColor: 'var(--theme-border, #242628)'
                  }}
                >
                  
                  {/* Spatial Map Tab */}
                  <button 
                    onClick={() => setCenterView('spatial')} 
                    className={`h-full px-3 flex items-center gap-1.5 text-[11px] font-mono font-medium border-r transition-colors shrink-0 cursor-pointer ${
                      centerView === 'spatial' 
                        ? 'border-t-2 border-t-blue-500 font-semibold' 
                        : 'hover:text-[var(--theme-text-bright)]'
                    }`}
                    style={{
                      backgroundColor: centerView === 'spatial' ? 'var(--theme-background, #121314)' : 'var(--theme-secondary, #191a1b)',
                      borderColor: 'var(--theme-border, #242628)',
                      color: centerView === 'spatial' ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-secondary, #94a3b8)'
                    }}
                  >
                    <Network size={12} /> <span>Spatial Map</span>
                  </button>

                  {/* Dynamic Multi-File Tabs (With VS Code Dirty Dot Indicator ●) */}
                  {(workspace.openFiles || []).map(file => {
                    const isDirty = dirtyFiles.has(file);
                    const rawGStat = (workspace.gitStatuses || {})[file];
                    const gStat = (isDirty && (!rawGStat || rawGStat === 'I')) ? 'M' : rawGStat;
                    const isModified = gStat === 'M';
                    const isUntracked = gStat === 'U';
                    const isAdded = gStat === 'A';
                    const isDeleted = gStat === 'D';
                    const isActive = centerView === 'editor' && workspace.currentFile === file;
                    
                    let tabTextColor = "text-[var(--theme-text-muted)]";
                    let iconColor = "text-[var(--theme-text-muted)]";
                    let badgeColor = "";

                    if (isDirty) {
                      tabTextColor = isActive ? "italic text-amber-500 font-semibold" : "italic text-amber-500";
                      iconColor = "text-amber-500";
                      badgeColor = "text-amber-500";
                    } else if (isModified) {
                      tabTextColor = isActive ? "text-amber-500 font-semibold" : "text-amber-500";
                      iconColor = "text-amber-500";
                      badgeColor = "text-amber-500";
                    } else if (isUntracked || isAdded) {
                      tabTextColor = isActive ? "text-emerald-500 font-semibold" : "text-emerald-500";
                      iconColor = "text-emerald-500";
                      badgeColor = "text-emerald-500";
                    } else if (isDeleted) {
                      tabTextColor = "text-red-500 line-through";
                      iconColor = "text-red-500";
                      badgeColor = "text-red-500";
                    } else if (isActive) {
                      tabTextColor = "text-[var(--theme-text-bright)]";
                      iconColor = "text-[var(--theme-accent)]";
                    }
                    
                    return (
                      <div 
                        key={file} 
                        onClick={() => handleSwitchFile(file)} 
                        className={`h-full px-3 flex items-center gap-2 text-[11px] font-mono font-medium border-r transition-colors cursor-pointer shrink-0 group ${
                          isActive 
                            ? 'border-t-2 border-t-[var(--theme-accent)] font-semibold' 
                            : 'hover:text-[var(--theme-text-bright)]'
                        }`}
                        style={{
                          backgroundColor: isActive ? 'var(--theme-background, #121314)' : 'var(--theme-secondary, #191a1b)',
                          borderColor: 'var(--theme-border, #242628)'
                        }}
                      >
                        <FileCode2 size={12} className={iconColor} /> 
                        
                        <span className={tabTextColor}>
                          {file.split('/').pop()}
                        </span>
                        
                        {gStat && gStat !== 'I' && (
                          <span className={`text-[10px] font-mono font-bold ${badgeColor} pr-0.5`}>
                            {gStat}
                          </span>
                        )}

                        {workspace.isFileSyncing && workspace.currentFile === file && (
                          <Loader2 size={11} className="text-[var(--theme-accent)] animate-spin" />
                        )}
                        
                        {/* 🚀 VS CODE-STYLE CLOSE BUTTON OR DIRTY CIRCLE (●) */}
                        <button 
                          onClick={(e) => handleCloseTab(file, e)} 
                          className="rounded p-0.5 ml-1 transition-all text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)] flex items-center justify-center relative w-4 h-4 group/btn"
                          title={isDirty ? "Unsaved changes (Click to close)" : "Close Tab"}
                        >
                          {isDirty ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-400 group-hover/btn:opacity-0 transition-opacity" />
                              <X size={12} className="opacity-0 group-hover/btn:opacity-100 transition-opacity absolute inset-0 m-auto text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-bright)]" />
                            </>
                          ) : (
                            <X size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)]" />
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {/* 🚀 HOLLOW WHITE TRIANGLE RUN BUTTON (F5) */}
                  {!isImageFile && !isUnsupportedFile && (
                    <div className="ml-auto flex items-center pr-2.5 shrink-0">
                      <button 
                        onClick={handleRunCode} 
                        className="w-7 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
                        title="Run Active File (F5)"
                      >
                        <Play size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  )}

                </div>

                <div 
                  className="flex-grow relative overflow-hidden"
                  style={{ backgroundColor: 'var(--theme-background, #121314)' }}
                >
                  {centerView === 'spatial' ? (
                    <div className="relative w-full h-full">
                      {/* 🌌 THE WEBGPU SPATIAL ENGINE 🌌 */}
                      <PixiSpatialEngine 
                        simDataRef={simDataRef}
                        activeRay={activeRay}
                        focusIsolationId={focusIsolationId}
                        blastRadius={workspace.blastRadius}
                        cspRejectionEvent={cspRejection}
                        warpTargetNodeId={warpTargetNodeId}
                        refactorEnabled={refactorEnabled}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onRefactorDrop={handleRefactorDrop}
                        onFileMergeDrop={handleFileMergeDrop}
                        onNodeHover={handleNodeHover}
                        onNodeDoubleClick={onDoubleClickNode}
                        settings={settings}
                      />

                      {/* 📡 SPATIAL RADAR MINIMAP OVERLAY */}
                      {(settings?.spatialMinimap ?? true) && (
                        <SpatialMinimap 
                          nodes={workspace.nodes || []} 
                          simDataRef={simDataRef} 
                        />
                      )}
                      
                      {/* 🚀 SUPER-MINIMALIST FLOATING AI OVERVIEW PANEL */}
                      {workspace.aiInsight && workspace.aiInsight.nodeId === hoveredNodeId && (
                        <div 
                          className="absolute top-4 right-4 max-w-sm border rounded-xl p-3.5 z-[100] pointer-events-none animate-in fade-in duration-150"
                          style={{
                            backgroundColor: 'var(--theme-surface, #141516)',
                            borderColor: 'var(--theme-border, #242628)',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
                          }}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-[var(--theme-accent)] truncate">
                                {workspace.aiInsight.nodeId.split('::').pop()?.replace('()', '')}
                              </span>
                              <span className="font-mono text-[10px] text-[var(--theme-text-muted)] truncate shrink-0">
                                {workspace.aiInsight.nodeId.split('::')[0]}
                              </span>
                            </div>
                            <p className="text-[var(--theme-text-primary)] font-sans text-xs leading-relaxed">
                              {workspace.aiInsight.summary}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* --- FLOATING CSP REFACTORING VIOLATION ALERT --- */}
                      {cspRejection && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-full bg-[#1c0808]/95 border border-red-800/80 shadow-[0_0_50px_rgba(239,68,68,0.3)] rounded-xl p-4 z-[100] backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
                          <div className="flex items-start gap-3">
                            <AlertOctagon size={20} className="text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-red-200 font-mono text-xs font-bold uppercase tracking-wider">
                                  Refactoring Guard: {cspRejection.violationType}
                                </h4>
                                <button 
                                  onClick={() => setCspRejection(null)} 
                                  className="text-red-400 hover:text-red-200 p-0.5"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <p className="text-slate-300 font-sans text-xs mt-1.5 leading-relaxed">
                                {cspRejection.reason}
                              </p>
                              {cspRejection.suggestedFix && (
                                <p className="text-red-300 font-mono text-[10px] mt-2 bg-black/40 p-2 rounded border border-red-950">
                                  Suggested: {cspRejection.suggestedFix}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : isImageFile ? (
                    <ImageViewer 
                      filename={workspace.currentFile} 
                      isSyncing={workspace.isFileSyncing}
                    />
                  ) : isUnsupportedFile ? (
                    <UnsupportedFileViewer 
                      filename={workspace.currentFile} 
                      onRevealExplorer={(p) => workspace.wsRef.current?.send(JSON.stringify({ event: 'REVEAL_IN_EXPLORER', path: p }))}
                    />
                  ) : !workspace.currentFile ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs select-none">
                      <p>No file open</p>
                      <button 
                        onClick={() => setCenterView('spatial')} 
                        className="mt-3 px-3 py-1.5 rounded bg-[#1e2022] hover:bg-[#25282a] text-slate-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                      >
                        Switch to Spatial Map
                      </button>
                    </div>
                  ) : (
                    <CodeEditor 
                      filename={workspace.currentFile} 
                      initialCode={activeCodeStr} 
                      settings={settings} 
                      focusLine={editorFocusLine} 
                      isSyncing={workspace.isFileSyncing}
                      onCodeChange={handleCodeChange}
                      onSave={() => handleSaveFile()}
                      onClearFocus={() => setEditorFocusLine(null)} 
                    />
                  )}
                </div>
              </Panel>
              {layout.terminal && ( 
                <>
                  {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (Terminal) */}
                  <Separator 
                    className="h-[1px] hover:bg-[var(--theme-accent)] cursor-row-resize z-50 flex items-center transition-colors outline-none" 
                    style={{ backgroundColor: 'var(--theme-border, #242628)' }}
                  />
                  <Panel 
                    id="terminal-area" 
                    order={2} 
                    defaultSize={250} 
                    minSize={15} 
                    maxSize={300} 
                    style={{ backgroundColor: 'var(--theme-secondary, #191a1b)' }}
                  >
                    <TerminalPanel 
                      logs={workspace.terminalLogs} 
                      sessions={workspace.terminalSessions} 
                      activeSessionId={workspace.activeSessionId} 
                      absTargetDir={workspace.absTargetDir} 
                      onSelectSession={workspace.setActiveSessionId} 
                      onCreateSession={workspace.createTerminalSession} 
                      onCloseSession={workspace.closeTerminalSession} 
                      onSendTerminalCommand={workspace.sendTerminalCommand} 
                      onKillProcess={workspace.killTerminalProcess} 
                      onClearOutput={() => workspace.setTerminalLogs([])} 
                    />
                  </Panel>
                </> 
              )}
            </Group>
          </Panel>
          {layout.stdin && ( 
            <>
              {/* 🚀 RAZOR-THIN 1PX RESIZE DIVIDER (STDIN) */}
              <Separator 
                className="w-[1px] hover:bg-[var(--theme-accent)] cursor-col-resize z-50 flex justify-center transition-colors outline-none" 
                style={{ backgroundColor: 'var(--theme-border, #242628)' }}
              />
              <Panel 
                id="stdin-panel" 
                order={4} 
                defaultSize={320} 
                minSize={180} 
                maxSize={700} 
                style={{ backgroundColor: 'var(--theme-secondary, #191a1b)' }}
              >
                <RightPanelContainer 
                  stdin={stdin} 
                  setStdin={setStdin} 
                  activeFile={workspace.currentFile}
                  fileContent={currentCodeBufferRef.current[workspace.currentFile] ?? activeCodeStr}
                  aiStudio={aiStudio}
                  projectName={workspace.repoName || (workspace.absTargetDir ? workspace.absTargetDir.split(/[\\/]/).pop() : "Neuron")}
                  onOpenSettings={handleOpenSettings}
                />
              </Panel>
            </> 
          )}
        </Group>
      </div>

      {/* 🚀 HORIZON 3: AI AGENT SUPERVISOR LIVE PR BLAST RADIUS HUD */}
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

      {/* 🚀 BOTTOM STATUS BAR (#191a1b Secondary Theme) */}
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
        onCenterSpatialMap={() => setCenterView('spatial')}
        notifications={workspace.notifications}
        onClearNotifications={workspace.clearNotifications}
        onDismissNotification={workspace.dismissNotification}
        onMarkAllNotificationsRead={workspace.markAllNotificationsRead}
      />
    </div>
  );
}