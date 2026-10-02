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
   * Projects pending administrative work items across OCR extraction and exceptions.
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
   *    - Source: extracted_items WHERE tenant_id = :tenantId AND absence_record_id IS NULL
   * 4. pendingApprovals:
   *    - Always 0 (award proposal domain removed; future: document approvals)
   * 5. requiresCorrection:
   *    - Source: exception_items WHERE tenant_id = :tenantId AND severity = 'CRITICAL'
   * 6. totalEmployees:
   *    - Source: employees (direct query on tenant employee registry)
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
      pendingOcrVerifications,
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

      // 3. Pending OCR Item Verification
      tx.extractedItem.count({
        where: {
          tenantId,
          status: 'PENDING',
        },
      }),

      // 4. Total Employees in Tenant Registry
      tx.employee.count({
        where: {
          tenantId,
        },
      }),

      // 5. Total Active Students
      tx.student.count({
        where: {
          tenantId,
          status: 'ACTIVE',
        },
      }),

      // 6. Total Documents Processed
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
      pendingVerifications: pendingOcrVerifications,
      pendingApprovals: 0,
      requiresCorrection: errorCount,
      totalEmployees,
      totalStudents,
      totalDocumentsProcessed,
    };
  }

  /**
   * Projects pending work items from OCR Extractions and Exception Items.
   *
   * PROJECTION RULES:
   * 1. OCR Extractions:
   *    - absenceRecordId IS NULL + confidence < 70 => severity: CRITICAL, action: 'Verifikasi Manual Ekstraksi Ketidakhadiran'
   *    - absenceRecordId IS NULL + confidence >= 70 => severity: MEDIUM, action: 'Verifikasi Manual Ekstraksi Ketidakhadiran'
   * 2. Exception Items:
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

    const [unverifiedOcrItems, exceptions] = await Promise.all([
      // 1. Extracted OCR Items needing human verification (status is PENDING)
      tx.extractedItem.findMany({
        where: {
          tenantId,
          status: 'PENDING',
        },
        include: {
          ocrExtraction: {
            include: {
              document: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),

      // 2. Open Exception Items (Type-safe Prisma Query with Joined WorkflowInstance)
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

    // --- Map OCR Extractions ---
    for (const item of unverifiedOcrItems) {
      const confidence = Number(item.confidenceScore);
      const studentTitle = item.fieldName || item.fieldKey || item.value || 'Item Dokumen';
      const subtitle = `Akurasi OCR ${confidence}% | ${item.fieldKey}: ${item.value}`;
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
      const isEmployee = exc.ruleCode.startsWith('EMP_');

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
