'use server';

import { randomUUID } from 'crypto';
import { DocumentCategory, DocumentProcessingStatus, DocumentStatus } from '@prisma/client';
import { executeInAuthenticatedContext } from '@/platform/auth/session';
import { assertAuthorizedAction } from '@/platform/auth/guards';
import { getObjectStorageProvider } from '@/platform/storage';
import { DocumentProcessingJobRunner } from '@/platform/services/document-processing-runner';

export async function processUploadedOCRDocumentAction(
  formData: FormData
) {
  try {
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: 'File dokumen wajib dipilih.' };
    }

    const fileName = file.name.trim();
    const mimeType = file.type || 'application/octet-stream';
    const buffer = Buffer.from(await file.arrayBuffer());

    const created = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'STUDENT_WORKFLOW_UPLOAD');

      const documentId = randomUUID();
      const versionId = randomUUID();
      const jobId = randomUUID();

      const storagePath =
        `documents/${context.tenantId}/${documentId}/1/${fileName}`;

      const storage = getObjectStorageProvider();

      const uploaded = await storage.upload({
        tenantId: context.tenantId,
        storagePath,
        content: buffer,
        mimeType,
      });

      await tx.document.create({
        data: {
          id: documentId,
          tenantId: context.tenantId,
          title: fileName,
          category: DocumentCategory.LAINNYA,
          currentVersion: 1,
          status: DocumentStatus.PENDING_VERIFICATION,
        },
      });

      await tx.documentVersion.create({
        data: {
          id: versionId,
          tenantId: context.tenantId,
          documentId,
          versionNumber: 1,
          filePath: uploaded.storagePath,
          fileSizeBytes: BigInt(uploaded.sizeBytes),
          mimeType: uploaded.mimeType || mimeType,
          checksumSha256: uploaded.checksumSha256,
        },
      });

      await tx.documentProcessingJob.create({
        data: {
          id: jobId,
          tenantId: context.tenantId,
          documentId,
          documentVersionId: versionId,
          actorId: context.actorId,
          targetDomain:
            /pegawai|guru|ptk|employee/i.test(fileName)
              ? 'employee'
              : 'student',
          status: DocumentProcessingStatus.QUEUED,
          attempts: 0,
          maxAttempts: 3,
          metadata: {
            fileName,
            mimeType,
            storagePath: uploaded.storagePath,
          },
        },
      });

      return {
        tenantId: context.tenantId,
        documentId,
        jobId,
      };
    });

    // Transaction sudah committed. Sekarang worker aman dijalankan.
    const runner = new DocumentProcessingJobRunner();
    const processing = await runner.executeJob(
      created.tenantId,
      created.jobId
    );

    if (!processing.success) {
      return {
        success: false,
        error: processing.error || 'Dokumen gagal diproses oleh OCR.',
      };
    }

    return {
      success: true,
      data: {
        documentId: created.documentId,
        jobId: created.jobId,
        status: processing.finalStatus,
      },
    };
  } catch (error) {
    console.error('[OCR Upload]', error);

    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Gagal memproses dokumen OCR.',
    };
  }
}
