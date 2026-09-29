# P0-K.4 — Phase 2 Completion Report: CONTRACT

**Date:** 2026-09-29  
**Baseline:** P0-K.3 commit `b14beb4`  
**Status:** COMPLETE — Contract locked; ready for Phase 3 implementation

---

## Deliverables

### 1. Contract File
**Path:** [src/platform/types/document-workflow.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/types/document-workflow.ts)

**Contents:**
- `DocumentWorkflowState` enum — 17 canonical states from P0-K.2 matrix
  - Initial: `DITERIMA`
  - OCR: `SIAP_DIBACA`, `OCR_DIPROSES`, `SELESAI_DIBACA`, `OCR_GAGAL`
  - Extraction: `SIAP_DIEKSTRAKSI`, `DIEKSTRAKSI`, `SELESAI_DIEKSTRAKSI`, `EKSTRAKSI_GAGAL`
  - Matching: `SIAP_DICOCOKKAN`, `DICOCOKKAN`, `MENUNGGU_KONFIRMASI`, `TERKONFIRMASI`, `TIDAK_DITEMUKAN`, `PENCOCOKAN_GAGAL`
  - Completion: `SELESAI`, `DIARSIPKAN`

- `DocumentWorkflowEvent` enum — 19 canonical events from P0-K.2 matrix
  - Initial, OCR, Extraction, Matching, Manual, Completion events

- `DocumentWorkflowTransitionInput` interface
  - tenantId, documentVersionId, event, expectedVersion
  - idempotencyKey (required; deterministic replay key)
  - correlationId (optional; logical grouping)
  - triggeredByUserId (optional; actor from context)
  - reason (optional; justification/error message)

- `DocumentWorkflowTransitionResult` interface
  - success: true
  - workflowInstanceId, previousState, currentState, version
  - transitionId, isReplay flag, timestamp

- `DocumentWorkflowErrorCode` enum — 7 error categories
  - `INVALID_INPUT`, `WORKFLOW_NOT_FOUND`, `INVALID_TRANSITION`
  - `CONCURRENCY_CONFLICT`, `IDEMPOTENT_REPLAY`, `PERSISTENCE_ERROR`
  - `TENANT_ISOLATION_VIOLATION`, `AUTHENTICATION_ERROR`

- `DocumentWorkflowError` interface — structured error with code, message, optional details

- `DocumentWorkflowTransitionResponse` type — union of success | error result

- `DocumentWorkflowService` interface — contract for `transitionDocumentWorkflow()` method

### 2. Semantics & Contracts (Documented in Contract File)

**Tenant Isolation**
- All queries scoped to input tenantId via `runInTenantContext`
- PostgreSQL RLS enforces row-level boundary
- Cross-tenant access returns `WORKFLOW_NOT_FOUND` or `TENANT_ISOLATION_VIOLATION`

**Idempotency**
- Unique key: `(tenantId, workflowInstanceId, idempotencyKey)`
- First request → apply transition, record `WorkflowTransition` and audit
- Replay with identical key → return persisted result, `isReplay=true`
- Replay with same key but different payload → `IDEMPOTENT_REPLAY` error
- Database uniqueness constraint enforces one-winner guarantee

**Optimistic Concurrency (CAS)**
- `UPDATE workflow_instances SET current_state=nextState, version=version+1`
- `WHERE tenant_id=? AND id=? AND version=expectedVersion`
- If 0 rows affected → `CONCURRENCY_CONFLICT`

**Atomicity**
- BEGIN TRANSACTION
  1. Resolve WorkflowInstance by `(tenantId, "DOCUMENT_VERSION", documentVersionId)`
  2. Validate expectedVersion
  3. Perform CAS update
  4. INSERT WorkflowTransition
  5. INSERT AuditEvent via `PostgresAuditEventRepository.recordTx`
- COMMIT (all succeed) or ROLLBACK (any fails)

**Manual Decision Protection**
- Workflow does NOT modify `MatchingResult.manuallyConfirmed` or `MatchingCandidate`
- Workflow state `MENUNGGU_KONFIRMASI`/`TERKONFIRMASI` are workflow states, not matching states
- P0-J.2 owns manual confirmation; P0-K.4 preserves it

**Document Workflow Identity**
- `entityType = "DOCUMENT_VERSION"` (reserved; not used by ExceptionRepository)
- `entityId = documentVersionId`
- Semantic: `(tenantId, "DOCUMENT_VERSION", documentVersionId)` → unique workflow instance

**Event Allow-List (Deferred to P0-K.5)**
- Contract defines valid states/events (enums above)
- P0-K.5 will define matrix: `(currentState, event) → nextState`
- P0-K.4 service accepts any event; P0-K.5 validates against matrix
- Invalid transitions return `INVALID_TRANSITION` (caught by P0-K.5)

### 3. Type Export
**File:** [src/platform/types/index.ts](file:///C:/Users/USER/Documents/sms-v1.0/src/platform/types/index.ts)

Added export line:
```typescript
export * from './document-workflow';
```

Contract types now available via:
```typescript
import {
  DocumentWorkflowState,
  DocumentWorkflowEvent,
  DocumentWorkflowTransitionInput,
  DocumentWorkflowTransitionResult,
  DocumentWorkflowErrorCode,
  DocumentWorkflowService
} from '@/platform/types';
```

---

## Validation Results

| Check | Result |
|---|---|
| TypeScript (contract file) | ✅ PASS (Prisma pre-existing errors unrelated) |
| TypeScript (exports) | ✅ PASS |
| git diff --check | ✅ PASS |
| No schema changes | ✅ PASS (schema locked at P0-K.3) |
| No implementation | ✅ PASS (types only) |
| No P0-K.5 allow-list | ✅ PASS (deferred as required) |

---

## Files Changed

```
src/platform/types/document-workflow.ts        (new file, 283 lines)
src/platform/types/index.ts                    (1 line added: export)
```

**Untracked artifacts:**
- P0-K2-WORKFLOW-CONTRACT.md (baseline document)
- P0-K4-AUDIT-REPORT.md (audit findings)

---

## Key Design Decisions

### ✅ Locked in Contract

1. **17 states** from P0-K.2 matrix (no additions, no deletions)
2. **19 events** from P0-K.2 matrix
3. **Document identity:** `("DOCUMENT_VERSION", documentVersionId)` → unique per tenant+document
4. **Idempotency key:** `(tenantId, workflowInstanceId, idempotencyKey)` → unique at DB
5. **Optimistic CAS:** version field enables concurrency control
6. **Atomic audit:** `PostgresAuditEventRepository.recordTx` within transaction
7. **Manual decision immutable:** P0-J.2 owns confirmation; P0-K.4 preserves it
8. **Event allow-list deferred:** P0-K.5 responsibility (not enforced here)

### ❌ Deferred (P0-K.4 Phase 3+)

- Repository implementation
- Service implementation
- Event allow-list validation (P0-K.5)
- OCR/extraction/matching execution

### ⚠️ Known Gap

- `event` field is nullable in P0-K.3 schema (should be NOT NULL after P0-K.5 populates)
- P0-K.4 Phase 3 tests should validate event is non-empty string

---

## Next Phase: P0-K.4 Phase 3

Ready to implement:
1. `PostgresWorkflowRepository` — persistence layer
2. `DocumentWorkflowService` — transition orchestration (CAS, idempotency, audit)
3. Integration tests — idempotency, concurrency, tenant isolation, replay

Contract is final; no changes expected to types without P0-K.5 validation needs.

---

## Git Status

```
## main...origin/main [ahead 2]
 M  src/platform/types/index.ts
 ?? P0-K2-WORKFLOW-CONTRACT.md
 ?? P0-K4-AUDIT-REPORT.md
 ?? src/platform/types/document-workflow.ts
```

Working tree clean relative to contract changes. Ready to commit.

