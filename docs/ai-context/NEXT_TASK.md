# NEXT TASK

## Roadmap & Recommended Next Tasks

### Context & Current State
- **Phase 4H (Completed):** Award Proposal domain workflow (`NOMINATIF` through `SELESAI`) and Exception Center full CRUD & validation bridges are committed.
- **Phase 4I (Completed in `7966d20`):** `DocumentIntelligenceOrchestrator` implemented and verified with 43/43 integration tests.
- **Phase 4J (Completed in `e6c63a8`):** `CookieSessionProvider` with cryptographic HMAC-SHA256 token verification and strict fail-closed security committed and tested.
- **Client-Server Production Build Boundary (Completed in `9832e18`):** Decoupled client storage, added `server-only` guards, moved student mappers, and verified 10/10 routes passing `npm run build`.

The next recommended engineering tracks are:

---

### Track 1: Phase 4K — Cloud Object Storage & Real Document Versioning Integration

- **Goal:** Replace simulated upload placeholders (`checksumSha256`, `fileUrl = '#'`) with real cloud object storage (S3 / GCS).
- **Scope:**
  1. Integrate S3 / Google Cloud Storage client SDK for binary file persistence.
  2. Implement real SHA-256 binary checksum calculation for `DocumentVersion`.
  3. Wire award requirement file uploads directly to canonical `Document` & `DocumentVersion` tables.

---

### Track 2: Phase 4L — Action Boundary Hardening & Unified RBAC Policy Registry

- **Goal:** Consolidate duplicated types and authorization policies across domains.
- **Scope:**
  1. Centralize `ActionResponse<T>` and `ActionError` into `src/platform/types/actions.ts`.
  2. Unify domain RBAC arrays into a centralized policy guard system across all domains.
  3. Add RBAC role assertions to `getRecentAuditEventsAction`.

---

### Track 3: Phase 5 — UI Wiring, Production Deployment & Field Verification

- **Goal:** Bind all production server actions and orchestrator flows to the frontend interface.
- **Scope:**
  1. Connect UI pages to `executeInAuthenticatedContext` and live session cookie auth.
  2. Wire document viewers to real object storage signed URLs.
  3. Perform end-to-end field testing and multi-tenant isolation validation.
