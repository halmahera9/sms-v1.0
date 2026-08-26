'use client';

import React, { useState } from 'react';
import { ExceptionItem, ExceptionStatus, ValidationSeverity } from '../types';
import { PlatformExceptionQueue } from '../exceptions/queue';
import { AlertOctagon, CheckCircle2, Search, Filter, ShieldAlert, ArrowRight, X } from 'lucide-react';

interface UnifiedExceptionCenterProps {
  exceptionQueue: PlatformExceptionQueue;
  onRefresh?: () => void;
}

export const UnifiedExceptionCenter: React.FC<UnifiedExceptionCenterProps> = ({
  exceptionQueue,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDomain, setFilterDomain] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedException, setSelectedException] = useState<ExceptionItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const exceptions = exceptionQueue.getAll();

  const filteredExceptions = exceptions.filter((e) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      e.ruleId.toLowerCase().includes(search) ||
      e.message.toLowerCase().includes(search) ||
      e.entityId.toLowerCase().includes(search);

    const matchDomain =
      filterDomain === 'ALL' ||
      (filterDomain === 'EMPLOYEE' && (e.entityType.includes('Award') || e.entityType.includes('Employee'))) ||
      (filterDomain === 'STUDENT' && (e.entityType.includes('Student') || e.entityType.includes('Extracted') || e.entityType.includes('OCR')));

    const matchSeverity = filterSeverity === 'ALL' || e.severity === filterSeverity;
    const matchStatus = filterStatus === 'ALL' || e.status === filterStatus;

    return matchSearch && matchDomain && matchSeverity && matchStatus;
  });

  const handleResolve = (id: string, status: ExceptionStatus) => {
    exceptionQueue.updateStatus(id, status, 'Admin Platform', resolutionNote || 'Diselesaikan via Unified Exception Center');
    setSelectedException(null);
    setResolutionNote('');
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Unified Exception Center</h2>
            <p className="text-xs text-slate-400">
              Pusat penanganan pengecualian data, verifikasi gagal, dan pelanggaran aturan lintas domain (Employee &amp; Student).
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari Aturan, Pesan, ID Entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-4 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Domain</option>
              <option value="EMPLOYEE">Domain Employee</option>
              <option value="STUDENT">Domain Student</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Severity</option>
              <option value="ERROR">ERROR (Kritis)</option>
              <option value="WARNING">WARNING (Peringatan)</option>
              <option value="INFO">INFO (Informasi)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Status</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exception Items Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Aturan &amp; Pesan Pengecualian</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredExceptions.length > 0 ? (
                filteredExceptions.map((exc) => {
                  const isEmployee = exc.entityType.includes('Award') || exc.entityType.includes('Employee');
                  return (
                    <tr key={exc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isEmployee
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {isEmployee ? 'EMPLOYEE' : 'STUDENT'}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white font-mono">{exc.ruleId}</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{exc.message}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500">{exc.entityId}</td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            exc.severity === 'ERROR'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                              : exc.severity === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {exc.severity}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            exc.status === 'OPEN'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : exc.status === 'IN_REVIEW'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {exc.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedException(exc)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Tidak ada pengecualian yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exception Resolution Modal */}
      {selectedException && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Detail Pengecualian Aturan</span>
              </h3>
              <button onClick={() => setSelectedException(null)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-1 font-mono">
                <div><span className="text-slate-400">Rule ID:</span> <span className="font-bold">{selectedException.ruleId}</span></div>
                <div><span className="text-slate-400">Entity:</span> {selectedException.entityType} ({selectedException.entityId})</div>
                <div><span className="text-slate-400">Pesan:</span> <span className="text-rose-500 font-sans">{selectedException.message}</span></div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Catatan Penyelesaian / Resolusi</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Masukkan alasan penyelesaian atau tindakan koreksi..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs text-slate-900 dark:text-white h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleResolve(selectedException.id, 'IN_REVIEW')}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-2 rounded-lg font-bold"
              >
                Set IN_REVIEW
              </button>
              <button
                onClick={() => handleResolve(selectedException.id, 'RESOLVED')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                Tandai RESOLVED ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
