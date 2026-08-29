# DOCUMENT INTELLIGENCE

## Pipeline Lifecycle Audit

This document audits the 9 stages of the Document Intelligence pipeline against actual committed code and contracts.

```
Document → DocumentVersion → OCRExtraction → ExtractedItem → Identity Resolution → Validation → Exception → Human Verification → Audit
```

---

### Stage 1: Document
- **Schema Model:** `Document` (`documents`) — `title`, `category`, `status`, `currentVersion`.
- **Status:** **INTEGRATED** [COMMITTED]
- **Evidence:** `DocumentIntelligenceOrchestrator` validates and queries `Document` records under RLS. `uploadOCRDocumentAction` creates `Document` rows.

### Stage 2: DocumentVersion
- **Schema Model:** `DocumentVersion` (`document_versions`) — `filePath`, `checksumSha256`, `mimeType`.
- **Status:** **PARTIALLY INTEGRATED** [COMMITTED]
- **Evidence:** Queried and verified in `DocumentIntelligenceOrchestrator`. Physical object storage and real SHA-256 calculation planned for Phase 4K.

### Stage 3: OCR / Extraction
- **Schema Model:** `OCRExtraction` (`ocr_extractions`) — `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), `rawJson`.
- **Status:** **INTEGRATED INTO ORCHESTRATOR** [COMMITTED]
- **Evidence:** `DocumentIntelligenceOrchestrator` handles extraction records and supports metadata item ingestion.

### Stage 4: ExtractedItem
- **Schema Model:** `ExtractedItem` (`extracted_items`) — raw student and generic fields.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** `DocumentIntelligenceOrchestrator` iterates over extracted items, maps to `ProcessedExtractedItem` schema, and tracks field confidence.

### Stage 5: Identity Resolution
- **Status:** **FULLY INTEGRATED** [COMMITTED]
- **Evidence:**
  - `DocumentIntelligenceOrchestrator` performs identity matching against master `Student` and `Employee` registries.
  - Generates structured `IdentityResolutionOutcome` (`RESOLVED`, `AMBIGUOUS`, `UNRESOLVED`).
  - Flags low confidence and unmapped items for human review.

### Stage 6: Validation
- **Status:** **INTEGRATED VIA VALIDATION ENGINE** [COMMITTED]
- **Evidence:** `DocumentIntelligenceOrchestrator` executes domain validation rules (`ocrItemValidationEngine`) on each item.

### Stage 7: Exception
- **Schema Model:** `ExceptionItem` (`exception_items`) — `workflowInstanceId`, `ruleCode`, `severity`, `status`.
- **Status:** **FULLY INTEGRATED (CRUD + Transition + Audit + Bridge)** [COMMITTED]
- **Evidence:**
  - `PostgresExceptionRepository` (`findManyTx`, `findByIdTx`, `createTx`, `updateStatusTx`).
  - Validation failures and anomalies automatically create `ExceptionItem` rows via `createFromValidationResultsTx`.
  - Server actions: `getExceptionsAction`, `createExceptionAction`, `updateExceptionStatusAction`.

### Stage 8: Human Verification
- **Schema Model:** `HumanVerification` (`human_verifications`) — `targetEntityType`, `targetEntityId`, `decision`.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** Created during `verifyExtractedItemAction` in the Student pipeline.

### Stage 9: Audit
- **Schema Model:** `AuditEvent` (`audit_events`) — `actorUserId`, `action`, `entityType`, `entityId`, `payloadJson`.
- **Status:** **IMPLEMENTED** [COMMITTED]
- **Evidence:** `DocumentIntelligenceOrchestrator` records atomic audit event (`PROCESS_DOCUMENT_INTELLIGENCE`) via `PostgresAuditEventRepository.recordTx`.

---

## Orchestration Summary

The concrete service `DocumentIntelligenceOrchestrator` is implemented in `src/platform/services/document-intelligence.ts` fulfilling `IDocumentIntelligenceOrchestrator`, verified with 43/43 automated tests covering validation, exception generation, cross-tenant isolation, and audit persistence.
