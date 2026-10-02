/**
 * P0-K.4 â€” Document Workflow Contract
 *
 * Canonical types and contract for document intelligence workflow lifecycle.
 * Based on P0-K.2 state machine matrix.
 *
 * States: represent document processing stage
 * Events: represent transitions between stages
 * Transitions: atomic, idempotent, tenanted, audited
 *
 * NOT IMPLEMENTED: repository, service, allow-list enforcement (P0-K.5)
 */

// ============================================================================
// STATE MACHINE â€” Canonical States from P0-K.2 Matrix
// ============================================================================

/**
 * DocumentWorkflowState â€” all valid workflow states for document processing.
 * From P0-K.2 canonical matrix.
 */
export enum DocumentWorkflowState {
  // Initial state
  DITERIMA = 'DITERIMA',

  // OCR stage
  SIAP_DIBACA = 'SIAP_DIBACA',
  OCR_DIPROSES = 'OCR_DIPROSES',
  SELESAI_DIBACA = 'SELESAI_DIBACA',
  OCR_GAGAL = 'OCR_GAGAL',

  // Extraction stage
  SIAP_DIEKSTRAKSI = 'SIAP_DIEKSTRAKSI',
  DIEKSTRAKSI = 'DIEKSTRAKSI',
  SELESAI_DIEKSTRAKSI = 'SELESAI_DIEKSTRAKSI',
  EKSTRAKSI_GAGAL = 'EKSTRAKSI_GAGAL',

  // Matching stage
  SIAP_DICOCOKKAN = 'SIAP_DICOCOKKAN',
  DICOCOKKAN = 'DICOCOKKAN',
  MENUNGGU_KONFIRMASI = 'MENUNGGU_KONFIRMASI',
  TERKONFIRMASI = 'TERKONFIRMASI',
  TIDAK_DITEMUKAN = 'TIDAK_DITEMUKAN',
  PENCOCOKAN_GAGAL = 'PENCOCOKAN_GAGAL',

  // Completion
  SELESAI = 'SELESAI',
  DIARSIPKAN = 'DIARSIPKAN',
}

/**
 * DocumentWorkflowEvent â€” all valid transition events.
 * From P0-K.2 canonical matrix.
 */
export enum DocumentWorkflowEvent {
  // Initial
  SIAPKAN_PEMBACAAN = 'SIAPKAN_PEMBACAAN',

  // OCR
  MULAI_OCR = 'MULAI_OCR',
  OCR_SELESAI = 'OCR_SELESAI',
  OCR_GAGAL = 'OCR_GAGAL',
  ULANGI_OCR = 'ULANGI_OCR',

  // Extraction
  SIAPKAN_EKSTRAKSI = 'SIAPKAN_EKSTRAKSI',
  MULAI_EKSTRAKSI = 'MULAI_EKSTRAKSI',
  EKSTRAKSI_SELESAI = 'EKSTRAKSI_SELESAI',
  EKSTRAKSI_GAGAL = 'EKSTRAKSI_GAGAL',
  ULANGI_EKSTRAKSI = 'ULANGI_EKSTRAKSI',

  // Matching
  SIAPKAN_PENCOCOKAN = 'SIAPKAN_PENCOCOKAN',
  MULAI_PENCOCOKAN = 'MULAI_PENCOCOKAN',
  SATU_KANDIDAT_VALID = 'SATU_KANDIDAT_VALID',
  BANYAK_KANDIDAT = 'BANYAK_KANDIDAT',
  TIDAK_ADA_KANDIDAT = 'TIDAK_ADA_KANDIDAT',
  PENCOCOKAN_GAGAL = 'PENCOCOKAN_GAGAL',
  ULANGI_PENCOCOKAN = 'ULANGI_PENCOCOKAN',
  KONFIRMASI_KANDIDAT = 'KONFIRMASI_KANDIDAT',
  TOLAK_SEMUA = 'TOLAK_SEMUA',

  // Manual retry (no-op for confirmed decisions)
  MULAI_ULANG = 'MULAI_ULANG',

  // Completion
  SELESAIKAN_ALUR = 'SELESAIKAN_ALUR',
  ARSIPKAN = 'ARSIPKAN',
}
// P0-K.4 CONTRACT — FINAL AMENDMENT
// Supersedes all earlier conflicting prose in this file.

/**
 * Guard context is an abstraction for trusted tenant/auth/evidence data.
 * Concrete evidence requirements belong to P0-K.5; no domain guard rules are
 * encoded in this contract. Resolver must be side-effect-free.
 */
export interface DocumentWorkflowTransitionContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Authoritative target; fromState must equal persisted currentState. */
export interface ResolvedDocumentWorkflowTransition {
  readonly fromState: DocumentWorkflowState;
  readonly toState: DocumentWorkflowState;
}

/**
 * Resolver dependency. P0-K.5 owns its concrete matrix/allow-list. P0-K.4
 * contains no event-to-state mapping and fails closed if resolver rejects or
 * is not configured.
 */
export interface DocumentWorkflowTransitionResolver {
  resolve(
    currentState: DocumentWorkflowState,
    event: DocumentWorkflowEvent,
    context: DocumentWorkflowTransitionContext
  ): ResolvedDocumentWorkflowTransition | Promise<ResolvedDocumentWorkflowTransition>;
}

export interface DocumentWorkflowTransitionRequest {
  readonly documentVersionId: string;
  readonly event: DocumentWorkflowEvent;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly reason?: string;
}

/** Server-side request payload; actor and tenant are provided only by authenticated callback context. */
export type DocumentWorkflowServiceInput = DocumentWorkflowTransitionRequest;

export interface PersistedDocumentWorkflowTransitionIdentity {
  readonly idempotencyKey: string;
  readonly event: DocumentWorkflowEvent;
  readonly expectedVersion: number;
}

export interface DocumentWorkflowTransitionResult {
  readonly success: true;
  readonly workflowInstanceId: string;
  readonly previousState: DocumentWorkflowState;
  readonly currentState: DocumentWorkflowState;
  readonly version: number;
  readonly transitionId: string;
  readonly isReplay: boolean;
  readonly timestamp: string;
}

export enum DocumentWorkflowErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENT_REPLAY',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  TRANSITION_REJECTED = 'INVALID_TRANSITION',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
}

export interface DocumentWorkflowError {
  readonly code: DocumentWorkflowErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type DocumentWorkflowTransitionResponse =
  | { readonly success: true; readonly data: DocumentWorkflowTransitionResult }
  | { readonly success: false; readonly error: DocumentWorkflowError };

export interface DocumentWorkflowServiceContract {
  transitionDocumentWorkflow(
    authContext: import('../auth/session').AuthenticatedActorContext,
    tx: import('../db/tenant-context').TenantTransactionClient,
    input: DocumentWorkflowServiceInput,
    resolver: DocumentWorkflowTransitionResolver
  ): Promise<DocumentWorkflowTransitionResponse>;
}

/**
 * Normative semantics:
 * - Instance identity is (tenantId, "DOCUMENT_VERSION", documentVersionId).
 *   Queries use authenticated tenant/RLS context. Missing instance is
 *   WORKFLOW_NOT_FOUND; never implicitly create from a transition event.
 * - Resolver receives persisted currentState, event, explicit abstract guard
 *   evidence, and tenant/auth context. It returns authoritative fromState and
 *   toState or rejects canonically. Resolver absent/rejection fails closed.
 * - expectedVersion is compared to persisted WorkflowInstance.version. CAS
 *   conditionally writes resolver.toState and increments version exactly once;
 *   zero rows is CONCURRENCY_CONFLICT.
 * - Replay lookup by (tenantId, workflowInstanceId, idempotencyKey) precedes
 *   stale-version/CAS rejection. Request identity is idempotencyKey, event,
 *   and expectedVersion. Equivalent request returns stored result with isReplay=true
 *   and no mutation/audit. Different request returns IDEMPOTENCY_CONFLICT.
 *   correlationId and reason are metadata only, not request identity.
 * - Actor provenance is authenticated/tenant context only. No hard-coded system
 *   actor fallback. Trusted system workers require explicit authenticated
 *   service identity.
 * - Service transaction atomically encloses resolver decision, CAS,
 *   WorkflowTransition persistence, WorkflowInstance version/state update, and
 *   PostgresAuditEventRepository.recordTx. Any failure rolls back all writes.
 *   Replay creates no transition or audit row.
 * - Service owns tenant transaction, resolver invocation, replay/CAS semantics
 *   and audit orchestration. Repository is persistence-only. P0-K.5 owns all
 *   concrete transition matrix and allow-list rules.
 */
