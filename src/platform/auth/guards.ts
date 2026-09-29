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
  // Student Workflow domain
  STUDENT_WORKFLOW_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WORKFLOW_UPLOAD: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WORKFLOW_VERIFY: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],

  // Student Directory domain
  STUDENT_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  EMPLOYEE_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR],
  STUDENT_WRITE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR],

  // Letter Template domain (P0-D)
  LETTER_TEMPLATE_READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR, UserRole.AUDITOR],
  LETTER_TEMPLATE_WRITE: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR],

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

export const STUDENT_RBAC_POLICY = {
  READ: PLATFORM_RBAC_REGISTRY.STUDENT_READ,
  WRITE: PLATFORM_RBAC_REGISTRY.STUDENT_WRITE,
} as const;

export const STUDENT_WORKFLOW_RBAC_POLICY = {
  READ: PLATFORM_RBAC_REGISTRY.STUDENT_WORKFLOW_READ,
  UPLOAD: PLATFORM_RBAC_REGISTRY.STUDENT_WORKFLOW_UPLOAD,
  VERIFY: PLATFORM_RBAC_REGISTRY.STUDENT_WORKFLOW_VERIFY,
} as const;

export const STUDENT_EXPORT_RBAC_POLICY = {
  EXPORT: PLATFORM_RBAC_REGISTRY.STUDENT_EXPORT,
} as const;

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
