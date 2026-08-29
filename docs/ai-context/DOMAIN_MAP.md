# DOMAIN MAP

## Domain 1: Employee Awards

### Purpose
Manages PNS/PPPK award nominations under SE BKD 22/SE/2026. Types: `MASA_KERJA` (tenure) and `SATYALANCANA` (distinguished service).

### Primary Entities (Prisma)
- `Employee` (`employees`): `nip` (18 char), `nrk` (10 char), `fullName`, `statusKepegawaian`.
- `AwardProposal` (`award_proposals`): `employeeId`, `jenisPenghargaan`, `tahunUsulan`, `status` (`ProposalStatus`).
- `AwardProposalDocument` (`award_proposal_documents`): `proposalId`, `requirementCode`, `status` (`ChecklistStatus`), `verifiedByUserId`.
- `Document` / `DocumentVersion`: Generic document containers.

### Workflow FSM (`AwardProposal.status`)
```
NOMINATIF → BELUM_UPLOAD → SEBAGIAN → LENGKAP → DIVERIFIKASI → SIAP_GENERATE → GENERATED → DITANDATANGANI → DIKIRIM → SELESAI
```
- Defined in: `src/domains/employee/awards/workflow.ts`
- Engine: `PlatformWorkflowEngine` (`src/platform/workflow/engine.ts`)
- Guard on `APPROVE_GENERATION`: requires `allMandatoryVerified === true`.

### Server Actions (`src/domains/employee/awards/actions.ts`)
- `uploadProposalDocumentAction` (RBAC: ADMIN, VERIFIKATOR, OPERATOR)
- `verifyProposalDocumentAction` (RBAC: ADMIN, VERIFIKATOR)
- `approveProposalGenerationAction` (RBAC: ADMIN, VERIFIKATOR)
- `batchMarkGeneratedAction` (RBAC: ADMIN, VERIFIKATOR, OPERATOR)
- `getAwardProposalsAction` (RBAC: Any authenticated user — [INFERRED: no key in `AWARD_PROPOSAL_RBAC_POLICY`])
- `importAwardProposalsAction` (RBAC: ADMIN, VERIFIKATOR, OPERATOR) — 5-case NIP/NRK identity resolution with atomic rollback on collision.

---

## Domain 2: Student Absence

### Purpose
Processes student absence documents through an OCR extraction and human verification pipeline.

### Primary Entities (Prisma)
- `Student` (`students`): `nisn` (10 digit), `nis` (20 char), `fullName`, `className`.
- `AbsenceRecord` (`absence_records`): `studentId`, `absenceDate`, `status` (`AbsenceStatus`), `documentId`.
- `OCRExtraction` (`ocr_extractions`): `documentId`, `status` (`OCRExtractionStatus`), `rawJson`.
- `ExtractedItem` (`extracted_items`): `studentNameRaw`, `nisnRaw`, `confidenceScore`, `matchedStudentId`, `absenceRecordId`.

### Workflow & Lifecycle Note
- Theoretical Workflow FSM (`src/domains/student/workflow.ts`):
  `DRAFT → NEEDS_VERIFICATION ⇆ REQUIRES_CORRECTION → VERIFIED → COMPLETED`
- **[CRITICAL GAP] `WorkflowInstance` Persistence:** No application code calls `tx.workflowInstance.create()`. `WorkflowInstance` appears in code exclusively as an `include:` relation in read queries. `verifyExtractedItemAction` sets `Document.status = VERIFIED` but does NOT update or advance any `WorkflowInstance` row.

### Server Actions (`src/platform/actions/`)
- `getOCRDocumentsAction` (`student-workflow.ts`): Reads documents with extractions.
- `uploadOCRDocumentAction` (`student-workflow.ts`): Atomically creates Document, DocumentVersion, OCRExtraction (as `COMPLETED`), and ExtractedItems from client-provided items.
- `verifyExtractedItemAction` (`student-workflow.ts`): Creates `AbsenceRecord`, `HumanVerification`, updates `ExtractedItem`, and emits audit event.
- `getStudentMasterDataAction` (`student.ts`): Reads student master records.
- `exportStudentAbsenceAction` (`student-export.ts`): Exports absence records.

---

## Platform Shared Infrastructure

### Exception Center
- **Repository:** `PostgresExceptionRepository` (`src/platform/repositories/exception.ts`).
- **Domain Derivation:** `ExceptionItemRecord.domain` (`'EMPLOYEE' | 'STUDENT'`) is derived at read time in `mapToDomain()` by checking `workflowInstance.entityType` against `EMPLOYEE_ENTITY_TYPES` / `STUDENT_ENTITY_TYPES` and prefix-matching `ruleCode` — it is not a stored database column.
- **Server Actions:** `getExceptionsAction` (read/filter), `updateExceptionStatusAction` (state transition with audit log).
- **In-Memory Queue:** `PlatformExceptionQueue` (`src/platform/exceptions/queue.ts`) is an in-memory test utility not wired to Postgres.

### Audit Trail
- **Repository:** `PostgresAuditEventRepository` (`src/platform/repositories/audit-event.ts`) — atomic append-only writes within caller transaction.
- **Server Action:** `getRecentAuditEventsAction` (`src/platform/actions/audit.ts`) — read-only audit log.

### Operational Dashboard
- **Repository:** `PostgresOperationalQueryRepository` (`src/platform/repositories/operational-query.ts`).
- **Server Actions:** `getOperationalMetricsAction`, `getUnifiedWorkQueueAction`.

### Authentication
- **Session Layer:** `src/platform/auth/session.ts` — `executeInAuthenticatedContext`, `getAuthenticatedActorContext`. Default session provider fails closed (`null`).
- **Guards:** `src/platform/auth/guards.ts` — `assertAuthorizedAction` (used in employee domain).
