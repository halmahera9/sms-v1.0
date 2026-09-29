import { OCRExtractionStatus, DocumentCategory } from '@prisma/client';

export interface DocumentOCRResultDTO {
  id: string;
  documentId: string;
  documentVersionId: string | null;
  versionNumber: number;
  fileName: string;
  category: DocumentCategory;
  categoryLabel: string;
  status: OCRExtractionStatus;
  statusLabel: string;
  extractedText: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  storageKey: string | null;
  checksumSha256: string | null;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentForOCRItemDTO {
  documentId: string;
  versionId: string;
  versionNumber: number;
  fileName: string;
  category: DocumentCategory;
  categoryLabel: string;
  fileSizeFormatted: string;
  mimeType: string;
  storageKey: string | null;
  checksumSha256: string | null;
  receivedAt: string;
  ocrStatus: OCRExtractionStatus | 'NOT_STARTED';
  ocrStatusLabel: string;
  hasOCRResult: boolean;
  ocrExtractionId?: string;
  completedAt?: string | null;
}

/**
 * Standard Indonesian terminology for Document Reading (OCR) status.
 */
export const OCR_STATUS_LABELS: Record<OCRExtractionStatus | 'NOT_STARTED', string> = {
  NOT_STARTED: 'Belum Dibaca',
  QUEUED: 'Menunggu Pembacaan',
  PROCESSING: 'Sedang Dibaca',
  COMPLETED: 'Selesai Dibaca (Siap Diekstraksi)',
  FAILED: 'Gagal Dibaca (Perlu Diperiksa)',
};
