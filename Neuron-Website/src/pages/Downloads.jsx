import React from 'react';
import { Download } from 'lucide-react';

export default function Downloads() {
  return (
    <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
        <Download className="text-blue-400" /> Downloads & Local Setup
      </h1>
      <p className="text-slate-400 mb-10 text-lg">
        Run Neuron locally on your PC to inspect, refactor, and execute standard Python repositories.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Web Application</h3>
            <p className="text-slate-400 text-sm mb-6">
              Run Codeforces problems or single-file scripts directly in your browser using Pyodide WebAssembly.
            </p>
          </div>
          <a
            href="https://neuron-dun.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-semibold text-center text-sm transition-colors block"
          >
            Launch Web App
          </a>
        </div>

        <div className="bg-[#141414] border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Python Local Daemon</h3>
            <p className="text-slate-400 text-sm mb-6">
              Run the FastAPI backend on your laptop to inspect local hard drive folders with zero server limits.
            </p>
          </div>
          <a
            href="https://github.com/UnityNimit/Neuron"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-semibold text-center text-sm transition-colors block border border-slate-700"
          >
            Get GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}