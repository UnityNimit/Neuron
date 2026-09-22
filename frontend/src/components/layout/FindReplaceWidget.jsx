// frontend/src/components/layout/FindReplaceWidget.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';

/**
 * 🔍 MINIMALIST THEMED FIND & REPLACE WIDGET FOR MONACO
 * - Replaces standard Monaco find widget with custom themed UI.
 * - Absolutely NO logos or icon clutter: pure typographic minimalism.
 * - Smoothly animated entrance and exit.
 * - Full support for case sensitivity, whole word, regex, previous/next, and single/all replace.
 */
export default function FindReplaceWidget({ editor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const findInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const decorationsRef = useRef([]);

  // Clear decorations on unmount or close
  const clearDecorations = useCallback(() => {
    if (editor && !editor.isDisposed?.() && decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
  }, [editor]);

  // Execute Search in Monaco Model
  const performSearch = useCallback((overrideIndex = null) => {
    if (!editor || !findText) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      clearDecorations();
      return;
    }

    const model = editor.getModel();
    if (!model || model.isDisposed()) {
      clearDecorations();
      return;
    }

    try {
      const found = model.findMatches(
        findText,
        false, // searchOnlyEditableRange
        isRegex,
        matchCase,
        matchWholeWord ? true : null,
        true // captureMatches
      );

      setMatches(found);

      if (found.length === 0) {
        setCurrentMatchIndex(-1);
        clearDecorations();
        return;
      }

      // Determine active match index based on current cursor/selection
      let nextIndex = 0;
      if (overrideIndex !== null && overrideIndex >= 0 && overrideIndex < found.length) {
        nextIndex = overrideIndex;
      } else {
        const cursor = editor.getPosition();
        if (cursor) {
          const foundIdx = found.findIndex(m => m.range.startLineNumber >= cursor.lineNumber);
          nextIndex = foundIdx !== -1 ? foundIdx : 0;
        }
      }

      setCurrentMatchIndex(nextIndex);

      // Highlight active match
      const activeMatch = found[nextIndex];
      if (activeMatch) {
        editor.setSelection(activeMatch.range);
        editor.revealRangeInCenterIfOutsideViewport(activeMatch.range);
      }

      // Apply Monaco editor decorations for all matches
      const newDecorations = found.map((m, idx) => ({
        range: m.range,
        options: {
          isWholeLine: false,
          className: idx === nextIndex ? 'neuron-find-active-match' : 'neuron-find-match',
          overviewRuler: {
            color: idx === nextIndex ? 'var(--theme-accent, #3b82f6)' : 'rgba(148, 163, 184, 0.4)',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      }));

      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
    } catch {
      // Invalid regex or search string syntax
      setMatches([]);
      setCurrentMatchIndex(-1);
      clearDecorations();
    }
  }, [editor, findText, isRegex, matchCase, matchWholeWord, clearDecorations]);

  // Navigate to Next / Previous Match
  const navigateMatch = useCallback((direction) => {
    if (matches.length === 0) return;
    let nextIdx;
    if (direction === 'next') {
      nextIdx = (currentMatchIndex + 1) % matches.length;
    } else {
      nextIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    }
    performSearch(nextIdx);
  }, [matches, currentMatchIndex, performSearch]);

  // Single Replace
  const handleReplace = useCallback(() => {
    if (!editor || matches.length === 0 || currentMatchIndex === -1) return;
    const match = matches[currentMatchIndex];
    if (!match) return;

    editor.executeEdits('custom-find-replace', [{
      range: match.range,
      text: replaceText,
      forceMoveMarkers: true
    }]);

    // Re-run search after edit
    setTimeout(() => {
      performSearch(currentMatchIndex);
    }, 10);
  }, [editor, matches, currentMatchIndex, replaceText, performSearch]);

  // Replace All
  const handleReplaceAll = useCallback(() => {
    if (!editor || matches.length === 0) return;

    const edits = matches.map(m => ({
      range: m.range,
      text: replaceText,
      forceMoveMarkers: true
    }));

    editor.executeEdits('custom-find-replace', edits);

    setTimeout(() => {
      performSearch(0);
    }, 10);
  }, [editor, matches, replaceText, performSearch]);

  // Listen to open events from Monaco (Ctrl+F / Ctrl+H)
  useEffect(() => {
    const handleOpen = (e) => {
      const { mode, initialText } = e.detail || {};
      setIsOpen(true);
      if (mode === 'replace') {
        setShowReplace(true);
      }
      if (initialText && typeof initialText === 'string') {
        setFindText(initialText);
      }
      setTimeout(() => {
        findInputRef.current?.focus();
        findInputRef.current?.select();
      }, 50);
    };

    window.addEventListener('neuron-open-find-widget', handleOpen);
    return () => window.removeEventListener('neuron-open-find-widget', handleOpen);
  }, []);

  // Re-run search when inputs or options change
  useEffect(() => {
    if (isOpen) {
      performSearch();
    } else {
      clearDecorations();
    }
  }, [isOpen, findText, matchCase, matchWholeWord, isRegex, performSearch, clearDecorations]);

  // Global keydown listeners inside widget
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      clearDecorations();
      editor?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigateMatch('prev');
      } else {
        navigateMatch('next');
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    clearDecorations();
    editor?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .neuron-find-match {
          background-color: rgba(59, 130, 246, 0.22);
          border-bottom: 1.5px solid var(--theme-accent, #3b82f6);
        }
        .neuron-find-active-match {
          background-color: rgba(234, 179, 8, 0.35);
          outline: 1.5px solid rgba(234, 179, 8, 0.9);
          outline-offset: -1px;
        }
      `}</style>

      <div 
        className="absolute top-2 right-4 z-40 rounded-xl border shadow-2xl p-2 flex flex-col gap-1.5 font-mono text-[11px] select-none animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md"
        style={{
          backgroundColor: 'var(--theme-surface, #161719)',
          borderColor: 'var(--theme-border, #242628)',
          color: 'var(--theme-text-primary, #cbd5e1)',
          boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--theme-border, #242628)'
        }}
        onKeyDown={handleKeyDown}
      >
        {/* ROW 1: FIND INPUT & CONTROLS */}
        <div className="flex items-center gap-1.5">
          {/* Expand/Collapse Replace Chevron */}
          <button
            type="button"
            onClick={() => setShowReplace(!showReplace)}
            className="w-5 h-6 rounded flex items-center justify-center text-[9px] transition-colors hover:bg-[var(--theme-surface-hover)] cursor-pointer"
            style={{ color: 'var(--theme-text-muted, #64748b)' }}
            title={showReplace ? "Collapse Replace" : "Expand Replace"}
          >
            {showReplace ? '▼' : '▶'}
          </button>

          {/* Find Input with Integrated Match Counter */}
          <div 
            className="flex items-center rounded-lg border px-2 py-0.5 min-w-[200px] max-w-[280px] flex-1 transition-colors focus-within:border-[var(--theme-accent)]"
            style={{
              backgroundColor: 'var(--theme-background, #121314)',
              borderColor: 'var(--theme-border, #242628)',
            }}
          >
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Find..."
              spellCheck={false}
              className="w-full bg-transparent outline-none text-[11px] leading-tight"
              style={{ color: 'var(--theme-text-bright, #ffffff)' }}
            />
            {findText && (
              <span 
                className="text-[10px] pl-1.5 shrink-0 opacity-70"
                style={{ color: matches.length > 0 ? 'var(--theme-text-muted, #64748b)' : '#ef4444' }}
              >
                {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
              </span>
            )}
          </div>

          {/* Search Options (Case, Word, Regex) - Pure text, NO logos */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMatchCase(!matchCase)}
              className={`h-6 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                matchCase ? 'border-[var(--theme-accent)]' : 'border-transparent hover:bg-[var(--theme-surface-hover)]'
              }`}
              style={{
                backgroundColor: matchCase ? 'var(--theme-surface-active, #222426)' : 'transparent',
                color: matchCase ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-muted, #64748b)'
              }}
              title="Match Case (Alt+C)"
            >
              Aa
            </button>

            <button
              type="button"
              onClick={() => setMatchWholeWord(!matchWholeWord)}
              className={`h-6 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                matchWholeWord ? 'border-[var(--theme-accent)]' : 'border-transparent hover:bg-[var(--theme-surface-hover)]'
              }`}
              style={{
                backgroundColor: matchWholeWord ? 'var(--theme-surface-active, #222426)' : 'transparent',
                color: matchWholeWord ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-muted, #64748b)'
              }}
              title="Match Whole Word (Alt+W)"
            >
              \b
            </button>

            <button
              type="button"
              onClick={() => setIsRegex(!isRegex)}
              className={`h-6 px-1.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                isRegex ? 'border-[var(--theme-accent)]' : 'border-transparent hover:bg-[var(--theme-surface-hover)]'
              }`}
              style={{
                backgroundColor: isRegex ? 'var(--theme-surface-active, #222426)' : 'transparent',
                color: isRegex ? 'var(--theme-accent, #3b82f6)' : 'var(--theme-text-muted, #64748b)'
              }}
              title="Use Regular Expression (Alt+R)"
            >
              .*
            </button>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-0.5 border-l pl-1" style={{ borderColor: 'var(--theme-border, #242628)' }}>
            <button
              type="button"
              onClick={() => navigateMatch('prev')}
              disabled={matches.length === 0}
              className="w-5 h-6 rounded flex items-center justify-center text-[11px] disabled:opacity-30 hover:bg-[var(--theme-surface-hover)] cursor-pointer"
              style={{ color: 'var(--theme-text-secondary, #94a3b8)' }}
              title="Previous Match (Shift+Enter)"
            >
              ↑
            </button>

            <button
              type="button"
              onClick={() => navigateMatch('next')}
              disabled={matches.length === 0}
              className="w-5 h-6 rounded flex items-center justify-center text-[11px] disabled:opacity-30 hover:bg-[var(--theme-surface-hover)] cursor-pointer"
              style={{ color: 'var(--theme-text-secondary, #94a3b8)' }}
              title="Next Match (Enter)"
            >
              ↓
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="w-5 h-6 rounded flex items-center justify-center text-[11px] hover:bg-[var(--theme-surface-hover)] hover:text-[var(--theme-text-bright)] cursor-pointer ml-0.5"
              style={{ color: 'var(--theme-text-muted, #64748b)' }}
              title="Close (Escape)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ROW 2: REPLACE INPUT & ACTION BUTTONS (Smooth Expand) */}
        {showReplace && (
          <div className="flex items-center gap-1.5 pt-0.5 animate-in fade-in duration-100">
            <span className="w-5 text-center text-[9px] opacity-40">↳</span>

            <div 
              className="flex items-center rounded-lg border px-2 py-0.5 min-w-[200px] max-w-[280px] flex-1 transition-colors focus-within:border-[var(--theme-accent)]"
              style={{
                backgroundColor: 'var(--theme-background, #121314)',
                borderColor: 'var(--theme-border, #242628)',
              }}
            >
              <input
                ref={replaceInputRef}
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleReplace();
                  }
                }}
                placeholder="Replace with..."
                spellCheck={false}
                className="w-full bg-transparent outline-none text-[11px] leading-tight"
                style={{ color: 'var(--theme-text-bright, #ffffff)' }}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReplace}
                disabled={matches.length === 0 || currentMatchIndex === -1}
                className="px-2 py-0.5 rounded border text-[10px] font-mono transition-colors disabled:opacity-30 hover:border-[var(--theme-accent)] cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface-active, #222426)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
                title="Replace Next (Enter)"
              >
                Replace
              </button>

              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={matches.length === 0}
                className="px-2 py-0.5 rounded border text-[10px] font-mono transition-colors disabled:opacity-30 hover:border-[var(--theme-accent)] cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface-active, #222426)',
                  borderColor: 'var(--theme-border, #242628)',
                  color: 'var(--theme-text-primary, #cbd5e1)'
                }}
                title="Replace All"
              >
                All
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
