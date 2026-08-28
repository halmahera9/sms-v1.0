import crypto from 'crypto';
import { AuditEvent } from '../types';
import { TenantTransactionClient, runInTenantContext } from '../db/tenant-context';

export interface AuditEventInput {
  id?: string;
  actorUserId?: string | null;
  actor?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
}

export type AuditEventRecord = AuditEvent & {
  tenantId: string;
  actorUserId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export interface IAuditEventRepository {
  recordTx(
    tx: TenantTransactionClient,
    tenantId: string,
    event: AuditEventInput
  ): Promise<AuditEventRecord>;

  findRecentTx(
    tx: TenantTransactionClient,
    tenantId: string,
    limit?: number
  ): Promise<AuditEventRecord[]>;

  findByEntityTx(
    tx: TenantTransactionClient,
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditEventRecord[]>;
}

export class PostgresAuditEventRepository implements IAuditEventRepository {
  public async recordTx(
    tx: TenantTransactionClient,
    tenantId: string,
    event: AuditEventInput
  ): Promise<AuditEventRecord> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Audit tenantId must be a valid UUID. Received: '${tenantId}'`);
    }

    if (!isValidUuid(event.entityId)) {
      throw new Error(
        `SECURITY/SCHEMA ERROR: Audit entityId must be a valid UUID. Received: '${event.entityId}'. (Legacy/non-UUID identifiers cannot be silently mapped to arbitrary UUIDs).`
      );
    }

    let eventId = event.id;
    if (eventId) {
      if (!isValidUuid(eventId)) {
        throw new Error(`SECURITY/SCHEMA ERROR: Audit event id must be a valid UUID. Received: '${eventId}'`);
      }
    } else {
      eventId = crypto.randomUUID();
    }

    let actorUserId: string | null = null;
    if (event.actorUserId) {
      if (!isValidUuid(event.actorUserId)) {
        throw new Error(`SECURITY/SCHEMA ERROR: Audit actorUserId must be a valid UUID. Received: '${event.actorUserId}'`);
      }
      actorUserId = event.actorUserId;
    } else if (event.actor && isValidUuid(event.actor)) {
      actorUserId = event.actor;
    }

    const payloadJson = {
      actor: event.actor || (actorUserId ? actorUserId : 'system'),
      beforeState: event.beforeState !== undefined ? JSON.parse(JSON.stringify(event.beforeState)) : null,
      afterState: event.afterState !== undefined ? JSON.parse(JSON.stringify(event.afterState)) : null,
      metadata: event.metadata || null,
    };

    const record = await tx.auditEvent.create({
      data: {
        id: eventId,
        tenantId,
        actorUserId: actorUserId ?? null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        payloadJson: payloadJson as any,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
      },
      include: {
        actorUser: true,
      },
    });

    return this.mapToDomain(record);
  }

  public async findRecentTx(
    tx: TenantTransactionClient,
    tenantId: string,
    limit: number = 50
  ): Promise<AuditEventRecord[]> {
    const records = await tx.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actorUser: true },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  public async findByEntityTx(
    tx: TenantTransactionClient,
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditEventRecord[]> {
    if (!isValidUuid(entityId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Audit entityId must be a valid UUID. Received: '${entityId}'`);
    }

    const records = await tx.auditEvent.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      include: { actorUser: true },
    });

    return records.map((r) => this.mapToDomain(r));
  }

  // --- Context-bound helper methods (Convenience for non-transactional single-op callers) ---

  public async recordInContext(
    actorId: string,
    tenantId: string,
    event: AuditEventInput
  ): Promise<AuditEventRecord> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.recordTx(tx, tenantId, event);
    });
  }

  public async findRecentInContext(
    actorId: string,
    tenantId: string,
    limit?: number
  ): Promise<AuditEventRecord[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.findRecentTx(tx, tenantId, limit);
    });
  }

  public async findByEntityInContext(
    actorId: string,
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditEventRecord[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.findByEntityTx(tx, tenantId, entityType, entityId);
    });
  }

  private mapToDomain(record: Record<string, any>): AuditEventRecord {
    const payload = (record.payloadJson as Record<string, any>) || {};
    const actorDisplayName =
      record.actorUser?.username ||
      record.actorUser?.fullName ||
      payload.actor ||
      (record.actorUserId ? String(record.actorUserId) : 'system');

    return {
      id: record.id,
      tenantId: record.tenantId,
      actorUserId: record.actorUserId || undefined,
      timestamp: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      actor: actorDisplayName,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      beforeState: payload.beforeState !== null ? payload.beforeState : undefined,
      afterState: payload.afterState !== null ? payload.afterState : undefined,
      metadata: payload.metadata || undefined,
      ipAddress: record.ipAddress || undefined,
      userAgent: record.userAgent || undefined,
    };
  }
}
