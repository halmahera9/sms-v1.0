import { Document } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresDocumentRepository extends BasePostgresRepository<Document> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<Document | null> {
    return await tx.document.findUnique({
      where: { id },
    });
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<Document[]> {
    return await tx.document.findMany();
  }

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: Document): Promise<Document> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      title: entity.title,
      category: entity.category,
      currentVersion: entity.currentVersion ?? 1,
      status: entity.status,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      title: entity.title,
      category: entity.category,
      currentVersion: entity.currentVersion ?? 1,
      status: entity.status,
    };

    return await tx.document.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: Document[]): Promise<Document[]> {
    const savedDocuments: Document[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedDocuments.push(saved);
    }
    return savedDocuments;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.document.delete({
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
