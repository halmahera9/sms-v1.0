'use client';

import { useState, useEffect } from 'react';
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
  XCircle,
} from 'lucide-react';
import {
  getLetterTemplatesAction,
  seedDefaultLetterTemplatesAction,
} from '@/platform/actions/letter-template';
import type { LetterTemplateRecordDTO } from '@/platform/types/letter-template';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'siswa' | 'guru_karyawan' | 'template_surat'>('template_surat');
  const [templates, setTemplates] = useState<LetterTemplateRecordDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJenis, setFilterJenis] = useState('Semua');

  const loadTemplates = async () => {
    const res = await getLetterTemplatesAction();
    if (res.success && res.data && res.data.length > 0) {
      setTemplates(res.data);
    } else {
      // Seed default templates if database is empty for current tenant
      await seedDefaultLetterTemplatesAction();
      const retry = await getLetterTemplatesAction();
      if (retry.success && retry.data) {
        setTemplates(retry.data);
      }
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.namaTemplate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.kodeTemplate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.jenisSurat.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJenis =
      filterJenis === 'Semua' || t.jenisSurat === filterJenis;
    return matchesSearch && matchesJenis;
  });

  const availableJenisSurat = [
    'Semua',
    ...Array.from(new Set(templates.map((t) => t.jenisSurat).filter(Boolean))),
  ];

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
          Pusat repositori data siswa, guru, karyawan, dan Template Surat dinas sekolah.
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
                Format baku surat administrasi yang menggunakan data Siswa, Guru &amp; Karyawan, dan hasil ekstraksi dokumen.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2b5c] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Template Surat</span>
            </button>
          </div>

          {/* Filter & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Template Surat atau Kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 rounded-lg outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">Jenis Surat:</span>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 rounded-lg outline-none focus:border-blue-600"
              >
                {availableJenisSurat.map((jenis) => (
                  <option key={jenis} value={jenis}>
                    {jenis}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                      {tmpl.kodeTemplate}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                      Jenis Surat: {tmpl.jenisSurat}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">
                    {tmpl.namaTemplate}
                  </h3>

                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wider">
                      Isi Template:
                    </p>
                    <p className="line-clamp-3 text-[11px] font-mono text-slate-600 whitespace-pre-line">
                      {tmpl.isiTemplate}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Variabel ({tmpl.variabel.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.variabel.map((v, vIdx) => (
                        <span
                          key={vIdx}
                          className="text-[10px] bg-blue-50 text-blue-800 border border-blue-100 px-1.5 py-0.5 rounded font-mono"
                        >
                          &#123;&#123;{v}&#125;&#125;
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                      tmpl.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {tmpl.isActive ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {tmpl.statusLabel}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Template Surat
                  </span>
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
