'use server';

import { executeInAuthenticatedContext } from '@/platform/auth';
import type { DocumentWorkflowTransitionRequest } from '@/platform/types/document-workflow';
import { documentWorkflowTransitionRegistry } from '@/platform/workflow/document-workflow-transition-registry';
import { DocumentWorkflowService } from '@/platform/workflow/document-workflow-service';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';

const service = new DocumentWorkflowService(new PostgresAuditEventRepository());

export async function transitionDocumentWorkflow(request: DocumentWorkflowTransitionRequest) {
  return executeInAuthenticatedContext((authContext, tx) =>
    service.transitionDocumentWorkflow(authContext, tx, request, documentWorkflowTransitionRegistry)
  );
}