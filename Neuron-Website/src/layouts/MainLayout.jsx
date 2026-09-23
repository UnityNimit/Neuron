import Navbar from '../components/Navbar';
import { DocsSearchProvider } from '../context/DocsSearchContext';

export default function MainLayout({ children }) {
  return (
    <DocsSearchProvider>
      <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans relative flex flex-col">
        {/* Global Background Grid Accent */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

        {/* Navigation */}
        <Navbar />

        {/* Content Container */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </DocsSearchProvider>
  );
}