# P0-K.1 — Audit & Contract Workflow Orkestrasi Dokumen

**Audit scope:** read-only inspection of repository code, Prisma schema, migrations, and existing tests.  
**Baseline observed:** worktree already contains P0-J.2 commit `a294806` and earlier README commit `f133368`; no files were changed for this audit.  
**Important:** this report distinguishes the newer persisted P0-J matching contract from older orchestration code that still invokes a legacy matching path.

---

## 1. Existing Workflow Foundation

### 1.1 Persisted workflow models

`WorkflowInstance` and `WorkflowTransition` exist in [schema.prisma](file:///c:/Users/USER/Documents/sms-v1.0/prisma/schema.prisma#L507-L545).

- An instance is tenant-scoped and generic: `(tenantId, entityType, entityId)` is unique.
- `currentState`, `fromState`, and `toState` are free-form `String` fields (`VARCHAR(50)` in migration), not a canonical document-processing enum.
- `WorkflowTransition` stores `triggeredByUserId`, states, and an optional `reason`.
- Tenant/user relations are composite tenant-aware relations.

### 1.2 Workflow service/engine

[PlatformWorkflowEngine](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/workflow/engine.ts#L8-L81) is a generic in-memory definition evaluator. It can list/check/describe a transition and return a result. It does **not** persist `WorkflowInstance` or `WorkflowTransition`, does not run transactions, and does not record audit events.

### 1.3 Persisted workflow use

[PostgresExceptionRepository.createTx](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/repositories/exception.ts#L302-L391) finds or creates a `WorkflowInstance` for an exception's target entity, defaulting to `NEEDS_VERIFICATION`, then creates an `ExceptionItem`. The instance is an exception/work item context, not a document-processing orchestrator.

The exception repository validates transitions of **`ExceptionItem.status`** (`OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`) and records exception audit events. That logic does not persist `WorkflowTransition` records or update `WorkflowInstance.currentState` during those exception status changes.

`student-workflow.ts` implements a separate domain-specific verification flow over `ExtractedItem`, `HumanVerification`, and `Document`. Its `verifyExtractedItemAction` records `VERIFY_ITEM` events and may set `Document.status = VERIFIED`; it is not a generic persisted `WorkflowTransition` mechanism.

### 1.4 Conclusion

There is no complete canonical persisted document workflow service. Existing pieces are:

1. generic but non-persistent `PlatformWorkflowEngine`;
2. generic persisted workflow records, currently attached to exception entities;
3. separate exception and student verification transitions;
4. a distinct `DocumentProcessingJob` execution lifecycle.

Do not add a second workflow engine. A future P0-K implementation should decide whether the existing persisted `WorkflowInstance`/`WorkflowTransition` can be extended and how it remains distinct from job processing and human verification records.

---

## 2. Current Document Intelligence Pipeline

### 2.1 Fact-based map

```text
Upload / Document Intake
      ↓
Document + DocumentVersion + original object-storage binary
      ↓
DocumentProcessingJob (QUEUED)
      ↓
Worker claims job (PROCESSING)
      ↓
Object-storage download → document extractor
      ↓
DocumentIntelligenceOrchestrator
      ↓
OCRExtraction / ExtractedItem (legacy orchestration path)
      ↓
validation + exception projection + legacy identity resolution
      ↓
DocumentProcessingJob (COMPLETED or retry QUEUED or FAILED)

Separate canonical P0-J path:
ExtractionResult → MatchingResult + MatchingCandidate[]
                                      ↓
                       P0-J.2 manual confirmation fields
```

### 2.2 Stage map

| Stage | Existing input | Persistent output | Status / audit | Idempotency and rerun facts |
|---|---|---|---|---|
| Intake | Authenticated upload, file and metadata | `Document`, `DocumentVersion`; binary in object storage | Document status; intake audit is emitted in action | IDs are generated per request. `DocumentVersion` has version-number uniqueness; no request/idempotency token is evident in the inspected action. Uploading again is not proven to deduplicate. |
| Processing job enqueue | Document/version, actor, target domain, metadata | `DocumentProcessingJob` | `QUEUED`; job has `attempts`, `maxAttempts`, `lastError`, `processedAt` | Unique `(tenantId, documentVersionId)` prevents a second job per version. This also means deliberate reprocessing of the same version needs an explicit future contract. |
| Claim | Tenant + job id | Atomic status update and attempts increment | `QUEUED → PROCESSING` | Atomic conditional SQL update prevents two workers claiming the same queued row concurrently. |
| Extractor/OCR | Downloaded original binary | Extractor result passed to orchestrator; `DocumentOCRService` separately persists `OCRExtraction` | OCR states `QUEUED/PROCESSING/COMPLETED/FAILED`; OCR audit events `DOCUMENT_OCR_SUCCESS/FAILED` | `DocumentOCRService` reuses the latest extraction matching tenant/document/version, but read-then-create is not backed by a unique database key for that scope. Rerun overwrites the latest record. |
| Structured extraction (current orchestrator path) | Extractor-produced `items`/`rawText` | Current pipeline creates `OCRExtraction` if absent and inserts `ExtractedItem` rows | OCR status set `COMPLETED`; item `VerificationStatus` | On rerun it selects latest OCR by tenant+document (not explicitly document version), and inserts new `ExtractedItem` records with generated IDs. No unique extraction key for these inserted items is demonstrated; duplicate rows are possible. |
| P0-I `ExtractionResult` | Completed OCR extraction and canonical field | Schema supports `ExtractionResult` | `ExtractionStatus`: `BERHASIL`, `PERLU_DIPERIKSA`, `GAGAL` | Schema has `@@unique([tenantId, ocrExtractionId, field])`. No service/action write path for `ExtractionResult` was found in `src`; that is a pipeline integration GAP, not proof of absent schema. |
| Legacy identity resolution | ExtractedItem/document entities in `DocumentIntelligenceOrchestrator` | Result is included in in-memory pipeline output / item mapping; exception can be created | `RESOLVED/UNRESOLVED/AMBIGUOUS`; `PROCESS_DOCUMENT_INTELLIGENCE` audit | Orchestrator calls legacy `matchDocumentEntity`, not the P0-J `matchDocumentIdentity` persistence contract. |
| P0-J identity matching | `ExtractionResult` plus entity type/value | `MatchingResult` + `MatchingCandidate[]` | `MatchingStatus`; matching audit events | Matching unique key: `(tenantId, documentVersionId, extractionResultId, entityType)`. Candidate unique key: `(tenantId, matchingResultId, matchedEntityId)`. Matcher upserts rows. |
| P0-J.2 manual decision | Matching result and selected candidate, or reject-all | MatchingResult fields `manuallyConfirmed`, confirmed candidate/user/time and status | `MATCHING_CONFIRMED`, `MATCHING_REJECTED` audit | The action checks current `manuallyConfirmed` then updates in transaction context; no conditional compare-and-set is visible between check and update. Concurrent double submissions therefore are not proven serialized against one another. |
| Human verification (legacy item flow) | `ExtractedItem` and decision | `HumanVerification`, item status; may update `Document.status` | `PASSED/FLAGGED/REJECTED`; `VERIFY_ITEM` | Already-verified items return early. There is no unique constraint preventing duplicate HumanVerification rows for the same target. |
| Job terminalization | Orchestrator result/error | `DocumentProcessingJob` status and error/timestamp | `COMPLETED`, retry `QUEUED`, or terminal `FAILED` | Runner retries failure while attempts remain. A crash after claim can leave `PROCESSING`; no stale-claim lease/recovery path is evident. |

### 2.3 Pipeline distinction

The job runner invokes `DocumentIntelligenceOrchestrator`, which currently works with `OCRExtraction` and `ExtractedItem` and calls legacy `matchDocumentEntity`. The P0-J deterministic matcher accepts `ExtractionResult` and creates `MatchingResult`/`MatchingCandidate`; no invocation of `matchDocumentIdentity` was found in the inspected source. Treating these paths as already joined end-to-end would be inaccurate.

---

## 3. State Machine Audit

### 3.1 Document lifecycle

Schema `DocumentStatus`: `DRAFT`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`, `ARCHIVED`.
`DocumentVersion` has no separate lifecycle enum; it carries file/storage metadata. Document status reflects document/intake/verification/archive semantics in different code paths, so its exact meaning is mixed.

### 3.2 Processing lifecycle

- `DocumentProcessingStatus`: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`.
- `OCRExtractionStatus`: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`.
- `ExtractionStatus`: `BERHASIL`, `PERLU_DIPERIKSA`, `GAGAL`.
- `MatchingStatus`: `COCOK`, `PERLU_DIPERIKSA`, `TIDAK_DITEMUKAN`.
- Orchestrator result: `COMPLETED`, `REQUIRES_REVIEW`, `FAILED` (in-memory contract, not a persisted workflow state).

These describe different units/stages and should not be collapsed into one state enum.

### 3.3 Human verification lifecycle

- `ExtractedItem.status` uses `VerificationStatus`: `PENDING`, `VERIFIED`, `REJECTED`, `NEEDS_CORRECTION`.
- `HumanVerification.decision`: `PASSED`, `FLAGGED`, `REJECTED`.
- P0-J.2 records manual matching decision on `MatchingResult` itself via `manuallyConfirmed` and status, not `HumanVerification`.
- `ExceptionItem.status`: `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`.

These are parallel decision records, not a single shared verification state.

### 3.4 Ambiguities / overlap

- `Document.status = VERIFIED` may be changed by legacy item verification, although `DocumentStatus` is also the document lifecycle enum.
- Job `COMPLETED` is set whenever the orchestrator result is not `FAILED`, including `REQUIRES_REVIEW`; it is therefore “processing attempt completed” rather than “all human review complete”.
- `WorkflowInstance.currentState` is free-form, while an unrelated `StudentAbsenceWorkflowState` enum exists. No canonical relation between these is implemented.
- `ExceptionItem.status`, `ExtractedItem.status`, MatchingStatus, OCR status, job status and orchestration terminal status represent distinct axes.

---

## 4. Idempotency Audit

| Operation | Existing key / evidence | Safe retry behavior | Classification / GAP |
|---|---|---|---|
| Document intake | Random document/version IDs; `(documentId, versionNumber)` unique; checksum stored | A repeat upload creates new identity/version unless caller flow prevents it | Not request-idempotent; safe dedupe contract GAP. |
| Processing job creation | Unique `(tenantId, documentVersionId)` | Duplicate job creation is rejected, not returned/reused by a demonstrated upsert | Persistence uniqueness exists; caller retry behavior needs explicit handling. |
| Job claim | Conditional update `WHERE status='QUEUED'`; attempts increment | Only one claim wins | Atomic claim idempotency/concurrency boundary exists. |
| OCR service | Finds latest by tenant+document+version then updates or creates | Re-run reuses the latest row, but concurrent first runs can race; no matching unique constraint is shown | Partial application-level reuse, not complete DB-enforced idempotency. |
| ExtractedItem creation in orchestrator | Generated item IDs; no `(ocrExtractionId, field)` uniqueness in schema | Re-run can insert duplicate rows | Idempotency GAP. |
| P0-I ExtractionResult | Unique `(tenantId, ocrExtractionId, field)` | An upsert would be safe; actual write operation not found | Schema boundary exists; writer/operation GAP. |
| P0-J matching result | Unique tenant/version/extraction/entity key; matcher upsert | Re-run reuses row | Idempotent under intended P0-J path. |
| P0-J matching candidates | Unique tenant/result/entity; matcher upsert | Re-run updates existing candidate | Idempotent row creation; stale candidates absent from rerun are not deleted by shown matcher, so candidate-set reconciliation is not guaranteed. |
| Manual confirmation | `manuallyConfirmed` flag; audit event on each successful action | Repeat after committed manual choice is rejected. If two requests concurrently read false, both may update and audit; no CAS/row lock shown | Irreversible manual decision; concurrency safety GAP at action-level. |
| Workflow transition | Unique transition ID only; no idempotency key/unique sequence/event key | Persisted transition write path was not found. Engine result itself is ephemeral. | GAP. |

**Audit decision duplication:** successful manual action call emits one event in its transaction. A subsequent call after committed confirmation is rejected before audit. Concurrent calls could both pass the read guard under suitable isolation, so duplicate/conflicting decision audit is not ruled out by visible application logic.

---

## 5. Failure / Resume Audit

| Condition | What code currently does | Classification from the existing behavior |
|---|---|---|
| OCR FAILED (`DocumentOCRService`) | Persists `FAILED`, error, completed timestamp; emits `DOCUMENT_OCR_FAILED` if actor provided. A later explicit OCR action can reuse/update latest row. | Retry is possible by re-invocation, not automatic bounded retry in this service. |
| Extractor failure in processing runner | Catches error; if attempts remain, status returns to `QUEUED`; otherwise `FAILED`; retains `lastError`. | Bounded retry exists for exceptions inside runner execution. |
| Orchestrator returns `FAILED` | Runner treats as failure and applies bounded retry/terminal failure. | Retryable until max attempts. |
| Orchestrator returns `REQUIRES_REVIEW` | Runner treats as success and marks job `COMPLETED`. | Automated processing complete; human review is a separate outstanding state. |
| Matching ambiguity / no match | P0-J MatchingStatus and P0-J.2 manual decision exist; no integration found that makes processing job wait for/advance based on P0-J decision. | Should conceptually `WAIT_FOR_HUMAN` at the future workflow contract level; current job may already be `COMPLETED`. GAP in orchestration linkage. |
| Database failure before job claim | Claim/query fails; no job transition can be assumed. | Retry at trigger/runtime boundary is unspecified. |
| Database failure after claim/before final status | `PROCESSING` row may remain; runner has no `finally` recovery/lease logic visible. | Resume/reclaim GAP. |
| Object storage download failure | Caught as job failure; retry while attempts remain; terminal `FAILED` otherwise. | Bounded retry; original binary remains in object storage (no move in this path). |
| Process interruption/crash | Claimed status remains `PROCESSING`; worker selects only `QUEUED`; no stale processing reset found. | Resume GAP. |
| Audit write failure | Orchestrator audit is in transaction and can fail the transaction; OCR audit is separately attempted and failure is logged/warned rather than failing OCR. | Audit guarantees differ by stage; no unified policy. |

No new retry/resume mechanism is proposed here. Recommended future behavior needs explicit classification of transient infrastructure failure versus deterministic/business failure before implementation.

---

## 6. Manual Decision Protection Audit (P0-J.2)

### Design guarantee in matcher

In [document-identity-matcher.ts](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/services/document-identity-matcher.ts#L274-L307), if the matching result is already `manuallyConfirmed`, the matcher returns its existing status, records `MATCHING_REUSED`, and does not reach the result/candidate upserts. Thus a persisted manual `COCOK` or `TIDAK_DITEMUKAN` decision and its confirmed candidate/user/time are preserved **when this P0-J matcher is invoked with the same unique identity**.

### Scope limitation

- The P0-K processing runner currently calls the older `DocumentIntelligenceOrchestrator`; that orchestrator calls legacy `matchDocumentEntity`, not `matchDocumentIdentity`.
- No workflow-to-P0-J matcher invocation or `WAIT_FOR_HUMAN` gate is present in the source path inspected.
- The matcher protection therefore exists, but cannot be asserted as an end-to-end workflow guarantee until the canonical workflow invokes the P0-J matcher and keys it to the same result.
- P0-J.2 action checks `manuallyConfirmed` before update, but read and write are not a conditional update. Concurrent distinct decisions are not ruled out.

**Conclusion:** P0-J matcher-level preservation is present; end-to-end workflow protection and concurrent mutation serialization are GAPs to carry into P0-K.2 design. Do not change these in this audit phase.

---

## 7. Work Queue Audit

### Existing canonical operational queue

`PostgresOperationalQueryRepository.getUnifiedWorkQueueItemsTx` in [operational-query.ts](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/repositories/operational-query.ts#L185-L283) projects:

1. `ExtractedItem` records with `status=PENDING`, currently labeled as manual extraction/absence verification work;
2. open/in-review `ExceptionItem` records.

`getUnifiedWorkQueueAction` exposes this via `OPERATIONAL_WORK_QUEUE_READ` in [operational.ts](file:///c:/Users/USER/Documents/sms-v1.0/src/platform/actions/operational.ts#L101-L134). This is the existing operational queue surface; no second queue should be created.

### Requested work item coverage

| Item | Existing projection? | Audit result |
|---|---|---|
| OCR needs review | Indirectly, pending `ExtractedItem` only; not OCRExtraction status itself | Partial; label/domain mapping is legacy and should not be mistaken for generic OCR queue. |
| Extraction needs review | Pending `ExtractedItem` projected | Partial; P0-I `ExtractionResult.status` is not queried. |
| Matching needs review | No MatchingResult query found | GAP. |
| Manual confirmation required | No explicit matching/manual decision projection found | GAP. |
| Processing failed | No DocumentProcessingJob query found in this queue | GAP. |

Recommendation: extend the existing `UnifiedWorkQueue` projection in a later approved phase if workflow requirements demand these items; do not introduce a parallel queue.

---

## 8. Archival Boundary Audit

P0-G schema contains `Document.retentionUntil`, `archivedAt`, `archiveLocation`, `isTemporary` and `DocumentVersion.storageStatus`. Upload and processing code inspected do not move/delete the original binary. The processing runner downloads the original from object storage and extracts it; it does not archive it.

The runner sets `DocumentProcessingJob.COMPLETED` for both orchestrator `COMPLETED` and `REQUIRES_REVIEW`; therefore this status alone does **not** prove human verification is complete or that a document is eligible for archival.

**Boundary recommendation:** future archival eligibility should be derived only from an explicitly defined processing-complete condition plus required human decisions being resolved, while respecting `isTemporary`, retention and storage state. No archival action, file move, deletion, NAS, or backup integration is in scope here.

---

## 9. GAP Matrix

| Area | Existing | Gap | Risiko | Recommended Phase |
|---|---|---|---|---|
| Workflow | Generic WorkflowInstance/Transition schema; generic in-memory engine; instances used by exceptions | No canonical persisted document workflow service; no document transitions written | Workflow claims could exceed persisted evidence | P0-K.2 contract-approved implementation |
| State | Several separate document, OCR, extraction, matching, item verification, exception, job, orchestration states | No authoritative mapping across them; `DocumentStatus.VERIFIED` overlaps verification semantics | Incorrect completion/queue/archive decisions | P0-K.2 |
| Idempotency | Unique keys/upserts for matching; unique job per version; extraction-result unique schema | Intake request dedupe, extracted-item rerun dedupe, workflow transition idempotency unclear; P0-I writer absent | Duplicate records/events or rejected retries | Relevant bounded phase after P0-K.2 |
| Retry | Runner bounded retries through attempts/maxAttempts; OCR can be explicitly reinvoked | Retry classification/backoff and OCR concurrency policy unclear | repeated external work or immediate retry storms | P0-K.2 / later runtime phase |
| Resume | Atomic queued claim | No stale PROCESSING lease/recovery; process interruption can strand job | Job remains stuck and cannot be worker-selected | Dedicated approved resume phase |
| Manual Decision | P0-J matcher protects confirmed decision on same identity; P0-J.2 confirmation/rejection persisted | Current orchestrator uses legacy matcher; workflow does not wait on P0-J.2; concurrent confirmations not serialized | Decision not applied end-to-end or concurrent overwrite | P0-K.2, preserve P0-J contract |
| Work Queue | Unified queue for pending ExtractedItems and exceptions | No matching result, manual confirmation, or failed processing job projection | Operator cannot see all actionable states in one place | Later phase extending existing queue |
| Audit | OCR, orchestration, matching, manual decision, exception events exist | No persisted generic workflow transition writer/event contract; OCR audit best-effort differs | Incomplete cross-stage forensic trace | P0-K.2 |
| Archival Boundary | Retention/archive metadata schema; original object storage | No canonical eligibility predicate; job COMPLETED may mean review still pending | Premature archive if job status misread | Define predicate in P0-K.2; implementation only later |

---

## 10. Proposed Canonical Workflow Contract (P0-K proposal only)

This is a design proposal grounded in available models, not an assertion that it is implemented.

### 10.1 Unit and trigger

- **One workflow unit:** one `(tenantId, documentVersionId)` processing lifecycle. This aligns with `DocumentProcessingJob`'s existing unique key and makes document revisions independent.
- **Trigger:** successful persistence of `Document`, `DocumentVersion`, and its unique `DocumentProcessingJob(QUEUED)` record. Existing upload flows differ; canonical trigger must be selected in P0-K.2.
- **Existing persistence to reuse:** `DocumentProcessingJob` for execution; `WorkflowInstance` and `WorkflowTransition` only if their current generic identity semantics can represent this unit without colliding with exception workflows. Prefer `entityType='DocumentVersion'`, `entityId=documentVersionId` if schema/relationships support and team approves. Do not create a second workflow model by default.

### 10.2 State dimensions (keep separate)

- **Job processing state:** existing `QUEUED → PROCESSING → COMPLETED | FAILED`; retry returns failed attempts to `QUEUED`.
- **Review gate:** derived from existing ExtractionResult/MatchingResult/HumanVerification records, not a new combined enum. Proposed view-level value can be `NOT_REQUIRED | WAITING_FOR_HUMAN | RESOLVED`, only if approved as a non-persistent projection.
- **Document lifecycle:** preserve `DocumentStatus` for intake/business-document lifecycle; define exact mapping before using it as processing status.
- **Workflow state (if persisted):** define a compact document-version state contract separately from job status and review records; do not assign values until approved. Existing free-form strings need validation in application service if reused.

### 10.3 Transition authority

- Automatic transitions: system/worker may enqueue, claim, record stage outcomes, and finish/retry job under trusted server boundary.
- Manual transitions: authenticated authorized operator/admin decides matching via existing P0-J.2 action; verification decisions via their existing canonical server action. Do not duplicate the human decision in an independent workflow state as authority.
- All transitions tenant-scoped and transactional with transition record + audit event. Exact RBAC keys and actor representation must be approved per action.

### 10.4 Failure and resume

- Transient storage/database/provider failures: bounded retry, preserving error evidence, only when safe.
- Deterministic invalid input or invariant failures: fail terminally or require correction; classify explicitly in P0-K.2.
- Ambiguous/unmatched identities: `WAIT_FOR_HUMAN` gate; must not rerun destructively over P0-J.2 manual decision.
- Resume: re-enqueue/reclaim only through explicit persisted state and attempt policy. Existing stale `PROCESSING` recovery is absent; no automatic resume is currently claimed.

### 10.5 Idempotency boundary

- Intake: future request key/checksum policy must distinguish accidental retry from intentional new version.
- Processing job: existing `(tenantId, documentVersionId)` unique constraint.
- OCR: tenant+documentVersion identity; current code reuses latest but schema does not enforce this key.
- ExtractionResult: `(tenantId, ocrExtractionId, field)`.
- MatchingResult: `(tenantId, documentVersionId, extractionResultId, entityType)`.
- MatchingCandidate: `(tenantId, matchingResultId, matchedEntityId)`.
- Manual decision: one immutable decision per MatchingResult; needs concurrency-safe conditional mutation in any future correction phase, not a second decision record.
- WorkflowTransition: require a stable transition/idempotency key or an explicitly accepted at-least-once audit policy before implementation; current schema has neither key nor writer.

### 10.6 Completion and archival eligibility

- A processing job can be execution-complete while a human review gate remains pending. Do not equate job `COMPLETED` to business verification complete.
- Workflow is complete only when all required automatic stages have successful persisted evidence and all required human decisions are resolved.
- Archive eligibility is a derived predicate after workflow completion and retention/temporary-file policy checks. P0-K.1 does not define archival action or move files.

### 10.7 Questions answered for the proposed contract

1. **Unit:** tenant + document version.
2. **Trigger:** persisted intake/version plus unique queued job (canonical upload path still to select).
3. **Valid state:** separate job, document, extraction/matching and human decision states; no combined enum.
4. **Transition authority:** worker/system for automated execution; authorized operator for human decision.
5. **Automatic transitions:** enqueue, claim, stage result, retry/terminalize.
6. **Manual transitions:** candidate confirmation/rejection and human verification via existing actions.
7. **Failure:** transient bounded retry; deterministic failures terminal/correction after classification.
8. **Resume:** explicit persisted recovery policy; stale PROCESSING currently lacks one.
9. **Idempotency:** keys listed above; transition key is a GAP.
10. **Manual protection:** matching rerun returns reused result if same P0-J identity and `manuallyConfirmed=true`; workflow must invoke this path and never mutate decision fields.
11. **Audit:** existing AuditEventRepository; define a persisted workflow transition audit action and atomicity contract before coding.
12. **Completion:** automatic stages complete and any required human decisions resolved.
13. **Archival:** eligible only after that completion predicate and retention policy; no archival implementation now.

---

## 11. Acceptance Criteria Result

| Criterion | Result | Evidence |
|---|---|---|
| Existing workflow foundation audited | ✅ | Schema, generic engine, exception repository, actions inspected |
| No second workflow mechanism proposed without reason | ✅ | Proposal reuses job + existing generic workflow records if approved |
| Document → OCR → Extraction → Matching → Verification mapped | ✅ with GAP noted | P0-J path and legacy orchestration path explicitly distinguished |
| State boundaries documented | ✅ | Separate document, processing, and human decision states |
| Idempotency documented | ✅ | Keys, evidence, and limitations by stage |
| Failure/resume documented | ✅ | Retry, DB/storage, crash, human pending behavior classified |
| Manual decision protection documented | ✅ with GAP noted | Matcher guard exists; end-to-end and concurrent safety are not proven |
| Work Queue boundary documented | ✅ | Existing UnifiedWorkQueue coverage and omissions listed |
| Archival boundary documented without implementation | ✅ | Metadata and eligibility boundary only |
| All gaps recorded | ✅ | GAP matrix included |
| Proposed P0-K contract available | ✅ | Section 10 |
| No source/schema/migration/UI/service/repository/test changes | ✅ | Audit tools only; no workspace files were edited |
| No implementation commit | ✅ | No commit made for this audit |

---

## Stop

P0-K.1 audit is complete. No implementation was performed. Await explicit approval before P0-K.2.
