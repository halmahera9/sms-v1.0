# KNOWN GAPS

## Confirmed Gaps [COMMITTED]

### GAP-01: Authentication Provider Fails Closed Without Live Session
- **Evidence:** `DefaultSessionProvider.getSession()` returns `null` (`src/platform/auth/session.ts`). No production cookie/JWT session provider is wired into `setSessionProvider()`.
- **Impact:** All server action invocations will throw `AuthenticationError` until a live session provider (e.g. NextAuth / JWT session cookie parser) is registered.

### GAP-02: Document Storage & Integrity Values Are Placeholders
- **Evidence:** `student-workflow.ts` uses simulated checksums (`'simulated_ocr_checksum_' + Date.now()`) and placeholder image paths (`/placeholder-doc.png`). Award proposal document uploads set `fileUrl = '#'`.
- **Impact:** No binary files are stored in object storage (S3/GCS) or integrity-validated via real SHA-256 hashes.

### GAP-03: Award Document Upload Bypasses Document / DocumentVersion Models
- **Evidence:** `uploadProposalDocumentAction` constructs an ephemeral `ProposalDocument` domain object and updates `AwardProposalDocument`, creating no rows in `documents` or `document_versions`.
- **Impact:** Document metadata and version history for employee awards are decoupled from the platform document store.

### GAP-04: getRecentAuditEventsAction Has No RBAC Role Restriction
- **Evidence:** In `src/platform/actions/audit.ts`, `getRecentAuditEventsAction` calls `executeInAuthenticatedContext` without any role authorization check (unlike other actions that assert roles).
- **Impact:** Any authenticated user with any role (e.g. `OPERATOR`) can read all tenant audit events.

### GAP-05: Student Fallback Identity Resolution Generates Synthetic Identifiers
- **Evidence:** Unmatched students in `verifyExtractedItemAction` are auto-created with generated NISN (`'005' + Date.now()`) and hardcoded class (`'X IPA 1'`).

### GAP-06: ActionResponse / ActionError Duplicated Across Action Files
- **Evidence:** `ActionResponse<T>` and `ActionError` interfaces are redeclared independently in several action files rather than consolidated into a shared platform types module.

### GAP-07: RBAC Policy Fragmentation
- **Evidence:** Employee award actions use `assertAuthorizedAction` with `AWARD_PROPOSAL_RBAC_POLICY` (`src/platform/auth/guards.ts`), while student, exception, and operational actions use ad-hoc inline role arrays.

---

## Resolved Gaps (from previous snapshot)

- **[RESOLVED] GAP-00 (WorkflowInstance State Management):** Initialized generic `WorkflowInstance` schema and migration for unified state machine persistence (`bc67517`).
- **[RESOLVED] GAP-01 (Exception Creation Path):** Added `createTx` on `PostgresExceptionRepository`, `createExceptionAction` server action (`047dba0`), and `validateOCRAndCreateExceptions` OCR validation bridge (`4e23757`, `c6195d2`).
- **[RESOLVED] GAP-WORKFLOW (Award Proposal Sign, Send, Archive):** Implemented `signProposalAction`, `sendProposalAction`, and `archiveCompleteProposalAction` with complete transactional persistence, workflow transition validation, and audit recording (`6c68d62`, `3371372`).

---

## Architectural Risks [INFERRED / OBSERVATION]

### RISK-01: Dual Computation Path for Proposal Status
- **Evidence:** `src/domains/employee/awards/rules.ts` exports `calculateProposalStatus()`, which is re-exported via `src/lib/checklist-rules.ts`. Meanwhile, the server action pipeline uses `PlatformWorkflowEngine` FSM transitions.
- **Risk:** Client components calculating status via `calculateProposalStatus` may diverge from the authoritative server workflow state.

### RISK-02: ProposalStatus Enum Legacy Dead States
- **Evidence:** `ProposalStatus` in Prisma includes unused states (`DRAFT`, `SUBMITTED`, `VERIFIED_STAGE_1`, `APPROVED`, etc.) alongside canonical Indonesian states (`NOMINATIF`, `SEBAGIAN`, `LENGKAP`, etc.).
