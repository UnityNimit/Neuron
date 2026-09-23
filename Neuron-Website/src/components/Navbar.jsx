import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ExternalLink, Search } from 'lucide-react';
import { useDocsSearch } from '../context/DocsSearchContext';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const searchInputRef = useRef(null);

  const { searchQuery, setSearchQuery } = useDocsSearch();

  const isDocs = pathname.startsWith('/docs');
  const isVersions = pathname.startsWith('/versions');
  const isHelp = pathname.startsWith('/help');

  // Shortcut key: Ctrl+K / Cmd+K to focus search when on docs
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (isDocs && searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDocs]);

  const getLinkClasses = (isActive) =>
    `text-xs sm:text-[13px] transition-colors ${
      isActive 
        ? 'font-semibold text-white' 
        : 'font-medium text-slate-400 hover:text-white'
    }`;

  const getMobileLinkClasses = (isActive) =>
    `py-1.5 transition-colors ${
      isActive 
        ? 'font-semibold text-white' 
        : 'font-medium text-slate-400 hover:text-white'
    }`;

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#050505]/90 backdrop-blur-md border-b border-white/[0.08]">
      <nav 
        className="h-14 w-full flex items-center justify-between px-4 font-sans relative"
      >
        {/* Left Side: Brand Logo (Aligned 16px from left and 16px from top) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <img src="/logo.png" alt="Neuron" className="h-6 w-6 object-contain" />
            <span className="font-semibold text-white tracking-tight text-sm">Neuron</span>
          </Link>
        </div>

        {/* Center: Perfectly Centered Animated Docs Search */}
        {isDocs && (
          <div className="hidden sm:flex items-center absolute left-1/2 -translate-x-1/2 transition-all duration-300 animate-docs-search z-20 pointer-events-auto">
            <div className="relative w-64 sm:w-72 md:w-80 lg:w-96">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full bg-[#0d0e12]/95 hover:bg-[#12141a] focus:bg-[#0d0e12] border border-white/[0.08] focus:border-[#60A5FA]/60 rounded-md pl-7 pr-12 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X size={11} />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-block px-1 py-0.2 text-[8.5px] font-mono text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded select-none">
                    Ctrl K
                  </kbd>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Side Links - Visible across Desktop & Split Screen */}
        <div className="hidden min-[520px]:flex items-center gap-3 sm:gap-5 md:gap-7">
          <Link 
            to="/docs" 
            className={getLinkClasses(isDocs)}
          >
            Documentation
          </Link>
          <Link 
            to="/versions" 
            className={getLinkClasses(isVersions)}
          >
            Versions
          </Link>
          <Link 
            to="/help" 
            className={getLinkClasses(isHelp)}
          >
            Help
          </Link>
          <a 
            href="https://github.com/UnityNimit/Neuron" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs sm:text-[13px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 group"
          >
            <span>GitHub</span>
            <ExternalLink size={11} className="opacity-70 group-hover:opacity-100 transition-opacity" />
          </a>
          
          <a 
            href="https://github.com/UnityNimit/Neuron/releases/download/v1.0.0/Neuron_1.0.0_x64-setup.exe"
            download="Neuron-Setup.exe"
            className="h-8 px-3 sm:px-4 rounded-lg bg-white text-black text-xs font-semibold hover:bg-slate-100 header-download-glow inline-flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
          >
            Download
          </a>
        </div>

        {/* Mobile-only Menu Button (< 520px) */}
        <div className="min-[520px]:hidden flex items-center gap-2">
          <a 
            href="https://github.com/UnityNimit/Neuron/releases/download/v1.0.0/Neuron_1.0.0_x64-setup.exe"
            download="Neuron-Setup.exe"
            className="h-7 px-2.5 rounded-md bg-white text-black text-xs font-semibold header-download-glow inline-flex items-center justify-center"
          >
            Download
          </a>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Slide-down Menu (< 520px) */}
      {isMobileMenuOpen && (
        <div className="min-[520px]:hidden bg-[#050505] border-b border-white/[0.08] px-6 py-5 flex flex-col gap-3.5 text-xs font-sans">
          {isDocs && (
            <div className="relative w-full mb-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full bg-[#111216] border border-white/[0.08] focus:border-[#60A5FA]/60 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          )}
          <Link 
            to="/docs" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={getMobileLinkClasses(isDocs)}
          >
            Documentation
          </Link>
          <Link 
            to="/versions" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={getMobileLinkClasses(isVersions)}
          >
            Versions
          </Link>
          <Link 
            to="/help" 
            onClick={() => setIsMobileMenuOpen(false)}
            className={getMobileLinkClasses(isHelp)}
          >
            Help & Queries
          </Link>
          <a 
            href="https://github.com/UnityNimit/Neuron" 
            target="_blank" 
            rel="noopener noreferrer" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-1.5 font-medium text-slate-400 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>GitHub Repository</span>
            <ExternalLink size={12} className="opacity-70" />
          </a>
        </div>
      )}
    </header>
  );
}
