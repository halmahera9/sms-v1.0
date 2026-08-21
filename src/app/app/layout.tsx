import Sidebar from '@/components/app/Sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#070c18] text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-14 border-b border-white/10 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Manajemen Sekolah - Operator Mode</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 bg-slate-800 px-3 py-1 rounded border border-white/10 font-mono">
              Operator: Budi (Tata Usaha)
            </span>
          </div>
        </header>
        <main className="p-6 md:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
