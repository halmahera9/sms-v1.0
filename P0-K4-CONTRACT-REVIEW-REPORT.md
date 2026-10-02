# P0-K.4 Contract Review & Amendment — Authoritative Resolver

**Status: FINAL CONTRACT AMENDMENT; implementation not authorized here.**

## Contract gap addressed

P0-K.2 defines each edge as `(currentState, event) -> nextState`; some event names can target different states depending on current state. P0-K.4's initial input carried an event but did not define who authoritatively returns `toState`. Caller-provided targets are unsafe, and embedding the matrix in P0-K.4 would take ownership from P0-K.5.

## Final ownership decision

- Caller provides event, expectedVersion, idempotency key and request context only. Caller cannot provide `currentState`, `nextState` or `toState`.
- P0-K.4 service reads the persisted state and invokes the injected `DocumentWorkflowTransitionResolver` with persisted currentState, event, explicit abstract guard evidence and tenant/auth context.
- Resolver returns authoritative `fromState`/`toState` or canonical rejection. Service checks returned fromState matches persisted state and fails closed on absent resolver/rejection.
- P0-K.5 owns the concrete resolver, matrix and allow-list. P0-K.4 contains no event mapping or duplicate business rules.
- Repository remains persistence-only. Service owns tenant transaction coordination, resolver invocation, replay/CAS and audit boundary.

## Final semantics

### Context and guards

Context is an abstraction for immutable, trusted, authorized tenant/auth/evidence information. This amendment deliberately specifies no concrete evidence fields or domain guard requirements; those belong to P0-K.5. Resolver is side-effect-free.

### Identity and initialization

Workflow identity is `(tenantId, "DOCUMENT_VERSION", documentVersionId)`. All access is tenant/RLS scoped. Missing instance returns `WORKFLOW_NOT_FOUND`; no implicit creation from an arbitrary event. Initialization requires a separate contract.

### Optimistic concurrency

`expectedVersion` must match persisted `WorkflowInstance.version`. CAS is scoped by tenant, instance and version; a successful transition writes the resolver's target and increments version exactly once. Zero updated rows returns `CONCURRENCY_CONFLICT`.

### Idempotency and replay

Database uniqueness remains `(tenantId, workflowInstanceId, idempotencyKey)`. Replay lookup precedes stale-version/CAS rejection. Minimum request identity is `event` and `expectedVersion`; the transition is also naturally bound to workflow instance by the unique key. Request-equivalent replay returns persisted result/version with `isReplay=true`, without state mutation, another transition or another audit. Same key with a different identity returns the canonical idempotency conflict (`IDEMPOTENT_REPLAY`). `correlationId` and `reason` are metadata only, not request identity.

### Correlation and actor provenance

`correlationId` is optional and may span distinct transitions; it is never unique. `reason` is optional metadata. Actor identity must originate in authenticated/tenant context. No hard-coded system actor fallback; a trusted worker needs explicit authenticated service identity.

### Atomicity and audit

A single `runInTenantContext` transaction encloses resolver decision, conditional CAS, `WorkflowTransition` persistence, `WorkflowInstance` state/version update and `PostgresAuditEventRepository.recordTx`. Any failure rolls back the entire mutation set. Replays do not write transition or audit rows.

## Canonical error categories

The contract uses semantic categories: `INVALID_INPUT`, `WORKFLOW_NOT_FOUND`, `CONCURRENCY_CONFLICT`, `IDEMPOTENT_REPLAY`, `PERSISTENCE_ERROR`, `INVALID_TRANSITION`, and `AUTHENTICATION_ERROR`. `IDEMPOTENT_REPLAY` means the key was reused with a request identity mismatch. `INVALID_TRANSITION` is a resolver rejection, not a P0-K.4 allow-list decision. There is no separate tenant-isolation category: tenant/RLS isolation fails closed and must not disclose cross-tenant records.

## Revised contract artifact

[document-workflow.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/types/document-workflow.ts) now defines the resolver dependency and resolved transition DTO, a caller input without target state, server service context, response/error types and normative semantics. The previous contradictory draft prose was removed. [types/index.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/types/index.ts) already exports the contract; no additional export change was needed.

## Validation and review

- Targeted TypeScript contract typecheck: PASS.
- `git diff --check`: PASS.
- No schema/migration, service/repository implementation, runtime test, resolver registry, UI or orchestration changes.
- P0-K.5 concrete resolver remains unimplemented.

**STOP:** This is contract-only. No implementation commit is made pending user review.
