import { TenantTransactionClient, runInTenantContext } from '../db/tenant-context';

export interface WorkQueueItem {
  id: string;
  domain: 'EMPLOYEE' | 'STUDENT';
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  actionRequired: string;
}

export interface OperationalMetrics {
  totalOpenExceptions: number;
  exceptionsBySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  pendingVerifications: number;
  pendingApprovals: number;
  requiresCorrection: number;
  totalEmployees: number;
  totalStudents: number;
  totalDocumentsProcessed: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export interface IOperationalQueryRepository {
  /**
   * Aggregates live operational metrics across domain tables in a single transaction under RLS.
   */
  getAggregatedMetricsTx(
    tx: TenantTransactionClient,
    tenantId: string
  ): Promise<OperationalMetrics>;

  /**
   * Projects pending administrative work items across employee awards, OCR extraction, and exceptions.
   */
  getUnifiedWorkQueueItemsTx(
    tx: TenantTransactionClient,
    tenantId: string,
    limit?: number
  ): Promise<WorkQueueItem[]>;
}

export class PostgresOperationalQueryRepository implements IOperationalQueryRepository {
  /**
   * Aggregates operational metrics directly from PostgreSQL tables using COUNT and GROUP BY queries.
   *
   * METRICS DEFINITIONS & SOURCES:
   * 1. totalOpenExceptions:
   *    - Source: exception_items
   *    - Filter: tenant_id = :tenantId AND status IN ('OPEN', 'IN_REVIEW')
   * 2. exceptionsBySeverity (error/warning/info):
   *    - Source: exception_items
   *    - Filter: tenant_id = :tenantId AND status IN ('OPEN', 'IN_REVIEW') GROUP BY severity
   * 3. pendingVerifications:
   *    - Source 1: award_proposals WHERE tenant_id = :tenantId AND status IN ('LENGKAP', 'SEBAGIAN')
   *    - Source 2: ocr_extractions WHERE tenant_id = :tenantId AND status = 'NEEDS_VERIFICATION'
   * 4. pendingApprovals:
   *    - Source: award_proposals WHERE tenant_id = :tenantId AND status = 'SIAP_GENERATE'
   * 5. requiresCorrection:
   *    - Source: exception_items WHERE tenant_id = :tenantId AND status IN ('OPEN', 'IN_REVIEW') AND severity = 'CRITICAL'
   * 6. totalEmployees:
   *    - Source: employees (direct query on tenant employee registry, NOT inferred from proposals)
   *    - Filter: tenant_id = :tenantId
   * 7. totalStudents:
   *    - Source: students (direct query on active student registry)
   *    - Filter: tenant_id = :tenantId AND status = 'ACTIVE'
   * 8. totalDocumentsProcessed:
   *    - Source: documents
   *    - Filter: tenant_id = :tenantId
   */
  public async getAggregatedMetricsTx(
    tx: TenantTransactionClient,
    tenantId: string
  ): Promise<OperationalMetrics> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Operational query tenantId must be a valid UUID. Received: '${tenantId}'`);
    }

    const [
      totalOpenExceptions,
      exceptionsGrouped,
      pendingAwardVerifications,
      pendingOcrVerifications,
      pendingApprovals,
      totalEmployees,
      totalStudents,
      totalDocumentsProcessed,
    ] = await Promise.all([
      // 1. Total Open Exceptions
      tx.exceptionItem.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
      }),

      // 2. Open Exceptions grouped by Severity (Type-safe Prisma aggregation)
      tx.exceptionItem.groupBy({
        by: ['severity'],
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        _count: {
          _all: true,
        },
      }),

      // 3a. Pending Award Proposal Verification
      tx.awardProposal.count({
        where: {
          tenantId,
          status: { in: ['LENGKAP', 'SEBAGIAN'] },
        },
      }),

      // 3b. Pending Student OCR Item Verification (items awaiting human verification to create absence records)
      tx.extractedItem.count({
        where: {
          tenantId,
          absenceRecordId: null,
        },
      }),

      // 4. Pending Document Generation Approvals
      tx.awardProposal.count({
        where: {
          tenantId,
          status: 'SIAP_GENERATE',
        },
      }),

      // 5. Total Employees in Tenant Registry
      tx.employee.count({
        where: {
          tenantId,
        },
      }),

      // 6. Total Active Students
      tx.student.count({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
      }),

      // 7. Total Documents Processed
      tx.document.count({
        where: {
          tenantId,
        },
      }),
    ]);

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const group of exceptionsGrouped) {
      const count = group._count._all;
      switch (group.severity) {
        case 'CRITICAL':
          errorCount += count;
          break;
        case 'HIGH':
          warningCount += count;
          break;
        case 'MEDIUM':
        case 'LOW':
          infoCount += count;
          break;
      }
    }

    return {
      totalOpenExceptions,
      exceptionsBySeverity: {
        error: errorCount,
        warning: warningCount,
        info: infoCount,
      },
      pendingVerifications: pendingAwardVerifications + pendingOcrVerifications,
      pendingApprovals,
      requiresCorrection: errorCount,
      totalEmployees,
      totalStudents,
      totalDocumentsProcessed,
    };
  }

  /**
   * Projects pending work items from Award Proposals, OCR Extractions, and Exception Items.
   *
   * PROJECTION RULES:
   * 1. Award Proposals:
   *    - status = 'SIAP_GENERATE' => severity: HIGH, action: 'Persetujuan Siap Cetak PDF'
   *    - status IN ('LENGKAP', 'SEBAGIAN') => severity: MEDIUM, action: 'Verifikasi Kelengkapan Dokumen'
   * 2. OCR Extractions:
   *    - absenceRecordId IS NULL + confidence < 70 => severity: CRITICAL, action: 'Verifikasi Manual Ekstraksi Ketidakhadiran'
   *    - absenceRecordId IS NULL + confidence >= 70 => severity: MEDIUM, action: 'Verifikasi Manual Ekstraksi Ketidakhadiran'
   * 3. Exception Items:
   *    - status IN ('OPEN', 'IN_REVIEW') => inherits ExceptionSeverity directly:
   *      CRITICAL -> CRITICAL, HIGH -> HIGH, MEDIUM -> MEDIUM, LOW -> LOW
   *      action: 'Penyelesaian Pengecualian Aturan'
   */
  public async getUnifiedWorkQueueItemsTx(
    tx: TenantTransactionClient,
    tenantId: string,
    limit: number = 50
  ): Promise<WorkQueueItem[]> {
    if (!tenantId || !isValidUuid(tenantId)) {
      throw new Error(`SECURITY/SCHEMA ERROR: Operational query tenantId must be a valid UUID. Received: '${tenantId}'`);
    }

    const [proposals, unverifiedOcrItems, exceptions] = await Promise.all([
      // 1. Award Proposals needing verification or approval
      tx.awardProposal.findMany({
        where: {
          tenantId,
          status: { in: ['SIAP_GENERATE', 'LENGKAP', 'SEBAGIAN'] },
        },
        include: {
          employee: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),

      // 2. Extracted OCR Items needing human verification (absenceRecordId is null)
      tx.extractedItem.findMany({
        where: {
          tenantId,
          absenceRecordId: null,
        },
        include: {
          ocrExtraction: {
            include: {
              document: true,
            },
          },
          matchedStudent: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),

      // 3. Open Exception Items (Type-safe Prisma Query with Joined WorkflowInstance)
      tx.exceptionItem.findMany({
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        include: {
          workflowInstance: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);

    const items: WorkQueueItem[] = [];

    // --- Map Employee Award Proposals ---
    for (const p of proposals) {
      if (p.status === 'SIAP_GENERATE') {
        const subtitle = `Usulan ${p.jenisPenghargaan}${p.nilaiUsulan ? ` (${p.nilaiUsulan})` : ''}${
          p.employee?.unitKerja ? ` - ${p.employee.unitKerja}` : ''
        }`;
        items.push({
          id: `wq-emp-${p.id}`,
          domain: 'EMPLOYEE',
          entityId: p.id,
          title: p.employee?.fullName || 'Pegawai',
          subtitle,
          status: p.status,
          severity: 'HIGH',
          createdAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
          actionRequired: 'Persetujuan Siap Cetak PDF',
        });
      } else if (p.status === 'LENGKAP' || p.status === 'SEBAGIAN') {
        const subtitle = `Verifikasi Berkas ${p.jenisPenghargaan}${p.employee?.nrk ? ` (${p.employee.nrk})` : ''}`;
        items.push({
          id: `wq-emp-${p.id}`,
          domain: 'EMPLOYEE',
          entityId: p.id,
          title: p.employee?.fullName || 'Pegawai',
          subtitle,
          status: p.status,
          severity: 'MEDIUM',
          createdAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
          actionRequired: 'Verifikasi Kelengkapan Dokumen',
        });
      }
    }

    // --- Map Student OCR Extractions ---
    for (const item of unverifiedOcrItems) {
      const confidence = Number(item.confidenceScore);
      const studentTitle = item.studentNameRaw || item.matchedStudent?.fullName || 'Siswa';
      const subtitle = `Akurasi OCR ${confidence}%${item.matchedStudent?.className ? ` | Kelas ${item.matchedStudent.className}` : ''}`;
      items.push({
        id: `wq-std-${item.id}`,
        domain: 'STUDENT',
        entityId: item.id,
        title: studentTitle,
        subtitle,
        status: 'NEEDS_VERIFICATION',
        severity: confidence < 70 ? 'CRITICAL' : 'MEDIUM',
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        actionRequired: 'Verifikasi Manual Ekstraksi Ketidakhadiran',
      });
    }

    // --- Map Exception Items ---
    for (const exc of exceptions) {
      const isEmployee =
        exc.workflowInstance?.entityType === 'AwardProposal' ||
        exc.ruleCode.startsWith('EMP_') ||
        exc.ruleCode.startsWith('AWARD_');

      items.push({
        id: `wq-exc-${exc.id}`,
        domain: isEmployee ? 'EMPLOYEE' : 'STUDENT',
        entityId: exc.id,
        title: `Pengecualian: ${exc.ruleCode}`,
        subtitle: exc.resolutionNotes || `Pengecualian Aturan ${exc.ruleCode} (${exc.status})`,
        status: exc.status,
        severity: exc.severity, // directly consumes ExceptionSeverity ('CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
        createdAt: exc.createdAt ? new Date(exc.createdAt).toISOString() : new Date().toISOString(),
        actionRequired: 'Penyelesaian Pengecualian Aturan',
      });
    }

    // Deterministic ordering: createdAt DESC, then id DESC
    items.sort((a, b) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    return items.slice(0, limit);
  }

  // --- Context-Bound Helper Methods ---

  public async getAggregatedMetricsInContext(
    actorId: string,
    tenantId: string
  ): Promise<OperationalMetrics> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.getAggregatedMetricsTx(tx, tenantId);
    });
  }

  public async getUnifiedWorkQueueItemsInContext(
    actorId: string,
    tenantId: string,
    limit?: number
  ): Promise<WorkQueueItem[]> {
    return await runInTenantContext(actorId, tenantId, async (tx) => {
      return await this.getUnifiedWorkQueueItemsTx(tx, tenantId, limit);
    });
  }
}
