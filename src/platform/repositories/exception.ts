import { TenantTransactionClient, runInTenantContext } from '../db/tenant-context';
import { ExceptionStatus, Severity } from '@prisma/client';
import { IAuditEventRepository, PostgresAuditEventRepository } from './audit-event';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export interface ExceptionItemRecord {
  id: string;
  ruleCode: string;
  domain: 'EMPLOYEE' | 'STUDENT';
  entityType: string;
  entityId: string;
  severity: Severity;
  status: ExceptionStatus;
  message: string;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExceptionFilterOptions {
  domain?: 'EMPLOYEE' | 'STUDENT' | 'ALL';
  severity?: Severity | 'ALL';
  status?: ExceptionStatus | 'ALL';
  limit?: number;
}

export interface IExceptionRepository {
  findManyTx(
    tx: TenantTransactionClient,
    tenantId: string,
    filter?: ExceptionFilterOptions
  ): Promise<ExceptionItemRecord[]>;

  findByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    id: string
  ): Promise<ExceptionItemRecord | null>;

  updateStatusTx(
    tx: TenantTransactionClient,
    tenantId: string,
    id: string,
    status: ExceptionStatus,
    actorUserId: string,
    resolutionNotes?: string
  ): Promise<ExceptionItemRecord>;
}

const VALID_TRANSITIONS: Record<ExceptionStatus, ExceptionStatus[]> = {
  OPEN: [ExceptionStatus.IN_REVIEW, ExceptionStatus.RESOLVED, ExceptionStatus.DISMISSED],
  IN_REVIEW: [ExceptionStatus.RESOLVED, ExceptionStatus.DISMISSED],
  RESOLVED: [],
  DISMISSED: [],
};

export class PostgresExceptionRepository implements IExceptionRepository {
  constructor(
    private readonly auditRepo: IAuditEventRepository = new PostgresAuditEventRepository()
  ) {}

  public async findManyTx(
    tx: TenantTransactionClient,
    tenantId: string,
    filter?: ExceptionFilterOptions
  ): Promise<ExceptionItemRecord[]> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Tenant id must be a valid UUID. Received: '${tenantId}'`);
    }

    const effectiveLimit =
      filter?.limit !== undefined && Number.isInteger(filter.limit) && filter.limit >= 1 && filter.limit <= 200
        ? filter.limit
        : 50;

    const whereClause: Record<string, any> = { tenantId };

    if (filter?.status && filter.status !== 'ALL') {
      whereClause.status = filter.status;
    }

    if (filter?.severity && filter.severity !== 'ALL') {
      whereClause.severity = filter.severity;
    }

    const records = await tx.exceptionItem.findMany({
      where: whereClause,
      include: {
        workflowInstance: true,
        resolvedByUser: true,
        assignedToUser: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: effectiveLimit,
    });

    let mapped = records.map((r) => this.mapToDomain(r));

    if (filter?.domain && filter.domain !== 'ALL') {
      mapped = mapped.filter((item) => item.domain === filter.domain);
    }

    return mapped;
  }

  public async findByIdTx(
    tx: TenantTransactionClient,
    tenantId: string,
    id: string
  ): Promise<ExceptionItemRecord | null> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Tenant id must be a valid UUID. Received: '${tenantId}'`);
    }
    if (!id || !isValidUuid(id)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Exception id must be a valid UUID. Received: '${id}'`);
    }

    const record = await tx.exceptionItem.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        workflowInstance: true,
        resolvedByUser: true,
        assignedToUser: true,
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  public async updateStatusTx(
    tx: TenantTransactionClient,
    tenantId: string,
    id: string,
    status: ExceptionStatus,
    actorUserId: string,
    resolutionNotes?: string
  ): Promise<ExceptionItemRecord> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Tenant id must be a valid UUID. Received: '${tenantId}'`);
    }
    if (!id || !isValidUuid(id)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Exception id must be a valid UUID. Received: '${id}'`);
    }
    if (!actorUserId || !isValidUuid(actorUserId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Actor user id must be a valid UUID. Received: '${actorUserId}'`);
    }

    const existing = await tx.exceptionItem.findFirst({
      where: { id, tenantId },
      include: { workflowInstance: true },
    });

    if (!existing) {
      throw new Error(`Validation Error: ExceptionItem with ID '${id}' not found for this tenant.`);
    }

    // State machine guard
    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(status)) {
      throw new Error(
        `Validation Error: Tidak dapat mengubah status dari '${existing.status}' ke '${status}'.`
      );
    }

    const isTerminal = status === ExceptionStatus.RESOLVED || status === ExceptionStatus.DISMISSED;
    const now = new Date();

    const updated = await tx.exceptionItem.update({
      where: {
        id: existing.id,
      },
      data: {
        status,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
        resolvedByUserId: isTerminal ? actorUserId : null,
        resolvedAt: isTerminal ? now : null,
      },
      include: {
        workflowInstance: true,
        resolvedByUser: true,
        assignedToUser: true,
      },
    });

    // Atomic Audit Side Effect within the same transaction
    const auditAction =
      status === ExceptionStatus.RESOLVED
        ? 'RESOLVE_EXCEPTION'
        : status === ExceptionStatus.DISMISSED
        ? 'DISMISS_EXCEPTION'
        : 'REVIEW_EXCEPTION';

    await this.auditRepo.recordTx(tx, tenantId, {
      actorUserId,
      action: auditAction,
      entityType: 'ExceptionItem',
      entityId: updated.id,
      beforeState: {
        status: existing.status,
        resolutionNotes: existing.resolutionNotes,
      },
      afterState: {
        status: updated.status,
        resolutionNotes: updated.resolutionNotes,
        resolvedAt: updated.resolvedAt,
      },
      metadata: {
        ruleCode: updated.ruleCode,
        targetEntityType: updated.workflowInstance?.entityType,
        targetEntityId: updated.workflowInstance?.entityId,
        notes: resolutionNotes,
      },
    });

    return this.mapToDomain(updated);
  }

  // --- Context-Bound Helper Methods ---

  public async findManyInContext(
    actorId: string,
    tenantId: string,
    filter?: ExceptionFilterOptions
  ): Promise<ExceptionItemRecord[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.findManyTx(tx, tenantId, filter);
    });
  }

  public async updateStatusInContext(
    actorId: string,
    tenantId: string,
    id: string,
    status: ExceptionStatus,
    resolutionNotes?: string
  ): Promise<ExceptionItemRecord> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.updateStatusTx(tx, tenantId, id, status, actorId, resolutionNotes);
    });
  }

  private mapToDomain(record: Record<string, any>): ExceptionItemRecord {
    const wf = record.workflowInstance;
    const isEmployee =
      wf?.entityType === 'AwardProposal' ||
      wf?.entityType === 'Employee' ||
      record.ruleCode.startsWith('EMP_') ||
      record.ruleCode.startsWith('AWARD_') ||
      record.ruleCode.startsWith('DOC_');

    const domain: 'EMPLOYEE' | 'STUDENT' = isEmployee ? 'EMPLOYEE' : 'STUDENT';
    const entityType = wf?.entityType || (isEmployee ? 'AwardProposal' : 'ExtractedItem');
    const entityId = wf?.entityId || record.workflowInstanceId;

    const message =
      record.resolutionNotes ||
      `Pengecualian aturan ${record.ruleCode} pada entitas ${entityType} (${entityId})`;

    const resolvedDisplayName =
      record.resolvedByUser?.fullName ||
      record.resolvedByUser?.username ||
      (record.resolvedByUserId ? String(record.resolvedByUserId) : null);

    return {
      id: record.id,
      ruleCode: record.ruleCode,
      domain,
      entityType,
      entityId,
      severity: record.severity,
      status: record.status,
      message,
      resolutionNotes: record.resolutionNotes || null,
      resolvedBy: resolvedDisplayName,
      resolvedAt: record.resolvedAt ? new Date(record.resolvedAt).toISOString() : null,
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}
