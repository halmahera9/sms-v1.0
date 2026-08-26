'use client';

import React, { useEffect, useState } from 'react';
import { WorkQueueItem, PlatformOperationalService } from '../services/operational';
import { CheckSquare, AlertTriangle, ArrowRight, Clock, Award, Users } from 'lucide-react';

interface UnifiedWorkQueueProps {
  onNavigateDomainItem?: (domain: 'EMPLOYEE' | 'STUDENT', entityId: string) => void;
}

export const UnifiedWorkQueue: React.FC<UnifiedWorkQueueProps> = ({ onNavigateDomainItem }) => {
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const service = new PlatformOperationalService();
    service.getWorkQueueItems().then((res) => {
      setItems(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 font-mono text-xs">Memuat Antrean Kerja...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Unified Work Queue (Antrean Kerja Operasional)</h2>
            <p className="text-xs text-slate-400">
              Menampilkan seluruh item tindakan administratif yang memerlukan verifikasi, persetujuan, atau koreksi.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Item &amp; Deskripsi Usulan</th>
                <th className="py-3 px-4">Tindakan Dibutuhkan</th>
                <th className="py-3 px-4">Prioritas / Severity</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          item.domain === 'EMPLOYEE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {item.domain}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{item.subtitle}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">
                      {item.actionRequired}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                            : item.severity === 'HIGH'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onNavigateDomainItem && onNavigateDomainItem(item.domain, item.entityId)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-all inline-flex items-center space-x-1"
                      >
                        <span>Proses</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Antrean kerja bersih. Seluruh tindakan administratif telah diselesaikan!
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
