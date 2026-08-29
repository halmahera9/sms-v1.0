import { ValidationResult } from './index';

/**
 * Banyubiru Document Intelligence Orchestration Contracts (Domain-Agnostic)
 *
 * Defines the canonical application-level orchestration contracts connecting:
 * Document -> DocumentVersion -> OCRExtraction -> ExtractedItem ->
 * Identity Resolution -> Validation -> Exception Queue -> Human Verification -> Audit Trail
 */

// ============================================================================
// 1. TERMINAL & RESOLUTION STATUS DEFINITIONS
// ============================================================================

/**
 * Terminal execution status of the Document Intelligence Orchestration Pipeline.
 *
 * - COMPLETED: All automated pipeline stages succeeded without ambiguity or blocking issues.
 * - REQUIRES_REVIEW: Pipeline processed successfully but surfaced items needing human verification
 *   (e.g., low confidence OCR, unmapped/ambiguous identity, validation errors, or exceptions).
 * - FAILED: Pipeline could not complete due to invariant violations, missing dependencies, or fatal errors.
 */
export type PipelineTerminalStatus = 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED';

/**
 * Outcome status of resolving an extracted entity against master identity registries.
 *
 * - RESOLVED: Uniquely and deterministically mapped to a master entity record (confidence threshold satisfied).
 * - UNRESOLVED: No matching record found in the target master registry.
 * - AMBIGUOUS: Multiple potential matches identified with insufficient distinction to resolve deterministically.
 */
export type IdentityResolutionStatus = 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';

/**
 * Method employed by the identity resolution mechanism.
 */
export type IdentityMatchMethod = 'EXACT' | 'FUZZY' | 'MANUAL';

// ============================================================================
// 2. IDENTITY RESOLUTION CONTRACTS
// ============================================================================

/**
 * Candidate match entity surfaced during ambiguous or fuzzy resolution.
 */
export interface IdentityCandidateMatch {
  entityId: string;
  entityType: string;
  label: string;
  confidence: number;
}

/**
 * Canonical outcome contract for identity resolution stage.
 */
export interface IdentityResolutionOutcome {
  status: IdentityResolutionStatus;
  matchedEntityId?: string;
  matchedEntityType?: string;
  confidence: number;
  matchMethod?: IdentityMatchMethod;
  candidateMatches?: IdentityCandidateMatch[];
  resolutionNotes?: string;
}

// ============================================================================
// 3. EXTRACTION & PROCESSED ITEM CONTRACTS
// ============================================================================

/**
 * Extracted granular token or key-value field from OCR/parsing.
 */
export interface ExtractedField {
  name: string;
  rawValue: string;
  normalizedValue?: unknown;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Processed line-item or entity record produced by the extraction and validation stages.
 */
export interface ProcessedExtractedItem {
  id: string;
  rawText: string;
  confidence: number;
  fields: Record<string, ExtractedField>;
  identityResolution: IdentityResolutionOutcome;
  validationResults: ValidationResult[];
  exceptionId?: string;
  requiresHumanReview: boolean;
}

// ============================================================================
// 4. PIPELINE REQUEST & RESULT CONTRACTS
// ============================================================================

/**
 * Inbound request payload for the Document Intelligence Orchestrator.
 */
export interface DocumentIntelligencePipelineRequest {
  tenantId: string;
  actorId: string;
  documentId: string;
  documentVersionId: string;
  targetDomain: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated summary metrics for a single pipeline execution run.
 */
export interface DocumentIntelligencePipelineSummary {
  totalItemsExtracted: number;
  itemsResolved: number;
  itemsUnresolved: number;
  itemsAmbiguous: number;
  validationErrorsCount: number;
  exceptionsCreatedCount: number;
  itemsRequiringReview: number;
}

/**
 * Comprehensive result payload returned upon pipeline completion.
 */
export interface DocumentIntelligencePipelineResult {
  status: PipelineTerminalStatus;
  documentId: string;
  documentVersionId: string;
  ocrExtractionId?: string;
  processedItems: ProcessedExtractedItem[];
  summary: DocumentIntelligencePipelineSummary;
  exceptionIds: string[];
  auditEventId?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

// ============================================================================
// 5. ORCHESTRATOR APPLICATION SERVICE CONTRACT
// ============================================================================

/**
 * Canonical Application Service interface for Document Intelligence Orchestration.
 */
export interface IDocumentIntelligenceOrchestrator {
  /**
   * Orchestrates the complete end-to-end document intelligence lifecycle in tenant context.
   *
   * @param request Validated pipeline request with tenant, actor, and document references.
   * @returns Pipeline result containing terminal status, processed items, exception references, and summary.
   */
  process(
    request: DocumentIntelligencePipelineRequest
  ): Promise<DocumentIntelligencePipelineResult>;
}
