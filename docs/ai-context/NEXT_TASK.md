# NEXT TASK

## Roadmap & Recommended Next Tasks

### Context & Current State
The Award Proposal domain workflow (`NOMINATIF` through `SELESAI`) and the Exception Center persistence/bridge are now fully implemented and tested.

The next critical engineering tracks are:

---

### Track 1: Document Intelligence Orchestrator Implementation (Recommended)

- **Goal:** Implement the concrete `DocumentIntelligenceOrchestrator` fulfilling `IDocumentIntelligenceOrchestrator` in `src/platform/types/document-intelligence.ts`.
- **Scope:**
  1. Standardize document upload, versioning, and real SHA-256 checksum calculation.
  2. Implement async / batch OCR extraction status management (`QUEUED` $\to$ `PROCESSING` $\to$ `COMPLETED` / `FAILED`).
  3. Abstract identity resolution into a reusable resolver pipeline across both Employee (NIP/NRK) and Student (NISN/Name) domains.
  4. Wire automated validation rules to the orchestrator to emit exceptions consistently.

---

### Track 2: Live Production Authentication Provider Integration

- **Goal:** Replace `DefaultSessionProvider` (which fails closed with `null`) with a production session resolver.
- **Scope:**
  1. Implement NextAuth / IronSession / JWT cookie reader in `src/platform/auth/session.ts`.
  2. Map incoming session claims (`userId`, `tenantId`, `role`, `status`) to `AuthenticatedActorContext`.
  3. Verify RLS `set_tenant_context()` execution under live web requests.

---

### Track 3: Unified Action Response & RBAC Policy Registry

- **Goal:** Consolidate duplicated types and authorization policies.
- **Scope:**
  1. Centralize `ActionResponse<T>` and `ActionError` into `src/platform/types/actions.ts`.
  2. Unify domain RBAC arrays into a centralized policy guard system across all domains.
