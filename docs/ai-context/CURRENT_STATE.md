# CURRENT STATE

## Repository State

### 1. Committed Baseline
- **HEAD commit SHA:** `3371372d88a5583e0723dc5b33a9a038acfa24ed`
- **Branch:** `main` (synchronized with `origin/main`)
- **Schema Anchor:** Phase 4G Canonical Schema Reconciliation with Generic Workflow Instance Management (Prisma 7.10.0)
- **Working Tree:** Clean (all core domain actions, services, and tests committed)

---

## Recent Commit History (Last 15)

```
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
03a2dc0 feat: establish award authoritative read boundary
25c7e78 feat: migrate student absence export to server boundary
```

---

## Verified Facts vs. Working Snapshot vs. Inferences

### Verified Facts [COMMITTED]
- **Framework:** Next.js 16.3.1 (App Router), React 19.2.8.
- **Database / ORM:** PostgreSQL, Prisma 7.10.0 with `@prisma/adapter-pg`.
- **Multi-Tenancy:** Enforced at DB level via `runInTenantContext()` calling `set_tenant_context(actorId::uuid, tenantId::uuid)`.
- **Server Actions:** All data mutations/reads exposed via `'use server'` entry points returning `ActionResponse<T>`.
- **Auth Session:** `DefaultSessionProvider` returns `null` (fail-closed) in `src/platform/auth/session.ts`. Test suites inject mock providers via `setSessionProvider()`.
- **Employee Award Workflow:** Complete end-to-end lifecycle implemented (10 states, 9 events: `NOMINATIF` $\to$ `BELUM_UPLOAD` $\to$ `SEBAGIAN` $\to$ `LENGKAP` $\to$ `DIVERIFIKASI` $\to$ `SIAP_GENERATE` $\to$ `GENERATED` $\to$ `DITANDATANGANI` $\to$ `DIKIRIM` $\to$ `SELESAI`) with corresponding server actions (`signProposalAction`, `sendProposalAction`, `archiveCompleteProposalAction`).
- **Student Absence Workflow:** OCR upload, student identity resolution, human verification, absence record persistence, and export.
- **Audit Persistence:** `PostgresAuditEventRepository` writes atomically in the same transaction as entity mutations (`recordTx`).
- **Exception Center:** Full lifecycle implemented with `PostgresExceptionRepository` (`findManyTx`, `findByIdTx`, `createTx`, `updateStatusTx`), server actions (`getExceptionsAction`, `createExceptionAction`, `updateExceptionStatusAction`), and canonical validation bridge (`validateOCRAndCreateExceptions`).
- **Document Intelligence Contracts:** Canonical interfaces (`IDocumentIntelligenceOrchestrator`, `ProcessedExtractedItem`, `IdentityResolutionOutcome`) committed in `src/platform/types/document-intelligence.ts`.

### Working Snapshot Observations [COMMITTED]
- `src/platform/types/document-intelligence.ts` defines domain-agnostic contracts (`IDocumentIntelligenceOrchestrator`, `ProcessedExtractedItem`, etc.) with initial validation integration in student workflow.

### Inferred Observations [INFERRED]
- Live user session authentication requires injecting a concrete provider (NextAuth/JWT cookie session) into `setSessionProvider()`.
- OCR extraction in the student path currently consumes client-provided extracted items before database persistence.
- The `ProposalStatus` enum in Prisma still contains legacy/unused generic states (`DRAFT`, `SUBMITTED`, `VERIFIED_STAGE_1`, etc.) alongside the active SE BKD states.

---

## Architectural Maturity Matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-Tenancy (RLS) | Implemented [COMMITTED] | `src/platform/db/tenant-context.ts` |
| Server Action Boundary | Implemented [COMMITTED] | `src/platform/actions/`, `src/domains/employee/awards/actions.ts` |
| Employee Award Domain | Fully Implemented [COMMITTED] | Complete lifecycle from nomination import to sign, send, and archive |
| Student OCR Workflow | Implemented [COMMITTED] | `src/platform/actions/student-workflow.ts` |
| Exception Center (Full Lifecycle) | Implemented [COMMITTED] | `src/platform/repositories/exception.ts`, `src/platform/actions/exception.ts` |
| Exception Auto-Creation & Bridge | Implemented [COMMITTED] | `createTx`, `createExceptionAction`, `validateOCRAndCreateExceptions` |
| Workflow State Engine | Implemented [COMMITTED] | `PlatformWorkflowEngine` (generic FSM with guards) |
| Audit Trail (Persistent) | Implemented [COMMITTED] | `src/platform/repositories/audit-event.ts` |
| Operational Dashboard | Implemented [COMMITTED] | `src/platform/repositories/operational-query.ts` |
| Document Intelligence Engine | Types & Rules Bridge [COMMITTED] | `src/platform/types/document-intelligence.ts`, OCR validation bridge |
