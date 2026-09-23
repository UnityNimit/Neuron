import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Check, Copy } from 'lucide-react';
import { ScrollWriteHeading } from '../ScrollReveal';

const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'agent',
    time: '12:00',
    steps: [
      { step: 'Parsed AST & Louvain community index' },
      { step: 'Connected 40 spatial conduits' }
    ],
    thought: 'Inspecting spatial graph topology for misaligned nodes across runtime and parser domains...',
    text: 'Hello! I am Antigravity. I can inspect your codebase AST, navigate spatial conduits, and execute automated refactors. What would you like to explore?'
  }
];

const SUGGESTED_OPTIONS = [
  { id: 'opt-1', label: 'Fix alignment' },
  { id: 'opt-2', label: 'Explain code structure' },
  { id: 'opt-3', label: 'Find dependencies' }
];

const DEMO_COMMAND = "Fix alignment";
const DEMO_RESPONSE = "Alignment is fixed across all spatial nodes.";
const DOWNLOAD_FULL_TEXT = "To interact with your codebase, download Neuron";
const PREFIX = "To interact with your codebase, ";

export default function AntigravityAgentShowcase() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTypingAnimation, setIsTypingAnimation] = useState(false);
  const [options, setOptions] = useState([]);
  const [userInteracted, setUserInteracted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState({ 'msg-1': false });

  const messagesBoxRef = useRef(null);
  const idRef = useRef(100);
  const typewriterTimeoutRef = useRef(null);
  const sectionRef = useRef(null);
  const hasTriggeredRef = useRef(false);

  const scrollToDownload = () => {
    const el = document.getElementById('download-hero');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, inputValue, options]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = (code) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (_) {}
  };

  const toggleThought = (msgId) => {
    setExpandedThoughts(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Stream assistant response character-by-character
  const streamAgentResponse = useCallback((fullText, isDownload = false, extraProps = {}, onDone) => {
    idRef.current += 1;
    const agentMsgId = `agent-${idRef.current}`;

    const agentMsg = {
      id: agentMsgId,
      sender: 'agent',
      time: '12:01',
      isDownload,
      displayedText: '',
      ...extraProps
    };

    setMessages(prev => [...prev, agentMsg]);

    let charIndex = 0;
    const streamTick = () => {
      if (charIndex < fullText.length) {
        charIndex += Math.min(2, fullText.length - charIndex);
        const currentSlice = fullText.slice(0, charIndex);
        setMessages(prev =>
          prev.map(m => (m.id === agentMsgId ? { ...m, displayedText: currentSlice } : m))
        );
        typewriterTimeoutRef.current = setTimeout(streamTick, 18);
      } else {
        setMessages(prev =>
          prev.map(m => (m.id === agentMsgId ? { ...m, displayedText: fullText } : m))
        );
        if (onDone) onDone();
      }
    };

    typewriterTimeoutRef.current = setTimeout(streamTick, 30);
  }, []);

  // Execute user action (from chip click or input submission) -> streams "To interact with your codebase, download Neuron"
  const executeUserAction = useCallback((promptText) => {
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
    }
    setIsTypingAnimation(false);
    setOptions([]); // hide chips when action is executed

    idRef.current += 1;
    const userMsg = {
      id: `user-${idRef.current}`,
      sender: 'user',
      time: '12:01',
      text: promptText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    typewriterTimeoutRef.current = setTimeout(() => {
      streamAgentResponse(DOWNLOAD_FULL_TEXT, true);
    }, 280);
  }, [streamAgentResponse]);

  // Automated Typewriter Demo on scroll:
  // 1. Types "Fix alignment" into input
  // 2. Submits user message
  // 3. Types response with steps and proposed refactor
  // 4. AFTER response is finished typing, reveals the 3 command chips!
  const startTypewriterDemo = useCallback(() => {
    setIsTypingAnimation(true);
    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < DEMO_COMMAND.length) {
        charIndex += 1;
        setInputValue(DEMO_COMMAND.slice(0, charIndex));
        typewriterTimeoutRef.current = setTimeout(typeNextChar, 50);
      } else {
        // Finished typing command in input
        typewriterTimeoutRef.current = setTimeout(() => {
          setIsTypingAnimation(false);
          setInputValue('');

          idRef.current += 1;
          const userMsg = {
            id: `user-${idRef.current}`,
            sender: 'user',
            time: '12:01',
            text: DEMO_COMMAND
          };

          setMessages(prev => [...prev, userMsg]);

          // Typewrite the alignment fixed response with authentic agentic steps
          typewriterTimeoutRef.current = setTimeout(() => {
            streamAgentResponse(
              DEMO_RESPONSE, 
              false, 
              {
                steps: [
                  { step: 'Calculated Coulomb repulsion & Hooke springs' },
                  { step: 'Settled velocity momentum across 40 folder nodes' }
                ],
                thought: 'Applying 60 FPS verlet physics relaxation loop on cluster centers...',
                refactor: {
                  filePath: 'frontend/src/App.jsx',
                  applied: true,
                  code: 'relaxation.stabilize(clusters);\nspatialEngine.alignNodes({ smoothDecay: 0.85 });'
                }
              },
              () => {
                // After typing finishes, reveal the three command chips!
                setTimeout(() => {
                  setOptions(SUGGESTED_OPTIONS);
                }, 200);
              }
            );
          }, 300);
        }, 350);
      }
    };

    typewriterTimeoutRef.current = setTimeout(typeNextChar, 350);
  }, [streamAgentResponse]);

  // Trigger typewriter demo when user scrolls down to this section
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const handleScrollCheck = () => {
      if (hasTriggeredRef.current || userInteracted) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      if (rect.top <= viewportHeight * 0.75 && rect.bottom >= viewportHeight * 0.25) {
        hasTriggeredRef.current = true;
        setTimeout(() => {
          startTypewriterDemo();
        }, 300);
        window.removeEventListener('scroll', handleScrollCheck);
      }
    };

    window.addEventListener('scroll', handleScrollCheck, { passive: true });
    setTimeout(handleScrollCheck, 400);

    return () => {
      window.removeEventListener('scroll', handleScrollCheck);
    };
  }, [startTypewriterDemo, userInteracted]);

  // User manually clicking a suggested chip -> streams try Neuron
  const handleSelectOption = (label) => {
    setUserInteracted(true);
    hasTriggeredRef.current = true;
    executeUserAction(label);
  };

  // User manually typing and submitting -> streams try Neuron
  const handleSendMessage = (e) => {
    e?.preventDefault();
    setUserInteracted(true);
    hasTriggeredRef.current = true;
    const text = inputValue.trim();
    if (!text) return;
    executeUserAction(text);
  };

  const handleInputChange = (e) => {
    setUserInteracted(true);
    hasTriggeredRef.current = true;
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
    }
    setIsTypingAnimation(false);
    setInputValue(e.target.value);
  };

  return (
    <section ref={sectionRef} className="mb-24 sm:mb-28 w-full text-left">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* LEFT COLUMN: Simplified AI integration copy */}
        <div className="lg:col-span-5 text-left flex flex-col justify-center">
          <ScrollWriteHeading
            text="Integrate AI with your codebase"
            as="h2"
            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2 leading-snug"
          />
        </div>

        {/* RIGHT COLUMN: Clean Interactive Assistant Window matching AiChatView.jsx */}
        <div className="lg:col-span-7 w-full">
          <div className="w-full bg-[#141516] border border-[#242628] rounded-2xl overflow-hidden shadow-2xl font-sans text-xs text-[#cbd5e1] flex flex-col h-[480px] sm:h-[500px] justify-between">
            
            {/* Header matching AiChatView.jsx */}
            <div className="h-10 bg-[#191a1b] border-b border-[#242628] px-3.5 flex items-center justify-between select-none shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#3b82f6]" />
                <span className="text-xs font-mono font-medium text-white tracking-wide">Antigravity Studio</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Model Selector Dropdown badge */}
                <div className="px-2 py-0.5 rounded-md bg-[#161719] border border-[#242628] text-[11px] font-mono text-[#94a3b8] flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                  <span>Gemini 2.5 Pro</span>
                  <ChevronDown size={11} className="opacity-60" />
                </div>
              </div>
            </div>

            {/* Messages Flow matching AiChatView.jsx */}
            <div ref={messagesBoxRef} className="flex-1 p-4 sm:p-5 space-y-4 overflow-y-auto bg-[#141516] font-mono text-[12px] [&::-webkit-scrollbar]:w-1">
              {messages.map(msg => {
                if (msg.sender === 'user') {
                  return (
                    <div key={msg.id} className="flex flex-col items-end space-y-1">
                      <div className="text-[10px] text-[#64748b] flex items-center gap-1.5 px-1">
                        <span>You</span>
                        <span>{msg.time}</span>
                      </div>
                      <div className="bg-[#282a2d] border border-[#242628] text-[#f8fafc] px-3.5 py-2 rounded-xl max-w-[85%] text-xs shadow-sm">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const currentText = msg.displayedText ?? msg.text ?? '';
                const isThoughtOpen = expandedThoughts[msg.id] ?? false;

                return (
                  <div key={msg.id} className="flex flex-col items-start space-y-1.5 max-w-[95%]">
                    <div className="text-[10px] text-[#64748b] flex items-center gap-1.5 px-1">
                      <span>Antigravity</span>
                      <span className="opacity-50">{msg.time}</span>
                    </div>

                    <div className="bg-[#161719] border border-[#242628] rounded-xl p-3.5 text-xs space-y-2.5 shadow-sm text-[#cbd5e1] w-full">
                      {/* Agentic Execution Steps */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="flex flex-col gap-1 border-b border-[#242628] pb-2">
                          {msg.steps.map((st, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2 text-[11px]">
                              <Check size={12} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
                              <span className="text-[#94a3b8]">{st.step}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Collapsible Thinking Process Accordion */}
                      {msg.thought && (
                        <div className="rounded-lg border border-[#242628] bg-[#141516] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleThought(msg.id)}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[10px] uppercase font-semibold text-[#94a3b8] hover:bg-[#222426] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              {isThoughtOpen ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />}
                              <span>Thinking Process</span>
                            </div>
                            <span className="text-[9px] opacity-60">Thought trace</span>
                          </button>
                          {isThoughtOpen && (
                            <div className="px-3 py-2 text-[11px] leading-relaxed border-t border-[#242628] text-[#94a3b8] whitespace-pre-wrap bg-[#121314]">
                              {msg.thought}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rendered message body */}
                      <div className="leading-relaxed text-[12px]">
                        {msg.isDownload ? (
                          <span className="flex items-center gap-1 flex-wrap text-[#cbd5e1]">
                            {(() => {
                              if (currentText.length <= PREFIX.length) {
                                return <span>{currentText}</span>;
                              }
                              const linkText = currentText.slice(PREFIX.length);
                              return (
                                <>
                                  <span>{PREFIX}</span>
                                  <button
                                    onClick={scrollToDownload}
                                    className="text-[#3b82f6] underline hover:text-[#60a5fa] font-medium cursor-pointer transition-colors"
                                  >
                                    {linkText}
                                  </button>
                                </>
                              );
                            })()}
                          </span>
                        ) : (
                          currentText
                        )}
                      </div>

                      {/* Interactive Refactor Card */}
                      {msg.refactor && (
                        <div className="rounded-xl border border-[#3b82f6] p-3 flex flex-col gap-2 bg-[#141516] shadow-sm mt-1">
                          <div className="flex items-center justify-between border-b border-[#242628] pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-white">Proposed Code Refactor</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono border border-[#242628] bg-[#161719] text-[#cbd5e1]">
                                @{msg.refactor.filePath}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400 font-medium flex items-center gap-1">
                              <Check size={11} /> Applied
                            </span>
                          </div>

                          <div className="p-2 rounded text-[11px] font-mono leading-tight whitespace-pre border border-[#242628] bg-[#161719] text-[#94a3b8] overflow-x-auto relative group">
                            {msg.refactor.code}
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.refactor.code)}
                              className="absolute top-1.5 right-1.5 p-1 rounded bg-[#222426] hover:text-white text-[#94a3b8] transition-colors cursor-pointer"
                              title="Copy code"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Context bar matching AiChatView.jsx */}
            <div className="px-3.5 py-1.5 border-t border-[#242628] bg-[#191a1b] flex items-center justify-between text-[10px] font-mono text-[#64748b] select-none shrink-0">
              <div className="flex items-center gap-1.5">
                <span>Context:</span>
                <span className="px-1.5 py-0.2 rounded border border-[#242628] bg-[#161719] text-[#cbd5e1]">
                  @App.jsx
                </span>
              </div>
              <span className="opacity-60">Attached</span>
            </div>

            {/* Suggested Option Chips */}
            {options.length > 0 && (
              <div className="px-3 py-2 bg-[#161719] border-t border-[#242628] flex flex-wrap gap-1.5 select-none shrink-0 transition-opacity duration-300">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt.label)}
                    className="px-2.5 py-1 rounded-md bg-[#1e2022] hover:bg-[#282a2d] border border-[#242628] text-[11px] font-mono text-[#cbd5e1] hover:text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <span>{opt.label}</span>
                    <span className="text-[#3b82f6]">→</span>
                  </button>
                ))}
              </div>
            )}

            {/* Chat Input matching AiChatView.jsx */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[#191a1b] border-t border-[#242628] shrink-0">
              <div className="flex items-center gap-2 bg-[#141516] border border-[#242628] rounded-xl px-3 py-2 focus-within:border-[#3b82f6] transition-colors">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Ask Antigravity or request refactor (Enter to send)..."
                  className="w-full bg-transparent text-xs text-white placeholder-[#64748b] focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={isTypingAnimation}
                  className="px-3 py-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white font-mono text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  Send
                </button>
              </div>
            </form>

          </div>
        </div>

      </div>
    </section>
  );
}
