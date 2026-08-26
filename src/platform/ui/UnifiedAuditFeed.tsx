'use client';

import React, { useEffect, useState } from 'react';
import { AuditEvent } from '../types';
import { PlatformOperationalService } from '../services/operational';
import { History, User, Activity, Clock, ShieldCheck } from 'lucide-react';

export const UnifiedAuditFeed: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    const service = new PlatformOperationalService();
    const loaded = service.getAuditEngine().getAllEvents();
    setEvents(loaded);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Unified Audit &amp; Activity Feed</h2>
            <p className="text-xs text-slate-400">
              Jejak audit tidak dapat diubah (immutable audit trail) merekam seluruh aktivitas administratif lintas domain.
            </p>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
          Riwayat Aktivitas Terakhir ({events.length} Peristiwa)
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {events.length > 0 ? (
            events.map((ev) => (
              <div key={ev.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{ev.actor}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold border border-blue-200">
                        {ev.action}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Target: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{ev.entityType} ({ev.entityId})</span>
                    </p>
                    {ev.metadata?.details && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 italic">
                        "{ev.metadata.details}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-400 shrink-0">
                  {new Date(ev.timestamp).toLocaleString('id-ID')}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">Belum ada riwayat aktivitas recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
};
