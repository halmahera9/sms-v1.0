import { UserRole } from '@prisma/client';

export class AuthorizationError extends Error {
  constructor(message: string = 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Canonical Platform RBAC Policy Registry (Resolves GAP-07 and GAP-04)
 * Maps every Server Action permission key to authorized UserRole values.
 */
export const PLATFORM_RBAC_REGISTRY = {
  // Employee Award domain
  UPLOAD_DOCUMENT: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR],
  VERIFY_DOCUMENT: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR],
  APPROVE_GENERATION: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR],
  MARK_GENERATED: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR],
  IMPORT_PROPOSALS: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR],
  SIGN_PROPOSAL: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR],
  SEND_PROPOSAL: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR],
  ARCHIVE_COMPLETE_PROPOSAL: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR],
  READ_PROPOSALS: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR, UserRole.AUDITOR],

  // Student Workflow domain
  STUDENT_WORKFLOW_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WORKFLOW_UPLOAD: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WORKFLOW_VERIFY: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],

  // Student Directory domain
  STUDENT_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WRITE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR],

  // Student Export domain
  STUDENT_EXPORT: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR, UserRole.AUDITOR],

  // Exception Center domain
  EXCEPTION_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.AUDITOR],
  EXCEPTION_UPDATE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR],
  EXCEPTION_CREATE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR],

  // Operational Metrics & Dashboard
  OPERATIONAL_METRICS_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR, UserRole.AUDITOR],
  OPERATIONAL_WORK_QUEUE_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.VERIFIKATOR, UserRole.OPERATOR, UserRole.AUDITOR],

  // Audit Trail domain (GAP-04)
  AUDIT_EVENT_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.AUDITOR, UserRole.VERIFIKATOR],

  // Public Document Upload Invitation domain (Phase 5A)
  PUBLIC_INVITATION_CREATE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  PUBLIC_INVITATION_REVOKE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  PUBLIC_INVITATION_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR, UserRole.AUDITOR],
} as const satisfies Record<string, readonly UserRole[]>;

export type ActionPermission = keyof typeof PLATFORM_RBAC_REGISTRY;

// Backward-compatible alias for existing imports
export const AWARD_PROPOSAL_RBAC_POLICY = PLATFORM_RBAC_REGISTRY;

/**
 * Asserts that the authenticated actor session possesses one of the allowed roles for the action.
 * Throws AuthorizationError if forbidden.
 */
export function assertAuthorizedAction(
  session: { role: UserRole | string },
  actionKey: ActionPermission
): void {
  const allowedRoles: readonly string[] = PLATFORM_RBAC_REGISTRY[actionKey];
  if (!allowedRoles || !allowedRoles.includes(session.role)) {
    throw new AuthorizationError(
      `Akses ditolak: Peran '${session.role}' tidak memiliki wewenang untuk aksi '${actionKey}'.`
    );
  }
}
