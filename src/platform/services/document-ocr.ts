import 'server-only';

import { randomUUID } from 'crypto';
import { OCRExtractionStatus, PrismaClient } from '@prisma/client';
import { adminPrisma } from '@/platform/db/prisma';
import { getObjectStorageProvider, IObjectStorageProvider } from '@/platform/storage';
import { getDocumentExtractor } from '@/platform/services/document-extractor';
import { IDocumentExtractor } from '@/platform/types/document-extractor';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import { DOCUMENT_CATEGORY_LABELS, formatBytesToIndonesian } from '@/platform/types/document';
import { DocumentOCRResultDTO, OCR_STATUS_LABELS } from '@/platform/types/ocr';

const auditRepo = new PostgresAuditEventRepository();

export interface ProcessDocumentOCRParams {
  tenantId: string;
  actorId?: string;
  documentId: string;
  documentVersionId?: string;
}

export class DocumentOCRService {
  constructor(
    private readonly prisma: PrismaClient = adminPrisma,
    private readonly storageProvider: IObjectStorageProvider = getObjectStorageProvider(),
    private readonly extractor: IDocumentExtractor = getDocumentExtractor()
  ) {}

  /**
   * Executes OCR text reading on a document's original binary stored in object storage.
   * Stores the raw text reading in OCRExtraction linked to Document & DocumentVersion.
   * Does NOT perform field extraction or data matching (P0-H boundary).
   */
  public async readDocumentText(
    params: ProcessDocumentOCRParams
  ): Promise<DocumentOCRResultDTO> {
    const { tenantId, actorId, documentId, documentVersionId } = params;

    // 1. Fetch document and target version under tenant isolation
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!doc) {
      throw new Error('Validation Error: Dokumen tidak ditemukan dalam data sekolah.');
    }

    const version = documentVersionId
      ? doc.versions.find((v) => v.id === documentVersionId)
      : doc.versions[0];

    if (!version) {
      throw new Error('Validation Error: Versi berkas dokumen tidak ditemukan.');
    }

    const targetStorageKey = version.storageKey || version.filePath;
    if (!targetStorageKey) {
      throw new Error('Validation Error: Kunci lokasi penyimpanan berkas tidak tersedia.');
    }

    // 2. Download original binary from object storage (original file is never stored in DB)
    const fileBuffer = await this.storageProvider.download(tenantId, targetStorageKey);
    if (!fileBuffer || fileBuffer.byteLength === 0) {
      throw new Error('Validation Error: Berkas dokumen pada repositori penyimpanan kosong.');
    }

    // 3. Create or update OCRExtraction record in PROCESSING state
    const startedAt = new Date();
    const existingExtraction = await this.prisma.oCRExtraction.findFirst({
      where: {
        tenantId,
        documentId: doc.id,
        documentVersionId: version.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const extractionId = existingExtraction ? existingExtraction.id : randomUUID();

    if (existingExtraction) {
      await this.prisma.oCRExtraction.update({
        where: { id: existingExtraction.id },
        data: {
          status: OCRExtractionStatus.PROCESSING,
          startedAt,
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.oCRExtraction.create({
        data: {
          id: extractionId,
          tenantId,
          documentId: doc.id,
          documentVersionId: version.id,
          status: OCRExtractionStatus.PROCESSING,
          startedAt,
        },
      });
    }

    // 4. Perform OCR reading pass through the extractor
    let extractedText = '';
    let errorMessage: string | null = null;
    let finalStatus: OCRExtractionStatus = OCRExtractionStatus.COMPLETED;
    const completedAt = new Date();

    try {
      const extractionResult = await this.extractor.extract({
        tenantId,
        content: fileBuffer,
        mimeType: version.mimeType,
        fileName: doc.title,
        documentId: doc.id,
        documentVersionId: version.id,
      });

      if (!extractionResult.success) {
        finalStatus = OCRExtractionStatus.FAILED;
        errorMessage = extractionResult.errorMessage || 'Pembacaan OCR tidak menghasilkan teks.';
      } else {
        extractedText = extractionResult.rawText?.trim() || '';
        if (!extractedText && extractionResult.items.length > 0) {
          extractedText = extractionResult.items
            .map((item: { ocrText?: string; name?: string }) => item.ocrText || item.name || '')
            .filter(Boolean)
            .join('\n');
        }

        if (!extractedText) {
          finalStatus = OCRExtractionStatus.FAILED;
          errorMessage = 'Teks tidak terdeteksi pada berkas dokumen ini.';
        }
      }
    } catch (err: unknown) {
      finalStatus = OCRExtractionStatus.FAILED;
      errorMessage =
        err instanceof Error ? err.message : 'Terjadi kegagalan saat menjalankan proses pembacaan OCR.';
    }

    // 5. Atomically persist reading result
    const updatedExtraction = await this.prisma.oCRExtraction.update({
      where: { id: extractionId },
      data: {
        status: finalStatus,
        extractedText: finalStatus === OCRExtractionStatus.COMPLETED ? extractedText : null,
        errorMessage,
        completedAt,
        rawJson: {
          charCount: extractedText.length,
          lineCount: extractedText ? extractedText.split('\n').length : 0,
          completedAt: completedAt.toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    // 6. Audit Logging (GAP-04)
    if (actorId) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await auditRepo.recordTx(tx, tenantId, {
            actorUserId: actorId,
            action: finalStatus === OCRExtractionStatus.COMPLETED ? 'DOCUMENT_OCR_SUCCESS' : 'DOCUMENT_OCR_FAILED',
            entityType: 'OCRExtraction',
            entityId: extractionId,
            metadata: {
              documentId: doc.id,
              documentVersionId: version.id,
              status: finalStatus,
              charCount: extractedText.length,
              errorMessage,
            },
          });
        });
      } catch (auditErr) {
        console.warn('[Audit Log Warning]: Failed to record OCR audit event:', auditErr);
      }
    }

    const durationMs = completedAt.getTime() - startedAt.getTime();
    const fileSizeBytes = Number(version.fileSizeBytes);

    return {
      id: updatedExtraction.id,
      documentId: doc.id,
      documentVersionId: version.id,
      versionNumber: version.versionNumber,
      fileName: doc.title,
      category: doc.category,
      categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category,
      status: updatedExtraction.status,
      statusLabel: OCR_STATUS_LABELS[updatedExtraction.status],
      extractedText: updatedExtraction.extractedText,
      errorMessage: updatedExtraction.errorMessage,
      startedAt: updatedExtraction.startedAt?.toISOString() || null,
      completedAt: updatedExtraction.completedAt?.toISOString() || null,
      durationMs,
      storageKey: version.storageKey,
      checksumSha256: version.checksumSha256,
      fileSizeBytes,
      fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
      mimeType: version.mimeType,
      createdAt: updatedExtraction.createdAt.toISOString(),
      updatedAt: updatedExtraction.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves the latest OCR reading result for a document.
   */
  public async getLatestOCRResult(
    tenantId: string,
    documentId: string
  ): Promise<DocumentOCRResultDTO | null> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!doc) return null;

    const latestVersion = doc.versions[0];
    if (!latestVersion) return null;

    const extraction = await this.prisma.oCRExtraction.findFirst({
      where: {
        tenantId,
        documentId: doc.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!extraction) return null;

    const fileSizeBytes = Number(latestVersion.fileSizeBytes);
    const durationMs =
      extraction.startedAt && extraction.completedAt
        ? extraction.completedAt.getTime() - extraction.startedAt.getTime()
        : null;

    return {
      id: extraction.id,
      documentId: doc.id,
      documentVersionId: extraction.documentVersionId || latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      fileName: doc.title,
      category: doc.category,
      categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category,
      status: extraction.status,
      statusLabel: OCR_STATUS_LABELS[extraction.status],
      extractedText: extraction.extractedText,
      errorMessage: extraction.errorMessage,
      startedAt: extraction.startedAt?.toISOString() || null,
      completedAt: extraction.completedAt?.toISOString() || null,
      durationMs,
      storageKey: latestVersion.storageKey,
      checksumSha256: latestVersion.checksumSha256,
      fileSizeBytes,
      fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
      mimeType: latestVersion.mimeType,
      createdAt: extraction.createdAt.toISOString(),
      updatedAt: extraction.updatedAt.toISOString(),
    };
  }
}
