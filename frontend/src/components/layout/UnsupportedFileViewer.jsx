// frontend/src/components/layout/UnsupportedFileViewer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { FileQuestion, Folder } from 'lucide-react';

export default function UnsupportedFileViewer({ 
  filename = "", 
  onRevealExplorer 
}) {
  const [fileMeta, setFileMeta] = useState(null);

  // -------------------------------------------------------------------------
  // 1. FILE PATH BREADCRUMBS (Identical to CodeEditor.jsx)
  // -------------------------------------------------------------------------
  const breadcrumbSegments = useMemo(() => {
    if (!filename) return [];
    return filename.replace(/\\/g, '/').split('/').filter(Boolean);
  }, [filename]);

  const baseName = useMemo(() => {
    return filename ? filename.split(/[/\\]/).pop() : "Unknown File";
  }, [filename]);

  // Fetch file size & metadata if backend is available
  useEffect(() => {
    if (!filename) return;

    let isMounted = true;
    fetch(`http://127.0.0.1:8000/api/file/info?path=${encodeURIComponent(filename)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data && data.status === 'ok') {
          setFileMeta(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [filename]);

  return (
    <div 
      className="w-full h-full flex flex-col relative flex-1 overflow-hidden min-h-0 min-w-0 select-none"
      style={{ backgroundColor: 'var(--theme-background, #121314)' }}
    >
      {/* 🚀 TOP BREADCRUMB BAR (Matches CodeEditor.jsx exactly) */}
      <div 
        className="h-6 shrink-0 border-b px-3 flex items-center gap-1.5 text-[11px] font-mono select-none overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{
          backgroundColor: 'var(--theme-background, #121314)',
          borderColor: 'var(--theme-border, #242628)',
          color: 'var(--theme-text-secondary, #94a3b8)'
        }}
      >
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

      {/* 🚀 MINIMALIST FALLBACK CARD (Editor Dark Theme) */}
      <div 
        className="w-full flex-1 min-h-0 flex items-center justify-center p-6"
        style={{ backgroundColor: 'var(--theme-background, #121314)' }}
      >
        <div 
          className="flex flex-col items-center max-w-sm w-full p-6 border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)'
          }}
        >
          
          <div 
            className="w-11 h-11 rounded-xl border flex items-center justify-center text-slate-400 mb-3 shadow-inner"
            style={{
              backgroundColor: 'var(--theme-surface-hover, #1d1f22)',
              borderColor: 'var(--theme-border-subtle, #282a2d)'
            }}
          >
            <FileQuestion size={22} strokeWidth={1.75} className="text-slate-400" />
          </div>

          <h3 className="text-sm font-medium tracking-tight" style={{ color: 'var(--theme-text-bright, #f8fafc)' }}>
            File Not Supported
          </h3>

          <p className="text-[12px] text-slate-400 mt-1 leading-relaxed font-sans">
            This file type cannot be displayed in the editor.
          </p>

          <div 
            className="mt-3 px-3 py-1 border rounded text-[11px] font-mono text-slate-400 max-w-xs truncate"
            style={{
              backgroundColor: 'var(--theme-background, #121314)',
              borderColor: 'var(--theme-border, #242628)'
            }}
          >
            <span>{baseName}</span>
            {fileMeta?.size_formatted && (
              <span className="text-slate-500 ml-1.5">• {fileMeta.size_formatted}</span>
            )}
          </div>

          <button
            onClick={() => onRevealExplorer && onRevealExplorer(filename)}
            className="mt-4 px-3.5 py-1.5 rounded-md border text-xs font-sans font-medium flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            style={{
              backgroundColor: 'var(--theme-surface-hover, #202224)',
              borderColor: 'var(--theme-border-subtle, #2e3235)',
              color: 'var(--theme-text-primary, #cbd5e1)'
            }}
            title="Reveal in Native File Manager"
          >
            <Folder size={13} className="text-slate-400" />
            <span>Open in Explorer</span>
          </button>
        </div>
      </div>

    </div>
  );
}
