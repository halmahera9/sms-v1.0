/**
 * P0-K.5 — Document Workflow Transition Registry
 *
 * Authoritative resolver for (currentState, event) → toState transitions.
 * Implements allow-list from P0-K.2 canonical matrix.
 * Pure domain decision boundary; no side effects, no persistence, no audit writes.
 *
 * All other transition resolution attempts fail closed with explicit rejection.
 */

import {
  DocumentWorkflowState,
  DocumentWorkflowEvent,
  DocumentWorkflowTransitionContext,
  DocumentWorkflowTransitionResolver,
  ResolvedDocumentWorkflowTransition,
} from '../types/document-workflow';

/**
 * Transition matrix: (currentState, event) → toState
 * Derived from P0-K.2 canonical contract, lines 32-57.
 * Every valid edge is explicit; all others are invalid.
 */
type TransitionMatrix = Record<
  DocumentWorkflowState,
  Partial<Record<DocumentWorkflowEvent, DocumentWorkflowState>>
>;

const TRANSITION_MATRIX: TransitionMatrix = {
  // Initial state
  [DocumentWorkflowState.DITERIMA]: {
    [DocumentWorkflowEvent.SIAPKAN_PEMBACAAN]: DocumentWorkflowState.SIAP_DIBACA,
  },

  // OCR stage
  [DocumentWorkflowState.SIAP_DIBACA]: {
    [DocumentWorkflowEvent.MULAI_OCR]: DocumentWorkflowState.OCR_DIPROSES,
  },
  [DocumentWorkflowState.OCR_DIPROSES]: {
    [DocumentWorkflowEvent.OCR_SELESAI]: DocumentWorkflowState.SELESAI_DIBACA,
    [DocumentWorkflowEvent.OCR_GAGAL]: DocumentWorkflowState.OCR_GAGAL,
  },
  [DocumentWorkflowState.OCR_GAGAL]: {
    [DocumentWorkflowEvent.ULANGI_OCR]: DocumentWorkflowState.SIAP_DIBACA,
  },

  // Extraction stage
  [DocumentWorkflowState.SELESAI_DIBACA]: {
    [DocumentWorkflowEvent.SIAPKAN_EKSTRAKSI]:
      DocumentWorkflowState.SIAP_DIEKSTRAKSI,
  },
  [DocumentWorkflowState.SIAP_DIEKSTRAKSI]: {
    [DocumentWorkflowEvent.MULAI_EKSTRAKSI]: DocumentWorkflowState.DIEKSTRAKSI,
  },
  [DocumentWorkflowState.DIEKSTRAKSI]: {
    [DocumentWorkflowEvent.EKSTRAKSI_SELESAI]:
      DocumentWorkflowState.SELESAI_DIEKSTRAKSI,
    [DocumentWorkflowEvent.EKSTRAKSI_GAGAL]:
      DocumentWorkflowState.EKSTRAKSI_GAGAL,
  },
  [DocumentWorkflowState.EKSTRAKSI_GAGAL]: {
    [DocumentWorkflowEvent.ULANGI_EKSTRAKSI]:
      DocumentWorkflowState.SIAP_DIEKSTRAKSI,
  },

  // Matching stage
  [DocumentWorkflowState.SELESAI_DIEKSTRAKSI]: {
    [DocumentWorkflowEvent.SIAPKAN_PENCOCOKAN]:
      DocumentWorkflowState.SIAP_DICOCOKKAN,
  },
  [DocumentWorkflowState.SIAP_DICOCOKKAN]: {
    [DocumentWorkflowEvent.MULAI_PENCOCOKAN]: DocumentWorkflowState.DICOCOKKAN,
  },
  [DocumentWorkflowState.DICOCOKKAN]: {
    [DocumentWorkflowEvent.SATU_KANDIDAT_VALID]:
      DocumentWorkflowState.MENUNGGU_KONFIRMASI,
    [DocumentWorkflowEvent.BANYAK_KANDIDAT]:
      DocumentWorkflowState.MENUNGGU_KONFIRMASI,
    [DocumentWorkflowEvent.TIDAK_ADA_KANDIDAT]:
      DocumentWorkflowState.TIDAK_DITEMUKAN,
    [DocumentWorkflowEvent.PENCOCOKAN_GAGAL]:
      DocumentWorkflowState.PENCOCOKAN_GAGAL,
  },
  [DocumentWorkflowState.PENCOCOKAN_GAGAL]: {
    [DocumentWorkflowEvent.ULANGI_PENCOCOKAN]:
      DocumentWorkflowState.SIAP_DICOCOKKAN,
  },

  // Manual confirmation
  [DocumentWorkflowState.MENUNGGU_KONFIRMASI]: {
    [DocumentWorkflowEvent.KONFIRMASI_KANDIDAT]:
      DocumentWorkflowState.TERKONFIRMASI,
    [DocumentWorkflowEvent.TOLAK_SEMUA]: DocumentWorkflowState.TIDAK_DITEMUKAN,
  },

  // Terminal decision states (no-op retry and completion)
  [DocumentWorkflowState.TERKONFIRMASI]: {
    [DocumentWorkflowEvent.MULAI_ULANG]: DocumentWorkflowState.TERKONFIRMASI,
    [DocumentWorkflowEvent.SELESAIKAN_ALUR]: DocumentWorkflowState.SELESAI,
  },
  [DocumentWorkflowState.TIDAK_DITEMUKAN]: {
    [DocumentWorkflowEvent.MULAI_ULANG]: DocumentWorkflowState.TIDAK_DITEMUKAN,
    [DocumentWorkflowEvent.SELESAIKAN_ALUR]: DocumentWorkflowState.SELESAI,
  },

  // Completion
  [DocumentWorkflowState.SELESAI]: {
    [DocumentWorkflowEvent.ARSIPKAN]: DocumentWorkflowState.DIARSIPKAN,
  },

  // DIARSIPKAN is terminal; no outbound edges
  [DocumentWorkflowState.DIARSIPKAN]: {},
};

/**
 * Guard evaluation.
 * P0-K.5 is pure resolver; it does NOT:
 * - perform database queries
 * - write audit logs
 * - create or modify WorkflowInstance
 * - authenticate (that is P0-K.4 service responsibility)
 *
 * Guard context carries only trusted evidence passed by P0-K.4.
 * Explicit guard rules per P0-K.2 are documented in comments below.
 * If a guard is missing from the context but required, resolver returns
 * rejection (guard failure) to P0-K.4, which logs/audits via canonical path.
 */
interface GuardEvidenceContext extends DocumentWorkflowTransitionContext {
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/**
 * Evaluate guard preconditions for specific transitions.
 * Returns true if guard passes; false if guard fails (transition rejected).
 *
 * P0-K.2 line references document each guard.
 */
function evaluateGuard(
  currentState: DocumentWorkflowState,
  event: DocumentWorkflowEvent,
  context: GuardEvidenceContext
): boolean {
  // P0-K.2 line 34: SIAPKAN_PEMBACAAN requires DocumentVersion valid, binary reference
  if (
    currentState === DocumentWorkflowState.DITERIMA &&
    event === DocumentWorkflowEvent.SIAPKAN_PEMBACAAN
  ) {
    // Evidence: documentVersion validation deferred to P0-K.4 (repository/service layer)
    // Resolver accepts if caller provided evidence; if missing, reject.
    // (Caller is responsible for pre-validation before invoking resolver)
    return context.evidence?.['documentVersionValid'] === true;
  }

  // P0-K.2 line 35: MULAI_OCR requires Stage/job claimable; not archived
  if (
    currentState === DocumentWorkflowState.SIAP_DIBACA &&
    event === DocumentWorkflowEvent.MULAI_OCR
  ) {
    // Archival/claim status verified by P0-K.4 service before resolver
    return context.evidence?.['claimable'] === true;
  }

  // P0-K.2 line 36: OCR_SELESAI requires OCRExtraction COMPLETED
  if (
    currentState === DocumentWorkflowState.OCR_DIPROSES &&
    event === DocumentWorkflowEvent.OCR_SELESAI
  ) {
    return context.evidence?.['ocrCompleted'] === true;
  }

  // P0-K.2 line 37: OCR_GAGAL requires error persisted/classified
  if (
    currentState === DocumentWorkflowState.OCR_DIPROSES &&
    event === DocumentWorkflowEvent.OCR_GAGAL
  ) {
    return context.evidence?.['ocrErrorClassified'] === true;
  }

  // P0-K.2 line 38: ULANGI_OCR requires not archived, retry allowed
  if (
    currentState === DocumentWorkflowState.OCR_GAGAL &&
    event === DocumentWorkflowEvent.ULANGI_OCR
  ) {
    return (
      context.evidence?.['notArchived'] === true &&
      context.evidence?.['retryAllowed'] === true
    );
  }

  // P0-K.2 line 39: SIAPKAN_EKSTRAKSI requires OCR complete
  if (
    currentState === DocumentWorkflowState.SELESAI_DIBACA &&
    event === DocumentWorkflowEvent.SIAPKAN_EKSTRAKSI
  ) {
    return context.evidence?.['ocrCompleted'] === true;
  }

  // P0-K.2 line 40: MULAI_EKSTRAKSI requires OCR complete, single claim
  if (
    currentState === DocumentWorkflowState.SIAP_DIEKSTRAKSI &&
    event === DocumentWorkflowEvent.MULAI_EKSTRAKSI
  ) {
    return (
      context.evidence?.['ocrCompleted'] === true &&
      context.evidence?.['claimable'] === true
    );
  }

  // P0-K.2 line 41: EKSTRAKSI_SELESAI requires ExtractionResult persisted
  if (
    currentState === DocumentWorkflowState.DIEKSTRAKSI &&
    event === DocumentWorkflowEvent.EKSTRAKSI_SELESAI
  ) {
    return context.evidence?.['extractionResultPersisted'] === true;
  }

  // P0-K.2 line 42: EKSTRAKSI_GAGAL requires error persisted/classified
  if (
    currentState === DocumentWorkflowState.DIEKSTRAKSI &&
    event === DocumentWorkflowEvent.EKSTRAKSI_GAGAL
  ) {
    return context.evidence?.['extractionErrorClassified'] === true;
  }

  // P0-K.2 line 43: ULANGI_EKSTRAKSI requires OCR valid, doesn't overwrite manual
  if (
    currentState === DocumentWorkflowState.EKSTRAKSI_GAGAL &&
    event === DocumentWorkflowEvent.ULANGI_EKSTRAKSI
  ) {
    return (
      context.evidence?.['ocrValid'] === true &&
      context.evidence?.['manualDecisionNotOverwritten'] === true
    );
  }

  // P0-K.2 line 44: SIAPKAN_PENCOCOKAN requires ExtractionResult ready
  if (
    currentState === DocumentWorkflowState.SELESAI_DIEKSTRAKSI &&
    event === DocumentWorkflowEvent.SIAPKAN_PENCOCOKAN
  ) {
    return context.evidence?.['extractionResultReady'] === true;
  }

  // P0-K.2 line 45: MULAI_PENCOCOKAN requires no manual final decision, single claim
  if (
    currentState === DocumentWorkflowState.SIAP_DICOCOKKAN &&
    event === DocumentWorkflowEvent.MULAI_PENCOCOKAN
  ) {
    return (
      context.evidence?.['noManualFinalDecision'] === true &&
      context.evidence?.['claimable'] === true
    );
  }

  // P0-K.2 line 46: SATU_KANDIDAT_VALID requires MatchingResult persisted, review policy
  if (
    currentState === DocumentWorkflowState.DICOCOKKAN &&
    event === DocumentWorkflowEvent.SATU_KANDIDAT_VALID
  ) {
    return (
      context.evidence?.['matchingResultPersisted'] === true &&
      context.evidence?.['policyRequiresReview'] === true
    );
  }

  // P0-K.2 line 47: BANYAK_KANDIDAT requires candidates persisted, operator decision
  if (
    currentState === DocumentWorkflowState.DICOCOKKAN &&
    event === DocumentWorkflowEvent.BANYAK_KANDIDAT
  ) {
    return context.evidence?.['candidatesPersisted'] === true;
  }

  // P0-K.2 line 48: TIDAK_ADA_KANDIDAT requires MatchingResult TIDAK_DITEMUKAN
  if (
    currentState === DocumentWorkflowState.DICOCOKKAN &&
    event === DocumentWorkflowEvent.TIDAK_ADA_KANDIDAT
  ) {
    return context.evidence?.['noMatchingResultPersisted'] === true;
  }

  // P0-K.2 line 49: PENCOCOKAN_GAGAL requires error persisted
  if (
    currentState === DocumentWorkflowState.DICOCOKKAN &&
    event === DocumentWorkflowEvent.PENCOCOKAN_GAGAL
  ) {
    return context.evidence?.['matchingErrorClassified'] === true;
  }

  // P0-K.2 line 50: ULANGI_PENCOCOKAN requires not manually confirmed, extraction valid
  if (
    currentState === DocumentWorkflowState.PENCOCOKAN_GAGAL &&
    event === DocumentWorkflowEvent.ULANGI_PENCOCOKAN
  ) {
    return (
      context.evidence?.['notManuallyConfirmed'] === true &&
      context.evidence?.['extractionValid'] === true
    );
  }

  // P0-K.2 line 51: KONFIRMASI_KANDIDAT requires RBAC, candidate belongs to result/tenant
  if (
    currentState === DocumentWorkflowState.MENUNGGU_KONFIRMASI &&
    event === DocumentWorkflowEvent.KONFIRMASI_KANDIDAT
  ) {
    return (
      context.evidence?.['hasMatchingConfirmationRBAC'] === true &&
      context.evidence?.['candidateBelongsToResultAndTenant'] === true
    );
  }

  // P0-K.2 line 52: TOLAK_SEMUA requires RBAC
  if (
    currentState === DocumentWorkflowState.MENUNGGU_KONFIRMASI &&
    event === DocumentWorkflowEvent.TOLAK_SEMUA
  ) {
    return context.evidence?.['hasMatchingConfirmationRBAC'] === true;
  }

  // P0-K.2 line 53: MULAI_ULANG from TERKONFIRMASI requires manuallyConfirmed=true (no-op)
  if (
    currentState === DocumentWorkflowState.TERKONFIRMASI &&
    event === DocumentWorkflowEvent.MULAI_ULANG
  ) {
    return context.evidence?.['manuallyConfirmed'] === true;
  }

  // P0-K.2 line 54: MULAI_ULANG from TIDAK_DITEMUKAN: manual no-op, auto retry only explicit
  if (
    currentState === DocumentWorkflowState.TIDAK_DITEMUKAN &&
    event === DocumentWorkflowEvent.MULAI_ULANG
  ) {
    // If manual final decision, allow no-op; if auto result, only explicit retry via new event
    // Evidence: manuallyConfirmed flag
    return context.evidence?.['manualDecisionOrAllowAutoRetry'] === true;
  }

  // P0-K.2 line 55: SELESAIKAN_ALUR from TERKONFIRMASI requires all stages/gates finished
  if (
    currentState === DocumentWorkflowState.TERKONFIRMASI &&
    event === DocumentWorkflowEvent.SELESAIKAN_ALUR
  ) {
    return context.evidence?.['allStagesAndGatesFinished'] === true;
  }

  // P0-K.2 line 56: SELESAIKAN_ALUR from TIDAK_DITEMUKAN requires matching decision stored
  if (
    currentState === DocumentWorkflowState.TIDAK_DITEMUKAN &&
    event === DocumentWorkflowEvent.SELESAIKAN_ALUR
  ) {
    return context.evidence?.['matchingDecisionStored'] === true;
  }

  // P0-K.2 line 57: ARSIPKAN requires eligibility predicate, retention, temporary policy
  if (
    currentState === DocumentWorkflowState.SELESAI &&
    event === DocumentWorkflowEvent.ARSIPKAN
  ) {
    return (
      context.evidence?.['archivalEligible'] === true &&
      context.evidence?.['retentionAllows'] === true &&
      context.evidence?.['temporaryPolicyPasses'] === true
    );
  }

  // All other state/event pairs: no guard (implicitly pass if matrix edge exists)
  return true;
}

/**
 * DocumentWorkflowTransitionRegistry — P0-K.5 canonical resolver.
 *
 * Implements DocumentWorkflowTransitionResolver interface.
 * Pure function; no side effects; fail-closed on unknown state/event.
 */
export class DocumentWorkflowTransitionRegistry
  implements DocumentWorkflowTransitionResolver
{
  /**
   * Resolve (currentState, event) → (fromState, toState).
   *
   * Returns authoritative transition or rejects with error (thrown).
   * P0-K.4 catches rejection and produces canonical error response.
   *
   * @param currentState persisted state from WorkflowInstance
   * @param event requested transition event
   * @param context authenticated tenant/actor + guard evidence
   * @returns {fromState, toState} or throws if transition invalid/rejected
   */
  async resolve(
    currentState: DocumentWorkflowState,
    event: DocumentWorkflowEvent,
    context: DocumentWorkflowTransitionContext
  ): Promise<ResolvedDocumentWorkflowTransition> {
    // Fail closed: unknown state
    if (!(currentState in TRANSITION_MATRIX)) {
      throw new Error(
        `INVALID_TRANSITION: unknown state "${currentState}". Only states defined in P0-K.2 matrix are valid.`
      );
    }

    // Fail closed: unknown event
    if (
      !Object.values(DocumentWorkflowEvent).includes(event)
    ) {
      throw new Error(
        `INVALID_TRANSITION: unknown event "${event}". Only events defined in P0-K.2 matrix are valid.`
      );
    }

    // Fail closed: unlisted (currentState, event) pair
    const stateTransitions = TRANSITION_MATRIX[currentState];
    if (!stateTransitions || !(event in stateTransitions)) {
      throw new Error(
        `INVALID_TRANSITION: no edge from state "${currentState}" via event "${event}" in P0-K.2 matrix. Transition rejected.`
      );
    }

    const toState = stateTransitions[event];
    if (!toState) {
      throw new Error(
        `INVALID_TRANSITION: resolver internal error — no target state resolved. This should not occur; matrix malformed.`
      );
    }

    // Evaluate guard preconditions
    const guardEvidenceContext = context as GuardEvidenceContext;
    const guardPassed = evaluateGuard(
      currentState,
      event,
      guardEvidenceContext
    );

    if (!guardPassed) {
      throw new Error(
        `TRANSITION_GUARD_FAILED: transition from "${currentState}" via "${event}" to "${toState}" rejected by guard evaluation. Evidence insufficient or precondition not met. Guard details documented in P0-K.2 contract.`
      );
    }

    // Valid transition: return canonical result
    return {
      fromState: currentState,
      toState: toState,
    };
  }
}

/**
 * Singleton instance for dependency injection into P0-K.4 service.
 */
export const documentWorkflowTransitionRegistry =
  new DocumentWorkflowTransitionRegistry();
