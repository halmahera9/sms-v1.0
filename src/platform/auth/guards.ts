import { UserRole } from '@prisma/client';
import { AuthenticatedActorSession } from './session';

export class AuthorizationError extends Error {
  constructor(message: string = 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const AWARD_PROPOSAL_RBAC_POLICY: Record<string, UserRole[]> = {
  UPLOAD_DOCUMENT: ['ADMIN', 'VERIFIKATOR', 'OPERATOR'],
  VERIFY_DOCUMENT: ['ADMIN', 'VERIFIKATOR'],
  APPROVE_GENERATION: ['ADMIN', 'VERIFIKATOR'],
  MARK_GENERATED: ['ADMIN', 'VERIFIKATOR', 'OPERATOR'],
  IMPORT_PROPOSALS: ['ADMIN', 'VERIFIKATOR', 'OPERATOR'],
  SIGN_PROPOSAL: ['ADMIN', 'VERIFIKATOR'],
};

/**
 * Asserts that the authenticated actor session possesses one of the allowed roles for the action.
 * Throws AuthorizationError if forbidden.
 */
export function assertAuthorizedAction(
  session: AuthenticatedActorSession,
  actionKey: keyof typeof AWARD_PROPOSAL_RBAC_POLICY
): void {
  const allowedRoles = AWARD_PROPOSAL_RBAC_POLICY[actionKey];
  if (!allowedRoles || !allowedRoles.includes(session.role)) {
    throw new AuthorizationError(
      `Akses ditolak: Peran '${session.role}' tidak memiliki wewenang untuk aksi '${actionKey}'.`
    );
  }
}
