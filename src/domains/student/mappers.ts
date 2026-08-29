import { AbsenceStatus as DbAbsenceStatus } from '@prisma/client';

/**
 * Maps raw or DTO string absence values to the canonical Prisma AbsenceStatus enum.
 */
export function mapToDbAbsenceStatus(val?: string | null): DbAbsenceStatus {
  if (!val) return DbAbsenceStatus.SAKIT;
  const upper = val.trim().toUpperCase();
  if (upper === 'IZIN') return DbAbsenceStatus.IZIN;
  if (upper === 'ALPHA') return DbAbsenceStatus.ALPHA;
  if (upper === 'DISPENSASI') return DbAbsenceStatus.DISPENSASI;
  return DbAbsenceStatus.SAKIT;
}

/**
 * Maps Prisma AbsenceStatus enum or string to client UI DTO absence values.
 */
export function mapToDtoAbsenceStatus(
  val?: DbAbsenceStatus | string | null
): 'Sakit' | 'Izin' | 'Alpha' | 'Hadir' {
  if (!val) return 'Sakit';
  const upper = typeof val === 'string' ? val.toUpperCase() : String(val);
  if (upper === 'IZIN') return 'Izin';
  if (upper === 'ALPHA') return 'Alpha';
  if (upper === 'HADIR') return 'Hadir';
  return 'Sakit';
}

/**
 * Maps Prisma AbsenceStatus enum to Export DTO status.
 */
export function mapAbsenceStatusToDto(
  status: DbAbsenceStatus
): 'Sakit' | 'Izin' | 'Alpha' | 'Dispensasi' {
  switch (status) {
    case DbAbsenceStatus.IZIN:
      return 'Izin';
    case DbAbsenceStatus.ALPHA:
      return 'Alpha';
    case DbAbsenceStatus.DISPENSASI:
      return 'Dispensasi';
    case DbAbsenceStatus.SAKIT:
    default:
      return 'Sakit';
  }
}
