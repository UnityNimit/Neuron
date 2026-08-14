// src/components/layout/CodeEditor.jsx
import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ filename, initialCode, settings, focusLine, onCodeChange, onClearFocus }) {
  const [code, setCode] = useState(initialCode || "");
  const timerRef = useRef(null);

  // CRITICAL FIX: Only update local code when the actual file tab changes.
  // This prevents the WebSocket auto-save sync from wiping out your cursor mid-type!
  useEffect(() => {
    setCode(initialCode || "");
  }, [filename]);

  const handleChange = (value) => {
    setCode(value);
    
    // Debounce the save to backend by 600ms
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onCodeChange(value);
    }, 600);
  };

  const handleMount = (editor) => {
    if (focusLine) {
      editor.revealLineInCenter(focusLine);
      editor.setPosition({ lineNumber: focusLine, column: 1 });
      editor.focus();
      onClearFocus(); 
    }
  };

  const language = filename?.split('.').pop() === 'js' ? 'javascript' : 
                   filename?.split('.').pop() === 'json' ? 'json' : 
                   filename?.split('.').pop() === 'html' ? 'html' : 'python';

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={code}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        lineNumbers: settings?.lineNumbers || "on",
        minimap: { enabled: settings?.minimap || false },
        fontSize: settings?.fontSize || 13,
        wordWrap: settings?.wordWrap || 'off',
        padding: { top: 16 }
      }}
    />
  );
}