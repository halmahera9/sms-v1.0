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
    <AppShell
      user={{
        username: actor.username,
        role: actor.role,
        roleLabel,
      }}
    >
      {children}
    </AppShell>
  );
}
