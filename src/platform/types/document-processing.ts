import { DocumentProcessingStatus } from '@prisma/client';
import {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineResult,
} from './document-intelligence';

/**
 * Data Transfer Object representing a persisted DocumentProcessingJob.
 */
export interface DocumentProcessingJobDTO {
  id: string;
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  actorId: string;
  targetDomain: string;
  metadata: Record<string, unknown> | null;
  status: DocumentProcessingStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}

/**
 * Result of executing a single DocumentProcessingJob.
 */
export interface DocumentProcessingJobExecutionResult {
  success: boolean;
  jobId: string;
  tenantId: string;
  previousStatus: DocumentProcessingStatus;
  finalStatus: DocumentProcessingStatus;
  attempts: number;
  maxAttempts: number;
  processedAt?: Date | null;
  error?: string | null;
  orchestrationResult?: DocumentIntelligencePipelineResult | null;
}

/**
 * Canonical Application Service interface for Document Processing Job Runner (Phase 5E.2-B).
 */
export interface IDocumentProcessingJobRunner {
  /**
   * Atomically claims a QUEUED job for execution, transitioning it to PROCESSING
   * and incrementing its attempt count.
   *
   * @param tenantId Target tenant UUID
   * @param jobId Target job UUID
   * @returns Claimed job DTO, or null if the job does not exist, belongs to another tenant, or is not in QUEUED status.
   */
  claimJob(tenantId: string, jobId: string): Promise<DocumentProcessingJobDTO | null>;

  /**
   * Claims and executes a specific DocumentProcessingJob via the DocumentIntelligenceOrchestrator.
   * Handles lifecycle transitions (COMPLETED, retry back to QUEUED, or terminal FAILED),
   * records error context, and sets execution timestamps.
   *
   * @param tenantId Target tenant UUID
   * @param jobId Target job UUID
   * @returns Canonical execution result
   */
  executeJob(tenantId: string, jobId: string): Promise<DocumentProcessingJobExecutionResult>;
}

/**
 * Canonical Application Service interface for Document Processing Worker (Phase 5E.2-D).
 * Responsible for discovering executable QUEUED jobs and delegating them to the runner.
 */
export interface IDocumentProcessingWorker {
  /**
   * Discovers and processes the oldest executable QUEUED job.
   *
   * @param tenantId Optional tenant ID to restrict processing scope to a specific tenant.
   * @returns Execution result of the processed job, or null if no executable job is found.
   */
  processNextJob(tenantId?: string): Promise<DocumentProcessingJobExecutionResult | null>;

  /**
   * Processes a bounded batch of executable QUEUED jobs sequentially.
   *
   * @param options Optional configuration for tenant scoping and batch limit.
   * @returns Array of execution results for all processed jobs.
   */
  processBatch(options?: {
    tenantId?: string;
    limit?: number;
  }): Promise<DocumentProcessingJobExecutionResult[]>;
}
