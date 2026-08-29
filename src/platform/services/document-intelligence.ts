import crypto from 'crypto';
import {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineRequest,
  DocumentIntelligencePipelineResult,
  DocumentIntelligencePipelineSummary,
  ProcessedExtractedItem,
  IdentityResolutionOutcome,
  ExtractedField,
  PipelineTerminalStatus,
  ValidationResult,
} from '../types';
import { IAuditEventRepository, PostgresAuditEventRepository } from '../repositories/audit-event';
import { IExceptionRepository, PostgresExceptionRepository } from '../repositories/exception';
import { TenantTransactionClient, runInTenantContext } from '../db/tenant-context';
import { ocrItemValidationEngine } from '@/domains/student/rules';
import { ExtractedItem as DomainExtractedItem } from '@/domains/student/types';
import { OCRExtractionStatus } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Concrete Application Service for Document Intelligence Orchestration.
 *
 * Composes existing capabilities:
 * - Tenant isolation via PostgreSQL RLS (`runInTenantContext`)
 * - Identity Resolution against master registries (Student / Employee)
 * - Validation rule execution (`PlatformValidationEngine`)
 * - Automated exception generation (`PostgresExceptionRepository.createFromValidationResultsTx`)
 * - Persistent transaction-bound audit logging (`PostgresAuditEventRepository.recordTx`)
 */
export class DocumentIntelligenceOrchestrator implements IDocumentIntelligenceOrchestrator {
  constructor(
    private readonly auditRepo: IAuditEventRepository = new PostgresAuditEventRepository(),
    private readonly exceptionRepo: IExceptionRepository = new PostgresExceptionRepository(auditRepo)
  ) {}

  /**
   * Orchestrates the complete end-to-end document intelligence lifecycle in tenant context.
   *
   * @param request Validated pipeline request with tenant, actor, and document references.
   * @returns Pipeline result containing terminal status, processed items, exception references, and summary.
   */
  public async process(
    request: DocumentIntelligencePipelineRequest
  ): Promise<DocumentIntelligencePipelineResult> {
    const startedAt = new Date().toISOString();

    // 1. Inbound Request Guard Validation
    if (!request || typeof request !== 'object') {
      return this.createFailedResult(
        '',
        '',
        'Validation Error: Pipeline request must be a valid object.',
        startedAt
      );
    }

    const { tenantId, actorId, documentId, documentVersionId, targetDomain } = request;

    if (!tenantId || !isValidUuid(tenantId)) {
      return this.createFailedResult(
        documentId || '',
        documentVersionId || '',
        `SECURITY/SCHEMA ERROR: Tenant id must be a valid UUID. Received: '${tenantId}'`,
        startedAt
      );
    }

    if (!actorId || !isValidUuid(actorId)) {
      return this.createFailedResult(
        documentId || '',
        documentVersionId || '',
        `SECURITY ERROR: Actor id must be a valid UUID. Received: '${actorId}'`,
        startedAt
      );
    }

    if (!documentId || !isValidUuid(documentId)) {
      return this.createFailedResult(
        documentId || '',
        documentVersionId || '',
        `Validation Error: documentId must be a valid UUID. Received: '${documentId}'`,
        startedAt
      );
    }

    if (!documentVersionId || !isValidUuid(documentVersionId)) {
      return this.createFailedResult(
        documentId,
        documentVersionId || '',
        `Validation Error: documentVersionId must be a valid UUID. Received: '${documentVersionId}'`,
        startedAt
      );
    }

    if (!targetDomain || typeof targetDomain !== 'string' || targetDomain.trim().length === 0) {
      return this.createFailedResult(
        documentId,
        documentVersionId,
        `Validation Error: targetDomain must be a non-empty string. Received: '${targetDomain}'`,
        startedAt
      );
    }

    try {
      // 2. Execute within Tenant Transaction Boundary (RLS)
      return await runInTenantContext(actorId, tenantId, async (tx: TenantTransactionClient) => {
        // 2.1 Verify Document & Version existence
        const doc = await tx.document.findFirst({
          where: { tenantId, id: documentId },
        });

        if (!doc) {
          throw new Error(`Document not found: '${documentId}' under tenant context.`);
        }

        const docVersion = await tx.documentVersion.findFirst({
          where: { tenantId, id: documentVersionId, documentId },
        });

        if (!docVersion) {
          throw new Error(
            `DocumentVersion not found: '${documentVersionId}' for document '${documentId}'.`
          );
        }

        // 2.2 Retrieve or Initialize OCRExtraction
        let extraction = await tx.oCRExtraction.findFirst({
          where: { tenantId, documentId },
          include: {
            items: {
              include: {
                matchedStudent: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // If metadata contains items to ingest, handle item persistence
        const rawMetadataItems = Array.isArray(request.metadata?.items)
          ? (request.metadata.items as Array<Record<string, any>>)
          : null;

        if (rawMetadataItems && rawMetadataItems.length > 0) {
          if (!extraction) {
            extraction = await tx.oCRExtraction.create({
              data: {
                id: crypto.randomUUID(),
                tenantId,
                documentId,
                status: OCRExtractionStatus.COMPLETED,
                rawJson: { itemCount: rawMetadataItems.length, uploadedAt: new Date().toISOString() },
              },
              include: {
                items: {
                  include: {
                    matchedStudent: true,
                  },
                },
              },
            });
          }

          for (const rawItem of rawMetadataItems) {
            const itemId = rawItem.id && isValidUuid(rawItem.id) ? rawItem.id : crypto.randomUUID();
            const rawStudentName = rawItem.matchedStudentName || rawItem.ocrText || rawItem.name || '';
            const rawNisn = rawItem.matchedNisn || rawItem.nisn || null;
            const rawAbsenceDate = rawItem.date || new Date().toISOString().slice(0, 10);
            const rawAbsenceType = rawItem.status || 'Sakit';
            const confidence = typeof rawItem.confidence === 'number' ? rawItem.confidence : 80;

            let resolvedStudentId = rawItem.matchedStudentId || null;
            if (!resolvedStudentId && rawNisn) {
              const matchedStudent = await tx.student.findFirst({
                where: { tenantId, nisn: rawNisn },
              });
              if (matchedStudent) resolvedStudentId = matchedStudent.id;
            }

            await tx.extractedItem.create({
              data: {
                id: itemId,
                tenantId,
                ocrExtractionId: extraction.id,
                studentNameRaw: rawStudentName,
                nisnRaw: rawNisn,
                absenceDateRaw: rawAbsenceDate,
                absenceTypeRaw: rawAbsenceType,
                confidenceScore: confidence,
                matchedStudentId: resolvedStudentId,
              },
            });
          }

          // Reload extraction with newly created items
          extraction = await tx.oCRExtraction.findUnique({
            where: { id: extraction.id },
            include: {
              items: {
                include: {
                  matchedStudent: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          });
        }

        const items = extraction?.items || [];
        const processedItems: ProcessedExtractedItem[] = [];
        const allCreatedExceptionIds: string[] = [];

        // 2.3 Process Each Extracted Item
        for (const item of items) {
          const confidence = Number(item.confidenceScore);

          // A. Identity Resolution
          const identityResolution = await this.resolveIdentity(tx, tenantId, targetDomain, item);

          // If resolution newly mapped a student, update the record
          if (
            identityResolution.status === 'RESOLVED' &&
            identityResolution.matchedEntityId &&
            item.matchedStudentId !== identityResolution.matchedEntityId
          ) {
            await tx.extractedItem.update({
              where: { id: item.id },
              data: { matchedStudentId: identityResolution.matchedEntityId },
            });
          }

          // B. Construct Extracted Fields Mapping
          const fields: Record<string, ExtractedField> = {
            studentName: {
              name: 'studentName',
              rawValue: item.studentNameRaw,
              normalizedValue: item.studentNameRaw.trim(),
              confidence,
            },
            nisn: {
              name: 'nisn',
              rawValue: item.nisnRaw || '',
              normalizedValue: item.nisnRaw?.trim() || '',
              confidence,
            },
            absenceDate: {
              name: 'absenceDate',
              rawValue: item.absenceDateRaw || '',
              normalizedValue: item.absenceDateRaw || '',
              confidence,
            },
            absenceType: {
              name: 'absenceType',
              rawValue: item.absenceTypeRaw || '',
              normalizedValue: item.absenceTypeRaw || '',
              confidence,
            },
          };

          // C. Validation Execution
          const domainItem: DomainExtractedItem = {
            id: item.id,
            ocrText: item.studentNameRaw,
            matchedStudentId:
              identityResolution.status === 'RESOLVED' ? identityResolution.matchedEntityId : undefined,
            matchedStudentName: item.matchedStudent?.fullName || item.studentNameRaw,
            matchedNisn: item.matchedStudent?.nisn || item.nisnRaw || undefined,
            confidence,
            class: item.matchedStudent?.className || 'X IPA 1',
            date: item.absenceDateRaw || new Date().toISOString().slice(0, 10),
            status: (item.absenceTypeRaw as any) || 'Sakit',
            notes: undefined,
            verificationStatus: 'pending',
          };

          const validationResults: ValidationResult[] =
            ocrItemValidationEngine.validateEntity(domainItem);

          // D. Automated Exception Generation Bridge
          const createdExceptions = await this.exceptionRepo.createFromValidationResultsTx(
            tx,
            tenantId,
            'ExtractedItem',
            item.id,
            validationResults,
            actorId
          );

          for (const exc of createdExceptions) {
            if (!allCreatedExceptionIds.includes(exc.id)) {
              allCreatedExceptionIds.push(exc.id);
            }
          }

          // E. Requires Human Review Determination
          const hasValidationFailures = validationResults.some((r) => !r.valid && r.severity !== 'INFO');
          const requiresHumanReview =
            identityResolution.status !== 'RESOLVED' ||
            hasValidationFailures ||
            createdExceptions.length > 0 ||
            confidence < 70;

          processedItems.push({
            id: item.id,
            rawText: item.studentNameRaw,
            confidence,
            fields,
            identityResolution,
            validationResults,
            exceptionId: createdExceptions[0]?.id,
            requiresHumanReview,
          });
        }

        // 2.4 Compute Pipeline Summary
        const summary: DocumentIntelligencePipelineSummary = {
          totalItemsExtracted: processedItems.length,
          itemsResolved: processedItems.filter((i) => i.identityResolution.status === 'RESOLVED').length,
          itemsUnresolved: processedItems.filter((i) => i.identityResolution.status === 'UNRESOLVED').length,
          itemsAmbiguous: processedItems.filter((i) => i.identityResolution.status === 'AMBIGUOUS').length,
          validationErrorsCount: processedItems.reduce(
            (acc, i) => acc + i.validationResults.filter((v) => !v.valid && v.severity !== 'INFO').length,
            0
          ),
          exceptionsCreatedCount: allCreatedExceptionIds.length,
          itemsRequiringReview: processedItems.filter((i) => i.requiresHumanReview).length,
        };

        // 2.5 Determine Terminal Status
        const terminalStatus: PipelineTerminalStatus =
          summary.itemsRequiringReview > 0 || summary.exceptionsCreatedCount > 0
            ? 'REQUIRES_REVIEW'
            : 'COMPLETED';

        // 2.6 Record Transaction-Bound Persistent Audit Event
        const auditRecord = await this.auditRepo.recordTx(tx, tenantId, {
          actorUserId: actorId,
          actor: actorId,
          action: 'PROCESS_DOCUMENT_INTELLIGENCE',
          entityType: 'Document',
          entityId: documentId,
          metadata: {
            documentVersionId,
            targetDomain,
            terminalStatus,
            summary,
            exceptionCount: allCreatedExceptionIds.length,
          },
        });

        const completedAt = new Date().toISOString();

        return {
          status: terminalStatus,
          documentId,
          documentVersionId,
          ocrExtractionId: extraction?.id,
          processedItems,
          summary,
          exceptionIds: allCreatedExceptionIds,
          auditEventId: auditRecord.id,
          startedAt,
          completedAt,
        };
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return this.createFailedResult(documentId, documentVersionId, errorMessage, startedAt);
    }
  }

  /**
   * Resolves entity identity against the target domain master data under tenant isolation.
   */
  private async resolveIdentity(
    tx: TenantTransactionClient,
    tenantId: string,
    targetDomain: string,
    item: {
      matchedStudentId?: string | null;
      matchedStudent?: { id: string; fullName: string; nisn: string } | null;
      studentNameRaw: string;
      nisnRaw?: string | null;
      confidenceScore: any;
    }
  ): Promise<IdentityResolutionOutcome> {
    const confidence = Number(item.confidenceScore);

    // If pre-linked to a matched student entity
    if (item.matchedStudentId && item.matchedStudent) {
      return {
        status: 'RESOLVED',
        matchedEntityId: item.matchedStudent.id,
        matchedEntityType: 'Student',
        confidence,
        matchMethod: 'EXACT',
        resolutionNotes: 'Matched deterministically via student foreign key.',
      };
    }

    if (targetDomain.toLowerCase() === 'student') {
      // 1. Try resolving by NISN (Exact match)
      if (item.nisnRaw && item.nisnRaw.trim().length > 0) {
        const matchingStudents = await tx.student.findMany({
          where: { tenantId, nisn: item.nisnRaw.trim() },
        });

        if (matchingStudents.length === 1) {
          return {
            status: 'RESOLVED',
            matchedEntityId: matchingStudents[0].id,
            matchedEntityType: 'Student',
            confidence,
            matchMethod: 'EXACT',
            resolutionNotes: `Resolved by exact NISN match: ${matchingStudents[0].nisn}`,
          };
        } else if (matchingStudents.length > 1) {
          return {
            status: 'AMBIGUOUS',
            confidence: Math.round(confidence * 0.5),
            matchMethod: 'EXACT',
            candidateMatches: matchingStudents.map((s) => ({
              entityId: s.id,
              entityType: 'Student',
              label: `${s.fullName} (${s.nisn})`,
              confidence: 50,
            })),
            resolutionNotes: `Ambiguous NISN: multiple students found for NISN '${item.nisnRaw}'.`,
          };
        }
      }

      // 2. Try resolving by Full Name
      if (item.studentNameRaw && item.studentNameRaw.trim().length > 0) {
        const matchingStudentsByName = await tx.student.findMany({
          where: { tenantId, fullName: item.studentNameRaw.trim() },
        });

        if (matchingStudentsByName.length === 1) {
          return {
            status: 'RESOLVED',
            matchedEntityId: matchingStudentsByName[0].id,
            matchedEntityType: 'Student',
            confidence: Math.round(confidence * 0.9),
            matchMethod: 'FUZZY',
            resolutionNotes: `Resolved by exact name match: '${matchingStudentsByName[0].fullName}'`,
          };
        } else if (matchingStudentsByName.length > 1) {
          return {
            status: 'AMBIGUOUS',
            confidence: 40,
            matchMethod: 'FUZZY',
            candidateMatches: matchingStudentsByName.map((s) => ({
              entityId: s.id,
              entityType: 'Student',
              label: `${s.fullName} (${s.nisn})`,
              confidence: 40,
            })),
            resolutionNotes: `Ambiguous name: multiple students found for '${item.studentNameRaw}'.`,
          };
        }
      }

      // 3. Unresolved fallback
      return {
        status: 'UNRESOLVED',
        confidence: 0,
        resolutionNotes: `Siswa '${item.studentNameRaw}' tidak ditemukan dalam master data siswa.`,
      };
    }

    if (targetDomain.toLowerCase() === 'employee') {
      // Try resolving employee by NIP / NRK
      const identifier = item.nisnRaw || item.studentNameRaw;
      if (identifier) {
        const matchedEmployee = await tx.employee.findFirst({
          where: {
            tenantId,
            OR: [{ nip: identifier }, { nrk: identifier }],
          },
        });

        if (matchedEmployee) {
          return {
            status: 'RESOLVED',
            matchedEntityId: matchedEmployee.id,
            matchedEntityType: 'Employee',
            confidence,
            matchMethod: 'EXACT',
            resolutionNotes: `Resolved employee by NIP/NRK match: '${identifier}'`,
          };
        }
      }

      return {
        status: 'UNRESOLVED',
        confidence: 0,
        resolutionNotes: `Pegawai '${identifier}' tidak ditemukan dalam master data pegawai.`,
      };
    }

    return {
      status: 'UNRESOLVED',
      confidence: 0,
      resolutionNotes: `Domain '${targetDomain}' tidak memiliki resolver identitas khusus.`,
    };
  }

  /**
   * Helper to construct a canonical failed pipeline result.
   */
  private createFailedResult(
    documentId: string,
    documentVersionId: string,
    errorMessage: string,
    startedAt: string
  ): DocumentIntelligencePipelineResult {
    return {
      status: 'FAILED',
      documentId,
      documentVersionId,
      processedItems: [],
      summary: {
        totalItemsExtracted: 0,
        itemsResolved: 0,
        itemsUnresolved: 0,
        itemsAmbiguous: 0,
        validationErrorsCount: 0,
        exceptionsCreatedCount: 0,
        itemsRequiringReview: 0,
      },
      exceptionIds: [],
      errorMessage,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}
