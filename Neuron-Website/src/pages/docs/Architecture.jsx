import { DocSection, Callout, CodeBlock, Step } from '../../components/docs/DocComponents';

export default function Architecture({ activeSection = 'spatial-engine' }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {activeSection === 'spatial-engine' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            The Spatial WebGPU Engine
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron abandons traditional DOM-based graph rendering. To achieve a flawless 300 FPS physics simulation across hundreds of thousands of files, the engine bypasses the React render cycle entirely, utilizing pure RAM mutation and hardware-accelerated WebGPU sprite batching.
          </p>

          <DocSection id="dom-bottleneck" title="Bypassing the React DOM">
            <Callout type="danger" title="The SVG Limit">
              Standard visualizers render nodes as HTML <code>&lt;div&gt;</code> elements and edges as SVG <code>&lt;path&gt;</code> elements. Attempting to run a 60Hz physics simulation on 1,000+ DOM elements instantly triggers Garbage Collection thrashing and Layout Reflows, tanking frame rates to &lt;15 FPS.
            </Callout>

            <p className="text-slate-300 leading-relaxed mt-4">
              Neuron solves this by completely unmounting React from the physics loop. We utilize <strong>Pixi.js v8</strong> configured specifically for the <code>webgpu</code> backend. The entire UI is painted directly to a single HTML5 <code>&lt;canvas&gt;</code> tag using the graphics card.
            </p>

            <Step number="1" title="VRAM Texture Batching">
              Instead of drawing unique geometries for every node, Neuron generates a single 64x64 white circle texture in VRAM upon boot. Every node (Folder, File, Function) is instantiated as a <code>PIXI.Sprite</code> that references this single master texture, scaled and tinted natively on the GPU at zero CPU cost.
            </Step>

            <CodeBlock 
              title="PixiSpatialEngine.jsx"
              language="javascript"
              code={`// 1M Node Sprite Batching Trick
const circleGraphics = new PIXI.Graphics().circle(0, 0, 64).fill(0xffffff);
const circleTexture = app.renderer.generateTexture(circleGraphics);

simDataRef.current.nodes.forEach(node => {
  const sprite = new PIXI.Sprite(circleTexture); // References shared VRAM texture
  sprite.scale.set(baseSize / 64);
  sprite.tint = hexToNumber(THEME.nodes.function); // 0 CPU cost recoloring
  nodeLayer.addChild(sprite);
});`} 
            />
          </DocSection>

          <DocSection id="pure-ram" title="Pure RAM D3 Physics">
            <p className="text-slate-300 leading-relaxed mb-4">
              Physics engines naturally calculate floating-point coordinates 60 to 144 times a second. Sending these coordinates through a React <code>useState</code> hook causes catastrophic re-renders. 
            </p>
            
            <Callout type="info" title="The simDataRef Architecture">
              The D3 force simulation is pointed exclusively at a mutable Javascript memory reference (<code>simDataRef.current</code>). The PixiJS WebGPU ticker loops over this memory reference 144 times a second and updates sprite coordinates. React is completely unaware that the graph is moving.
            </Callout>

            <CodeBlock 
              title="usePhysicsEngine.js"
              language="javascript"
              code={`// NO TICK HANDLER. PURE MEMORY.
const simulation = d3.forceSimulation(simNodes)
  .force("link", d3.forceLink(simEdges))
  .force("charge", d3.forceManyBody().distanceMax(1500))
  .force("x", d3.forceX(0).strength(0.1)) // The Black Hole gravity well
  .force("y", d3.forceY(0).strength(0.1));

// PixiJS reads simNodes natively from RAM inside its own ticker.
// Zero React states are mutated during simulation.`}
            />
          </DocSection>

          <DocSection id="focus-ray" title="O(1) BFS Focus-Ray">
            <p className="text-slate-300 leading-relaxed mb-4">
              Hovering over a node triggers an instant execution trace. To prevent deep pathfinding from lagging the UI thread, Neuron pre-computes an Adjacency List Cache upon graph initialization.
            </p>

            <Step number="2" title="Pre-Computed Adjacency">
              The AST parser output is flattened into dual directional matrices (<code>callAdjForward</code> and <code>callAdjBackward</code>), allowing O(1) lookups for any function's parents or children.
            </Step>

            <Step number="3" title="Lightning-Fast Traversal">
              When a hover event fires, a Breadth-First Search (BFS) mathematically traces the execution path in &lt;1ms. The resulting active nodes and edges are injected back into the WebGPU render loop to instantly trigger the Neon Dropshadow filters.
            </Step>
          </DocSection>
        </>
      )}

      {activeSection === 'physics' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            D3 Physics & Gravitational Dynamics
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron translates software architecture into physical celestial bodies. Files and functions attract and repel using custom force vectors, creating a self-organizing spatial layout that reflects execution architecture.
          </p>

          <DocSection id="gravitational-equilibrium" title="Gravitational Equilibrium">
            <Callout type="info" title="Zero-Collision Force Fields">
              Every node possesses mass proportional to its Lines of Code (LOC) and cyclomatic complexity. Many-body electrostatic repulsion prevents overlap, while harmonic link springs maintain structural cohesion between caller and callee.
            </Callout>

            <Step number="1" title="Centering Gravity Well (The Black Hole)">
              A dual-axis centering force pulls disconnected modules toward the origin (0, 0) with dampening coefficient α = 0.08. This prevents orphan files from drifting into infinite coordinate space while keeping dense clusters centrally aligned.
            </Step>

            <Step number="2" title="Harmonic Link Springs">
              Edges function as Hooke's Law springs with resting distance d₀ = 80px for file-to-function links and d₀ = 220px for inter-module call macros. Tight coupling pulls interrelated files into close physical orbits.
            </Step>

            <CodeBlock 
              title="physicsEngine.js"
              language="javascript"
              code={`// Force Configuration Matrix
simulation
  .force("charge", d3.forceManyBody().strength(node => -120 * Math.sqrt(node.weight || 1)))
  .force("link", d3.forceLink(edges).id(d => d.id).distance(e => e.type === 'call' ? 180 : 70))
  .force("collide", d3.forceCollide().radius(d => d.radius + 14).iterations(2))
  .velocityDecay(0.35); // Smooth celestial gliding`}
            />
          </DocSection>

          <DocSection id="memory-threading" title="Thread Isolation & RAM Decoupling">
            <p className="text-slate-300 leading-relaxed mb-4">
              D3.js calculates velocity verlet equations on a dedicated high-priority tick loop. Instead of serializing coordinates across Web Workers, coordinates mutate directly in shared JavaScript TypedArrays, allowing WebGPU to sample node positions with zero IPC overhead.
            </p>
          </DocSection>
        </>
      )}

      {activeSection === 'ast-parser' && (
        <>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-6">
            AST Multi-Modal Parser
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-12">
            Neuron inspects code semantics rather than plain text. Using Tree-Sitter and LibCST, the daemon extracts fully-typed Abstract Syntax Trees and constructs a comprehensive directed call graph in real time.
          </p>

          <DocSection id="treesitter-pipeline" title="Tree-Sitter Extraction Pipeline">
            <Callout type="terminal" title="Incremental Re-Parsing">
              When a file is modified, Tree-Sitter performs incremental parsing in under 4ms, re-indexing only the mutated AST branch without recomputing the entire workspace.
            </Callout>

            <Step number="1" title="Concrete Syntax Tree (CST) Preservation">
              LibCST parses comments, whitespace, and formatting tokens. This ensures bidirectional synchrony: visual canvas refactoring mutates source code without destroying existing formatting conventions.
            </Step>

            <Step number="2" title="Macro-Edge Resolution">
              The parser walks explicit and dynamic imports (<code>from .services import run_worker</code>), resolving symbols to file system paths and mapping inter-file dependencies into macro-edges.
            </Step>

            <CodeBlock 
              title="parser.py"
              language="python"
              code={`# Real-Time AST Call Extraction
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

def extract_symbols(source_bytes: bytes):
    tree = parser.parse(source_bytes)
    query = PY_LANGUAGE.query("""
      (function_definition name: (identifier) @func.def)
      (call function: (identifier) @func.call)
    """)
    captures = query.captures(tree.root_node)
    return build_adjacency_graph(captures)`}
            />
          </DocSection>

          <DocSection id="cyclomatic-metrics" title="Complexity & Density Metrics">
            <p className="text-slate-300 leading-relaxed mb-4">
              For every extracted function node, the parser calculates cyclomatic complexity by counting conditional branching nodes (<code>if</code>, <code>elif</code>, <code>for</code>, <code>while</code>, <code>match</code>, <code>try/except</code>).
            </p>
            <p className="text-slate-300 leading-relaxed">
              Functions exceeding density thresholds (&gt;0.25 complexity per line of code) are flagged with warning telemetry and fed into the downstream Random Forest risk classifier.
            </p>
          </DocSection>
        </>
      )}

    </div>
  );
}