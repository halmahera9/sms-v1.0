'use server';

import { executeInAuthenticatedContext, AuthenticationError, AuthorizationError } from '@/platform/auth';
import {
  IAuditEventRepository,
  PostgresAuditEventRepository,
  AuditEventRecord,
} from '@/platform/repositories/audit-event';

export type ActionErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DOMAIN_ERROR'
  | 'INTERNAL_ERROR';

export interface ActionError {
  code: ActionErrorCode;
  message: string;
}

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: ActionError;
}

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
 * Resolves authenticated identity server-side and queries immutable audit trail records under RLS.
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
