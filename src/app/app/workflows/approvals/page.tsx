import Link from 'next/link';
import { FileCheck2, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

export default function DocumentApprovalsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Alur Kerja
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Persetujuan Resmi</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Persetujuan Dokumen &amp; Penerbitan
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Daftar dokumen dinas yang siap ditandatangani dan disetujui oleh kepala sekolah atau pejabat berwenang.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
        <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
          <FileCheck2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Antrean Persetujuan Pimpinan
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Dokumen yang telah lolos verifikasi operator disajikan di sini untuk peninjauan dan persetujuan akhir sebelum diedarkan resmi.
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
