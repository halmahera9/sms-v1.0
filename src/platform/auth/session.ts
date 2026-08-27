import { UserRole, UserStatus } from '@prisma/client';

export interface AuthenticatedActorSession {
  actorId: string;
  tenantId: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Sesi pengguna tidak valid atau telah berakhir.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface ISessionProvider {
  getSession(): Promise<AuthenticatedActorSession | null>;
}

/**
 * Default server-side session provider.
 * NOTE: When NextAuth or JWT cookie authentication is integrated,
 * this provider will extract and cryptographically verify the session token.
 * In the absence of an active verified session, it returns null (Fail-Closed).
 */
class DefaultSessionProvider implements ISessionProvider {
  public async getSession(): Promise<AuthenticatedActorSession | null> {
    // In production without a verified session cookie/token, fail-closed
    return null;
  }
}

let activeSessionProvider: ISessionProvider = new DefaultSessionProvider();

/**
 * Sets a custom or test session provider (e.g. for testing or dev harness).
 */
export function setSessionProvider(provider: ISessionProvider): void {
  activeSessionProvider = provider;
}

/**
 * Resets the session provider back to default fail-closed provider.
 */
export function resetSessionProvider(): void {
  activeSessionProvider = new DefaultSessionProvider();
}

/**
 * Resolves the authenticated actor session strictly on the server.
 * Throws AuthenticationError if no valid active session exists (Fail-Closed).
 */
export async function getAuthenticatedSession(): Promise<AuthenticatedActorSession> {
  const session = await activeSessionProvider.getSession();

  if (!session) {
    throw new AuthenticationError('Akses ditolak: Pengguna belum terotentikasi.');
  }

  if (!session.actorId || !session.tenantId) {
    throw new AuthenticationError('Akses ditolak: Identitas sesi tidak lengkap.');
  }

  if (session.status !== 'ACTIVE') {
    throw new AuthenticationError('Akses ditolak: Status akun pengguna tidak aktif.');
  }

  return session;
}
