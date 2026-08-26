'use client';

import React from 'react';
import { Award, FileText, Upload, Settings, LayoutDashboard, ShieldCheck, UserCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'verifikator' | 'pegawai';
  setUserRole: (role: 'admin' | 'verifikator' | 'pegawai') => void;
  stats: {
    total: number;
    masaKerja: number;
    satyalancana: number;
    siapGenerate: number;
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  stats,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-500/20">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  BANYUBIRU
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-mono">
                  v0.2 MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">Sistem Otomatisasi Usulan Penghargaan Pegawai</p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('kandidat')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'kandidat'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Kandidat ({stats.total})</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'import'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>Import Nominatif</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                activeTab === 'generator'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Generate PDF</span>
              {stats.siapGenerate > 0 && (
                <span className="ml-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {stats.siapGenerate}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Pengaturan</span>
            </button>
          </nav>

          {/* Role Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setUserRole('admin')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'admin'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Akses Admin / Operator BKD"
              >
                Admin
              </button>
              <button
                onClick={() => setUserRole('verifikator')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'verifikator'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Akses Verifikator Berkas"
              >
                Verifikator
              </button>
              <button
                onClick={() => setUserRole('pegawai')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'pegawai'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Akses Pegawai Pengusul"
              >
                Pegawai
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
