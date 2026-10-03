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

import { DocumentVersion, WorkflowInstance, WorkflowTransition } from '@prisma/client';
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

  async getWorkflowInstanceByEntity(tenantId: string, entityType: string, entityId: string): Promise<WorkflowInstance | null> {
    return this.prisma.workflowInstance.findUnique({
      where: { tenantId_entityType_entityId: { tenantId, entityType, entityId } },
    });
  }

  async getDocumentVersion(tenantId: string, documentVersionId: string): Promise<DocumentVersion | null> {
    return this.prisma.documentVersion.findFirst({
      where: { tenantId, id: documentVersionId },
    });
  }

  /**
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
   * @param expectedVersion expected persisted workflow version and idempotency identity
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
    expectedVersion: number,
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
        expectedVersion,
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
