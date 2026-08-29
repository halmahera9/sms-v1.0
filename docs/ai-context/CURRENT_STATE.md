# CURRENT STATE

## Repository State

### 1. Committed Baseline
- **HEAD commit SHA:** `9b4aaf9f8d8ee6fa9beaa3d567c9c0dc11ea9eb2`
- **Branch:** `main`
- **Schema Anchor:** Phase 4G Canonical Schema Reconciliation with Generic Workflow Instance Management & Document Version Nullable Checksum (Prisma 7.10.0)
- **Production Build:** Verified with `npm run build` (Turbopack, 10/10 routes static/SSR built cleanly)
- **Automated Tests:** Verified with `npm test` (258 / 258 tests passing across 9 test suites)
- **Working Tree:** Clean

---

## Recent Commit History (Last 15)

```
9b4aaf9 feat: persist real binary checksums for document uploads
0d6eae1 feat: add canonical object storage abstraction and sha256 integrity
6c463d0 docs: synchronize AI context package for Phase 4L and unified RBAC policy registry
8743c74 feat: implement server action framework with RBAC, audit logging, and core operational workflows
d88cd55 docs: synchronize AI context package with GAP-BUILD resolution and verified production build
9832e18 feat: implement unified operational platform with audit engine, centralized dashboard, work queues, and student domain integration.
92f2b61 docs: update AI context package for Phase 4J and document intelligence orchestrator
e6c63a8 feat: add live cookie session provider
7966d20 docs: initialize AI-context documentation and implement Document Intelligence service with orchestration, auditing, and database connectivity test suites.
3371372 feat: implement award proposal archive complete workflow
6c68d62 feat: add award proposal signing workflow
c6195d2 feat: generate exceptions from OCR validation
4e23757 feat: add canonical validation exception bridge
f02a4e9 test: harden exception status action boundary
047dba0 feat: implement ExceptionItem server action boundary (createExceptionAction)
```

---

## Verified Facts vs. Working Snapshot vs. Inferences

### Verified Facts [COMMITTED]
- **Framework:** Next.js 16.3.1 (App Router), React 19.2.8.
- **Database / ORM:** PostgreSQL, Prisma 7.10.0 with `@prisma/adapter-pg`.
- **Multi-Tenancy:** Enforced at DB level via `runInTenantContext()` calling `set_tenant_context(actorId::uuid, tenantId::uuid)`.
- **Canonical Object Storage & Integrity (Phase 4K.1 & 4K.2):** `IObjectStorageProvider` with `InMemoryObjectStorageProvider` (`src/platform/storage/`), real SHA-256 binary digest utility (`calculateSha256`), defensive buffer copying, path traversal validation, server-only boundary, and canonical storage path generator (`buildDocumentStoragePath`).
- **Binary Upload to DocumentVersion (Phase 4K.2):** `uploadOCRDocumentAction` accepts real binary payloads (`fileBuffer` / `fileBase64`), persists actual binary into `IObjectStorageProvider`, and stores provider-computed real SHA-256 and canonical `filePath` into PostgreSQL `DocumentVersion`. Non-binary metadata uploads explicitly store `null` (no fake hashes, no synthetic timestamps).
- **Canonical Action DTOs (Phase 4L):** `src/platform/types/actions.ts` provides single canonical definitions for `ActionErrorCode`, `ActionError`, and `ActionResponse<T>`.
- **Unified RBAC Policy Registry (Phase 4L):** `PLATFORM_RBAC_REGISTRY` in `src/platform/auth/guards.ts` maps all server actions to explicit allowed `UserRole` lists and enforces access via `assertAuthorizedAction(sessionContext, actionKey)`.
- **Audit Action Guard (GAP-04):** `getRecentAuditEventsAction` enforces `AUDIT_EVENT_READ` role checks, rejecting unauthorized users (`PEGAWAI`) with `FORBIDDEN`.
- **Client-Server Boundary:** `server-only` guards enforce server isolation across all database repositories, storage engines, and provider factories.
- **Production Build:** `npm run build` runs with Turbopack and succeeds with 0 errors across all 10 routes.
- **Auth Session (Phase 4J):** `CookieSessionProvider` (`src/platform/auth/session.ts`) reads HTTP-only session cookies via Next.js `cookies()`, verifies cryptographic HMAC-SHA256 signatures (`verifySessionToken`), and enforces strict fail-closed behavior when secrets are missing.
- **Employee Award Workflow:** Complete end-to-end lifecycle implemented (10 states, 9 events: `NOMINATIF` $\to$ `BELUM_UPLOAD` $\to$ `SEBAGIAN` $\to$ `LENGKAP` $\to$ `DIVERIFIKASI` $\to$ `SIAP_GENERATE` $\to$ `GENERATED` $\to$ `DITANDATANGANI` $\to$ `DIKIRIM` $\to$ `SELESAI`) with corresponding server actions (`signProposalAction`, `sendProposalAction`, `archiveCompleteProposalAction`).
- **Student Absence Workflow:** OCR upload, student identity resolution, human verification, absence record persistence, and export.
- **Audit Persistence:** `PostgresAuditEventRepository` writes atomically in the same transaction as entity mutations (`recordTx`).
- **Exception Center:** Full lifecycle implemented with `PostgresExceptionRepository`, server actions (`getExceptionsAction`, `createExceptionAction`, `updateExceptionStatusAction`), and canonical validation bridge (`validateOCRAndCreateExceptions`).
- **Document Intelligence (Phase 4I):** `DocumentIntelligenceOrchestrator` (`src/platform/services/document-intelligence.ts`) orchestrates document processing, identity matching, validation engine execution, exception creation, and audit logging with terminal status calculation.

---

## Architectural Maturity Matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Multi-Tenancy (RLS) | Implemented [COMMITTED] | `src/platform/db/tenant-context.ts` |
| Canonical Object Storage (Phase 4K.1) | Implemented [COMMITTED] | `src/platform/storage/in-memory.ts`, `tests/object-storage.test.ts` |
| Real Binary Upload & SHA-256 (Phase 4K.2) | Fully Implemented [COMMITTED] | `src/platform/actions/student-workflow.ts`, `tests/student-ocr-server-actions.test.ts` |
| Server Action Boundary & DTOs (Phase 4L) | Fully Consolidated [COMMITTED] | `src/platform/types/actions.ts`, all server actions |
| Unified RBAC Policy Registry (Phase 4L) | Implemented [COMMITTED] | `src/platform/auth/guards.ts` (`PLATFORM_RBAC_REGISTRY`) |
| Live Cookie Session Auth (Phase 4J) | Implemented [COMMITTED] | `src/platform/auth/session.ts`, `tests/live-session-provider.test.ts` |
| Production Build Decoupling | Implemented [COMMITTED] | `server-only` guards, `npm run build` (Turbopack) passes |
| Employee Award Domain | Fully Implemented [COMMITTED] | Complete lifecycle from nomination import to sign, send, and archive |
| Student OCR Workflow | Implemented [COMMITTED] | `src/platform/actions/student-workflow.ts` |
| Exception Center (Full Lifecycle) | Implemented [COMMITTED] | `src/platform/repositories/exception.ts`, `src/platform/actions/exception.ts` |
| Exception Auto-Creation & Bridge | Implemented [COMMITTED] | `createTx`, `createExceptionAction`, `validateOCRAndCreateExceptions` |
| Workflow State Engine | Implemented [COMMITTED] | `PlatformWorkflowEngine` (generic FSM with guards) |
| Audit Trail (Persistent & Guarded) | Implemented [COMMITTED] | `src/platform/repositories/audit-event.ts`, `getRecentAuditEventsAction` |
| Operational Dashboard | Implemented [COMMITTED] | `src/platform/repositories/operational-query.ts`, `src/platform/actions/operational.ts` |
| Document Intelligence Orchestrator (Phase 4I) | Fully Implemented [COMMITTED] | `src/platform/services/document-intelligence.ts`, `tests/document-intelligence-orchestrator.test.ts` |
