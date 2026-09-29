# BANYUBIRU — P0 Audit Report
## School Document Intelligence Platform

**Branch:** `main` | **Status:** Clean, up-to-date with origin  
**Stack:** Next.js 16.3.1 · React 19 · Prisma 7 · PostgreSQL · TailwindCSS v4  
**Audit Date:** 2026-09-29

---

## 1. Current Architecture

```
sms-v1.0/
├── prisma/
│   ├── schema.prisma          (617 lines, 18 models)
│   └── migrations/            (10 migration files)
├── src/
│   ├── app/                   (Next.js App Router)
│   │   ├── page.tsx           → redirect to /app (NO landing page)
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── upload/[token]/    → public upload portal
│   │   ├── api/
│   │   │   ├── documents/[id]/file/route.ts    → file retrieval
│   │   │   ├── internal/document-processing/  → internal job trigger
│   │   │   └── public/upload/route.ts          → public upload endpoint
│   │   └── app/               → authenticated app shell
│   │       ├── layout.tsx     (sidebar + header)
│   │       ├── page.tsx       → dashboard
│   │       ├── ocr/           → upload + OCR
│   │       ├── verify/        → verification UI
│   │       ├── students/      → student master
│   │       ├── employees/     → employee master
│   │       ├── export/        → Excel/PDF export
│   │       └── audit/         → audit trail
│   ├── components/
│   │   ├── app/Sidebar.tsx
│   │   ├── landing/           → Header, Hero, Sections (UNUSED - root redirects to /app)
│   │   ├── documents/DocumentGenerator.tsx
│   │   ├── candidates/        → CandidateDetailModal, CandidateList
│   │   ├── dashboard/DashboardOverview.tsx
│   │   ├── import/ExcelImporter.tsx
│   │   ├── public/PublicDocumentUploadForm.tsx
│   │   ├── layout/Header.tsx
│   │   └── settings/SettingsManager.tsx
│   ├── domains/
│   │   ├── document/invitation/  → PublicUploadInvitation logic
│   │   ├── employee/awards/      → AwardProposal full domain
│   │   └── student/              → Student types, rules, export, workflow
│   ├── platform/
│   │   ├── actions/              → Server Actions (auth, student, employee, ocr, export, audit, etc.)
│   │   ├── auth/                 → session, guards, RBAC
│   │   ├── audit/engine.ts
│   │   ├── db/                   → prisma.ts, tenant-context.ts
│   │   ├── exceptions/queue.ts
│   │   ├── repositories/         → 10+ repository files
│   │   ├── rules/engine.ts
│   │   ├── services/             → 13 service files
│   │   ├── storage/              → filesystem, in-memory, S3-ready provider
│   │   ├── types/                → domain type definitions
│   │   ├── ui/                   → UnifiedDashboard, Navigation, WorkQueue, etc.
│   │   └── workflow/engine.ts
│   ├── lib/
│   └── types/sms.ts
└── tests/                    (48 test files)
```

### Key Technical Patterns
- **Multi-tenant PostgreSQL RLS** via `set_tenant_context()` PL/pgSQL function
- **Session-based auth** via encrypted cookie (`AUTH_SECRET`)
- **Provider-agnostic storage** (`IObjectStorageProvider` interface — filesystem today, S3-ready)
- **Provider-agnostic AI extraction** (`IDocumentExtractor` interface)
- **Tesseract OCR** (local, `ind+eng` language)
- **Gemini AI extraction** (optional, provider-agnostic via `IDocumentExtractor`)
- **Canonical document model**: `Document` → `DocumentVersion` → `DocumentProcessingJob`
- **Audit trail** via `AuditEvent` table with actor + entity tracking

---

## 2. Current Feature Inventory

### Routes / Pages
| Route | Description | Legacy Domain |
|-------|-------------|---------------|
| `/` | Redirect to `/app` (no landing page!) | — |
| `/login` | Login page | ✅ OK |
| `/app` | Dashboard (metrics: siswa, pegawai, dokumen, verifikasi) | Partial |
| `/app/ocr` | Upload + OCR pipeline (absence document focused) | **ABSENCE** |
| `/app/verify` | Verification UI (absence-focused) | **ABSENCE** |
| `/app/students` | Student master data + Dapodik import | ✅ OK (core) |
| `/app/employees` | Employee master + Dapodik import | ✅ OK (core) |
| `/app/export` | Excel/PDF export (absence-focused) | **ABSENCE** |
| `/app/audit` | Audit trail viewer | ✅ OK |
| `/upload/[token]` | Public document upload portal | ✅ EXCELLENT |

### API Routes
| Route | Description |
|-------|-------------|
| `GET /api/documents/[id]/file` | Authenticated file retrieval (secure, tenant-isolated) |
| `POST /api/internal/document-processing` | Internal processing job trigger |
| `POST /api/public/upload` | Public upload endpoint (token-validated) |

### Services
| Service | Description |
|---------|-------------|
| `DocumentIntelligenceOrchestrator` | Full pipeline: OCR → classify → extract → match → validate → exception |
| `DocumentProcessingJobRunner` | Async job claiming, execution, retry with backoff |
| `DocumentProcessingWorker` | Worker wrapper for job runner |
| `TesseractLocalOcrEngine` | Local Tesseract OCR (ind+eng) |
| `GeminiDocumentExtractor` | AI extraction via Gemini API |
| `LocalOcrGeminiDocumentExtractor` | Hybrid: Tesseract OCR → Gemini interpretation |
| `HybridDocumentExtractor` | Factory: picks best extractor per MIME |
| `PdfPageRenderer` | PDF → image (for Tesseract) |
| `DocumentClassifier` | Classifies document type from raw text |
| `DocumentEntityExtractor` | Extracts entities from classified document |
| `DocumentIdentityMatcher` | Fuzzy match entities to Student/Employee |
| `DapodikImport` | Excel import (student + employee) |

### Database Models (18 total)
| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant root |
| `UserActor` | Users with roles |
| `Employee` | Employee master data |
| `AwardProposal` | **Employee award proposals (LEGACY DOMAIN)** |
| `AwardProposalDocument` | **Award documents (LEGACY DOMAIN)** |
| `Student` | Student master data |
| `AbsenceRecord` | **Student absence records (LEGACY DOMAIN)** |
| `OCRExtraction` | OCR results (tied to absence workflow) |
| `ExtractedItem` | Extracted items (tightly coupled to absence+NISN) |
| `Document` | Canonical document |
| `DocumentVersion` | File versions with checksum |
| `HumanVerification` | Human verification decisions |
| `WorkflowInstance` | Workflow state machine |
| `WorkflowTransition` | Workflow state transitions |
| `ValidationResult` | Validation rule results |
| `ExceptionItem` | Exception queue |
| `AuditEvent` | Full audit trail |
| `PublicUploadInvitation` | Secure public upload token (hashed) |
| `DocumentProcessingJob` | Async processing job queue |

---

## 3. Features ALIGNED With P0 (KEEP)

### Infrastructure
- ✅ Multi-tenant PostgreSQL RLS (`runInTenantContext`)
- ✅ Session-based authentication (`loginAction`, `getAuthenticatedActorContext`)
- ✅ RBAC authorization (`assertAuthorizedAction`, `PLATFORM_RBAC_REGISTRY`)
- ✅ Audit trail engine (`AuditEvent`, `PostgresAuditEventRepository`)
- ✅ Exception queue (`ExceptionItem`, `PostgresExceptionRepository`)
- ✅ Validation rule engine (`rules/engine.ts`)
- ✅ Workflow state machine (`WorkflowInstance`, `WorkflowTransition`)

### Document Intelligence Pipeline
- ✅ `IDocumentExtractor` interface (provider-agnostic)
- ✅ `TesseractLocalOcrEngine` (Tesseract baseline, ind+eng)
- ✅ `GeminiDocumentExtractor` (Gemini provider, behind interface)
- ✅ `LocalOcrGeminiDocumentExtractor` (hybrid: local OCR → AI interpretation)
- ✅ `HybridDocumentExtractor` (factory, MIME-based routing)
- ✅ `PdfPageRenderer` (PDF → image rasterization for Tesseract)
- ✅ `DocumentIntelligenceOrchestrator` (orchestration pipeline)
- ✅ `DocumentProcessingJobRunner` + `DocumentProcessingWorker` (async job queue)
- ✅ Document Classifier + Entity Extractor + Identity Matcher (services)

### Canonical Data Model
- ✅ `Document` + `DocumentVersion` (canonical document structure)
- ✅ `DocumentProcessingJob` (processing job queue)
- ✅ `PublicUploadInvitation` (secure token, hashed, expiry, max attempts)
- ✅ `HumanVerification` (human-in-the-loop decisions)
- ✅ `Tenant`, `UserActor` (multi-tenant identity)
- ✅ `Student` (student master)
- ✅ `Employee` (employee master)
- ✅ `ValidationResult` (per-entity validation results)
- ✅ `ExceptionItem` (exception management)
- ✅ `AuditEvent` (complete audit trail)

### Object Storage
- ✅ `IObjectStorageProvider` interface
- ✅ `FileSystemObjectStorageProvider` (local filesystem, production-ready)
- ✅ `InMemoryObjectStorageProvider` (test isolation)
- ✅ `buildDocumentStoragePath` (canonical path structure, tenant-isolated)

### Auth & Security
- ✅ `PublicUploadInvitation` — hashed token storage (SHA-256), never raw
- ✅ `api/public/upload` — token-validated, server-controlled binding
- ✅ `api/documents/[id]/file` — authenticated, tenant-isolated file retrieval
- ✅ MIME validation, file size limits, safe filename patterns
- ✅ `tenant-context.ts` — transaction-scoped RLS via PostgreSQL GUC

### UI (Partial)
- ✅ Login page (clean, functional)
- ✅ Sidebar (collapsible on mobile)
- ✅ App shell layout (header + sidebar)
- ✅ Public upload portal (`/upload/[token]`)
- ✅ Audit trail page
- ✅ Student master page
- ✅ Employee master page

---

## 4. Features UNRELATED to P0 Document Intelligence (REMOVE / DEPRECATE)

### A. Employee Award Proposal Domain — REMOVE
**Domain:** `domains/employee/awards/`  
This is a **full award/penghargaan proposal workflow** for government employees — completely unrelated to School Document Intelligence.

Files to remove:
- `src/domains/employee/awards/actions.ts`
- `src/domains/employee/awards/prisma-repository.ts`
- `src/domains/employee/awards/repository.ts`
- `src/domains/employee/awards/rules.ts`
- `src/domains/employee/awards/service.ts`
- `src/domains/employee/awards/types.ts`
- `src/domains/employee/awards/workflow.ts`

### B. Student Absence Workflow — REFACTOR
The existing OCR workflow is **tightly coupled to absence record tracking** — not generic document intelligence. The `ExtractedItem` model has hardcoded `studentNameRaw`, `nisnRaw`, `absenceDateRaw`, `absenceTypeRaw` fields. The `OCRExtraction` model is linked specifically to absence, not to generic document processing.

This needs to be **redesigned**, not just refactored.

Key debt files:
- `src/app/app/ocr/page.tsx` — absence upload UI, not generic
- `src/app/app/verify/page.tsx` — absence verification UI, not generic
- `src/app/app/export/page.tsx` — absence export only
- `src/platform/actions/student-workflow.ts` — 848 lines, fully absence-specific
- `src/domains/student/types.ts` — `AbsenceStatus`, `OCRDocument`, absence-specific
- `src/domains/student/rules.ts` — absence OCR item validation rules
- `src/domains/student/workflow.ts` — absence workflow
- `src/domains/student/export.ts` — absence Excel export
- `src/domains/student/mappers.ts` — absence mappers

### C. Student Absence Export — REMOVE (for now)
- `src/app/app/export/page.tsx` — absence-specific
- `src/platform/actions/student-export.ts` — absence-specific
- `src/domains/student/export.ts` — absence-specific
- Dependencies: `jspdf`, `jspdf-autotable`, `xlsx` (may keep xlsx for future import)

### D. Legacy Landing Page Components — REPLACE
Existing landing components exist but **root `/` redirects directly to `/app`** — no landing page is rendered.
- `src/components/landing/Header.tsx` — dark theme, SMS branding, replace
- `src/components/landing/Hero.tsx` — TBD
- `src/components/landing/Sections.tsx` — TBD

### E. Unused / Orphaned Components
- `src/components/candidates/CandidateDetailModal.tsx` — candidate management (award domain)
- `src/components/candidates/CandidateList.tsx` — award domain
- `src/components/documents/DocumentGenerator.tsx` — document generation (not P0)
- `src/components/dashboard/DashboardOverview.tsx` — unclear if used
- `src/components/import/ExcelImporter.tsx` — may be award import
- `src/components/layout/Header.tsx` — unclear if used
- `src/components/settings/SettingsManager.tsx` — settings (not P0, but useful later)
- `src/platform/ui/UnifiedAuditFeed.tsx` — unified feed UI
- `src/platform/ui/UnifiedDashboard.tsx` — unified dashboard
- `src/platform/ui/UnifiedExceptionCenter.tsx` — exception center
- `src/platform/ui/UnifiedNavigation.tsx` — navigation
- `src/platform/ui/UnifiedWorkQueue.tsx` — work queue

### F. Dead/Scratch Files at Root
- `test-pg-query.ts`, `test-pg.ts`, `test-prisma-query.ts`, `test-prisma.ts` — scratch test scripts at root (not in tests/)

---

## 5. KEEP — Code That Can Be Reused As-Is

| Code | Reuse As |
|------|----------|
| `platform/auth/` | Auth system (session, guards, RBAC) |
| `platform/db/` | Prisma + tenant context |
| `platform/audit/engine.ts` | Audit engine |
| `platform/exceptions/queue.ts` | Exception queue |
| `platform/rules/engine.ts` | Validation rule engine |
| `platform/workflow/engine.ts` | Workflow state machine |
| `platform/storage/` | Object storage (all files) |
| `platform/repositories/audit-event.ts` | Audit repository |
| `platform/repositories/exception.ts` | Exception repository |
| `platform/repositories/document.ts` | Document repository |
| `platform/repositories/document-version.ts` | DocumentVersion repository |
| `platform/repositories/student.ts` | Student repository |
| `platform/repositories/employee.ts` | Employee repository |
| `platform/repositories/operational-query.ts` | Operational metrics |
| `platform/repositories/tenant-repository.ts` | Tenant repository |
| `platform/repositories/user-actor.ts` | UserActor repository |
| `platform/services/local-ocr-engine.ts` | Tesseract OCR engine |
| `platform/services/pdf-page-renderer.ts` | PDF rasterizer |
| `platform/services/gemini-document-extractor.ts` | Gemini extractor |
| `platform/services/local-ocr-gemini-document-extractor.ts` | Hybrid extractor |
| `platform/services/hybrid-document-extractor.ts` | Extractor factory |
| `platform/services/document-extractor.ts` | Extractor factory entry point |
| `platform/services/document-processing-runner.ts` | Job runner |
| `platform/services/document-processing-worker.ts` | Worker |
| `platform/services/document-classifier.ts` | Document classifier |
| `platform/services/document-entity-extractor.ts` | Entity extractor |
| `platform/services/document-identity-matcher.ts` | Identity matcher |
| `platform/services/document-intelligence.ts` | Pipeline orchestrator (needs refactor for generic extraction) |
| `platform/types/document-extractor.ts` | Extractor interface |
| `platform/types/document-intelligence.ts` | Intelligence types |
| `platform/types/document-processing.ts` | Processing types |
| `domains/document/invitation/` | Public upload invitation (all files — excellent) |
| `domains/student/repository.ts` | Student repo (domain layer) |
| `app/login/page.tsx` | Login page (mostly fine, minor branding) |
| `app/upload/[token]/page.tsx` | Public upload page (excellent) |
| `components/public/PublicDocumentUploadForm.tsx` | Public upload form |
| `app/api/documents/[id]/file/route.ts` | Document file retrieval |
| `app/api/public/upload/route.ts` | Public upload API |
| `app/api/internal/document-processing/route.ts` | Internal job trigger |

---

## 6. REMOVE — Code That Should Be Removed

> **Do NOT delete without dependency audit first.**

### Priority 1 — Remove Cleanly (no downstream dependencies expected)
| File | Reason |
|------|--------|
| `src/domains/employee/awards/` (all 7 files) | Award proposal domain, not P0 |
| `src/app/app/export/page.tsx` | Absence export, not generic |
| `src/platform/actions/student-export.ts` | Absence export action |
| `src/domains/student/export.ts` | Absence export logic |
| `test-pg-query.ts`, `test-pg.ts`, `test-prisma-query.ts`, `test-prisma.ts` | Scratch test scripts at root |
| `src/components/candidates/` | Award proposal candidate management |

### Priority 2 — Refactor Before Remove
| File | Reason |
|------|--------|
| `src/app/app/ocr/page.tsx` | Replace with generic Document Intake |
| `src/app/app/verify/page.tsx` | Replace with generic Verification UI |
| `src/platform/actions/student-workflow.ts` | 848-line absence-specific action — decompose |
| `src/domains/student/rules.ts` | Absence-specific OCR validation rules |
| `src/domains/student/workflow.ts` | Absence workflow |
| `src/domains/student/mappers.ts` | Absence mappers |
| `src/domains/student/types.ts` | Extend for generic document intelligence |
| `src/components/documents/DocumentGenerator.tsx` | Document generation, not P0 |

### Priority 3 — Deprecate (Keep But Clearly Mark)
| File | Reason |
|------|--------|
| `src/platform/services/dapodik/dapodik-import.ts` | Keep for data import, but demote from P0 priority |
| `src/platform/actions/dapodik-import.ts` | Same |
| `src/components/settings/SettingsManager.tsx` | Useful in P0-E but needs redesign |
| `src/platform/ui/Unified*.tsx` | Platform-level unified UI — may be reusable but currently unused |
| `src/components/import/ExcelImporter.tsx` | May be needed for Dapodik import later |

---

## 7. Database Impact

### Models to KEEP As-Is
| Model | Rationale |
|-------|-----------|
| `Tenant` | Core multi-tenant |
| `UserActor` | Auth |
| `Student` | P0 school data |
| `Employee` | P0 school data |
| `Document` | Core canonical doc |
| `DocumentVersion` | Core canonical doc version |
| `DocumentProcessingJob` | Core async pipeline |
| `PublicUploadInvitation` | Core P0 feature |
| `HumanVerification` | Core verification |
| `WorkflowInstance` + `WorkflowTransition` | Core workflow |
| `ValidationResult` | Core validation |
| `ExceptionItem` | Core exception handling |
| `AuditEvent` | Core audit trail |

### Models to REFACTOR
| Model | Issue | Action |
|-------|-------|--------|
| `OCRExtraction` | Tied to `Document` but `ExtractedItem` is absence-specific | Keep `OCRExtraction`, redesign `ExtractedItem` |
| `ExtractedItem` | Has `studentNameRaw`, `nisnRaw`, `absenceDateRaw`, `absenceTypeRaw` — absence-specific hardcoded schema | **Replace with generic `DocumentField` model** |
| `DocumentCategory` enum | Has `SK_CPNS`, `SK_PNS`, `SK_JABATAN`, `SKP_2_TAHUN`, etc. — all employee-award specific | **Replace with generic document categories (KK, KTP, AKTA, IJAZAH, etc.)** |

### Models to DEPRECATE / REMOVE
| Model | Issue | Action |
|-------|-------|--------|
| `AwardProposal` | Award domain, not P0 | **REMOVE** after dependency audit |
| `AwardProposalDocument` | Award domain | **REMOVE** |
| `AbsenceRecord` | Absence tracking, not document intelligence | **DEPRECATE** — move to future `StudentAbsence` domain if needed |

> ⚠️ **CRITICAL**: `Document` model has FK to `AwardProposalDocument`. `AbsenceRecord` has FK to `Document`. `ExtractedItem` has FK to `AbsenceRecord`. These create a dependency chain. Must audit before removal.

### Enums to Replace/Extend
| Enum | Issue |
|------|-------|
| `DocumentCategory` | All values are employee-award specific (`SK_CPNS`, `SK_PNS`, etc.) — needs to be replaced with school document categories |
| `AbsenceStatus` | Absence-specific, remove with `AbsenceRecord` |
| `StudentAbsenceWorkflowState` | Absence-specific |

---

## 8. Routes / Pages Impact

| Route | Current State | P0 Target |
|-------|---------------|-----------|
| `/` | Redirects to `/app` | **New landing page** |
| `/login` | ✅ Functional | Minor branding update |
| `/app` | Dashboard (absence-centric) | Rebuild: "Needs Attention" first |
| `/app/documents` | **MISSING** | P0-F: Document Intake |
| `/app/documents/[id]` | **MISSING** | P0-F: Document Detail |
| `/app/ocr` | Absence-specific | Replace: generic OCR results |
| `/app/verify` | Absence-specific | Replace: generic Verification |
| `/app/students` | ✅ OK | Minor polish |
| `/app/employees` | ✅ OK | Minor polish |
| `/app/export` | Absence export | Remove/defer |
| `/app/audit` | ✅ OK | Keep |
| `/app/exceptions` | **MISSING** | P0 exception center |
| `/app/settings` | **MISSING** | P0-E: School configuration |
| `/upload/[token]` | ✅ Excellent | Keep as-is |

---

## 9. Test Impact

### Tests to KEEP (53% of 48 tests)
| Test File | Reason |
|-----------|--------|
| `public-upload-invitation.test.ts` | Core P0 feature |
| `public-upload-submission.test.ts` | Core P0 feature |
| `public-upload-route.test.ts` | Core P0 feature |
| `public-upload-post-commit-orchestration.test.ts` | Core P0 feature |
| `document-processing-job-runner.test.ts` | Core pipeline |
| `document-processing-job-runner-integration.test.ts` | Core pipeline |
| `document-processing-worker.test.ts` | Core pipeline |
| `document-processing-trigger.test.ts` | Core pipeline |
| `document-intelligence-orchestrator.test.ts` | Core pipeline |
| `document-extractor-factory.test.ts` | Core pipeline |
| `gemini-document-extractor.test.ts` | Core AI extractor |
| `local-ocr-engine.test.ts` | Core OCR |
| `pdf-page-renderer.test.ts` | Core OCR |
| `local-ocr-gemini-document-extractor.test.ts` | Core pipeline |
| `object-storage.test.ts` | Core storage |
| `document-classifier.test.ts` | Core intelligence |
| `identity-boundary.test.ts` | Core security |
| `db-tenant-security.test.ts` | Core security |
| `audit-server-actions.test.ts` | Core audit |
| `exception-server-actions.test.ts` | Core exceptions |
| `student-server-actions.test.ts` | School data |
| `postgres-student-repository.test.ts` | School data |
| `postgres-employee-repository.test.ts` | School data |
| `postgres-document-repository.test.ts` | Core document |

### Tests to REMOVE (award/absence domain — ~35% of tests)
| Test File | Reason |
|-----------|--------|
| `award-proposal-*.test.ts` (6 files) | Award domain, remove with domain |
| `award-client-migration.test.ts` | Award migration |
| `student-ocr-server-actions.test.ts` | Absence OCR |
| `student-ocr-workflow.test.ts` | Absence workflow |
| `student-excel-export.test.ts` | Absence export |
| `student-export-server-actions.test.ts` | Absence export |
| `dapodik-import-server-actions.test.ts` | Defer (keep Dapodik import but low priority) |
| `live-session-provider.test.ts` | Investigate — may be platform-level |
| `exception-client-migration.test.ts` | Migration test |
| `client-operational-migration.test.ts` | Migration test |
| `student-client-migration.test.ts` | Migration test |

### Tests to REFACTOR
| Test File | Reason |
|-----------|--------|
| `audit-event-repository.test.ts` | Keep but may need update |
| `exception-repository.test.ts` | Keep but refine for new exception types |
| `operational-server-actions.test.ts` | Keep, refine metrics |
| `operational-query-repository.test.ts` | Keep, refine metrics |
| `postgres-repository.test.ts` | Keep, review |
| `phase1-platform.test.ts` | Review what's in here |
| `phase2-student-platform.test.ts` | Review — may be absence-specific |

---

## 10. P0 Target Architecture

```
BANYUBIRU — School Document Intelligence Platform
├── Public
│   ├── Landing Page (/)
│   └── Public Upload Portal (/upload/[token])
│
├── Auth
│   ├── Login (/login)
│   └── Session (cookie-based, role-based)
│
└── App (/app/*)
    ├── Dashboard              → "Needs Attention" first, then metrics
    ├── Documents
    │   ├── Intake             → upload, drag-drop, batch, status
    │   ├── List               → search, filter, category
    │   └── Detail [id]        → OCR result, extraction, verification
    ├── Verification           → human review queue
    ├── Exceptions             → exception center
    ├── School Data
    │   ├── Students           → master, import Dapodik
    │   └── Employees          → master, import Dapodik
    ├── Audit Trail
    └── Settings (Administration)
        └── School Profile     → identity, signatory, doc numbering

Platform Services:
├── Auth                       (KEEP AS-IS)
├── Tenant Context (RLS)       (KEEP AS-IS)
├── Audit Engine               (KEEP AS-IS)
├── Exception Queue            (KEEP AS-IS)
├── Workflow Engine            (KEEP AS-IS)
├── Validation Rules           (KEEP — refine rules for new document types)
├── Object Storage             (KEEP AS-IS)
│
├── Document Pipeline (REFACTOR)
│   ├── Document Intake        (new generic upload action)
│   ├── OCR Engine (Tesseract) (KEEP)
│   ├── PDF Renderer           (KEEP)
│   ├── AI Extractor (Gemini)  (KEEP interface, refine prompts)
│   ├── Classifier             (KEEP, extend for new doc types)
│   ├── Entity Extractor       (KEEP, extend for KK/KTP/Akta fields)
│   ├── Identity Matcher       (KEEP, refactor to be entity-agnostic)
│   └── Orchestrator           (REFACTOR — decouple from absence domain)
│
└── Public Invitation          (KEEP AS-IS — excellent)
```

### New Database Models Needed for P0

```sql
-- Replace ExtractedItem (absence-specific) with:
DocumentField {
  id, tenantId, documentId, documentVersionId
  fieldName        -- e.g. "nama", "nik", "tanggal_lahir", "alamat"
  rawValue         -- raw OCR value
  normalizedValue  -- cleaned value
  confidence       -- 0.0-1.0
  sourceLocation   -- page, bbox coordinates (JSON)
  extractionMethod -- "tesseract", "gemini", "manual"
  modelProvider    -- "local", "gemini-2.0", etc.
  extractedAt      -- timestamp
}

-- SchoolProfile for Administration
SchoolProfile {
  id, tenantId
  schoolName, npsn
  address, phone, email, website
  logoPath
  letterhead (JSON)
  principalName, principalNip, principalTitle
  documentNumberFormat
  isActive
}
```

---

## 11. Recommended Deletion Order

> Each step requires dependency audit before execution.

1. **Root scratch files** — no dependencies  
   `test-pg*.ts`, `test-prisma*.ts` at project root

2. **Award proposal tests** (6 files + migration tests)  
   No production dependency after domain removal

3. **Award proposal domain** (`domains/employee/awards/`)  
   After: remove `AwardProposal`, `AwardProposalDocument` models

4. **Absence export** (`app/export/`, `actions/student-export.ts`, `domains/student/export.ts`)  
   Low risk — self-contained

5. **Absence OCR UI** (`app/app/ocr/`, `app/app/verify/`)  
   Replace with new Document Intake and Verification pages

6. **`student-workflow.ts` action** (848 lines)  
   Decompose: keep auth/document logic, remove absence logic

7. **`domains/student/` absence logic** (`rules.ts`, `workflow.ts`, `mappers.ts`)  
   After tests removed

8. **`OCRExtraction` + `ExtractedItem` models**  
   After new `DocumentField` model is live and backfill complete

9. **`AbsenceRecord` model**  
   Last — check all FK relations first

10. **`DocumentCategory` enum** — replace with new enum  
    Careful: FK used in `Document.category` and `PublicUploadInvitation.documentCategory`

11. **Unused components** (`candidates/`, `documents/DocumentGenerator.tsx`)  
    After confirming no import anywhere

---

## 12. Recommended Implementation Order (P0 Phases)

### P0-A: Architecture & Audit ← WE ARE HERE
- ✅ Audit report complete

### P0-B: Remove Legacy
- Remove award proposal domain (`domains/employee/awards/`)
- Remove award proposal tests
- Remove absence export
- Remove scratch test files at root
- Remove orphaned candidate components
- Prisma migration: drop `AwardProposal`, `AwardProposalDocument` tables

### P0-C: New Design System + Landing Page
- Replace `src/app/globals.css` with new design system
- Build landing page at `/` (currently redirects to `/app`)
- Update header/footer components
- No database changes

### P0-D: Authentication + Application Shell
- Update login page branding
- Rebuild sidebar with new P0 navigation structure
- Update app layout (collapsible sidebar)
- Update dashboard to "Needs Attention" pattern

### P0-E: School Configuration
- Schema migration: add `SchoolProfile` model
- Settings page: `/app/settings`
- School identity form (name, NPSN, address, logo)

### P0-F: Document Intake
- New `/app/documents` route (list)
- New document upload action (generic, replaces absence-specific upload)
- Support: PDF, image
- Drag-and-drop UI

### P0-G: Canonical Document + DocumentVersion
- Verify `Document` + `DocumentVersion` work for all doc types
- Fix `DocumentCategory` enum (replace with school-relevant categories)
- Update `PublicUploadInvitation.documentCategory` FK accordingly

### P0-H: OCR Pipeline
- Wire new Document Intake to existing `DocumentProcessingJobRunner`
- Verify Tesseract pipeline works end-to-end
- `/app/documents/[id]` detail page showing OCR results

### P0-I: Classification + Extraction
- Schema migration: add `DocumentField` model (replaces `ExtractedItem`)
- Extend `DocumentClassifier` for KK, KTP, Akta, Ijazah, etc.
- Extend `DocumentEntityExtractor` for relevant fields

### P0-J: Identity Matching
- Refactor `DocumentIntelligenceOrchestrator` to be entity-agnostic
- Match KK → Student (nama, NIK, tanggal lahir)
- Match SK/Surat → Employee (NIP, nama)

### P0-K: Validation
- Define validation rules for each document type
- Update `ValidationResult` usage

### P0-L: Human Verification
- Build verification queue UI (replaces absence-specific `/app/verify`)
- Show: AI extraction result + human action (approve/reject/edit)

### P0-M: Public Invitation Upload
- Already partially implemented — validate end-to-end
- Build invitation creation UI (admin side)
- Link to verification workflow

### P0-N: Processing Job
- Verify `DocumentProcessingJob` pipeline is complete
- Status tracking UI

### P0-O: Dashboard
- Rebuild dashboard: "Needs Attention" + "Recent Documents" + metrics
- Remove absence-specific metrics

### P0-P: Audit / Security Hardening
- Full security review
- Rate limiting on public endpoints
- Temp file cleanup policy

---

## 13. Critical Security Risks

### 🔴 HIGH — Active Risks

1. **`DocumentCategory` enum hardcoded in `PublicUploadInvitation`**  
   Operator must pick from `SK_CPNS`, `SK_PNS`, etc. (award categories).  
   These labels are meaningless for school documents. Risk: operator confusion → wrong category binding.

2. **`ExtractedItem.matchedStudentId` — absence FK remains in schema**  
   Processing pipeline still creates `AbsenceRecord` for matched items.  
   Untested behavior when processing non-absence documents through current pipeline.

3. **Root redirect from `/` to `/app`**  
   No landing page = no onboarding context = potential unauthorized access confusion.  
   Minor but should be addressed early.

4. **`student-workflow.ts` — 848 lines, multiple concerns**  
   Mixed: auth, OCR upload, absence creation, verification.  
   Hard to audit for security boundaries. Risk of privilege confusion.

### 🟡 MEDIUM — Technical Debt Risks

5. **`getObjectStorageProvider()` — filesystem storage in production**  
   Current production storage is local filesystem.  
   Not suitable for multi-server deployment. S3/object storage migration needed before scale.

6. **Dapodik import uses `assertAuthorizedAction(context, 'STUDENT_WRITE')`**  
   Correct for now, but the `STUDENT_WRITE` permission covers both student import AND employee import.  
   Should be split as usage grows.

7. **`DocumentIntelligenceOrchestrator` coupled to `AbsenceRecord` creation**  
   Line ~186-210 in `document-intelligence.ts` creates `OCRExtraction` and `ExtractedItem` records that are tied to the absence domain model.  
   Processing a KK or KTP document through current orchestrator would create semantically incorrect database records.

8. **`AdminPrisma` bypass used in `DocumentProcessingJobRunner`**  
   The job runner uses `adminPrisma` (bypasses RLS) for job claiming.  
   This is intentional for the job queue, but must be carefully documented and audited.

### 🟢 LOW — Best Practice Gaps

9. **Landing page components exist but are unreachable**  
   `src/components/landing/` exists but root redirects to `/app`.  
   Dead code that may cause confusion.

10. **No landing page = no public documentation of what the product does**  
    First impression for new school operators is a login form with no context.

---

## 14. Critical Technical Debt

1. **`ExtractedItem` — absence-hardcoded schema**  
   Cannot represent generic document fields (NIK, nama, tanggal lahir, alamat).  
   Needs replacement with generic `DocumentField` model.

2. **`DocumentCategory` enum — wrong vocabulary**  
   All enum values (`SK_CPNS`, `SK_PNS`, `SKP_2_TAHUN`, etc.) are for employee award domain.  
   Cannot represent school documents (KK, KTP, AKTA, IJAZAH, etc.).

3. **`DocumentIntelligenceOrchestrator` — tightly coupled to absence**  
   The orchestrator's `resolveIdentity()` method uses `item.nisnRaw` (student NISN) as primary identifier.  
   This doesn't generalize to NIK-based identity (for KK/KTP processing) or NIP-based (for employee documents).

4. **Absence-specific actions mixed with platform actions**  
   `student-workflow.ts` contains both platform-level upload logic AND absence domain logic.  
   Hard to separate without risk of regression.

5. **No document search**  
   No search functionality for documents by student name, document type, NIK, etc.  
   Critical P0 feature missing.

6. **No `SchoolProfile` model**  
   Administration section has no persistence layer for school identity, signatory, or document numbering.

7. **No `DocumentField` model**  
   Generic extraction results have no persistence home outside of the absence-specific `ExtractedItem`.

8. **Dashboard shows absence-centric metrics**  
   `totalDocumentsProcessed`, `pendingVerifications` are computed from `OCRExtraction` + `HumanVerification` in an absence context.  
   Must be rebuilt from `DocumentProcessingJob` + generic verification records.

---

## 15. First Atomic Implementation Task

**P0-B Phase 1: Remove Award Proposal Domain**

This is the safest first task because:
- Award proposal domain has zero dependency FROM other P0 features
- Removing it does NOT break any currently-working P0 feature
- It cleanly reduces scope and removes 7 domain files + 6+ test files + 2 database models
- The deletion is auditable and reversible (it's in Git)

**Exact scope:**

Step 1: Remove award-proposal tests (no production impact):
```
tests/award-proposal-actions-security.test.ts
tests/award-proposal-archive-complete.test.ts
tests/award-proposal-contract.test.ts
tests/award-proposal-document-upload.test.ts
tests/award-proposal-send.test.ts
tests/award-proposal-service.test.ts
tests/award-proposal-sign.test.ts
tests/award-client-migration.test.ts
```

Step 2: Remove award domain files:
```
src/domains/employee/awards/ (entire directory)
src/components/candidates/ (entire directory)
```

Step 3: Remove AwardProposal + AwardProposalDocument from `platform/repositories/award-proposal.ts`

Step 4: Remove award actions from `src/platform/actions/employee.ts` (or the whole file if award-only)

Step 5: Prisma migration:
```sql
DROP TABLE award_proposal_documents;
DROP TABLE award_proposals;
DROP TYPE "AwardType";
DROP TYPE "ProposalStatus";
DROP TYPE "ChecklistStatus";
```

Step 6: Update `Tenant` model in schema.prisma (remove `awardProposals`, `awardProposalDocuments` relations)

Step 7: Update `UserActor` model (remove `verifiedProposalDocuments`)

Step 8: Update `Document` model (remove `awardProposalDocuments` relation)

Step 9: Remove award-related RBAC permissions from `guards.ts`:
```
UPLOAD_DOCUMENT, VERIFY_DOCUMENT, APPROVE_GENERATION, MARK_GENERATED,
IMPORT_PROPOSALS, SIGN_PROPOSAL, SEND_PROPOSAL, ARCHIVE_COMPLETE_PROPOSAL, READ_PROPOSALS
```
(Only remove if they are exclusively award-specific, otherwise rename)

Step 10: Run full test suite to confirm no regressions.

**Expected outcome:**
- Codebase is cleaner
- Database schema is smaller and correct-scoped
- All existing P0 tests still pass
- Zero functional regression

---

## Summary Table

| Category | Count |
|----------|-------|
| Models to KEEP | 15 |
| Models to REMOVE | 2 (AwardProposal, AwardProposalDocument) |
| Models to REFACTOR | 2 (OCRExtraction, ExtractedItem) |
| New Models Needed | 2 (DocumentField, SchoolProfile) |
| Enums to Replace | 3 (DocumentCategory, AbsenceStatus, StudentAbsenceWorkflowState) |
| Routes to BUILD | 5+ (landing, documents, settings, exceptions, doc detail) |
| Routes to REPLACE | 3 (/, /app/ocr, /app/verify) |
| Tests to REMOVE | ~14 files |
| Tests to KEEP | ~25 files |
| Tests to REFACTOR | ~9 files |
| Services KEEP AS-IS | 12 |
| Services to REFACTOR | 2 (orchestrator, identity matcher) |
| Domain files to REMOVE | 7+ |

---

*Laporan ini adalah hasil audit statis. Tidak ada file yang dimodifikasi atau dihapus.*  
*Menunggu instruksi berikutnya sebelum implementasi apapun.*
