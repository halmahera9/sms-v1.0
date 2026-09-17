'use client';

import { useState, useEffect } from 'react';
import { Search, Clock, User, AlertCircle, RefreshCw } from 'lucide-react';
import { getRecentAuditEventsAction } from '@/platform/actions/audit';

interface DisplayAuditLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  target: string;
  details: string;
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<DisplayAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function loadLogs() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getRecentAuditEventsAction(100);
      if (res.success && res.data) {
        const formatted: DisplayAuditLog[] = res.data.map((e) => {
          let detailsStr = '-';
          if (e.metadata && typeof e.metadata === 'object') {
            const meta = e.metadata as Record<string, unknown>;
            if (typeof meta.details === 'string') {
              detailsStr = meta.details;
            } else if (typeof meta.reason === 'string') {
              detailsStr = meta.reason;
            } else {
              detailsStr = JSON.stringify(meta);
            }
          }

          return {
            id: e.id,
            timestamp: typeof e.timestamp === 'string' ? e.timestamp : new Date().toISOString(),
            operator: e.actor || e.actorUserId || 'system',
            action: e.action,
            target: `${e.entityType || ''} ${e.entityId ? `(${e.entityId.substring(0, 8)}...)` : ''}`.trim() || '-',
            details: detailsStr,
          };
        });
        setLogs(formatted);
      } else if (res.error) {
        setErrorMessage(res.error.message);
      }
    } catch {
      setErrorMessage('Gagal memuat log audit dari server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.operator.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail &amp; Log Riwayat System</h1>
          <p className="text-xs text-slate-600 mt-1">
            Pencatatan aktivitas akuntabel: Siapa, Kapan, dan Aksi apa yang dilakukan operator pada sistem SMS.
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 rounded border border-slate-200 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-slate-900 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
          <input
            type="text"
            placeholder="Cari kata kunci audit log..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 rounded outline-none focus:border-blue-600"
          />
        </div>
        <span className="text-xs font-mono text-slate-600">Total Log: {filteredLogs.length} Records</span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b border-slate-200">
              <tr>
                <th className="p-4">Waktu (Timestamp)</th>
                <th className="p-4">Operator</th>
                <th className="p-4">Jenis Aksi</th>
                <th className="p-4">Target File/Objek</th>
                <th className="p-4">Rincian Perubahan / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-600 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>Memuat catatan log audit dari server...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-600 font-mono">
                    Belum ada catatan log aktivitas.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-4 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        <span>{log.timestamp}</span>
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-900" />
                        <span>{log.operator}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        log.action.includes('VERIFY')
                          ? 'bg-blue-600/20 text-slate-900 border border-slate-200'
                          : log.action.includes('IMPORT') || log.action.includes('EXPORT')
                          ? 'bg-blue-600/20 text-blue-600 border border-blue-200'
                          : 'bg-blue-500/20 text-slate-900 border border-amber-500/30'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700 font-bold">{log.target}</td>
                    <td className="p-4 text-slate-600 text-[11px]">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
