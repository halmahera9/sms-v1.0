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
  LogOut,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { name: 'Overview', href: '/app', icon: LayoutDashboard },
  { name: 'Master Data Siswa', href: '/app/students', icon: Users },
  { name: 'Master Data Guru/Pegawai', href: '/app/employees', icon: Users },
  { name: 'Upload & OCR', href: '/app/ocr', icon: ScanText },
  { name: 'Verifikasi Operator', href: '/app/verify', icon: CheckSquare },
  { name: 'Ekspor Excel & PDF', href: '/app/export', icon: FileSpreadsheet },
  { name: 'Audit Trail', href: '/app/audit', icon: ShieldAlert },
];

function SidebarContent({
  pathname,
  onNavigate,
  role,
}: {
  pathname: string;
  onNavigate?: () => void;
  role: string;
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <div className="font-black text-sm text-white leading-none">
              BANYUBIRU
            </div>
            <div className="text-[10px] text-slate-300 mt-1">
              Administrative Intelligence
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
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
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? 'text-slate-900' : 'text-slate-200'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-600">
            Akses
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-200">
            {role}
          </p>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#0b2a63] border-r border-white/10 flex-col h-screen sticky top-0">
        <SidebarContent pathname={pathname} role={role} />
      </aside>

      {/* Mobile Menu Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0b2a63] text-slate-200 shadow-lg"
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
        className={`md:hidden fixed inset-y-0 left-0 z-[60] flex w-72 max-w-[85vw] flex-col bg-[#0b2a63] border-r border-white/10 shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/5 hover:text-white"
          aria-label="Tutup navigasi"
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent
          pathname={pathname}
          role={role}
          onNavigate={() => setIsOpen(false)}
        />
      </aside>
    </>
  );
}
