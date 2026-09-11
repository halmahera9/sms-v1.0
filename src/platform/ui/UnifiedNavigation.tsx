'use client';

import React from 'react';
import {
  Award,
  LayoutDashboard,
  CheckSquare,
  AlertOctagon,
  Users,
  FileText,
  History,
  Settings,
} from 'lucide-react';

interface UnifiedNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'verifikator' | 'pegawai';
  setUserRole: (role: 'admin' | 'verifikator' | 'pegawai') => void;
  counts: {
    totalEmployees: number;
    totalStudents: number;
    openExceptions: number;
    pendingWorkItems: number;
  };
}

const items = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'workqueue', label: 'Proses', icon: CheckSquare },
  { id: 'exceptions', label: 'Dokumen', icon: FileText },
  { id: 'kandidat', label: 'Analitik', icon: Award },
  { id: 'students', label: 'Siswa', icon: Users },
];

export const UnifiedNavigation: React.FC<UnifiedNavigationProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  counts,
}) => {
  const navigate = (id: string) => setActiveTab(id);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-20 items-center gap-3 px-6 border-b border-slate-100">
          <button
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[17px] font-extrabold tracking-tight text-slate-950">
                Banyubiru
              </div>
              <div className="text-[11px] font-medium text-slate-400">
                Administrative Intelligence
              </div>
            </div>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {items.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{label}</span>

                {id === 'workqueue' && counts.pendingWorkItems > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                    {counts.pendingWorkItems}
                  </span>
                )}

                {id === 'exceptions' && counts.openExceptions > 0 && (
                  <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    {counts.openExceptions}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <button
            onClick={() => navigate('generator')}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
              activeTab === 'generator'
                ? 'bg-slate-950 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <FileText className="h-[18px] w-[18px]" />
            Generator
          </button>

          <button
            onClick={() => navigate('audit')}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
              activeTab === 'audit'
                ? 'bg-slate-950 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <History className="h-[18px] w-[18px]" />
            Riwayat
          </button>

          <button
            onClick={() => navigate('settings')}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-950"
          >
            <Settings className="h-[18px] w-[18px]" />
            Pengaturan
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-5">
          <button
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Award className="h-4 w-4" />
            </div>
            <span className="text-[17px] font-extrabold tracking-tight text-slate-950">
              Banyubiru
            </span>
          </button>

          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold capitalize text-slate-600">
            {userRole}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {items.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;

            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className="relative flex flex-col items-center gap-1 py-1.5"
              >
                <div
                  className={`flex h-9 w-12 items-center justify-center rounded-full transition ${
                    active ? 'bg-slate-950 text-white' : 'text-slate-400'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>

                <span
                  className={`text-[10px] font-semibold ${
                    active ? 'text-slate-950' : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>

                {id === 'workqueue' && counts.pendingWorkItems > 0 && (
                  <span className="absolute right-3 top-0 h-4 min-w-4 rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-4 text-slate-950">
                    {counts.pendingWorkItems}
                  </span>
                )}

                {id === 'exceptions' && counts.openExceptions > 0 && (
                  <span className="absolute right-3 top-0 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {counts.openExceptions}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
