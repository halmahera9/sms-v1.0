'use server';

import { executeInAuthenticatedContext, AuthenticationError, AuthorizationError } from '@/platform/auth';
import { AbsenceStatus, DocumentStatus, UserRole } from '@prisma/client';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';

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

export const STUDENT_EXPORT_RBAC_POLICY = {
  EXPORT: [
    UserRole.ADMIN,
    UserRole.ADMIN_TENANT,
    UserRole.OPERATOR,
    UserRole.VERIFIKATOR,
    UserRole.AUDITOR,
  ] as UserRole[],
};

import { mapAbsenceStatusToDto } from '@/domains/student/mappers';

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
 *
 * CANONICAL VERIFIED INVARIANT:
 * An AbsenceRecord is the authoritative Single Source of Truth for verified student absence
 * (as established in Aggregate Boundary C). An AbsenceRecord is legitimate for export if:
 * 1. It is directly logged by an authenticated operator/verifikator (`documentId: null`, e.g. manual absence roll call).
 * 2. OR it was promoted through Human-in-the-Loop OCR verification referencing an explicitly VERIFIED document (`document.status === DocumentStatus.VERIFIED`).
 *
 * Records referencing unverified/rejected documents (`status != DocumentStatus.VERIFIED`) and unverified OCR items
 * (`ExtractedItem` with `absenceRecordId: null`) are strictly excluded from the exported dataset.
 */
export async function getStudentAbsenceExportDataAction(
  filter?: GetStudentAbsenceExportFilterDTO
): Promise<ActionResponse<StudentAbsenceExportResultDTO>> {
  try {
    const result = await executeInAuthenticatedContext(async (context, tx) => {
      if (!STUDENT_EXPORT_RBAC_POLICY.EXPORT.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk mengekspor data ketidakhadiran siswa.`
        );
      }

      const selectedClass = filter?.selectedClass?.trim() || 'Semua';
      const tenantId = context.tenantId;

      // Build Prisma query condition
      // Enforce verified-only invariant:
      // An exportable AbsenceRecord must either be directly recorded (documentId: null)
      // or reference an explicitly VERIFIED document (document.status === DocumentStatus.VERIFIED).
      const whereCondition: Record<string, unknown> = {
        tenantId,
        OR: [
          { documentId: null },
          { document: { status: DocumentStatus.VERIFIED } },
        ],
      };

      if (selectedClass !== 'Semua') {
        whereCondition.student = {
          className: selectedClass,
        };
      }

      if (filter?.startDate || filter?.endDate) {
        const dateFilter: Record<string, Date> = {};
        if (filter.startDate) {
          const start = new Date(filter.startDate);
          if (!isNaN(start.getTime())) {
            dateFilter.gte = start;
          }
        }
        if (filter.endDate) {
          let end: Date;
          if (filter.endDate.length === 10) {
            // End of requested day inclusive for date/timestamp bounds
            end = new Date(`${filter.endDate}T23:59:59.999Z`);
          } else {
            end = new Date(filter.endDate);
          }
          if (!isNaN(end.getTime())) {
            dateFilter.lte = end;
          }
        }
        if (Object.keys(dateFilter).length > 0) {
          whereCondition.absenceDate = dateFilter;
        }
      }

      // Query absence_records (authoritative verified source)
      const records = await tx.absenceRecord.findMany({
        where: whereCondition,
        include: {
          student: true,
          document: true,
        },
        orderBy: [
          { absenceDate: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      // Get available classes for tenant
      const classRecords = await tx.student.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { className: true },
        distinct: ['className'],
        orderBy: { className: 'asc' },
      });
      const availableClasses = ['Semua', ...classRecords.map((c) => c.className).filter(Boolean)];

      const rows: StudentAbsenceExportRowDTO[] = records.map((rec, index) => {
        const dateStr = rec.absenceDate instanceof Date
          ? rec.absenceDate.toISOString().slice(0, 10)
          : String(rec.absenceDate).slice(0, 10);

        return {
          no: index + 1,
          date: dateStr,
          nisn: rec.student?.nisn || '—',
          nis: rec.student?.nis || '—',
          studentName: rec.student?.fullName || '—',
          className: rec.student?.className || '—',
          status: mapAbsenceStatusToDto(rec.status),
          notes: rec.reason || '—',
          documentReference: rec.document?.title || 'Pencatatan Langsung (Tanpa Dokumen)',
          verificationStatus: 'Terverifikasi',
        };
      });

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
