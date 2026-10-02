import { DocumentCategory, DocumentStatus } from '@prisma/client';

export type DocumentSourceType = 'UNGGAH_LANGSUNG' | 'TAUTAN_PUBLIK' | 'SISTEM_LAIN';

export interface DocumentVersionDTO {
  id: string;
  versionNumber: number;
  filePath: string;
  storageKey: string | null;
  storageStatus: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  mimeType: string;
  checksumSha256: string | null;
  createdAt: string;
}

export interface DocumentRecordDTO {
  id: string;
  tenantId: string;
  title: string;
  category: DocumentCategory;
  categoryLabel: string;
  source: string;
  sourceLabel: string;
  currentVersion: number;
  status: DocumentStatus;
  statusLabel: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  mimeType: string;
  checksumSha256: string | null;
  storageKey: string | null;
  storageStatus: string;
  retentionUntil: string | null;
  archivedAt: string | null;
  archiveLocation: string | null;
  isTemporary: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersionDTO[];
}

export interface DocumentFilterDTO {
  search?: string;
  category?: DocumentCategory | 'ALL';
  source?: string | 'ALL';
  status?: DocumentStatus | 'ALL';
  page?: number;
  limit?: number;
}

export interface DocumentListResultDTO {
  documents: DocumentRecordDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UploadDocumentInputDTO {
  category?: DocumentCategory;
  isTemporary?: boolean;
}

/**
 * Indonesian labels for document categories.
 */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  KARTU_KELUARGA: 'Kartu Keluarga',
  KTP: 'KTP / Identitas Kependudukan',
  AKTA_KELAHIRAN: 'Akta Kelahiran',
  IJAZAH: 'Ijazah',
  RAPOR: 'Buku Rapor',
  SERTIFIKAT: 'Sertifikat / Piagam',
  SURAT_PERNYATAAN: 'Surat Pernyataan',
  SURAT_PERMOHONAN: 'Surat Permohonan',
  SURAT_TUGAS: 'Surat Tugas',
  SURAT_KEPUTUSAN: 'Surat Keputusan (SK)',
  LAINNYA: 'Dokumen Lainnya',
};

/**
 * Standard Indonesian labels for document source.
 */
export const DOCUMENT_SOURCE_LABELS: Record<string, string> = {
  UNGGAH_LANGSUNG: 'Unggah Langsung',
  TAUTAN_PUBLIK: 'Tautan Publik',
  SISTEM_LAIN: 'Sistem Eksternal',
};

/**
 * Indonesian terminology for Document statuses.
 * - Diterima (DRAFT / initial intake)
 * - Siap Diproses (DRAFT / ready)
 * - Sedang Diproses (PROCESSING)
 * - Selesai (VERIFIED)
 * - Perlu Diperiksa (PENDING_VERIFICATION)
 * - Gagal (REJECTED)
 * - Diarsipkan (ARCHIVED)
 */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Diterima',
  PENDING_VERIFICATION: 'Perlu Diperiksa',
  VERIFIED: 'Selesai',
  REJECTED: 'Gagal',
  ARCHIVED: 'Diarsipkan',
};

export function formatBytesToIndonesian(bytes: number | bigint): string {
  const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (num === 0 || isNaN(num)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
