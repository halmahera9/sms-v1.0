# NEXT TASK

## Roadmap & Recommended Next Tasks

### Context & Current State
- **Phase 4H (Completed):** Award Proposal domain workflow (`NOMINATIF` through `SELESAI`) and Exception Center full CRUD & validation bridges are committed.
- **Phase 4I (Completed in `7966d20`):** `DocumentIntelligenceOrchestrator` implemented and verified with 43/43 integration tests.
- **Phase 4J (Completed in `e6c63a8`):** `CookieSessionProvider` with cryptographic HMAC-SHA256 token verification and strict fail-closed security committed and tested.
- **Client-Server Production Build Boundary (Completed in `9832e18`):** Decoupled client storage, added `server-only` guards, moved student mappers, and verified 10/10 routes passing `npm run build`.
- **Phase 4L (Completed in `8743c74`):** Consolidated Action DTOs in `src/platform/types/actions.ts`, unified RBAC policy registry in `src/platform/auth/guards.ts`, and enforced audit trail RBAC authorization (`GAP-04`, `GAP-06`, `GAP-07` resolved).
- **Phase 4K.1 & Phase 4K.2 (Completed in `0d6eae1`, `9b4aaf9`):** Canonical `IObjectStorageProvider`, `InMemoryObjectStorageProvider`, path validation, buffer safety, and real binary upload with provider SHA-256 persistence to `DocumentVersion` (`GAP-02` resolved).
- **Phase 4K.3 (Completed in `55eb978`):** Award Proposal document uploads persist canonical `Document` + `DocumentVersion`, associate `AwardProposalDocument.documentId`, persist authoritative SHA-256, support versioned replacement, compensation cleanup, tenant isolation, and concurrent versioning. Verified by **81/81** canonical persistence tests (`GAP-03` resolved).

The next recommended engineering track is:

---

### Track 1: Phase 5 — UI Wiring, Production Deployment & Field Verification

- **Goal:** Bind all production server actions and orchestrator flows to the frontend interface.
- **Scope:**
  1. Connect UI pages to `executeInAuthenticatedContext` and live session cookie auth.
  2. Wire document viewers to real object storage signed URLs / binary streams.
  3. Perform end-to-end field testing and multi-tenant isolation validation.
