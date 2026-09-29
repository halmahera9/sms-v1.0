import Link from 'next/link';
import { Sparkles, ScanText, ArrowRight } from 'lucide-react';

export default function DataExtractionPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Kecerdasan Dokumen
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Pengambilan Data</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Ekstraksi Data Terstruktur
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Mengubah teks bebas dari dokumen menjadi pasangan field, nilai, dan tingkat keyakinan (confidence score).
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Model Ekstraksi Kunci-Nilai Generik
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Setiap dokumen yang diproses melalui OCR diuraikan menjadi pasangan field kunci-nilai generik yang dapat dipetakan langsung ke basis data sekolah.
        </p>
        <div className="pt-2">
          <Link
            href="/app/ocr"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800"
          >
            <span>Buka Modul Pembacaan Dokumen</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
