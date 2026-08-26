# 29 - Tenant Isolation Foreign Key Audit: Second-Pass Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4D Second-Pass Comprehensive Tenant Boundary & Foreign Key Audit  
**Status**: REVIEW GATE DELIVERABLE — SECOND-PASS AUDIT  

---

## 1. Executive Summary & Core Principle

Audit tahap kedua (*second-pass audit*) ini mengevaluasi seluruh relasi Foreign Key (FK) pada model yang berlingkup tenant (*tenant-scoped entities*). 

### Prinsip Utama:
> **"Optional relationship DOES NOT MEAN optional tenant boundary."**  
> *(Relasi opsional/nullable tidak boleh melonggarkan batasan tenant. Jika suatu relasi opsional diisi nilainya, entitas yang dirujuk WAJIB terbukti memiliki `tenant_id` yang persis sama di tingkat database).*

Perilaku PostgreSQL ANSI SQL pada *Composite Foreign Key* `(tenant_id, nullable_id) REFERENCES parent(tenant_id, id)` memungkinkan perlindungan ini:
1. Ketika kolom `nullable_id` bernilai `NULL`, pengecekan FK diabaikan.
2. Ketika kolom `nullable_id` diisi (*NOT NULL*), PostgreSQL secara otomatis memverifikasi bahwa pasangan `(tenant_id, nullable_id)` ada pada tabel induk. Jika `nullable_id` merujuk ke entitas milik Tenant B sedangkan record berada di Tenant A, PostgreSQL akan menolak transaksi dengan **Foreign Key Violation Error**.

---

## 2. Detailed Audit of Target Optional Relationships

### 1. `AwardProposalDocument` ➔ `UserActor` (`verifiedByUserId`)
* **Parent Tenant-Scoped?**: Ya (`UserActor` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`AwardProposalDocument` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**. (Dokumen Tenant A bisa merujuk pemverifikasi Tenant B).
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, verifiedByUserId] ➔ UserActor[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (`verifiedByUserId` bertipe `String?`).
* **Perilaku Saat Nullable**: Jika `NULL`, dokumen belum diverifikasi. Jika diisi, PostgreSQL menjamin pemverifikasi berasal dari tenant yang sama.
* **Redundansi**: Bukan redundansi, melainkan *Database-Level Tenant Security Guard*.
* **Kebutuhan Parent Constraint**: `UserActor` membutuhkan `@@unique([tenantId, id])`.
* **Prisma Validity**: Valid (`onDelete: Restrict` / `onDelete: SetNull` pada kolom nullable).
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

### 2. `AbsenceRecord` ➔ `Document` (`documentId`)
* **Parent Tenant-Scoped?**: Ya (`Document` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`AbsenceRecord` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**. (Absensi Tenant A bisa melampirkan surat izin Tenant B).
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, documentId] ➔ Document[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (`documentId` bertipe `String?`).
* **Perilaku Saat Nullable**: Jika `NULL`, absensi tanpa lampiran. Jika diisi, dokumen bukti dijamin milik tenant yang sama.
* **Redundansi**: Bukan redundansi (*Tenant Boundary Lock*).
* **Kebutuhan Parent Constraint**: `Document` membutuhkan `@@unique([tenantId, id])`.
* **Prisma Validity**: Valid (`onDelete: Restrict` / `onDelete: SetNull`).
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

### 3. `ExtractedItem` ➔ `Student` (`matchedStudentId`)
* **Parent Tenant-Scoped?**: Ya (`Student` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`ExtractedItem` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**. (Hasil OCR Tenant A bisa dicocokkan dengan siswa Tenant B).
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, matchedStudentId] ➔ Student[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (`matchedStudentId` bertipe `String?`).
* **Perilaku Saat Nullable**: Jika `NULL`, hasil OCR belum di-match. Jika diisi, siswa hasil matching dijamin dari tenant yang sama.
* **Redundansi**: Bukan redundansi (*Tenant Safety Guard*).
* **Kebutuhan Parent Constraint**: `Student` membutuhkan `@@unique([tenantId, id])`.
* **Prisma Validity**: Valid (`onDelete: Restrict` / `onDelete: SetNull`).
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

### 4. `ExtractedItem` ➔ `AbsenceRecord` (`absenceRecordId`)
* **Parent Tenant-Scoped?**: Ya (`AbsenceRecord` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`ExtractedItem` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**.
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, absenceRecordId] ➔ AbsenceRecord[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (`absenceRecordId` bertipe `String?`).
* **Perilaku Saat Nullable**: Hubungan 1-ke-1 opsional. Membutuhkan `@@unique([tenantId, absenceRecordId])` pada `ExtractedItem`.
* **Redundansi**: Bukan redundansi (*Tenant Safety Guard*).
* **Kebutuhan Parent Constraint**: `AbsenceRecord` membutuhkan `@@unique([tenantId, id])`.
* **Prisma Validity**: Valid.
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

### 5. `WorkflowInstance` ➔ `UserActor` (`lockedByUserId`)
* **Parent Tenant-Scoped?**: Ya (`UserActor` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`WorkflowInstance` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**. (Workflow Tenant A bisa dikunci oleh user Tenant B).
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, lockedByUserId] ➔ UserActor[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (`lockedByUserId` bertipe `String?`).
* **Perilaku Saat Nullable**: Jika `NULL`, workflow tidak dikunci. Jika diisi, user pengunci dijamin milik tenant yang sama.
* **Kebutuhan Parent Constraint**: `UserActor` membutuhkan `@@unique([tenantId, id])`.
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

### 6. `ExceptionItem` ➔ `UserActor` (`assignedToUserId` & `resolvedByUserId`)
* **Parent Tenant-Scoped?**: Ya (`UserActor` memiliki `tenant_id`).
* **Child Tenant-Scoped?**: Ya (`ExceptionItem` memiliki `tenant_id`).
* **Dapat Menembus Tenant jika Menggunakan Single-Column FK?**: **YA**. (Exception Tenant A bisa ditugaskan ke user Tenant B).
* **Composite Tenant-Aware FK Diperlukan?**: **YA** (`[tenantId, assignedToUserId] ➔ UserActor[tenantId, id]` dan `[tenantId, resolvedByUserId] ➔ UserActor[tenantId, id]`).
* **Apakah Relasi Nullable?**: Ya (kedua kolom bertipe `String?`).
* **Kebutuhan Parent Constraint**: `UserActor` membutuhkan `@@unique([tenantId, id])`.
* **Klasifikasi**: **REQUIRES COMPOSITE FK**.

---

## 3. Comprehensive Second-Pass Foreign Key Matrix

| Relasi / Foreign Key | Parent Tenant-Scoped? | Child Tenant-Scoped? | Composite FK Diperlukan? | Klasifikasi Final |
|---|---|---|---|---|
| `UserActor.tenantId` ➔ `Tenant.id` | N/A (Root) | Ya | Tidak (Direct 1:N) | **SAFE** |
| `Employee.tenantId` ➔ `Tenant.id` | N/A (Root) | Ya | Tidak (Direct 1:N) | **SAFE** |
| `Student.tenantId` ➔ `Tenant.id` | N/A (Root) | Ya | Tidak (Direct 1:N) | **SAFE** |
| `Document.tenantId` ➔ `Tenant.id` | N/A (Root) | Ya | Tidak (Direct 1:N) | **SAFE** |
| `AwardProposal.employeeId` ➔ `Employee` | Ya | Ya | **YA** `[tenantId, employeeId]` | **REQUIRES COMPOSITE FK** |
| `AwardProposalDocument.proposalId` ➔ `AwardProposal` | Ya | Ya | **YA** `[tenantId, proposalId]` | **REQUIRES COMPOSITE FK** |
| `AwardProposalDocument.documentId` ➔ `Document` | Ya | Ya | **YA** `[tenantId, documentId]` | **REQUIRES COMPOSITE FK** |
| `AwardProposalDocument.verifiedByUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, verifiedByUserId]` | **REQUIRES COMPOSITE FK** |
| `AbsenceRecord.studentId` ➔ `Student` | Ya | Ya | **YA** `[tenantId, studentId]` | **REQUIRES COMPOSITE FK** |
| `AbsenceRecord.documentId` ➔ `Document` | Ya | Ya | **YA** `[tenantId, documentId]` | **REQUIRES COMPOSITE FK** |
| `AbsenceRecord.verifiedByUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, verifiedByUserId]` | **REQUIRES COMPOSITE FK** |
| `OCRExtraction.documentId` ➔ `Document` | Ya | Ya | **YA** `[tenantId, documentId]` | **REQUIRES COMPOSITE FK** |
| `ExtractedItem.ocrExtractionId` ➔ `OCRExtraction` | Ya | Ya | **YA** `[tenantId, ocrExtractionId]` | **REQUIRES COMPOSITE FK** |
| `ExtractedItem.matchedStudentId` ➔ `Student` | Ya | Ya | **YA** `[tenantId, matchedStudentId]` | **REQUIRES COMPOSITE FK** |
| `ExtractedItem.absenceRecordId` ➔ `AbsenceRecord` | Ya | Ya | **YA** `[tenantId, absenceRecordId]` | **REQUIRES COMPOSITE FK** |
| `DocumentVersion.documentId` ➔ `Document` | Ya | Ya | **YA** `[tenantId, documentId]` | **REQUIRES COMPOSITE FK** |
| `DocumentVersion.uploadedByUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, uploadedByUserId]` | **REQUIRES COMPOSITE FK** |
| `HumanVerification.verifierUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, verifierUserId]` | **REQUIRES COMPOSITE FK** |
| `HumanVerification.targetEntityId` (Polymorphic) | Ya (Dynamic) | Ya | Tidak (RDBMS Limitation) | **REQUIRES APPLICATION GUARD** |
| `WorkflowInstance.lockedByUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, lockedByUserId]` | **REQUIRES COMPOSITE FK** |
| `WorkflowInstance.entityId` (Polymorphic) | Ya (Dynamic) | Ya | Tidak (RDBMS Limitation) | **REQUIRES APPLICATION GUARD** |
| `WorkflowTransition.workflowInstanceId` ➔ `WorkflowInstance` | Ya | Ya | **YA** `[tenantId, workflowInstanceId]` | **REQUIRES COMPOSITE FK** |
| `WorkflowTransition.actorId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, actorId]` | **REQUIRES COMPOSITE FK** |
| `ValidationResult.entityId` (Polymorphic) | Ya (Dynamic) | Ya | Tidak (RDBMS Limitation) | **REQUIRES APPLICATION GUARD** |
| `ExceptionItem.assignedToUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, assignedToUserId]` | **REQUIRES COMPOSITE FK** |
| `ExceptionItem.resolvedByUserId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, resolvedByUserId]` | **REQUIRES COMPOSITE FK** |
| `ExceptionItem.entityId` (Polymorphic) | Ya (Dynamic) | Ya | Tidak (RDBMS Limitation) | **REQUIRES APPLICATION GUARD** |
| `AuditEvent.actorId` ➔ `UserActor` | Ya | Ya | **YA** `[tenantId, actorId]` | **REQUIRES COMPOSITE FK** |
| `Tenant` (Root Model) | Tidak | N/A | Tidak | **PLATFORM-GLOBAL** |

---

## 4. Summary of Categories

1. **SAFE**: Direct 1:N relations to the `Tenant` root model (`UserActor.tenantId`, `Employee.tenantId`, `Student.tenantId`, `Document.tenantId`).
2. **REQUIRES COMPOSITE FK**: All 18 intra-tenant entity-to-entity relations (both mandatory AND optional), including `verifiedByUserId`, `documentId`, `matchedStudentId`, `lockedByUserId`, `assignedToUserId`, and `resolvedByUserId`.
3. **REQUIRES APPLICATION GUARD**: Polymorphic references (`targetEntityId`, `entityId`) across `HumanVerification`, `WorkflowInstance`, `ValidationResult`, and `ExceptionItem` where SQL Foreign Keys cannot cross dynamic table types.
4. **PLATFORM-GLOBAL**: Root `Tenant` configuration model itself.

---

*Akhir Dokumen Laporan Auditing Tenant Isolation Phase 4D (Second-Pass).*
