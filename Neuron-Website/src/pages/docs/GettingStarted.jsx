import { DocSection, Callout, CodeBlock, Step } from '../../components/docs/DocComponents';

export default function GettingStarted({ activeSection }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {activeSection === 'intro' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Introduction to Neuron
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron is a next-generation Spatial Intelligence IDE that abandons traditional text-based file trees in favor of a mathematically accurate, Machine Learning-driven physical universe.
          </p>

          <DocSection id="core-philosophy" title="The Core Philosophy">
            <p className="text-slate-300 leading-relaxed mb-6">
              Modern software architecture has outgrown the 1-dimensional file tree. When a codebase scales to hundreds of thousands of lines, understanding execution flow across microservices becomes impossible inside standard editors like VS Code.
            </p>
            <p className="text-slate-300 leading-relaxed mb-6">
              Neuron solves this by rendering your codebase on the GPU. It uses Multi-Modal AST Parsing to mathematically understand how your files communicate, and renders them as a high-performance interactive galaxy. 
            </p>

            <Callout type="info" title="Dual-Engine Architecture">
              Neuron operates on a decoupled client-server model. A lightweight Python Daemon runs locally on your machine to monitor the file system and compute heavy Machine Learning algorithms, while a React/WebGPU frontend renders the results at 300 FPS in the browser.
            </Callout>
          </DocSection>
        </>
      )}

      {activeSection === 'install' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Installation & Setup
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Get Neuron running on your local machine in under 2 minutes. The installation is split into two parts: the Python AI Daemon and the WebGPU Client.
          </p>

          <DocSection id="prerequisites" title="System Prerequisites">
            <ul className="list-disc list-inside space-y-2 text-slate-300 mb-8">
              <li><strong>Node.js 18+</strong> (For the WebGPU frontend)</li>
              <li><strong>Python 3.10+</strong> (For AST Parsing and ML Algorithms)</li>
              <li><strong>Git</strong> (For velocity and code churn heuristics)</li>
            </ul>
          </DocSection>

          <DocSection id="python-daemon" title="1. Start the Python AI Daemon">
            <Step number="1" title="Clone the Repository">
              Download the core engine to your local machine.
              <CodeBlock 
                language="bash" 
                title="Terminal"
                code={`git clone https://github.com/UnityNimit/Neuron.git\ncd Neuron`} 
              />
            </Step>

            <Step number="2" title="Initialize the Virtual Environment">
              Create an isolated environment and install the ML dependencies (Tree-Sitter, NetworkX, FastAPI).
              <CodeBlock 
                language="bash" 
                title="Terminal"
                code={`cd backend\npython -m venv venv\nsource venv/bin/activate  # On Windows: venv\\Scripts\\activate\npip install -r requirements.txt`} 
              />
            </Step>

            <Step number="3" title="Boot the Daemon">
              Launch the FastAPI WebSocket server. It will immediately begin parsing the default workspace.
              <CodeBlock 
                language="bash" 
                title="Terminal"
                code={`uvicorn main:app --reload --port 8000`} 
              />
            </Step>
          </DocSection>

          <DocSection id="webgpu-client" title="2. Launch the WebGPU Client">
            <Step number="4" title="Install Frontend Dependencies">
              Open a new terminal window, navigate to the frontend directory, and install the high-performance WebGPU packages.
              <CodeBlock 
                language="bash" 
                title="Terminal"
                code={`cd frontend\nnpm install`} 
              />
            </Step>

            <Step number="5" title="Start the Development Server">
              Boot the Vite compiler. The frontend will automatically establish a secure WebSocket connection to the Python Daemon.
              <CodeBlock 
                language="bash" 
                title="Terminal"
                code={`npm run dev`} 
              />
            </Step>
            
            <Callout type="warning" title="Hardware Acceleration">
              Ensure your browser has Hardware Acceleration enabled. Neuron uses PixiJS v8 to bypass the DOM and write directly to your graphics card. Disabling hardware acceleration will result in severe performance degradation.
            </Callout>
          </DocSection>
        </>
      )}

      {activeSection === 'quickstart' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Quickstart Guide
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Master the core mechanics of the Spatial IDE. Learn how to navigate the galaxy, isolate execution traces, and execute code in the browser sandbox.
          </p>

          <DocSection id="navigating" title="Navigating the Galaxy">
            <Step number="1" title="Pan and Zoom">
              Click and drag anywhere in the empty void to pan the camera. Use your scroll wheel to zoom. Notice how the Level-of-Detail (LOD) engine automatically hides text and UI elements as you pull away, leaving only pure structural topology.
            </Step>
            <Step number="2" title="Manipulate Gravity">
              Grab any structural orb (Folder, File, or Function) and drag it. The D3 Physics engine runs at 300 FPS in RAM. Dragging a node will naturally pull its connected architecture with it via mathematical spring tension.
            </Step>
          </DocSection>

          <DocSection id="analysis" title="AI Code Analysis">
            <Step number="3" title="The BFS Focus-Ray">
              Hover your mouse over any purple Function Orb. The engine will instantly execute an O(1) Breadth-First Search across the AST call-graph. The irrelevant galaxy will dim, and the exact execution pathway of that function will glow with neon electricity.
            </Step>
            <Step number="4" title="Spotting Tech Debt">
              Look for Orbs that glow <strong>Radioactive Red</strong>. These have been flagged by the backend Random Forest heuristic as high-risk. Zoom in closely (Z-Level 3) to view the AI-generated semantic peel and see the exact architectural code smells.
            </Step>
          </DocSection>

          <DocSection id="execution" title="Code Execution">
            <Step number="5" title="The Pyodide WASM Engine">
              Double-click any File Orb to open it in the full-screen Monaco Editor. Click the green <strong>Run</strong> button in the TopBar. Neuron compiles and executes the Python code entirely inside your browser using a local WebAssembly (WASM) CPython port, streaming the results directly to the integrated Terminal panel.
            </Step>
          </DocSection>

        </>
      )}

    </div>
  );
}