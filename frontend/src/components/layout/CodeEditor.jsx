// src/components/layout/CodeEditor.jsx
import React, { useRef, useEffect, useCallback, useMemo, memo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

import { registerMonacoThemes, syncMonacoTheme, useTheme } from '../../config/themeConfig';
import FindReplaceWidget from './FindReplaceWidget';
import { Eye } from 'lucide-react';

// Direct local bundling (Zero CDN network requests, 100% offline)
loader.config({ monaco });

// Central dynamic Monaco theme registrations (Obsidian Black, Alabaster White, Sakura Rose)
registerMonacoThemes(monaco);

// Persistent Global Monaco Model and ViewState Registry (preserves models, undo stacks, cursor & scroll across tab switches and unmounts)
const globalModelsMap = new Map(); // Map<filePath, ITextModel>
const globalViewStatesMap = new Map(); // Map<filePath, ICodeEditorViewState>
const globalLastUserEdits = new Map(); // Map<filePath, string>

if (typeof window !== 'undefined') {
  window.addEventListener('neuron-clear-editor-cache', () => {
    globalModelsMap.clear();
    globalViewStatesMap.clear();
    globalLastUserEdits.clear();
  });
}

function CodeEditor({ 
  filename = "", 
  initialCode = "", 
  isDirty = false,
  settings = {}, 
  focusLine, 
  onCodeChange, 
  onSave, 
  onClearFocus,
  isSyncing = false,
  onSwitchToPreview
}) {
  const { theme } = useTheme();
  const monacoTheme = theme?.monacoTheme || 'neuron-obsidian';
  const editorRef = useRef(null);
  const isDirtyRef = useRef(isDirty);
  const isExternalSyncRef = useRef(false);

  // Synchronize Monaco accents (cursor & active line number) when theme changes
  useEffect(() => {
    if (theme) {
      syncMonacoTheme(monaco, theme);
    }
  }, [theme]);

  const onCodeChangeRef = useRef(onCodeChange);
  const onSaveRef = useRef(onSave);
  const filenameRef = useRef(filename);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    filenameRef.current = filename;
  }, [filename]);

  // Helper: Updates a Monaco model without resetting cursor position, selection, or scroll offset
  const applyModelTextPreservingCursor = useCallback((model, newText) => {
    if (!model || model.isDisposed() || newText === undefined) return;
    const currentText = model.getValue();
    if (currentText === newText) return;

    const editor = editorRef.current;
    const isActiveModel = editor && editor.getModel() === model;
    const savedPosition = isActiveModel ? editor.getPosition() : null;
    const savedSelections = isActiveModel ? editor.getSelections() : null;
    const savedScrollTop = isActiveModel ? editor.getScrollTop() : null;
    const savedScrollLeft = isActiveModel ? editor.getScrollLeft() : null;

    isExternalSyncRef.current = true;
    try {
      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: newText }],
        () => null
      );
    } catch {
      model.setValue(newText);
    } finally {
      isExternalSyncRef.current = false;
    }

    if (isActiveModel && savedPosition) {
      const lineCount = Math.max(1, model.getLineCount());
      const safeLine = Math.min(Math.max(1, savedPosition.lineNumber), lineCount);
      const safeColumn = Math.min(Math.max(1, savedPosition.column), model.getLineMaxColumn(safeLine));
      editor.setPosition({ lineNumber: safeLine, column: safeColumn });

      if (savedSelections && savedSelections.length > 0) {
        try {
          const clampedSelections = savedSelections.map(sel => {
            const sLine = Math.min(Math.max(1, sel.selectionStartLineNumber), lineCount);
            const sCol = Math.min(Math.max(1, sel.selectionStartColumn), model.getLineMaxColumn(sLine));
            const pLine = Math.min(Math.max(1, sel.positionLineNumber), lineCount);
            const pCol = Math.min(Math.max(1, sel.positionColumn), model.getLineMaxColumn(pLine));
            return new monaco.Selection(sLine, sCol, pLine, pCol);
          });
          editor.setSelections(clampedSelections);
        } catch {
          // ignore selection clamp fallback
        }
      }

      if (typeof savedScrollTop === 'number') editor.setScrollTop(savedScrollTop);
      if (typeof savedScrollLeft === 'number') editor.setScrollLeft(savedScrollLeft);
    }
  }, []);

  // -------------------------------------------------------------------------
  // 2. POLYGLOT LANGUAGE DETECTION
  // -------------------------------------------------------------------------
  const language = useMemo(() => {
    if (!filename) return 'javascript';
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'hpp': 'cpp',
      'h': 'cpp',
      'c': 'c',
      'java': 'java',
      'py': 'python',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'md': 'markdown',
      'toml': 'ini',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'shell'
    };
    return map[ext] || 'plaintext';
  }, [filename]);

  // Save view state on unmount so switching between Spatial Map, Terminal, Images, and Editor never loses scroll/cursor
  useEffect(() => {
    return () => {
      if (editorRef.current && filenameRef.current) {
        try {
          const vs = editorRef.current.saveViewState();
          if (vs) {
            globalViewStatesMap.set(filenameRef.current, vs);
          }
        } catch {}
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // 3. MULTI-MODEL ISOLATION (Preserves Undo Stack & Cursor Across Saves)
  // -------------------------------------------------------------------------
  const getOrCreateModel = useCallback((file, codeContent, lang) => {
    if (!file) return null;
    
    let model = globalModelsMap.get(file);
    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`inmemory://neuron/${file}`);
      model = monaco.editor.getModel(uri);
      
      if (!model) {
        model = monaco.editor.createModel(codeContent || "", lang, uri);
      } else if (codeContent !== undefined) {
        const curNorm = model.getValue().replace(/\r\n/g, '\n');
        const codeNorm = codeContent.replace(/\r\n/g, '\n');
        if (curNorm !== codeNorm) {
          applyModelTextPreservingCursor(model, codeContent);
        }
      }
      globalModelsMap.set(file, model);
    } else {
      const curNorm = model.getValue().replace(/\r\n/g, '\n');
      const codeNorm = (codeContent || "").replace(/\r\n/g, '\n');
      const hasTyped = globalLastUserEdits.has(file);
      const isFocusedActive = editorRef.current && editorRef.current.getModel() === model && editorRef.current.hasTextFocus();

      if (
        codeContent !== undefined &&
        curNorm !== codeNorm &&
        !isDirtyRef.current &&
        !isFocusedActive &&
        (!hasTyped || curNorm === "")
      ) {
        applyModelTextPreservingCursor(model, codeContent);
      }
    }
    
    // Ensure language mode is synchronized
    monaco.editor.setModelLanguage(model, lang);
    return model;
  }, [applyModelTextPreservingCursor]);

  // Switch Monaco Models on Tab Switch (0ms execution, Isolated Undo Stack) or live external sync
  useEffect(() => {
    if (!editorRef.current || !filename) return;

    const targetModel = getOrCreateModel(filename, initialCode, language);
    if (targetModel) {
      if (editorRef.current.getModel() !== targetModel) {
        // Save view state of outgoing file before switching models
        const prevModel = editorRef.current.getModel();
        if (prevModel && filenameRef.current && filenameRef.current !== filename) {
          try {
            const vs = editorRef.current.saveViewState();
            if (vs) {
              globalViewStatesMap.set(filenameRef.current, vs);
            }
          } catch {}
        }

        editorRef.current.setModel(targetModel);

        // Instantly restore cursor, selection, and scroll position
        const savedVs = globalViewStatesMap.get(filename);
        if (savedVs) {
          try {
            editorRef.current.restoreViewState(savedVs);
          } catch {}
        }
      } else if (
        !isDirty &&
        initialCode !== undefined &&
        !editorRef.current.hasTextFocus()
      ) {
        const curNorm = targetModel.getValue().replace(/\r\n/g, '\n');
        const initNorm = initialCode.replace(/\r\n/g, '\n');
        if (curNorm !== initNorm && (!globalLastUserEdits.has(filename) || curNorm === "")) {
          applyModelTextPreservingCursor(targetModel, initialCode);
        }
      }
    }
  }, [filename, initialCode, language, isDirty, getOrCreateModel, applyModelTextPreservingCursor]);

  // External Code Update Dispatcher (e.g. AI Refactor Applied)
  useEffect(() => {
    const handleExternalCodeUpdate = (e) => {
      const { filePath, code } = e.detail || {};
      if (!filePath || code === undefined) return;

      const cleanTarget = filePath.replace(/\\/g, '/').toLowerCase();
      const cleanCurrent = (filenameRef.current || '').replace(/\\/g, '/').toLowerCase();

      // 1. Update matching cached model in globalModelsMap while preserving cursor
      for (const [key, model] of globalModelsMap.entries()) {
        if (key.replace(/\\/g, '/').toLowerCase() === cleanTarget && !model.isDisposed()) {
          globalLastUserEdits.set(key, code);
          applyModelTextPreservingCursor(model, code);
        }
      }

      // 2. If active editor is currently viewing this file, ensure model updates live
      if (editorRef.current && cleanCurrent === cleanTarget) {
        const curModel = editorRef.current.getModel();
        if (curModel) {
          applyModelTextPreservingCursor(curModel, code);
        }
      }
    };

    window.addEventListener('neuron-update-editor-code', handleExternalCodeUpdate);
    return () => window.removeEventListener('neuron-update-editor-code', handleExternalCodeUpdate);
  }, [applyModelTextPreservingCursor]);

  // -------------------------------------------------------------------------
  // 4. EDITOR MOUNT & KEYBINDINGS (Ctrl+S Save & Ctrl+/ Line Commenting)
  // -------------------------------------------------------------------------
  const handleMount = (editor) => {
    editorRef.current = editor;

    // Immediately synchronize theme accent colors (cursor & active line number)
    if (theme) {
      syncMonacoTheme(monaco, theme);
    }

    // Attach initial file model and restore view state
    if (filename) {
      const targetModel = getOrCreateModel(filename, initialCode, language);
      if (targetModel) {
        editor.setModel(targetModel);
        const savedVs = globalViewStatesMap.get(filename);
        if (savedVs) {
          try {
            editor.restoreViewState(savedVs);
          } catch {}
        }
      }
    }

    // BIND CTRL + S / CMD + S (SAVE ACTIVE FILE)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentVal = editor.getValue();
      const currentFile = filenameRef.current;
      if (currentFile) {
        globalLastUserEdits.set(currentFile, currentVal);
      }
      if (onCodeChangeRef.current && currentFile) {
        onCodeChangeRef.current(currentVal, currentFile);
      }
      if (onSaveRef.current && currentFile) {
        onSaveRef.current(currentFile, currentVal);
      }
    });

    // BIND CTRL + F / CMD + F (CUSTOM THEMED FIND WIDGET)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      const selection = editor.getSelection();
      const selectedText = selection && !selection.isEmpty() ? editor.getModel()?.getValueInRange(selection) : "";
      window.dispatchEvent(new CustomEvent('neuron-open-find-widget', { 
        detail: { mode: 'find', initialText: selectedText } 
      }));
    });

    // BIND CTRL + H / CMD + H (CUSTOM THEMED REPLACE WIDGET)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      const selection = editor.getSelection();
      const selectedText = selection && !selection.isEmpty() ? editor.getModel()?.getValueInRange(selection) : "";
      window.dispatchEvent(new CustomEvent('neuron-open-find-widget', { 
        detail: { mode: 'replace', initialText: selectedText } 
      }));
    });

    // BIND CTRL + K / CMD + K (SEARCH / COMMAND PALETTE)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      window.dispatchEvent(new CustomEvent('neuron-open-command-palette'));
    });

    // BIND CTRL + / (TOGGLE LINE COMMENT) FOR ALL LANGUAGES
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    // BIND SHIFT + ALT + A (TOGGLE BLOCK COMMENT)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyA, () => {
      editor.trigger('keyboard', 'editor.action.blockComment', null);
    });

    // Listen for model content changes (Notify parent instantly so dirty indicator is 0ms)
    editor.onDidChangeModelContent(() => {
      if (isExternalSyncRef.current) return;

      const currentVal = editor.getValue();
      const currentFile = filenameRef.current;
      if (currentFile) {
        globalLastUserEdits.set(currentFile, currentVal);
      }
      
      if (onCodeChangeRef.current && currentFile) {
        onCodeChangeRef.current(currentVal, currentFile);
      }
    });

    // Jump to line if focusLine was passed
    if (focusLine) {
      editor.revealLineInCenter(focusLine);
      editor.setPosition({ lineNumber: focusLine, column: 1 });
      editor.focus();
      if (onClearFocus) onClearFocus();
    }
  };

  // Jump to line whenever focusLine changes
  useEffect(() => {
    if (editorRef.current && focusLine) {
      editorRef.current.revealLineInCenter(focusLine);
      editorRef.current.setPosition({ lineNumber: focusLine, column: 1 });
      editorRef.current.focus();
      if (onClearFocus) onClearFocus();
    }
  }, [focusLine, onClearFocus]);

  // Synchronize Monaco editor theme on dynamic theme switch
  useEffect(() => {
    if (editorRef.current && monacoTheme) {
      try {
        monaco.editor.setTheme(monacoTheme);
      } catch {
        // ignore
      }
    }
  }, [monacoTheme]);

  // -------------------------------------------------------------------------
  // 3. FILE PATH BREADCRUMBS (Relative to Workspace Root)
  // -------------------------------------------------------------------------
  const breadcrumbSegments = useMemo(() => {
    if (!filename) return [];
    return filename.replace(/\\/g, '/').split('/').filter(Boolean);
  }, [filename]);

  return (
    <div 
      className="w-full h-full flex flex-col relative flex-1 overflow-hidden min-h-0 min-w-0"
      style={{ backgroundColor: 'var(--theme-background, #121314)' }}
    >
      {/* MINIMALIST FILE PATH BREADCRUMB BAR (e.g. frontend > src > App.jsx) */}
      {breadcrumbSegments.length > 0 && (
        <div 
          className="h-6 shrink-0 border-b px-3 flex items-center justify-between text-[11px] font-mono select-none z-20"
          style={{
            backgroundColor: 'var(--theme-background, #121314)',
            borderColor: 'var(--theme-border, #242628)',
            color: 'var(--theme-text-secondary, #94a3b8)'
          }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {breadcrumbSegments.map((segment, idx) => {
              const isLast = idx === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-[var(--theme-text-muted)] font-mono text-[10px]">&gt;</span>}
                  <span className={isLast ? "text-[var(--theme-text-bright)] font-medium" : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"}>
                    {segment}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pl-2 shrink-0">
            {onSwitchToPreview && (
              <button
                type="button"
                onClick={onSwitchToPreview}
                className="px-2 py-0.5 rounded text-[10px] font-mono border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:border-[var(--theme-accent)] transition-all cursor-pointer flex items-center gap-1.5"
                title="Switch to Image Preview"
              >
                <Eye size={11} />
                <span>Preview</span>
              </button>
            )}
            {isSyncing && (
              <span className="neuron-loading-text shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] animate-pulse" />
                <span>Loading...</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* BEAUTIFULLY ANIMATED THEME ACCENT LOADING LINE */}
      {isSyncing && (
        <div className="neuron-loading-line-track">
          <div className="neuron-loading-line-bar" />
        </div>
      )}

      <div className="w-full flex-1 min-h-0 relative">
        <FindReplaceWidget editor={editorRef.current} />
        <Editor
          height="100%"
          width="100%"
          theme={monacoTheme}
          onMount={handleMount}
          loading={
            <div 
              className="w-full h-full flex items-center justify-center font-mono text-xs"
              style={{
                backgroundColor: 'var(--theme-background, #121314)',
                color: 'var(--theme-text-muted, #64748b)'
              }}
            >
              Loading Editor...
            </div>
          }
        options={{
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontSize: settings?.fontSize || 13,
          fontLigatures: true,
          lineNumbers: settings?.lineNumbers || "on",
          minimap: { enabled: settings?.minimap ?? false },
          wordWrap: settings?.wordWrap || 'on',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "all",
          contextmenu: true,
          fixedOverflowWidgets: true,
          tabSize: settings?.tabSize || 2,
          formatOnPaste: settings?.formatOnPaste ?? true,
          renderWhitespace: "selection",
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'never'
          }
        }}
      />
      </div>
    </div>
  );
}

export default memo(CodeEditor);