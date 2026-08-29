# CURRENT STATE

## Repository State

### 1. Committed Baseline
- **HEAD commit SHA:** `e6c63a8061f9cc16e91882d9f53ad20264b61bc4`
- **Branch:** `main` (synchronized with `origin/main`)
- **Schema Anchor:** Phase 4G Canonical Schema Reconciliation with Generic Workflow Instance Management (Prisma 7.10.0)
- **Working Tree:** Clean (all core domain actions, orchestrators, auth session providers, and test suites committed)

---

## Recent Commit History (Last 15)

```
e6c63a8 feat: add live cookie session provider
7966d20 docs: initialize AI-context documentation and implement Document Intelligence service with orchestration, auditing, and database connectivity test suites.
3371372 feat: implement award proposal archive complete workflow
6c68d62 feat: add award proposal signing workflow
c6195d2 feat: generate exceptions from OCR validation
4e23757 feat: add canonical validation exception bridge
f02a4e9 test: harden exception status action boundary
047dba0 feat: implement ExceptionItem server action boundary (createExceptionAction)
bc67517 feat: initialize Prisma schema and add migration for generic workflow instance state management
dffbc92 feat: add atomic exception persistence boundary
96c8c9b feat: define canonical document intelligence orchestration contracts
0962226 docs: add Banyubiru AI context package
1a8222d feat: add award import server action boundary
4c5f751 feat: implement award Excel import service boundary
0afa042 feat: migrate award client reads to server boundary
```

---

## Verified Facts vs. Working Snapshot vs. Inferences

### Verified Facts [COMMITTED]
- **Framework:** Next.js 16.3.1 (App Router), React 19.2.8.
- **Database / ORM:** PostgreSQL, Prisma 7.10.0 with `@prisma/adapter-pg`.
- **Multi-Tenancy:** Enforced at DB level via `runInTenantContext()` calling `set_tenant_context(actorId::uuid, tenantId::uuid)`.
- **Server Actions:** All data mutations/reads exposed via `'use server'` entry points returning `ActionResponse<T>`.
- **Auth Session (Phase 4J):** `CookieSessionProvider` (`src/platform/auth/session.ts`) reads HTTP-only session cookies via Next.js `cookies()`, verifies cryptographic HMAC-SHA256 signatures (`verifySessionToken`), and enforces strict fail-closed behavior when secrets are missing.
- **Employee Award Workflow:** Complete end-to-end lifecycle implemented (10 states, 9 events: `NOMINATIF` $\to$ `BELUM_UPLOAD` $\to$ `SEBAGIAN` $\to$ `LENGKAP` $\to$ `DIVERIFIKASI` $\to$ `SIAP_GENERATE` $\to$ `GENERATED` $\to$ `DITANDATANGANI` $\to$ `DIKIRIM` $\to$ `SELESAI`) with corresponding server actions (`signProposalAction`, `sendProposalAction`, `archiveCompleteProposalAction`).
- **Student Absence Workflow:** OCR upload, student identity resolution, human verification, absence record persistence, and export.
- **Audit Persistence:** `PostgresAuditEventRepository` writes atomically in the same transaction as entity mutations (`recordTx`).
- **Exception Center:** Full lifecycle implemented with `PostgresExceptionRepository` (`findManyTx`, `findByIdTx`, `createTx`, `updateStatusTx`), server actions (`getExceptionsAction`, `createExceptionAction`, `updateExceptionStatusAction`), and canonical validation bridge (`validateOCRAndCreateExceptions`).
- **Document Intelligence (Phase 4I):** `DocumentIntelligenceOrchestrator` (`src/platform/services/document-intelligence.ts`) orchestrates document processing, identity matching, validation engine execution, exception creation, and audit logging with terminal status calculation.

### Working Snapshot Observations [COMMITTED]
- Client component `src/app/app/audit/page.tsx` imports `src/lib/storage.ts` which transitively imports `PostgresAuditEventRepository` $\to$ `pg`, causing Webpack to fail during `next build` client bundle generation due to Node.js `net`/`tls` requirements in browser context.

### Inferred Observations [INFERRED]
- Decoupling `PlatformAuditEngine` from direct server repository imports or migrating client pages to Server Components / Server Actions will immediately unblock `next build` on Vercel.
- Physical object storage integration (S3/GCS) remains simulated with stub paths until Phase 4K.

---

## Architectural Maturity Matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-Tenancy (RLS) | Implemented [COMMITTED] | `src/platform/db/tenant-context.ts` |
| Server Action Boundary | Implemented [COMMITTED] | `src/platform/actions/`, `src/domains/employee/awards/actions.ts` |
| Live Cookie Session Auth (Phase 4J) | Implemented [COMMITTED] | `src/platform/auth/session.ts`, `tests/live-session-provider.test.ts` |
| Employee Award Domain | Fully Implemented [COMMITTED] | Complete lifecycle from nomination import to sign, send, and archive |
| Student OCR Workflow | Implemented [COMMITTED] | `src/platform/actions/student-workflow.ts` |
| Exception Center (Full Lifecycle) | Implemented [COMMITTED] | `src/platform/repositories/exception.ts`, `src/platform/actions/exception.ts` |
| Exception Auto-Creation & Bridge | Implemented [COMMITTED] | `createTx`, `createExceptionAction`, `validateOCRAndCreateExceptions` |
| Workflow State Engine | Implemented [COMMITTED] | `PlatformWorkflowEngine` (generic FSM with guards) |
| Audit Trail (Persistent) | Implemented [COMMITTED] | `src/platform/repositories/audit-event.ts` |
| Operational Dashboard | Implemented [COMMITTED] | `src/platform/repositories/operational-query.ts` |
| Document Intelligence Orchestrator (Phase 4I) | Fully Implemented [COMMITTED] | `src/platform/services/document-intelligence.ts`, `tests/document-intelligence-orchestrator.test.ts` |
