'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { EmployeeStatus } from '@prisma/client';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

export interface EmployeeRecordDTO {
  id: string;
  tenantId: string;
  nip: string;
  nrk: string | null;
  fullName: string;
  jabatan: string;
  unitKerja: string;
  instansi: string;
  statusKepegawaian: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFilterDTO {
  search?: string;
  unitKerja?: string;
  status?: EmployeeStatus | 'ALL';
  limit?: number;
}

function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: err.message },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: err.message },
    };
  }

  if (err instanceof Error && err.message.startsWith('Validation Error:')) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    };
  }

  if (
    err instanceof Error &&
    (err.message.startsWith('SECURITY ERROR:') ||
      err.message.startsWith('SECURITY/SCHEMA ERROR:'))
  ) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Akses ditolak oleh kebijakan keamanan data.',
      },
    };
  }

  console.error('[Employee Action Internal Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan pegawai.',
    },
  };
}

export async function getEmployeesAction(
  filter?: EmployeeFilterDTO
): Promise<ActionResponse<EmployeeRecordDTO[]>> {
  try {
    let effectiveLimit = 100;

    if (filter?.limit !== undefined) {
      if (
        typeof filter.limit !== 'number' ||
        !Number.isInteger(filter.limit) ||
        filter.limit < 1 ||
        filter.limit > 200
      ) {
        throw new Error(
          'Validation Error: limit must be an integer between 1 and 200.'
        );
      }

      effectiveLimit = filter.limit;
    }

    const items = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'EMPLOYEE_READ');

      const whereClause: Record<string, unknown> = {};

      if (filter?.unitKerja) {
        whereClause.unitKerja = filter.unitKerja;
      }

      if (filter?.status && filter.status !== 'ALL') {
        whereClause.statusKepegawaian = filter.status;
      }

      if (filter?.search && filter.search.trim() !== '') {
        const term = filter.search.trim();

        whereClause.OR = [
          { fullName: { contains: term, mode: 'insensitive' } },
          { nip: { contains: term } },
          { nrk: { contains: term } },
          { jabatan: { contains: term, mode: 'insensitive' } },
        ];
      }

      const employees = await tx.employee.findMany({
        where: whereClause,
        orderBy: { fullName: 'asc' },
        take: effectiveLimit,
      });

      return employees.map((employee) => ({
        id: employee.id,
        tenantId: employee.tenantId,
        nip: employee.nip,
        nrk: employee.nrk,
        fullName: employee.fullName,
        jabatan: employee.jabatan,
        unitKerja: employee.unitKerja,
        instansi: employee.instansi,
        statusKepegawaian: employee.statusKepegawaian,
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
      }));
    });

    return {
      success: true,
      data: items,
    };
  } catch (err) {
    return handleActionError<EmployeeRecordDTO[]>(err);
  }
}
