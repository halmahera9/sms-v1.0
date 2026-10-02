# P0-J.2 — Manual Matching Confirmation Foundation
## PHASE 1 — AUDIT REPORT

**Baseline Commit:** f133368 (current main)
**Audit Date:** 2026-09-29T18:14Z
**Status:** ✅ AUDIT COMPLETE — Ready for implementation

---

## A. SCHEMA AUDIT

### MatchingResult ✅
- **Location:** `prisma/schema.prisma:417-457`
- **Status:** Canonical, no orphan fields
- **Fields verified:**
  - `id`, `tenantId`, `documentId`, `documentVersionId`, `extractionResultId` ✅
  - `entityType` (STUDENT/EMPLOYEE) ✅
  - `extractedValue`, `status` (MatchingStatus enum) ✅
  - `confidenceScore`, `matchingReason` ✅
  - `manuallyConfirmed` (default: false) ✅
  - `confirmedCandidateId` (FK to MatchingCandidate) ✅
  - `confirmedByUserId` (FK to UserActor) ✅
  - `confirmedAt` (DateTime nullable) ✅
  - Timestamp fields: `createdAt`, `updatedAt` ✅
- **Unique constraints:**
  - `@@unique([tenantId, documentVersionId, extractionResultId, entityType])` ✅
  - `@@unique([tenantId, id])` ✅
- **Indexes:**
  - Status-based queries ✅
  - manuallyConfirmed lookup ✅
- **Tenant isolation:** 
  - All queries scoped to tenantId ✅
  - Relation to UserActor scoped to tenantId ✅

### MatchingCandidate ✅
- **Location:** `prisma/schema.prisma:461-487`
- **Status:** Canonical
- **Fields verified:**
  - `id`, `tenantId`, `matchingResultId` ✅
  - `matchedEntityId` (Student.id or Employee.id) ✅
  - `entityType`, `matchedField` ✅
  - `candidateScore`, `candidateReason` ✅
  - `ranking` (deterministic order) ✅
  - Timestamp: `createdAt` ✅
- **Unique constraints:**
  - `@@unique([tenantId, matchingResultId, matchedEntityId])` — ensures one candidate per entity ✅
  - `@@unique([tenantId, id])` ✅
- **Tenant isolation:**
  - All scoped to tenantId ✅
  - Relation to MatchingResult cascades correctly ✅

### MatchingStatus Enum ✅
- `COCOK` — automatic or manual match found
- `PERLU_DIPERIKSA` — multiple candidates, requires human decision
- `TIDAK_DITEMUKAN` — no candidates found, manual rejection or auto-determination
- All values used consistently in matcher

### Relations ✅
- `MatchingResult.confirmedCandidate` → `MatchingCandidate` (optional)
- `MatchingResult.confirmedByUser` → `UserActor` (optional)
- Both relations scoped to tenantId ✅
- No circular dependencies ✅

---

## B. EXISTING MATCHER AUDIT

### Location
`src/platform/services/document-identity-matcher.ts` (503 lines)

### Deterministic Matching ✅
- **STUDENT priority:** NISN → NIS → normalized name
- **EMPLOYEE priority:** NIP → NIK → normalized name
- No fuzzy matching, no AI
- Score constants: EXACT_IDENTIFIER=100, EXACT_NAME=60

### Manual Decision Protection ✅
**Code inspection (lines 273-305):**
```typescript
if (existing?.manuallyConfirmed) {
  // Manual decision exists — do NOT overwrite
  // Returns with wasReused: true
  // Audit: MATCHING_REUSED
  // confirmedCandidateId, confirmedByUserId, confirmedAt NOT touched
}
```

**Verdict:**
- ✅ Rerun against `manuallyConfirmed = true` is non-destructive
- ✅ `confirmedCandidateId` never overwritten
- ✅ Status `COCOK` (if manual) never changed to `PERLU_DIPERIKSA`
- ✅ Rejection decision (`TIDAK_DITEMUKAN`) protected
- ✅ No duplicate candidates created (upsert on unique key)

### Audit Events ✅
Available constants (lines 12-17):
- `MATCHING_STARTED` — matcher invoked
- `MATCHING_COMPLETED` — candidates found/saved
- `MATCHING_FAILED` — error during matching
- `MATCHING_REUSED` — manual decision preserved

**Gap identified:** Events for **manual confirmation** and **manual rejection** not yet present. Will add during PHASE 3.

---

## C. RBAC AUDIT

### Available Permissions (from `src/platform/auth/guards.ts`)

#### Document Intelligence related:
- `DOCUMENT_READ` → [ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR, AUDITOR]
- `DOCUMENT_UPLOAD` → [ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR]
- `DOCUMENT_WRITE` → [ADMIN, ADMIN_TENANT, OPERATOR]
- `OCR_READ` → [ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR, AUDITOR]
- `OCR_EXECUTE` → [ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR]

#### Workflow/Verification related:
- `STUDENT_WORKFLOW_VERIFY` → [ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR]
- `AUDIT_EVENT_READ` → [ADMIN, ADMIN_TENANT, AUDITOR, VERIFIKATOR]

### Canonical Permission Selection for P0-J.2

**For reading matching results:** `DOCUMENT_READ` ✅
- Rationale: Matching is part of document intelligence pipeline
- Covers: ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR, AUDITOR
- Aligns with document intake/OCR permissions

**For confirming/rejecting candidates:** `STUDENT_WORKFLOW_VERIFY` ✅
- Rationale: Decision to confirm identity is verification activity
- Covers: ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR
- Excludes AUDITOR (read-only)
- Matches existing student workflow verification RBAC

### Decision
**No new roles/permissions needed.** Use existing canonical permissions.

---

## D. AUDIT REPOSITORY AUDIT

### PostgresAuditEventRepository ✅
- **Location:** `src/platform/repositories/audit-event.ts` (214 lines)
- **Interface:** `IAuditEventRepository`
- **Methods:**
  - `recordTx(tx, tenantId, event)` — transactional record creation
  - `findRecentTx(tx, tenantId, limit)` — fetch recent events
  - `findByEntityTx(tx, tenantId, entityType, entityId)` — entity-scoped audit trail
  - Non-tx helpers: `recordInContext`, `findRecentInContext`, `findByEntityInContext`

### Audit Event Contract
```typescript
interface AuditEventInput {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  beforeState?: unknown;
  afterState?: unknown;
}
```

### Audit Events to Add for P0-J.2
Minimal additions (lines to define):
- **`MATCHING_CONFIRMED`** — user confirmed a candidate
  - Payload: `{ matchingResultId, candidateId, selectedCandidateName }`
- **`MATCHING_REJECTED`** — user rejected all candidates ("Tidak Ada yang Cocok")
  - Payload: `{ matchingResultId, rejectionReason? }`

These will be recorded in audit event recorder with consistent tenant scoping.

---

## E. UI CONVENTIONS AUDIT

### Server Action Pattern (from `src/platform/actions/audit.ts`, `student.ts`)
✅ Canonical patterns found:

**1. Error Handling**
```typescript
function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) → { code: 'UNAUTHENTICATED' }
  if (err instanceof AuthorizationError) → { code: 'FORBIDDEN' }
  if (err instanceof Error && msg.startsWith('Validation Error:')) → { code: 'VALIDATION_ERROR' }
  default → { code: 'INTERNAL_ERROR' }
}
```
**Use this pattern** for all P0-J.2 actions.

**2. Authentication & Tenant Context**
```typescript
const result = await executeInAuthenticatedContext(async (context, tx) => {
  assertAuthorizedAction(context, 'PERMISSION_KEY');
  // ... business logic using tx (tenant-scoped transaction)
});
```
**Must use** for all mutations.

**3. Response Type**
```typescript
export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```
**Standard return type** for all actions.

**4. DTO Pattern**
```typescript
export interface RecordDTO {
  id: string;
  tenantId: string;
  // ... fields
  createdAt: string;
  updatedAt: string;
}
```
**Return only necessary fields** to client (no password hashes, internal IDs).

### Client Component Patterns
- No direct DB mutation from Client Components ✅
- `'use server'` directive on all Server Actions ✅
- `useActionState` hook for form submission (from Next.js 15)
- Error boundaries for graceful error display

### Page Structure
- Current matching page at: `src/app/app/intelligence/matching/page.tsx`
- Header with breadcrumb/context
- Card-based layout
- Icons from `lucide-react`
- Responsive grid/flex

---

## F. EXISTING REPOSITORIES

### Available repository classes:
- `PostgresStudentRepository` — Student lookup
- `PostgresEmployeeRepository` — Employee lookup
- `PostgresAuditEventRepository` — Audit events
- Base pattern: `Tx` suffix methods for transactional queries

### Need to create for P0-J.2:
- **MatchingResult repository** — read/write matching results
- **MatchingCandidate repository** — read matching candidates

---

## G. TYPES AUDIT

### Existing type exports
- `src/platform/types/index.ts` exports:
  - Generic `WorkflowState`, `ValidationResult`, `ExceptionItem`, `AuditEvent`
  - `ActionErrorCode`, `ActionError`, `ActionResponse` (from actions.ts)
  - Document intelligence contracts from separate modules

### Types to create for P0-J.2
- **`MatchingResultDTO`** — read model for UI
- **`MatchingCandidateDTO`** — candidate display model
- **`ConfirmMatchingCandidateInput`** — action input
- **`ConfirmMatchingCandidateOutput`** — action response
- **`RejectAllCandidatesInput`** — action input
- **`RejectAllCandidatesOutput`** — action response

---

## AUDIT FINDINGS SUMMARY

| Category | Status | Finding |
|---|---|---|
| Schema | ✅ PASS | All required fields, relations, and constraints present. No orphan fields. |
| Matcher | ✅ PASS | Manual decision protection working. Rerun non-destructive. No fuzzy matching. |
| RBAC | ✅ PASS | Canonical permissions available. No new roles needed. |
| Audit | ✅ PASS | Infrastructure present. Need to add two new event types. |
| UI Patterns | ✅ PASS | Server Action, error handling, DTO patterns established. |
| Repositories | ⚠️ ACTION | Need to create matching-result and matching-candidate repositories. |
| Types | ⚠️ ACTION | Need to create matching DTO types. |

---

## READY FOR PHASE 2 & 3

No blocking issues found. All hard rules are compliant. Ready to proceed with CONTRACT documentation and IMPLEMENTATION.
