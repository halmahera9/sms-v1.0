'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserRound,
  FileText,
  CircleCheck,
  Download,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

import { logoutAction } from '@/platform/actions/auth';

type NavItemType = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const workspaceItems: NavItemType[] = [
  {
    name: 'Beranda',
    href: '/app',
    icon: LayoutDashboard,
  },
];

const schoolDataItems: NavItemType[] = [];

const employeeSubItems: NavItemType[] = [
  {
    name: 'Guru',
    href: '/app/employees?type=guru',
    icon: UserRound,
  },
  {
    name: 'Karyawan',
    href: '/app/employees?type=karyawan',
    icon: UserRound,
  },
]; 

const studentSubItems: NavItemType[] = [
  {
    name: 'Master Data Siswa',
    href: '/app/students',
    icon: Users,
  },
  {
    name: 'Dokumen & OCR',
    href: '/app/ocr',
    icon: FileText,
  },
  {
    name: 'Verifikasi Data',
    href: '/app/verify',
    icon: CircleCheck,
  },
  {
    name: 'Kehadiran',
    href: '/app/students',
    icon: CircleCheck,
  },
  {
    name: 'Ekspor & Rekap',
    href: '/app/export',
    icon: Download,
  },
];

const documentItems: NavItemType[] = [
  {
    name: 'Dokumen',
    href: '/app/ocr',
    icon: FileText,
  },
  {
    name: 'Verifikasi',
    href: '/app/verify',
    icon: CircleCheck,
  },
  {
    name: 'Ekspor Data',
    href: '/app/export',
    icon: Download,
  },
];

const activityItems: NavItemType[] = [
  {
    name: 'Riwayat Aktivitas',
    href: '/app/audit',
    icon: History,
  },
];

function isItemActive(pathname: string, href: string) {
  if (href === '/app') {
    return pathname === '/app';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isStudentSubItemActive(pathname: string, item: NavItemType) {
  if (item.name === 'Master Data Siswa') {
    return pathname === '/app/students';
  }

  if (item.name === 'Dokumen & OCR') {
    return pathname === '/app/ocr';
  }

  if (item.name === 'Verifikasi Data') {
    return pathname === '/app/verify';
  }

  if (item.name === 'Kehadiran') {
    return false;
  }

  if (item.name === 'Ekspor & Rekap') {
    return pathname === '/app/export';
  }

  return false;
}

function isDocumentItemActive(pathname: string, item: NavItemType) {
  if (item.name === 'Dokumen') {
    return false;
  }

  if (item.name === 'Verifikasi') {
    return false;
  }

  if (item.name === 'Ekspor Data') {
    return false;
  }

  return isItemActive(pathname, item.href);
}

function Section({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div
        className="mx-3 my-3 h-px bg-white/10"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="px-3 pb-2 pt-5">
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-blue-200/45">
        {label}
      </p>
    </div>
  );
}

function NavItem({
  item,
  pathname,
  collapsed,
  onNavigate,
  activeOverride,
}: {
  item: NavItemType;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  activeOverride?: boolean;
}) {
  const active = activeOverride ?? isItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.name : undefined}
      className={[
        'group flex items-center rounded-xl text-xs font-semibold transition-all duration-150',
        collapsed
          ? 'mx-auto h-10 w-10 justify-center'
          : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-white text-[#12336f] shadow-sm'
          : 'text-blue-100/80 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0 transition-colors',
          active
            ? 'text-blue-600'
            : 'text-blue-100/70 group-hover:text-white',
        ].join(' ')}
      />

      {!collapsed && (
        <span className="truncate">
          {item.name}
        </span>
      )}
    </Link>
  );
}

function StudentNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const studentActive = pathname.startsWith('/app/students');
  const [open, setOpen] = useState(studentActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={[
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
          'text-xs font-semibold transition-all duration-150',
          studentActive
            ? 'bg-white text-[#12336f] shadow-sm'
            : 'text-blue-100/80 hover:bg-white/10 hover:text-white',
        ].join(' ')}
      >
        <Users
          className={[
            'h-4 w-4 shrink-0',
            studentActive ? 'text-blue-600' : 'text-blue-100/70',
          ].join(' ')}
        />

        <span className="flex-1 text-left">
          Siswa
        </span>

        <ChevronDown
          className={[
            'h-4 w-4 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {studentSubItems.map((item) => {
            const active = isStudentSubItemActive(pathname, item);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2',
                  'text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-blue-100/65 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'h-3.5 w-3.5 shrink-0',
                    active ? 'text-blue-300' : 'text-blue-100/50',
                  ].join(' ')}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmployeeNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const employeeActive = pathname.startsWith('/app/employees');
  const [employeeType, setEmployeeType] = useState<'guru' | 'karyawan'>('guru');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const type = new URLSearchParams(window.location.search).get('type');
    if (type === 'karyawan') setEmployeeType('karyawan');
    else setEmployeeType('guru');
  }, [pathname]);
  const [open, setOpen] = useState(employeeActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={[
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
          'text-xs font-semibold transition-all duration-150',
          employeeActive
            ? 'bg-white text-[#12336f] shadow-sm'
            : 'text-blue-100/80 hover:bg-white/10 hover:text-white',
        ].join(' ')}
      >
        <UserRound
          className={[
            'h-4 w-4 shrink-0',
            employeeActive ? 'text-blue-600' : 'text-blue-100/70',
          ].join(' ')}
        />

        <span className="flex-1 text-left">
          Guru & Karyawan
        </span>

        <ChevronDown
          className={[
            'h-4 w-4 transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {employeeSubItems.map((item) => {
            const active =
              item.name === 'Guru'
                ? employeeType === 'guru'
                : employeeType === 'karyawan';

            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2',
                  'text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-blue-100/65 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'h-3.5 w-3.5 shrink-0',
                    active ? 'text-blue-300' : 'text-blue-100/50',
                  ].join(' ')}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  pathname,
  role,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  role: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isAdmin =
    role === 'ADMIN' ||
    role === 'ADMIN_TENANT';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* =========================================================
          BRAND
          Menggunakan asset logo yang sama dengan halaman login.
          ========================================================= */}
      <div
        className={[
          'border-b border-white/10',
          collapsed ? 'px-3 py-5' : 'px-5 py-5',
        ].join(' ')}
      >
        <Link
          href="/app"
          onClick={onNavigate}
          title={collapsed ? 'Banyubiru' : undefined}
          className={[
            'flex items-center',
            collapsed ? 'justify-center' : 'gap-3',
          ].join(' ')}
        >
          <img
            src="/brand/banyubiru-icon.png?v=2"
            alt="Banyubiru"
            className="h-9 w-9 shrink-0 object-contain"
          />

          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-none tracking-[-0.02em] text-white">
                Banyubiru
              </div>

              <div className="mt-1 text-[8px] font-medium uppercase tracking-[0.18em] text-blue-200/60">
                Digital Solution
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* =========================================================
          NAVIGATION
          ========================================================= */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <Section
          label="Ruang Kerja"
          collapsed={collapsed}
        />

        <div className="space-y-1">
          {workspaceItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <Section
          label="Data Sekolah"
          collapsed={collapsed}
        />

        <div className="space-y-1">
          {/* Siswa parent */}
          {collapsed ? (
            <NavItem
              item={{
                name: 'Siswa',
                href: '/app/students',
                icon: Users,
              }}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ) : (
            <StudentNavigation
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )}

          {collapsed ? (
            <NavItem
              item={{
                name: 'Guru & Karyawan',
                href: '/app/employees',
                icon: UserRound,
              }}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ) : (
            <EmployeeNavigation
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )}
        </div>

        <Section
          label="Dokumen"
          collapsed={collapsed}
        />

        <div className="space-y-1">
          {documentItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              activeOverride={false}
            />
          ))}
        </div>

        <Section
          label="Aktivitas"
          collapsed={collapsed}
        />

        <div className="space-y-1">
          {activityItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* =======================================================
            ADMIN
            ======================================================= */}
        {isAdmin && (
          <>
            <Section
              label="Pengaturan"
              collapsed={collapsed}
            />

            <div className="space-y-1">
              <NavItem
                item={{
                  name: 'Pengguna & Akses',
                  href: '/app/users',
                  icon: Settings,
                }}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </div>
          </>
        )}
      </nav>

      {/* =========================================================
          BOTTOM AREA
          ========================================================= */}
      <div
        className={[
          'border-t border-white/10',
          collapsed ? 'p-3' : 'p-4',
        ].join(' ')}
      >
        {!collapsed && (
          <div className="mb-3 rounded-xl bg-white/5 px-3 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200/45">
              Akses
            </p>

            <p className="mt-1 truncate text-xs font-semibold text-white">
              {role}
            </p>
          </div>
        )}

        {/* =======================================================
            LOGOUT
            Menggunakan server action yang benar-benar
            menghapus session cookie.
            ======================================================= */}
        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? 'Keluar' : undefined}
            onClick={onNavigate}
            className={[
              'flex w-full items-center rounded-xl text-xs font-semibold text-blue-100/80 transition',
              'hover:bg-white/10 hover:text-white',
              collapsed
                ? 'mx-auto h-10 w-10 justify-center'
                : 'gap-3 px-3 py-2.5',
            ].join(' ')}
          >
            <LogOut className="h-4 w-4 shrink-0" />

            {!collapsed && (
              <span>Keluar</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({
  role,
}: {
  role: string;
}) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* =========================================================
          DESKTOP SIDEBAR
          ========================================================= */}
      <aside
        className={[
          'sticky top-0 hidden h-screen shrink-0 flex-col',
          'border-r border-white/10 bg-[#0b2a63]',
          'transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        ].join(' ')}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <SidebarContent
            pathname={pathname}
            collapsed={collapsed}
            role={role}
          />

          {/* Collapse / Expand */}
          <button
            type="button"
            onClick={() =>
              setCollapsed((value) => !value)
            }
            aria-label={
              collapsed
                ? 'Tampilkan sidebar'
                : 'Sembunyikan sidebar'
            }
            className={[
              'absolute -right-3 top-20 z-50',
              'flex h-7 w-7 items-center justify-center',
              'rounded-full border border-slate-200',
              'bg-white text-slate-600 shadow-sm',
              'transition hover:text-blue-600',
            ].join(' ')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* =========================================================
          MOBILE
          ========================================================= */}

      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Buka navigasi"
          className={[
            'fixed left-3 top-3 z-50 md:hidden',
            'flex h-10 w-10 items-center justify-center',
            'rounded-xl border border-blue-900/20',
            'bg-[#0b2a63] text-white shadow-lg',
            'transition hover:bg-[#123a80]',
          ].join(' ')}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-[70]',
          'flex w-72 max-w-[86vw] flex-col',
          'border-r border-white/10 bg-[#0b2a63]',
          'shadow-2xl transition-transform duration-300 ease-out',
          'md:hidden',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full',
        ].join(' ')}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup navigasi"
            className={[
              'absolute right-3 top-4 z-10',
              'flex h-8 w-8 items-center justify-center',
              'rounded-lg text-blue-100/70',
              'transition hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <X className="h-5 w-5" />
          </button>

          <SidebarContent
            pathname={pathname}
            collapsed={false}
            role={role}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </aside>
    </>
  );
}
