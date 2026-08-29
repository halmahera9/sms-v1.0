import crypto from 'crypto';
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

export interface SessionTokenClaims extends AuthenticatedActorContext {
  iat?: number;
  exp?: number;
}

const DEFAULT_SESSION_COOKIE_NAME = 'banyubiru_session';

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 *
 * @param context Authenticated actor claims to seal into the token.
 * @param secret Secret key for HMAC signing (defaults to AUTH_SECRET or SESSION_SECRET env).
 * @param expiresInSeconds Time-to-live in seconds (defaults to 86400 = 24 hours).
 */
export function createSessionToken(
  context: AuthenticatedActorContext,
  secret?: string,
  expiresInSeconds: number = 86400
): string {
  const effectiveSecret = secret || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!effectiveSecret || effectiveSecret.trim().length === 0) {
    throw new Error(
      'SECURITY ERROR: Missing required authentication secret for session token signing.'
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const claims: SessionTokenClaims = {
    ...context,
    iat,
    exp,
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', effectiveSecret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Cryptographically verifies and unseals an HMAC-SHA256 session token.
 * Validates signature timing, expiration, and actor UUID schemas.
 * Fails closed (returns null) if secret is missing or signature is invalid.
 *
 * @param token Raw session token string (payload.signature).
 * @param secret Secret key for HMAC verification (defaults to AUTH_SECRET or SESSION_SECRET env).
 * @returns Verified AuthenticatedActorContext or null if invalid/expired/unconfigured.
 */
export function verifySessionToken(
  token: string,
  secret?: string
): AuthenticatedActorContext | null {
  const effectiveSecret = secret || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!effectiveSecret || effectiveSecret.trim().length === 0) {
    // Fail-closed when no secret is configured
    return null;
  }

  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', effectiveSecret)
    .update(payloadB64)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature, 'utf-8');
  const expectedSigBuffer = Buffer.from(expectedSignature, 'utf-8');

  if (sigBuffer.length !== expectedSigBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const rawJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const claims = JSON.parse(rawJson) as SessionTokenClaims;

    // Validate expiration
    if (claims.exp && typeof claims.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > claims.exp) {
        return null;
      }
    }

    // Validate claims integrity and UUID format
    if (
      !claims.actorId ||
      !isValidUuid(claims.actorId) ||
      !claims.tenantId ||
      !isValidUuid(claims.tenantId) ||
      !claims.username ||
      !claims.role ||
      !claims.status
    ) {
      return null;
    }

    return {
      actorId: claims.actorId,
      tenantId: claims.tenantId,
      username: claims.username,
      role: claims.role,
      status: claims.status,
    };
  } catch {
    return null;
  }
}

/**
 * Cookie-based live session provider for Next.js Server Actions and SSR.
 * Extracts the session token from HTTP request cookies via `next/headers`
 * and cryptographically verifies actor identity claims (fail-closed if missing/invalid/unconfigured).
 */
export class CookieSessionProvider implements ISessionProvider {
  constructor(
    private readonly cookieName: string = process.env.SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE_NAME,
    private readonly secret?: string
  ) {}

  public async getSession(): Promise<AuthenticatedActorContext | null> {
    const effectiveSecret = this.secret || process.env.AUTH_SECRET || process.env.SESSION_SECRET;
    if (!effectiveSecret || effectiveSecret.trim().length === 0) {
      // Fail-closed when no secret is configured
      return null;
    }

    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(this.cookieName)?.value;
      if (!sessionCookie) {
        return null;
      }
      return verifySessionToken(sessionCookie, effectiveSecret);
    } catch {
      // Outside of Next.js HTTP request context (e.g. CLI or headless test) -> fail closed
      return null;
    }
  }
}

/**
 * Default server-side session provider.
 * Uses CookieSessionProvider to inspect HTTP request cookies under live Next.js execution.
 */
class DefaultSessionProvider extends CookieSessionProvider {}

let activeSessionProvider: ISessionProvider = new DefaultSessionProvider();

/**
 * Sets a custom or test session provider (e.g. for testing or dev harness).
 */
export function setSessionProvider(provider: ISessionProvider): void {
  activeSessionProvider = provider;
}

/**
 * Resets the session provider back to default live provider.
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
