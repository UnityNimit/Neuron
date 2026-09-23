import { useState, useRef, useEffect } from 'react';
import { Monitor, Sun, Moon, Globe, ChevronDown, Check } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '简体中文' }
];

export default function ThemeLangControls({ className = '' }) {
  const [theme, setTheme] = useState('system');
  const [lang, setLang] = useState('English');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    // Persist or apply theme attribute for system/light/dark
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (newTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  return (
    <div className={`flex items-center gap-2.5 font-sans select-none relative ${className}`}>
      {/* 1. Theme Selector Pill (Exact pixel match to design reference) */}
      <div className="bg-[#18191d] border border-white/[0.08] p-0.5 rounded-full flex items-center shadow-inner">
        <button
          type="button"
          onClick={() => handleThemeChange('system')}
          title="System theme"
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            theme === 'system'
              ? 'bg-[#2b2d35] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          aria-label="System theme"
        >
          <Monitor size={14} className="stroke-[2]" />
        </button>

        <button
          type="button"
          onClick={() => handleThemeChange('light')}
          title="Light theme"
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-[#2b2d35] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          aria-label="Light theme"
        >
          <Sun size={14} className="stroke-[2]" />
        </button>

        <button
          type="button"
          onClick={() => handleThemeChange('dark')}
          title="Dark theme"
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-[#2b2d35] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
          aria-label="Dark theme"
        >
          <Moon size={14} className="stroke-[2]" />
        </button>
      </div>

      {/* 2. Language Selector Pill with Smooth Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsLangOpen(!isLangOpen)}
          className="bg-[#18191d] border border-white/[0.08] hover:border-white/[0.14] px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer shadow-inner"
          aria-haspopup="true"
          aria-expanded={isLangOpen}
        >
          <Globe size={14} className="text-[#60A5FA]" />
          <span>{lang}</span>
          <ChevronDown
            size={12}
            className={`text-slate-400 transition-transform duration-200 ${
              isLangOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu (Floats upward from footer) */}
        {isLangOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-36 bg-[#111216] border border-white/[0.12] rounded-xl py-1.5 shadow-2xl z-50 animate-fadeIn font-sans">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 px-3 py-1">
              Select Language
            </div>
            {LANGUAGES.map((l) => {
              const isSelected = lang === l.label;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.label);
                    setIsLangOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-white font-medium bg-white/[0.08]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{l.label}</span>
                  {isSelected && <Check size={12} className="text-[#60A5FA]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
