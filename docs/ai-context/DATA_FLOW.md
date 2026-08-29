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

## Pipeline 2: Employee Award Complete Lifecycle

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
    [IMPLEMENTED] ↓ signProposalAction (RBAC: SIGN_PROPOSAL)
                    transitions to DITANDATANGANI + atomic audit log ('SIGN')
    [IMPLEMENTED] ↓ sendProposalAction (RBAC: SEND_PROPOSAL)
                    transitions to DIKIRIM + atomic audit log ('SEND')
    [IMPLEMENTED] ↓ archiveCompleteProposalAction (RBAC: ARCHIVE_COMPLETE_PROPOSAL)
                    transitions to SELESAI + atomic audit log ('ARCHIVE_COMPLETE')
```

---

## Pipeline 3: Student Absence OCR & Verification

Triggered by operator in `src/platform/actions/student-workflow.ts`:

```
Document + extracted items (client-provided OCR payload)
    [IMPLEMENTED] ↓ uploadOCRDocumentAction (RBAC: ADMIN, ADMIN_TENANT, OPERATOR, VERIFIKATOR)
    [IMPLEMENTED] ↓ Document.create + DocumentVersion.create (checksum is synthetic)
    [IMPLEMENTED] ↓ OCRExtraction.create (status: COMPLETED) + ExtractedItem.create
    [IMPLEMENTED] ↓ Automated Validation Bridge: validateOCRAndCreateExceptions (creates ExceptionItem rows on rule breach)
    [IMPLEMENTED] ↓ AuditEvent ('UPLOAD_OCR')

    [Human Review in UI]

    [IMPLEMENTED] ↓ verifyExtractedItemAction (RBAC: ADMIN, ADMIN_TENANT, VERIFIKATOR)
    [IMPLEMENTED] ↓ Student resolution (match by NISN/name; fallback auto-creates synthetic student)
    [IMPLEMENTED] ↓ AbsenceRecord.create + ExtractedItem.update(absenceRecordId)
    [IMPLEMENTED] ↓ HumanVerification.create (PASSED / FLAGGED / REJECTED)
    [IMPLEMENTED] ↓ AuditEvent ('VERIFY_ITEM')
    [IMPLEMENTED] ↓ When all items verified: Document.update(status: VERIFIED)
```

---

## Pipeline 4: Exception Lifecycle & Resolution

Triggered in `src/platform/actions/exception.ts` and automated rules:

```
[IMPLEMENTED]  ↓ Automated Creation: validateOCRAndCreateExceptions / createExceptionAction
                 writes ExceptionItem rows atomically via PostgresExceptionRepository.createTx()
                 records transaction-bound AuditEvent ('CREATE_EXCEPTION')
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
