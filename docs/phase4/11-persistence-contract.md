# 11 - Persistence Contract & Domain Ownership Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Persistence Contracts, Aggregate Definitions & Domain Boundaries  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Aggregate Roots & Entity Classification

Arsitektur platform diklasifikasikan ke dalam **Aggregate Roots**, **Internal Entities**, **Value Objects**, dan **Derived Read Models**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PLATFORM CORE AGGREGATES                           │
│  [Tenant] (AR) │ [UserActor] (AR) │ [Document] (AR) │ [AuditEvent] (AR)      │
│  [ExceptionItem] (AR) │ [WorkflowInstance] (AR)                             │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│   EMPLOYEE DOMAIN AGGREGATES         │   │   STUDENT DOMAIN AGGREGATES      │
│ [Employee] (AR)                      │   │ [Student] (AR)                   │
│ [AwardProposal] (AR)                 │   │ [AbsenceRecord] (AR)             │
│   ├── AwardProposalDocument (Entity) │   │ [OCRExtraction] (AR)             │
│   └── AwardChecklist (Value Object)  │   │   └── ExtractedItem (Entity)     │
└──────────────────────────────────────┘   └──────────────────────────────────┘
```

### Classification Taxonomy:

| Category | Entities | Storage Character |
|---|---|---|
| **Aggregate Root (AR)** | `Tenant`, `UserActor`, `Document`, `Employee`, `AwardProposal`, `Student`, `AbsenceRecord`, `OCRExtraction`, `WorkflowInstance`, `ExceptionItem`, `AuditEvent` | Persisted, independently queryable, transaction boundary holder. |
| **Internal Child Entity** | `DocumentVersion`, `AwardProposalDocument`, `ExtractedItem`, `WorkflowTransition` | Owned exclusively by their parent Aggregate Root; deleted/mutated via Aggregate Root. |
| **Value Object (VO)** | `AwardChecklist`, `EmployeeInfo`, `ValidationResult`, `Severity` | Immutable data structures without independent identity. |
| **Derived Read Model** | `OperationalMetrics`, `WorkQueueItem`, `StudentAbsenceExportRow` | Non-authoritative, dynamically computed from Primary Source of Truth tables. |

---

## 2. Platform Core vs. Domain Module Separation

### A. Dedicated to Platform Core (Domain-Agnostic Infrastructure)
Platform Core Engines **TIDAK BOLEH BERISI ATURAN BISNIS DOMAIN** (misal: SE BKD No. 22/SE/2026 atau Dapodik Rules):

1. **`Tenant` & `UserActor`**: Manajemen organisasi dan identitas pengoperasi.
2. **`Document` & `DocumentVersion`**: Pengelolaan file biner, storage key, SHA-256 integrity, dan versi file.
3. **`WorkflowInstance` & `WorkflowTransition`**: Engine penjejak state machine generik.
4. **`PlatformValidationEngine`**: Evaluator generik untuk mendaftarkan dan mengeksekusi kumpulan aturan.
5. **`ExceptionItem` (Exception Queue)**: Antrean pusat pengelolaan kegagalan aturan / verifikasi.
6. **`AuditEvent`**: Log jejak audit platform yang mutlak *Append-Only*.

### B. Dedicated to Domain Modules (Domain-Specific Business Logic)
Seluruh aturan regulasi dan pemodelan bisnis spesifik dikapsulasi di dalam modul domain masing-masing:

- **`domains/employee/awards/`**: Aturan SE BKD No. 22/SE/2026, perhitungan masa kerja CPNS, penentuan jenjang Satyalancana (X, XX, XXX), checklist berkas SK CPNS/PNS/SKP.
- **`domains/student/`**: Format NISN 10-digit, threshold confidence score OCR (70%), penentuan status Sakit/Izin/Alpha, matching data Dapodik.

---

## 3. Ownership Boundaries & Deletion Rules

1. **`Document` Ownership**:
   - Jika `Document` dihapus, seluruh `DocumentVersion` milik dokumen tersebut wajib **Cascade Delete**.
   - Jika `Document` dihubungkan ke `AwardProposalDocument` atau `AbsenceRecord`, penghapusan `Document` diblokir (**Restrict Foreign Key**).

2. **`OCRExtraction` Ownership**:
   - `OCRExtraction` memiliki `ExtractedItem[]`. Jika header `OCRExtraction` dihapus, seluruh `ExtractedItem` anak wajib **Cascade Delete**.

3. **`AbsenceRecord` Independence**:
   - `AbsenceRecord` yang telah tercipta dari hasil *Human Verification* berdiri secara independen. Penghapusan `OCRExtraction` asal **TIDAK BOLEH MENGHAPUS `AbsenceRecord`** yang sudah sah terverifikasi.
