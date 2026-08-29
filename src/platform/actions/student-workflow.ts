'use server';

import { executeInAuthenticatedContext, AuthenticationError, AuthorizationError } from '@/platform/auth';
import {
  AbsenceStatus,
  DocumentCategory,
  DocumentStatus,
  OCRExtractionStatus,
  UserRole,
  VerificationDecision,
} from '@prisma/client';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import { IExceptionRepository, PostgresExceptionRepository } from '@/platform/repositories/exception';
import { ocrItemValidationEngine } from '@/domains/student/rules';
import { ExtractedItem as DomainExtractedItem } from '@/domains/student/types';
import { randomUUID } from 'crypto';

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

export interface ExtractedItemDTO {
  id: string;
  ocrText: string;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedNisn?: string;
  confidence: number;
  class: string;
  date: string;
  status: 'Sakit' | 'Izin' | 'Alpha' | 'Hadir';
  notes?: string;
  verificationStatus: 'pending' | 'verified' | 'edited' | 'rejected';
}

export interface OCRDocumentDTO {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  imageUrl: string;
  status: 'processing' | 'needs_verification' | 'completed';
  workflowState: 'DRAFT' | 'NEEDS_VERIFICATION' | 'VERIFIED' | 'REQUIRES_CORRECTION' | 'COMPLETED';
  extractedCount: number;
  verifiedCount: number;
  items: ExtractedItemDTO[];
}

export interface UploadOCRItemDTO {
  id?: string;
  ocrText: string;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedNisn?: string;
  confidence: number;
  class?: string;
  date?: string;
  status?: 'Sakit' | 'Izin' | 'Alpha' | 'Hadir';
  notes?: string;
}

export interface UploadOCRDocumentDTO {
  fileName: string;
  fileSize?: number;
  imageUrl?: string;
  items: UploadOCRItemDTO[];
}

export interface VerifyExtractedItemDTO {
  itemId: string;
  decision?: 'PASSED' | 'FLAGGED' | 'REJECTED';
  notes?: string;
}

export const STUDENT_WORKFLOW_RBAC_POLICY = {
  READ: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR] as UserRole[],
  UPLOAD: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR] as UserRole[],
  VERIFY: [UserRole.ADMIN, UserRole.ADMIN_TENANT, UserRole.OPERATOR, UserRole.VERIFIKATOR] as UserRole[],
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

import { mapToDbAbsenceStatus, mapToDtoAbsenceStatus } from '@/domains/student/mappers';

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

  console.error('[Student Workflow Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pengelolaan alur kerja siswa.',
    },
  };
}

/**
 * Server Action: Get OCR Documents
 * Queries documents, OCR extractions, and extracted items for authenticated tenant under RLS.
 */
export async function getOCRDocumentsAction(): Promise<ActionResponse<OCRDocumentDTO[]>> {
  try {
    const docs = await executeInAuthenticatedContext(async (context, tx) => {
      if (!STUDENT_WORKFLOW_RBAC_POLICY.READ.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk membaca data dokumen OCR.`
        );
      }

      const records = await tx.document.findMany({
        where: {
          category: DocumentCategory.LAINNYA,
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
          ocrExtractions: {
            include: {
              items: {
                include: {
                  matchedStudent: true,
                  absenceRecord: true,
                },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const projected: OCRDocumentDTO[] = records.map((doc) => {
        const latestVersion = doc.versions[0];
        const latestOcr = doc.ocrExtractions[0];
        const rawItems = latestOcr?.items || [];

        const items: ExtractedItemDTO[] = rawItems.map((item) => {
          const isVerified = item.absenceRecordId !== null;
          const statusDto = mapToDtoAbsenceStatus(
            item.absenceRecord?.status || item.absenceTypeRaw
          );

          return {
            id: item.id,
            ocrText: item.studentNameRaw,
            matchedStudentId: item.matchedStudentId || undefined,
            matchedStudentName: item.matchedStudent?.fullName || item.studentNameRaw,
            matchedNisn: item.matchedStudent?.nisn || item.nisnRaw || undefined,
            confidence: Number(item.confidenceScore),
            class: item.matchedStudent?.className || 'X IPA 1',
            date: item.absenceDateRaw || new Date(item.createdAt).toISOString().slice(0, 10),
            status: statusDto,
            notes: item.absenceRecord?.reason || undefined,
            verificationStatus: isVerified ? 'verified' : 'pending',
          };
        });

        const verifiedCount = items.filter((i) => i.verificationStatus === 'verified').length;
        const allVerified = items.length > 0 && verifiedCount === items.length;

        return {
          id: doc.id,
          fileName: doc.title,
          fileSize: latestVersion ? Number(latestVersion.fileSizeBytes) : 520000,
          uploadedAt: doc.createdAt.toISOString(),
          imageUrl: latestVersion?.filePath || '/placeholder-doc.png',
          status: allVerified ? 'completed' : 'needs_verification',
          workflowState: allVerified ? 'VERIFIED' : 'NEEDS_VERIFICATION',
          extractedCount: items.length,
          verifiedCount,
          items,
        };
      });

      return projected;
    });

    return {
      success: true,
      data: docs,
    };
  } catch (err) {
    return handleActionError<OCRDocumentDTO[]>(err);
  }
}

/**
 * Server Action: Upload OCR Document
 * Atomically persists Document, DocumentVersion, OCRExtraction, and ExtractedItems in PostgreSQL under RLS.
 */
export async function uploadOCRDocumentAction(
  dto: UploadOCRDocumentDTO,
  exceptionRepo: IExceptionRepository = new PostgresExceptionRepository(auditRepo)
): Promise<ActionResponse<OCRDocumentDTO>> {
  try {
    if (!dto || typeof dto !== 'object' || !dto.fileName || dto.fileName.trim().length === 0) {
      throw new Error('Validation Error: Nama file dokumen OCR wajib diisi.');
    }

    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new Error('Validation Error: Dokumen OCR harus memiliki minimal satu item ekstraksi.');
    }

    const createdDoc = await executeInAuthenticatedContext(async (context, tx) => {
      if (!STUDENT_WORKFLOW_RBAC_POLICY.UPLOAD.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk mengunggah dokumen OCR.`
        );
      }

      const documentId = randomUUID();
      const versionId = randomUUID();
      const extractionId = randomUUID();
      const tenantId = context.tenantId;

      // 1. Create Document
      const doc = await tx.document.create({
        data: {
          id: documentId,
          tenantId,
          title: dto.fileName.trim(),
          category: DocumentCategory.LAINNYA,
          currentVersion: 1,
          status: DocumentStatus.PENDING_VERIFICATION,
        },
      });

      // 2. Create Document Version
      await tx.documentVersion.create({
        data: {
          id: versionId,
          tenantId,
          documentId: doc.id,
          versionNumber: 1,
          filePath: dto.imageUrl || '/placeholder-doc.png',
          fileSizeBytes: BigInt(dto.fileSize || 520000),
          mimeType: 'image/png',
          checksumSha256: 'simulated_ocr_checksum_' + Date.now(),
        },
      });

      // 3. Create OCRExtraction (Status: COMPLETED because items are produced)
      await tx.oCRExtraction.create({
        data: {
          id: extractionId,
          tenantId,
          documentId: doc.id,
          status: OCRExtractionStatus.COMPLETED,
          rawJson: { itemCount: dto.items.length, uploadedAt: new Date().toISOString() },
        },
      });

      // 4. Create ExtractedItems and wire automated Exception generation
      const createdItems: ExtractedItemDTO[] = [];

      for (const item of dto.items) {
        const itemId = item.id && isValidUuid(item.id) ? item.id : randomUUID();

        // Resolve matched student ID if not provided
        let resolvedStudentId = item.matchedStudentId;
        if (!resolvedStudentId && item.matchedNisn) {
          const foundStudent = await tx.student.findFirst({
            where: { tenantId, nisn: item.matchedNisn },
          });
          if (foundStudent) resolvedStudentId = foundStudent.id;
        }

        const rawAbsenceDate = item.date || new Date().toISOString().slice(0, 10);
        const rawAbsenceType = item.status || 'Sakit';

        const createdItem = await tx.extractedItem.create({
          data: {
            id: itemId,
            tenantId,
            ocrExtractionId: extractionId,
            studentNameRaw: item.matchedStudentName || item.ocrText,
            nisnRaw: item.matchedNisn || null,
            absenceDateRaw: rawAbsenceDate,
            absenceTypeRaw: rawAbsenceType,
            confidenceScore: item.confidence,
            matchedStudentId: resolvedStudentId || null,
            absenceRecordId: null, // Pending verification
          },
          include: {
            matchedStudent: true,
          },
        });

        const domainItem: DomainExtractedItem = {
          id: createdItem.id,
          ocrText: createdItem.studentNameRaw,
          matchedStudentId: createdItem.matchedStudentId || undefined,
          matchedStudentName: createdItem.matchedStudent?.fullName || createdItem.studentNameRaw,
          matchedNisn: createdItem.matchedStudent?.nisn || createdItem.nisnRaw || undefined,
          confidence: Number(createdItem.confidenceScore),
          class: createdItem.matchedStudent?.className || item.class || 'X IPA 1',
          date: rawAbsenceDate,
          status: mapToDtoAbsenceStatus(rawAbsenceType),
          notes: item.notes,
          verificationStatus: 'pending',
        };

        // Platform automated exception generation bridge
        const validationResults = ocrItemValidationEngine.validateEntity(domainItem);
        await exceptionRepo.createFromValidationResultsTx(
          tx,
          tenantId,
          'ExtractedItem',
          createdItem.id,
          validationResults,
          context.actorId
        );

        createdItems.push({
          id: createdItem.id,
          ocrText: createdItem.studentNameRaw,
          matchedStudentId: createdItem.matchedStudentId || undefined,
          matchedStudentName: createdItem.matchedStudent?.fullName || createdItem.studentNameRaw,
          matchedNisn: createdItem.matchedStudent?.nisn || createdItem.nisnRaw || undefined,
          confidence: Number(createdItem.confidenceScore),
          class: createdItem.matchedStudent?.className || item.class || 'X IPA 1',
          date: rawAbsenceDate,
          status: mapToDtoAbsenceStatus(rawAbsenceType),
          notes: item.notes,
          verificationStatus: 'pending',
        });
      }

      // 5. Record Audit Event via PostgresAuditEventRepository
      await auditRepo.recordTx(tx, tenantId, {
        actorUserId: context.actorId,
        action: 'UPLOAD_OCR',
        entityType: 'Document',
        entityId: doc.id,
        metadata: { fileName: doc.title, extractedCount: dto.items.length },
      });

      return {
        id: doc.id,
        fileName: doc.title,
        fileSize: dto.fileSize || 520000,
        uploadedAt: doc.createdAt.toISOString(),
        imageUrl: dto.imageUrl || '/placeholder-doc.png',
        status: 'needs_verification' as const,
        workflowState: 'NEEDS_VERIFICATION' as const,
        extractedCount: createdItems.length,
        verifiedCount: 0,
        items: createdItems,
      };
    });

    return {
      success: true,
      data: createdDoc,
    };
  } catch (err) {
    return handleActionError<OCRDocumentDTO>(err);
  }
}

/**
 * Server Action: Verify Extracted Item
 * Atomically verifies an ExtractedItem, generates AbsenceRecord, records HumanVerification, and AuditEvent in PostgreSQL.
 */
export async function verifyExtractedItemAction(
  dto: VerifyExtractedItemDTO
): Promise<ActionResponse<{ verifiedItemId: string; absenceRecordId: string; documentCompleted: boolean }>> {
  try {
    if (!dto || !isValidUuid(dto.itemId)) {
      throw new Error('Validation Error: ID item ekstraksi tidak valid.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      if (!STUDENT_WORKFLOW_RBAC_POLICY.VERIFY.includes(context.role)) {
        throw new AuthorizationError(
          `Akses ditolak: Peran '${context.role}' tidak memiliki wewenang untuk memverifikasi item ekstraksi.`
        );
      }

      const tenantId = context.tenantId;

      // 1. Fetch ExtractedItem in current tenant context
      const item = await tx.extractedItem.findFirst({
        where: {
          id: dto.itemId,
          tenantId,
        },
        include: {
          ocrExtraction: {
            include: {
              document: true,
            },
          },
          matchedStudent: true,
        },
      });

      if (!item) {
        throw new Error('Validation Error: Item ekstraksi tidak ditemukan pada instansi ini.');
      }

      if (item.absenceRecordId) {
        // Already verified
        return {
          verifiedItemId: item.id,
          absenceRecordId: item.absenceRecordId,
          documentCompleted: true,
        };
      }

      // 2. Resolve Student
      let studentId = item.matchedStudentId;
      if (!studentId) {
        // Try finding student by NISN or name in tenant
        const student = item.nisnRaw
          ? await tx.student.findFirst({ where: { tenantId, nisn: item.nisnRaw } })
          : await tx.student.findFirst({ where: { tenantId, fullName: item.studentNameRaw } });

        if (student) {
          studentId = student.id;
        } else {
          // If student doesn't exist, create a student record to maintain referential integrity
          const newStudentId = randomUUID();
          const createdStudent = await tx.student.create({
            data: {
              id: newStudentId,
              tenantId,
              nisn: item.nisnRaw || '005' + Date.now().toString().slice(-7),
              nis: '2122' + Date.now().toString().slice(-4),
              fullName: item.studentNameRaw,
              className: 'X IPA 1',
              status: 'ACTIVE',
            },
          });
          studentId = createdStudent.id;
        }
      }

      // 3. Create AbsenceRecord with canonical AbsenceStatus enum
      const absenceRecordId = randomUUID();
      const absenceDate = item.absenceDateRaw ? new Date(item.absenceDateRaw) : new Date();
      const dbAbsenceStatus = mapToDbAbsenceStatus(item.absenceTypeRaw);

      await tx.absenceRecord.create({
        data: {
          id: absenceRecordId,
          tenantId,
          studentId,
          absenceDate,
          status: dbAbsenceStatus,
          reason: dto.notes || 'Verifikasi manual operator',
          documentId: item.ocrExtraction.documentId,
        },
      });

      // 4. Update ExtractedItem
      await tx.extractedItem.update({
        where: { id: item.id },
        data: {
          absenceRecordId,
          matchedStudentId: studentId,
        },
      });

      // 5. Create HumanVerification with canonical VerificationDecision (PASSED, FLAGGED, REJECTED)
      const decision: VerificationDecision =
        dto.decision === 'FLAGGED'
          ? VerificationDecision.FLAGGED
          : dto.decision === 'REJECTED'
          ? VerificationDecision.REJECTED
          : VerificationDecision.PASSED;

      await tx.humanVerification.create({
        data: {
          id: randomUUID(),
          tenantId,
          targetEntityType: 'ExtractedItem',
          targetEntityId: item.id,
          verifiedByUserId: context.actorId,
          decision,
          notes: dto.notes || 'Verifikasi manual',
        },
      });

      // 6. Record Audit Event via PostgresAuditEventRepository
      await auditRepo.recordTx(tx, tenantId, {
        actorUserId: context.actorId,
        action: 'VERIFY_ITEM',
        entityType: 'ExtractedItem',
        entityId: item.id,
        metadata: {
          studentId,
          absenceRecordId,
          documentId: item.ocrExtraction.documentId,
          decision,
          note: dto.notes || 'Verifikasi manual',
        },
      });

      // 7. Check if all items for the extraction are now verified
      const unverifiedRemaining = await tx.extractedItem.count({
        where: {
          ocrExtractionId: item.ocrExtractionId,
          tenantId,
          absenceRecordId: null,
        },
      });

      const documentCompleted = unverifiedRemaining === 0;

      if (documentCompleted) {
        await tx.document.update({
          where: { id: item.ocrExtraction.documentId },
          data: { status: DocumentStatus.VERIFIED },
        });
      }

      return {
        verifiedItemId: item.id,
        absenceRecordId,
        documentCompleted,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<{ verifiedItemId: string; absenceRecordId: string; documentCompleted: boolean }>(err);
  }
}
