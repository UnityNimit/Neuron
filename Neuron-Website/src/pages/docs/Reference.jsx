import { DocSection, Callout, Step } from '../../components/docs/DocComponents';

// Custom Component for rendering Keyboard Keys
const Shortcut = ({ keys, description }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group">
    <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{description}</span>
    <div className="flex items-center gap-1.5">
      {keys.map((k, i) => (
        <kbd key={i} className="min-w-[28px] text-center px-2 py-1 bg-[#1e1e1e] border border-[#333] border-b-[#111] rounded-md text-[11px] font-mono text-slate-400 shadow-[0_2px_0_rgba(0,0,0,0.5)] group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors">
          {k}
        </kbd>
      ))}
    </div>
  </div>
);

export default function Reference({ activeSection }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {activeSection === 'shortcuts' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Keyboard Shortcuts
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron is designed for absolute power users. Every action in the IDE can be executed without moving your hands from the keyboard. Below is the complete reference matrix for the Spatial Engine.
          </p>

          <Callout type="info" title="Cross-Platform Support">
            On macOS, substitute <kbd className="font-mono text-xs">Ctrl</kbd> with <kbd className="font-mono text-xs">Cmd (⌘)</kbd>, and <kbd className="font-mono text-xs">Alt</kbd> with <kbd className="font-mono text-xs">Option (⌥)</kbd>.
          </Callout>

          <DocSection id="spatial-commands" title="Spatial Map Engine">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-xl px-5 py-2 shadow-xl mb-8">
              <Shortcut description="Trigger AI Impact Analysis (Blast Radius)" keys={['Alt', 'I']} />
              <Shortcut description="Isolate execution path (Focus Mode)" keys={['F']} />
              <Shortcut description="Clear Impact / Focus Isolation" keys={['Esc']} />
              <Shortcut description="Open Node in Full Monaco Editor" keys={['Double Click']} />
              <Shortcut description="Drag to Pan Camera" keys={['Left Click', 'Drag']} />
              <Shortcut description="Zoom Camera" keys={['Scroll Wheel']} />
            </div>
          </DocSection>

          <DocSection id="file-commands" title="File Operations">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-xl px-5 py-2 shadow-xl mb-8">
              <Shortcut description="Create New File" keys={['Ctrl', 'N']} />
              <Shortcut description="Open New IDE Window" keys={['Ctrl', 'Shift', 'N']} />
              <Shortcut description="Open Target Folder..." keys={['Ctrl', 'K', 'Ctrl', 'O']} />
              <Shortcut description="Save Current File" keys={['Ctrl', 'S']} />
            </div>
          </DocSection>

          <DocSection id="edit-commands" title="Edit & Navigation">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-xl px-5 py-2 shadow-xl mb-8">
              <Shortcut description="Find inside current file" keys={['Ctrl', 'F']} />
              <Shortcut description="Replace inside current file" keys={['Ctrl', 'H']} />
              <Shortcut description="Find across entire workspace" keys={['Ctrl', 'Shift', 'F']} />
              <Shortcut description="Replace across entire workspace" keys={['Ctrl', 'Shift', 'H']} />
              <Shortcut description="Toggle Line Comment" keys={['Ctrl', '/']} />
              <Shortcut description="Toggle Block Comment" keys={['Shift', 'Alt', 'A']} />
            </div>
          </DocSection>

          <DocSection id="view-commands" title="View & Layout Controls">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-xl px-5 py-2 shadow-xl mb-8">
              <Shortcut description="Open Command Palette (Omnibar)" keys={['Ctrl', 'K']} />
              <Shortcut description="Show All Commands" keys={['Ctrl', 'Shift', 'P']} />
              <Shortcut description="Toggle Explorer Sidebar" keys={['Ctrl', 'B']} />
              <Shortcut description="Toggle Terminal Panel" keys={['Ctrl', '`']} />
            </div>
          </DocSection>
        </>
      )}

      {activeSection === 'terminal-cli' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Terminal & CLI Guide
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron bridges your local operating system with the WebAssembly runtime. You can execute standard bash commands, run infinite loops, and kill processes seamlessly.
          </p>

          <DocSection id="terminal-basics" title="Terminal Emulation">
            <Step number="1" title="Interactive Subprocesses">
              The terminal panel connects directly to a Python <code>subprocess.Popen</code> backend via WebSockets. This means standard commands like <code>npm run dev</code> or <code>python script.py</code> execute natively on your host machine and stream <code>stdout</code> and <code>stderr</code> in real-time.
            </Step>
            <Step number="2" title="Force Killing Processes">
              Because Neuron tracks the PID of the spawned shell, hitting <kbd className="font-mono text-[10px] px-1 bg-slate-800 rounded text-slate-300">Ctrl+C</kbd> while the terminal is in focus will instantly send a <code>SIGTERM</code> (or <code>CTRL_BREAK_EVENT</code> on Windows) to safely kill infinite loops without crashing the backend server.
            </Step>
            <Step number="3" title="Multi-Shell Support">
              Clicking the <strong>+</strong> icon allows you to spawn concurrent, independent terminal tabs in PowerShell, Command Prompt (CMD), or Unix Bash.
            </Step>
          </DocSection>
        </>
      )}

    </div>
  );
}