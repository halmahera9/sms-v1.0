import { TenantTransactionClient } from '../db/tenant-context';

export interface ITenantRepository<T extends { id: string; tenantId: string }, ID = string> {
  // Context-Bound Entry Points (Executing inside runInTenantContext with actorId and tenantId)
  findByIdInContext(actorId: string, tenantId: string, id: ID): Promise<T | null>;
  findAllInContext(actorId: string, tenantId: string): Promise<T[]>;
  saveInContext(actorId: string, tenantId: string, entity: T): Promise<T>;
  saveAllInContext(actorId: string, tenantId: string, entities: T[]): Promise<T[]>;
  deleteInContext(actorId: string, tenantId: string, id: ID): Promise<boolean>;

  // Transaction-Bound Entry Points (Executing using active TenantTransactionClient inside transaction)
  findByIdTx(tx: TenantTransactionClient, id: ID): Promise<T | null>;
  findAllTx(tx: TenantTransactionClient): Promise<T[]>;
  saveTx(tx: TenantTransactionClient, tenantId: string, entity: T): Promise<T>;
  saveAllTx(tx: TenantTransactionClient, tenantId: string, entities: T[]): Promise<T[]>;
  deleteTx(tx: TenantTransactionClient, id: ID): Promise<boolean>;
}
