'use client';

import React, { useState, useMemo } from 'react';
import { AwardProposal, AwardType, ProposalStatus } from '@/types/award';
import { Search, Filter, Award, ChevronLeft, ChevronRight, Eye, CheckCircle, Clock } from 'lucide-react';

interface CandidateListProps {
  proposals: AwardProposal[];
  onSelectCandidate: (candidate: AwardProposal) => void;
}

export const CandidateList: React.FC<CandidateListProps> = ({
  proposals,
  onSelectCandidate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterWilayah, setFilterWilayah] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterUsulan, setFilterUsulan] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Filter & Search Logic
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        p.employee.nama.toLowerCase().includes(search) ||
        p.employee.nrk.toLowerCase().includes(search) ||
        p.employee.nip.toLowerCase().includes(search) ||
        p.employee.unitKerja.toLowerCase().includes(search) ||
        p.employee.jabatan.toLowerCase().includes(search);

      // Award Type Filter
      const matchType = filterType === 'ALL' || p.jenisPenghargaan === filterType;

      // Wilayah Filter
      const matchWilayah = filterWilayah === 'ALL' || p.employee.wilayah === filterWilayah;

      // Status Filter
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;

      // Nilai Usulan Filter
      const matchUsulan = filterUsulan === 'ALL' || p.nilaiUsulan === filterUsulan;

      return matchSearch && matchType && matchWilayah && matchStatus && matchUsulan;
    });
  }, [proposals, searchTerm, filterType, filterWilayah, filterStatus, filterUsulan]);

  // Reset to page 1 on filter change
  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage) || 1;
  const paginatedProposals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProposals.slice(start, start + itemsPerPage);
  }, [filteredProposals, currentPage]);

  const WILAYAH_OPTIONS = [
    'Jakarta Pusat',
    'Jakarta Selatan',
    'Jakarta Barat',
    'Jakarta Timur',
    'Jakarta Utara',
    'Kepulauan Seribu',
  ];

  const STATUS_OPTIONS: ProposalStatus[] = [
    'NOMINATIF',
    'BELUM_UPLOAD',
    'SEBAGIAN',
    'LENGKAP',
    'DIVERIFIKASI',
    'SIAP_GENERATE',
    'GENERATED',
    'DITANDATANGANI',
    'DIKIRIM',
    'SELESAI',
  ];

  return (
    <div className="space-y-4">
      {/* Title & Filters Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Award className="w-5 h-5 text-blue-600" />
              <span>Daftar Kandidat Penghargaan Pegawai</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {filteredProposals.length} dari total {proposals.length} entri nominatif.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari NRK, NIP, Nama, Unit Kerja..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-4 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Jenis Penghargaan</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="MASA_KERJA">Masa Kerja</option>
              <option value="SATYALANCANA">Satyalancana</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Wilayah</label>
            <select
              value={filterWilayah}
              onChange={(e) => {
                setFilterWilayah(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Wilayah</option>
              {WILAYAH_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Status Workflow</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Nilai Usulan</label>
            <select
              value={filterUsulan}
              onChange={(e) => {
                setFilterUsulan(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Usulan</option>
              <option value="10">Masa Kerja 10 Thn</option>
              <option value="20">Masa Kerja 20 Thn</option>
              <option value="30">Masa Kerja 30 Thn</option>
              <option value="X">Satya X</option>
              <option value="XX">Satya XX</option>
              <option value="XXX">Satya XXX</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Identitas Pegawai</th>
                <th className="py-3 px-4">Jabatan & UKPD</th>
                <th className="py-3 px-4">Wilayah</th>
                <th className="py-3 px-4">Jenis & Nilai Usulan</th>
                <th className="py-3 px-4">Status Berkas</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {paginatedProposals.length > 0 ? (
                paginatedProposals.map((p, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-400">{globalIdx}</td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {p.employee.nama} {p.employee.gelar || ''}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          NRK: {p.employee.nrk} | NIP: {p.employee.nip}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{p.employee.jabatan}</div>
                        <div className="text-[11px] text-slate-500">{p.employee.ukpd}</div>
                      </td>

                      <td className="py-3 px-4 font-medium">{p.employee.wilayah}</td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            p.jenisPenghargaan === 'MASA_KERJA'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {p.jenisPenghargaan === 'MASA_KERJA'
                            ? `Masa Kerja ${p.nilaiUsulan} Thn`
                            : `Satyalancana ${p.nilaiUsulan}`}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                            p.status === 'SIAP_GENERATE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : p.status === 'DIVERIFIKASI'
                              ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                              : p.status === 'LENGKAP'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <span>{p.status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onSelectCandidate(p)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-800 flex items-center space-x-1 mx-auto transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Tidak ada data kandidat yang cocok dengan kriteria pencarian/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Halaman <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> dari{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span> (Total {filteredProposals.length} kandidat)
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
