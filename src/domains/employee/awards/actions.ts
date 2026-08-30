'use server';

import {
  AwardProposal,
  ProposalDocument,
  VerificationStatus,
  ImportAwardProposalsInput,
  ImportAwardProposalsResult,
} from './types';
import { AwardProposalApplicationService } from './service';
import { getAuthenticatedSession, AuthenticationError } from '@/platform/auth/session';
import { assertAuthorizedAction, AuthorizationError } from '@/platform/auth/guards';

import { randomUUID } from 'crypto';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import { getObjectStorageProvider, IObjectStorageProvider, buildDocumentStoragePath } from '@/platform/storage';
import { runInTenantContext } from '@/platform/db/tenant-context';

import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';
export type { ActionErrorCode, ActionError, ActionResponse };

export interface UploadProposalDocumentDTO {
  proposalId: string;
  requirementCode: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  /**
   * Optional real binary payload (Base64 encoded string or raw Buffer/Uint8Array).
   * When provided, bytes are uploaded to IObjectStorageProvider, and real SHA-256 is persisted.
   */
  fileBase64?: string;
  fileBuffer?: Buffer | Uint8Array;
  mimeType?: string;
}

export interface VerifyProposalDocumentDTO {
  proposalId: string;
  requirementCode: string;
  status: VerificationStatus;
  notes?: string;
}

export interface ApproveProposalGenerationDTO {
  proposalId: string;
}

export interface BatchMarkGeneratedDTO {
  proposalIds: string[];
}

export interface SignProposalDTO {
  proposalId: string;
}

export interface SendProposalDTO {
  proposalId: string;
}

export interface ArchiveCompleteProposalDTO {
  proposalId: string;
}

function mapRequirementCodeToCategory(code: string): DocumentCategory {
  if (code in DocumentCategory) {
    return code as DocumentCategory;
  }
  if (code.startsWith('SK_JABATAN')) return DocumentCategory.SK_JABATAN;
  if (code.startsWith('SKP')) return DocumentCategory.SKP_2_TAHUN;
  return DocumentCategory.LAINNYA;
}

/**
 * Sanitizes and maps server-side errors to client-safe ActionResponse structures.
 * Internal database errors and raw stack traces are logged server-side and masked from clients.
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
    // Check for validation errors
    if (err.message.startsWith('Validation Error:') || err.message.startsWith('VALIDATION_ERROR:')) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }

    // Check for domain / workflow guard errors / identity collisions
    if (
      err.message.startsWith('Workflow transition failed:') ||
      err.message.startsWith('AwardProposal not found') ||
      err.message.startsWith('IDENTITY_COLLISION:')
    ) {
      return {
        success: false,
        error: {
          code: 'DOMAIN_ERROR',
          message: err.message,
        },
      };
    }

    // Security errors from RLS triggers
    if (err.message.startsWith('SECURITY ERROR:')) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak oleh kebijakan keamanan data.',
        },
      };
    }
  }

  // Sanitize internal database / unhandled errors
  console.error('[Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem.',
    },
  };
}

/**
 * Server Action: Upload Proposal Document
 * Enforces AuthN + AuthZ (UPLOAD_DOCUMENT) ➔ delegates to application service.
 * Supports canonical binary upload to IObjectStorageProvider with real SHA-256 persistence
 * and canonical Document + DocumentVersion records.
 */
export async function uploadProposalDocumentAction(
  dto: UploadProposalDocumentDTO,
  storageProvider: IObjectStorageProvider = getObjectStorageProvider()
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy
    assertAuthorizedAction(session, 'UPLOAD_DOCUMENT');

    // 3. Validate Input DTO
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Input payload wajib berupa object.');
    }
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }
    if (!dto.requirementCode || typeof dto.requirementCode !== 'string') {
      throw new Error('Validation Error: requirementCode is required and must be a string.');
    }

    // Validate binary inputs mutual exclusivity and validity
    if (dto.fileBase64 !== undefined && dto.fileBase64.trim().length === 0) {
      throw new Error('Validation Error: fileBase64 tidak boleh berupa string kosong.');
    }
    if (dto.fileBuffer !== undefined && dto.fileBuffer.byteLength === 0) {
      throw new Error('Validation Error: fileBuffer tidak boleh berupa buffer kosong.');
    }

    const hasBuffer = Boolean(dto.fileBuffer);
    const hasBase64 = Boolean(dto.fileBase64 && dto.fileBase64.trim().length > 0);

    if (hasBuffer && hasBase64) {
      throw new Error('Validation Error: fileBuffer dan fileBase64 tidak boleh diberikan secara bersamaan.');
    }

    const hasBinaryContent = hasBuffer || hasBase64;
    const service = new AwardProposalApplicationService();

    if (hasBinaryContent) {
      const binaryBuffer = hasBuffer
        ? Buffer.from(dto.fileBuffer!)
        : Buffer.from(dto.fileBase64!.trim(), 'base64');

      if (binaryBuffer.byteLength === 0) {
        throw new Error('Validation Error: Payload binary file upload tidak boleh kosong.');
      }

      const tenantId = session.tenantId;
      const fileName = (dto.fileName || `${dto.requirementCode}.pdf`).trim();
      const mimeType = dto.mimeType || 'application/pdf';

      // 4. Resolve proposal and check if a canonical document already exists for this requirement
      const updatedProposal = await runInTenantContext(session.actorId, tenantId, async (tx) => {
        const proposal = await tx.awardProposal.findUnique({
          where: { id: dto.proposalId },
          include: {
            documents: {
              where: { requirementCode: dto.requirementCode },
            },
          },
        });

        if (!proposal) {
          throw new Error(`AwardProposal not found: ${dto.proposalId}`);
        }

        const existingProposalDoc = proposal.documents[0];
        let targetDocumentId: string;
        let nextVersion: number;

        if (existingProposalDoc?.documentId) {
          targetDocumentId = existingProposalDoc.documentId;
          // Row-level lock on document record to serialize concurrent replacement attempts
          await tx.$executeRaw`SELECT id FROM documents WHERE id = ${targetDocumentId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE;`;
          const existingDoc = await tx.document.findUniqueOrThrow({
            where: { id: targetDocumentId },
          });
          nextVersion = existingDoc.currentVersion + 1;
        } else {
          targetDocumentId = randomUUID();
          nextVersion = 1;
        }

        // 5. Upload replacement binary for (tenantId, targetDocumentId, nextVersion, fileName)
        const storagePath = buildDocumentStoragePath(tenantId, targetDocumentId, nextVersion, fileName);
        const uploadResult = await storageProvider.upload({
          tenantId,
          storagePath,
          content: binaryBuffer,
          mimeType,
        });

        try {
          // A. Create or update canonical Document
          let doc: {
            id: string;
            tenantId: string;
            title: string;
            category: DocumentCategory;
            currentVersion: number;
            status: DocumentStatus;
            createdAt: Date;
            updatedAt: Date;
          };

          if (nextVersion === 1) {
            doc = await tx.document.create({
              data: {
                id: targetDocumentId,
                tenantId,
                title: fileName,
                category: mapRequirementCodeToCategory(dto.requirementCode),
                currentVersion: 1,
                status: DocumentStatus.PENDING_VERIFICATION,
              },
            });
          } else {
            doc = await tx.document.update({
              where: { id: targetDocumentId },
              data: {
                title: fileName,
                currentVersion: nextVersion,
                status: DocumentStatus.PENDING_VERIFICATION,
              },
            });
          }

          // B. Create canonical DocumentVersion for versionNumber: nextVersion
          const versionId = randomUUID();
          await tx.documentVersion.create({
            data: {
              id: versionId,
              tenantId,
              documentId: targetDocumentId,
              versionNumber: nextVersion,
              filePath: uploadResult.storagePath,
              fileSizeBytes: BigInt(uploadResult.sizeBytes),
              mimeType: uploadResult.mimeType || mimeType,
              checksumSha256: uploadResult.checksumSha256,
            },
          });

          // C. Construct domain ProposalDocument with authoritative binary metadata
          const document: ProposalDocument = {
            id: existingProposalDoc?.id || randomUUID(),
            proposalId: dto.proposalId,
            documentId: targetDocumentId,
            requirementCode: dto.requirementCode,
            fileName: doc.title,
            fileSize: uploadResult.sizeBytes,
            fileType: uploadResult.mimeType || mimeType,
            fileUrl: uploadResult.storagePath,
            checksumSha256: uploadResult.checksumSha256,
            uploadedAt: new Date().toISOString(),
            verificationStatus: 'pending',
          };

          // D. Mutate proposal document and update workflow state
          return await service.uploadDocumentTx(
            tx,
            tenantId,
            dto.proposalId,
            document,
            session.actorId
          );
        } catch (dbErr) {
          // Compensation cleanup if DB transaction fails: Delete ONLY this version's storagePath
          try {
            await storageProvider.delete(tenantId, storagePath);
          } catch (cleanupErr) {
            console.warn('[Storage Cleanup Error]: Failed to delete uploaded version file after DB failure:', cleanupErr);
          }
          throw dbErr;
        }
      });

      return {
        success: true,
        data: JSON.parse(JSON.stringify(updatedProposal)),
      };
    } else {
      // 6. Metadata-only legacy path (no fake Document, no fake DocumentVersion, no fake checksum)
      const document: ProposalDocument = {
        id: `doc-${Date.now()}-${dto.requirementCode}`,
        proposalId: dto.proposalId,
        requirementCode: dto.requirementCode,
        fileName: dto.fileName || `${dto.requirementCode}.pdf`,
        fileSize: dto.fileSize || 0,
        fileType: dto.fileType || 'application/pdf',
        fileUrl: dto.fileUrl || '#',
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'pending',
      };

      const updatedProposal = await service.uploadDocumentInContext(
        session.actorId,
        session.tenantId,
        dto.proposalId,
        document
      );

      return {
        success: true,
        data: JSON.parse(JSON.stringify(updatedProposal)),
      };
    }
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Verify Proposal Document
 * Enforces AuthN + AuthZ (VERIFY_DOCUMENT) ➔ delegates to application service.
 */
export async function verifyProposalDocumentAction(
  dto: VerifyProposalDocumentDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only SUPER_ADMIN, ADMIN_TENANT, VERIFIKATOR)
    assertAuthorizedAction(session, 'VERIFY_DOCUMENT');

    // 3. Validate Input DTO
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }
    if (!dto.requirementCode || typeof dto.requirementCode !== 'string') {
      throw new Error('Validation Error: requirementCode is required and must be a string.');
    }
    if (!dto.status || (dto.status !== 'verified' && dto.status !== 'rejected' && dto.status !== 'pending')) {
      throw new Error('Validation Error: status must be verified, rejected, or pending.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const updatedProposal = await service.verifyDocumentInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId,
      dto.requirementCode,
      dto.status,
      dto.notes
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Approve Proposal Generation
 * Enforces AuthN + AuthZ (APPROVE_GENERATION) ➔ triggers formal workflow transition with authoritative guard.
 */
export async function approveProposalGenerationAction(
  dto: ApproveProposalGenerationDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only SUPER_ADMIN, ADMIN_TENANT, VERIFIKATOR)
    assertAuthorizedAction(session, 'APPROVE_GENERATION');

    // 3. Validate Input DTO
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const approvedProposal = await service.approveGenerationInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(approvedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Batch Mark Generated
 * Enforces AuthN + AuthZ (MARK_GENERATED) ➔ triggers MARK_GENERATED for each proposal via workflow engine.
 */
export async function batchMarkGeneratedAction(
  dto: BatchMarkGeneratedDTO
): Promise<ActionResponse<AwardProposal[]>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy
    assertAuthorizedAction(session, 'MARK_GENERATED');

    // 3. Validate Input DTO
    if (!dto.proposalIds || !Array.isArray(dto.proposalIds) || dto.proposalIds.length === 0) {
      throw new Error('Validation Error: proposalIds must be a non-empty array of strings.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const updatedProposals = await service.batchMarkGeneratedInContext(
      session.actorId,
      session.tenantId,
      dto.proposalIds
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedProposals)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Sign Proposal
 * Enforces AuthN + AuthZ (SIGN_PROPOSAL) ➔ triggers formal workflow transition SIGN (GENERATED -> DITANDATANGANI).
 */
export async function signProposalAction(
  dto: SignProposalDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only ADMIN, VERIFIKATOR)
    assertAuthorizedAction(session, 'SIGN_PROPOSAL');

    // 3. Validate Input DTO
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const signedProposal = await service.signProposalInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(signedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Send Proposal
 * Enforces AuthN + AuthZ (SEND_PROPOSAL) ➔ triggers formal workflow transition SEND (DITANDATANGANI -> DIKIRIM).
 */
export async function sendProposalAction(
  dto: SendProposalDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only ADMIN, VERIFIKATOR, OPERATOR)
    assertAuthorizedAction(session, 'SEND_PROPOSAL');

    // 3. Validate Input DTO
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const sentProposal = await service.sendProposalInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(sentProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Archive & Complete Proposal
 * Enforces AuthN + AuthZ (ARCHIVE_COMPLETE_PROPOSAL) ➔ triggers formal workflow transition ARCHIVE_COMPLETE (DIKIRIM -> SELESAI).
 */
export async function archiveCompleteProposalAction(
  dto: ArchiveCompleteProposalDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (ADMIN, VERIFIKATOR, OPERATOR)
    assertAuthorizedAction(session, 'ARCHIVE_COMPLETE_PROPOSAL');

    // 3. Validate Input DTO
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const completedProposal = await service.archiveCompleteProposalInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(completedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Get Award Proposals
 * Resolves authenticated session server-side and retrieves all award proposals under tenant RLS boundary.
 */
export async function getAwardProposalsAction(): Promise<ActionResponse<AwardProposal[]>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (ADMIN, ADMIN_TENANT, VERIFIKATOR, OPERATOR, AUDITOR)
    assertAuthorizedAction(session, 'READ_PROPOSALS');

    // 3. Execute read in authenticated tenant context via application service
    const service = new AwardProposalApplicationService();
    const proposals = await service.getAllInContext(session.actorId, session.tenantId);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(proposals)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Import Award Proposals from Excel Dataset
 * Resolves authenticated session server-side, verifies IMPORT_PROPOSALS RBAC policy,
 * and delegates factual items array to AwardProposalApplicationService.
 */
export async function importAwardProposalsAction(
  input: ImportAwardProposalsInput
): Promise<ActionResponse<ImportAwardProposalsResult>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only ADMIN, VERIFIKATOR, OPERATOR)
    assertAuthorizedAction(session, 'IMPORT_PROPOSALS');

    // 3. Validate Inbound Boundary
    if (!input || typeof input !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Validation Error: items must be a non-empty array of proposal data.');
    }

    // 4. Execute in authenticated tenant context via application service
    const service = new AwardProposalApplicationService();
    const result = await service.importProposalsInContext(
      session.actorId,
      session.tenantId,
      input.items
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(result)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
