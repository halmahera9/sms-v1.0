# DATA FLOW

## Status Legend
- `[IMPLEMENTED]` — Confirmed in committed code
- `[PARTIAL]` — Implemented with missing stages or mock data
- `[TARGET]` — Architectural target not yet wired

---

## Pipeline 1: Employee Award Import (Excel → Proposal)

Triggered by: `importAwardProposalsAction` → `AwardProposalApplicationService.importProposalsTx`

```
Excel rows (client-parsed)
    [IMPLEMENTED] ↓ Server Action: importAwardProposalsAction
                    auth: getAuthenticatedActorContext() (via compat alias getAuthenticatedSession)
                    RBAC: IMPORT_PROPOSALS (ADMIN, VERIFIKATOR, OPERATOR)
                    input validation: row-by-row field check
    [IMPLEMENTED] ↓ runInTenantContext(actorId, tenantId) → set_tenant_context() (RLS)
    [IMPLEMENTED] ↓ Identity Resolution (5-case NIP/NRK match)
                    NIP / NRK queries via PostgresEmployeeRepository
                    Collision → throws IDENTITY_COLLISION (entire batch rolls back)
    [IMPLEMENTED] ↓ Employee upsert (saveTx)
    [IMPLEMENTED] ↓ Proposal idempotency check (findByEmployeeAndAwardAndYearTx)
    [IMPLEMENTED] ↓ AwardProposal save (saveTx)
    [IMPLEMENTED] ↓ Aggregate AuditEvent ('IMPORT_AWARD_PROPOSALS')
```

---

## Pipeline 2: Employee Award Verification Lifecycle

Triggered by sequence of server actions in `src/domains/employee/awards/actions.ts`:

```
AwardProposal (status: NOMINATIF)
    [IMPLEMENTED] ↓ uploadProposalDocumentAction (RBAC: UPLOAD_DOCUMENT)
                    creates domain ProposalDocument (with stub fileUrl='#')
                    transitions to SEBAGIAN or LENGKAP
    [IMPLEMENTED] ↓ verifyProposalDocumentAction (RBAC: VERIFY_DOCUMENT)
                    verifies checklist item; transitions to DIVERIFIKASI
    [IMPLEMENTED] ↓ approveProposalGenerationAction (RBAC: APPROVE_GENERATION)
                    enforces allMandatoryVerified guard → transitions to SIAP_GENERATE
    [IMPLEMENTED] ↓ batchMarkGeneratedAction (RBAC: MARK_GENERATED)
                    transitions to GENERATED
    [TARGET]      ↓ SIGN → DITANDATANGANI (workflow event exists, no action implemented)
    [TARGET]      ↓ SEND → DIKIRIM (workflow event exists, no action implemented)
    [TARGET]      ↓ ARCHIVE_COMPLETE → SELESAI (workflow event exists, no action implemented)
```

---

## Pipeline 3: Student Absence OCR & Verification

Triggered by operator in `src/platform/actions/student-workflow.ts`:

```
Document + extracted items (client-provided OCR payload)
    [IMPLEMENTED] ↓ uploadOCRDocumentAction (RBAC: ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR)
    [IMPLEMENTED] ↓ Document.create + DocumentVersion.create (checksum is synthetic)
    [IMPLEMENTED] ↓ OCRExtraction.create (status: COMPLETED) + ExtractedItem.create
    [IMPLEMENTED] ↓ AuditEvent ('UPLOAD_OCR')

    [Human Review in UI]

    [IMPLEMENTED] ↓ verifyExtractedItemAction (RBAC: ADMIN, ADMIN_TENANT, VERIFIKATOR)
    [IMPLEMENTED] ↓ Student resolution (match by NISN/name; fallback auto-creates synthetic student)
    [IMPLEMENTED] ↓ AbsenceRecord.create + ExtractedItem.update(absenceRecordId)
    [IMPLEMENTED] ↓ HumanVerification.create (PASSED / FLAGGED / REJECTED)
    [IMPLEMENTED] ↓ AuditEvent ('VERIFY_ITEM')
    [IMPLEMENTED] ↓ When all items verified: Document.update(status: VERIFIED)
    [CRITICAL GAP] Note: WorkflowInstance.currentState is NEVER advanced or updated.
```

---

## Pipeline 4: Exception Resolution

Triggered in `src/platform/actions/exception.ts`:

```
[CRITICAL GAP] Exception creation in DB: No automated path exists (no createTx in repo).

[IMPLEMENTED]  ↓ getExceptionsAction (RBAC: ADMIN, ADMIN_TENANT, VERIFIKATOR, AUDITOR)
                 queries PostgresExceptionRepository under RLS
[IMPLEMENTED]  ↓ updateExceptionStatusAction (RBAC: ADMIN, ADMIN_TENANT, VERIFIKATOR)
                 state transitions: OPEN → IN_REVIEW → RESOLVED / DISMISSED
                 atomic AuditEvent emission in same transaction
```

---

## Pipeline 5: Audit Feed

Triggered in `src/platform/actions/audit.ts`:

```
[IMPLEMENTED]  ↓ Mutations record audit events atomically via PostgresAuditEventRepository.recordTx()
[IMPLEMENTED]  ↓ getRecentAuditEventsAction (Read)
                 [CONFIRMED GAP]: No RBAC role restriction — any authenticated role can read.
```

---

## Pipeline 6: Operational Dashboard

Triggered in `src/platform/actions/operational.ts`:

```
[IMPLEMENTED]  ↓ getOperationalMetricsAction: parallel COUNTs across exceptions, proposals, OCR, students
[IMPLEMENTED]  ↓ getUnifiedWorkQueueAction: projections from AwardProposal, ExtractedItem, ExceptionItem
```
