import Link from 'next/link';
import { Search, Users, ArrowRight } from 'lucide-react';

export default function IdentityMatchingPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Kecerdasan Dokumen
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Pencocokan Identitas</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Pencocokan Data Sekolah
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Menghubungkan identitas yang ditemukan dalam dokumen dengan database siswa, guru, dan karyawan.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
          <Search className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Pencocokan Multi-Atribut
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Pencocokan tidak hanya didasarkan pada kesamaan nama, melainkan menggunakan kombinasi NISN, NIK, NIP, tanggal lahir, dan atribut kontekstual sekolah.
        </p>
        <div className="pt-2">
          <Link
            href="/app/verify"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800"
          >
            <span>Buka Modul Verifikasi</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
