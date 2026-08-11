// src/hooks/useDebouncedEditor.js
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDebouncedEditor({ id, initialCode, onCodeEdit }) {
  const [localCode, setLocalCode] = useState(initialCode);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef(null);

  // The Shield: Only update from the backend if you are NOT typing in this specific box
  useEffect(() => {
    if (!isFocused) {
      setLocalCode(initialCode);
    }
  }, [initialCode, isFocused]);

  // Hook directly into Monaco's native engine to see if your cursor is inside
  const handleEditorMount = useCallback((editor) => {
    editor.onDidFocusEditorWidget(() => setIsFocused(true));
    editor.onDidBlurEditorWidget(() => setIsFocused(false));
  }, []);

  const handleEditorChange = useCallback((value) => {
    setLocalCode(value); // Instantly update your screen so typing feels 100% smooth
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Tell the backend to save to disk 600ms after you stop typing
    timerRef.current = setTimeout(() => {
      if (onCodeEdit) {
        onCodeEdit(id, value);
      }
      timerRef.current = null;
    }, 600);
  }, [id, onCodeEdit]);

  return {
    localCode,
    handleEditorMount,
    handleEditorChange
  };
}