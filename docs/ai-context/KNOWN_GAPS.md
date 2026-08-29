# KNOWN GAPS

## Confirmed Gaps [COMMITTED]

### GAP-02: Document Storage & Integrity Values Are Placeholders
- **Evidence:** `student-workflow.ts` uses simulated checksums (`'simulated_ocr_checksum_' + Date.now()`) and placeholder image paths (`/placeholder-doc.png`). Award proposal document uploads set `fileUrl = '#'`.
- **Impact:** No binary files are stored in object storage (S3/GCS) or integrity-validated via real SHA-256 hashes.

### GAP-03: Award Document Upload Bypasses Document / DocumentVersion Models
- **Evidence:** `uploadProposalDocumentAction` constructs an ephemeral `ProposalDocument` domain object and updates `AwardProposalDocument`, creating no rows in `documents` or `document_versions`.
- **Impact:** Document metadata and version history for employee awards are decoupled from the platform document store.

### GAP-05: Student Fallback Identity Resolution Generates Synthetic Identifiers
- **Evidence:** Unmatched students in `verifyExtractedItemAction` are auto-created with generated NISN (`'005' + Date.now()`) and hardcoded class (`'X IPA 1'`).

---

## Resolved Gaps (from previous snapshots)

- **[RESOLVED] GAP-04 (Audit Action RBAC Role Restriction):** Added explicit `assertAuthorizedAction(context, 'AUDIT_EVENT_READ')` to `getRecentAuditEventsAction` allowing only `ADMIN`, `ADMIN_TENANT`, `AUDITOR`, and `VERIFIKATOR` roles (`8743c74`).
- **[RESOLVED] GAP-06 (ActionResponse / ActionError Duplication):** Created canonical `src/platform/types/actions.ts` and replaced all duplicate declarations across 7 server action files (`8743c74`).
- **[RESOLVED] GAP-07 (RBAC Policy Fragmentation):** Created centralized declarative `PLATFORM_RBAC_REGISTRY` in `src/platform/auth/guards.ts` and unified all server action checks into `assertAuthorizedAction(context, actionPermission)` (`8743c74`).
- **[RESOLVED] GAP-BUILD (Client-Server Import Boundary Webpack Failure):** Decoupled `src/lib/storage.ts` and `src/lib/award-storage.ts`, added `import 'server-only'` guards on all database repositories and engines, moved pure enum mappers to `src/domains/student/mappers.ts`, and verified 10/10 routes with `npm run build` (`9832e18`).
- **[RESOLVED] GAP-SESSION (Live Cookie Session Provider):** Implemented `CookieSessionProvider` with cryptographic HMAC-SHA256 token verification, strict fail-closed missing secret handling, and actor claim resolution (`e6c63a8`).
- **[RESOLVED] GAP-ORCHESTRATOR (Document Intelligence Orchestration):** Implemented concrete `DocumentIntelligenceOrchestrator` in `src/platform/services/document-intelligence.ts` with complete extraction, identity matching, validation, exception creation, and audit logging (`7966d20`).
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
