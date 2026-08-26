'use client';

import React, { useEffect, useState } from 'react';
import { OperationalMetrics, PlatformOperationalService, WorkQueueItem } from '../services/operational';
import { ExceptionItem } from '../types';
import {
  AlertOctagon,
  CheckSquare,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface UnifiedDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ onNavigateTab }) => {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [workItems, setWorkItems] = useState<WorkQueueItem[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);

  useEffect(() => {
    const service = new PlatformOperationalService();
    service.getOperationalMetrics().then((m) => setMetrics(m));
    service.getWorkQueueItems().then((items) => setWorkItems(items.slice(0, 5)));
    const openExcs = service.getExceptionQueue().getOpenExceptions().slice(0, 5);
    Promise.resolve().then(() => setExceptions(openExcs));
  }, []);

  if (!metrics) {
    return <div className="p-8 text-center text-slate-400 font-mono text-xs">Memuat Dashboard Operasional...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Action-First Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Platform Operasional Inteligensi Administrasi</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
            Banyubiru Operational Workspace
          </h1>

          <p className="text-xs text-slate-300 leading-relaxed">
            Pusat kendali operasional terpadu yang memprioritaskan **tindakan administratif yang membutuhkan perhatian** (Pengecualian Aturan, Verifikasi Berkas, dan Persetujuan Document Generation).
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigateTab('exceptions')}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Kelola Pengecualian ({metrics.totalOpenExceptions})</span>
            </button>

            <button
              onClick={() => onNavigateTab('workqueue')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center space-x-2 transition-all"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Lihat Antrean Kerja ({metrics.pendingVerifications})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action-First Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Exceptions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pengecualian Terbuka</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{metrics.totalOpenExceptions}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Kritis: {metrics.exceptionsBySeverity.error} | Peringatan: {metrics.exceptionsBySeverity.warning}
              </p>
            </div>
            <div className="bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400 p-3 rounded-xl">
              <AlertOctagon className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Pending Verifications */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menunggu Verifikasi</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{metrics.pendingVerifications}</h3>
              <p className="text-xs text-slate-500 mt-1">Lintas domain Employee &amp; Student</p>
            </div>
            <div className="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 p-3 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siap Generate PDF</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.pendingApprovals}</h3>
              <p className="text-xs text-slate-500 mt-1">Berkas terverifikasi 100%</p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 p-3 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Total Registered Entities */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Entri Terdaftar</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {(metrics.totalEmployees + metrics.totalStudents).toLocaleString('id-ID')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.totalEmployees} Pegawai | {metrics.totalStudents} Siswa
              </p>
            </div>
            <div className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 p-3 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Action Items & Open Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Queue Preview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span>Antrean Kerja Butuh Tindakan ({workItems.length})</span>
            </h3>
            <button
              onClick={() => onNavigateTab('workqueue')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Lihat Semua
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {workItems.length > 0 ? (
              workItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          item.domain === 'EMPLOYEE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {item.domain}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.actionRequired}</p>
                  </div>

                  <button
                    onClick={() => onNavigateTab(item.domain === 'EMPLOYEE' ? 'kandidat' : 'students')}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <span>Proses</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">Antrean kerja bersih.</p>
            )}
          </div>
        </div>

        {/* Exceptions Preview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <AlertOctagon className="w-5 h-5 text-rose-500" />
              <span>Pengecualian Aturan Terbuka ({exceptions.length})</span>
            </h3>
            <button
              onClick={() => onNavigateTab('exceptions')}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Lihat Exception Center
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {exceptions.length > 0 ? (
              exceptions.map((exc) => (
                <div key={exc.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">{exc.ruleId}</div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{exc.message}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      exc.severity === 'ERROR'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {exc.severity}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">Tidak ada pengecualian terbuka.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
