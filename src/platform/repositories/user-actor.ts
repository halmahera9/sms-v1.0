import { UserActor } from '@prisma/client';
import { TenantTransactionClient } from '../db/tenant-context';
import { BasePostgresRepository } from './postgres-base';

export class PostgresUserActorRepository extends BasePostgresRepository<UserActor> {
  public async findByIdTx(tx: TenantTransactionClient, id: string): Promise<UserActor | null> {
    return await tx.userActor.findUnique({
      where: { id },
    });
  }

  public async findAllTx(tx: TenantTransactionClient): Promise<UserActor[]> {
    return await tx.userActor.findMany();
  }

  public async saveTx(tx: TenantTransactionClient, tenantId: string, entity: UserActor): Promise<UserActor> {
    // Application-level invariant check
    this.assertTenantConsistency(entity, tenantId);

    // Create payload includes tenantId
    const createPayload = {
      id: entity.id,
      tenantId: entity.tenantId,
      username: entity.username,
      email: entity.email,
      fullName: entity.fullName,
      role: entity.role,
      status: entity.status,
    };

    // Update payload EXCLUDES tenantId to ensure tenantId immutability during update
    const updatePayload = {
      username: entity.username,
      email: entity.email,
      fullName: entity.fullName,
      role: entity.role,
      status: entity.status,
    };

    return await tx.userActor.upsert({
      where: { id: entity.id },
      create: createPayload,
      update: updatePayload,
    });
  }

  public async saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: UserActor[]): Promise<UserActor[]> {
    const savedActors: UserActor[] = [];
    for (const entity of entities) {
      const saved = await this.saveTx(tx, tenantId, entity);
      savedActors.push(saved);
    }
    return savedActors;
  }

  public async deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean> {
    try {
      await tx.userActor.delete({
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
