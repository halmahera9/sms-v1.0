'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
  PLATFORM_RBAC_REGISTRY,
} from '@/platform/auth';
import { StudentStatus, UserRole } from '@prisma/client';
import { PostgresStudentRepository } from '@/platform/repositories/student';
import { randomUUID } from 'crypto';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

export interface StudentRecordDTO {
  id: string;
  tenantId: string;
  nisn: string;
  nis: string;
  fullName: string;
  className: string;
  jurusan: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentFilterDTO {
  search?: string;
  className?: string;
  status?: StudentStatus | 'ALL';
  limit?: number;
}

export interface SaveStudentDTO {
  id?: string;
  nisn: string;
  nis: string;
  fullName: string;
  className: string;
  jurusan?: string | null;
  status?: StudentStatus;
}

export const STUDENT_RBAC_POLICY = {
  READ: PLATFORM_RBAC_REGISTRY.STUDENT_READ,
  WRITE: PLATFORM_RBAC_REGISTRY.STUDENT_WRITE,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NISN_REGEX = /^\d{10}$/;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Sanitizes server-side and database errors to client-safe ActionResponse structures.
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

    // Prisma Unique Constraint Violation (e.g. duplicate NISN or NIS in tenant)
    if ('code' in err && (err as { code: string }).code === 'P2002') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Data siswa dengan NISN atau NIS tersebut sudah terdaftar pada instansi ini.',
        },
      };
    }
  }

  console.error('[Student Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan data siswa.',
    },
  };
}

/**
 * Server Action: Get Students
 * Queries student master records for authenticated tenant under RLS.
 * Allowed roles: ADMIN, OPERATOR, VERIFIKATOR.
 */
export async function getStudentsAction(
  filter?: StudentFilterDTO,
  _repo: PostgresStudentRepository = new PostgresStudentRepository()
): Promise<ActionResponse<StudentRecordDTO[]>> {
  try {
    let effectiveLimit = 100;
    if (filter?.limit !== undefined) {
      if (
        typeof filter.limit !== 'number' ||
        !Number.isInteger(filter.limit) ||
        filter.limit < 1 ||
        filter.limit > 200
      ) {
        throw new Error('Validation Error: limit must be an integer between 1 and 200.');
      }
      effectiveLimit = filter.limit;
    }

    const items = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'STUDENT_READ');

      const whereClause: Record<string, unknown> = {};

      if (filter?.className) {
        whereClause.className = filter.className;
      }

      if (filter?.status && filter.status !== 'ALL') {
        whereClause.status = filter.status;
      }

      if (filter?.search && filter.search.trim() !== '') {
        const term = filter.search.trim();
        whereClause.OR = [
          { fullName: { contains: term, mode: 'insensitive' } },
          { nisn: { contains: term } },
          { nis: { contains: term } },
        ];
      }

      const students = await tx.student.findMany({
        where: whereClause,
        orderBy: { fullName: 'asc' },
        take: effectiveLimit,
      });

      return students.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        nisn: s.nisn,
        nis: s.nis,
        fullName: s.fullName,
        className: s.className,
        jurusan: s.jurusan,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));
    });

    return {
      success: true,
      data: items,
    };
  } catch (err) {
    return handleActionError<StudentRecordDTO[]>(err);
  }
}

/**
 * Server Action: Save Student (Create or Update)
 * Atomically saves a student record for authenticated tenant under RLS.
 * Allowed roles: ADMIN, OPERATOR.
 */
export async function saveStudentAction(
  dto: SaveStudentDTO,
  repo: PostgresStudentRepository = new PostgresStudentRepository()
): Promise<ActionResponse<StudentRecordDTO>> {
  try {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Payload data siswa tidak valid.');
    }

    // ID validation if provided
    let studentId = dto.id;
    if (studentId) {
      if (!isValidUuid(studentId)) {
        throw new Error('Validation Error: Format ID siswa harus berupa UUID yang valid.');
      }
    } else {
      studentId = randomUUID();
    }

    // NISN validation
    if (!dto.nisn || typeof dto.nisn !== 'string' || !NISN_REGEX.test(dto.nisn.trim())) {
      throw new Error("Validation Error: Format NISN wajib 10 digit angka (contoh: '0051234567').");
    }

    // NIS validation
    if (!dto.nis || typeof dto.nis !== 'string' || dto.nis.trim().length === 0 || dto.nis.trim().length > 20) {
      throw new Error('Validation Error: NIS wajib diisi dan maksimal 20 karakter.');
    }

    // Full name validation
    if (
      !dto.fullName ||
      typeof dto.fullName !== 'string' ||
      dto.fullName.trim().length === 0 ||
      dto.fullName.trim().length > 255
    ) {
      throw new Error('Validation Error: Nama lengkap siswa wajib diisi dan maksimal 255 karakter.');
    }

    // Class name validation
    if (
      !dto.className ||
      typeof dto.className !== 'string' ||
      dto.className.trim().length === 0 ||
      dto.className.trim().length > 50
    ) {
      throw new Error('Validation Error: Kelas siswa wajib diisi dan maksimal 50 karakter.');
    }

    // Jurusan validation (optional)
    let sanitizedJurusan: string | null = null;
    if (dto.jurusan && typeof dto.jurusan === 'string' && dto.jurusan.trim().length > 0) {
      if (dto.jurusan.trim().length > 100) {
        throw new Error('Validation Error: Jurusan maksimal 100 karakter.');
      }
      sanitizedJurusan = dto.jurusan.trim();
    }

    // Status validation
    const validStatuses: StudentStatus[] = [StudentStatus.ACTIVE, StudentStatus.GRADUATED, StudentStatus.TRANSFERRED];
    const studentStatus = dto.status && validStatuses.includes(dto.status) ? dto.status : StudentStatus.ACTIVE;

    const saved = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'STUDENT_WRITE');

      const entity = {
        id: studentId,
        tenantId: context.tenantId, // Derived strictly from server context
        nisn: dto.nisn.trim(),
        nis: dto.nis.trim(),
        fullName: dto.fullName.trim(),
        className: dto.className.trim(),
        jurusan: sanitizedJurusan,
        status: studentStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await repo.saveTx(tx, context.tenantId, entity);

      return {
        id: result.id,
        tenantId: result.tenantId,
        nisn: result.nisn,
        nis: result.nis,
        fullName: result.fullName,
        className: result.className,
        jurusan: result.jurusan,
        status: result.status,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data: saved,
    };
  } catch (err) {
    return handleActionError<StudentRecordDTO>(err);
  }
}
