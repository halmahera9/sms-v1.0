# NEXT TASK

## Roadmap & Recommended Next Tasks

### Context & Current State
- **Phase 4H (Completed):** Award Proposal domain workflow (`NOMINATIF` through `SELESAI`) and Exception Center full CRUD & validation bridges are committed.
- **Phase 4I (Completed in `7966d20`):** `DocumentIntelligenceOrchestrator` implemented and verified with 43/43 integration tests.
- **Phase 4J (Completed in `e6c63a8`):** `CookieSessionProvider` with cryptographic HMAC-SHA256 token verification and strict fail-closed security committed and tested.

The next recommended engineering tracks are:

---

### Track 1: Client-Server Boundary Decoupling for Production Build (Immediate Priority)

- **Goal:** Fix the Vercel / `next build` failure caused by Webpack bundling Node.js `pg` driver into client components.
- **Problem:** `src/app/app/audit/page.tsx` (Client Component) imports `src/lib/storage.ts` which statically imports `PlatformAuditEngine` from `src/platform/audit/engine.ts`, which imports `PostgresAuditEventRepository` $\to$ `pg` (`net`, `tls`, `util/types`).
- **Scope:**
  1. Decouple `PlatformAuditEngine` in-memory adapter from the server-only `PostgresAuditEventRepository`.
  2. Ensure server-only database code is never imported into Client Components (`"use client"`).
  3. Route client audit log queries through Server Actions (`getRecentAuditEventsAction`) or API routes.
  4. Verify clean `npm run build` execution locally and on Vercel.

---

### Track 2: Phase 4K — Cloud Object Storage & Document Versioning Integration

- **Goal:** Replace simulated upload placeholders and stub URLs with real cloud object storage (S3 / GCS).
- **Scope:**
  1. Integrate S3 / Google Cloud Storage client for file persistence.
  2. Implement real SHA-256 binary checksum calculation for `DocumentVersion`.
  3. Wire award requirement file uploads directly to canonical `Document` & `DocumentVersion` tables.

---

### Track 3: Phase 4L — Unified Action Response & RBAC Policy Registry

- **Goal:** Consolidate duplicated types and authorization policies across domains.
- **Scope:**
  1. Centralize `ActionResponse<T>` and `ActionError` into `src/platform/types/actions.ts`.
  2. Unify domain RBAC arrays into a centralized policy guard system across all domains.
  3. Add RBAC role assertions to `getRecentAuditEventsAction`.
