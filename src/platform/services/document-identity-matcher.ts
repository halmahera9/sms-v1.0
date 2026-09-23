import type {
  ExtractedEntity,
  IdentityResolutionOutcome,
} from '@/platform/types/document-intelligence';
import type { TenantTransactionClient } from '@/platform/db/tenant-context';

function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\b(S\.PD|S\.KOM|S\.SI|S\.SOS|S\.TP|S\.AG|S\.IP|M\.PD|M\.SI|DR|DRS|HJ|H)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  // Name fallback only after identifier matching fails.
  if (entity.entityType === 'STUDENT' || entity.entityType === 'EMPLOYEE') {
    const normalizedName = normalizeName(value);

    if (normalizedName) {
      const candidates =
        entity.entityType === 'STUDENT'
          ? await tx.student.findMany({
              where: { tenantId },
              select: { id: true, fullName: true, nisn: true },
            })
          : await tx.employee.findMany({
              where: { tenantId },
              select: { id: true, fullName: true, nip: true },
            });

      const matches = candidates.filter(
        (candidate) => normalizeName(candidate.fullName) === normalizedName,
      );

      if (matches.length === 1) {
        const candidate = matches[0];

        return {
          status: 'RESOLVED',
          matchedEntityId: candidate.id,
          matchedEntityType:
            entity.entityType === 'STUDENT' ? 'Student' : 'Employee',
          confidence: Math.round(entity.confidence * 0.85),
          matchMethod: 'FUZZY',
          resolutionNotes: `Matched by normalized full name: '${candidate.fullName}'.`,
        };
      }

      if (matches.length > 1) {
        return {
          status: 'AMBIGUOUS',
          confidence: 40,
          matchMethod: 'FUZZY',
          candidateMatches: matches.map((candidate) => {
            const identifier =
              entity.entityType === 'STUDENT'
                ? (candidate as { nisn: string }).nisn
                : (candidate as { nip: string }).nip;

            return {
              entityId: candidate.id,
              entityType:
                entity.entityType === 'STUDENT' ? 'Student' : 'Employee',
              label: `${candidate.fullName} (${identifier})`,
              confidence: 40,
            };
          }),
          resolutionNotes: `Ambiguous normalized name match: '${value}'.`,
        };
      }
    }
  }

  return {
    status: 'UNRESOLVED',
    confidence: 0,
    matchMethod: 'EXACT',
    resolutionNotes: `Tidak ditemukan pada Master Data untuk ${entity.identifierType || entity.entityType}: '${value}'.`,
  };
}
