'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { DocumentStatus, UserRole } from '@prisma/client';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

export interface StudentAbsenceExportRowDTO {
  no: number;
  date: string;
  nisn: string;
  nis: string;
  studentName: string;
  className: string;
  status: 'Sakit' | 'Izin' | 'Alpha' | 'Dispensasi';
  notes: string;
  documentReference: string;
  verificationStatus: 'Terverifikasi' | 'Belum Verifikasi';
}

export interface GetStudentAbsenceExportFilterDTO {
  selectedClass?: string;
  startDate?: string;
  endDate?: string;
}

export interface StudentAbsenceExportResultDTO {
  rows: StudentAbsenceExportRowDTO[];
  filename: string;
  totalCount: number;
  availableClasses: string[];
}

const auditRepo = new PostgresAuditEventRepository();

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

  console.error('[Student Export Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal saat mengambil data rekap ketidakhadiran siswa.',
    },
  };
}

/**
 * Server Action: Get Student Absence Export Data
 * Legacy Student Absence Export Data.
 * Returns empty dataset as AbsenceRecord domain has been removed in Banyubiru Document Intelligence.
 */
export async function getStudentAbsenceExportDataAction(
  filter?: GetStudentAbsenceExportFilterDTO
): Promise<ActionResponse<StudentAbsenceExportResultDTO>> {
  try {
    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // Canonical RBAC assertion
      assertAuthorizedAction(context, 'STUDENT_EXPORT');

      const selectedClass = filter?.selectedClass?.trim() || 'Semua';
      const tenantId = context.tenantId;

      // AbsenceRecord domain is removed; return empty export dataset
      const rows: StudentAbsenceExportRowDTO[] = [];

      // Get available classes for tenant
      const classRecords = await tx.student.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { className: true },
        distinct: ['className'],
        orderBy: { className: 'asc' },
      });
      const availableClasses = ['Semua', ...classRecords.map((c) => c.className).filter(Boolean)];

      const dateSuffix = new Date().toISOString().slice(0, 10);
      const filename = `Rekap_SMS_Ketidakhadiran_${dateSuffix}.xlsx`;

      // Record immutable AuditEvent in PostgreSQL under tenant aggregate scope
      await auditRepo.recordTx(tx, tenantId, {
        actorUserId: context.actorId,
        action: 'EXPORT_ABSENCE_DATA',
        entityType: 'Tenant',
        entityId: tenantId,
        metadata: {
          targetScope: 'STUDENT_ABSENCE_EXPORT',
          selectedClass,
          rowCount: rows.length,
          filename,
          ...(filter?.startDate ? { startDate: filter.startDate } : {}),
          ...(filter?.endDate ? { endDate: filter.endDate } : {}),
        },
      });

      return {
        rows,
        filename,
        totalCount: rows.length,
        availableClasses,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<StudentAbsenceExportResultDTO>(err);
  }
}
