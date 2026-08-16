import React from 'react';

export default function GlassPanel({ children, className = '', ...props }) {
  return (
    <div 
      className={`
        /* 1. CHANGE COLOR/OPACITY HERE (e.g., bg-black/60, bg-blue-950/40) */
        bg-[#121212]/40 
        
        /* 2. CHANGE BLUR AMOUNT HERE (change 16px to whatever you want) */
        backdrop-blur-[8px] [-webkit-backdrop-filter:blur(8px)] 
        
        transition-all duration-300 ${className}
      `}
      style={{
        // This is the subtle light reflection on the inside of the glass. 
        // You can lower the 0.1 to 0.05 to make the border fainter.
        boxShadow: '0 0 0 1px hsla(0, 0%, 100%, 0.1) inset, 0 16px 32px -12px rgba(0, 0, 0, 0.5)'
      }}
      {...props}
    >
      {children}
    </div>
  );
}