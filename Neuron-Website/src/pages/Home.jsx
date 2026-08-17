import React from 'react';
import { 
  Download, ArrowRight, Terminal, Cpu, Zap, 
  GitBranch, Box, Globe, Lock, Code2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PixelBlast from '../components/PixelBlast';
import ScrambledText from '../components/ScrambledText';
import GlassPanel from '../components/GlassPanel';
import Footer from '../components/Footer';

// Reusable elegant placeholder for future UI components
const UIPlaceholder = ({ title, height = "h-80", icon: Icon = Code2 }) => (
  <div className={`w-full ${height} mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-slate-500 relative overflow-hidden group backdrop-blur-sm transition-colors hover:bg-white/[0.04]`}>
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    <Icon size={32} className="mb-3 opacity-40 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-110 transform" />
    <span className="text-sm font-mono tracking-wider">{title}</span>
  </div>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans relative selection:bg-blue-500/30">
      
      {/* Interactive WebGL Background */}
      <div className="fixed inset-0 z-0 opacity-60 md:opacity-75 pointer-events-auto">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/30 to-[#0a0a0a] z-10 pointer-events-none" />
        <PixelBlast
          variant="square"
          pixelSize={4}
          color="#60A5FA" // Sky Blue
          patternScale={2}
          patternDensity={1.2}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          speed={0.5}
          edgeFade={0.2}
          transparent
        />
      </div>

      {/* Main Content Wrapper */}
      <main className="relative z-10 pt-40 pb-20 px-6 pointer-events-none">
        
        {/* 1. Hero Section */}
        <section className="max-w-5xl mx-auto text-center flex flex-col items-center mb-32">
          
          <div className="flex flex-col items-center gap-2 mb-8 pointer-events-auto">
            {/* Static Text Without Scramble Animation */}
            <span className="text-5xl md:text-[6.5rem] font-black tracking-tighter text-white leading-none">
              THE SPATIAL IDE        
            </span>
            
            {/* Scrambled Text (Sky-Blue color #60A5FA matching background) */}
            <ScrambledText
              className="!m-0 !max-w-none !font-sans text-2xl md:text-[4rem] font-semibold tracking-tighter text-[#60A5FA] leading-none mt-1"
              radius={150}
              duration={1.5}
              speed={0.4}
              scrambleChars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            >
              Neuron
            </ScrambledText>
          </div>

          {/* GlassPanel Frosted Hero Buttons */}
          <div className="flex flex-row items-center justify-center gap-4 mt-4 pointer-events-auto">
            <Link to="/downloads">
              <GlassPanel className="px-5 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-xs md:text-sm font-medium text-white transition-all hover:scale-105 cursor-pointer">
                Download for Windows <Download size={15} />
              </GlassPanel>
            </Link>

            <a href="#demo">
              <GlassPanel className="px-5 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-xs md:text-sm font-medium text-white transition-all hover:scale-105 cursor-pointer">
                Request a demo <ArrowRight size={15} />
              </GlassPanel>
            </a>
          </div>
        </section>

        {/* 2. Social Proof / Logos */}
        <section className="max-w-6xl mx-auto mb-40 text-center pointer-events-auto">
          <p className="text-sm font-medium text-slate-500 mb-8 tracking-wide">
            Trusted every day by teams that build world-class software
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale">
            <span className="text-xl font-bold font-serif">Acme Corp</span>
            <span className="text-xl font-bold tracking-tighter">GlobalTech</span>
            <span className="text-xl font-bold font-mono">Quantum</span>
            <span className="text-xl font-bold italic">Stark Ind.</span>
            <span className="text-xl font-bold">Cyberdyne</span>
          </div>
        </section>

        {/* 3. Core Features (Bento Grid Style utilizing GlassPanel) */}
        <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-40 pointer-events-auto">
          
          <GlassPanel className="md:col-span-2 p-10 md:p-16 rounded-[2rem] overflow-hidden relative">
            <div className="max-w-2xl relative z-10">
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-4">Agents turn ideas into code</h2>
              <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-6">
                Accelerate development by handing off tasks to Neuron, while you focus on making decisions.
              </p>
              <a href="#" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Learn about agentic development <ArrowRight size={16} />
              </a>
            </div>
            <UIPlaceholder title="Agentic Code Generation Interactive UI" height="h-96" />
          </GlassPanel>

          <GlassPanel className="p-10 rounded-[2rem]">
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white mb-4">Works autonomously, runs in parallel</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Agents use their own computers to build, test, and demo features end to end for you to review.
            </p>
            <a href="#" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors mb-6">
              Learn about cloud agents <ArrowRight size={16} />
            </a>
            <UIPlaceholder title="Cloud Agent Workspace Map" height="h-72" icon={Globe} />
          </GlassPanel>

          <GlassPanel className="p-10 rounded-[2rem]">
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white mb-4">In every tool, at every step</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Neuron runs in your terminal, collaborates in Slack, and reviews PRs in GitHub.
            </p>
            <UIPlaceholder title="Terminal & CI/CD Integrations" height="h-[21rem]" icon={Terminal} />
          </GlassPanel>

        </section>

        {/* 4. Wall of Love (Testimonials utilizing GlassPanel) */}
        <section className="max-w-7xl mx-auto mb-40 pointer-events-auto">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-center text-white mb-16">
            The new way to build software.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                quote: "It was night and day from one batch to another, adoption went from single digits to over 80%. It just spread like wildfire, all the best builders were using it.",
                author: "Diana Hu",
                role: "General Partner, Y Combinator"
              },
              {
                quote: "My favorite enterprise AI service is Neuron. Every one of our engineers, some 40,000, are now assisted by AI and our productivity has gone up incredibly.",
                author: "Jensen Huang",
                role: "President & CEO, NVIDIA"
              },
              {
                quote: "The best LLM applications have an autonomy slider. In Neuron, you can do Cmd+K for targeted edits, or let it rip with the full autonomy agentic version.",
                author: "Andrej Karpathy",
                role: "CEO, Eureka Labs"
              },
              {
                quote: "It quickly grew from hundreds to thousands of extremely enthusiastic Stripe employees. We spend more on R&D than any other undertaking, and there's significant economic outcomes making that process more efficient.",
                author: "Patrick Collison",
                role: "Co-Founder & CEO, Stripe"
              },
              {
                quote: "The most useful AI tool that I currently pay for, hands down. It's fast, autocompletes when and where you need it to, sensible keyboard shortcuts, bring-your-own-model... everything is well put together.",
                author: "shadcn",
                role: "Creator of shadcn/ui"
              },
              {
                quote: "It's definitely becoming more fun to be a programmer. We are at the 1% of what's possible, and it's in interactive experiences where models like GPT-5 shine brightest.",
                author: "Greg Brockman",
                role: "President, OpenAI"
              }
            ].map((testimonial, i) => (
              <GlassPanel key={i} className="p-8 rounded-2xl flex flex-col justify-between hover:bg-white/[0.04]">
                <p className="text-slate-300 leading-relaxed mb-8">"{testimonial.quote}"</p>
                <div>
                  <p className="text-white font-medium">{testimonial.author}</p>
                  <p className="text-slate-500 text-sm">{testimonial.role}</p>
                </div>
              </GlassPanel>
            ))}
          </div>
        </section>

        {/* 5. Models & Fleet Execution (GlassPanels) */}
        <section className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-40 pointer-events-auto">
          <GlassPanel className="p-10 rounded-[2rem] flex flex-col">
            <h2 className="text-3xl font-medium tracking-tight text-white mb-4">Stay on the frontier</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Choose between every cutting-edge model from OpenAI, Anthropic, Gemini, SpaceXAI, and Neuron.
            </p>
            <a href="#" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors mb-6">
              Explore models <ArrowRight size={16} />
            </a>
            <div className="flex-grow flex flex-col justify-end">
               <UIPlaceholder title="Model Selection Dropdown Demo" height="h-64" icon={Box} />
            </div>
          </GlassPanel>
          
          <GlassPanel className="p-10 rounded-[2rem] flex flex-col">
            <h2 className="text-3xl font-medium tracking-tight text-white mb-4">Build with autonomous agents</h2>
            <p className="text-slate-400 leading-relaxed mb-6">
              Launch fleets of agents that work in parallel on ambitious tasks for hours or days.
            </p>
            <a href="#" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors mb-6">
              Learn about cloud agents <ArrowRight size={16} />
            </a>
            <div className="flex-grow flex flex-col justify-end">
              <UIPlaceholder title="Agent Fleet Task Tracker" height="h-64" icon={GitBranch} />
            </div>
          </GlassPanel>
        </section>

        {/* 6. Enterprise & Blog Split */}
        <section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mb-40 pointer-events-auto">
          
          <GlassPanel className="lg:col-span-1 p-10 rounded-[2rem] flex flex-col justify-center bg-blue-900/10">
            <Lock size={32} className="text-blue-400 mb-6" />
            <h2 className="text-3xl font-medium tracking-tight text-white mb-4">Develop enduring software</h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              Trusted by over half of the Fortune 500 to accelerate development, securely and at scale.
            </p>
            <a href="#" className="inline-flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-medium transition-all w-fit shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]">
              Explore enterprise <ArrowRight size={16} />
            </a>
          </GlassPanel>

          <GlassPanel className="lg:col-span-2 p-10 rounded-[2rem]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-medium tracking-tight text-white">Recent highlights</h2>
              <a href="#" className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                View all blog posts <ArrowRight size={14} />
              </a>
            </div>
            
            <div className="space-y-6">
              {[
                { date: "Aug 12, 2026", tag: "Research", title: "Introducing Grok 4.6", author: "Neuron Team · 3 min read" },
                { date: "Jul 20, 2026", tag: "Research", title: "Agent swarms and the new model economics", author: "Wilson Lin · 17 min read" },
                { date: "Jun 29, 2026", tag: "Product", title: "Build from anywhere with Neuron for iOS", author: "Chris, Rikki & Kevin · 7 min read" }
              ].map((post, i) => (
                <div key={i} className="group cursor-pointer block border-b border-white/5 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 font-mono">
                    <span>{post.date}</span>
                    <span>·</span>
                    <span className="text-blue-400">{post.tag}</span>
                  </div>
                  <h3 className="text-lg text-white font-medium group-hover:text-blue-400 transition-colors mb-1">
                    {post.title}
                  </h3>
                  <p className="text-sm text-slate-500">{post.author}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </section>

        {/* 7. Bottom CTA */}
        <section className="max-w-4xl mx-auto text-center mb-40 pointer-events-auto">
          <h2 className="text-5xl md:text-7xl font-medium tracking-tighter text-white mb-10">
            Try Neuron now.
          </h2>
          <Link to="/downloads">
            <GlassPanel className="inline-flex items-center gap-2 px-6 py-3 rounded-xl hover:bg-white/10 text-white font-medium transition-all hover:scale-105 cursor-pointer">
              Download for Windows <Download size={18} />
            </GlassPanel>
          </Link>
        </section>
      </main>

      {/* 8. Modular Footer Component */}
      <Footer />
    </div>
  );
}

export const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="mb-8 relative group">
        <Search size={14}

export const getTableOfContents = (pageId) => {
  const tocMap = {
    'intro': ['Core Philosophy', 'Dual-Engine Architecture'],
    'install': ['System Prerequisites', 'Python AI Daemon', 'WebGPU Client'],
    'quickstart': ['Navigating the Map', 'AI Code Analysis', 'Code Execution'],
    'spatial-engine': ['Bypassing the React DOM', 'Pure RAM D3 Physics', 'O(1) BFS Focus-Ray'],
    'ml-overview': ['Multi-Modal AST Extraction', 'Cyclomatic Complexity', 'Semantic Resolution'],
    'louvain': ['Unsupervised Microservice Discovery', 'Modularity Maximization'],
    'risk-model': ['The Ensemble Risk Equation', 'Code Smell Diagnosis'],
    'shortcuts': ['Spatial Map Engine', 'File Operations', 'Edit & Navigation', 'View Controls'],
    'terminal-cli': ['Terminal Emulation', 'Process Management', 'Multi-Shell Support']
  };
  return tocMap[pageId] || [];
};

export const toggleSection = (category) => {
    setOpenSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

export default function Docs() {
  const [activePage, setActivePage] = useState('intro');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [openSections, setOpenSections] = useState(() => {
    const initialState = {};
    DOCS_NAVIGATION.forEach(sec => initialState[sec.category] = true);
    return initialState;
  });

  

  useEffect(() => {
    if (isMobileNavOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => document.body.style.overflow = 'auto';
  }, [isMobileNavOpen]);

  // Derived current active TOC
  const currentTOC = useMemo(() => getTableOfContents(activePage), [activePage]);

   className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        <input 
          type="text" 
          placeholder="Search documentation..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#111111] border border-white/10 focus:border-blue-500/50 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 outline-none transition-all placeholder:text-slate-600 shadow-inner"
        />
      </div>

      <nav className="flex-1 overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {DOCS_NAVIGATION.map((section, idx) => (
          <div key={idx} className="mb-6">
            <button 
              onClick={() => toggleSection(section.category)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-[0.15em] mb-2 px-1 group transition-colors outline-none"
            >
              <span>{section.category}</span>
              <ChevronRight size={14} className={`transition-transform duration-300 ease-in-out ${openSections[section.category] ? 'rotate-90 text-slate-400' : 'text-slate-600'}`} />
            </button>
            
            <div className={`grid transition-all duration-300 ease-in-out ${openSections[section.category] ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <ul className="overflow-hidden space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activePage === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => { setActivePage(item.id); setIsMobileNavOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 whitespace-nowrap outline-none ${isActive ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-sans relative flex pt-16">
      <div className="fixed top-0 left-0 w-[800px] h-[800px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-500">
          {isMobileNavOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileNavOpen(false)} />
          <div className="w-80 h-full max-h-screen relative flex flex-col p-6 bg-[#0a0a0a]">
            <SidebarContent />
          </div>
        </div>
      )}

      <aside className="hidden lg:block w-80 h-[calc(100vh-4rem)] sticky top-16 bg-[#0a0a0a] px-8 py-8 z-20 shrink-0">
        <SidebarContent />
      </aside>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 lg:px-12 xl:px-20 relative z-10 min-h-screen">
        
        {/* 🚀 MODULAR CONTENT ROUTING */}
        {['intro', 'install', 'quickstart'].includes(activePage) && <GettingStarted activeSection={activePage} />}
        
        {activePage === 'spatial-engine' && <Architecture />}
        
        {['ml-overview', 'louvain', 'risk-model', 'llm-peel'].includes(activePage) && <MachineLearning activeSection={activePage} />}
        
        {['shortcuts', 'terminal-cli'].includes(activePage) && <Reference activeSection={activePage} />}

        {/* CATCH-ALL FOR PENDING MODULES */}
        {(!['intro', 'install', 'quickstart', 'spatial-engine', 'ml-overview', 'louvain', 'risk-model', 'llm-peel', 'shortcuts', 'terminal-cli'].includes(activePage)) && (
          <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center justify-center h-96 text-slate-500 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
            <Box size={48} className="mb-4 opacity-20" />
            <h2 className="text-xl font-medium text-white mb-2">Module Pending Deployment</h2>
            <p className="text-sm">The documentation vector for this segment is currently compiling.</p>
          </div>
        )}

      </main>

      {/* DYNAMIC RIGHT SIDEBAR (Table of Contents) */}
      <aside className="hidden xl:block w-64 h-[calc(100vh-4rem)] sticky top-16 py-12 pr-8 shrink-0">
        {currentTOC.length > 0 ? (
          <>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">On this page</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              {currentTOC.map((heading, i) => (
                <li key={i} className="pl-4 border-l border-white/10 hover:border-blue-500 hover:text-white cursor-pointer transition-colors">
                  {heading}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </aside>

    </div>
  );
}
