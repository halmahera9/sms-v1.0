import Link from 'next/link';
import { Search, ArrowLeft, Filter } from 'lucide-react';

export default function DocumentSearchPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/app/documents"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pencarian Dokumen &amp; Arsip
          </h1>
          <p className="text-xs text-slate-500">
            Pencarian semantik dan metadata berdasarkan kata kunci, tanggal terbit, dan entitas terkait.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Masukkan kata kunci, NISN, NIK, NIP, atau perihal dokumen..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Kategori Dokumen</label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Semua Kategori</option>
              <option value="KARTU_KELUARGA">Kartu Keluarga (KK)</option>
              <option value="KTP">KTP</option>
              <option value="AKTA_KELAHIRAN">Akta Kelahiran</option>
              <option value="IJAZAH">Ijazah</option>
              <option value="RAPOR">Buku Rapor</option>
              <option value="SERTIFIKAT">Sertifikat</option>
              <option value="SURAT_TUGAS">Surat Tugas</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Status Dokumen</label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_VERIFICATION">Perlu Diperiksa</option>
              <option value="VERIFIED">Terverifikasi</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">Entitas Terkait</label>
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
              <option value="">Semua Entitas</option>
              <option value="STUDENT">Siswa</option>
              <option value="EMPLOYEE">Guru &amp; Karyawan</option>
              <option value="SCHOOL">Administrasi Sekolah</option>
            </select>
          </div>
        </div>

        <div className="pt-8 text-center text-xs text-slate-400">
          Masukkan parameter pencarian untuk menyaring arsip dokumen sekolah.
        </div>
      </div>
    </div>
  );
}
