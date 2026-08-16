import React from 'react';
import Navbar from '../components/Navbar';

export default function MainLayout({ children }) {
    return (
        <div className="min-h-screen bg-[#0f0f0f] text-slate-200 font-sans relative">
            {/* Global Background Grid Accent */}
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

            {/* Navigation */}
            <Navbar />

            {/* Dynamic Content Container */}
            <main className="relative z-10">
                {children}
            </main>
        </div>
    );
}