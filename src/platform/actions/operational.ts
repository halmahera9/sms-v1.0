'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import {
  IOperationalQueryRepository,
  PostgresOperationalQueryRepository,
  OperationalMetrics,
  WorkQueueItem,
} from '@/platform/repositories/operational-query';
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

    if (err.message.startsWith('SECURITY ERROR:')) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak oleh kebijakan keamanan data.',
        },
      };
    }
  }

  console.error('[Operational Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem operasional.',
    },
  };
}

/**
 * Server Action: Get Operational Metrics
 * Resolves authenticated identity server-side, verifies OPERATIONAL_METRICS_READ RBAC policy,
 * and aggregates real-time operational metrics under RLS.
 * Takes ZERO identity parameters from client.
 */
export async function getOperationalMetricsAction(
  repo: IOperationalQueryRepository = new PostgresOperationalQueryRepository()
): Promise<ActionResponse<OperationalMetrics>> {
  try {
    const metrics = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'OPERATIONAL_METRICS_READ');
      return await repo.getAggregatedMetricsTx(tx, context.tenantId);
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(metrics)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Get Unified Work Queue Items
 * Resolves authenticated identity server-side, verifies OPERATIONAL_WORK_QUEUE_READ RBAC policy,
 * and projects actionable work items under RLS.
 * Takes ZERO identity parameters from client; validates limit boundaries server-side.
 */
export async function getUnifiedWorkQueueAction(
  limit?: number,
  repo: IOperationalQueryRepository = new PostgresOperationalQueryRepository()
): Promise<ActionResponse<WorkQueueItem[]>> {
  try {
    // Validate limit parameter boundaries
    let effectiveLimit = 50;
    if (limit !== undefined) {
      if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new Error('Validation Error: limit must be an integer between 1 and 200.');
      }
      effectiveLimit = limit;
    }

    const items = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'OPERATIONAL_WORK_QUEUE_READ');
      return await repo.getUnifiedWorkQueueItemsTx(tx, context.tenantId, effectiveLimit);
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
