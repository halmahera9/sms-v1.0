import 'server-only';

/**
 * Builds canonical tenant-isolated storage path for a document version.
 * Shape: tenants/{tenantId}/documents/{documentId}/v{versionNumber}-{sanitizedFilename}
 *
 * @param tenantId The owning tenant UUID.
 * @param documentId The document UUID.
 * @param versionNumber The version integer (e.g. 1).
 * @param fileName The original file name.
 * @returns Normalized canonical relative storage path.
 */
export function buildDocumentStoragePath(
  tenantId: string,
  documentId: string,
  versionNumber: number,
  fileName: string
): string {
  const cleanTenantId = tenantId.trim();
  const cleanDocId = documentId.trim();
  const sanitizedName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  return `tenants/${cleanTenantId}/documents/${cleanDocId}/v${versionNumber}-${sanitizedName || 'file'}`;
}
