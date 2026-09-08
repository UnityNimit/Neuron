// src/components/layout/CodeEditor.jsx
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// 🚀 CRITICAL FIX: Direct local bundling (Zero CDN network requests, 100% offline)
loader.config({ monaco });

// -------------------------------------------------------------------------
// 1. RICH POLYGLOT OBSIDIAN THEME (C++, C, Java, Python, JS, TS, Web)
// -------------------------------------------------------------------------
monaco.editor.defineTheme('neuron-obsidian', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // Comments
    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
    
    // Keywords & Preprocessor Directives (#include, #define, import, package)
    { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
    { token: 'keyword.directive', foreground: 'e06c75', fontStyle: 'bold' },
    { token: 'keyword.directive.include', foreground: 'e06c75', fontStyle: 'bold' },
    
    // Types & Classes (int, char, void, class, struct, String, boolean)
    { token: 'type', foreground: 'e5c07b' },
    { token: 'type.identifier', foreground: 'e5c07b' },
    { token: 'type.primitive', foreground: '56b6c2' },
    { token: 'class', foreground: 'e5c07b', fontStyle: 'bold' },
    { token: 'struct', foreground: 'e5c07b', fontStyle: 'bold' },
    { token: 'interface', foreground: 'e5c07b' },

    // Functions & Methods
    { token: 'function', foreground: '61afef' },
    { token: 'method', foreground: '61afef' },
    { token: 'entity.name.function', foreground: '61afef' },
    
    // Strings & Characters
    { token: 'string', foreground: '98c379' },
    { token: 'string.escape', foreground: '56b6c2' },
    { token: 'character', foreground: '98c379' },

    // Numbers & Constants
    { token: 'number', foreground: 'd19a66' },
    { token: 'constant', foreground: 'd19a66' },

    // Variables & Identifiers
    { token: 'variable', foreground: 'e06c75' },
    { token: 'variable.parameter', foreground: 'abb2bf' },
    { token: 'identifier', foreground: 'abb2bf' },

    // HTML / JSX Tags & Attributes
    { token: 'tag', foreground: 'e06c75' },
    { token: 'tag.attribute', foreground: 'd19a66' },
    { token: 'delimiter', foreground: 'abb2bf' },
    { token: 'delimiter.bracket', foreground: 'abb2bf' }
  ],
  colors: {
    'editor.background': '#121314',
    'editor.foreground': '#e2e8f0',
    'editor.lineHighlightBackground': '#181a1b',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#4b5563',
    'editorLineNumber.activeForeground': '#60a5fa',
    'editorGutter.background': '#121314',
    'editorIndentGuide.background': '#1e2227',
    'editorIndentGuide.activeBackground': '#3b82f680',
    'editorCursor.foreground': '#60a5fa',
    'editor.selectionBackground': '#264f7880',
    'editor.inactiveSelectionBackground': '#3a3d4140',
    'scrollbarSlider.background': '#26262660',
    'scrollbarSlider.hoverBackground': '#3b82f660',
    'scrollbarSlider.activeBackground': '#3b82f6a0',
    'minimap.background': '#121314'
  }
});

export default function CodeEditor({ 
  filename = "", 
  initialCode = "", 
  settings = {}, 
  focusLine, 
  onCodeChange, 
  onSave, 
  onClearFocus,
  isSyncing = false
}) {
  const editorRef = useRef(null);
  const modelsMapRef = useRef(new Map()); // Map<filePath, ITextModel>
  const timerRef = useRef(null);

  const onCodeChangeRef = useRef(onCodeChange);
  const onSaveRef = useRef(onSave);
  const filenameRef = useRef(filename);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    filenameRef.current = filename;
  }, [filename]);

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

  // -------------------------------------------------------------------------
  // 3. 🚀 MULTI-MODEL ISOLATION (Fixes Ctrl+Z Cross-File Bug)
  // -------------------------------------------------------------------------
  const getOrCreateModel = useCallback((file, codeContent, lang) => {
    if (!file) return null;
    
    let model = modelsMapRef.current.get(file);
    if (!model || model.isDisposed()) {
      const uri = monaco.Uri.parse(`inmemory://neuron/${file}`);
      model = monaco.editor.getModel(uri);
      
      if (!model) {
        model = monaco.editor.createModel(codeContent || "", lang, uri);
      } else {
        if (codeContent !== undefined && model.getValue() !== codeContent) {
          model.setValue(codeContent);
        }
      }
      modelsMapRef.current.set(file, model);
    } else {
      // Sync model if initial code updated externally and model is untouched
      if (codeContent !== undefined && model.getValue() !== codeContent && model.getAlternativeVersionId() === 1) {
        model.setValue(codeContent);
      }
    }
    
    // Ensure language mode is synchronized
    monaco.editor.setModelLanguage(model, lang);
    return model;
  }, []);

  // Switch Monaco Models on Tab Switch (0ms execution, Isolated Undo Stack)
  useEffect(() => {
    if (!editorRef.current || !filename) return;

    const targetModel = getOrCreateModel(filename, initialCode, language);
    if (targetModel && editorRef.current.getModel() !== targetModel) {
      editorRef.current.setModel(targetModel);
    }
  }, [filename, initialCode, language, getOrCreateModel]);

  // -------------------------------------------------------------------------
  // 4. EDITOR MOUNT & KEYBINDINGS (Ctrl+S Save & Ctrl+/ Line Commenting)
  // -------------------------------------------------------------------------
  const handleMount = (editor) => {
    editorRef.current = editor;

    // Attach initial file model
    if (filename) {
      const targetModel = getOrCreateModel(filename, initialCode, language);
      if (targetModel) {
        editor.setModel(targetModel);
      }
    }

    // 🚀 BIND CTRL + S / CMD + S (SAVE ACTIVE FILE)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentVal = editor.getValue();
      const currentFile = filenameRef.current;
      if (onCodeChangeRef.current && currentFile) {
        onCodeChangeRef.current(currentVal, currentFile);
      }
      if (onSaveRef.current && currentFile) {
        onSaveRef.current(currentFile, currentVal);
      }
    });

    // 🚀 BIND CTRL + / (TOGGLE LINE COMMENT) FOR ALL LANGUAGES
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    // BIND SHIFT + ALT + A (TOGGLE BLOCK COMMENT)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyA, () => {
      editor.trigger('keyboard', 'editor.action.blockComment', null);
    });

    // Listen for model content changes (Notify parent instantly so dirty indicator is 0ms)
    editor.onDidChangeModelContent(() => {
      const currentVal = editor.getValue();
      const currentFile = filenameRef.current;
      
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

  // -------------------------------------------------------------------------
  // 3. FILE PATH BREADCRUMBS (Relative to Workspace Root)
  // -------------------------------------------------------------------------
  const breadcrumbSegments = useMemo(() => {
    if (!filename) return [];
    return filename.replace(/\\/g, '/').split('/').filter(Boolean);
  }, [filename]);

  return (
    <div className="w-full h-full flex flex-col relative flex-1 overflow-hidden min-h-0 min-w-0 bg-[#121314]">
      {/* 🚀 MINIMALIST FILE PATH BREADCRUMB BAR (e.g. frontend > src > App.jsx) */}
      {breadcrumbSegments.length > 0 && (
        <div className="h-6 shrink-0 bg-[#121314] border-b border-[#242628] px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-20">
          <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {breadcrumbSegments.map((segment, idx) => {
              const isLast = idx === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-600 font-mono text-[10px]">&gt;</span>}
                  <span className={isLast ? "text-slate-200" : "text-slate-400 hover:text-slate-300 transition-colors"}>
                    {segment}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
          {isSyncing && (
            <span className="text-[10px] font-mono text-blue-400/80 animate-pulse pl-2 shrink-0">
              Loading...
            </span>
          )}
        </div>
      )}

      {/* 🚀 RAZOR-THIN (1.5PX) LOADING PROGRESS LINE */}
      {isSyncing && (
        <div className="h-[1.5px] w-full bg-[#121314] overflow-hidden shrink-0 z-20">
          <div className="h-full bg-blue-500/80 animate-pulse w-full" />
        </div>
      )}

      <div className="w-full flex-1 min-h-0 relative">
        <Editor
          height="100%"
          width="100%"
          theme="neuron-obsidian"
          onMount={handleMount}
          loading={
            <div className="w-full h-full flex items-center justify-center bg-[#121314] text-slate-500 font-mono text-xs">
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
          tabSize: 2,
          renderWhitespace: "selection"
        }}
      />
      </div>
    </div>
  );
}