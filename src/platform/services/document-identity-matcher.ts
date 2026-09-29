import 'server-only';
import crypto from 'crypto';
import { MatchingStatus, Prisma } from '@prisma/client';
import { TenantTransactionClient } from '@/platform/db/tenant-context';
import { PostgresStudentRepository, normalizeIdentifierName } from '@/platform/repositories/student';
import { PostgresEmployeeRepository, normalizeEmployeeName } from '@/platform/repositories/employee';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';

// ---------------------------------------------------------------------------
// Audit action constants
// ---------------------------------------------------------------------------
export const AUDIT_ACTION = {
  MATCHING_STARTED: 'MATCHING_STARTED',
  MATCHING_COMPLETED: 'MATCHING_COMPLETED',
  MATCHING_FAILED: 'MATCHING_FAILED',
  MATCHING_REUSED: 'MATCHING_REUSED',
} as const;

// ---------------------------------------------------------------------------
// Entity type constants — matches MatchingResult.entityType column
// ---------------------------------------------------------------------------
export const ENTITY_TYPE = {
  STUDENT: 'STUDENT',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

// ---------------------------------------------------------------------------
// Deterministic candidate score constants
// Rule (documented): higher score = stronger match
//   SCORE_EXACT_IDENTIFIER: 100 — matched by unique identifier (NISN/NIS/NIP/NIK)
//   SCORE_EXACT_NAME:        60 — matched by exact normalized full name (single result)
//   Ambiguous name:          no score on result; individual candidates still scored 60
// ---------------------------------------------------------------------------
const SCORE_EXACT_IDENTIFIER = new Prisma.Decimal(100);
const SCORE_EXACT_NAME = new Prisma.Decimal(60);

// ---------------------------------------------------------------------------
// Internal candidate type
// ---------------------------------------------------------------------------
interface RawCandidate {
  matchedEntityId: string;
  entityType: EntityType;
  matchedField: string;
  candidateScore: Prisma.Decimal;
  candidateReason: string;
  ranking: number;
}

// ---------------------------------------------------------------------------
// Input DTO for the matcher
// ---------------------------------------------------------------------------
export interface MatcherInput {
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  extractionResultId: string;
  /** "STUDENT" or "EMPLOYEE". Derived by the caller from ExtractionResult.field */
  entityType: EntityType;
  /** The raw extracted value from ExtractionResult.value */
  extractedValue: string;
  /** The canonical field key (e.g. NISN, NIS, NIP, NIK, NAMA) */
  fieldKey: string;
  /** Optional: actor ID used for audit records */
  actorId?: string;
}

// ---------------------------------------------------------------------------
// Output DTO
// ---------------------------------------------------------------------------
export interface MatcherOutput {
  matchingResultId: string;
  status: MatchingStatus;
  candidateCount: number;
  /** Whether an existing manually confirmed decision was preserved */
  wasReused: boolean;
}

// ---------------------------------------------------------------------------
// Repository singletons
// ---------------------------------------------------------------------------
const studentRepo = new PostgresStudentRepository();
const employeeRepo = new PostgresEmployeeRepository();
const auditRepo = new PostgresAuditEventRepository();

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Trim and strip non-essential whitespace from numeric identifiers */
function normalizeIdentifier(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

// ---------------------------------------------------------------------------
// Candidate search
// ---------------------------------------------------------------------------

async function findStudentCandidates(
  tx: TenantTransactionClient,
  tenantId: string,
  fieldKey: string,
  extractedValue: string
): Promise<RawCandidate[]> {
  const normalized = normalizeIdentifier(extractedValue);
  const candidates: RawCandidate[] = [];

  // Priority 1: NISN exact match
  if (fieldKey === 'NISN' || fieldKey === 'nisn') {
    const student = await studentRepo.findByNisnTx(tx, tenantId, normalized);
    if (student) {
      candidates.push({
        matchedEntityId: student.id,
        entityType: ENTITY_TYPE.STUDENT,
        matchedField: 'nisn',
        candidateScore: SCORE_EXACT_IDENTIFIER,
        candidateReason: `Cocok berdasarkan NISN: '${normalized}'`,
        ranking: 1,
      });
      return candidates; // NISN is unique — return immediately
    }
  }

  // Priority 2: NIS exact match
  if (fieldKey === 'NIS' || fieldKey === 'nis') {
    const student = await studentRepo.findByNisTx(tx, tenantId, normalized);
    if (student) {
      candidates.push({
        matchedEntityId: student.id,
        entityType: ENTITY_TYPE.STUDENT,
        matchedField: 'nis',
        candidateScore: SCORE_EXACT_IDENTIFIER,
        candidateReason: `Cocok berdasarkan NIS: '${normalized}'`,
        ranking: 1,
      });
      return candidates; // NIS is unique — return immediately
    }
  }

  // Priority 3: Nama normalized
  if (fieldKey === 'NAMA' || fieldKey === 'nama' || fieldKey === 'fullName') {
    const normName = normalizeIdentifierName(extractedValue);
    const matches = await studentRepo.findByNameTx(tx, tenantId, normName);
    matches.forEach((s, idx) => {
      candidates.push({
        matchedEntityId: s.id,
        entityType: ENTITY_TYPE.STUDENT,
        matchedField: 'fullName',
        candidateScore: SCORE_EXACT_NAME,
        candidateReason: `Cocok berdasarkan nama: '${s.fullName}'`,
        ranking: idx + 1,
      });
    });
  }

  return candidates;
}

async function findEmployeeCandidates(
  tx: TenantTransactionClient,
  tenantId: string,
  fieldKey: string,
  extractedValue: string
): Promise<RawCandidate[]> {
  const normalized = normalizeIdentifier(extractedValue);
  const candidates: RawCandidate[] = [];

  // Priority 1: NIP exact match (NIP is nullable — only attempt if field is NIP)
  if (fieldKey === 'NIP' || fieldKey === 'nip') {
    const employee = await employeeRepo.findByNipTx(tx, tenantId, normalized);
    if (employee) {
      candidates.push({
        matchedEntityId: employee.id,
        entityType: ENTITY_TYPE.EMPLOYEE,
        matchedField: 'nip',
        candidateScore: SCORE_EXACT_IDENTIFIER,
        candidateReason: `Cocok berdasarkan NIP: '${normalized}'`,
        ranking: 1,
      });
      return candidates;
    }
  }

  // Priority 2: NIK exact match
  if (fieldKey === 'NIK' || fieldKey === 'nik') {
    const employee = await employeeRepo.findByNikTx(tx, tenantId, normalized);
    if (employee) {
      candidates.push({
        matchedEntityId: employee.id,
        entityType: ENTITY_TYPE.EMPLOYEE,
        matchedField: 'nik',
        candidateScore: SCORE_EXACT_IDENTIFIER,
        candidateReason: `Cocok berdasarkan NIK: '${normalized}'`,
        ranking: 1,
      });
      return candidates;
    }
  }

  // Priority 3: Nama normalized
  if (fieldKey === 'NAMA' || fieldKey === 'nama' || fieldKey === 'fullName') {
    const normName = normalizeEmployeeName(extractedValue);
    const matches = await employeeRepo.findByNameTx(tx, tenantId, normName);
    matches.forEach((e, idx) => {
      candidates.push({
        matchedEntityId: e.id,
        entityType: ENTITY_TYPE.EMPLOYEE,
        matchedField: 'fullName',
        candidateScore: SCORE_EXACT_NAME,
        candidateReason: `Cocok berdasarkan nama: '${e.fullName}'`,
        ranking: idx + 1,
      });
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Status determination (deterministic)
// ---------------------------------------------------------------------------
function determineStatus(
  candidates: RawCandidate[],
  fieldKey: string
): MatchingStatus {
  if (candidates.length === 0) return 'TIDAK_DITEMUKAN';

  const isIdentifierField = ['NISN', 'NIS', 'NIP', 'NIK', 'nisn', 'nis', 'nip', 'nik'].includes(fieldKey);

  if (candidates.length === 1 && isIdentifierField) {
    // Single exact identifier match → COCOK
    return 'COCOK';
  }

  if (candidates.length === 1 && !isIdentifierField) {
    // Single name match — still needs verification (name is not a unique identifier)
    return 'COCOK';
  }

  // Multiple candidates → always PERLU_DIPERIKSA
  return 'PERLU_DIPERIKSA';
}

// ---------------------------------------------------------------------------
// Main matcher
// ---------------------------------------------------------------------------
export async function matchDocumentIdentity(
  tx: TenantTransactionClient,
  input: MatcherInput
): Promise<MatcherOutput> {
  const {
    tenantId,
    documentId,
    documentVersionId,
    extractionResultId,
    entityType,
    extractedValue,
    fieldKey,
    actorId,
  } = input;

  const systemActorId = actorId ?? '00000000-0000-0000-0000-000000000001';

  // --- Audit: MATCHING_STARTED ---
  await auditRepo.recordTx(tx, tenantId, {
    action: AUDIT_ACTION.MATCHING_STARTED,
    entityType: 'MatchingResult',
    entityId: extractionResultId,
    metadata: { documentId, documentVersionId, extractionResultId, entityType, fieldKey },
  });

  try {
    // --- Check if manually confirmed result already exists ---
    const existing = await tx.matchingResult.findUnique({
      where: {
        tenantId_documentVersionId_extractionResultId_entityType: {
          tenantId,
          documentVersionId,
          extractionResultId,
          entityType,
        },
      },
    });

    if (existing?.manuallyConfirmed) {
      // Manual decision exists — do NOT overwrite
      await auditRepo.recordTx(tx, tenantId, {
        action: AUDIT_ACTION.MATCHING_REUSED,
        entityType: 'MatchingResult',
        entityId: existing.id,
        metadata: {
          documentId,
          documentVersionId,
          extractionResultId,
          entityType,
          reason: 'Keputusan manual dipertahankan',
        },
      });
      return {
        matchingResultId: existing.id,
        status: existing.status,
        candidateCount: 0, // candidates not re-fetched intentionally
        wasReused: true,
      };
    }

    // --- Find candidates ---
    const candidates: RawCandidate[] =
      entityType === ENTITY_TYPE.STUDENT
        ? await findStudentCandidates(tx, tenantId, fieldKey, extractedValue)
        : await findEmployeeCandidates(tx, tenantId, fieldKey, extractedValue);

    const status = determineStatus(candidates, fieldKey);
    const topScore =
      candidates.length > 0 ? candidates[0].candidateScore : null;

    // --- Upsert MatchingResult ---
    const matchingResultId = existing?.id ?? crypto.randomUUID();

    await tx.matchingResult.upsert({
      where: {
        tenantId_documentVersionId_extractionResultId_entityType: {
          tenantId,
          documentVersionId,
          extractionResultId,
          entityType,
        },
      },
      create: {
        id: matchingResultId,
        tenantId,
        documentId,
        documentVersionId,
        extractionResultId,
        entityType,
        extractedValue,
        status,
        confidenceScore: topScore,
        matchingReason:
          candidates.length > 0
            ? candidates[0].candidateReason
            : 'Tidak ditemukan kandidat yang sesuai',
        manuallyConfirmed: false,
      },
      update: {
        status,
        extractedValue,
        confidenceScore: topScore,
        matchingReason:
          candidates.length > 0
            ? candidates[0].candidateReason
            : 'Tidak ditemukan kandidat yang sesuai',
        // Never overwrite manuallyConfirmed/confirmedCandidateId/confirmedByUserId/confirmedAt here
      },
    });

    // --- Upsert each MatchingCandidate ---
    for (const candidate of candidates) {
      await tx.matchingCandidate.upsert({
        where: {
          tenantId_matchingResultId_matchedEntityId: {
            tenantId,
            matchingResultId,
            matchedEntityId: candidate.matchedEntityId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          tenantId,
          matchingResultId,
          matchedEntityId: candidate.matchedEntityId,
          entityType: candidate.entityType,
          matchedField: candidate.matchedField,
          candidateScore: candidate.candidateScore,
          candidateReason: candidate.candidateReason,
          ranking: candidate.ranking,
        },
        update: {
          matchedField: candidate.matchedField,
          candidateScore: candidate.candidateScore,
          candidateReason: candidate.candidateReason,
          ranking: candidate.ranking,
        },
      });
    }

    // --- Audit: MATCHING_COMPLETED ---
    await auditRepo.recordTx(tx, tenantId, {
      action: AUDIT_ACTION.MATCHING_COMPLETED,
      entityType: 'MatchingResult',
      entityId: matchingResultId,
      metadata: {
        documentId,
        documentVersionId,
        extractionResultId,
        entityType,
        status,
        candidateCount: candidates.length,
      },
    });

    return {
      matchingResultId,
      status,
      candidateCount: candidates.length,
      wasReused: false,
    };
  } catch (err: unknown) {
    // --- Audit: MATCHING_FAILED ---
    const failureId = extractionResultId;
    await auditRepo.recordTx(tx, tenantId, {
      action: AUDIT_ACTION.MATCHING_FAILED,
      entityType: 'MatchingResult',
      entityId: failureId,
      metadata: {
        documentId,
        documentVersionId,
        extractionResultId,
        entityType,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// LEGACY COMPATIBILITY — matchDocumentEntity
// Preserved for document-intelligence.ts orchestration pipeline (pre-P0-J).
// Do NOT remove until document-intelligence.ts is migrated to matchDocumentIdentity.
// ---------------------------------------------------------------------------

import type {
  ExtractedEntity,
  IdentityResolutionOutcome,
} from '@/platform/types/document-intelligence';

function _normalizeName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\b(S\.PD|S\.KOM|S\.SI|S\.SOS|S\.TP|S\.AG|S\.IP|M\.PD|M\.SI|DR|DRS|HJ|H)\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @deprecated Use matchDocumentIdentity for P0-J and later. */
export async function matchDocumentEntity(
  tx: TenantTransactionClient,
  tenantId: string,
  entity: ExtractedEntity,
): Promise<IdentityResolutionOutcome> {
  const value = entity.normalizedValue?.trim() || entity.rawValue.trim();

  if (!value) {
    return { status: 'UNRESOLVED', confidence: 0, matchMethod: 'EXACT', resolutionNotes: 'Entity value kosong.' };
  }

  if (entity.identifierType === 'NIP') {
    const employee = await tx.employee.findFirst({ where: { tenantId, nip: value } });
    if (employee) return { status: 'RESOLVED', matchedEntityId: employee.id, matchedEntityType: 'Employee', confidence: entity.confidence, matchMethod: 'EXACT', resolutionNotes: `Matched Employee by NIP '${value}'.` };
  }
  if (entity.identifierType === 'NRK') {
    const employee = await tx.employee.findFirst({ where: { tenantId, nrk: value } });
    if (employee) return { status: 'RESOLVED', matchedEntityId: employee.id, matchedEntityType: 'Employee', confidence: entity.confidence, matchMethod: 'EXACT', resolutionNotes: `Matched Employee by NRK '${value}'.` };
  }
  if (entity.identifierType === 'NIK') {
    const employee = await tx.employee.findFirst({ where: { tenantId, nik: value } });
    if (employee) return { status: 'RESOLVED', matchedEntityId: employee.id, matchedEntityType: 'Employee', confidence: entity.confidence, matchMethod: 'EXACT', resolutionNotes: `Matched Employee by NIK '${value}'.` };
  }
  if (entity.identifierType === 'NISN') {
    const student = await tx.student.findFirst({ where: { tenantId, nisn: value } });
    if (student) return { status: 'RESOLVED', matchedEntityId: student.id, matchedEntityType: 'Student', confidence: entity.confidence, matchMethod: 'EXACT', resolutionNotes: `Matched Student by NISN '${value}'.` };
  }
  if (entity.identifierType === 'NIS') {
    const student = await tx.student.findFirst({ where: { tenantId, nis: value } });
    if (student) return { status: 'RESOLVED', matchedEntityId: student.id, matchedEntityType: 'Student', confidence: entity.confidence, matchMethod: 'EXACT', resolutionNotes: `Matched Student by NIS '${value}'.` };
  }
  if (entity.entityType === 'STUDENT' || entity.entityType === 'EMPLOYEE') {
    const normalizedName = _normalizeName(value);
    if (normalizedName) {
      const candidates =
        entity.entityType === 'STUDENT'
          ? await tx.student.findMany({ where: { tenantId }, select: { id: true, fullName: true, nisn: true } })
          : await tx.employee.findMany({ where: { tenantId }, select: { id: true, fullName: true, nip: true, nik: true } });
      const matches = candidates.filter((c) => _normalizeName(c.fullName) === normalizedName);
      if (matches.length === 1) {
        return { status: 'RESOLVED', matchedEntityId: matches[0].id, matchedEntityType: entity.entityType === 'STUDENT' ? 'Student' : 'Employee', confidence: Math.round(entity.confidence * 0.85), matchMethod: 'FUZZY', resolutionNotes: `Matched by normalized full name: '${matches[0].fullName}'.` };
      }
      if (matches.length > 1) {
        return {
          status: 'AMBIGUOUS', confidence: 40, matchMethod: 'FUZZY',
          candidateMatches: matches.map((c) => {
            const identifier = entity.entityType === 'STUDENT' ? (c as { nisn: string }).nisn : (c as { nip: string | null; nik: string | null }).nip || (c as { nip: string | null; nik: string | null }).nik || '-';
            return { entityId: c.id, entityType: entity.entityType === 'STUDENT' ? 'Student' : 'Employee', label: `${c.fullName} (${identifier})`, confidence: 40 };
          }),
          resolutionNotes: `Ambiguous normalized name match: '${value}'.`,
        };
      }
    }
  }
  return { status: 'UNRESOLVED', confidence: 0, matchMethod: 'EXACT', resolutionNotes: `Tidak ditemukan pada Master Data untuk ${entity.identifierType || entity.entityType}: '${value}'.` };
}