import { DocumentVersion } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresDocumentVersionRepository extends BasePostgresRepository<DocumentVersion> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<DocumentVersion | null> {
    return await tx.documentVersion.findUnique({
      where: { id },
    });
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<DocumentVersion[]> {
    return await tx.documentVersion.findMany();
  }

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: DocumentVersion): Promise<DocumentVersion> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      documentId: entity.documentId,
      versionNumber: entity.versionNumber,
      filePath: entity.filePath,
      fileSizeBytes: entity.fileSizeBytes,
      mimeType: entity.mimeType,
      checksumSha256: entity.checksumSha256,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      documentId: entity.documentId,
      versionNumber: entity.versionNumber,
      filePath: entity.filePath,
      fileSizeBytes: entity.fileSizeBytes,
      mimeType: entity.mimeType,
      checksumSha256: entity.checksumSha256,
    };

    return await tx.documentVersion.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: DocumentVersion[]): Promise<DocumentVersion[]> {
    const savedVersions: DocumentVersion[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedVersions.push(saved);
    }
    return savedVersions;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.documentVersion.delete({
        where: { id },
      });
      return true;
    } catch (err: unknown) {
      // Prisma code P2025 = Record to delete does not exist
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      // Security, FK violation, DB error, or trigger error MUST be thrown
      throw err;
    }
  }
}
