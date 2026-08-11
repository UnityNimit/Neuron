import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import Editor from '@monaco-editor/react';
import { Terminal, Box } from 'lucide-react';

export default function CodeNode({ id, data }) {
  const [localCode, setLocalCode] = useState(data.code);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef(null);

  const glowColor = data.isImpacted 
    ? 'shadow-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.6)]' 
    : data.risk === 'high' ? 'shadow-red-500/50' : 'shadow-blue-500/30';
    
  const borderColor = data.isImpacted 
    ? 'border-orange-500' 
    : data.risk === 'high' ? 'border-red-500' : 'border-slate-700';

  // The Shield: Only update from the backend if you are NOT typing in this specific box
  useEffect(() => {
    if (!isFocused) {
      setLocalCode(data.code);
    }
  }, [data.code]); // Notice we removed isFocused from the dependency array to prevent loops!

  // Hook directly into Monaco's native engine to see if your cursor is inside
  const handleEditorMount = (editor) => {
    editor.onDidFocusEditorWidget(() => setIsFocused(true));
    editor.onDidBlurEditorWidget(() => setIsFocused(false));
  };

  const handleEditorChange = (value) => {
    setLocalCode(value); // Instantly update your screen so typing feels 100% smooth
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Tell the backend to save to disk 600ms after you stop typing
    timerRef.current = setTimeout(() => {
      if (data.onCodeEdit) {
        data.onCodeEdit(id, value);
      }
      timerRef.current = null;
    }, 600);
  };

  return (
    <div className={`w-[450px] bg-[#1e1e1e] rounded-xl border-2 ${borderColor} shadow-2xl ${glowColor} flex flex-col overflow-hidden font-sans`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-none" />
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Box size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-slate-200 tracking-wide">{data.fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400">Python</span>
        </div>
      </div>
      <div className="h-[250px] w-full p-2 bg-[#1e1e1e]">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={localCode}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false }, fontSize: 12, lineNumbers: "on",
            scrollBeyondLastLine: false, padding: { top: 10 }, overviewRulerLanes: 0,
          }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-none" />
    </div>
  );
}