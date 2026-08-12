// src/components/CodeNode.jsx
import React, { useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import Editor from '@monaco-editor/react';
import { Terminal, Box } from 'lucide-react';
import { useDebouncedEditor } from '../hooks/useDebouncedEditor';

export default function CodeNode({ id, data }) {
  // FIX: Pass data.filePath (clean path without emojis) to the editor hook
  const { localCode, handleEditorMount, handleEditorChange } = useDebouncedEditor({
    id, 
    initialCode: data.code, 
    onCodeEdit: data.onCodeEdit,
    filePath: data.filePath || data.fileName
  });

  const { glowColor, borderColor } = useMemo(() => {
    if (data.isImpacted) return { glowColor: 'shadow-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.6)]', borderColor: 'border-orange-500' };
    if (data.risk === 'high') return { glowColor: 'shadow-red-500/50', borderColor: 'border-red-500' };
    return { glowColor: 'shadow-blue-500/30', borderColor: 'border-slate-700' };
  }, [data.isImpacted, data.risk]);

  const settings = data.settings || {};

  const editorLanguage = useMemo(() => {
    const name = data.filePath || data.fileName || "";
    const ext = name.split('.').pop().toLowerCase();
    const langMap = {
      py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      json: 'json', html: 'html', css: 'css', cpp: 'cpp', c: 'cpp', md: 'markdown'
    };
    return langMap[ext] || 'python';
  }, [data.filePath, data.fileName]);

  return (
    <div 
      onKeyDown={(e) => e.stopPropagation()} 
      className={`w-[450px] bg-[#1e1e1e] rounded-xl border-2 ${borderColor} shadow-2xl ${glowColor} flex flex-col overflow-hidden font-sans`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-none" />
      
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Box size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-slate-200 tracking-wide">{data.fileName || "unnamed.py"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400 uppercase">{editorLanguage}</span>
        </div>
      </div>

      <div className="h-[250px] w-full p-2 bg-[#1e1e1e]">
        <Editor
          height="100%"
          defaultLanguage={editorLanguage}
          language={editorLanguage}
          theme="vs-dark"
          value={localCode}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            fontSize: settings.fontSize || 13,
            wordWrap: settings.wordWrap || 'off',
            lineNumbers: settings.lineNumbers || 'on',
            minimap: { enabled: settings.minimap || false },
            formatOnPaste: settings.formatOnPaste || true,
            scrollBeyondLastLine: false, 
            padding: { top: 10 }, 
            overviewRulerLanes: 0,
          }}
        />
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-none" />
    </div>
  );
}