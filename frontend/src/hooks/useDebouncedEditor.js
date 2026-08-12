// src/hooks/useDebouncedEditor.js
import { useState, useRef, useEffect, useCallback } from 'react';

export function useDebouncedEditor({ id, initialCode, onCodeEdit, filePath }) {
  const [localCode, setLocalCode] = useState(initialCode);
  const isFocusedRef = useRef(false);
  const timerRef = useRef(null);
  const initialCodeRef = useRef(initialCode);

  useEffect(() => {
    initialCodeRef.current = initialCode;
    if (!isFocusedRef.current) {
      setLocalCode(initialCode);
    }
  }, [initialCode]);

  // FIX: Unmount Cleanup! Kills pending save timers when switching files
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editor.onDidFocusEditorWidget(() => {
      isFocusedRef.current = true;
    });
    editor.onDidBlurEditorWidget(() => {
      isFocusedRef.current = false;
    });
  }, []);

  const handleEditorChange = useCallback((value) => {
    if (value === undefined) return;
    setLocalCode(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // FIX: Only save if the code actually changed from initial
      if (onCodeEdit && value !== initialCodeRef.current) {
        onCodeEdit(id, value, filePath);
        initialCodeRef.current = value;
      }
      timerRef.current = null;
    }, 800);
  }, [id, onCodeEdit, filePath]);

  return { localCode, handleEditorMount, handleEditorChange };
}