// frontend/src/components/layout/UnsupportedFileViewer.jsx
import React, { useState, useEffect, useMemo } from 'react';

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
      {/* TOP BREADCRUMB BAR (Matches CodeEditor.jsx exactly) */}
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
              {idx > 0 && <span className="text-[var(--theme-text-muted)] font-mono text-[10px]">&gt;</span>}
              <span className={isLast ? "text-[var(--theme-text-bright)] font-medium" : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"}>
                {segment}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* MINIMAL VIEW (No outer box, no file logo, no boxes) */}
      <div 
        className="w-full flex-1 min-h-0 flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ backgroundColor: 'var(--theme-background, #121314)' }}
      >
        <span 
          className="text-sm font-bold tracking-tight" 
          style={{ color: 'var(--theme-text-bright, #f8fafc)' }}
        >
          File Not Supported
        </span>

        <div className="text-xs font-mono text-[var(--theme-text-muted)] mt-1.5 flex items-center gap-1.5">
          <span>{baseName}</span>
          {fileMeta?.size_formatted && (
            <span>({fileMeta.size_formatted})</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRevealExplorer && onRevealExplorer(filename)}
          className="mt-3 text-xs font-sans text-[var(--theme-accent)] hover:underline cursor-pointer bg-transparent border-none p-0 transition-opacity hover:opacity-90 active:opacity-75"
          title="Open in Native File Explorer"
        >
          Open in Explorer
        </button>
      </div>

    </div>
  );
}
