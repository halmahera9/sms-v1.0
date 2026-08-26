'use client';

import React, { useState } from 'react';
import { AwardProposal } from '@/types/award';
import { generateNominatifPDF, generateSingleProposalPDF } from '@/lib/pdf-generator';
import { loadSignatoryConfig } from '@/lib/award-storage';
import { Download, CheckCircle2, Printer } from 'lucide-react';

interface DocumentGeneratorProps {
  proposals: AwardProposal[];
  onUpdateProposalStatus: (proposalIds: string[], status: AwardProposal['status']) => void;
}

export const DocumentGenerator: React.FC<DocumentGeneratorProps> = ({
  proposals,
  onUpdateProposalStatus,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SIAP_GENERATE'>('SIAP_GENERATE');
  const signatoryConfig = loadSignatoryConfig();

  const targetProposals = proposals.filter((p) => {
    if (filterType === 'SIAP_GENERATE') return p.status === 'SIAP_GENERATE' || p.status === 'LENGKAP';
    return true;
  });

  const readyCount = proposals.filter((p) => p.status === 'SIAP_GENERATE').length;

  const handleBatchExportNominatif = () => {
    generateNominatifPDF(targetProposals, signatoryConfig);
  };

  const handleBatchMarkAsGenerated = () => {
    const ids = targetProposals.map((p) => p.id);
    onUpdateProposalStatus(ids, 'GENERATED');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Printer className="w-6 h-6 text-blue-600" />
              <span>Document Generator & Cetak Berkas PDF</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Menghasilkan Surat Rekomendasi individu dan Daftar Nominatif kolektif sesuai SE No. 22/SE/2026.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchExportNominatif}
              disabled={targetProposals.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Daftar Nominatif (PDF)</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilterType('SIAP_GENERATE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'SIAP_GENERATE'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Siap Generate ({readyCount})
            </button>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'ALL'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Entri ({proposals.length})
            </button>
          </div>

          {readyCount > 0 && (
            <button
              onClick={handleBatchMarkAsGenerated}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tandai Semua ({readyCount}) Ter-generate</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Candidates List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            Daftar Berkas Siap Cetak ({targetProposals.length} Pegawai)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Pegawai</th>
                <th className="py-3 px-4">UKPD / Wilayah</th>
                <th className="py-3 px-4">Penghargaan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Cetak PDF Individu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {targetProposals.length > 0 ? (
                targetProposals.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {p.employee.nama}
                      <div className="text-[11px] text-slate-500 font-mono">NRK: {p.employee.nrk}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {p.employee.ukpd} ({p.employee.wilayah})
                    </td>
                    <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">
                      {p.jenisPenghargaan} ({p.nilaiUsulan})
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => generateSingleProposalPDF(p, signatoryConfig)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-semibold transition-all inline-flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Belum ada kandidat yang memenuhi syarat `SIAP_GENERATE`. Lengkapi verifikasi dokumen terlebih dahulu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
