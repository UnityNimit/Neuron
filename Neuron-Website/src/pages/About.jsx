import { Info, Code2, Cpu, Network, Zap, GitBranch, ExternalLink } from 'lucide-react';
import GlassPanel from '../components/GlassPanel';
import Footer from '../components/Footer';

const GithubIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans relative flex flex-col justify-between">
      {/* Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      <main className="relative z-10 pt-32 pb-24 px-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Info size={14} /> The Spatial Paradigm
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6">
            About Neuron
          </h1>
          <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
            Software has outgrown the 1-dimensional file tree. Neuron maps complex codebases onto a high-performance 2D spatial universe, letting developers visualize call-chains, isolate tech debt, and execute code visually.
          </p>
        </div>

        {/* Philosophy Card */}
        <GlassPanel className="p-8 md:p-12 rounded-3xl mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <Code2 className="text-blue-400" /> Beyond the 1D Text File Tree
          </h2>
          <div className="space-y-4 text-slate-300 leading-relaxed text-base">
            <p>
              Modern software systems span hundreds of files, dynamic modules, and microservices. In traditional editors like VS Code, developers navigate through alphabetical folder trees and dozens of open tabs — losing the mental model of how functions actually communicate at runtime.
            </p>
            <p>
              Neuron (originally Project Atlas) fundamentally rethinks developer tooling by treating software as a living, interconnected physical graph. By combining hardware-accelerated WebGPU rendering with Abstract Syntax Tree (AST) analysis and unsupervised machine learning, Neuron transforms invisible code relationships into visible, physical topologies.
            </p>
          </div>
        </GlassPanel>

        {/* Core Innovations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <GlassPanel className="p-8 rounded-2xl">
            <div className="text-blue-400 mb-4"><Zap size={24} /></div>
            <h3 className="text-xl font-bold text-white mb-2">300 FPS WebGPU Engine</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Bypasses the React render cycle completely using pure RAM mutations and PixiJS v8 sprite batching. Simulates tens of thousands of code nodes with zero DOM reflow overhead.
            </p>
          </GlassPanel>

          <GlassPanel className="p-8 rounded-2xl">
            <div className="text-purple-400 mb-4"><Network size={24} /></div>
            <h3 className="text-xl font-bold text-white mb-2">Unsupervised Graph ML</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Applies Louvain community detection on AST call graphs with 50x weighted execution edges, discovering true microservice clusters and rendering them as luminous gas nebulae.
            </p>
          </GlassPanel>

          <GlassPanel className="p-8 rounded-2xl">
            <div className="text-green-400 mb-4"><Cpu size={24} /></div>
            <h3 className="text-xl font-bold text-white mb-2">Multi-Modal AST Parser</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Integrates Tree-Sitter for incremental syntax parsing and LibCST for lossless bi-directional code refactoring, computing cyclomatic complexity and density metrics in real time.
            </p>
          </GlassPanel>

          <GlassPanel className="p-8 rounded-2xl">
            <div className="text-red-400 mb-4"><GitBranch size={24} /></div>
            <h3 className="text-xl font-bold text-white mb-2">Predictive Risk Heuristics</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Merges PageRank centrality, betweenness bottlenecks, and Git velocity into an ensemble risk equation, physically flagging tech debt as Radioactive Red hotspots.
            </p>
          </GlassPanel>
        </div>

        {/* Project Meta Card */}
        <GlassPanel className="p-8 rounded-2xl mb-16">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Info size={20} className="text-blue-400" /> Project Metadata & Links
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3 text-slate-300">
              <p><strong className="text-white">Lead Architect & Developer:</strong> UnityNimit</p>
              <p><strong className="text-white">Architecture:</strong> Client-Server Spatial IDE (Decoupled Daemon + WebGPU Canvas)</p>
              <p><strong className="text-white">License:</strong> Open Source Research Project</p>
            </div>
            <div className="space-y-3">
              <p className="flex items-center gap-2">
                <strong className="text-white">Source Repository:</strong>
                <a 
                  href="https://github.com/UnityNimit/Neuron" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <GithubIcon size={14} /> github.com/UnityNimit/Neuron <ExternalLink size={12} />
                </a>
              </p>
              <p className="flex items-center gap-2">
                <strong className="text-white">Website Repository:</strong>
                <a 
                  href="https://github.com/UnityNimit/Neuron-Website" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <GithubIcon size={14} /> github.com/UnityNimit/Neuron-Website <ExternalLink size={12} />
                </a>
              </p>
            </div>
          </div>
        </GlassPanel>

      </main>

      <Footer />
    </div>
  );
}