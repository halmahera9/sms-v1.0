import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, Zap, ShieldCheck } from 'lucide-react';

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-28">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-sky-600/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="mx-auto max-w-[110rem] px-5 md:px-10">
        <div className="flex flex-col items-start max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs text-sky-300 backdrop-blur mb-6">
            <Zap className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono uppercase tracking-wider text-[11px]">Banyubiru Digital Solution · SMS v1.0</span>
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,5.5rem)] font-bold tracking-tight leading-[1.08] text-white">
            Dari Dokumen Menjadi Data. <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Dari Data Menjadi Keputusan.
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl leading-relaxed">
            Ubah dokumen ketidakhadiran &amp; formulir fisik sekolah menjadi data terstruktur secara otomatis dengan OCR cerdas, fuzzy student matching, verifikasi operator, dan ekspor instan.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center w-full sm:w-auto">
            <Link
              href="/app"
              className="flex items-center justify-center gap-2 bg-sky-400 px-7 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-300 rounded shadow-xl shadow-sky-500/25"
            >
              <span>Uji Coba Dashboard App</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#cara-kerja"
              className="flex items-center justify-center gap-2 border border-white/20 bg-slate-900/60 px-6 py-3.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:border-white/40 rounded"
            >
              <span>Lihat Cara Kerja</span>
            </a>
          </div>

          {/* Social Proof badges */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-6 pt-8 border-t border-white/10 w-full">
            <div className="flex items-center gap-3 text-slate-300">
              <CheckCircle2 className="h-5 w-5 text-sky-400 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Digunakan 10+ Sekolah Uji Coba</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <FileText className="h-5 w-5 text-cyan-400 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Hemat Waktu Input Hingga 80%</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300 col-span-2 sm:col-span-1">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">100% Verifikasi Human-in-the-Loop</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
