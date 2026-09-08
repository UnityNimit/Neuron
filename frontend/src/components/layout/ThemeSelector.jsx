// src/components/layout/ThemeSelector.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { useTheme } from '../../config/themeConfig';

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentThemeId, setTheme, themes } = useTheme();
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Activity Bar Palette Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(prev => !prev)}
        className={`p-2 rounded-xl transition-colors cursor-pointer ${
          isOpen 
            ? 'text-[var(--theme-text-bright)] bg-[var(--theme-surface-hover)]' 
            : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-bright)] hover:bg-[var(--theme-surface-hover)]'
        }`}
        title="Color Themes"
        aria-label="Color Themes"
      >
        <Palette size={20} strokeWidth={1.6} />
      </button>

      {/* Floating Minimal Horizontal Bar with Color Circles */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-14 bottom-0 z-[250] flex items-center gap-2 px-2.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none"
          style={{
            backgroundColor: 'var(--theme-surface, #161719)',
            borderColor: 'var(--theme-border, #242628)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
          }}
        >
          {Object.entries(themes).map(([id, t]) => {
            const isSelected = currentThemeId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setTheme(id);
                }}
                className={`w-5 h-5 rounded-full cursor-pointer transition-all transform hover:scale-115 relative flex items-center justify-center shrink-0 ${
                  isSelected 
                    ? 'ring-2 ring-offset-2 scale-105' 
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: t.circleColor,
                  border: `1.5px solid ${t.circleBorder}`,
                  // Use theme accent for the ring and current surface for ring offset
                  '--tw-ring-color': 'var(--theme-accent, #3b82f6)',
                  '--tw-ring-offset-color': 'var(--theme-surface, #161719)',
                  outline: 'none'
                }}
                title={`${t.name}`}
                aria-label={`${t.name} Theme`}
              >
                {isSelected && (
                  <span 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: t.isDark ? '#ffffff' : '#000000'
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
