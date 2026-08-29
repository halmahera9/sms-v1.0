/**
 * Canonical Object Storage Contracts (Phase 4K.1)
 * Domain-agnostic, tenant-isolated binary storage specifications.
 */

export interface UploadObjectInput {
  tenantId: string;
  storagePath: string;
  content: Buffer | Uint8Array;
  mimeType?: string;
}

export interface StorageObjectMetadata {
  storagePath: string;
  sizeBytes: number;
  checksumSha256: string;
  mimeType?: string;
}

export interface IObjectStorageProvider {
  /**
   * Uploads binary content for a specific tenant and calculates real SHA-256 integrity hash.
   */
  upload(input: UploadObjectInput): Promise<StorageObjectMetadata>;

  /**
   * Downloads original binary content for a specific tenant.
   * Throws or rejects if the object does not exist in the tenant's namespace.
   */
  download(tenantId: string, storagePath: string): Promise<Buffer>;

  /**
   * Deletes an object within a specific tenant's namespace.
   * Returns true if deleted, false if not found. Never affects another tenant.
   */
  delete(tenantId: string, storagePath: string): Promise<boolean>;

  /**
   * Optional metadata retrieval without downloading full binary content.
   */
  getMetadata?(tenantId: string, storagePath: string): Promise<StorageObjectMetadata | null>;
}
