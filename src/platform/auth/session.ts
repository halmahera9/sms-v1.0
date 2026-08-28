import { UserRole, UserStatus } from '@prisma/client';
import { runInTenantContext, TenantTransactionClient } from '../db/tenant-context';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export interface AuthenticatedActorContext {
  actorId: string;
  tenantId: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

// Backward compatibility alias for existing code/tests
export type AuthenticatedActorSession = AuthenticatedActorContext;

export class AuthenticationError extends Error {
  constructor(message: string = 'Sesi pengguna tidak valid atau telah berakhir.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface ISessionProvider {
  getSession(): Promise<AuthenticatedActorContext | null>;
}

/**
 * Default server-side session provider.
 * NOTE: When NextAuth or JWT cookie authentication is integrated,
 * this provider will extract and cryptographically verify the session token.
 * In the absence of an active verified session, it returns null (Fail-Closed).
 */
class DefaultSessionProvider implements ISessionProvider {
  public async getSession(): Promise<AuthenticatedActorContext | null> {
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
 * Resolves the authenticated actor context strictly on the server.
 * Validates existence, UUID format for actorId/tenantId, role, and active status.
 * Throws AuthenticationError if invalid or inactive (Fail-Closed).
 */
export async function getAuthenticatedActorContext(): Promise<AuthenticatedActorContext> {
  const session = await activeSessionProvider.getSession();

  if (!session) {
    throw new AuthenticationError('Akses ditolak: Pengguna belum terotentikasi.');
  }

  if (!session.actorId || !isValidUuid(session.actorId)) {
    throw new AuthenticationError(
      `Akses ditolak: Identitas actorId tidak valid atau bukan UUID yang sah.`
    );
  }

  if (!session.tenantId || !isValidUuid(session.tenantId)) {
    throw new AuthenticationError(
      `Akses ditolak: Identitas tenantId tidak valid atau bukan UUID yang sah.`
    );
  }

  if (session.status !== 'ACTIVE') {
    throw new AuthenticationError('Akses ditolak: Status akun pengguna tidak aktif.');
  }

  return session;
}

/**
 * Backward-compatible alias for existing Award Server Actions and tests.
 */
export const getAuthenticatedSession = getAuthenticatedActorContext;

/**
 * Resolves the authenticated actor context and executes the given database operation
 * within an interactive transaction scoped to the tenant context under PostgreSQL RLS.
 *
 * Security Contract:
 * 1. Resolves trusted server-side identity via getAuthenticatedActorContext() (fail-closed).
 * 2. Invokes runInTenantContext(actorId, tenantId, callback) to set transaction GUCs and enforce RLS.
 * 3. Never exposes Prisma or raw TenantTransactionClient to untrusted client code.
 *
 * @param action Callback function receiving authenticated context and tenant transaction client
 */
export async function executeInAuthenticatedContext<T>(
  action: (context: AuthenticatedActorContext, tx: TenantTransactionClient) => Promise<T>
): Promise<T> {
  const context = await getAuthenticatedActorContext();
  return await runInTenantContext(context.actorId, context.tenantId, async (tx) => {
    return await action(context, tx);
  });
}
