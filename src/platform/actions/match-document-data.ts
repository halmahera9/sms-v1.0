'use server';

import {
  executeInAuthenticatedContext,
  AuthenticationError,
  AuthorizationError,
  assertAuthorizedAction,
} from '@/platform/auth';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import {
  PostgresMatchingResultRepository,
  PostgresMatchingCandidateRepository,
  MatchingResultService,
} from '@/platform/repositories/matching-result';
import {
  ConfirmMatchingCandidateInput,
  ConfirmMatchingCandidateOutput,
  RejectAllCandidatesInput,
  RejectAllCandidatesOutput,
  MatchingResultWithCandidatesDTO,
} from '@/platform/types/matching';
import type { ActionErrorCode, ActionError, ActionResponse } from '@/platform/types';

export type { ActionErrorCode, ActionError, ActionResponse };

/**
 * Sanitizes server-side and database errors to client-safe ActionResponse structures.
 */
function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: err.message,
      },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message,
      },
    };
  }

  if (err instanceof Error) {
    if (err.message.startsWith('Validation Error:')) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }

    if (err.message.startsWith('SECURITY ERROR:') || err.message.startsWith('SECURITY/SCHEMA ERROR:')) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak oleh kebijakan keamanan data.',
        },
      };
    }
  }

  console.error('[Matching Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem pencocokan data.',
    },
  };
}

/**
 * getMatchingResultAction — Retrieve a matching result with all candidates for review.
 * Requires: DOCUMENT_READ permission
 * Returns: MatchingResultWithCandidatesDTO or error
 */
export async function getMatchingResultAction(
  matchingResultId: string
): Promise<ActionResponse<MatchingResultWithCandidatesDTO>> {
  try {
    // Validate input
    if (!matchingResultId || typeof matchingResultId !== 'string') {
      throw new Error('Validation Error: matchingResultId must be a non-empty string.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // RBAC: DOCUMENT_READ allows reading matching results
      assertAuthorizedAction(context, 'DOCUMENT_READ');

      const resultRepo = new PostgresMatchingResultRepository();
      const candidateRepo = new PostgresMatchingCandidateRepository();
      const service = new MatchingResultService(resultRepo, candidateRepo, tx);

      // Load matching result with candidates and entity details
      const fullResult = await service.loadWithCandidates(context.tenantId, matchingResultId);

      if (!fullResult) {
        throw new Error('Matching result not found or access denied.');
      }

      return fullResult;
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * confirmMatchingCandidateAction — Manually confirm a candidate as the correct match.
 * Sets: status = COCOK, manuallyConfirmed = true, confirmedCandidateId, confirmedByUserId, confirmedAt
 * Requires: STUDENT_WORKFLOW_VERIFY permission
 * Returns: ConfirmMatchingCandidateOutput or error
 */
export async function confirmMatchingCandidateAction(
  input: ConfirmMatchingCandidateInput
): Promise<ActionResponse<ConfirmMatchingCandidateOutput>> {
  try {
    // Validate input
    if (!input.matchingResultId || typeof input.matchingResultId !== 'string') {
      throw new Error('Validation Error: matchingResultId must be a non-empty string.');
    }
    if (!input.candidateId || typeof input.candidateId !== 'string') {
      throw new Error('Validation Error: candidateId must be a non-empty string.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // RBAC: STUDENT_WORKFLOW_VERIFY permits confirming identity matches
      assertAuthorizedAction(context, 'STUDENT_WORKFLOW_VERIFY');

      const resultRepo = new PostgresMatchingResultRepository();
      const candidateRepo = new PostgresMatchingCandidateRepository();
      const auditRepo = new PostgresAuditEventRepository();

      // 1. Fetch matching result
      const matchingResult = await resultRepo.getByIdTx(
        tx,
        context.tenantId,
        input.matchingResultId
      );

      if (!matchingResult) {
        throw new Error('Matching result not found.');
      }

      // 2. Check if already manually confirmed (idempotency + immutability)
      if (matchingResult.manuallyConfirmed) {
        throw new Error('Validation Error: This matching result has already been manually confirmed and cannot be changed.');
      }

      // 3. Fetch candidate
      const candidate = await candidateRepo.getByIdTx(
        tx,
        context.tenantId,
        input.candidateId
      );

      if (!candidate) {
        throw new Error('Candidate not found.');
      }

      // 4. Verify candidate belongs to this matching result
      const ownershipValid = await candidateRepo.verifyOwnershipTx(
        tx,
        context.tenantId,
        input.matchingResultId,
        input.candidateId
      );

      if (!ownershipValid) {
        throw new Error('SECURITY ERROR: Candidate does not belong to this matching result.');
      }

      // 5. Update matching result
      const now = new Date();
      const updated = await resultRepo.updateConfirmationTx(tx, context.tenantId, input.matchingResultId, {
        status: 'COCOK',
        manuallyConfirmed: true,
        confirmedCandidateId: input.candidateId,
        confirmedByUserId: context.actorId,
        confirmedAt: now,
      });

      // 6. Record audit event
      await auditRepo.recordTx(tx, context.tenantId, {
        action: 'MATCHING_CONFIRMED',
        entityType: 'MatchingResult',
        entityId: input.matchingResultId,
        actorUserId: context.actorId,
        metadata: {
          documentId: matchingResult.documentId,
          documentVersionId: matchingResult.documentVersionId,
          extractionResultId: matchingResult.extractionResultId,
          entityType: matchingResult.entityType,
          candidateId: input.candidateId,
          matchedEntityId: candidate.matchedEntityId,
          matchedField: candidate.matchedField,
        },
      });

      return {
        matchingResultId: updated.id,
        candidateId: input.candidateId,
        status: updated.status as any,
        manuallyConfirmed: updated.manuallyConfirmed,
        confirmedAt: updated.confirmedAt?.toISOString() || '',
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * rejectMatchingCandidatesAction — Reject all candidates ("Tidak Ada yang Cocok").
 * Sets: status = TIDAK_DITEMUKAN, manuallyConfirmed = true, confirmedCandidateId = null
 * Requires: STUDENT_WORKFLOW_VERIFY permission
 * Returns: RejectAllCandidatesOutput or error
 */
export async function rejectMatchingCandidatesAction(
  input: RejectAllCandidatesInput
): Promise<ActionResponse<RejectAllCandidatesOutput>> {
  try {
    // Validate input
    if (!input.matchingResultId || typeof input.matchingResultId !== 'string') {
      throw new Error('Validation Error: matchingResultId must be a non-empty string.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // RBAC: STUDENT_WORKFLOW_VERIFY permits rejecting candidates
      assertAuthorizedAction(context, 'STUDENT_WORKFLOW_VERIFY');

      const resultRepo = new PostgresMatchingResultRepository();
      const auditRepo = new PostgresAuditEventRepository();

      // 1. Fetch matching result
      const matchingResult = await resultRepo.getByIdTx(
        tx,
        context.tenantId,
        input.matchingResultId
      );

      if (!matchingResult) {
        throw new Error('Matching result not found.');
      }

      // 2. Check if already manually confirmed (idempotency + immutability)
      if (matchingResult.manuallyConfirmed) {
        throw new Error('Validation Error: This matching result has already been manually confirmed and cannot be changed.');
      }

      // 3. Update matching result to TIDAK_DITEMUKAN
      const now = new Date();
      const updated = await resultRepo.updateConfirmationTx(tx, context.tenantId, input.matchingResultId, {
        status: 'TIDAK_DITEMUKAN',
        manuallyConfirmed: true,
        confirmedCandidateId: null,
        confirmedByUserId: context.actorId,
        confirmedAt: now,
      });

      // 4. Record audit event
      await auditRepo.recordTx(tx, context.tenantId, {
        action: 'MATCHING_REJECTED',
        entityType: 'MatchingResult',
        entityId: input.matchingResultId,
        actorUserId: context.actorId,
        metadata: {
          documentId: matchingResult.documentId,
          documentVersionId: matchingResult.documentVersionId,
          extractionResultId: matchingResult.extractionResultId,
          entityType: matchingResult.entityType,
          reason: 'Tidak ada kandidat yang cocok — ditolak secara manual',
        },
      });

      return {
        matchingResultId: updated.id,
        status: updated.status as any,
        manuallyConfirmed: updated.manuallyConfirmed,
        confirmedAt: updated.confirmedAt?.toISOString() || '',
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
