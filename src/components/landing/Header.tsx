import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#070c18]/85 backdrop-blur border-b border-white/10">
      <div className="mx-auto flex max-w-[110rem] items-center justify-between px-5 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">BANYUBIRU</span>
            <span className="ml-2 text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">SMS v1.0</span>
          </div>
        </Link>

        <nav className="hidden gap-1 md:flex">
          <a href="#masalah" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Masalah
          </a>
          <a href="#solusi" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Solusi
          </a>
          <a href="#cara-kerja" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Cara Kerja
          </a>
          <a href="#fitur" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Fitur
          </a>
          <a href="#daftar" className="border border-transparent px-3.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-white/20 hover:text-white rounded">
            Kontak
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-2 bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 transition-all hover:bg-sky-300 rounded shadow-lg shadow-sky-500/20"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Buka Dashboard App</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
