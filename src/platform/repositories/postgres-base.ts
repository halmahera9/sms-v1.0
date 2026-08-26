import { TenantTransactionClient, runInTenantContext } from '../db/tenant-context';
import { ITenantRepository } from './tenant-repository';

export abstract class BasePostgresRepository<T extends { id: string; tenantId: string }>
  implements ITenantRepository<T, string>
{
  /**
   * Helper function to assert that entity.tenantId matches active tenantId context.
   * Throws SECURITY ERROR if tenantId is missing or mismatched.
   */
  protected assertTenantConsistency(entity: { tenantId?: string }, activeTenantId: string): void {
    if (!entity.tenantId) {
      throw new Error('SECURITY ERROR: Entity tenantId is required.');
    }
    if (entity.tenantId !== activeTenantId) {
      throw new Error(
        `SECURITY ERROR: Entity tenantId (${entity.tenantId}) does not match active tenant context (${activeTenantId}).`
      );
    }
  }

  // --- Context-Bound Methods (Wrap calls inside runInTenantContext) ---

  public async findByIdInContext(actorId: string, tenantId: string, id: string): Promise<T | null> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.findByIdTx(tx, id);
    });
  }

  public async findAllInContext(actorId: string, tenantId: string): Promise<T[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.findAllTx(tx);
    });
  }

  public async saveInContext(actorId: string, tenantId: string, entity: T): Promise<T> {
    this.assertTenantConsistency(entity, tenantId);
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.saveTx(tx, tenantId, entity);
    });
  }

  public async saveAllInContext(actorId: string, tenantId: string, entities: T[]): Promise<T[]> {
    // Pre-validate all entities before running any DB query
    for (const entity of entities) {
      this.assertTenantConsistency(entity, tenantId);
    }
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.saveAllTx(tx, tenantId, entities);
    });
  }

  public async deleteInContext(actorId: string, tenantId: string, id: string): Promise<boolean> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.deleteTx(tx, id);
    });
  }

  // --- Abstract Transaction-Bound Methods (Must be implemented by concrete repositories with zero `any`) ---

  public abstract findByIdTx(tx: TenantTransactionClient, id: string): Promise<T | null>;
  public abstract findAllTx(tx: TenantTransactionClient): Promise<T[]>;
  public abstract saveTx(tx: TenantTransactionClient, tenantId: string, entity: T): Promise<T>;
  public abstract saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: T[]): Promise<T[]>;
  public abstract deleteTx(tx: TenantTransactionClient, id: string): Promise<boolean>;
}
