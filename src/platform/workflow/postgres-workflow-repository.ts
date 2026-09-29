/**
 * P0-K.4 — PostgreSQL Workflow Repository
 *
 * Canonical persistence boundary for document workflow transitions.
 * Tenant-scoped queries via authenticated RLS context.
 * No transition business rules; no event-to-state mapping.
 *
 * Responsibility:
 * - Read/write WorkflowInstance atomically
 * - Optimistic CAS using version field
 * - Persist WorkflowTransition with idempotency key
 * - Replay lookup by (tenantId, workflowInstanceId, idempotencyKey)
 * - Atomic database operations within tenant transaction
 */

import { Prisma, WorkflowInstance, WorkflowTransition, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Result of optimistic CAS update.
 * success=true if version matched and update occurred.
 * success=false if version stale (another writer won).
 */
export interface WorkflowInstanceCASResult {
  readonly success: boolean;
  readonly affectedRows: number;
  readonly instance?: WorkflowInstance;
}

/**
 * PostgresWorkflowRepository — persistence-only boundary.
 */
export class PostgresWorkflowRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Find or create WorkflowInstance for (tenantId, entityType, entityId).
   * Initial state must be provided if creating.
   * Tenant-scoped; uses authenticated RLS context.
   *
   * @param tenantId authenticated tenant
   * @param entityType typically "DOCUMENT_VERSION"
   * @param entityId typically documentVersionId
   * @param initialState required if instance doesn't exist
   * @returns WorkflowInstance or null if not found and initialState not provided
   */
  async getOrCreateWorkflowInstance(
    tenantId: string,
    entityType: string,
    entityId: string,
    initialState?: string
  ): Promise<WorkflowInstance | null> {
    // Attempt to find existing instance
    const existing = await this.prisma.workflowInstance.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId,
          entityType,
          entityId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    if (!initialState) {
      return null;
    }

    // Create new instance (will fail if race condition creates first)
    try {
      const newInstance = await this.prisma.workflowInstance.create({
        data: {
          id: randomUUID(),
          tenantId,
          entityType,
          entityId,
          currentState: initialState,
          version: 0,
        },
      });
      return newInstance;
    } catch (err) {
      // Likely unique constraint violation from concurrent create
      // Retry read to get winning instance
      const retried = await this.prisma.workflowInstance.findUnique({
        where: {
          tenantId_entityType_entityId: {
            tenantId,
            entityType,
            entityId,
          },
        },
      });
      return retried || null;
    }
  }

  /**
   * Read WorkflowInstance by tenant and version.
   * Fail-closed: return null if not found (no implicit create).
   */
  async getWorkflowInstance(
    tenantId: string,
    workflowInstanceId: string
  ): Promise<WorkflowInstance | null> {
    return this.prisma.workflowInstance.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id: workflowInstanceId,
        },
      },
    });
  }

  /**
   * Lookup persisted transition by idempotency key.
   * Returns the transition if found; null otherwise.
   * Used to detect replays before CAS validation.
   */
  async getTransitionByIdempotencyKey(
    tenantId: string,
    workflowInstanceId: string,
    idempotencyKey: string
  ): Promise<WorkflowTransition | null> {
    return this.prisma.workflowTransition.findUnique({
      where: {
        tenantId_workflowInstanceId_idempotencyKey: {
          tenantId,
          workflowInstanceId,
          idempotencyKey,
        },
      },
    });
  }

  /**
   * Optimistic Compare-And-Swap (CAS) for WorkflowInstance.
   *
   * Atomically updates currentState and increments version IF
   * the instance's current version matches expectedVersion.
   *
   * @param tenantId authenticated tenant
   * @param workflowInstanceId workflow instance ID
   * @param expectedVersion precondition: must match persisted version
   * @param toState new state to set
   * @returns success=true if update occurred; success=false if version mismatch
   */
  async casUpdateWorkflowInstance(
    tenantId: string,
    workflowInstanceId: string,
    expectedVersion: number,
    toState: string
  ): Promise<WorkflowInstanceCASResult> {
    // Use raw SQL for atomic CAS to prevent lost updates
    const result = await this.prisma.workflowInstance.updateMany({
      where: {
        AND: [
          { tenantId },
          { id: workflowInstanceId },
          { version: expectedVersion }, // CAS precondition
        ],
      },
      data: {
        currentState: toState,
        version: {
          increment: 1,
        },
        updatedAt: new Date(),
      },
    });

    // Fetch updated instance if update succeeded
    let instance: WorkflowInstance | null = null;
    if (result.count > 0) {
      instance = await this.prisma.workflowInstance.findFirst({
        where: {
          AND: [
            { tenantId },
            { id: workflowInstanceId },
          ],
        },
      });
    }

    return {
      success: result.count > 0,
      affectedRows: result.count,
      instance: instance || undefined,
    };
  }

  /**
   * Persist WorkflowTransition atomically.
   * Called AFTER successful CAS update.
   * Unique constraint on (tenantId, workflowInstanceId, idempotencyKey) prevents duplicates.
   *
   * @param tenantId authenticated tenant
   * @param workflowInstanceId workflow instance ID
   * @param event transition event
   * @param fromState previous state
   * @param toState new state
   * @param idempotencyKey request idempotency key
   * @param triggeredByUserId authenticated actor
   * @param correlationId optional correlation reference
   * @param reason optional reason/context
   * @returns persisted WorkflowTransition
   */
  async persistWorkflowTransition(
    tenantId: string,
    workflowInstanceId: string,
    event: string,
    fromState: string,
    toState: string,
    idempotencyKey: string,
    triggeredByUserId: string,
    correlationId?: string,
    reason?: string
  ): Promise<WorkflowTransition> {
    return this.prisma.workflowTransition.create({
      data: {
        id: randomUUID(),
        tenantId,
        workflowInstanceId,
        event,
        fromState,
        toState,
        idempotencyKey,
        correlationId,
        triggeredByUserId,
        reason,
      },
    });
  }
}

/**
 * Tenant transaction context for P0-K.4 service.
 * Wraps Prisma transaction client with repository instance.
 */
export interface WorkflowRepositoryTxContext {
  readonly prisma: Prisma.TransactionClient;
  readonly repository: PostgresWorkflowRepository;
}

/**
 * Execute workflow operation within tenant transaction.
 * All persistence operations are atomic and tenant-scoped.
 *
 * @param prismaClient base Prisma client (must support transactions)
 * @param tenantId authenticated tenant for RLS
 * @param operation async function receiving transaction context
 * @returns result of operation
 */
export async function runWorkflowInTenantTx<T>(
  prismaClient: PrismaClient,
  tenantId: string,
  operation: (ctx: WorkflowRepositoryTxContext) => Promise<T>
): Promise<T> {
  return prismaClient.$transaction(async (txClient: any) => {
    // Set tenant context via connection variable (PostgreSQL RLS)
    await txClient.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', '${tenantId}', false);`
    );

    const repository = new PostgresWorkflowRepository(txClient);
    return operation({ prisma: txClient, repository });
  });
}
