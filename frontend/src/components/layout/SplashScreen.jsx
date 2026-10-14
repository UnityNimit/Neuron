// src/components/layout/SplashScreen.jsx
import React, { memo } from 'react';
import GenesisAnimatedLogo from '../common/GenesisAnimatedLogo';
import { useTheme } from '../../config/themeConfig';

function SplashScreen({ 
  session, 
  isGraphLoaded, 
  isCompilerReady, 
  onLogin 
}) {
  const { theme } = useTheme();

  const isDark = theme?.isDark !== false;
  const fgColor = isDark 
    ? (theme?.textBright || '#ffffff') 
    : (theme?.textPrimary || '#080808');
  const bgColor = theme?.background || (isDark ? '#121314' : '#ffffff');

  return (
    <div 
      className="w-screen h-screen flex flex-col items-center justify-center select-none overflow-hidden overscroll-none transition-colors duration-200"
      style={{
        backgroundColor: bgColor,
        color: fgColor,
        contain: 'strict',
        willChange: 'transform',
        transform: 'translateZ(0)'
      }}
    >
      <div 
        className="flex flex-col items-center justify-center animate-in fade-in duration-300"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      >
        {/* Centered Minimalist Vector Genesis Animation on Loop */}
        <div 
          onClick={!session ? onLogin : undefined}
          className={`relative flex items-center justify-center transition-transform duration-200 ease-out ${
            !session ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
          }`}
          style={{ transform: 'translateZ(0)' }}
          title={!session ? 'Click to sign in' : undefined}
        >
          <GenesisAnimatedLogo 
            size={64}
            color={fgColor}
            bgColor={bgColor}
            halo={false}
            duration={4800}
            speed={1.0}
            interactive={true}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(SplashScreen);