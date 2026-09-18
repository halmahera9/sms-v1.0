import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import {
  IObjectStorageProvider,
  UploadObjectInput,
  StorageObjectMetadata,
} from './types';
import { calculateSha256 } from './checksum';
import { normalizeAndValidateStoragePath } from './in-memory';

const STORAGE_ROOT = path.resolve(
  process.env.OBJECT_STORAGE_ROOT || '.data/object-storage'
);

export class FileSystemObjectStorageProvider implements IObjectStorageProvider {
  private resolveObjectPath(tenantId: string, storagePath: string): string {
    if (!tenantId || !tenantId.trim()) {
      throw new Error('Storage Error: tenantId is required.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(storagePath);
    const tenantRoot = path.resolve(STORAGE_ROOT, tenantId.trim());
    const objectPath = path.resolve(tenantRoot, canonicalPath);

    if (!objectPath.startsWith(`${tenantRoot}${path.sep}`)) {
      throw new Error('Storage Security Error: object path escapes tenant namespace.');
    }

    return objectPath;
  }

  async upload(input: UploadObjectInput): Promise<StorageObjectMetadata> {
    if (!input?.content) {
      throw new Error('Storage Error: content is required.');
    }

    const canonicalPath = normalizeAndValidateStoragePath(input.storagePath);
    const objectPath = this.resolveObjectPath(input.tenantId, canonicalPath);
    const buffer = Buffer.from(input.content);

    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    await fs.writeFile(objectPath, buffer);

    return {
      storagePath: canonicalPath,
      sizeBytes: buffer.byteLength,
      checksumSha256: calculateSha256(buffer),
      mimeType: input.mimeType?.trim(),
    };
  }

  async download(tenantId: string, storagePath: string): Promise<Buffer> {
    const canonicalPath = normalizeAndValidateStoragePath(storagePath);
    const objectPath = this.resolveObjectPath(tenantId, canonicalPath);

    try {
      return await fs.readFile(objectPath);
    } catch {
      throw new Error(
        `Storage Error: Object not found at path '${canonicalPath}' for tenant.`
      );
    }
  }

  async delete(tenantId: string, storagePath: string): Promise<boolean> {
    const canonicalPath = normalizeAndValidateStoragePath(storagePath);
    const objectPath = this.resolveObjectPath(tenantId, canonicalPath);

    try {
      await fs.unlink(objectPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(
    tenantId: string,
    storagePath: string
  ): Promise<StorageObjectMetadata | null> {
    const canonicalPath = normalizeAndValidateStoragePath(storagePath);
    const objectPath = this.resolveObjectPath(tenantId, canonicalPath);

    try {
      const stat = await fs.stat(objectPath);
      const content = await fs.readFile(objectPath);

      return {
        storagePath: canonicalPath,
        sizeBytes: stat.size,
        checksumSha256: calculateSha256(content),
      };
    } catch {
      return null;
    }
  }
}
