# DOCUMENT INTELLIGENCE

## Pipeline Lifecycle Audit

This document audits the 9 stages of the theoretical Document Intelligence pipeline against actual committed code and working snapshot contracts.

```
Document → DocumentVersion → OCRExtraction → ExtractedItem → Identity Resolution → Validation → Exception → Human Verification → Audit
```

---

### Stage 1: Document
- **Schema Model:** `Document` (`documents`) — `title`, `category`, `status`, `currentVersion`.
- **Status:** **PARTIALLY INTEGRATED** [COMMITTED]
- **Evidence:** `uploadOCRDocumentAction` creates `Document` rows. Employee award document upload bypasses `Document` and creates domain-layer `ProposalDocument` with `fileUrl='#'`.

### Stage 2: DocumentVersion
- **Schema Model:** `DocumentVersion` (`document_versions`) — `filePath`, `checksumSha256`, `mimeType`.
- **Status:** **PARTIALLY INTEGRATED** [COMMITTED]
- **Evidence:** Rows created in student upload path, but `checksumSha256` is simulated (`'simulated_ocr_checksum_' + Date.now()`) and `filePath` is a placeholder (`/placeholder-doc.png` or raw URL).

### Stage 3: OCR / Extraction
- **Schema Model:** `OCRExtraction` (`ocr_extractions`) — `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), `rawJson`.
- **Status:** **EXISTING BUT NOT ORCHESTRATED** [COMMITTED]
- **Evidence:** `uploadOCRDocumentAction` immediately sets `COMPLETED` from client-provided items. `QUEUED` and `PROCESSING` states are unused. No server-side OCR engine call exists.

### Stage 4: ExtractedItem
- **Schema Model:** `ExtractedItem` (`extracted_items`) — student-specific fields (`studentNameRaw`, `nisnRaw`, `absenceDateRaw`).
- **Status:** **IMPLEMENTED (Student domain only)** [COMMITTED]
- **Evidence:** `ExtractedItem` rows created and linked to `OCRExtraction`. The model is domain-specific to students; no generic or employee extraction model exists in Prisma.

### Stage 5: Identity Resolution
- **Status:** **IMPLEMENTED (Domain-specific, not abstracted)** [COMMITTED]
- **Evidence:**
  - Employee: 5-case NIP/NRK resolution in `AwardProposalApplicationService.resolveEmployeeIdentityTx`.
  - Student: Fallback lookup (NISN → Name → auto-create synthetic Student) in `verifyExtractedItemAction`.
  - Snapshot: `IdentityResolutionOutcome` contract defined in `src/platform/types/document-intelligence.ts` [SNAPSHOT], but no shared resolver service implements it.

### Stage 6: Validation
- **Schema Model:** `ValidationResult` (`validation_results`) table exists in Prisma.
- **Status:** **EXISTING BUT NOT ORCHESTRATED** [COMMITTED]
- **Evidence:** `PlatformValidationEngine` (`src/platform/rules/engine.ts`) runs rules in-memory. Validation results are never written to `validation_results` table.

### Stage 7: Exception
- **Schema Model:** `ExceptionItem` (`exception_items`) — `workflowInstanceId` (required FK), `ruleCode`, `severity`, `status`.
- **Status:** **EXISTING BUT NOT ORCHESTRATED (CRITICAL GAP)** [COMMITTED]
- **Evidence:**
  - Read & status transition implemented in `PostgresExceptionRepository`.
  - **No creation path exists:** Zero code calls `tx.exceptionItem.create()`.
  - **Intended Rules Catalog:** `src/platform/repositories/exception.ts` exports `RULE_MESSAGE_CATALOG` (mapping rules like `DOC_COMPLETENESS_RULE`, `SE_BKD_22_2026_RULE`, `MASA_KERJA_ELIGIBILITY_RULE`, `OCR_CONFIDENCE_THRESHOLD_RULE` to user messages), providing evidence of intended rule violation mappings that are not yet wired to automated exception creation.
  - **Blocking Dependency:** `ExceptionItem.workflowInstanceId` is a non-nullable FK, but `WorkflowInstance` rows are never created in application code.

### Stage 8: Human Verification
- **Schema Model:** `HumanVerification` (`human_verifications`) — `targetEntityType`, `targetEntityId`, `decision`.
- **Status:** **IMPLEMENTED for Student only** [COMMITTED]
- **Evidence:** Created during `verifyExtractedItemAction`. Employee award document verification updates `AwardProposalDocument` directly without creating `HumanVerification` records.

### Stage 9: Audit
- **Schema Model:** `AuditEvent` (`audit_events`) — `actorUserId`, `action`, `entityType`, `entityId`, `payloadJson`.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** `PostgresAuditEventRepository.recordTx` called atomically in every mutation.

---

## Orchestration Summary

The stages exist as fragmented, domain-specific implementations. The application-level orchestrator contract `IDocumentIntelligenceOrchestrator` is defined in `src/platform/types/document-intelligence.ts` [SNAPSHOT] but has **zero implementation**.
