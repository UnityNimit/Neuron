import { useState, useEffect } from 'react';
import { loadPyodideEngine } from '../services/pyodideService';

export function useCompiler(workspace) {
  const [isCompilerReady, setIsCompilerReady] = useState(false);

  useEffect(() => {
    loadPyodideEngine(
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: false }]),
      (msg) => workspace.setTerminalLogs(prev => [...prev, { text: msg, isError: true }])
    ).then(() => setIsCompilerReady(true));
  }, []);

  return { isCompilerReady };
}