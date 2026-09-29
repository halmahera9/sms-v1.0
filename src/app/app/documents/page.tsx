import Link from 'next/link';
import { FileText, Search, Plus, Filter, ArrowRight } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Dokumen
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Pengambilan Data</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Arsip Dokumen Sekolah
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Daftar seluruh berkas dokumen yang telah masuk dan terbaca dalam repositori sekolah.
          </p>
        </div>

        <Link
          href="/app/ocr"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Unggah Dokumen Baru</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama berkas, nomor dokumen, atau kategori..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600"
            />
          </div>
          <Link
            href="/app/documents/search"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Pencarian Terperinci</span>
          </Link>
        </div>

        <div className="py-12 text-center space-y-2">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="text-xs font-bold text-slate-700">
            Repositori Dokumen Terkoneksi
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Gunakan menu Penerimaan Dokumen untuk memproses berkas baru dengan pembacaan OCR otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
