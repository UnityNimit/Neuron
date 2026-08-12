// src/hooks/useDebouncedEditor.js
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDebouncedEditor({ id, initialCode, onCodeEdit }) {
  const [localCode, setLocalCode] = useState(initialCode);
  const isFocusedRef = useRef(false);
  const timerRef = useRef(null);

  // The Shield: Only update local code if we are NOT focused!
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalCode(initialCode);
    }
  }, [initialCode]);

  // Hook directly into Monaco's native engine to lock the state
  const handleEditorMount = useCallback((editor) => {
    editor.onDidFocusEditorWidget(() => {
      isFocusedRef.current = true;
    });
    editor.onDidBlurEditorWidget(() => {
      isFocusedRef.current = false;
      // Force a strict save when clicking away, just in case!
      if (onCodeEdit) onCodeEdit(id, editor.getValue());
    });
  }, [id, onCodeEdit]);

  const handleEditorChange = useCallback((value) => {
    setLocalCode(value); // Instantly update UI so typing is 100% smooth
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Tell backend to save to disk 800ms after you stop typing
    timerRef.current = setTimeout(() => {
      if (onCodeEdit) onCodeEdit(id, value);
      timerRef.current = null;
    }, 800);
  }, [id, onCodeEdit]);

  return { localCode, handleEditorMount, handleEditorChange };
}