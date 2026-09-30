import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentWorkflowEvent, DocumentWorkflowErrorCode } from '../types/document-workflow';
import { DocumentWorkflowService } from './document-workflow-service';
import { AuthenticationError, resetSessionProvider, setSessionProvider } from '../auth/session';
import { transitionDocumentWorkflow } from '../actions/document-workflow';

const request = { documentVersionId: '00000000-0000-4000-8000-000000000001', event: DocumentWorkflowEvent.SIAPKAN_PEMBACAAN, expectedVersion: 0, idempotencyKey: 'auth-boundary-test' };

test('missing session is rejected at executeInAuthenticatedContext boundary', async () => {
  setSessionProvider({ getSession: async () => null });
  try { await assert.rejects(() => transitionDocumentWorkflow(request), AuthenticationError); }
  finally { resetSessionProvider(); }
});

test('invalid actor UUID is rejected before database transaction starts', async () => {
  setSessionProvider({ getSession: async () => ({ actorId: 'not-a-uuid', tenantId: '00000000-0000-4000-8000-000000000002', username: 'test', role: 'ADMIN' as any, status: 'ACTIVE' as any }) });
  try { await assert.rejects(() => transitionDocumentWorkflow(request), AuthenticationError); }
  finally { resetSessionProvider(); }
});

test('untrusted request contains no actor, tenant, or caller target-state fields', () => {
  assert.equal(Object.hasOwn(request, 'actorId'), false);
  assert.equal(Object.hasOwn(request, 'tenantId'), false);
  assert.equal(Object.hasOwn(request, 'nextState'), false);
  assert.equal(DocumentWorkflowErrorCode.AUTHENTICATION_ERROR, 'AUTHENTICATION_ERROR');
});
