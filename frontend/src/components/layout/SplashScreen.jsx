// src/components/layout/SplashScreen.jsx
import React from 'react';
import NeuronLogo from '../common/NeuronLogo';
import { useTheme } from '../../config/themeConfig';

export default function SplashScreen({ 
  session, 
  isGraphLoaded, 
  isCompilerReady, 
  onLogin 
}) {
  const { theme } = useTheme();

  return (
    <div 
      className="w-screen h-screen flex flex-col items-center justify-center select-none overflow-hidden overscroll-none transition-colors duration-200"
      style={{
        backgroundColor: theme?.background || 'var(--theme-background, #121314)',
        color: theme?.textPrimary || 'var(--theme-text-primary, #cbd5e1)'
      }}
    >
      <div className="flex flex-col items-center justify-center animate-in fade-in duration-300">
        
        {/* Centered Minimalist Logo (Interactive on unauthenticated state) */}
        <div 
          onClick={!session ? onLogin : undefined}
          className={`relative flex items-center justify-center transition-transform duration-200 ease-out ${
            !session ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
          }`}
          style={{ transform: 'translateZ(0)' }}
        >
          <NeuronLogo 
            size={56} 
            color={theme?.accent || 'var(--theme-accent, #3b82f6)'}
            style={{
              color: theme?.accent || 'var(--theme-accent, #3b82f6)',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }}
            className="pointer-events-none select-none transition-colors duration-200" 
          />
        </div>

        {/* Minimalist Kinetic Pulse Loader */}
        <div className="flex items-center gap-2 mt-8">
          <span 
            className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] animate-pulse"
            style={{ 
              animationDuration: '1s',
              animationDelay: '0ms',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }} 
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] animate-pulse"
            style={{ 
              animationDuration: '1s',
              animationDelay: '180ms',
              transform: 'translateZ(0)',
              willChange: 'transform, opacity'
            }} 
          />
          <span 
            className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1] animate-pulse"
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