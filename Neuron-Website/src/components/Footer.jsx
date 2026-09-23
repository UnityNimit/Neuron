import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ShieldCheck, FileText, Lock, Database } from 'lucide-react';
import ThemeLangControls from './ThemeLangControls';

const GithubIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const LinkedInIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
);

const XIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const RedditIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87s-7.004-2.176-7.004-4.87c0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.249-.562 1.249-1.25 0-.69-.56-1.25-1.25-1.25zm5.5 0c-.687 0-1.248.56-1.248 1.25 0 .688.561 1.25 1.249 1.25.688 0 1.249-.562 1.249-1.25 0-.69-.56-1.25-1.249-1.25zm-5.466 3.99a.327.327 0 0 0-.231.095.326.326 0 0 0 0 .463c.844.845 2.21 1.05 2.947 1.05.736 0 2.103-.205 2.947-1.05a.326.326 0 0 0 0-.463.327.327 0 0 0-.463 0c-.642.64-1.772.825-2.484.825-.713 0-1.843-.185-2.484-.825a.326.326 0 0 0-.232-.095z"/>
  </svg>
);

const YouTubeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const InstagramIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const LEGAL_DOCS = {
  tos: {
    title: 'Terms of Service',
    icon: FileText,
    content: `By downloading, installing, or browsing Neuron, you agree to comply with and be bound by these Terms of Service. Neuron is distributed as a completely open-source desktop software under the permissive MIT License.

1. Permissive License Grant: Subject to the MIT License, you are granted full permission to run, inspect, modify, fork, and distribute Neuron without license fees or subscription paywalls.
2. "As Is" Warranty Disclaimer: The software and website are provided on an "as is" and "as available" basis without warranties of any kind, whether express, statutory, or implied.
3. User Workstations: You retain 100% ownership and control over all code repositories, abstract syntax trees, and computational resources executed locally through Neuron.`
  },
  aup: {
    title: 'Acceptable Use Policy',
    icon: ShieldCheck,
    content: `Neuron is engineered exclusively for developers, researchers, and engineers building graph machine learning and spatial software architectures.

1. Ethical Code Analysis: You may not use Neuron or its local AST parser engines to reverse-engineer, inject malware into, or exploit vulnerable third-party codebases without explicit authorization.
2. Network Integrity: Local IPC sockets (127.0.0.1) must not be bridged into public unauthenticated networks or utilized for denial-of-service simulations.
3. Open-Source Respect: Redistribution of Neuron modifications must retain existing copyright notices and MIT license declarations.`
  },
  privacy: {
    title: 'Privacy Policy',
    icon: Lock,
    content: `At Neuron, privacy is not merely a policy—it is our core architectural invariant. Neuron operates on an uncompromising local-first execution model.

1. Zero Telemetry: We do not log, track, store, or transmit your keystrokes, opened projects, terminal sessions, or file paths.
2. Zero Cloud Code Ingestion: Abstract syntax tree parsing, D3 force-directed relaxation, and vector embeddings execute 100% on your workstation's CPU and GPU.
3. No Third-Party Trackers: Our marketing website contains zero tracking pixels, intrusive analytics scripts, or data-broker conduits.`
  },
  data: {
    title: 'Data Use',
    icon: Database,
    content: `Understanding how your codebase data is processed by the Neuron engine:

1. In-Memory AST Buffers: Source files are parsed via local Tree-Sitter daemons into transient memory buffers. When you close a project, AST partitions are cleanly freed.
2. Local SQLite Caches: Topological cluster partitions and project metadata are saved in a local SQLite file within your user profile directory. No data leaves your machine.
3. Bring Your Own Key (BYOK): External LLM completions occur only when you connect an API key or point to local inference engines (e.g. Ollama). All transmissions go directly from your machine to your chosen provider.`
  },
  security: {
    title: 'Security',
    icon: ShieldCheck,
    content: `Neuron enforces rigorous security baselines across desktop native wrappers and local IPC daemons.

1. Loopback Origin Validation: All daemon IPC channels bind strictly to 127.0.0.1 with unique session handshake tokens, preventing unauthorized browser tab access.
2. Sandboxed Subprocesses: Native language servers and terminal sessions run strictly under your local operating system user permissions without administrative elevation.
3. Vulnerability Reporting: We take security reports seriously. Please direct responsible disclosure inquiries directly to neuron.spatial.ide@gmail.com.`
  }
};

export default function Footer({ className = "mt-4 sm:mt-6" }) {
  const [activeLegal, setActiveLegal] = useState(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const openLegalModal = (key) => {
    setActiveLegal(LEGAL_DOCS[key] || null);
  };

  return (
    <footer className={`border-t border-white/[0.08] bg-[#050505] pt-10 pb-8 px-6 sm:px-10 md:px-16 w-full text-xs font-sans relative z-10 text-slate-400 ${className}`}>
      
      {/* Top Grid: Brand, Navigation, Legal, Socials */}
      <div className="w-full flex flex-col lg:flex-row justify-between items-start gap-10">
        
        {/* Left: Brand Column */}
        <div className="flex flex-col gap-3 max-w-sm">
          <Link to="/" onClick={scrollToTop} className="flex items-center gap-2.5 cursor-pointer">
            <img src="/logo.png" alt="Neuron" className="h-6 w-6 object-contain" />
            <span className="font-semibold text-white tracking-wide text-sm">Neuron</span>
          </Link>
          <p className="text-slate-400 text-xs leading-relaxed">
            The high-performance 2D spatial development environment and graph topological IDE. Built from the ground up for developers navigating massive codebases.
          </p>
        </div>

        {/* Right Columns: Navigation, Legal, Socials */}
        <div className="flex flex-wrap gap-12 sm:gap-16 md:gap-20 justify-start lg:justify-end text-left">
          
          {/* Navigation */}
          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
              Navigation
            </div>
            <Link to="/docs" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
              Documentation
            </Link>
            <Link to="/versions" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
              Versions
            </Link>
            <Link to="/help" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
              Help & Queries
            </Link>
          </div>

          {/* Legal Section (Requested in bottom bar / footer) */}
          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
              Legal
            </div>
            <button
              onClick={() => openLegalModal('tos')}
              className="text-left text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() => openLegalModal('aup')}
              className="text-left text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Acceptable Use Policy
            </button>
            <button
              onClick={() => openLegalModal('privacy')}
              className="text-left text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => openLegalModal('data')}
              className="text-left text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Data Use
            </button>
            <button
              onClick={() => openLegalModal('security')}
              className="text-left text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Security
            </button>
          </div>

          {/* Socials & Community */}
          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
              Socials
            </div>
            <a
              href="https://www.linkedin.com/in/neuron-spatial-ide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <LinkedInIcon size={14} />
              <span>LinkedIn</span>
            </a>
            <a
              href="https://x.com/SpatialIDE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <XIcon size={13} />
              <span>X (Twitter)</span>
            </a>
            <a
              href="https://www.reddit.com/user/Neuron_Spatial_IDE/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <RedditIcon size={14} />
              <span>Reddit</span>
            </a>
            <a
              href="https://www.youtube.com/@Neuron-Spatial-IDE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <YouTubeIcon size={14} />
              <span>YouTube</span>
            </a>
            <a
              href="https://www.instagram.com/neuron_spatial_ide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <InstagramIcon size={14} />
              <span>Instagram</span>
            </a>
            <a
              href="https://github.com/UnityNimit/Neuron"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
            </a>
          </div>

        </div>

      </div>

      {/* Bottom Bar: Professional Open-Source Note & Interactive Theme/Language Controls */}
      <div className="mt-10 pt-6 border-t border-white/[0.08] flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-[11px] text-slate-500 text-center sm:text-left">
          <span className="font-semibold text-slate-400">© 2026 Neuron.</span>
          <span className="hidden sm:inline text-white/20">•</span>
          <span className="text-slate-400">
            A complete open-source project released under the MIT License. Developed for the global software engineering community.
          </span>
        </div>

        {/* Exact Pixel-Perfect Theme & Language Controls */}
        <div className="shrink-0">
          <ThemeLangControls />
        </div>
      </div>

      {/* Interactive Legal Document Modal */}
      {activeLegal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-[#0e0f13] border border-white/[0.12] rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#60A5FA]/10 border border-[#60A5FA]/20 flex items-center justify-center text-[#60A5FA]">
                  <activeLegal.icon size={16} />
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  {activeLegal.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveLegal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line space-y-4">
              {activeLegal.content}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/[0.08] bg-[#090a0d] flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Neuron Open Source Governance</span>
              <button
                onClick={() => setActiveLegal(null)}
                className="h-7 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </footer>
  );
}