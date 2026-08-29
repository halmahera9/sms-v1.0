'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { ExceptionStatus, Severity } from '@prisma/client';
import {
  IExceptionRepository,
  PostgresExceptionRepository,
  ExceptionItemRecord,
  ExceptionFilterOptions,
} from '@/platform/repositories/exception';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

export interface ExceptionFilterDTO {
  domain?: 'EMPLOYEE' | 'STUDENT' | 'ALL';
  severity?: Severity | 'ALL';
  status?: ExceptionStatus | 'ALL';
  limit?: number;
}

export interface UpdateExceptionStatusDTO {
  exceptionId: string;
  status: ExceptionStatus;
  resolutionNote?: string;
}

export interface CreateExceptionDTO {
  id?: string;
  entityType: string;
  entityId: string;
  ruleCode: string;
  severity: Severity;
  resolutionNotes?: string;
  initialWorkflowState?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
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

  console.error('[Exception Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan pengecualian.',
    },
  };
}

/**
 * Server Action: Get Exceptions
 * Queries unified exception items for authenticated tenant under RLS.
 * Enforces EXCEPTION_READ RBAC policy.
 */
export async function getExceptionsAction(
  filter?: ExceptionFilterDTO,
  repo: IExceptionRepository = new PostgresExceptionRepository()
): Promise<ActionResponse<ExceptionItemRecord[]>> {
  try {
    // Validate filter boundaries
    let effectiveLimit = 50;
    if (filter?.limit !== undefined) {
      if (typeof filter.limit !== 'number' || !Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 200) {
        throw new Error('Validation Error: limit must be an integer between 1 and 200.');
      }
      effectiveLimit = filter.limit;
    }

    const items = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'EXCEPTION_READ');

      const repoFilter: ExceptionFilterOptions = {
        domain: filter?.domain,
        severity: filter?.severity,
        status: filter?.status,
        limit: effectiveLimit,
      };

      return await repo.findManyTx(tx, context.tenantId, repoFilter);
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(items)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Update Exception Status
 * Mutates exception status (OPEN -> IN_REVIEW -> RESOLVED / DISMISSED) and generates audit log in single transaction.
 * Enforces EXCEPTION_UPDATE RBAC policy.
 */
export async function updateExceptionStatusAction(
  dto: UpdateExceptionStatusDTO,
  repo: IExceptionRepository = new PostgresExceptionRepository()
): Promise<ActionResponse<ExceptionItemRecord>> {
  try {
    if (!dto || !dto.exceptionId || !isValidUuid(dto.exceptionId)) {
      throw new Error('Validation Error: exceptionId must be a valid UUID.');
    }

    const validStatuses = Object.values(ExceptionStatus);
    if (!dto.status || !validStatuses.includes(dto.status)) {
      throw new Error(`Validation Error: Status '${dto.status}' bukan status pengecualian yang valid.`);
    }

    if (dto.resolutionNote !== undefined && typeof dto.resolutionNote !== 'string') {
      throw new Error('Validation Error: resolutionNote must be a string.');
    }

    const updated = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'EXCEPTION_UPDATE');

      return await repo.updateStatusTx(
        tx,
        context.tenantId,
        dto.exceptionId,
        dto.status,
        context.actorId,
        dto.resolutionNote?.trim()
      );
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updated)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Create Exception
 * Atomically creates an exception item and idempotently ensures workflow instance for authenticated tenant.
 * Enforces EXCEPTION_CREATE RBAC policy.
 */
export async function createExceptionAction(
  dto: CreateExceptionDTO,
  repo: IExceptionRepository = new PostgresExceptionRepository()
): Promise<ActionResponse<ExceptionItemRecord>> {
  try {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Payload data pengecualian tidak valid.');
    }

    if (dto.id !== undefined && dto.id !== null && !isValidUuid(dto.id)) {
      throw new Error('Validation Error: id must be a valid UUID.');
    }

    if (!dto.entityId || !isValidUuid(dto.entityId)) {
      throw new Error('Validation Error: entityId must be a valid UUID.');
    }

    if (!dto.entityType || typeof dto.entityType !== 'string' || !dto.entityType.trim()) {
      throw new Error('Validation Error: entityType is required and must be a non-empty string.');
    }

    if (!dto.ruleCode || typeof dto.ruleCode !== 'string' || !dto.ruleCode.trim()) {
      throw new Error('Validation Error: ruleCode is required and must be a non-empty string.');
    }

    const validSeverities = Object.values(Severity);
    if (!dto.severity || !validSeverities.includes(dto.severity)) {
      throw new Error(`Validation Error: Severity '${dto.severity}' bukan tingkat keparahan yang valid.`);
    }

    if (dto.resolutionNotes !== undefined && dto.resolutionNotes !== null && typeof dto.resolutionNotes !== 'string') {
      throw new Error('Validation Error: resolutionNotes must be a string.');
    }

    if (
      dto.initialWorkflowState !== undefined &&
      dto.initialWorkflowState !== null &&
      typeof dto.initialWorkflowState !== 'string'
    ) {
      throw new Error('Validation Error: initialWorkflowState must be a string.');
    }

    const created = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'EXCEPTION_CREATE');

      return await repo.createTx(tx, context.tenantId, {
        id: dto.id,
        entityType: dto.entityType.trim(),
        entityId: dto.entityId,
        ruleCode: dto.ruleCode.trim(),
        severity: dto.severity,
        actorUserId: context.actorId,
        resolutionNotes: dto.resolutionNotes?.trim(),
        initialWorkflowState: dto.initialWorkflowState?.trim(),
      });
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(created)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
