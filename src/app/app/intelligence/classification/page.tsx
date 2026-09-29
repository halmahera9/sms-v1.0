import Link from 'next/link';
import { Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { getAllDocumentTaxonomies } from '@/platform/config/document-taxonomy';

export default function DocumentClassificationPage() {
  const taxonomies = getAllDocumentTaxonomies();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Kecerdasan Dokumen
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Model Taksonomi</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Klasifikasi Dokumen
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Kategori baku dan model pengenalan tipe dokumen administrasi sekolah otomatis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {taxonomies.map((tax) => (
          <div
            key={tax.code}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {tax.code}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {tax.fields.length} Field Baku
                </span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-900">
                {tax.displayName}
              </h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {tax.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Pencocokan Identitas:</span>
                <span className={`font-semibold ${tax.requiresIdentityMatching ? 'text-blue-700' : 'text-slate-400'}`}>
                  {tax.requiresIdentityMatching ? 'Wajib' : 'Opsional'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pemeriksaan Operator:</span>
                <span className={`font-semibold ${tax.requiresHumanVerification ? 'text-amber-700' : 'text-slate-400'}`}>
                  {tax.requiresHumanVerification ? 'Diperlukan' : 'Otomatis'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
