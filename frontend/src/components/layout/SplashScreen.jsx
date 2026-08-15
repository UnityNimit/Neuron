// src/components/layout/SplashScreen.jsx
import React from 'react';
import { LogIn } from 'lucide-react';

export default function SplashScreen({ session, isGraphLoaded, isCompilerReady, onLogin }) {
  
  // ==========================================
  // STATE 1: PURE MINIMAL AUTH
  // ==========================================
  if (!session) {
    return (
      <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-sans select-none">
        
        {/* Just the floating logo */}
        <img 
          src="/logo.png" 
          alt="Neuron" 
          className="w-16 h-16 mb-8 opacity-90 drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
        />
        
        {/* Invisible button, just text and icon */}
        <button 
          onClick={onLogin} 
          className="flex items-center gap-2 text-[#666] hover:text-[#eee] transition-colors text-xs tracking-[0.2em] uppercase font-semibold outline-none"
        >
          <LogIn size={14} />
          Authenticate
        </button>

      </div>
    );
  }

  // ==========================================
  // STATE 2: PURE MINIMAL LOADING
  // ==========================================
  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col items-center justify-center select-none">
      <div className="flex flex-col items-center justify-center animate-in fade-in duration-1000">
        
        {/* The floating logo */}
        <img 
          src="/logo.png" 
          alt="Neuron" 
          className="w-16 h-16 opacity-90 drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
        />
        
        {/* 
          PURE CSS BOUNCING DOTS 
          Runs strictly on the GPU. Zero dependencies. Zero crashes. 
        */}
        <div className="flex items-center gap-1.5 mt-8 opacity-40">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>

      </div>
    </div>
  );
}