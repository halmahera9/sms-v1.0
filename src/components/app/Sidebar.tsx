'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ScanText,
  CheckSquare,
  FileSpreadsheet,
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { name: 'Overview', href: '/app', icon: LayoutDashboard },
  { name: 'Master Data Siswa', href: '/app/students', icon: Users },
  { name: 'Upload & OCR', href: '/app/ocr', icon: ScanText },
  { name: 'Verifikasi Operator', href: '/app/verify', icon: CheckSquare },
  { name: 'Ekspor Excel & PDF', href: '/app/export', icon: FileSpreadsheet },
  { name: 'Audit Trail', href: '/app/audit', icon: ShieldAlert },
];

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-white/10">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <div className="font-bold text-sm text-white leading-none">
              BANYUBIRU
            </div>
            <div className="text-[10px] font-mono text-sky-400 mt-0.5">
              SMS APP v1.0
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-300">
          Menu Utama
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? 'text-sky-400' : 'text-slate-300'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded border border-white/10 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Landing Page</span>
        </Link>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-900/90 border-r border-white/10 flex-col h-screen sticky top-0">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile Menu Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-200 shadow-lg"
        aria-label="Buka navigasi"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[85vw] flex-col bg-slate-900 border-r border-white/10 shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Tutup navigasi"
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent
          pathname={pathname}
          onNavigate={() => setIsOpen(false)}
        />
      </aside>
    </>
  );
}
