import 'server-only';
import {
  IObjectStorageProvider,
  UploadObjectInput,
  StorageObjectMetadata,
} from './types';
import { calculateSha256 } from './checksum';

interface StoredObject {
  storagePath: string;
  content: Buffer;
  sizeBytes: number;
  checksumSha256: string;
  mimeType?: string;
}

/**
 * Normalizes and validates storage paths against directory traversal and illegal characters.
 */
export function normalizeAndValidateStoragePath(storagePath: string): string {
  if (!storagePath || typeof storagePath !== 'string') {
    throw new Error('Storage Error: storagePath is required and must be a string.');
  }

  const trimmed = storagePath.trim();
  if (!trimmed) {
    throw new Error('Storage Error: storagePath cannot be empty.');
  }

  if (trimmed.includes('\0')) {
    throw new Error('Storage Security Error: storagePath contains illegal null bytes.');
  }

  // Normalize Windows backslashes to standard forward slashes
  const normalized = trimmed.replace(/\\/g, '/');

  // Strict check against path traversal (../ or ..)
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new Error('Storage Security Error: Path traversal (..) is not permitted in storagePath.');
    }
  }

  // Strip leading and trailing slashes to establish canonical relative path
  const canonicalPath = normalized.replace(/^\/+|\/+$/g, '');
  if (!canonicalPath) {
    throw new Error('Storage Error: storagePath cannot resolve to empty root path.');
  }

  return canonicalPath;
}

/**
 * In-Memory Object Storage Provider (Phase 4K.1)
 * Provides local tenant-isolated in-memory binary persistence and real SHA-256 integrity checks.
 */
export class InMemoryObjectStorageProvider implements IObjectStorageProvider {
  // Namespaced internal store: tenantId -> storagePath -> StoredObject
  private readonly storage = new Map<string, Map<string, StoredObject>>();

  private getTenantStore(tenantId: string): Map<string, StoredObject> {
    let tenantStore = this.storage.get(tenantId);
    if (!tenantStore) {
      tenantStore = new Map<string, StoredObject>();
      this.storage.set(tenantId, tenantStore);
    }
    return tenantStore;
  }

  public async upload(input: UploadObjectInput): Promise<StorageObjectMetadata> {
    if (!input || typeof input !== 'object') {
      throw new Error('Storage Error: Upload input must be a valid object.');
    }
    if (!input.tenantId || typeof input.tenantId !== 'string' || !input.tenantId.trim()) {
      throw new Error('Storage Error: tenantId is required.');
    }
    if (!input.content || !(Buffer.isBuffer(input.content) || input.content instanceof Uint8Array)) {
      throw new Error('Storage Error: content must be a valid Buffer or Uint8Array.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(input.storagePath);

    // Defensive buffer copy to prevent external mutation of stored memory
    const buffer = Buffer.from(input.content);
    const checksumSha256 = calculateSha256(buffer);
    const sizeBytes = buffer.byteLength;

    const stored: StoredObject = {
      storagePath: canonicalPath,
      content: buffer,
      sizeBytes,
      checksumSha256,
      mimeType: input.mimeType?.trim(),
    };

    const tenantStore = this.getTenantStore(input.tenantId.trim());
    tenantStore.set(canonicalPath, stored);

    return {
      storagePath: canonicalPath,
      checksumSha256,
      sizeBytes,
      mimeType: stored.mimeType,
    };
  }

  public async download(tenantId: string, storagePath: string): Promise<Buffer> {
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new Error('Storage Error: tenantId is required.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(storagePath);

    const tenantStore = this.storage.get(tenantId.trim());
    if (!tenantStore) {
      throw new Error(`Storage Error: Object not found at path '${canonicalPath}' for tenant.`);
    }

    const stored = tenantStore.get(canonicalPath);
    if (!stored) {
      throw new Error(`Storage Error: Object not found at path '${canonicalPath}' for tenant.`);
    }

    // Defensive copy on download to prevent external caller mutating internal store
    return Buffer.from(stored.content);
  }

  public async delete(tenantId: string, storagePath: string): Promise<boolean> {
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new Error('Storage Error: tenantId is required.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(storagePath);

    const tenantStore = this.storage.get(tenantId.trim());
    if (!tenantStore) {
      return false;
    }

    return tenantStore.delete(canonicalPath);
  }

  public async getMetadata(tenantId: string, storagePath: string): Promise<StorageObjectMetadata | null> {
    if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new Error('Storage Error: tenantId is required.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(storagePath);

    const tenantStore = this.storage.get(tenantId.trim());
    if (!tenantStore) {
      return null;
    }

    const stored = tenantStore.get(canonicalPath);
    if (!stored) {
      return null;
    }

    return {
      storagePath: stored.storagePath,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256,
      mimeType: stored.mimeType,
    };
  }

  public clear(): void {
    this.storage.clear();
  }
}
