'use client';

import React from 'react';
import { AwardProposal, ProposalStatus } from '@/types/award';
import {
  Users,
  Award,
  Medal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Building2,
} from 'lucide-react';

interface DashboardOverviewProps {
  proposals: AwardProposal[];
  onNavigateTab: (tab: string) => void;
  onSelectCandidate: (candidate: AwardProposal) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  proposals,
  onNavigateTab,
  onSelectCandidate,
}) => {
  const total = proposals.length;
  const masaKerja = proposals.filter((p) => p.jenisPenghargaan === 'MASA_KERJA');
  const satyalancana = proposals.filter((p) => p.jenisPenghargaan === 'SATYALANCANA');
  const siapGenerate = proposals.filter((p) => p.status === 'SIAP_GENERATE');
  const diverifikasi = proposals.filter((p) => p.status === 'DIVERIFIKASI');
  const lengkap = proposals.filter((p) => p.status === 'LENGKAP');
  const sebagian = proposals.filter((p) => p.status === 'SEBAGIAN');
  const belumUpload = proposals.filter((p) => p.status === 'BELUM_UPLOAD' || p.status === 'NOMINATIF');

  // Breakdown per Wilayah
  const wilayahMap: Record<string, number> = {};
  proposals.forEach((p) => {
    const w = p.employee.wilayah || 'Lainnya';
    wilayahMap[w] = (wilayahMap[w] || 0) + 1;
  });

  // Breakdown Satyalancana values (X, XX, XXX)
  const satyaX = satyalancana.filter((p) => p.nilaiUsulan === 'X').length;
  const satyaXX = satyalancana.filter((p) => p.nilaiUsulan === 'XX').length;
  const satyaXXX = satyalancana.filter((p) => p.nilaiUsulan === 'XXX').length;

  // Candidates requiring attention
  const needsAttention = proposals.filter(
    (p) => p.status === 'LENGKAP' || p.status === 'SEBAGIAN'
  ).slice(0, 5);

  const STATUS_FLOW: { key: ProposalStatus; label: string; count: number; color: string }[] = [
    { key: 'NOMINATIF', label: 'Nominatif', count: proposals.filter((p) => p.status === 'NOMINATIF').length, color: 'bg-slate-500' },
    { key: 'BELUM_UPLOAD', label: 'Belum Upload', count: proposals.filter((p) => p.status === 'BELUM_UPLOAD').length, color: 'bg-amber-500' },
    { key: 'SEBAGIAN', label: 'Upload Sebagian', count: sebagian.length, color: 'bg-blue-500' },
    { key: 'LENGKAP', label: 'Lengkap', count: lengkap.length, color: 'bg-indigo-500' },
    { key: 'DIVERIFIKASI', label: 'Diverifikasi', count: diverifikasi.length, color: 'bg-purple-500' },
    { key: 'SIAP_GENERATE', label: 'Siap Generate', count: siapGenerate.length, color: 'bg-emerald-500' },
    { key: 'GENERATED', label: 'Generated', count: proposals.filter((p) => p.status === 'GENERATED').length, color: 'bg-teal-500' },
    { key: 'DITANDATANGANI', label: 'Ditandatangani', count: proposals.filter((p) => p.status === 'DITANDATANGANI').length, color: 'bg-cyan-500' },
    { key: 'DIKIRIM', label: 'Dikirim', count: proposals.filter((p) => p.status === 'DIKIRIM').length, color: 'bg-sky-500' },
    { key: 'SELESAI', label: 'Selesai', count: proposals.filter((p) => p.status === 'SELESAI').length, color: 'bg-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-xl p-6 text-white shadow-xl border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
          <Award className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold mb-3">
            <Award className="w-3.5 h-3.5" />
            <span>SE BKD No. 22/SE/2026</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
            Sistem Otomatisasi Usulan Penghargaan Pegawai
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Pengelolaan otomatis nominatif usulan **Masa Kerja** dan **Satyalancana Karya Satya** pegawai Pemprov DKI Jakarta. Meliputi verifikasi berkas, tracking status workflow, dan penyiapan dokumen siap cetak.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigateTab('kandidat')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow flex items-center space-x-2"
            >
              <span>Lihat Semua Kandidat ({total})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigateTab('import')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2"
            >
              <span>Import Nominatif Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Metric */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Entri Nominatif</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{total.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1">Pegawai terdaftar di SE 22/2026</p>
            </div>
            <div className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 p-3 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Masa Kerja Metric */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usulan Masa Kerja</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{masaKerja.length.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1">Masa kerja 10, 20, dan 30 Tahun</p>
            </div>
            <div className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 p-3 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Satyalancana Metric */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usulan Satyalancana</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{satyalancana.length.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1">X ({satyaX}), XX ({satyaXX}), XXX ({satyaXXX})</p>
            </div>
            <div className="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 p-3 rounded-xl">
              <Medal className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Siap Generate Metric */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siap Generate PDF</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{siapGenerate.length.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1">Berkas verified 100% lengkap</p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 p-3 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Pipeline Status Visual */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Status Workflow Tahapan Pengurusan (10 Tahap)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribusi status berkas usulan dari nominatif hingga pengiriman dokumen final.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 pt-2">
          {STATUS_FLOW.map((sf) => (
            <div
              key={sf.key}
              className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 text-center hover:shadow transition-all"
            >
              <div className={`w-2.5 h-2.5 ${sf.color} rounded-full mx-auto mb-1.5`} />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block truncate" title={sf.label}>
                {sf.label}
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                {sf.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution per Wilayah & Candidates needing attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wilayah Distribution Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Distribusi per Wilayah Kota/Kab</span>
          </h3>

          <div className="space-y-3 pt-1">
            {Object.entries(wilayahMap).map(([wilayah, count]) => {
              const percentage = Math.round((count / total) * 100);
              return (
                <div key={wilayah} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700 dark:text-slate-300">{wilayah}</span>
                    <span className="text-slate-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Needed Candidates */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Kandidat Perlu Perhatian / Siap Verifikasi</span>
            </h3>
            <button
              onClick={() => onNavigateTab('kandidat')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Lihat Semua
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {needsAttention.length > 0 ? (
              needsAttention.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectCandidate(p)}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                      {p.employee.nama.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                        {p.employee.nama}
                      </p>
                      <p className="text-xs text-slate-500">
                        NRK: {p.employee.nrk} | {p.employee.ukpd} ({p.employee.wilayah})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        p.jenisPenghargaan === 'MASA_KERJA'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {p.jenisPenghargaan === 'MASA_KERJA' ? `Masa Kerja ${p.nilaiUsulan} Thn` : `Satya ${p.nilaiUsulan}`}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {p.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">Semua berkas terkendali.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
