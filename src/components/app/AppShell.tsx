'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  ScanText,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Users,
  Building2,
  Database,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  LayoutDashboard,
  Layers,
  Inbox,
  LogOut,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    groupName: 'Dokumen',
    items: [
      { name: 'Penerimaan Dokumen', href: '/app/ocr', icon: Inbox },
      { name: 'Pembacaan Dokumen', href: '/app/ocr', icon: ScanText },
      { name: 'Pengambilan Data', href: '/app/documents', icon: FileText },
      { name: 'Pencarian Dokumen', href: '/app/documents/search', icon: Search },
    ],
  },
  {
    groupName: 'Kecerdasan Dokumen',
    items: [
      { name: 'Klasifikasi Dokumen', href: '/app/intelligence/classification', icon: Layers },
      { name: 'Ekstraksi Data', href: '/app/intelligence/extraction', icon: Sparkles },
      { name: 'Pencocokan Data', href: '/app/intelligence/matching', icon: Search },
      { name: 'Validasi Data', href: '/app/intelligence/validation', icon: CheckCircle2 },
    ],
  },
  {
    groupName: 'Alur Kerja',
    items: [
      { name: 'Verifikasi', href: '/app/verify', icon: CheckCircle2 },
      { name: 'Perlu Diperiksa', href: '/app/verify?status=needs_review', icon: AlertCircle },
      { name: 'Persetujuan', href: '/app/workflows/approvals', icon: FileCheck2 },
    ],
  },
  {
    groupName: 'Data Sekolah',
    items: [
      { name: 'Siswa', href: '/app/students', icon: Users },
      { name: 'Guru & Karyawan', href: '/app/employees', icon: Building2 },
      { name: 'Data Master', href: '/app/master-data', icon: Database },
    ],
  },
  {
    groupName: 'Sistem',
    items: [
      { name: 'Analitik & Audit', href: '/app/audit', icon: BarChart3 },
      { name: 'Administrasi', href: '/app/admin', icon: Settings },
    ],
  },
];

const MOBILE_PRIMARY_NAV = [
  { name: 'Beranda', href: '/app', icon: LayoutDashboard },
  { name: 'Dokumen', href: '/app/ocr', icon: Inbox },
  { name: 'Verifikasi', href: '/app/verify', icon: CheckCircle2 },
  { name: 'Siswa', href: '/app/students', icon: Users },
];

export default function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: {
    username: string;
    role: string;
    roleLabel: string;
  };
}) {
  const pathname = usePathname();
  // Sidebar states: 'expanded' (240px) | 'collapsed' (68px) | 'hidden' (0px)
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Restore sidebar preference
  useEffect(() => {
    const saved = localStorage.getItem('by_sidebar_state');
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
      setSidebarState(saved);
    }
  }, []);

  const toggleSidebarCollapse = () => {
    const next = sidebarState === 'expanded' ? 'collapsed' : 'expanded';
    setSidebarState(next);
    localStorage.setItem('by_sidebar_state', next);
  };

  const toggleSidebarHide = () => {
    const next = sidebarState === 'hidden' ? 'expanded' : 'hidden';
    setSidebarState(next);
    localStorage.setItem('by_sidebar_state', next);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER BAR                                               */}
      {/* ------------------------------------------------------------- */}
      <header className="h-14 border-b border-slate-200/90 bg-white sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Toggle sidebar button for desktop */}
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title={sidebarState === 'collapsed' ? 'Perluas Menu' : 'Perkecil Menu'}
          >
            {sidebarState === 'collapsed' ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Mobile drawer trigger */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            aria-label="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Brand header */}
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f2b5c] text-white shadow-xs">
              <span className="text-xs font-black">BY</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-[#0f2b5c] tracking-tight truncate">
                  Banyubiru
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-blue-50 text-blue-800 font-semibold px-1.5 py-0.2 rounded border border-blue-200/60">
                  Document Intelligence
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* User profile & quick status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {user.username}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {user.roleLabel}
            </p>
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-900 ring-2 ring-blue-50">
            {user.username.charAt(0).toUpperCase()}
          </div>

          <Link
            href="/"
            title="Keluar ke Halaman Utama"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR + MAIN CONTENT AREA                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Collapsible Sidebar */}
        {sidebarState !== 'hidden' && (
          <aside
            className={`hidden md:flex flex-col shrink-0 border-r border-slate-200/90 bg-white sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto transition-all duration-200 ${
              sidebarState === 'collapsed' ? 'w-16' : 'w-64'
            }`}
          >
            <div className="p-3 space-y-5 flex-1">
              {/* Overview / Dashboard link */}
              <div>
                <Link
                  href="/app"
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    pathname === '/app'
                      ? 'bg-[#0f2b5c] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Beranda & Ikhtisar"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  {sidebarState === 'expanded' && <span>Beranda</span>}
                </Link>
              </div>

              {/* Navigation Groups */}
              {NAVIGATION_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  {sidebarState === 'expanded' ? (
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {group.groupName}
                    </div>
                  ) : (
                    <div className="my-2 border-t border-slate-100" />
                  )}

                  {group.items.map((item, iIdx) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={iIdx}
                        href={item.href}
                        className={`flex items-center gap-3 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-900 font-semibold border-l-2 border-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        } ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                        title={sidebarState === 'collapsed' ? `${group.groupName} - ${item.name}` : undefined}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-500'}`} />
                        {sidebarState === 'expanded' && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Sidebar bottom indicator */}
            {sidebarState === 'expanded' && (
              <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                Banyubiru &middot; Sistem Dokumen
              </div>
            )}
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE BOTTOM NAVIGATION (PRIMARY ACCESS)                     */}
      {/* ------------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around py-1.5 px-2">
        {MOBILE_PRIMARY_NAV.map((tab, idx) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={idx}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span>{tab.name}</span>
            </Link>
          );
        })}

        {/* Mobile "Semua Menu" Button to open full drawer */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-800"
        >
          <Menu className="h-4 w-4 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE SLIDE-OVER DRAWER (FULL SECONDARY MENU)                */}
      {/* ------------------------------------------------------------- */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative ml-auto w-72 max-w-[80vw] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col z-10">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#0f2b5c]">Navigasi Banyubiru</p>
                <p className="text-[10px] text-slate-500">Semua Fungsi Aplikasi</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <Link
                href="/app"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold bg-[#0f2b5c] text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Beranda & Ikhtisar</span>
              </Link>

              {NAVIGATION_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <p className="px-2 text-[10px] font-black uppercase text-slate-400">
                    {group.groupName}
                  </p>
                  {group.items.map((item, iIdx) => (
                    <Link
                      key={iIdx}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                        pathname === item.href
                          ? 'bg-blue-50 text-blue-900 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <item.icon className="h-4 w-4 text-slate-500" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 text-xs text-slate-500 text-center">
              Role: {user.roleLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
