'use client';

import React from 'react';
import {
  Award,
  LayoutDashboard,
  AlertOctagon,
  CheckSquare,
  Users,
  Upload,
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

export const UnifiedNavigation: React.FC<UnifiedNavigationProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  setUserRole,
  counts,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-500/20">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  BANYUBIRU
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-mono font-bold">
                  v0.3
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Administrative Intelligence Platform</p>
            </div>
          </div>

          {/* Unified Nav Tabs */}
          <nav className="hidden lg:flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('workqueue')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors relative ${
                activeTab === 'workqueue'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Work Queue</span>
              {counts.pendingWorkItems > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {counts.pendingWorkItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('exceptions')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors relative ${
                activeTab === 'exceptions'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              <span>Exception Center</span>
              {counts.openExceptions > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {counts.openExceptions}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('kandidat')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'kandidat'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>Employees</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'students'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Students</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'generator'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>PDF Gen</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition-colors ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Role Switcher */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setUserRole('admin')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'admin' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Admin
              </button>
              <button
                onClick={() => setUserRole('verifikator')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'verifikator' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Verifikator
              </button>
              <button
                onClick={() => setUserRole('pegawai')}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  userRole === 'pegawai' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                User
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
