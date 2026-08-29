# CURRENT STATE

## Repository State

### 1. Committed Baseline
- **HEAD commit SHA:** `1a8222da584d27913ec0d5522c9e3e6a9b3cee29`
- **Branch:** `main` (synchronized with `origin/main`)
- **Schema Anchor:** Phase 4G Canonical Schema Reconciliation (Prisma 7.10.0)

### 2. Working Snapshot (Uncommitted)
- **Modified (unstaged):** `src/platform/types/index.ts` — re-exports `./document-intelligence`
- **Untracked:** `src/platform/types/document-intelligence.ts` — defines `IDocumentIntelligenceOrchestrator` contracts
- **Untracked:** `docs/ai-context/` — context documentation

---

## Recent Commit History (Last 10)

```
1a8222d feat: add award import server action boundary
4c5f751 feat: implement award Excel import service boundary
0afa042 feat: migrate award client reads to server boundary
03a2dc0 feat: establish award authoritative read boundary
25c7e78 feat: migrate student absence export to server boundary
2354e66 feat: migrate student OCR workflow to server boundary
9eb5a5f feat: migrate student master data to server boundary
bffe89d feat: establish student server boundary
eb60cd1 refactor: retire legacy operational service
d8fed47 feat: migrate exception center to server boundary
```

---

## Verified Facts vs. Working Snapshot vs. Inferences

### Verified Facts [COMMITTED]
- **Framework:** Next.js 16.3.1 (App Router), React 19.2.8.
- **Database / ORM:** PostgreSQL, Prisma 7.10.0 with `@prisma/adapter-pg`.
- **Multi-Tenancy:** Enforced at DB level via `runInTenantContext()` calling `set_tenant_context(actorId::uuid, tenantId::uuid)`.
- **Server Actions:** All data mutations/reads exposed via `'use server'` entry points returning `ActionResponse<T>`.
- **Auth Session:** `DefaultSessionProvider` returns `null` (fail-closed) in `src/platform/auth/session.ts`.
- **Workflows:** Employee award workflow has 9 states / 9 events; student absence workflow has 5 states / 5 events.
- **Audit Persistence:** `PostgresAuditEventRepository` writes atomically in the same transaction as entity mutations.
- **Exception Read/Update:** `PostgresExceptionRepository` implements state machine transitions (OPEN → IN_REVIEW → RESOLVED/DISMISSED).
- **WorkflowInstance Gap:** Zero `workflowInstance.create` calls exist in application code.

### Working Snapshot Observations [SNAPSHOT]
- `src/platform/types/document-intelligence.ts` defines domain-agnostic contracts (`IDocumentIntelligenceOrchestrator`, `ProcessedExtractedItem`, etc.) but has no implementation in the codebase.

### Inferred Observations [INFERRED]
- Live user session authentication requires injecting a concrete provider (NextAuth/JWT) into `setSessionProvider()`.
- OCR extraction in the current student path is performed client-side or simulated (server receives pre-extracted items).
- The `ProposalStatus` enum contains legacy/unused generic states (`DRAFT`, `SUBMITTED`, `VERIFIED_STAGE_1`, etc.).

---

## Architectural Maturity Matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-Tenancy (RLS) | Implemented [COMMITTED] | `src/platform/db/tenant-context.ts` |
| Server Action Boundary | Implemented [COMMITTED] | `src/platform/actions/`, `src/domains/employee/awards/actions.ts` |
| Employee Award Domain | Implemented [COMMITTED] | `src/domains/employee/awards/` (service, repo, workflow, rules) |
| Student OCR Workflow | Implemented [COMMITTED] | `src/platform/actions/student-workflow.ts` |
| Exception Center (Read/Update) | Implemented [COMMITTED] | `src/platform/repositories/exception.ts` |
| Exception Auto-Creation | Missing [COMMITTED] | No `createTx` in exception repo; no `WorkflowInstance` creator |
| Audit Trail (Persistent) | Implemented [COMMITTED] | `src/platform/repositories/audit-event.ts` |
| Operational Dashboard | Implemented [COMMITTED] | `src/platform/repositories/operational-query.ts` |
| Document Intelligence Engine | Types only [SNAPSHOT] | `src/platform/types/document-intelligence.ts` (unimplemented) |
