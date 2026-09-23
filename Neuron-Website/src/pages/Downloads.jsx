import Footer from '../components/Footer';

const LATEST_RELEASE = {
  version: 'v1.0.0 Beta Release',
  date: 'September 2026'
};

export default function Downloads() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans relative selection:bg-[#3B82F6]/30 selection:text-white flex flex-col justify-between">

      <main className="relative z-10 pt-[72px] pb-8 px-6 sm:px-8 md:px-12 w-full max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-left mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">
            Versions
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl font-normal">
            Release history and downloads for Neuron. All versions run locally on your workstation.
          </p>
        </div>

        {/* Minimal Version Row - Strictly v1.0.0 Beta Release */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white tracking-tight">
              {LATEST_RELEASE.version}
            </span>
            <span className="text-xs text-slate-400">
              {LATEST_RELEASE.date}
            </span>
          </div>

          <a
            href="https://github.com/UnityNimit/Neuron/releases/download/v1.0.0/Neuron_1.0.0_x64-setup.exe"
            download="Neuron-Setup.exe"
            className="h-8 px-4 rounded-lg bg-white text-black font-semibold text-xs hover:bg-slate-100 transition-all inline-flex items-center justify-center self-start sm:self-auto cursor-pointer active:scale-[0.98] shadow-sm"
          >
            <span>Download for Windows</span>
          </a>
        </div>

      </main>

      <Footer />
    </div>
  );
}
