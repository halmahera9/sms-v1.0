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

## Contract 2: Server Action Boundary Pattern

**Locations:** All `'use server'` files in `src/platform/actions/` and `src/domains/`

**Contract:**
- All server actions return `ActionResponse<T> = { success: boolean; data?: T; error?: ActionError }`.
- All server actions call `handleActionError()` in their catch block — never expose raw errors.
- Error types map to canonical codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`,
  `DOMAIN_ERROR`, `INTERNAL_ERROR`.
- Sensitive errors (RLS violations matching `SECURITY ERROR:` prefix) are masked to clients.
- The client NEVER sends `actorId` or `tenantId` — these are always resolved server-side.
- Serialization via `JSON.parse(JSON.stringify(...))` before returning — prevents Prisma type leakage.

**Violation indicator:** Any server action that accepts `tenantId` or `actorId` as a parameter
from client code violates this contract.

---

## Contract 3: Audit Immutability

**Location:** `src/platform/repositories/audit-event.ts`

**Contract:**
- `AuditEvent` rows are APPEND-ONLY. No UPDATE or DELETE operations exist in the repository.
- Every audit event MUST have a valid UUID for `tenantId`, `entityId`, and optionally `eventId`.
- Audit events are written in the SAME transaction as the mutation they record — never in
  a separate transaction.
- `beforeState` and `afterState` are serialized via `JSON.parse(JSON.stringify())` before
  storage — no circular references or Prisma objects.

**Enforcement:** UUID validation guards in `recordTx()` throw `SECURITY/SCHEMA ERROR` on
invalid identifiers.

---

## Contract 4: Workflow Transition Contract

**Location:** `src/platform/workflow/engine.ts`, domain workflow files

**Contract:**
- State transitions are ONLY valid when defined in the `WorkflowDefinition.transitions` array.
- Guard functions receive a `context` object and return `boolean` or `{ allowed, reason }`.
- `PlatformWorkflowEngine.transition()` NEVER throws — it returns a `WorkflowTransitionResult`
  with `success: false` on invalid/guarded transitions.
- The calling service is responsible for throwing if `result.success === false`.
- Workflow engine is purely in-memory (stateless) — it does NOT persist state changes.
  Persistence is the caller's responsibility.

**Employee award workflow transitions:**
- `NOMINATIF` $\to$ `BELUM_UPLOAD` (`SUBMIT_NOMINATIVE`)
- `['NOMINATIF', 'BELUM_UPLOAD']` $\to$ `SEBAGIAN` (`UPLOAD_DOCUMENT`)
- `['NOMINATIF', 'BELUM_UPLOAD', 'SEBAGIAN']` $\to$ `LENGKAP` (`COMPLETE_DOCUMENTS`)
- `['LENGKAP', 'SEBAGIAN']` $\to$ `DIVERIFIKASI` (`VERIFY_DOCUMENTS`)
- `['DIVERIFIKASI', 'LENGKAP']` $\to$ `SIAP_GENERATE` (`APPROVE_GENERATION` — Guard: `allMandatoryVerified === true`)
- `SIAP_GENERATE` $\to$ `GENERATED` (`MARK_GENERATED`)
- `GENERATED` $\to$ `DITANDATANGANI` (`SIGN`)
- `DITANDATANGANI` $\to$ `DIKIRIM` (`SEND`)
- `DIKIRIM` $\to$ `SELESAI` (`ARCHIVE_COMPLETE`)

**Student absence workflow:** Guard on `VERIFY_ALL_ITEMS` checks `allItemsVerified`.

---

## Contract 5: Authentication Fail-Closed

**Location:** `src/platform/auth/session.ts`

**Contract:**
- `getAuthenticatedActorContext()` throws `AuthenticationError` if: session is null, `actorId`
  is not a valid UUID, `tenantId` is not a valid UUID, or `status !== 'ACTIVE'`.
- The `DefaultSessionProvider` always returns `null` — any request without a custom provider
  is automatically rejected.
- `setSessionProvider()` allows injection of a real or test provider.
- `executeInAuthenticatedContext()` combines auth resolution + `runInTenantContext` into one
  call — the primary entry point for platform-level server actions.

**Violation indicator:** Any path that bypasses `getAuthenticatedActorContext()` and
calls `runInTenantContext` directly with unverified identity parameters.

---

## Contract 6: Repository Boundary

**Location:** `src/platform/repositories/`

**Contract:**
- Transaction-bound methods are named `*Tx(tx, tenantId, ...)` — they receive the
  `TenantTransactionClient` as the first argument and MUST use it exclusively.
- Context-bound convenience methods are named `*InContext(actorId, tenantId, ...)` — they
  wrap `runInTenantContext` internally.
- `TenantTransactionClient` is typed as a Prisma-inferred interactive transaction parameter.
  It is never directly constructed outside of `runInTenantContext`.

---

## Contract 7: Exception State Machine

**Location:** `src/platform/repositories/exception.ts` (L57–L62)

**Contract (hardcoded in `VALID_TRANSITIONS`):**

```
OPEN     → IN_REVIEW | RESOLVED | DISMISSED
IN_REVIEW → RESOLVED | DISMISSED
RESOLVED  → (terminal)
DISMISSED → (terminal)
```

- Any transition not listed above throws `Validation Error: ...transisi ilegal`.
- Status transitions to `RESOLVED` or `DISMISSED` automatically set `resolvedByUserId`
  and `resolvedAt`.
- Transitioning to `IN_REVIEW` clears `resolvedByUserId` and `resolvedAt`.
- Creation via `createTx(tx, tenantId, params)` inserts an `ExceptionItem` with initial status `OPEN` and emits a `CREATE_EXCEPTION` audit event atomically.
- Every exception status update emits an audit event atomically.

---

## Contract 8: Identity Resolution (Employee Import)

**Location:** `src/domains/employee/awards/service.ts` (L384–L457)

**Contract:**
- Identity resolution uses **exactly two canonical identifiers**: NIP (18-char) and NRK (10-char).
- A **5-case decision tree** determines the outcome (see DATA_FLOW.md Pipeline 1 for details).
- Case 5 (conflicting matches) ALWAYS throws `IDENTITY_COLLISION` — no auto-merge, no skipping.
- A collision rolls back the entire batch transaction.
- Resolved `employeeId` is then used for proposal idempotency lookup.

---

## Contract 9: RBAC Policy Ownership

**Two separate RBAC enforcement mechanisms exist:**

**Mechanism A** — Used by employee award actions (`src/domains/employee/awards/actions.ts`):
- Calls `assertAuthorizedAction(session, actionKey)` from `src/platform/auth/guards.ts`.
- Policy defined in `AWARD_PROPOSAL_RBAC_POLICY` dictionary.

**Mechanism B** — Used by student/exception/audit/operational actions:
- Inline role array checks: `if (!allowedRoles.includes(context.role)) throw AuthorizationError(...)`.
- Policy defined ad-hoc per action file.

**There is no unified RBAC policy registry.** These two mechanisms are not interchangeable
and have no shared enforcement path.

---

## Contract 10: Canonical Tenant Ownership

**All Prisma models** include `tenantId` as a required field with:
- `@db.Uuid` type
- Composite unique constraints with `tenantId` as the first field (e.g., `@@unique([tenantId, id])`)
- `onDelete: Restrict` on FK to `Tenant` (tenants cannot be deleted if data exists)
- `onUpdate: Cascade` on FK to `Tenant`

**Every query MUST include `tenantId` in the WHERE clause** — the RLS policies enforce this
at the database level, but application code also passes it explicitly for defense in depth.
