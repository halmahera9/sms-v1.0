'use client';

import { useState } from 'react';
import {
  Building,
  Image,
  FileText,
  UserCheck,
  ShieldAlert,
  Sliders,
  Send,
  CheckCircle2,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('profil');

  const sections = [
    { id: 'profil', name: 'Profil Sekolah', icon: Building, desc: 'Identitas NPSN, alamat, kontak resmi sekolah' },
    { id: 'logo', name: 'Logo Sekolah', icon: Image, desc: 'Berkas lambang sekolah untuk kop dan dokumen' },
    { id: 'kop', name: 'Kop Surat', icon: FileText, desc: 'Pengaturan tata letak kepala surat resmi dinas' },
    { id: 'penandatangan', name: 'Penandatangan', icon: UserCheck, desc: 'Pejabat berwenang penandatangan surat' },
    { id: 'pengguna', name: 'Pengguna & Hak Akses', icon: ShieldAlert, desc: 'Manajemen akun administrator dan operator' },
    { id: 'pengaturan_dokumen', name: 'Pengaturan Dokumen', icon: Sliders, desc: 'Batas ukuran, format berkas, dan masa simpan' },
    { id: 'formulir_pengumpulan', name: 'Formulir Pengumpulan Dokumen', icon: Send, desc: 'Tautan formulir publik untuk orang tua/siswa' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Administrasi
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Pengaturan Sistem</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Administrasi &amp; Pengaturan Sekolah
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Konfigurasi identitas institusi, kop surat, penandatangan, hak akses, dan formulir pengumpulan dokumen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const isCurrent = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-colors ${
                  isCurrent
                    ? 'bg-[#0f2b5c] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          {activeSection === 'profil' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Profil Institusi Sekolah</h3>
                <p className="text-xs text-slate-500">Data identitas resmi sekolah untuk kebutuhan administrasi dokumen.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nama Sekolah</label>
                  <input
                    type="text"
                    readOnly
                    value="SMA Negeri 1 Jakarta"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">NPSN</label>
                  <input
                    type="text"
                    readOnly
                    value="20100001"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Alamat Lengkap</label>
                  <input
                    type="text"
                    readOnly
                    value="Jl. Budi Utomo No. 7, Pasar Baru, Sawah Besar, Jakarta Pusat"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'logo' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Logo &amp; Lambang Sekolah</h3>
                <p className="text-xs text-slate-500">Berkas logo resmi untuk ditempatkan pada kop surat dan sertifikat.</p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                <Image className="mx-auto h-8 w-8 text-slate-400" />
                <p className="text-xs font-medium text-slate-700">Logo tersimpan secara aman di penyimpanan objek sekolah</p>
                <p className="text-[11px] text-slate-400">Format yang didukung: PNG atau SVG transparan dengan resolusi tinggi</p>
              </div>
            </div>
          )}

          {activeSection === 'kop' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pengaturan Kop Surat Resmi</h3>
                <p className="text-xs text-slate-500">Format tata letak kepala surat untuk dokumen dinas keluar.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 text-xs text-slate-700 font-mono space-y-1">
                <p className="font-bold text-center">PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA</p>
                <p className="font-bold text-center">DINAS PENDIDIKAN</p>
                <p className="font-bold text-center text-blue-900">SEKOLAH MENENGAH ATAS NEGERI 1 JAKARTA</p>
                <p className="text-[10px] text-center text-slate-500">Jl. Budi Utomo No. 7 Telp. (021) 3865001 Jakarta Pusat</p>
              </div>
            </div>
          )}

          {activeSection === 'penandatangan' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pejabat Penandatangan Resmi</h3>
                <p className="text-xs text-slate-500">Daftar pimpinan yang berwenang menandatangani surat tugas dan keterangan.</p>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Drs. H. Mulyadi, M.Pd.</p>
                    <p className="text-slate-500 text-[11px]">Kepala Sekolah &bull; Pembina Utama Muda (IV/c)</p>
                  </div>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Aktif</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Siti Rahmawati, S.Pd., M.M.</p>
                    <p className="text-slate-500 text-[11px]">Wakil Kepala Sekolah Bidang Kurikulum</p>
                  </div>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Aktif</span>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'pengguna' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pengguna &amp; Hak Akses Sekolah</h3>
                <p className="text-xs text-slate-500">Pemberian wewenang peran: Administrator, Operator, dan Verifikator.</p>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manajemen akun terikat pada tenant sekolah dengan isolasi data RLS (Row-Level Security).
              </p>
            </div>
          )}

          {activeSection === 'pengaturan_dokumen' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kebijakan Pemrosesan Dokumen</h3>
                <p className="text-xs text-slate-500">Pengaturan resolusi OCR, batas ukuran berkas, dan retensi audit trail.</p>
              </div>
              <div className="text-xs text-slate-600 space-y-2">
                <p>&bull; <strong>Format Dokumen Didukung:</strong> PDF, JPEG, PNG, WEBP</p>
                <p>&bull; <strong>Batas Ukuran Berkas:</strong> Maksimal 15 MB per dokumen</p>
                <p>&bull; <strong>Audit Log:</strong> Tersimpan permanen dengan jejak hash SHA-256</p>
              </div>
            </div>
          )}

          {activeSection === 'formulir_pengumpulan' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Formulir Pengumpulan Dokumen Publik</h3>
                <p className="text-xs text-slate-500">Pengaturan tautan aman untuk pengumpulan berkas dari orang tua siswa dan mitra.</p>
              </div>
              <p className="text-xs text-slate-600">
                Pengumpulan dokumen menggunakan token aman sekali pakai dengan batas waktu kedaluwarsa otomatis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
