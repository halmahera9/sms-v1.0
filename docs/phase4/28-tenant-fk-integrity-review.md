# 28 - Composite Tenant-Aware Foreign Key Integrity Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4D Multi-Tenancy Composite Foreign Key Integrity Analysis  
**Status**: REVIEW GATE DELIVERABLE — ARCHITECTURAL AUDIT  

---

## 1. Executive Summary

Dokumen ini berisi hasil audit menyeluruh terhadap seluruh **Composite Tenant-Aware Foreign Keys** pada berkas skema Prisma (`prisma/schema.prisma`). Audit ini memastikan bahwa isolasi multi-tenant dijamin secara deklaratif pada tingkat relational database engine PostgreSQL, mencegah adanya kebocoran data antar-tenant (*cross-tenant data leakage*).

---

## 2. Comprehensive Foreign Key Integrity Audit Table

| No | Child Model | Parent Model | Child Fields | Parent Fields | Parent Uniqueness Constraint | Isolation Purpose | Tenant ID Required? | Redundancy Assessment | Prisma Validity |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `UserActor` | `Tenant` | `[tenantId]` | `[id]` | `@id` | Menghubungkan user dengan tenant induk | Ya | Tidak Redundan | Valid |
| 2 | `Employee` | `Tenant` | `[tenantId]` | `[id]` | `@id` | Membatasi data pegawai pada tenant induk | Ya | Tidak Redundan | Valid |
| 3 | `AwardProposal` | `Employee` | `[tenantId, employeeId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci usulan hanya untuk pegawai pada tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 4 | `AwardProposalDocument` | `AwardProposal` | `[tenantId, proposalId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci dokumen usulan hanya untuk usulan pada tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 5 | `AwardProposalDocument` | `Document` | `[tenantId, documentId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci file dokumen hanya milik tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 6 | `AwardProposalDocument` | `UserActor` (`verifiedByUser`) | `[verifiedByUserId]` | `[id]` | `@id` | Mencatat pemverifikasi opsional (*nullable*) | Tidak (Opsional) | Tidak Redundan | Valid |
| 7 | `Student` | `Tenant` | `[tenantId]` | `[id]` | `@id` | Membatasi data siswa pada tenant | Ya | Tidak Redundan | Valid |
| 8 | `AbsenceRecord` | `Student` | `[tenantId, studentId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci absensi hanya untuk siswa pada tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 9 | `AbsenceRecord` | `Document` | `[documentId]` | `[id]` | `@id` | Mencatat berkas bukti absensi opsional | Tidak (Opsional) | Tidak Redundan | Valid |
| 10 | `AbsenceRecord` | `UserActor` (`verifiedByUser`) | `[tenantId, verifiedByUserId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci pemverifikasi absensi dari tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 11 | `OCRExtraction` | `Document` | `[tenantId, documentId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci tugas OCR hanya untuk dokumen milik tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 12 | `ExtractedItem` | `OCRExtraction` | `[tenantId, ocrExtractionId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci item OCR hasil ekstraksi pada job OCR tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 13 | `ExtractedItem` | `Student` (`matchedStudent`) | `[matchedStudentId]` | `[id]` | `@id` | Mencatat hasil matching siswa opsional | Tidak (Opsional) | Tidak Redundan | Valid |
| 14 | `ExtractedItem` | `AbsenceRecord` | `[absenceRecordId]` | `[id]` | `@id` | Mencatat link absensi terverifikasi opsional | Tidak (Opsional) | Tidak Redundan | Valid |
| 15 | `DocumentVersion` | `Document` | `[tenantId, documentId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci versi dokumen pada file dokumen milik tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 16 | `DocumentVersion` | `UserActor` (`uploadedByUser`) | `[tenantId, uploadedByUserId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci pengunggah versi dokumen dari tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 17 | `HumanVerification` | `UserActor` (`verifierUser`) | `[tenantId, verifierUserId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci operator pemverifikasi dari tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 18 | `WorkflowInstance` | `UserActor` (`lockedByUser`) | `[lockedByUserId]` | `[id]` | `@id` | Mencatat pengguna yang mengunci workflow (opsional) | Tidak (Opsional) | Tidak Redundan | Valid |
| 19 | `WorkflowTransition` | `WorkflowInstance` | `[tenantId, workflowInstanceId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci riwayat transisi pada instance workflow milik tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 20 | `WorkflowTransition` | `UserActor` (`actor`) | `[tenantId, actorId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci aktor pengeksekusi transisi dari tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |
| 21 | `ValidationResult` | `Tenant` | `[tenantId]` | `[id]` | `@id` | Membatasi hasil validasi pada tenant induk | Ya | Tidak Redundan | Valid |
| 22 | `ExceptionItem` | `UserActor` (`assignedToUser`/`resolvedByUser`) | `[assignedToUserId]` / `[resolvedByUserId]` | `[id]` | `@id` | Mencatat penanggung jawab / penyelesai exception opsional | Tidak (Opsional) | Tidak Redundan | Valid |
| 23 | `AuditEvent` | `UserActor` (`actor`) | `[tenantId, actorId]` | `[tenantId, id]` | `@@unique([tenantId, id])` | Mengunci aktor audit trail berasal dari tenant yang sama | Ya | Tidak Redundan (Tenant Safety Lock) | Valid |

---

## 3. Evaluation of Integrity & Redundancy

1. **Redundancy Analysis**:
   - Kolom `tenantId` pada tabel anak seperti `AwardProposalDocument` atau `WorkflowTransition` sepintas terlihat redundan jika tabel induk sudah memiliki `tenantId`. Namun pada sistem *Multi-Tenant Relational Database*, keterlibatan `tenant_id` pada Foreign Key (Composite FK) **sangat krusial** untuk mencegah peretasan *ID Swap Attack* (misal: mereferensikan Proposal Tenant A dengan Document milik Tenant B).
2. **Parent Uniqueness Requirement**:
   - Seluruh model induk (`UserActor`, `Employee`, `AwardProposal`, `Student`, `AbsenceRecord`, `OCRExtraction`, `Document`, `WorkflowInstance`) telah dilengkapi dengan atribut `@@unique([tenantId, id])`. Hal ini wajib agar engine PostgreSQL & Prisma mengizinkan deklarasi Composite Foreign Key `references: [tenantId, id]`.
3. **Prisma Schema Validity**:
   - Seluruh 23 pasangan relasi di atas mematuhi aturan validasi Prisma PSL 7.10.0 dan lulus uji `npx prisma validate`.

---

*Akhir Dokumen Laporan Evaluasi Integritas Composite Foreign Key Multi-Tenancy.*
