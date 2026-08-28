'use server';

import { executeInAuthenticatedContext, AuthenticationError, AuthorizationError } from '@/platform/auth';
import { ExceptionStatus, Severity, UserRole } from '@prisma/client';
import {
  IExceptionRepository,
  PostgresExceptionRepository,
  ExceptionItemRecord,
  ExceptionFilterOptions,
} from '@/platform/repositories/exception';

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
 * Allowed roles: ADMIN, VERIFIKATOR, OPERATOR.
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
      // RBAC check
      const allowedRoles: string[] = ['ADMIN', 'ADMIN_TENANT', 'VERIFIKATOR', 'OPERATOR', 'AUDITOR'];
      if (!allowedRoles.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk membaca data pengecualian.`
        );
      }

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
 * Allowed roles: ADMIN, ADMIN_TENANT, VERIFIKATOR.
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
      // RBAC check
      const allowedRoles: string[] = ['ADMIN', 'ADMIN_TENANT', 'VERIFIKATOR'];
      if (!allowedRoles.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk mengubah status pengecualian.`
        );
      }

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
