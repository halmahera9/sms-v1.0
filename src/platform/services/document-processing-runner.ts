import { PrismaClient, DocumentProcessingStatus } from '@prisma/client';
import { adminPrisma } from '@/platform/db/prisma';
import {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineRequest,
  DocumentIntelligencePipelineResult,
} from '../types/document-intelligence';
import {
  IDocumentProcessingJobRunner,
  DocumentProcessingJobDTO,
  DocumentProcessingJobExecutionResult,
} from '../types/document-processing';
import {
  IDocumentExtractor,
} from '../types/document-extractor';
import {
  IObjectStorageProvider,
  getObjectStorageProvider,
} from '@/platform/storage';
import { DocumentIntelligenceOrchestrator } from './document-intelligence';
import { DeterministicDocumentExtractor } from './document-extractor';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/**
 * Concrete Application Service for Document Processing Job Runner (Phase 5E.2-B & 5E.2-C).
 *
 * Implements canonical job claiming and execution lifecycle:
 * 1. Atomic job claim (QUEUED -> PROCESSING) preventing concurrent double-execution.
 * 2. Attempts counter incrementing.
 * 3. Object Storage binary retrieval: storageProvider.download(tenantId, storagePath).
 * 4. Document extraction via IDocumentExtractor.extract().
 * 5. Metadata merging (preserving existing job metadata and injecting extractionResult.items).
 * 6. DocumentIntelligenceOrchestrator.process() execution.
 * 7. Terminal state transitions:
 *     - Success -> COMPLETED (sets processedAt, clears lastError)
 *     - Failure with remaining attempts -> QUEUED (preserves lastError for retry)
 *     - Failure with exhausted attempts -> FAILED (sets processedAt and lastError)
 * 8. Strict multi-tenant isolation and fail-closed validation.
 */
export class DocumentProcessingJobRunner implements IDocumentProcessingJobRunner {
  constructor(
    private readonly orchestrator: IDocumentIntelligenceOrchestrator = new DocumentIntelligenceOrchestrator(),
    private readonly storageProvider: IObjectStorageProvider = getObjectStorageProvider(),
    private readonly extractor: IDocumentExtractor = new DeterministicDocumentExtractor(),
    private readonly prisma: PrismaClient = adminPrisma
  ) {}

  /**
   * Atomically claims a QUEUED job for execution, transitioning it to PROCESSING
   * and incrementing its attempt count.
   *
   * @param tenantId Target tenant UUID
   * @param jobId Target job UUID
   * @returns Claimed job DTO, or null if the job does not exist, belongs to another tenant, or is not in QUEUED status.
   */
  public async claimJob(tenantId: string, jobId: string): Promise<DocumentProcessingJobDTO | null> {
    if (!isValidUuid(tenantId) || !isValidUuid(jobId)) {
      return null;
    }

    const claimedRows = await this.prisma.$queryRaw<any[]>`
      UPDATE document_processing_jobs
      SET status = 'PROCESSING'::"DocumentProcessingStatus",
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = ${jobId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND status = 'QUEUED'::"DocumentProcessingStatus"
      RETURNING
        id,
        tenant_id as "tenantId",
        document_id as "documentId",
        document_version_id as "documentVersionId",
        actor_id as "actorId",
        target_domain as "targetDomain",
        metadata,
        status,
        attempts,
        max_attempts as "maxAttempts",
        last_error as "lastError",
        created_at as "createdAt",
        updated_at as "updatedAt",
        processed_at as "processedAt";
    `;

    if (!claimedRows || claimedRows.length === 0) {
      return null;
    }

    const row = claimedRows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      actorId: row.actorId,
      targetDomain: row.targetDomain,
      metadata: (row.metadata as Record<string, unknown>) || null,
      status: row.status as DocumentProcessingStatus,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.maxAttempts),
      lastError: row.lastError || null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      processedAt: row.processedAt ? new Date(row.processedAt) : null,
    };
  }

  /**
   * Claims and executes a specific DocumentProcessingJob via the DocumentIntelligenceOrchestrator.
   *
   * @param tenantId Target tenant UUID
   * @param jobId Target job UUID
   * @returns Canonical execution result
   */
  public async executeJob(
    tenantId: string,
    jobId: string
  ): Promise<DocumentProcessingJobExecutionResult> {
    if (!isValidUuid(tenantId) || !isValidUuid(jobId)) {
      return {
        success: false,
        jobId: jobId || '',
        tenantId: tenantId || '',
        previousStatus: DocumentProcessingStatus.FAILED,
        finalStatus: DocumentProcessingStatus.FAILED,
        attempts: 0,
        maxAttempts: 0,
        error: 'Validation Error: Both tenantId and jobId must be valid UUIDs.',
      };
    }

    // 1. Attempt Atomic Claim
    const claimed = await this.claimJob(tenantId, jobId);

    if (!claimed) {
      const existing = await this.prisma.documentProcessingJob.findFirst({
        where: { id: jobId, tenantId },
      });

      if (!existing) {
        return {
          success: false,
          jobId,
          tenantId,
          previousStatus: DocumentProcessingStatus.FAILED,
          finalStatus: DocumentProcessingStatus.FAILED,
          attempts: 0,
          maxAttempts: 0,
          error: `Job '${jobId}' not found under tenant '${tenantId}'.`,
        };
      }

      return {
        success: false,
        jobId,
        tenantId,
        previousStatus: existing.status,
        finalStatus: existing.status,
        attempts: existing.attempts,
        maxAttempts: existing.maxAttempts,
        error: `Job '${jobId}' cannot be claimed because its status is '${existing.status}'.`,
      };
    }

    let orchestrationResult: DocumentIntelligencePipelineResult | null = null;
    let orchestrationError: string | null = null;

    try {
      // 2. Resolve Binary Storage Context
      const jobMeta = (claimed.metadata as Record<string, unknown>) || {};
      let storagePath = jobMeta.storagePath as string | undefined;
      let mimeType = jobMeta.mimeType as string | undefined;
      let fileName = jobMeta.fileName as string | undefined;

      if (!storagePath || !mimeType) {
        const docVersion = await this.prisma.documentVersion.findUnique({
          where: { id: claimed.documentVersionId },
        });

        if (!docVersion) {
          throw new Error(
            `DocumentVersion '${claimed.documentVersionId}' not found for processing job '${claimed.id}'.`
          );
        }

        storagePath = storagePath || docVersion.filePath;
        mimeType = mimeType || docVersion.mimeType;
      }

      fileName = fileName || 'document.pdf';
      mimeType = mimeType || 'application/pdf';

      // 3. Download Binary from Object Storage
      const fileBuffer = await this.storageProvider.download(claimed.tenantId, storagePath);

      // 4. Extract Structured Data via IDocumentExtractor
      const extractionResult = await this.extractor.extract({
        tenantId: claimed.tenantId,
        documentId: claimed.documentId,
        documentVersionId: claimed.documentVersionId,
        fileName,
        mimeType,
        content: fileBuffer,
        metadata: jobMeta,
      });

      if (!extractionResult.success) {
        throw new Error(extractionResult.errorMessage || 'Document extraction failed.');
      }

      // 5. Merge Extraction Items with Preserved Job Metadata
      const mergedMetadata: Record<string, unknown> = {
        ...jobMeta,
        items: extractionResult.items,
      };

      // 6. Delegate to DocumentIntelligenceOrchestrator
      const request: DocumentIntelligencePipelineRequest = {
        tenantId: claimed.tenantId,
        actorId: claimed.actorId,
        documentId: claimed.documentId,
        documentVersionId: claimed.documentVersionId,
        targetDomain: claimed.targetDomain,
        metadata: mergedMetadata,
      };

      orchestrationResult = await this.orchestrator.process(request);

      if (orchestrationResult.status === 'FAILED') {
        orchestrationError =
          orchestrationResult.errorMessage || 'Orchestration pipeline returned FAILED status.';
      }
    } catch (err: unknown) {
      orchestrationError = err instanceof Error ? err.message : String(err);
    }

    // 7. Handle Lifecycle Transitions
    if (!orchestrationError) {
      // 7.1 Success -> COMPLETED
      const processedAt = new Date();

      await this.prisma.documentProcessingJob.update({
        where: { id: claimed.id },
        data: {
          status: DocumentProcessingStatus.COMPLETED,
          processedAt,
          lastError: null,
        },
      });

      return {
        success: true,
        jobId: claimed.id,
        tenantId: claimed.tenantId,
        previousStatus: DocumentProcessingStatus.QUEUED,
        finalStatus: DocumentProcessingStatus.COMPLETED,
        attempts: claimed.attempts,
        maxAttempts: claimed.maxAttempts,
        processedAt,
        orchestrationResult,
      };
    } else {
      // 7.2 Failure: Check remaining attempts for retry
      const isRetryable = claimed.attempts < claimed.maxAttempts;
      const finalStatus = isRetryable
        ? DocumentProcessingStatus.QUEUED
        : DocumentProcessingStatus.FAILED;
      const processedAt = isRetryable ? null : new Date();

      await this.prisma.documentProcessingJob.update({
        where: { id: claimed.id },
        data: {
          status: finalStatus,
          lastError: orchestrationError,
          processedAt,
        },
      });

      return {
        success: false,
        jobId: claimed.id,
        tenantId: claimed.tenantId,
        previousStatus: DocumentProcessingStatus.QUEUED,
        finalStatus,
        attempts: claimed.attempts,
        maxAttempts: claimed.maxAttempts,
        processedAt,
        error: orchestrationError,
        orchestrationResult,
      };
    }
  }
}
