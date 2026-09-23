import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Footer from '../components/Footer';

const FAQS = [
  {
    q: 'How does the 2D spatial canvas differ from a conventional file tree?',
    a: 'Traditional file trees present code as static hierarchical folders on disk. Neuron parses your abstract syntax trees using Tree-Sitter and renders functions, classes, and modules as topological nodes connected by actual call conduits and modularity clusters.'
  },
  {
    q: 'Does Neuron upload code, embeddings, or AST graphs to remote servers?',
    a: 'Zero cloud ingestion. All parsing, graph relaxation, vector embeddings, and AST mutations run strictly on your local CPU and GPU. The local daemon communicates via local 127.0.0.1 IPC sockets.'
  },
  {
    q: 'Does Neuron vend or host AI models, or do I bring my own keys?',
    a: 'Neuron does not vend, host, or proxy AI models. You connect your own API keys or run completely offline using local runtimes like Ollama.'
  },
  {
    q: 'How does bidirectional synchronization maintain code correctness?',
    a: 'When you modify files on disk or in the editor, Tree-Sitter re-indexes AST nodes instantly. Conversely, when you link nodes or accept edits on the spatial canvas, LibCST transforms the code while preserving indentation, comments, and docstrings.'
  },
  {
    q: 'What are the system prerequisites for running the desktop installer?',
    a: 'Neuron runs on 64-bit Windows 10 and 11. It leverages hardware WebGPU acceleration for high-framerate graph physics. The standalone installer bundles all required dependencies.'
  },
  {
    q: 'How do I report bugs or submit feature proposals?',
    a: 'You can submit queries directly using the form below or open an issue on our official GitHub repository at https://github.com/UnityNimit/Neuron/issues.'
  }
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formState.email || !formState.message) return;
    
    const subject = encodeURIComponent(`[Neuron Query] From ${formState.name}`);
    const body = encodeURIComponent(formState.message);
    const mailtoUrl = `mailto:neuron.spatial.ide@gmail.com?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans relative selection:bg-[#3B82F6]/30 selection:text-white flex flex-col justify-between">

      <main className="relative z-10 pt-[72px] pb-8 px-6 sm:px-8 md:px-12 w-full max-w-7xl mx-auto">
        <div className="text-left mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
            Help & Queries
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl font-normal">
            Find answers to common technical questions about the spatial engine, localhost runtime, or submit inquiries directly to the team.
          </p>
        </div>

        {/* FAQs Section */}
        <section className="mb-14">
          <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-[#0b0c10] border border-white/[0.08] hover:border-white/[0.14] rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-white leading-snug">
                      {faq.q}
                    </span>
                    <ChevronDown 
                      size={16} 
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#60A5FA]' : ''}`} 
                    />
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-4 pb-5 sm:px-5 sm:pb-5 pt-2 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-white/[0.04]">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Enquiry Form Section */}
        <section className="bg-[#0b0c10] border border-white/[0.08] rounded-xl p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
              Send an Inquiry
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Have a question, feedback, or a technical inquiry? Send a message directly to our team.
            </p>
          </div>

          {submitted ? (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check size={18} />
              </div>
              <h3 className="text-base font-semibold text-white">Inquiry Prepared</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Your email draft has been generated. If your client didn't open automatically, write to <span className="text-[#60A5FA]">neuron.spatial.ide@gmail.com</span>.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-3 text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] block font-medium">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full bg-[#111217] border border-white/[0.08] focus:border-[#60A5FA]/60 rounded-lg px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] block font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full bg-[#111217] border border-white/[0.08] focus:border-[#60A5FA]/60 rounded-lg px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[11px] block font-medium">Your Query / Message</label>
                <textarea
                  required
                  rows={5}
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  placeholder="Describe your query or technical question..."
                  className="w-full bg-[#111217] border border-white/[0.08] focus:border-[#60A5FA]/60 rounded-lg p-3.5 text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  Direct email: <a href="mailto:neuron.spatial.ide@gmail.com" className="text-slate-300 hover:text-white underline">neuron.spatial.ide@gmail.com</a>
                </div>

                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-slate-200 transition-all inline-flex items-center justify-center cursor-pointer active:scale-[0.98]"
                >
                  <span>Send Query</span>
                </button>
              </div>
            </form>
          )}
        </section>

      </main>

      <Footer />
    </div>
  );
}