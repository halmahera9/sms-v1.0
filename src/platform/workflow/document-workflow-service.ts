import type { AuthenticatedActorContext } from '../auth/session';
import type { TenantTransactionClient } from '../db/tenant-context';
import type { IAuditEventRepository } from '../repositories/audit-event';
import type { DocumentWorkflowError, DocumentWorkflowServiceContract, DocumentWorkflowTransitionRequest, DocumentWorkflowTransitionResolver, DocumentWorkflowTransitionResponse, ResolvedDocumentWorkflowTransition } from '../types/document-workflow';
import { DocumentWorkflowErrorCode, DocumentWorkflowState } from '../types/document-workflow';
import { PostgresWorkflowRepository } from './postgres-workflow-repository';

function workflowError(code: DocumentWorkflowErrorCode, message: string): DocumentWorkflowError { return { code, message }; }

/** Orchestrator; receives identity and transaction only from one trusted auth callback. */
export class DocumentWorkflowService implements DocumentWorkflowServiceContract {
  constructor(private readonly auditRepository: IAuditEventRepository) {}

  async transitionDocumentWorkflow(authContext: AuthenticatedActorContext, tx: TenantTransactionClient,
    input: DocumentWorkflowTransitionRequest, resolver: DocumentWorkflowTransitionResolver): Promise<DocumentWorkflowTransitionResponse> {
    if (!authContext?.actorId || !authContext.tenantId || !tx) {
      return { success: false, error: workflowError(DocumentWorkflowErrorCode.AUTHENTICATION_ERROR, 'Authenticated actor, tenant, and transaction are required') };
    }
    if (!input?.documentVersionId || !input.event || !input.idempotencyKey ||
      !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
      return { success: false, error: workflowError(DocumentWorkflowErrorCode.INVALID_INPUT, 'Missing or invalid transition request') };
    }
    try {
      const repository = new PostgresWorkflowRepository(tx);
      const instance = await repository.getWorkflowInstanceByEntity(authContext.tenantId, 'DOCUMENT_VERSION', input.documentVersionId);
      if (!instance) return { success: false, error: workflowError(DocumentWorkflowErrorCode.WORKFLOW_NOT_FOUND, 'WorkflowInstance not found') };
      const previous = await repository.getTransitionByIdempotencyKey(authContext.tenantId, instance.id, input.idempotencyKey);
      if (previous) {
        if (previous.event !== input.event || previous.expectedVersion !== input.expectedVersion) {
          return { success: false, error: workflowError(DocumentWorkflowErrorCode.IDEMPOTENCY_CONFLICT, 'Idempotency key reused with a different request identity') };
        }
        return { success: true, data: { success: true, workflowInstanceId: instance.id,
          previousState: previous.fromState as DocumentWorkflowState, currentState: previous.toState as DocumentWorkflowState,
          version: previous.expectedVersion + 1, transitionId: previous.id, isReplay: true, timestamp: previous.createdAt.toISOString() } };
      }
      const documentVersion = await repository.getDocumentVersion(authContext.tenantId, input.documentVersionId);
      let resolved: ResolvedDocumentWorkflowTransition;
      try {
        resolved = await resolver.resolve(instance.currentState as DocumentWorkflowState, input.event, {
          tenantId: authContext.tenantId,
          actorId: authContext.actorId,
          documentId: input.documentVersionId,
          documentVersionId: input.documentVersionId,
          evidence: { documentVersionValid: documentVersion !== null },
        });
      } catch (error) {
        return { success: false, error: workflowError(DocumentWorkflowErrorCode.TRANSITION_REJECTED,
          `Transition rejected by resolver: ${error instanceof Error ? error.message : String(error)}`) };
      }
      if (!resolved?.toState || resolved.fromState !== instance.currentState) {
        return { success: false, error: workflowError(DocumentWorkflowErrorCode.TRANSITION_REJECTED, 'Resolver fromState does not match persisted currentState') };
      }
      if (instance.version !== input.expectedVersion) {
        return { success: false, error: workflowError(DocumentWorkflowErrorCode.CONCURRENCY_CONFLICT,
          `Workflow version mismatch: expected ${input.expectedVersion}, persisted ${instance.version}`) };
      }
      const cas = await repository.casUpdateWorkflowInstance(authContext.tenantId, instance.id, input.expectedVersion, resolved.toState);
      if (!cas.success || !cas.instance) return { success: false, error: workflowError(DocumentWorkflowErrorCode.CONCURRENCY_CONFLICT, 'Workflow version changed during transition') };
      const transition = await repository.persistWorkflowTransition(authContext.tenantId, instance.id, input.event,
        input.expectedVersion, resolved.fromState, resolved.toState, input.idempotencyKey, authContext.actorId,
        input.correlationId, input.reason);
      await this.auditRepository.recordTx(tx, authContext.tenantId, { actorUserId: authContext.actorId,
        action: 'DOCUMENT_WORKFLOW_TRANSITIONED', entityType: 'WORKFLOW_INSTANCE', entityId: instance.id,
        beforeState: { state: resolved.fromState, version: instance.version }, afterState: { state: resolved.toState, version: cas.instance.version },
        metadata: { documentVersionId: input.documentVersionId, event: input.event, idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId, reason: input.reason, transitionId: transition.id } });
      return { success: true, data: { success: true, workflowInstanceId: instance.id, previousState: resolved.fromState,
        currentState: resolved.toState, version: cas.instance.version, transitionId: transition.id,
        isReplay: false, timestamp: transition.createdAt.toISOString() } };
    } catch (error) {
      const err = error as { code?: DocumentWorkflowErrorCode; message?: string };
      return { success: false, error: workflowError(err.code ?? DocumentWorkflowErrorCode.PERSISTENCE_ERROR,
        err.message ?? `Workflow transition failed: ${error instanceof Error ? error.message : String(error)}`) };
    }
  }
}
