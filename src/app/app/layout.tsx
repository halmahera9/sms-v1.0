import { redirect } from 'next/navigation';
import Sidebar from '@/components/app/Sidebar';
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
    OPERATOR: 'Operator',
    VERIFIKATOR: 'Verifikator',
    AUDITOR: 'Auditor',
  };

  const roleLabel = roleLabels[actor.role] ?? actor.role;

  return (
    <div className="min-h-screen bg-[#f6f9fd] text-slate-900 flex">
      <Sidebar role={actor.role} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur px-4 pl-16 md:px-7 flex items-center justify-between sticky top-0 z-40">
          <div className="min-w-0">
            <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 sm:block">
              Banyubiru Digital Solution
            </p>
            <p className="truncate text-sm font-semibold text-slate-700">
              Pusat Administrasi Sekolah
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-slate-900">
                {actor.username}
              </p>
              <p className="text-[10px] text-slate-600">{roleLabel}</p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700 ring-1 ring-blue-100">
              {actor.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
