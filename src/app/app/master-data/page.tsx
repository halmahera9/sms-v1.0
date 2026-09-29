'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileCode2,
  Database,
  ArrowRight,
  Plus,
  Search,
  CheckCircle2,
} from 'lucide-react';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'siswa' | 'guru_karyawan' | 'template_surat'>('template_surat');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Data Sekolah
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs text-slate-500 font-medium">Single Source of Truth</span>
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Data Master Sekolah
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Pusat repositori data siswa, guru, karyawan, dan template surat dinas sekolah.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('template_surat')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'template_surat'
              ? 'border-blue-700 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileCode2 className="h-4 w-4" />
          <span>Template Surat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('siswa')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'siswa'
              ? 'border-blue-700 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Siswa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guru_karyawan')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'guru_karyawan'
              ? 'border-blue-700 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Guru &amp; Karyawan</span>
        </button>
      </div>

      {/* Tab 1: Template Surat */}
      {activeTab === 'template_surat' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Katalog Template Surat Dinas
              </h2>
              <p className="text-xs text-slate-500">
                Format baku surat administrasi yang digunakan Banyubiru untuk menerbitkan dokumen tindak lanjut.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2b5c] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Template Baru</span>
            </button>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                code: 'ST-01',
                name: 'Surat Tugas Pendidik & Tenaga Kependidikan',
                type: 'Surat Tugas',
                format: 'A4 / Kop Resmi Sekolah',
                vars: ['nama_petugas', 'nip', 'tugas', 'tanggal_penugasan', 'lokasi'],
                signer: 'Kepala Sekolah',
                rule: 'Pencocokan nama & NIP guru dari database',
              },
              {
                code: 'SK-01',
                name: 'Surat Keterangan Aktif Belajar Siswa',
                type: 'Surat Keterangan',
                format: 'A4 / Kop Resmi Sekolah',
                vars: ['nama_siswa', 'nisn', 'kelas', 'tahun_ajaran', 'nama_orang_tua'],
                signer: 'Kepala Sekolah / Wakasek Kesiswaan',
                rule: 'Validasi status siswa aktif di master data',
              },
              {
                code: 'SP-01',
                name: 'Surat Pernyataan Kesanggupan Tata Tertib',
                type: 'Surat Pernyataan',
                format: 'A4 / Formulir Standar',
                vars: ['nama_pembuat', 'nik', 'alamat', 'perihal', 'tanggal'],
                signer: 'Orang Tua / Wali Murid',
                rule: 'Memerlukan verifikasi fisik bertanda tangan',
              },
              {
                code: 'SD-01',
                name: 'Surat Pengantar Berkas Dinas / Mutasi',
                type: 'Surat Pengantar',
                format: 'A4 / Kop Resmi Sekolah',
                vars: ['nomor_surat', 'tujuan_dinas', 'daftar_lampiran', 'nama_siswa'],
                signer: 'Kepala Tata Usaha',
                rule: 'Penyertaan dokumen lampiran terverifikasi',
              },
              {
                code: 'SU-01',
                name: 'Surat Undangan Rapat Pleno Komite & Orang Tua',
                type: 'Surat Undangan',
                format: 'A4 / Kop Resmi Sekolah',
                vars: ['hari_tanggal', 'waktu', 'agenda', 'tempat', 'penerima'],
                signer: 'Kepala Sekolah & Ketua Komite',
                rule: 'Distribusi otomatis berdasarkan daftar kelas',
              },
              {
                code: 'SKP-01',
                name: 'Surat Keputusan Penugasan Pembina Ekstrakurikuler',
                type: 'Surat Keputusan',
                format: 'A4 / Format SK Baku',
                vars: ['nomor_sk', 'tentang', 'nama_pembina', 'tahun_ajaran'],
                signer: 'Kepala Sekolah',
                rule: 'Pencocokan guru dari database pegawai',
              },
            ].map((tmpl, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {tmpl.code}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {tmpl.type}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">
                    {tmpl.name}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-700">Format &amp; Kop:</span> {tmpl.format}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Penandatangan:</span> {tmpl.signer}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Aturan Pengisian:</span> {tmpl.rule}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Variabel Data:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.vars.map((v, vIdx) => (
                        <span
                          key={vIdx}
                          className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono"
                        >
                          &#123;{v}&#125;
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Siap Digunakan
                  </span>
                  <button
                    type="button"
                    className="text-blue-700 font-bold hover:text-blue-900"
                  >
                    Atur Format &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Siswa Link */}
      {activeTab === 'siswa' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Database Induk Siswa
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Kelola data siswa, NISN, NIK, dan rombongan belajar aktif untuk pencocokan otomatis dokumen kependudukan dan akademik.
          </p>
          <div>
            <Link
              href="/app/students"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-5 py-2.5 text-xs font-semibold text-white shadow-xs"
            >
              <span>Buka Modul Siswa Lengkap</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Tab 3: Guru & Karyawan Link */}
      {activeTab === 'guru_karyawan' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Database Guru &amp; Tenaga Kependidikan
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Kelola data guru dan karyawan, NIP, jabatan resmi, dan unit kerja untuk penerbitan surat tugas kedinasan.
          </p>
          <div>
            <Link
              href="/app/employees"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f2b5c] px-5 py-2.5 text-xs font-semibold text-white shadow-xs"
            >
              <span>Buka Modul Guru &amp; Karyawan</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
