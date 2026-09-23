import type {
  ExtractedEntity,
  IdentityResolutionOutcome,
} from '@/platform/types/document-intelligence';
import type { TenantTransactionClient } from '@/platform/db/tenant-context';

export async function matchDocumentEntity(
  tx: TenantTransactionClient,
  tenantId: string,
  entity: ExtractedEntity,
): Promise<IdentityResolutionOutcome> {
  const value = entity.normalizedValue?.trim() || entity.rawValue.trim();

  if (!value) {
    return {
      status: 'UNRESOLVED',
      confidence: 0,
      matchMethod: 'EXACT',
      resolutionNotes: 'Entity value kosong.',
    };
  }

  if (entity.identifierType === 'NIP') {
    const employee = await tx.employee.findFirst({
      where: { tenantId, nip: value },
    });

    if (employee) {
      return {
        status: 'RESOLVED',
        matchedEntityId: employee.id,
        matchedEntityType: 'Employee',
        confidence: entity.confidence,
        matchMethod: 'EXACT',
        resolutionNotes: `Matched Employee by NIP '${value}'.`,
      };
    }
  }

  if (entity.identifierType === 'NRK') {
    const employee = await tx.employee.findFirst({
      where: { tenantId, nrk: value },
    });

    if (employee) {
      return {
        status: 'RESOLVED',
        matchedEntityId: employee.id,
        matchedEntityType: 'Employee',
        confidence: entity.confidence,
        matchMethod: 'EXACT',
        resolutionNotes: `Matched Employee by NRK '${value}'.`,
      };
    }
  }

  if (entity.identifierType === 'NISN') {
    const student = await tx.student.findFirst({
      where: { tenantId, nisn: value },
    });

    if (student) {
      return {
        status: 'RESOLVED',
        matchedEntityId: student.id,
        matchedEntityType: 'Student',
        confidence: entity.confidence,
        matchMethod: 'EXACT',
        resolutionNotes: `Matched Student by NISN '${value}'.`,
      };
    }
  }

  if (entity.identifierType === 'NIS') {
    const student = await tx.student.findFirst({
      where: { tenantId, nis: value },
    });

    if (student) {
      return {
        status: 'RESOLVED',
        matchedEntityId: student.id,
        matchedEntityType: 'Student',
        confidence: entity.confidence,
        matchMethod: 'EXACT',
        resolutionNotes: `Matched Student by NIS '${value}'.`,
      };
    }
  }

  return {
    status: 'UNRESOLVED',
    confidence: 0,
    matchMethod: 'EXACT',
    resolutionNotes: `Tidak ditemukan pada Master Data untuk ${entity.identifierType || entity.entityType}: '${value}'.`,
  };
}
