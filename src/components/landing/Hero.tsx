import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  ScanText,
  Search,
  CheckCircle2,
  Workflow,
  FileCheck,
  ChevronRight,
} from 'lucide-react';

export default function Hero() {
  const flowSteps = [
    { label: 'Dokumen Masuk', sub: 'Surat edaran, KK, KTP, dll.', icon: FileText },
    { label: 'Dibaca', sub: 'Membaca teks dari file/scan', icon: ScanText },
    { label: 'Dipahami', sub: 'Mengenali jenis & informasi', icon: Search },
    { label: 'Data Dicocokkan', sub: 'Hubungkan data siswa/guru', icon: Search },
    { label: 'Divalidasi', sub: 'Diperiksa oleh administrator', icon: CheckCircle2 },
    { label: 'Proses Kerja', sub: 'Penerbitan surat tugas & draft', icon: Workflow },
    { label: 'Dokumen Selesai', sub: 'Siap untuk persetujuan resmi', icon: FileCheck },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/60 pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Pitch */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-800 mb-6">
            <span>School Document Intelligence Platform</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl sm:leading-[1.15]">
            Dari dokumen menjadi data.{' '}
            <span className="text-[#0f2b5c] block sm:inline">
              Dari data menjadi pekerjaan yang selesai.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Banyubiru membantu sekolah membaca dokumen, mengambil informasi penting,
            mencocokkannya dengan data siswa, guru, dan karyawan, lalu membantu menjalankan
            proses administrasi berdasarkan data tersebut.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f2b5c] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-all hover:shadow-md"
            >
              <span>Masuk ke Banyubiru</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#cara-kerja"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>Pelajari Cara Kerjanya</span>
            </a>
          </div>
        </div>

        {/* Visual Hero: Perjalanan Dokumen */}
        <div className="mt-16 sm:mt-20">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Alur Informasi Banyubiru
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Bagaimana satu dokumen menghasilkan pekerjaan administrasi nyata
                </h3>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                7 Tahap Berkelanjutan
              </span>
            </div>

            {/* Stepper / Journey Flow */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {flowSteps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={idx}
                    className="relative flex flex-col p-4 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black tracking-widest text-slate-400">
                        0{idx + 1}
                      </span>
                      <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#0f2b5c]">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-snug">
                      {step.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                      {step.sub}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Concrete Sample Preview Box */}
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  Contoh Dokumen yang Dikelola
                </span>
                <p className="text-xs text-slate-700">
                  Surat Edaran Dinas · Surat Undangan Kegiatan · Kartu Keluarga (KK) · KTP · Akta Kelahiran · Ijazah · Sertifikat · Surat Tugas
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0f2b5c] shrink-0">
                <span>1 Dokumen Masuk</span>
                <ChevronRight className="h-4 w-4 text-blue-600" />
                <span>Banyak Data Terbaca</span>
                <ChevronRight className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 font-bold">Pekerjaan Selesai</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
