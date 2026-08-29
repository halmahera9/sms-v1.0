# KNOWN GAPS

## Confirmed Gaps [COMMITTED]

### GAP-00: WorkflowInstance Has No Application Creation Path
- **Evidence:** A full codebase search reveals zero calls to `tx.workflowInstance.create()` or `prisma.workflowInstance.create()`. `WorkflowInstance` appears exclusively in `include:` clauses for read queries.
- **Impact:** `ExceptionItem` has a required non-nullable foreign key to `WorkflowInstance` (`workflowInstanceId`). Any attempt to insert an `ExceptionItem` will fail referential integrity unless a `WorkflowInstance` row is pre-seeded or manually created.

### GAP-01: No Exception Creation Path in Repository or Actions
- **Evidence:** `PostgresExceptionRepository` implements `findManyTx`, `findByIdTx`, and `updateStatusTx`, but lacks any `createTx` method. No server action or pipeline stage creates database exception items.
- **Impact:** The Exception Center is functionally read-only for existing records; automated rule failures cannot surface as persistent exceptions.

### GAP-02: getRecentAuditEventsAction Has No RBAC Role Restriction
- **Evidence:** In `src/platform/actions/audit.ts`, `getRecentAuditEventsAction` calls `executeInAuthenticatedContext` without any role authorization check (unlike other actions that assert roles).
- **Impact:** Any authenticated user with any role (e.g. `OPERATOR`) can read all tenant audit events.

### GAP-03: Authentication Provider Fails Closed Without Live Session
- **Evidence:** `DefaultSessionProvider.getSession()` returns `null` (`src/platform/auth/session.ts`). No production cookie/JWT session provider is wired into `setSessionProvider()`.
- **Impact:** All server action invocations will throw `AuthenticationError` until a live session provider is registered.

### GAP-04: Document Storage & Integrity Values Are Placeholders
- **Evidence:** `student-workflow.ts` uses simulated checksums (`'simulated_ocr_checksum_' + Date.now()`) and placeholder image paths (`/placeholder-doc.png`). Award proposal document uploads set `fileUrl = '#'`.
- **Impact:** No binary files are stored in object storage (S3/GCS) or integrity-validated via real SHA-256 hashes.

### GAP-05: Award Document Upload Bypasses Document / DocumentVersion Models
- **Evidence:** `uploadProposalDocumentAction` constructs an ephemeral `ProposalDocument` domain object and updates `AwardProposalDocument`, creating no rows in `documents` or `document_versions`.
- **Impact:** Document metadata and version history for employee awards are decoupled from the platform document store.

### GAP-06: Student ExtractedItem Verification Does Not Advance WorkflowInstance
- **Evidence:** `verifyExtractedItemAction` sets `Document.status = VERIFIED` but does not invoke the student workflow engine or update `WorkflowInstance.currentState`.
- **Impact:** Document status and workflow instance state remain out of sync.

### GAP-07: ValidationResult Table Is Orphaned in Schema
- **Evidence:** `ValidationResult` exists in `schema.prisma`, but validation rules in `PlatformValidationEngine` execute purely in-memory and are never persisted to Postgres.

### GAP-08: Student Fallback Identity Resolution Generates Synthetic Identifiers
- **Evidence:** Unmatched students in `verifyExtractedItemAction` are auto-created with generated NISN (`'005' + Date.now()`) and hardcoded class (`'X IPA 1'`).

### GAP-09: ActionResponse / ActionError Duplicated Across 5 Action Files
- **Evidence:** `ActionResponse<T>` and `ActionError` interfaces are redeclared independently in:
  1. `src/domains/employee/awards/actions.ts`
  2. `src/platform/actions/exception.ts`
  3. `src/platform/actions/operational.ts`
  4. `src/platform/actions/student-workflow.ts`
  5. `src/platform/actions/audit.ts`

### GAP-10: RBAC Policy Fragmentation
- **Evidence:** Employee award actions use `assertAuthorizedAction` with `AWARD_PROPOSAL_RBAC_POLICY` (`src/platform/auth/guards.ts`), while student, exception, and operational actions use ad-hoc inline role arrays.

---

## Architectural Risks [INFERRED / OBSERVATION]

### RISK-01: Dual Computation Path for Proposal Status
- **Evidence:** `src/domains/employee/awards/rules.ts` exports `calculateProposalStatus()`, which is re-exported via `src/lib/checklist-rules.ts`. Meanwhile, the server action pipeline uses `PlatformWorkflowEngine` FSM transitions.
- **Risk:** Client components calculating status via `calculateProposalStatus` may diverge from the authoritative server workflow state.

### RISK-02: ExceptionItem Schema Tight Coupling to WorkflowInstance
- **Evidence:** `ExceptionItem.workflowInstanceId` is mandatory in Prisma.
- **Risk:** Standalone validation exceptions (e.g. during batch Excel import or master data reconciliation) cannot be stored without fabricating a `WorkflowInstance`.

### RISK-03: ProposalStatus Enum Legacy Dead States
- **Evidence:** `ProposalStatus` in Prisma includes unused states (`DRAFT`, `SUBMITTED`, `VERIFIED_STAGE_1`, `APPROVED`, etc.) alongside canonical Indonesian states (`NOMINATIF`, `SEBAGIAN`, `LENGKAP`, etc.).

---

## Unknowns / Needs Verification

- **UNKNOWN-01:** Test suite composition and execution harness in `tests/`.
- **UNKNOWN-02:** Definition and deployment status of PostgreSQL function `set_tenant_context(actorId, tenantId)`.
