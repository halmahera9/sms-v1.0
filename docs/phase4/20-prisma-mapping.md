# 20 - Prisma Schema Mapping Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Prisma Model & Attribute Mapping Specification  
**Status**: SPECIFICATION & DATA DEFINITION MAPPING  

---

## 1. Overview & Prisma Model Architecture

File [`prisma/schema.prisma`](file:///d:/banyubiru-next/prisma/schema.prisma) memetakan 15 entitas platform ke dalam model ORM Prisma PostgreSQL resmi:

```
[Tenant] ───► [UserActor]
   │                 │
   ├──► [Employee] ──┼──► [AwardProposal] ──► [AwardProposalDocument] ──► [Document] ──► [DocumentVersion]
   │                 │                                                         │
   ├──► [Student] ───┼──► [AbsenceRecord] ◄─────────────────────────────────────┘
   │                 │         ▲
   │                 │         │ (Promoted on Verification)
   │                 │   [ExtractedItem] ◄── [OCRExtraction]
   │                 │
   ├──► [WorkflowInstance] ──► [WorkflowTransition]
   ├──► [ExceptionItem]
   └──► [AuditEvent] (Append-Only Ledger)
```

---

## 2. Model & Relation Mapping Table

| Model Prisma | Database Table (`@@map`) | Primary Key | Relation References & Cascades | Uniqueness Constraints |
|---|---|---|---|---|
| **`Tenant`** | `tenants` | `id` (UUID) | Has many `UserActor`, `Employee`, `Student`, `Document`, `WorkflowInstance`, `ExceptionItem`, `AuditEvent`. | `@@unique([code])` |
| **`UserActor`** | `user_actors` | `id` (UUID) | Belongs to `Tenant` (Cascade Delete). Has many `WorkflowTransition`, `AbsenceRecord`, `AuditEvent`. | `@@unique([tenantId, username])` |
| **`Employee`** | `employees` | `id` (UUID) | Belongs to `Tenant` (Cascade). Has many `AwardProposal`. | `@@unique([tenantId, nip])`, `@@unique([tenantId, nrk])` |
| **`AwardProposal`** | `employee_award_proposals` | `id` (UUID) | Belongs to `Tenant` (Cascade), `Employee` (Restrict). Has many `AwardProposalDocument`. | `@@unique([tenantId, employeeId, jenisPenghargaan, tahunUsulan])` |
| **`AwardProposalDocument`**| `award_proposal_documents` | `id` (UUID) | Belongs to `AwardProposal` (Cascade), `Document` (Restrict). | `@@unique([proposalId, documentType])` |
| **`Student`** | `students` | `id` (UUID) | Belongs to `Tenant` (Cascade). Has many `AbsenceRecord`, `ExtractedItem`. | `@@unique([tenantId, nisn])` |
| **`AbsenceRecord`** | `absence_records` | `id` (UUID) | Belongs to `Tenant` (Cascade), `Student` (Restrict), `Document` (Set Null), `UserActor` (Restrict). | Index on `(tenantId, absenceDate)` |
| **`Document`** | `documents` | `id` (UUID) | Belongs to `Tenant` (Cascade). Has many `DocumentVersion`, `AwardProposalDocument`, `OCRExtraction`. | Index on `(tenantId, category)` |
| **`DocumentVersion`** | `document_versions` | `id` (UUID) | Belongs to `Document` (Cascade), `UserActor` (Restrict). | `@@unique([documentId, versionNumber])` |
| **`OCRExtraction`** | `ocr_extractions` | `id` (UUID) | Belongs to `Tenant` (Cascade), `Document` (Cascade). Has many `ExtractedItem`. | Index on `(tenantId, status)` |
| **`ExtractedItem`** | `extracted_items` | `id` (UUID) | Belongs to `OCRExtraction` (Cascade), `Student` (Set Null), `AbsenceRecord` (Set Null). | `@@unique([absenceRecordId])` |
| **`WorkflowInstance`** | `workflow_instances` | `id` (UUID) | Belongs to `Tenant` (Cascade). Has many `WorkflowTransition`. | `@@unique([entityType, entityId])` |
| **`WorkflowTransition`** | `workflow_transitions` | `id` (UUID) | Belongs to `WorkflowInstance` (Cascade), `UserActor` (Restrict). | Index on `(workflowInstanceId)` |
| **`ExceptionItem`** | `exception_items` | `id` (UUID) | Belongs to `Tenant` (Cascade), `UserActor` (Set Null). | Index on `(tenantId, status)` |
| **`AuditEvent`** | `audit_events` | `id` (UUID) | Belongs to `Tenant` (Cascade), `UserActor` (Restrict). | Index on `(tenantId, createdAt)` |
