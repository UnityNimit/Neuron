// src/components/layout/SplashScreen.jsx
import React, { useState } from 'react';

export default function SplashScreen({ 
  session, 
  isGraphLoaded, 
  isCompilerReady, 
  onLogin 
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-screen h-screen bg-[#191a1b] flex flex-col items-center justify-center select-none overflow-hidden overscroll-none">
      <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
        
        {/* Centered Minimalist Logo (Interactive on unauthenticated state) */}
        <div 
          onClick={!session ? onLogin : undefined}
          className={`relative flex items-center justify-center transition-transform duration-200 ease-out ${
            !session ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
          }`}
          style={{ transform: 'translateZ(0)' }}
        >
          {!imgError ? (
            <img 
              src="/logo.png" 
              alt="Neuron" 
              onError={() => setImgError(true)}
              className="w-14 h-14 object-contain opacity-95 pointer-events-none select-none" 
              style={{
                transform: 'translateZ(0)',
                willChange: 'transform, opacity'
              }}
            />
          ) : (
            <div 
              className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400"
              style={{ transform: 'translateZ(0)' }}
            >
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-ping" />
            </div>
          )}
        </div>

        {/* 🚀 300 FPS Hardware-Accelerated Electric Blue Kinetic Pulse */}
        <div className="flex items-center gap-2 mt-8">
          <span 
            className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.9)] animate-pulse"
            style={{ 
              animationDuration: '1s',
              animationDelay: '0ms',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }} 
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.9)] animate-pulse"
            style={{ 
              animationDuration: '1s',
              animationDelay: '180ms',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }} 
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] animate-pulse"
            style={{ 
              animationDuration: '1s',
              animationDelay: '360ms',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }} 
          />
        </div>

      </div>
    </div>
  );
}