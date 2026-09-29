'use server';

import { randomUUID } from 'crypto';
import { DocumentCategory, DocumentStatus, Prisma } from '@prisma/client';
import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { getObjectStorageProvider, buildDocumentStoragePath } from '@/platform/storage';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import type { ActionResponse } from '@/platform/types';
import {
  DocumentFilterDTO,
  DocumentListResultDTO,
  DocumentRecordDTO,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatBytesToIndonesian,
} from '@/platform/types/document';

const auditRepo = new PostgresAuditEventRepository();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

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

  if (
    err instanceof Error &&
    (err.message.startsWith('SECURITY ERROR:') ||
      err.message.startsWith('SECURITY/SCHEMA ERROR:'))
  ) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Akses ditolak oleh kebijakan keamanan data.',
      },
    };
  }

  console.error('[Document Intake Action Error]:', err);

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memproses penerimaan dokumen.',
    },
  };
}

/**
 * Lists documents with filtering, search, and pagination.
 */
export async function listDocumentsAction(
  filter: DocumentFilterDTO = {}
): Promise<ActionResponse<DocumentListResultDTO>> {
  try {
    return await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'DOCUMENT_READ');

      const page = Math.max(1, filter.page ?? 1);
      const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
      const skip = (page - 1) * limit;

      const where: Prisma.DocumentWhereInput = {
        tenantId: context.tenantId,
      };

      if (filter.search && filter.search.trim()) {
        const query = filter.search.trim();
        where.title = { contains: query, mode: 'insensitive' };
      }

      if (filter.category && filter.category !== 'ALL') {
        where.category = filter.category;
      }

      if (filter.status && filter.status !== 'ALL') {
        where.status = filter.status;
      }

      if (filter.source && filter.source !== 'ALL') {
        where.source = filter.source;
      }

      const [total, documents] = await Promise.all([
        tx.document.count({ where }),
        tx.document.findMany({
          where,
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const items: DocumentRecordDTO[] = documents.map((doc) => {
        const latestVersion = doc.versions[0];
        const fileSizeBytes = latestVersion ? Number(latestVersion.fileSizeBytes) : 0;
        const mimeType = latestVersion?.mimeType || 'application/octet-stream';
        const storageKey = latestVersion?.storageKey || latestVersion?.filePath || null;
        const storageStatus = latestVersion?.storageStatus || 'ACTIVE';
        const checksumSha256 = latestVersion?.checksumSha256 || null;

        return {
          id: doc.id,
          tenantId: doc.tenantId,
          title: doc.title,
          category: doc.category,
          categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category,
          source: doc.source,
          sourceLabel: DOCUMENT_SOURCE_LABELS[doc.source] || doc.source,
          currentVersion: doc.currentVersion,
          status: doc.status,
          statusLabel: DOCUMENT_STATUS_LABELS[doc.status] || doc.status,
          fileSizeBytes,
          fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
          mimeType,
          checksumSha256,
          storageKey,
          storageStatus,
          retentionUntil: doc.retentionUntil ? doc.retentionUntil.toISOString() : null,
          archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
          archiveLocation: doc.archiveLocation,
          isTemporary: doc.isTemporary,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        };
      });

      return {
        success: true,
        data: {
          documents: items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Upload and save a document directly into the intake repository.
 */
export async function uploadDocumentIntakeAction(
  formData: FormData
): Promise<ActionResponse<DocumentRecordDTO>> {
  try {
    const file = formData.get('file');
    const categoryRaw = formData.get('category');
    const isTemporaryRaw = formData.get('isTemporary');

    if (!(file instanceof File) || file.size === 0) {
      throw new Error('Validation Error: Berkas dokumen wajib dipilih dan tidak boleh kosong.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `Validation Error: Ukuran berkas (${formatBytesToIndonesian(
          file.size
        )}) melebihi batas maksimal 50MB.`
      );
    }

    const cleanFileName = file.name.trim();
    if (!cleanFileName) {
      throw new Error('Validation Error: Nama berkas tidak valid.');
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        'Validation Error: Format berkas tidak didukung. Format yang diizinkan: PDF, PNG, JPG, JPEG, WEBP.'
      );
    }

    let category: DocumentCategory = DocumentCategory.LAINNYA;
    if (
      categoryRaw &&
      typeof categoryRaw === 'string' &&
      Object.values(DocumentCategory).includes(categoryRaw as DocumentCategory)
    ) {
      category = categoryRaw as DocumentCategory;
    }

    const isTemporary = isTemporaryRaw === 'true' || isTemporaryRaw === '1';

    const arrayBuffer = await file.arrayBuffer();
    const binaryBuffer = Buffer.from(arrayBuffer);

    return await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'DOCUMENT_UPLOAD');

      const documentId = randomUUID();
      const versionId = randomUUID();

      const storageProvider = getObjectStorageProvider();
      const storagePath = buildDocumentStoragePath(
        context.tenantId,
        documentId,
        1,
        cleanFileName
      );

      // Upload original binary without aggressive compression
      const uploadResult = await storageProvider.upload({
        tenantId: context.tenantId,
        storagePath,
        content: binaryBuffer,
        mimeType,
      });

      // Atomic persistence of Document and DocumentVersion
      const createdDoc = await tx.document.create({
        data: {
          id: documentId,
          tenantId: context.tenantId,
          title: cleanFileName,
          category,
          source: 'UNGGAH_LANGSUNG',
          currentVersion: 1,
          status: DocumentStatus.DRAFT, // Diterima / Siap Diproses
          isTemporary,
        },
      });

      const createdVersion = await tx.documentVersion.create({
        data: {
          id: versionId,
          tenantId: context.tenantId,
          documentId,
          versionNumber: 1,
          filePath: uploadResult.storagePath,
          storageKey: uploadResult.storagePath,
          storageStatus: 'ACTIVE',
          fileSizeBytes: BigInt(uploadResult.sizeBytes),
          mimeType: uploadResult.mimeType || mimeType,
          checksumSha256: uploadResult.checksumSha256,
        },
      });

      // Audit Trail Logging
      await auditRepo.recordTx(tx, context.tenantId, {
        actorUserId: context.actorId,
        action: 'DOCUMENT_INTAKE_SUCCESS',
        entityType: 'Document',
        entityId: documentId,
        metadata: {
          fileName: cleanFileName,
          category,
          source: 'UNGGAH_LANGSUNG',
          fileSizeBytes: uploadResult.sizeBytes,
          checksumSha256: uploadResult.checksumSha256,
          isTemporary,
        },
      });

      const fileSizeBytes = Number(createdVersion.fileSizeBytes);

      const record: DocumentRecordDTO = {
        id: createdDoc.id,
        tenantId: createdDoc.tenantId,
        title: createdDoc.title,
        category: createdDoc.category,
        categoryLabel: DOCUMENT_CATEGORY_LABELS[createdDoc.category] || createdDoc.category,
        source: createdDoc.source,
        sourceLabel: DOCUMENT_SOURCE_LABELS[createdDoc.source] || createdDoc.source,
        currentVersion: createdDoc.currentVersion,
        status: createdDoc.status,
        statusLabel: DOCUMENT_STATUS_LABELS[createdDoc.status] || createdDoc.status,
        fileSizeBytes,
        fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
        mimeType: createdVersion.mimeType,
        checksumSha256: createdVersion.checksumSha256,
        storageKey: createdVersion.storageKey,
        storageStatus: createdVersion.storageStatus,
        retentionUntil: createdDoc.retentionUntil ? createdDoc.retentionUntil.toISOString() : null,
        archivedAt: createdDoc.archivedAt ? createdDoc.archivedAt.toISOString() : null,
        archiveLocation: createdDoc.archiveLocation,
        isTemporary: createdDoc.isTemporary,
        createdAt: createdDoc.createdAt.toISOString(),
        updatedAt: createdDoc.updatedAt.toISOString(),
      };

      return {
        success: true,
        data: record,
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}

/**
 * Retrieves a document and all its versions by ID.
 */
export async function getDocumentDetailsAction(
  documentId: string
): Promise<ActionResponse<DocumentRecordDTO>> {
  try {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Validation Error: ID Dokumen tidak sah.');
    }

    return await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'DOCUMENT_READ');

      const doc = await tx.document.findUnique({
        where: { id: documentId },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
          },
        },
      });

      if (!doc || doc.tenantId !== context.tenantId) {
        throw new Error('Validation Error: Dokumen tidak ditemukan dalam repositori sekolah.');
      }

      const latestVersion = doc.versions[0];
      const fileSizeBytes = latestVersion ? Number(latestVersion.fileSizeBytes) : 0;
      const mimeType = latestVersion?.mimeType || 'application/octet-stream';
      const storageKey = latestVersion?.storageKey || latestVersion?.filePath || null;
      const storageStatus = latestVersion?.storageStatus || 'ACTIVE';
      const checksumSha256 = latestVersion?.checksumSha256 || null;

      const versions = doc.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        filePath: v.filePath,
        storageKey: v.storageKey,
        storageStatus: v.storageStatus,
        fileSizeBytes: Number(v.fileSizeBytes),
        fileSizeFormatted: formatBytesToIndonesian(v.fileSizeBytes),
        mimeType: v.mimeType,
        checksumSha256: v.checksumSha256,
        createdAt: v.createdAt.toISOString(),
      }));

      const record: DocumentRecordDTO = {
        id: doc.id,
        tenantId: doc.tenantId,
        title: doc.title,
        category: doc.category,
        categoryLabel: DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category,
        source: doc.source,
        sourceLabel: DOCUMENT_SOURCE_LABELS[doc.source] || doc.source,
        currentVersion: doc.currentVersion,
        status: doc.status,
        statusLabel: DOCUMENT_STATUS_LABELS[doc.status] || doc.status,
        fileSizeBytes,
        fileSizeFormatted: formatBytesToIndonesian(fileSizeBytes),
        mimeType,
        checksumSha256,
        storageKey,
        storageStatus,
        retentionUntil: doc.retentionUntil ? doc.retentionUntil.toISOString() : null,
        archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
        archiveLocation: doc.archiveLocation,
        isTemporary: doc.isTemporary,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        versions,
      };

      return {
        success: true,
        data: record,
      };
    });
  } catch (err) {
    return handleActionError(err);
  }
}
