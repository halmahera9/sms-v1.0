/**
 * P0-K.4 — Document Workflow Transition Service
 *
 * Orchestrates workflow transitions with:
 * - Replay detection by idempotency key
 * - Optimistic CAS for concurrency safety
 * - Atomic audit logging via PostgresAuditEventRepository
 * - Resolver invocation for authoritative state resolution
 *
 * Boundary responsibilities:
 * - Tenant/actor context validation
 * - Replay lookup BEFORE CAS validation
 * - Resolver invocation with guard evidence
 * - Atomic transaction: CAS + transition + audit
 * - Fail-closed error handling
 */

import { Prisma, PrismaClient } from '@prisma/client';
import {
  DocumentWorkflowState,
  DocumentWorkflowEvent,
  DocumentWorkflowServiceInput,
  DocumentWorkflowTransitionResult,
  DocumentWorkflowTransitionResponse,
  DocumentWorkflowError,
  DocumentWorkflowErrorCode,
  DocumentWorkflowTransitionResolver,
  DocumentWorkflowServiceContract,
} from '../types/document-workflow';
import {
  PostgresWorkflowRepository,
  runWorkflowInTenantTx,
  WorkflowRepositoryTxContext,
} from './postgres-workflow-repository';
// Audit repository interface (avoids circular import)
export interface IAuditEventRepository {
  recordTx(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    actorUserId: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Canonical error factory for DocumentWorkflowError responses.
 */
function workflowError(
  code: DocumentWorkflowErrorCode,
  message: string,
  details?: Record<string, unknown>
): DocumentWorkflowError {
  return { code, message, details };
}

/**
 * DocumentWorkflowService — P0-K.4 implementation.
 *
 * Implements DocumentWorkflowServiceContract interface.
 * Service is the orchestration boundary; repository is persistence-only.
 */
export class DocumentWorkflowService implements DocumentWorkflowServiceContract {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditRepository: IAuditEventRepository
  ) {}

  /**
   * Transition document workflow.
   *
   * Implements complete workflow transition lifecycle:
   * 1. Validate input and tenant/actor context
   * 2. Lookup WorkflowInstance (fail-closed)
   * 3. Check replay by idempotency key (BEFORE CAS)
   * 4. Invoke resolver for authoritative toState
   * 5. Optimistic CAS update
   * 6. Persist transition
   * 7. Record audit atomically
   * 8. Return result
   *
   * @param input service input with tenant/actor/event
   * @param resolver P0-K.5 authoritative transition resolver
   * @returns transition result or error
   */
  async transitionDocumentWorkflow(
    input: DocumentWorkflowServiceInput,
    resolver: DocumentWorkflowTransitionResolver
  ): Promise<DocumentWorkflowTransitionResponse> {
    try {
      // ====================================================================
      // VALIDATION
      // ====================================================================

      // Validate input
      if (
        !input.tenantId ||
        !input.documentVersionId ||
        !input.event ||
        input.expectedVersion == null ||
        !input.idempotencyKey ||
        !input.actorId ||
        !input.documentId
      ) {
        return {
          success: false,
          error: workflowError(
            DocumentWorkflowErrorCode.INVALID_INPUT,
            'Missing required transition input fields'
          ),
        };
      }

      // Validate expectedVersion is non-negative
      if (input.expectedVersion < 0) {
        return {
          success: false,
          error: workflowError(
            DocumentWorkflowErrorCode.INVALID_INPUT,
            'expectedVersion must be non-negative'
          ),
        };
      }

      // ====================================================================
      // TRANSACTION: Replay + CAS + Persistence + Audit
      // ====================================================================

      const result = await runWorkflowInTenantTx(
        this.prisma,
        input.tenantId,
        async (txContext: WorkflowRepositoryTxContext) => {
          const { repository } = txContext;

          // Lookup WorkflowInstance
          // Fail-closed: no implicit create from arbitrary event
          const instance = await repository.getWorkflowInstance(
            input.tenantId,
            input.documentVersionId
          );

          if (!instance) {
            throw {
              code: DocumentWorkflowErrorCode.WORKFLOW_NOT_FOUND,
              message: `WorkflowInstance not found for documentVersionId "${input.documentVersionId}"`,
            };
          }

          // ================================================================
          // REPLAY DETECTION (before CAS/version validation)
          // ================================================================

          const existingTransition =
            await repository.getTransitionByIdempotencyKey(
              input.tenantId,
              instance.id,
              input.idempotencyKey
            );

          if (existingTransition) {
            // Found existing transition with same key
            // Verify request equivalence (event + expectedVersion match)
            if (
              existingTransition.event !== input.event ||
              existingTransition.fromState !== instance.currentState
            ) {
              // Different payload with same key = idempotency conflict
              throw {
                code: DocumentWorkflowErrorCode.IDEMPOTENCY_CONFLICT,
                message: `Idempotency key reused with different event or state. Previous: event="${existingTransition.event}" from="${existingTransition.fromState}", current: event="${input.event}" from="${instance.currentState}"`,
              };
            }

            // Equivalent replay: return stored transition result
            const replayResult: DocumentWorkflowTransitionResponse = {
              success: true,
              data: {
                success: true,
                workflowInstanceId: instance.id,
                previousState: existingTransition.fromState as DocumentWorkflowState,
                currentState: instance.currentState as DocumentWorkflowState,
                version: instance.version,
                transitionId: existingTransition.id,
                isReplay: true,
                timestamp: existingTransition.createdAt.toISOString(),
              },
            };
            return replayResult;
          }

          // ================================================================
          // RESOLVER INVOCATION
          // ================================================================

          let resolved;
          try {
            resolved = await resolver.resolve(
              instance.currentState as DocumentWorkflowState,
              input.event as DocumentWorkflowEvent,
              {
                tenantId: input.tenantId,
                actorId: input.actorId,
                documentId: input.documentId,
                documentVersionId: input.documentVersionId,
                evidence: input.guardEvidence,
              }
            );
          } catch (err) {
            // Resolver rejection: transition not allowed
            throw {
              code: DocumentWorkflowErrorCode.TRANSITION_REJECTED,
              message: `Transition rejected by resolver: ${err instanceof Error ? err.message : String(err)}`,
            };
          }

          // Verify resolver returned valid transition
          if (!resolved || !resolved.toState) {
            throw {
              code: DocumentWorkflowErrorCode.PERSISTENCE_ERROR,
              message: 'Resolver returned invalid transition result',
            };
          }

          // ================================================================
          // OPTIMISTIC CAS UPDATE
          // ================================================================

          const casResult = await repository.casUpdateWorkflowInstance(
            input.tenantId,
            instance.id,
            input.expectedVersion,
            resolved.toState
          );

          if (!casResult.success) {
            // CAS failed: another writer changed version
            throw {
              code: DocumentWorkflowErrorCode.CONCURRENCY_CONFLICT,
              message: `Workflow instance version mismatch. Expected ${input.expectedVersion}, but persisted version differs. Another transition may have succeeded.`,
              details: {
                expectedVersion: input.expectedVersion,
                workflowInstanceId: instance.id,
              },
            };
          }

          // ================================================================
          // PERSIST TRANSITION
          // ================================================================

          const transition = await repository.persistWorkflowTransition(
            input.tenantId,
            instance.id,
            input.event,
            resolved.fromState,
            resolved.toState,
            input.idempotencyKey,
            input.actorId,
            input.correlationId,
            input.reason
          );

          // ================================================================
          // RECORD AUDIT (same transaction)
          // ================================================================

          await this.auditRepository.recordTx(
            input.tenantId,
            'DOCUMENT_WORKFLOW_TRANSITIONED',
            'WORKFLOW_INSTANCE',
            instance.id,
            input.actorId,
            {
              documentVersionId: input.documentVersionId,
              documentId: input.documentId,
              event: input.event,
              fromState: resolved.fromState,
              toState: resolved.toState,
              version: casResult.instance?.version || instance.version + 1,
              transitionId: transition.id,
              idempotencyKey: input.idempotencyKey,
              correlationId: input.correlationId,
              reason: input.reason,
            }
          );

          // ================================================================
          // SUCCESS RESULT
          // ================================================================

          const successResult: DocumentWorkflowTransitionResponse = {
            success: true,
            data: {
              success: true,
              workflowInstanceId: instance.id,
              previousState: resolved.fromState,
              currentState: resolved.toState,
              version: casResult.instance?.version || instance.version + 1,
              transitionId: transition.id,
              isReplay: false,
              timestamp: new Date().toISOString(),
            },
          };

          return successResult;
        }
      );

      return result;
    } catch (err: any) {
      // Handle thrown errors from transaction
      if (err.code && err.message) {
        // Already formatted error
        return {
          success: false,
          error: workflowError(err.code, err.message, err.details),
        };
      }

      // Unexpected error
      return {
        success: false,
        error: workflowError(
          DocumentWorkflowErrorCode.PERSISTENCE_ERROR,
          `Workflow transition failed: ${err instanceof Error ? err.message : String(err)}`
        ),
      };
    }
  }
}

/**
 * Factory for DocumentWorkflowService.
 * Inject P0-K.5 resolver and audit repository.
 */
export function createDocumentWorkflowService(
  prisma: PrismaClient,
  auditRepository: IAuditEventRepository
): DocumentWorkflowService {
  return new DocumentWorkflowService(prisma, auditRepository);
}
