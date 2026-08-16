// src/components/docs/DocComponents.jsx
import React, { useState } from 'react';
import { Copy, Check, Info, AlertTriangle, Zap, Terminal } from 'lucide-react';

// ==========================================
// 1. THE CODE BLOCK (With Copy-to-Clipboard)
// ==========================================
export const CodeBlock = ({ code, language = "bash", title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-2xl">
      {/* Mac-style Window Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#141414] border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </div>
          {title && <span className="text-xs text-slate-400 font-mono tracking-wider">{title}</span>}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{language}</span>
          <button 
            onClick={handleCopy}
            className="text-slate-500 hover:text-white transition-colors flex items-center gap-1"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      
      {/* The Code Payload */}
      <div className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-slate-300">
        <pre><code>{code}</code></pre>
      </div>
    </div>
  );
};

// ==========================================
// 2. THE CALLOUT BOX (Info, Warning, Danger)
// ==========================================
export const Callout = ({ type = "info", title, children }) => {
  const styles = {
    info: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Info, iconColor: "text-blue-400" },
    warning: { bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle, iconColor: "text-orange-400" },
    danger: { bg: "bg-red-500/10", border: "border-red-500/20", icon: Zap, iconColor: "text-red-400" },
    terminal: { bg: "bg-[#111]", border: "border-[#333]", icon: Terminal, iconColor: "text-slate-400" }
  };

  const config = styles[type] || styles.info;
  const Icon = config.icon;

  return (
    <div className={`my-6 p-5 rounded-xl border ${config.bg} ${config.border} flex items-start gap-4 backdrop-blur-sm`}>
      <Icon size={20} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1">
        {title && <h4 className={`text-sm font-bold mb-1 ${config.iconColor}`}>{title}</h4>}
        <div className="text-sm text-slate-300 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. THE STEP-BY-STEP TRACKER
// ==========================================
export const Step = ({ number, title, children }) => (
  <div className="relative pl-10 my-8">
    <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400 shadow-lg">
      {number}
    </div>
    <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
    <div className="text-slate-400 text-sm leading-relaxed">
      {children}
    </div>
  </div>
);

// ==========================================
// 4. THE DOCUMENTATION SECTION WRAPPER
// ==========================================
export const DocSection = ({ id, title, children }) => (
  <section id={id} className="mb-16 scroll-mt-24">
    {title && (
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6 border-b border-white/10 pb-4">
        {title}
      </h2>
    )}
    <div className="space-y-4">
      {children}
    </div>
  </section>
);