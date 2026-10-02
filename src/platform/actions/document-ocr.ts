'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import type { ActionResponse } from '@/platform/types';
import { DocumentOCRService } from '@/platform/services/document-ocr';
import { DocumentOCRResultDTO, DocumentForOCRItemDTO, OCR_STATUS_LABELS } from '@/platform/types/ocr';
import { uploadDocumentIntakeAction } from '@/platform/actions/document';
import { DOCUMENT_CATEGORY_LABELS, formatBytesToIndonesian } from '@/platform/types/document';
import { OCRExtractionStatus, Prisma } from '@prisma/client';

function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: err.message },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: err.message },
    };
  }

  if (err instanceof Error && err.message.startsWith('Validation Error:')) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    };
  }

  console.error('[Document OCR Action Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memproses pembacaan dokumen.',
    },
  };
}

/**
 * Initiates OCR reading on an existing document in the school repository.
 */
export async function readDocumentOCRAction(
  documentId: string,
  versionId?: string
): Promise<ActionResponse<DocumentOCRResultDTO>> {
  try {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Validation Error: ID Dokumen tidak sah.');
    }

    return await executeInAuthenticatedContext(async (context) => {
      assertAuthorizedAction(context, 'OCR_EXECUTE');

      const ocrService = new DocumentOCRService();
      const result = await ocrService.readDocumentText({
        tenantId: context.tenantId,
        actorId: context.actorId,
        documentId,
        documentVersionId: versionId,
      });

      return {
        success: true,
        data: result,
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Gets the latest OCR reading result for a document.
 */
export async function getDocumentOCRResultAction(
  documentId: string
): Promise<ActionResponse<DocumentOCRResultDTO | null>> {
  try {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Validation Error: ID Dokumen tidak sah.');
    }

    return await executeInAuthenticatedContext(async (context) => {
      assertAuthorizedAction(context, 'OCR_READ');

      const ocrService = new DocumentOCRService();
      const result = await ocrService.getLatestOCRResult(context.tenantId, documentId);

      return {
        success: true,
        data: result,
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Lists documents with their current OCR reading status.
 */
export async function listDocumentsForOCRAction(
  searchQuery?: string
): Promise<ActionResponse<DocumentForOCRItemDTO[]>> {
  try {
    return await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'OCR_READ');

      const where: Prisma.DocumentWhereInput = {
        tenantId: context.tenantId,
      };

      if (searchQuery && searchQuery.trim()) {
        where.title = { contains: searchQuery.trim(), mode: 'insensitive' };
      }

      const docs = await tx.document.findMany({
        where,
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
          ocrExtractions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const items: DocumentForOCRItemDTO[] = docs.map((doc) => {
        const latestVersion = doc.versions[0];
        const latestOCR = doc.ocrExtractions[0];

        const ocrStatus: OCRExtractionStatus | 'NOT_STARTED' = latestOCR
          ? latestOCR.status
          : 'NOT_STARTED';

        const fileSizeBytes = latestVersion ? Number(latestVersion.fileSizeBytes) : 0;

        return {
          documentId: doc.id,
          versionId: latestVersion ? latestVersion.id : '',
          versionNumber: latestVersion ? latestVersion.versionNumber : 1,
          fileName: doc.title,
          category: doc.category,
          categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category,
          fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
          mimeType: latestVersion ? latestVersion.mimeType : 'application/octet-stream',
          storageKey: latestVersion ? (latestVersion.storageKey || latestVersion.filePath) : null,
          checksumSha256: latestVersion ? latestVersion.checksumSha256 : null,
          receivedAt: doc.createdAt.toISOString(),
          ocrStatus,
          ocrStatusLabel: OCR_STATUS_LABELS[ocrStatus],
          hasOCRResult: latestOCR?.status === OCRExtractionStatus.COMPLETED && !!latestOCR.extractedText,
          ocrExtractionId: latestOCR?.id,
          completedAt: latestOCR?.completedAt ? latestOCR.completedAt.toISOString() : null,
        };
      });

      return {
        success: true,
        data: items,
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Uploads a new document and runs OCR text reading on it.
 */
export async function uploadAndReadDocumentOCRAction(
  formData: FormData
): Promise<ActionResponse<DocumentOCRResultDTO>> {
  try {
    // 1. Upload via Document Intake Action (creates Document & DocumentVersion with sha256 & storageKey)
    const uploadRes = await uploadDocumentIntakeAction(formData);

    if (!uploadRes.success || !uploadRes.data) {
      return {
        success: false,
        error: uploadRes.error || {
          code: 'INTERNAL_ERROR',
          message: 'Gagal mengunggah dokumen.',
        },
      };
    }

    const documentId = uploadRes.data.id;

    // 2. Perform OCR reading
    return await readDocumentOCRAction(documentId);
  } catch (err) {
    return handleActionError(err);
  }
}
