'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  FileX, 
  Keyboard, 
  AlertTriangle, 
  Clock, 
  Check, 
  ArrowUpRight, 
  Upload, 
  ScanText, 
  UserCheck, 
  CheckSquare, 
  FileSpreadsheet,
  Database,
  Shield,
  FileCheck,
  Building2,
  Send
} from 'lucide-react';

export default function Sections() {
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
  };

  return (
    <>
      {/* MASALAH SECTION */}
      <section id="masalah" className="border-t border-white/10 bg-slate-950/40 py-20 md:py-32">
        <div className="mx-auto grid max-w-[110rem] gap-12 px-5 md:grid-cols-[1fr_1.2fr] md:px-10">
          <div>
            <p className="label-mono mb-4">Masalah Administrasi Sekolah</p>
            <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-white leading-tight">
              Berjam-jam hanya untuk mengetik ulang dokumen manual.
            </h2>
            <p className="mt-4 text-slate-400 leading-relaxed max-w-md">
              Proses input daftar hadir dan formulir fisik sekolah sering menjadi beban tata usaha, menyita waktu belajar dan rentan terjadi kesalahan penulisan.
            </p>
          </div>

          <div className="grid gap-px bg-white/10 rounded-xl overflow-hidden sm:grid-cols-2">
            <div className="bg-slate-900/90 p-7 hover:bg-slate-900 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-sky-400">01</span>
                <FileX className="h-5 w-5 text-rose-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Dokumen Tercecer</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Foto, scan, dan kertas menumpuk di meja tanpa arsip digital terstruktur.
              </p>
            </div>

            <div className="bg-slate-900/90 p-7 hover:bg-slate-900 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-sky-400">02</span>
                <Keyboard className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Input Ulang Manual</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Operator mengetik data yang sama berulang kali — sangat menyita waktu.
              </p>
            </div>

            <div className="bg-slate-900/90 p-7 hover:bg-slate-900 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-sky-400">03</span>
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Nama Tak Konsisten</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Ejaan nama siswa di kertas sering beda dengan master data Dapodik.
              </p>
            </div>

            <div className="bg-slate-900/90 p-7 hover:bg-slate-900 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-sky-400">04</span>
                <Clock className="h-5 w-5 text-rose-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Rekap Tertunda</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Laporan bulanan ke dinas terlambat karena rekap Excel manual.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUSI SECTION */}
      <section id="solusi" className="mx-auto max-w-[110rem] px-5 py-20 md:px-10 md:py-32">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          <div>
            <p className="label-mono mb-4">Solusi Cerdas</p>
            <h2 className="text-[clamp(2rem,4.5vw,4rem)] font-bold text-white leading-tight">
              Jembatan antara dokumen kertas dan database sekolah.
            </h2>
            <p className="mt-6 text-slate-300 leading-relaxed">
              SMS bukan sekadar OCR biasa. Hasil bacaan dokumen otomatis dicocokkan (*fuzzy matching*) dengan Master Data Siswa Anda, lalu diverifikasi oleh operator sehingga data 100% akurat.
            </p>
          </div>

          <div className="panel p-8 rounded-xl">
            <h4 className="font-semibold text-white text-base">Alur Pengolahan Data SMS</h4>
            <div className="mt-6 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-sky-400 bg-sky-500/10 p-2.5 rounded border border-sky-500/20">
                <span>Dokumen Kertas / Foto</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </div>
              <div className="flex items-center gap-2 text-cyan-400 bg-cyan-500/10 p-2.5 rounded border border-cyan-500/20">
                <span>OCR &amp; Ekstraksi Teks</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </div>
              <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 p-2.5 rounded border border-indigo-500/20">
                <span>Pencocokan Siswa (Fuzzy Match)</span>
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </div>
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20">
                <span>Verifikasi Operator (Human-in-the-Loop)</span>
                <Check className="h-3.5 w-3.5 ml-auto text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 text-white bg-slate-800 p-2.5 rounded border border-white/20">
                <span>Ekspor Excel (.xlsx) &amp; PDF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-6 rounded-lg">
            <h3 className="text-base font-semibold text-white">Hemat Waktu</h3>
            <p className="mt-2 text-sm text-slate-400">Kurangi proses input manual hingga 80% per hari.</p>
          </div>
          <div className="panel p-6 rounded-lg">
            <h3 className="text-base font-semibold text-white">Tingkat Akurasi</h3>
            <p className="mt-2 text-sm text-slate-400">Pencocokan cerdas menekan salah penulisan NISN/Nama.</p>
          </div>
          <div className="panel p-6 rounded-lg">
            <h3 className="text-base font-semibold text-white">Terverifikasi</h3>
            <p className="mt-2 text-sm text-slate-400">Manusia memegang kendali akhir sebelum data tersimpan.</p>
          </div>
          <div className="panel p-6 rounded-lg">
            <h3 className="text-base font-semibold text-white">Siap Pakai</h3>
            <p className="mt-2 text-sm text-slate-400">Ekspor langsung format Excel Dapodik &amp; Laporan PDF.</p>
          </div>
        </div>
      </section>

      {/* CARA KERJA SECTION */}
      <section id="cara-kerja" className="border-y border-white/10 bg-slate-950/60 py-20 md:py-32">
        <div className="mx-auto max-w-[110rem] px-5 md:px-10">
          <p className="label-mono mb-4">Cara Kerja Mudah</p>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-white max-w-xl">
            Lima langkah sederhana, dari kertas menjadi rekap digital.
          </h2>

          <ol className="mt-14 space-y-3">
            <li className="grid items-center gap-4 bg-slate-900/90 border border-white/10 p-6 rounded-xl md:grid-cols-[5rem_16rem_1fr]">
              <div className="flex items-center gap-2 font-mono text-sm text-sky-400">
                <Upload className="h-5 w-5" />
                <span>01</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Upload Dokumen</h3>
              <p className="text-sm text-slate-400">Unggah foto, scan, atau PDF daftar ketidakhadiran dan formulir siswa.</p>
            </li>

            <li className="grid items-center gap-4 bg-slate-900/90 border border-white/10 p-6 rounded-xl md:grid-cols-[5rem_16rem_1fr]">
              <div className="flex items-center gap-2 font-mono text-sm text-cyan-400">
                <ScanText className="h-5 w-5" />
                <span>02</span>
              </div>
              <h3 className="text-lg font-semibold text-white">OCR &amp; Ekstraksi</h3>
              <p className="text-sm text-slate-400">Sistem membaca teks dari dokumen dan menyusun menjadi bidang data terstruktur.</p>
            </li>

            <li className="grid items-center gap-4 bg-slate-900/90 border border-white/10 p-6 rounded-xl md:grid-cols-[5rem_16rem_1fr]">
              <div className="flex items-center gap-2 font-mono text-sm text-indigo-400">
                <UserCheck className="h-5 w-5" />
                <span>03</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Pencocokan Siswa</h3>
              <p className="text-sm text-slate-400">Fuzzy matching otomatis dengan Master Data Siswa lengkap dengan persentase keyakinan.</p>
            </li>

            <li className="grid items-center gap-4 bg-slate-900/90 border border-white/10 p-6 rounded-xl md:grid-cols-[5rem_16rem_1fr]">
              <div className="flex items-center gap-2 font-mono text-sm text-emerald-400">
                <CheckSquare className="h-5 w-5" />
                <span>04</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Verifikasi Operator</h3>
              <p className="text-sm text-slate-400">Operator mengonfirmasi, mengedit, atau memilih nama kandidat siswa yang tepat.</p>
            </li>

            <li className="grid items-center gap-4 bg-slate-900/90 border border-white/10 p-6 rounded-xl md:grid-cols-[5rem_16rem_1fr]">
              <div className="flex items-center gap-2 font-mono text-sm text-white">
                <FileSpreadsheet className="h-5 w-5" />
                <span>05</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Ekspor Data</h3>
              <p className="text-sm text-slate-400">Hasil terverifikasi diekspor seketika ke file Excel (.xlsx) atau laporan PDF.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* FITUR SECTION */}
      <section id="fitur" className="mx-auto max-w-[110rem] px-5 py-20 md:px-10 md:py-32">
        <p className="label-mono mb-4">Kemampuan Lengkap</p>
        <h2 className="text-[clamp(2rem,4.5vw,4rem)] font-bold text-white">Fitur Inti Aplikasi</h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="panel p-7 rounded-xl">
            <Database className="h-7 w-7 text-sky-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Import Master Data</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Upload file data siswa dari Dapodik atau spreadsheet Excel (.xlsx/.csv) secara instan.
            </p>
          </div>

          <div className="panel p-7 rounded-xl">
            <ScanText className="h-7 w-7 text-cyan-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">OCR Dokumen Sekolah</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Dukungan JPG, PNG, dan PDF untuk daftar hadir harian, formulir izin, dan rekap ketidakhadiran.
            </p>
          </div>

          <div className="panel p-7 rounded-xl">
            <UserCheck className="h-7 w-7 text-indigo-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Smart Student Matching</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Pencocokan nama cerdas yang fleksibel terhadap variasi ejaan nama dengan skor keyakinan (*confidence score*).
            </p>
          </div>

          <div className="panel p-7 rounded-xl">
            <CheckSquare className="h-7 w-7 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Human-in-the-Loop</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Operator memiliki wewenang penuh untuk memeriksa dan menyetujui data sebelum masuk database.
            </p>
          </div>

          <div className="panel p-7 rounded-xl">
            <FileSpreadsheet className="h-7 w-7 text-amber-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Ekspor Excel &amp; PDF</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Format laporan standar siap cetak atau dikirim langsung ke dinas pendidikan setempat.
            </p>
          </div>

          <div className="panel p-7 rounded-xl">
            <Shield className="h-7 w-7 text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">Audit Trail Akuntabel</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Setiap aktivitas pengguna dan perubahan status tercatat rapi (siapa, kapan, dan aksi apa).
            </p>
          </div>
        </div>
      </section>

      {/* CONTOH KASUS INTERAKTIF */}
      <section className="bg-slate-950 border-t border-white/10 py-16">
        <div className="mx-auto max-w-[110rem] px-5 md:px-10">
          <div className="panel p-8 md:p-12 rounded-2xl grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="label-mono mb-4">Studi Kasus Efisiensi</p>
              <h3 className="text-2xl md:text-3xl font-bold text-white">Rekap Ketidakhadiran Siswa Harian</h3>
              <p className="mt-4 text-slate-300 text-sm leading-relaxed">
                Ketika foto lembar absen kelas diterima dari wali kelas, sistem SMS mengekstraksi nama &amp; status ketidakhadiran, mencocokkan dengan database siswa, dan menyajikan rekomendasi siap konfirmasi.
              </p>

              <div className="panel-solid mt-6 p-4 rounded-lg font-mono text-xs space-y-2 border border-white/10">
                <div className="text-slate-400">Hasil Teks OCR: &ldquo;Ahmad Fausan&rdquo;</div>
                <div className="text-sky-400 font-semibold">Matched → Ahmad Fauzan · 94% confidence match</div>
                <div className="text-emerald-400">Status: Sakit (Dokumen Terlampir)</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-900/80 p-6 rounded-xl border border-white/10">
              <div className="bg-slate-950 p-6 rounded-lg text-center border border-rose-500/20">
                <p className="label-mono text-rose-400">Sebelum SMS</p>
                <p className="text-3xl font-bold text-white mt-2">30 Menit</p>
                <p className="text-xs text-slate-400 mt-1">per kelas (manual)</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-lg text-center border border-sky-500/30">
                <p className="label-mono text-sky-400">Dengan SMS</p>
                <p className="text-3xl font-bold text-sky-400 mt-2">5 Menit</p>
                <p className="text-xs text-slate-300 mt-1">per kelas (ototmatis)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FORM KONTAK & FOOTER */}
      <section id="daftar" className="border-t border-white/10 py-20 md:py-32">
        <div className="mx-auto max-w-[110rem] px-5 md:px-10 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-[clamp(2rem,4.5vw,3.8rem)] font-bold text-white leading-tight">
              Siap mengubah cara kerja administrasi sekolah Anda?
            </h2>
            <p className="mt-6 text-slate-300 text-base max-w-md">
              Coba langsung aplikasi demo Banyubiru SMS sekarang atau jadwalkan sesi demonstrasi untuk sekolah Anda.
            </p>
            <div className="mt-8">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 bg-sky-400 px-6 py-3.5 text-sm font-semibold text-slate-950 rounded shadow-lg shadow-sky-500/20 hover:bg-sky-300 transition-all"
              >
                <span>Masuk ke Demo App Sekarang</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="panel p-8 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white mb-2">Formulir Permintaan Demo Sekolah</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-mono block mb-1.5">Nama Lengkap</label>
                <input
                  required
                  type="text"
                  placeholder="Budi Santoso"
                  className="w-full bg-slate-900 border border-white/15 px-3.5 py-2 text-sm text-white rounded outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  placeholder="budi@sekolah.sch.id"
                  className="w-full bg-slate-900 border border-white/15 px-3.5 py-2 text-sm text-white rounded outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Telepon / WhatsApp</label>
                <input
                  required
                  type="tel"
                  placeholder="08123456789"
                  className="w-full bg-slate-900 border border-white/15 px-3.5 py-2 text-sm text-white rounded outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Nama Sekolah</label>
                <input
                  required
                  type="text"
                  placeholder="SMP Negeri 1 Jakarta"
                  className="w-full bg-slate-900 border border-white/15 px-3.5 py-2 text-sm text-white rounded outline-none focus:border-sky-400"
                />
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full mt-4 flex items-center justify-center gap-2 bg-sky-400 py-3 text-sm font-semibold text-slate-950 rounded hover:bg-sky-300 transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>Kirim Permintaan Demo</span>
            </button>

            {formSubmitted && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded text-center text-xs text-emerald-300 font-mono">
                Terima kasih! Permintaan Anda telah diterima. Tim kami akan menghubungi WhatsApp Anda.
              </div>
            )}
          </form>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-slate-950 py-12">
        <div className="mx-auto max-w-[110rem] px-5 md:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-sky-400" />
            <span className="font-bold text-white text-sm">Banyubiru Digital Solution</span>
          </div>
          <p className="font-mono text-xs text-slate-400">
            &copy; 2026 Banyubiru Digital Solution · SMS (Sistem Manajemen Sekolah)
          </p>
        </div>
      </footer>
    </>
  );
}
