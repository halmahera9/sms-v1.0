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

export const RULE_MESSAGE_CATALOG: Record<string, string> = {
  DOC_COMPLETENESS_RULE: 'Berkas persyaratan usulan penghargaan belum lengkap atau belum diunggah.',
  SE_BKD_22_2026_RULE: 'Pemeriksaan hukuman disiplin berdasarkan SE BKD No. 22/SE/2026.',
  MASA_KERJA_ELIGIBILITY_RULE: 'Masa kerja belum memenuhi syarat kelayakan jenjang penghargaan.',
  SATYALANCANA_TIER_RULE: 'Jenjang Satyalancana tidak sesuai dengan riwayat perolehan tanda kehormatan.',
  OCR_CONFIDENCE_THRESHOLD_RULE: 'Akurasi ekstraksi OCR berada di bawah ambang batas minimum 70%.',
  OCR_CONFIDENCE_RULE: 'Akurasi ekstraksi OCR berada di bawah ambang batas minimum 70%.',
  STUDENT_NISN_FORMAT_RULE: 'Format NISN tidak valid (harus 10 digit angka numerik).',
  ABSENCE_DATE_VALIDITY_RULE: 'Tanggal ketidakhadiran tidak valid atau melampaui tanggal berjalan.',
  DOC_FORMAT_RULE: 'Format atau ekstensi berkas dokumen tidak memenuhi standar validasi.',
};

export const EMPLOYEE_ENTITY_TYPES = new Set([
  'AwardProposal',
  'Employee',
  'AwardProposalDocument',
]);

export const STUDENT_ENTITY_TYPES = new Set([
  'Student',
  'ExtractedItem',
  'OCRExtraction',
  'AbsenceRecord',
  'Document',
]);

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
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: effectiveLimit,
    });

    const mapped = records.map((r) => this.mapToDomain(r));

    if (filter?.domain && filter.domain !== 'ALL') {
      return mapped.filter((item) => item.domain === filter.domain);
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
      throw new Error(`Validation Error: Exception id must be a valid UUID. Received: '${id}'`);
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

    if (!record) {
      return null;
    }

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
      throw new Error(`Validation Error: Exception id must be a valid UUID. Received: '${id}'`);
    }
    if (!actorUserId || !isValidUuid(actorUserId)) {
      throw new Error(`Validation Error: Actor user id must be a valid UUID. Received: '${actorUserId}'`);
    }

    // 1. Fetch current record
    const existing = await tx.exceptionItem.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        workflowInstance: true,
      },
    });

    if (!existing) {
      throw new Error(`Validation Error: Exception record with id '${id}' not found in tenant '${tenantId}'.`);
    }

    // 2. State Machine Validation
    const allowedTransitions = VALID_TRANSITIONS[existing.status] || [];
    if (!allowedTransitions.includes(status)) {
      throw new Error(
        `Validation Error: Transisi status dari '${existing.status}' ke '${status}' tidak diperbolehkan. Status terminal atau transisi ilegal.`
      );
    }

    // 3. Prepare Update Payload
    const now = new Date();
    const updateData: Record<string, any> = {
      status,
      updatedAt: now,
    };

    if (resolutionNotes !== undefined) {
      updateData.resolutionNotes = resolutionNotes;
    }

    if (status === ExceptionStatus.RESOLVED || status === ExceptionStatus.DISMISSED) {
      updateData.resolvedByUserId = actorUserId;
      updateData.resolvedAt = now;
    } else if (status === ExceptionStatus.IN_REVIEW) {
      // In review clears resolution details if previously set
      updateData.resolvedByUserId = null;
      updateData.resolvedAt = null;
    }

    // 4. Update Exception Item
    const updated = await tx.exceptionItem.update({
      where: {
        tenantId_id: {
          tenantId,
          id,
        },
      },
      data: updateData,
      include: {
        workflowInstance: true,
        resolvedByUser: true,
        assignedToUser: true,
      },
    });

    // 5. Atomic Audit Log Generation (Same Transaction Client)
    let auditAction: string;
    if (status === ExceptionStatus.RESOLVED) {
      auditAction = 'RESOLVE_EXCEPTION';
    } else if (status === ExceptionStatus.DISMISSED) {
      auditAction = 'DISMISS_EXCEPTION';
    } else {
      auditAction = 'REVIEW_EXCEPTION';
    }

    await this.auditRepo.recordTx(tx, tenantId, {
      entityType: 'ExceptionItem',
      entityId: id,
      action: auditAction,
      actorUserId,
      metadata: {
        previousStatus: existing.status,
        newStatus: status,
        ruleCode: updated.ruleCode,
        resolutionNotes: updateData.resolutionNotes ?? existing.resolutionNotes ?? null,
      },
    });

    return this.mapToDomain(updated);
  }

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
    const rawEntityType = wf?.entityType;

    let domain: 'EMPLOYEE' | 'STUDENT';
    if (rawEntityType && EMPLOYEE_ENTITY_TYPES.has(rawEntityType)) {
      domain = 'EMPLOYEE';
    } else if (rawEntityType && STUDENT_ENTITY_TYPES.has(rawEntityType)) {
      domain = 'STUDENT';
    } else if (
      record.ruleCode.startsWith('EMP_') ||
      record.ruleCode.startsWith('AWARD_') ||
      record.ruleCode.startsWith('DOC_') ||
      record.ruleCode.startsWith('SE_BKD_') ||
      record.ruleCode.startsWith('MASA_KERJA_') ||
      record.ruleCode.startsWith('SATYALANCANA_')
    ) {
      domain = 'EMPLOYEE';
    } else if (
      record.ruleCode.startsWith('STUDENT_') ||
      record.ruleCode.startsWith('OCR_') ||
      record.ruleCode.startsWith('ABSENCE_')
    ) {
      domain = 'STUDENT';
    } else {
      throw new Error(
        `SCHEMA/DOMAIN ERROR: Unable to determine domain for entityType '${rawEntityType}' and ruleCode '${record.ruleCode}'. Unknown entity classification.`
      );
    }

    const entityType = rawEntityType || (domain === 'EMPLOYEE' ? 'AwardProposal' : 'ExtractedItem');
    const entityId = wf?.entityId || record.workflowInstanceId;

    const message =
      RULE_MESSAGE_CATALOG[record.ruleCode] ||
      `Pelanggaran aturan validasi: ${record.ruleCode}`;

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
      resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
      createdAt: record.createdAt ? record.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: record.updatedAt ? record.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
