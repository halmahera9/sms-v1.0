'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import {
  IAuditEventRepository,
  PostgresAuditEventRepository,
  AuditEventRecord,
} from '@/platform/repositories/audit-event';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

/**
 * Sanitizes server-side and database errors to client-safe ActionResponse structures.
 * Internal database errors, RLS implementation details, and raw stack traces are masked.
 */
function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: err.message,
      },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message,
      },
    };
  }

  if (err instanceof Error) {
    if (err.message.startsWith('Validation Error:')) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }

    if (err.message.startsWith('SECURITY ERROR:') || err.message.startsWith('SECURITY/SCHEMA ERROR:')) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak oleh kebijakan keamanan data.',
        },
      };
    }
  }

  console.error('[Audit Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem jejak audit.',
    },
  };
}

/**
 * Server Action: Get Recent Audit Events
 * Resolves authenticated identity server-side, verifies explicit RBAC policy (AUDIT_EVENT_READ),
 * and queries immutable audit trail records under RLS.
 * Takes ZERO identity parameters from client; validates limit boundaries server-side.
 */
export async function getRecentAuditEventsAction(
  limit?: number,
  repo: IAuditEventRepository = new PostgresAuditEventRepository()
): Promise<ActionResponse<AuditEventRecord[]>> {
  try {
    // Validate limit parameter boundaries
    let effectiveLimit = 50;
    if (limit !== undefined) {
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new Error('Validation Error: limit must be an integer between 1 and 200.');
      }
      effectiveLimit = limit;
    }

    const events = await executeInAuthenticatedContext(async (context, tx) => {
      // GAP-04 Security Guard: Explicit RBAC assertion for audit trail read access
      assertAuthorizedAction(context, 'AUDIT_EVENT_READ');
      return await repo.findRecentTx(tx, context.tenantId, effectiveLimit);
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(events)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
