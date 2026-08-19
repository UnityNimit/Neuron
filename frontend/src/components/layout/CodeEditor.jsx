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
  onClearFocus 
}) {
  const editorRef = useRef(null);
  const modelsMapRef = useRef(new Map()); // Map<filePath, ITextModel>
  const timerRef = useRef(null);

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
  // 4. EDITOR MOUNT & KEYBINDINGS (Ctrl+/ Line Commenting)
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

    // 🚀 BIND CTRL + / (TOGGLE LINE COMMENT) FOR ALL LANGUAGES
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    // BIND SHIFT + ALT + A (TOGGLE BLOCK COMMENT)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyA, () => {
      editor.trigger('keyboard', 'editor.action.blockComment', null);
    });

    // Listen for model content changes (Per-File Debounced Save)
    editor.onDidChangeModelContent(() => {
      const currentVal = editor.getValue();
      
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (onCodeChange) {
          onCodeChange(currentVal);
        }
      }, 400);
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

  return (
    <div className="w-full h-full relative flex-1 overflow-hidden min-h-0 min-w-0 bg-[#121314]">
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
  );
}