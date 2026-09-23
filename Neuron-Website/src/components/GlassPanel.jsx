export default function GlassPanel({ children, className = '', ...props }) {
  return (
    <div 
      className={`
        bg-[#0c0c0c]/90 
        backdrop-blur-md 
        border border-white/[0.08] 
        hover:border-white/[0.16]
        transition-colors duration-200 
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}