import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050505] pt-20 pb-10 px-6 relative z-10 pointer-events-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10 mb-20">
          
          {/* Logo Column */}
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="Neuron" className="h-8 w-8 object-contain" />
              <span className="font-bold text-white tracking-wider text-lg">NEURON</span>
            </Link>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
              Neuron is an applied research team focused on building the future of software development.
            </p>
            <a href="#" className="inline-flex items-center gap-2 text-white font-medium mt-6 group">
              Join us <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="text-white font-medium mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Agents</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Teams</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Enterprise</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Code Review</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cloud Agents</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6">Resources</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Download</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Docs</a></li>
              <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1">Learn <ArrowRight size={12} className="-rotate-45" /></a></li>
              <li><a href="#" className="hover:text-white transition-colors">Value Calculator</a></li>
              <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1">Forum <ArrowRight size={12} className="-rotate-45" /></a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Students</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Brand</a></li>
              <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1">Anysphere <ArrowRight size={12} className="-rotate-45" /></a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-medium mb-6">Legal</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Acceptable Use</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              <li className="mt-8 text-white font-medium mb-4">Connect</li>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-white transition-colors flex items-center gap-1">X <ArrowRight size={12} className="-rotate-45" /></a>
                <a href="#" className="hover:text-white transition-colors flex items-center gap-1">LinkedIn <ArrowRight size={12} className="-rotate-45" /></a>
              </div>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <span>© 2026 Anysphere, Inc.</span>
            <span className="flex items-center gap-1"><Lock size={12} /> SOC 2 Certified</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="hover:text-slate-300 transition-colors">English ↓</button>
            <button className="hover:text-slate-300 transition-colors">☉</button>
            <button className="hover:text-slate-300 transition-colors">☾</button>
          </div>
        </div>
      </div>
    </footer>
  );
}