# DECISIONS AND CONTRACTS

## Contract 1: Multi-Tenancy via PostgreSQL RLS

**Location:** `src/platform/db/tenant-context.ts`

**Contract:**
- Every database operation MUST be wrapped in `runInTenantContext(actorId, tenantId, callback)`.
- The callback MUST use the `tx` (TenantTransactionClient) parameter — NEVER the global
  `prisma` instance inside a transaction.
- `set_tenant_context(actorId::uuid, tenantId::uuid)` is called via parameterized `$executeRaw`
  before the business query.
- If `set_tenant_context` throws, the transaction rolls back and the error propagates.
- `actorId` and `tenantId` MUST be non-null — enforced with an early guard.

**Enforcement:** Checked at runtime. Violation results in RLS policy rejection at the
PostgreSQL level (the stored procedure validates actor membership in `user_actors`).

---

## Contract 2: Server Action Boundary & Canonical DTOs (Phase 4L)

**Locations:** `src/platform/types/actions.ts`, All `'use server'` files in `src/platform/actions/` and `src/domains/`

**Contract:**
- All server actions return `ActionResponse<T> = { success: boolean; data?: T; error?: ActionError }`.
- `ActionErrorCode` is strictly typed: `'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'DOMAIN_ERROR' | 'INTERNAL_ERROR'`.
- All server actions call `handleActionError()` in their catch block — never expose raw errors.
- Sensitive errors (RLS violations matching `SECURITY ERROR:` prefix) are masked to clients.
- The client NEVER sends `actorId` or `tenantId` — these are always resolved server-side.
- Serialization via `JSON.parse(JSON.stringify(...))` before returning — prevents Prisma type leakage.

**Violation indicator:** Any server action that accepts `tenantId` or `actorId` as a parameter
from client code violates this contract.

---

## Contract 3: Audit Immutability & Access Control

**Location:** `src/platform/repositories/audit-event.ts`, `src/platform/actions/audit.ts`

**Contract:**
- `AuditEvent` rows are APPEND-ONLY. No UPDATE or DELETE operations exist in the repository.
- Every audit event MUST have a valid UUID for `tenantId`, `entityId`, and optionally `eventId`.
- Audit events are written in the SAME transaction as the mutation they record — never in
  a separate transaction.
- `beforeState` and `afterState` are serialized via `JSON.parse(JSON.stringify())` before
  storage — no circular references or Prisma objects.
- Reading audit logs via `getRecentAuditEventsAction` requires explicit `AUDIT_EVENT_READ` RBAC
  authorization (`ADMIN`, `ADMIN_TENANT`, `AUDITOR`, `VERIFIKATOR`).

**Enforcement:** UUID validation guards in `recordTx()` throw `SECURITY/SCHEMA ERROR` on
invalid identifiers; database triggers reject deletes/updates on `audit_events`.

---

## Contract 4: Workflow Transition Contract

**Location:** `src/platform/workflow/engine.ts`, domain workflow files

**Contract:**
- All workflow state transitions MUST be defined in a domain-specific `WorkflowDefinition`.
- Transitions MUST have an explicit `event` string and `from` state (or `from: '*'` for universal).
- Optional `guard` functions evaluate business rules before transition — returns boolean.
- The engine enforces `canTransition()` before executing `transition()`.
- Invalid transitions throw `Error` (caught and mapped to `DOMAIN_ERROR` in server actions).

**Employee Award Workflow States:**
`NOMINATIF` $\to$ `BELUM_UPLOAD` $\to$ `SEBAGIAN` $\to$ `LENGKAP` $\to$ `DIVERIFIKASI` $\to$
`SIAP_GENERATE` $\to$ `GENERATED` $\to$ `DITANDATANGANI` $\to$ `DIKIRIM` $\to$ `SELESAI`

---

## Contract 5: Document Intelligence Orchestrator Contract

**Location:** `src/platform/types/document-intelligence.ts`, `src/platform/services/document-intelligence.ts`

**Contract:**
- Orchestrator implements `IDocumentIntelligenceOrchestrator.process(request)`.
- Input request requires valid UUIDs for `tenantId`, `actorId`, `documentId`, and `documentVersionId`.
- Execution runs entirely inside `runInTenantContext(actorId, tenantId, tx)`.
- Identity resolution maps raw items against domain masters (e.g. Student NISN/Name or Employee NIP/NRK).
- Rule validation is executed through `PlatformValidationEngine` (`ocrItemValidationEngine`).
- Failures and anomalies automatically generate `ExceptionItem` records in `OPEN` status via `createFromValidationResultsTx`.
- Summary aggregation computes `totalItemsExtracted`, `itemsResolved`, `itemsUnresolved`, `exceptionsCreatedCount`, `itemsRequiringReview`.
- Result status is strictly calculated:
  - `FAILED` if document is missing, RLS rejected, or unhandled exception occurs.
  - `REQUIRES_REVIEW` if exceptions are created or items require human review.
  - `COMPLETED` if all items are resolved with zero validation exceptions.
- Atomic transaction-bound audit trail is recorded with action `PROCESS_DOCUMENT_INTELLIGENCE`.

---

## Contract 6: Live Cookie Session Provider Contract

**Location:** `src/platform/auth/session.ts`

**Contract:**
- `CookieSessionProvider` extracts session tokens from HTTP-only cookies (`banyubiru_session` or `process.env.SESSION_COOKIE_NAME`).
- Uses cryptographic HMAC-SHA256 signing (`createSessionToken`) and verification (`verifySessionToken`).
- Compares signatures using `crypto.timingSafeEqual` to prevent timing attacks.
- Enforces strict fail-closed behavior: if `AUTH_SECRET` / `SESSION_SECRET` is missing, `verifySessionToken` and `CookieSessionProvider` immediately return `null`.
- Unconfigured secrets throw explicit security errors on token signing and never use hardcoded fallbacks.
- Test suites retain backward-compatible dynamic mocking via `setSessionProvider()` and `resetSessionProvider()`.

---

## Contract 7: Exception Center Full Lifecycle

**Location:** `src/platform/repositories/exception.ts`, `src/platform/actions/exception.ts`

**Contract:**
- `ExceptionItem` is the canonical entity for validation anomalies, data quality issues,
  and OCR extraction failures across all domains.
- Status transitions: `OPEN` $\to$ `IN_REVIEW` $\to$ `RESOLVED` | `DISMISSED`.
- Severity levels: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Exceptions are created via `createTx()` on `PostgresExceptionRepository` or via the
  `createExceptionAction` server action.
- The validation bridge `createFromValidationResultsTx()` maps `ValidationResult` items to
  `ExceptionItem` records transactionally with automatic deduplication for active `OPEN` exceptions.
- Status mutations update `status`, `resolvedAt`, `resolvedByActorId`, and `resolutionNotes`
  in a single atomic transaction while recording an `AuditEvent`.

---

## Contract 8: Identity Resolution Strict Disambiguation

**Location:** `src/domains/employee/awards/service.ts` (L384–L457)

**Contract:**
- Identity resolution uses **exactly two canonical identifiers**: NIP (18-char) and NRK (10-char).
- A **5-case decision tree** determines the outcome (see DATA_FLOW.md Pipeline 1 for details).
- Case 5 (conflicting matches) ALWAYS throws `IDENTITY_COLLISION` — no auto-merge, no skipping.
- A collision rolls back the entire batch transaction.
- Resolved `employeeId` is then used for proposal idempotency lookup.

---

## Contract 9: Canonical Platform RBAC Registry (Phase 4L)

**Location:** `src/platform/auth/guards.ts`, `src/platform/auth/index.ts`

**Contract:**
- All authorization decisions across all domains are declarative and centralized in `PLATFORM_RBAC_REGISTRY`.
- Canonical enforcement pattern across all Server Actions:
  ```typescript
  assertAuthorizedAction(sessionContext, actionPermission);
  ```
- Allowed roles derive strictly from the `UserRole` Prisma enum (`ADMIN`, `ADMIN_TENANT`, `VERIFIKATOR`, `OPERATOR`, `AUDITOR`, `PEGAWAI`).
- Missing or unauthorized roles fail-closed by throwing `AuthorizationError` with code `FORBIDDEN`.

---

## Contract 10: Canonical Tenant Ownership

**All Prisma models** include `tenantId` as a required field with:
- `@db.Uuid` type
- Composite unique constraints with `tenantId` as the first field (e.g., `@@unique([tenantId, id])`)
- `onDelete: Restrict` on FK to `Tenant` (tenants cannot be deleted if data exists)
- `onUpdate: Cascade` on FK to `Tenant`

**Every query MUST include `tenantId` in the WHERE clause** — the RLS policies enforce this
at the database level, but application code also passes it explicitly for defense in depth.
