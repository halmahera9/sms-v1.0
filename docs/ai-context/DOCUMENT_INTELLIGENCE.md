# DOCUMENT INTELLIGENCE

## Pipeline Lifecycle Audit

This document audits the 9 stages of the Document Intelligence pipeline against actual committed code and contracts.

```
Document → DocumentVersion → OCRExtraction → ExtractedItem → Identity Resolution → Validation → Exception → Human Verification → Audit
```

---

### Stage 1: Document
- **Schema Model:** `Document` (`documents`) — `title`, `category`, `status`, `currentVersion`.
- **Status:** **PARTIALLY INTEGRATED** [COMMITTED]
- **Evidence:** `uploadOCRDocumentAction` creates `Document` rows. Employee award document upload currently updates `AwardProposalDocument` and uses `fileUrl='#'`.

### Stage 2: DocumentVersion
- **Schema Model:** `DocumentVersion` (`document_versions`) — `filePath`, `checksumSha256`, `mimeType`.
- **Status:** **PARTIALLY INTEGRATED** [COMMITTED]
- **Evidence:** Rows created in student upload path, but `checksumSha256` is simulated (`'simulated_ocr_checksum_' + Date.now()`) and `filePath` is a placeholder (`/placeholder-doc.png` or raw URL).

### Stage 3: OCR / Extraction
- **Schema Model:** `OCRExtraction` (`ocr_extractions`) — `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), `rawJson`.
- **Status:** **EXISTING BUT NOT ORCHESTRATED** [COMMITTED]
- **Evidence:** `uploadOCRDocumentAction` immediately sets `COMPLETED` from client-provided items. `QUEUED` and `PROCESSING` states exist in schema for future async worker pipelines.

### Stage 4: ExtractedItem
- **Schema Model:** `ExtractedItem` (`extracted_items`) — student-specific fields (`studentNameRaw`, `nisnRaw`, `absenceDateRaw`).
- **Status:** **IMPLEMENTED (Student domain)** [COMMITTED]
- **Evidence:** `ExtractedItem` rows created and linked to `OCRExtraction`. Generic extraction payload contracts defined in `src/platform/types/document-intelligence.ts`.

### Stage 5: Identity Resolution
- **Status:** **IMPLEMENTED (Domain-specific)** [COMMITTED]
- **Evidence:**
  - Employee: 5-case NIP/NRK resolution with collision rollback in `AwardProposalApplicationService.importProposalsTx`.
  - Student: Lookup by NISN/Name with fallback student record creation in `verifyExtractedItemAction`.
  - Contracts: `IdentityResolutionOutcome` contract defined in `src/platform/types/document-intelligence.ts`.

### Stage 6: Validation
- **Status:** **INTEGRATED VIA VALIDATION BRIDGE** [COMMITTED]
- **Evidence:** `validateOCRAndCreateExceptions` bridges in-memory validation rules to persistent Postgres exception records on OCR ingestion.

### Stage 7: Exception
- **Schema Model:** `ExceptionItem` (`exception_items`) — `workflowInstanceId`, `ruleCode`, `severity`, `status`.
- **Status:** **FULLY INTEGRATED (CRUD + Transition + Audit)** [COMMITTED]
- **Evidence:**
  - `PostgresExceptionRepository` (`findManyTx`, `findByIdTx`, `createTx`, `updateStatusTx`).
  - Server actions: `getExceptionsAction`, `createExceptionAction`, `updateExceptionStatusAction`.
  - `RULE_MESSAGE_CATALOG` maps rule violation codes to human-readable explanations.

### Stage 8: Human Verification
- **Schema Model:** `HumanVerification` (`human_verifications`) — `targetEntityType`, `targetEntityId`, `decision`.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** Created during `verifyExtractedItemAction` in the Student pipeline.

### Stage 9: Audit
- **Schema Model:** `AuditEvent` (`audit_events`) — `actorUserId`, `action`, `entityType`, `entityId`, `payloadJson`.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** `PostgresAuditEventRepository.recordTx` called atomically in every state mutation across all domains.

---

## Orchestration Summary

The canonical contract `IDocumentIntelligenceOrchestrator` is defined in `src/platform/types/document-intelligence.ts`. The pipeline is functional across both Employee and Student domains, with the automated validation bridge actively generating exceptions.
