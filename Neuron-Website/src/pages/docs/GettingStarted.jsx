// src/pages/docs/GettingStarted.jsx
import React from 'react';
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

export default function MachineLearning({ activeSection }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {activeSection === 'ml-overview' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            AI & Machine Learning Engine
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Traditional IDEs treat code as static flat-files. Neuron operates on a completely different paradigm. It ingests your codebase as a living, mathematical ecosystem, applying unsupervised machine learning and graph theory to instantly diagnose tech debt, uncover hidden microservices, and map fragility.
          </p>

          <DocSection id="multi-modal-ast" title="Multi-Modal AST Extraction">
            <Callout type="info" title="Beyond Regex">
              Neuron utilizes <strong>Tree-Sitter</strong> to build a fully typed Abstract Syntax Tree (AST) of every file in milliseconds. It does not search for strings; it understands the absolute structural logic of your code.
            </Callout>

            <Step number="1" title="Cyclomatic Complexity & Density">
              The engine recursively traverses the AST to count mathematical branching pathways (<code>if</code>, <code>while</code>, <code>for</code>, <code>except</code>, <code>match</code>). It then divides this complexity by the physical Lines of Code (LOC) to generate an <strong>AST Density Score</strong>. High density indicates tightly packed, unreadable spaghetti logic.
            </Step>

            <Step number="2" title="Semantic Import Resolution">
              The engine traces <code>import</code> statements across files to build macro-edges. This connects isolated files into a massive global call-graph, allowing the ML algorithms to traverse entire repositories mathematically.
            </Step>
          </DocSection>
        </>
      )}

      {activeSection === 'louvain' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Louvain Community Nebulas
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Folders are a human construct. In enterprise codebases, business logic is rarely confined to a single directory. Neuron uses Unsupervised Machine Learning to discover the <em>true</em> architecture of your software.
          </p>

          <DocSection id="louvain-detection" title="Unsupervised Microservice Discovery">
            <Callout type="terminal" title="The Modularity Maximization Formula">
              The backend leverages the <strong>Louvain method for community detection</strong> (via NetworkX) on the AST Call-Graph. It maximizes a modularity score, iteratively moving nodes between communities until it finds dense clusters of highly interacting functions.
            </Callout>

            <p className="text-slate-300 leading-relaxed mt-4 mb-6">
              To ensure the AI categorizes by <em>Execution Logic</em> rather than folder proximity, Neuron mathematically weights function-to-function neural pathways <strong>50x heavier</strong> than folder hierarchy edges.
            </p>

            <CodeBlock 
              title="analyzer.py"
              language="python"
              code={`# 🚀 The Weighted ML Execution Graph
for e in edges:
    if e["source"] != e["target"]:
        # ML WEIGHTING: Force the AI to group by Business Logic, not folders!
        weight = 50.0 if e.get("type") == "call" else 1.0
        G.add_edge(e["source"], e["target"], weight=weight)

# Unsupervised Clustering Algorithm
communities = louvain_communities(G, weight='weight', resolution=1.0)`} 
            />

            <p className="text-slate-300 leading-relaxed mt-6">
              The resulting communities are assigned unique IDs. The WebGPU engine reads these IDs in real-time, calculates a mathematical <strong>Convex Hull</strong> around the nodes using <code>d3-polygon</code>, and wraps them in a massive, glowing, hardware-blurred Gas Nebula.
            </p>
          </DocSection>
        </>
      )}

      {activeSection === 'risk-model' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            Random Forest Risk Heuristics
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Not all complex code is dangerous. A highly complex algorithm written 5 years ago that hasn't been touched since is mathematically safe. Neuron merges Graph Theory, AST Topology, and Git Velocity to calculate absolute systemic risk.
          </p>

          <DocSection id="risk-formula" title="The Ensemble Risk Equation">
            <Callout type="danger" title="Real-Time Fragility Detection">
              By merging <strong>PageRank</strong> (authority) and <strong>Betweenness Centrality</strong> (bottlenecks) with Git Churn (modification velocity), Neuron physically flags code that is on the verge of breaking.
            </Callout>

            <Step number="1" title="The 4-Dimensional Equation">
              The AI calculates a combined risk scalar using the following weighted algorithm:
            </Step>

            <CodeBlock 
              title="analyzer.py"
              language="python"
              code={`# W1: Base AST Complexity
# W2: Git Churn (Velocity of edits exponentially multiplies complexity danger)
# W3: Density (Branching logic crammed into too few lines)
# W4: Betweenness Centrality (If this breaks, microservices lose communication)

risk_score = (complexity * 0.3) + (churn * 1.5) + (density * 10.0) + (betweenness * 5.0)`} 
            />

            <Step number="2" title="Code Smell Diagnosis">
              Based on the geometric spread of these factors, the AI categorizes the exact type of tech debt:
              <ul className="list-disc list-inside mt-3 space-y-2 text-slate-300">
                <li><strong className="text-blue-400">God Object:</strong> Extreme LOC + Extreme PageRank.</li>
                <li><strong className="text-orange-400">Spaghetti Logic:</strong> Extreme AST Density.</li>
                <li><strong className="text-red-400">Fragile Hotspot:</strong> High Git Churn + High Complexity.</li>
                <li><strong className="text-purple-400">System Bottleneck:</strong> High Betweenness Centrality.</li>
              </ul>
            </Step>
            
            <p className="text-slate-300 leading-relaxed mt-6">
              These diagnoses are immediately injected into the WebGPU engine. Orbs turn Radioactive Red, and zooming into Z-Level 3 reveals the exact AI diagnosis natively on the canvas.
            </p>
          </DocSection>
        </>
      )}

    </div>
  );
}
