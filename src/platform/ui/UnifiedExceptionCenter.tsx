'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getExceptionsAction, updateExceptionStatusAction } from '../actions/exception';
import type { ExceptionItemRecord } from '../repositories/exception';
import { ExceptionStatus, Severity } from '@prisma/client';
import {
  AlertOctagon,
  Search,
  ShieldAlert,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  User,
} from 'lucide-react';

interface UnifiedExceptionCenterProps {
  onRefresh?: () => void;
  exceptionQueue?: unknown; // Deprecated backward compatibility placeholder
}

export const UnifiedExceptionCenter: React.FC<UnifiedExceptionCenterProps> = ({
  onRefresh,
}) => {
  const [exceptions, setExceptions] = useState<ExceptionItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState<'ALL' | 'EMPLOYEE' | 'STUDENT'>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | 'ALL'>('ALL');

  const [selectedException, setSelectedException] = useState<ExceptionItemRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getExceptionsAction({
        domain: filterDomain,
        severity: filterSeverity,
        status: filterStatus,
        limit: 100,
      });

      if (res.success && res.data) {
        setExceptions(res.data);
      } else {
        setError(res.error?.message || 'Gagal memuat daftar pengecualian.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memuat data.');
    } finally {
      setLoading(false);
    }
  }, [filterDomain, filterSeverity, filterStatus]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const handleResolve = async (id: string, status: ExceptionStatus) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMutationError(null);

    try {
      const res = await updateExceptionStatusAction({
        exceptionId: id,
        status,
        resolutionNote: resolutionNote.trim() || undefined,
      });

      if (res.success && res.data) {
        setSelectedException(null);
        setResolutionNote('');
        await fetchExceptions();
        if (onRefresh) onRefresh();
      } else {
        setMutationError(res.error?.message || 'Gagal mengubah status pengecualian.');
      }
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mutasi status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExceptions = exceptions.filter((e) => {
    const search = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      e.ruleCode.toLowerCase().includes(search) ||
      e.message.toLowerCase().includes(search) ||
      e.entityId.toLowerCase().includes(search) ||
      e.entityType.toLowerCase().includes(search) ||
      (e.resolutionNotes && e.resolutionNotes.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Unified Exception Center</h2>
              <p className="text-xs text-slate-400">
                Pusat penanganan pengecualian data, verifikasi kepatuhan, dan pelanggaran aturan lintas domain (Employee &amp; Student).
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchExceptions()}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-3 text-xs text-rose-800 dark:text-rose-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="flex-1">
            <span className="font-bold">Error Server: </span>
            {error}
          </div>
          <button
            onClick={() => fetchExceptions()}
            className="underline font-semibold hover:text-rose-900 dark:hover:text-rose-100"
          >
            Coba Lagi
          </button>
        </div>
      )}

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
              onChange={(e) => setFilterDomain(e.target.value as 'ALL' | 'EMPLOYEE' | 'STUDENT')}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Domain</option>
              <option value="EMPLOYEE">Domain Employee</option>
              <option value="STUDENT">Domain Student</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as Severity | 'ALL')}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-medium text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">Semua Severity</option>
              <option value="CRITICAL">CRITICAL (Kritis)</option>
              <option value="HIGH">HIGH (Tinggi)</option>
              <option value="MEDIUM">MEDIUM (Sedang)</option>
              <option value="LOW">LOW (Rendah)</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ExceptionStatus | 'ALL')}
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
                <th className="py-3 px-4">Aturan &amp; Pelanggaran</th>
                <th className="py-3 px-4">Entitas &amp; ID</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading && exceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    <div>Memuat daftar pengecualian dari server...</div>
                  </td>
                </tr>
              ) : filteredExceptions.length > 0 ? (
                filteredExceptions.map((exc) => {
                  const isEmployee = exc.domain === 'EMPLOYEE';
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
                          {exc.domain}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-md">
                        <div className="font-bold text-slate-900 dark:text-white font-mono">{exc.ruleCode}</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5 text-xs line-clamp-2">
                          {exc.message}
                        </div>
                        {exc.resolutionNotes && (
                          <div className="mt-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Catatan: </span>
                            {exc.resolutionNotes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{exc.entityType}</div>
                        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]">{exc.entityId}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            exc.severity === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                              : exc.severity === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                              : exc.severity === 'MEDIUM'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {exc.severity}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                              exc.status === 'OPEN'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : exc.status === 'IN_REVIEW'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : exc.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            {exc.status}
                          </span>
                          {exc.resolvedBy && (
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                              <User className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{exc.resolvedBy}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedException(exc);
                            setResolutionNote(exc.resolutionNotes || '');
                            setMutationError(null);
                          }}
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
                <span>Detail &amp; Resolusi Pengecualian Aturan</span>
              </h3>
              <button
                onClick={() => {
                  setSelectedException(null);
                  setMutationError(null);
                }}
                disabled={isSubmitting}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {mutationError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{mutationError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-1.5 font-mono">
                <div>
                  <span className="text-slate-400 font-sans">Kode Aturan:</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{selectedException.ruleCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans">Domain &amp; Entitas:</span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">
                    {selectedException.domain} / {selectedException.entityType} ({selectedException.entityId})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans">Pesan Pelanggaran:</span>{' '}
                  <span className="text-rose-600 dark:text-rose-400 font-sans block mt-0.5">
                    {selectedException.message}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Catatan Resolusi / Tindakan Verifikator
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Masukkan alasan atau verifikasi koreksi berkas..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-xs text-slate-900 dark:text-white h-20 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {selectedException.status === 'OPEN' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleResolve(selectedException.id, ExceptionStatus.IN_REVIEW)}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center space-x-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Set IN_REVIEW</span>
                </button>
              )}
              {(selectedException.status === 'OPEN' || selectedException.status === 'IN_REVIEW') && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleResolve(selectedException.id, ExceptionStatus.DISMISSED)}
                    className="bg-slate-600 hover:bg-slate-500 text-white text-xs px-3 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                  >
                    DISMISS
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleResolve(selectedException.id, ExceptionStatus.RESOLVED)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tandai RESOLVED ✓</span>
                  </button>
                </>
              )}
              {selectedException.status !== 'OPEN' && selectedException.status !== 'IN_REVIEW' && (
                <div className="text-xs text-slate-400 italic">
                  Status terminal ({selectedException.status}) tidak dapat diubah lagi.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
