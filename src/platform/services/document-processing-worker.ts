import { PrismaClient, DocumentProcessingStatus } from '@prisma/client';
import { adminPrisma } from '@/platform/db/prisma';
import {
  IDocumentProcessingWorker,
  IDocumentProcessingJobRunner,
  DocumentProcessingJobExecutionResult,
} from '../types/document-processing';
import { DocumentProcessingJobRunner } from './document-processing-runner';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Concrete Application Service for Document Processing Worker (Phase 5E.2-D).
 *
 * Responsible solely for discovering executable QUEUED jobs and delegating
 * execution to IDocumentProcessingJobRunner:
 * - Deterministic ordering by createdAt ASC (FIFO queue discovery)
 * - Safe tenant scoping when tenantId is provided
 * - Never selects non-QUEUED (PROCESSING, COMPLETED, FAILED) jobs
 * - Does NOT duplicate claiming, retry, extraction, or orchestration logic
 */
export class DocumentProcessingWorker implements IDocumentProcessingWorker {
  constructor(
    private readonly runner: IDocumentProcessingJobRunner = new DocumentProcessingJobRunner(),
    private readonly prisma: PrismaClient = adminPrisma
  ) {}

  /**
   * Discovers and processes the oldest executable QUEUED job.
   *
   * @param tenantId Optional tenant ID to restrict processing scope to a specific tenant.
   * @returns Execution result of the processed job, or null if no executable job is found.
   */
  public async processNextJob(tenantId?: string): Promise<DocumentProcessingJobExecutionResult | null> {
    if (tenantId !== undefined && !isValidUuid(tenantId)) {
      return null;
    }

    const candidate = await this.prisma.documentProcessingJob.findFirst({
      where: {
        status: DocumentProcessingStatus.QUEUED,
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!candidate) {
      return null;
    }

    return await this.runner.executeJob(candidate.tenantId, candidate.id);
  }

  /**
   * Processes a bounded batch of executable QUEUED jobs sequentially.
   *
   * @param options Optional configuration for tenant scoping and batch limit.
   * @returns Array of execution results for all processed jobs.
   */
  public async processBatch(options?: {
    tenantId?: string;
    limit?: number;
  }): Promise<DocumentProcessingJobExecutionResult[]> {
    const rawLimit = options?.limit ?? 10;
    const limit = Math.max(1, Math.min(rawLimit, 50));
    const results: DocumentProcessingJobExecutionResult[] = [];

    for (let i = 0; i < limit; i++) {
      const res = await this.processNextJob(options?.tenantId);
      if (!res) {
        break;
      }
      results.push(res);
    }

    return results;
  }
}
