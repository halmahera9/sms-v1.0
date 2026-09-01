import 'server-only';
import { randomUUID } from 'crypto';
import {
  PublicUploadInvitationStatus,
  DocumentStatus,
  DocumentProcessingStatus,
} from '@prisma/client';
import { adminPrisma } from '@/platform/db/prisma';
import {
  getObjectStorageProvider,
  IObjectStorageProvider,
  buildDocumentStoragePath,
} from '@/platform/storage';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import { ActionResponse } from '@/platform/types/actions';
import { hashInvitationToken } from './token';
import {
  SubmitPublicDocumentUploadDTO,
  PublicUploadSubmittedDTO,
} from './types';

const auditRepo = new PostgresAuditEventRepository();

function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.startsWith('Validation Error:') ||
      msg.toLowerCase().includes('wajib') ||
      msg.toLowerCase().includes('tidak valid')
    ) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: msg,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'DOMAIN_ERROR',
        message: msg,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem upload dokumen publik.',
    },
  };
}

function resolveTargetDomain(targetEntityType?: string): string {
  const entityType = targetEntityType?.trim().toLowerCase() || '';
  if (entityType === 'student' || entityType === 'siswa') return 'student';
  if (entityType === 'employee' || entityType === 'pegawai') return 'employee';
  return entityType || 'student';
}

/**
 * Server Action: Submit Public Document Upload & Atomic Job Persistence (Phase 5E.2-A)
 *
 * Public unauthenticated upload entry point protected by capability-scoped invitation token.
 *
 * Architecture & Lifecycle Invariants:
 * 1. Public caller provides ONLY: rawToken, binary payload (fileBuffer/fileBase64), fileName, optional mimeType.
 * 2. Public caller NEVER provides: tenantId, documentId, targetEntityId, targetEntityType, documentCategory, or storagePath.
 * 3. All internal routing, tenant context, and entity bindings are resolved server-side from the invitation.
 * 4. Pessimistic concurrency control via SELECT ... FOR UPDATE serializes concurrent upload attempts.
 * 5. State re-validated post-lock (fail-closed against REVOKED, EXPIRED, SUBMITTED, MAX_ATTEMPTS_EXCEEDED).
 * 6. uploadAttempts increments strictly upon successful atomic database commit together with Document + DocumentVersion creation.
 * 7. Storage upload compensation ensures orphaned files are removed if database operations fail before commit.
 * 8. Asynchronous Processing Intent: Atomically persists a DocumentProcessingJob record with status QUEUED
 *    in the same database transaction, containing full execution context for future background workers.
 */
export async function submitPublicDocumentUploadAction(
  rawTokenOrDto: string | SubmitPublicDocumentUploadDTO,
  fileBufferArg?: Buffer | Uint8Array,
  fileNameArg?: string,
  mimeTypeArg?: string,
  storageProvider: IObjectStorageProvider = getObjectStorageProvider()
): Promise<ActionResponse<PublicUploadSubmittedDTO>> {
  try {
    let rawToken: string;
    let fileName: string;
    let fileBuffer: Buffer | Uint8Array | undefined;
    let fileBase64: string | undefined;
    let mimeType: string | undefined;

    if (typeof rawTokenOrDto === 'string') {
      rawToken = rawTokenOrDto;
      fileBuffer = fileBufferArg;
      fileName = fileNameArg || '';
      mimeType = mimeTypeArg;
    } else if (rawTokenOrDto && typeof rawTokenOrDto === 'object') {
      rawToken = rawTokenOrDto.rawToken;
      fileBuffer = rawTokenOrDto.fileBuffer;
      fileBase64 = rawTokenOrDto.fileBase64;
      fileName = rawTokenOrDto.fileName || '';
      mimeType = rawTokenOrDto.mimeType || mimeTypeArg;
    } else {
      throw new Error('Validation Error: Payload upload dokumen wajib diisi.');
    }

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new Error('Validation Error: Token undangan upload wajib diisi.');
    }

    if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
      throw new Error('Validation Error: Nama file wajib diisi.');
    }

    const hasBuffer = Boolean(fileBuffer && fileBuffer.byteLength > 0);
    const hasBase64 = Boolean(fileBase64 && fileBase64.trim().length > 0);

    if (!hasBuffer && !hasBase64) {
      throw new Error('Validation Error: Payload binary file upload wajib diisi dan tidak boleh kosong.');
    }

    if (hasBuffer && hasBase64) {
      throw new Error('Validation Error: fileBuffer dan fileBase64 tidak boleh diberikan secara bersamaan.');
    }

    const binaryBuffer = hasBuffer
      ? Buffer.from(fileBuffer!)
      : Buffer.from(fileBase64!.trim(), 'base64');

    if (binaryBuffer.byteLength === 0) {
      throw new Error('Validation Error: Payload binary file upload tidak boleh kosong.');
    }

    const tokenHash = hashInvitationToken(rawToken);

    // -----------------------------------------------------------------
    // 1. ATOMIC PERSISTENCE BOUNDARY (DB Transaction)
    // -----------------------------------------------------------------
    const txResult = await adminPrisma.$transaction(async (tx) => {
      // 1.1 Pessimistic row-level lock on public_upload_invitations row
      await tx.$executeRaw`SELECT id FROM public_upload_invitations WHERE token_hash = ${tokenHash} FOR UPDATE;`;

      // 1.2 Fetch locked invitation
      const invitation = await tx.publicUploadInvitation.findUnique({
        where: { tokenHash },
      });

      if (!invitation) {
        throw new Error('Validation Error: Undangan upload tidak ditemukan atau token tidak valid.');
      }

      // 1.3 Fail-closed invariant checks
      if (invitation.status === PublicUploadInvitationStatus.REVOKED) {
        throw new Error('Undangan upload telah dicabut oleh administrator.');
      }

      if (invitation.status === PublicUploadInvitationStatus.SUBMITTED) {
        throw new Error('Undangan upload telah digunakan sebelumnya.');
      }

      const now = new Date();
      if (invitation.status === PublicUploadInvitationStatus.EXPIRED || now > invitation.expiresAt) {
        throw new Error('Undangan upload telah kedaluwarsa.');
      }

      if (invitation.uploadAttempts >= invitation.maxUploadAttempts) {
        throw new Error('Batas maksimum percobaan upload telah tercapai.');
      }

      // 1.4 Construct canonical tenant-isolated storage path
      const tenantId = invitation.tenantId;
      const targetDocumentId = randomUUID();
      const versionId = randomUUID();
      const processingJobId = randomUUID();
      const nextVersion = 1;
      const cleanFileName = fileName.trim() || `${invitation.documentCategory}.pdf`;
      const cleanMimeType = (mimeType || 'application/pdf').trim();

      const storagePath = buildDocumentStoragePath(
        tenantId,
        targetDocumentId,
        nextVersion,
        cleanFileName
      );

      // 1.5 Upload binary to canonical object storage
      const uploadResult = await storageProvider.upload({
        tenantId,
        storagePath,
        content: binaryBuffer,
        mimeType: cleanMimeType,
      });

      try {
        // 1.6 Create canonical Document
        await tx.document.create({
          data: {
            id: targetDocumentId,
            tenantId,
            title: cleanFileName,
            category: invitation.documentCategory,
            currentVersion: 1,
            status: DocumentStatus.PENDING_VERIFICATION,
          },
        });

        // 1.7 Create canonical immutable DocumentVersion
        await tx.documentVersion.create({
          data: {
            id: versionId,
            tenantId,
            documentId: targetDocumentId,
            versionNumber: 1,
            filePath: uploadResult.storagePath,
            fileSizeBytes: BigInt(uploadResult.sizeBytes),
            mimeType: uploadResult.mimeType || cleanMimeType,
            checksumSha256: uploadResult.checksumSha256,
          },
        });

        // 1.8 Atomically consume invitation and increment uploadAttempts
        const consumedTimestamp = new Date();
        await tx.publicUploadInvitation.update({
          where: { id: invitation.id },
          data: {
            status: PublicUploadInvitationStatus.SUBMITTED,
            documentId: targetDocumentId,
            consumedAt: consumedTimestamp,
            uploadAttempts: { increment: 1 },
          },
        });

        // 1.9 Atomically persist DocumentProcessingJob (QUEUED)
        const targetDomain = resolveTargetDomain(invitation.targetEntityType);
        await tx.documentProcessingJob.create({
          data: {
            id: processingJobId,
            tenantId,
            documentId: targetDocumentId,
            documentVersionId: versionId,
            actorId: invitation.createdByUserId,
            targetDomain,
            status: DocumentProcessingStatus.QUEUED,
            attempts: 0,
            maxAttempts: 3,
            metadata: {
              invitationId: invitation.id,
              targetEntityType: invitation.targetEntityType,
              targetEntityId: invitation.targetEntityId,
              documentCategory: invitation.documentCategory,
              fileName: cleanFileName,
              fileSizeBytes: uploadResult.sizeBytes,
              checksumSha256: uploadResult.checksumSha256,
              storagePath: uploadResult.storagePath,
              mimeType: uploadResult.mimeType || cleanMimeType,
            },
          },
        });

        // 1.10 Record Audit Event for upload submission
        await auditRepo.recordTx(tx as any, tenantId, {
          actor: 'public_upload',
          action: 'PUBLIC_UPLOAD_SUBMITTED',
          entityType: 'PublicUploadInvitation',
          entityId: invitation.id,
          metadata: {
            invitationId: invitation.id,
            documentId: targetDocumentId,
            documentVersionId: versionId,
            processingJobId,
            category: invitation.documentCategory,
            targetEntityType: invitation.targetEntityType,
            targetEntityId: invitation.targetEntityId,
            fileName: cleanFileName,
            fileSizeBytes: uploadResult.sizeBytes,
            checksumSha256: uploadResult.checksumSha256,
          },
        });

        return {
          invitationId: invitation.id,
          documentId: targetDocumentId,
          documentVersionId: versionId,
          processingJobId,
          documentCategory: invitation.documentCategory,
          fileName: cleanFileName,
          fileSize: uploadResult.sizeBytes,
          checksumSha256: uploadResult.checksumSha256,
          status: PublicUploadInvitationStatus.SUBMITTED,
          consumedAt: consumedTimestamp.toISOString(),
        };
      } catch (dbErr) {
        // 1.11 Storage Compensation: Clean up newly uploaded binary if database operations fail before commit
        try {
          await storageProvider.delete(tenantId, storagePath);
        } catch (cleanupErr) {
          console.warn(
            '[Storage Cleanup Error]: Failed to delete uploaded file after DB failure:',
            cleanupErr
          );
        }
        throw dbErr;
      }
    });

    return {
      success: true,
      data: txResult,
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
