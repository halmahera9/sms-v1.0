import { redirect } from 'next/navigation';
import AppShell from '@/components/app/AppShell';
import { getAuthenticatedActorContext } from '@/platform/auth/session';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;

  try {
    actor = await getAuthenticatedActorContext();
  } catch {
    redirect('/login');
  }

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrator',
    ADMIN_TENANT: 'Administrator Sekolah',
    OPERATOR: 'Operator Sekolah',
    VERIFIKATOR: 'Verifikator',
    AUDITOR: 'Auditor',
  };

  const roleLabel = roleLabels[actor.role] ?? actor.role;

  return (
    <div className="flex min-h-screen bg-[#f6f9fd] text-slate-900">
      <Sidebar role={actor.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 pl-16 backdrop-blur md:px-7 md:pl-7">
          <div className="min-w-0">
            <p className="hidden text-[9px] font-bold uppercase tracking-[0.22em] text-blue-600 sm:block">
              Banyubiru Digital Solution
            </p>

            <p className="truncate text-xs font-semibold text-slate-700 sm:text-sm">
              Pusat Administrasi Sekolah
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[220px] truncate text-xs font-bold text-slate-900">
                {actor.username}
              </p>

              <p className="text-[9px] text-slate-400">
                {roleLabel}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-600 ring-1 ring-blue-100">
              {actor.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
