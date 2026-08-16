// src/pages/docs/MachineLearning.jsx
import React from 'react';
import { DocSection, Callout, CodeBlock, Step } from '../../components/docs/DocComponents';

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