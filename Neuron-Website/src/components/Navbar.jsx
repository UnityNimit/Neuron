import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import SpecularButton from './SpecularButton';

export default function Navbar() {
  const location = useLocation();

  // Reusable NavLink with text height matching the h-7 (28px) logo icon
  const NavLinkText = ({ to, label }) => (
    <Link 
      to={to} 
      className="h-7 flex items-center text-white font-medium text-[16px] leading-none transition-opacity hover:opacity-80"
    >
      {label}
    </Link>
  );

  return (
    /* Edge-to-Edge Fixed Wrapper */
    <div className="fixed top-0 left-0 w-full z-50">
      
      {/* Edge-to-edge navbar without bottom separator line */}
      <nav 
        className="h-[72px] w-full bg-black flex items-center justify-between px-6 md:px-10 font-sans"
      >
        {/* Left Side: Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/logo.png" alt="Neuron" className="h-7 w-7 object-contain transition-transform group-hover:scale-110" />
          <span className="h-7 flex items-center font-bold text-white tracking-wider text-[16px] leading-none">NEURON</span>
        </Link>

        {/* Right Side: Links & Specular Button */}
        <div className="hidden md:flex items-center gap-8">
          <NavLinkText to="/repo" label="Repo" />
          <NavLinkText to="/docs" label="Docs" />
          <NavLinkText to="/help" label="Help" />
          <NavLinkText to="/signin" label="Sign in" />
          
          <Link to="/downloads" className="ml-2">
            <SpecularButton
              size="sm"
              radius={8}
              tint="#ffffff"
              tintOpacity={0.03}
              blur={0}
              textColor="#ffffff"
              lineColor="#ffffff"
              baseColor="#aab5c0"
              intensity={1.5}
              shineSize={12}
              shineFade={30}
              thickness={1.5}
              speed={0.4}
              followMouse
              proximity={250}
              autoAnimate={false}
            >
              Download
            </SpecularButton>
          </Link>
        </div>
      </nav>
    </div>
  );
}