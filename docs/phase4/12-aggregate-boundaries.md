# 12 - Aggregate Boundaries & Consistency Invariants

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Detailed Aggregate Boundaries & Consistency Rules  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Detailed Aggregate Boundary Specifications

### A. `AwardProposal` Aggregate Root
- **Root Entity**: `AwardProposal`
- **Internal Entities**: `AwardProposalDocument[]`
- **Embedded Value Objects**: `AwardChecklist`, `EmployeeInfoSnapshot`
- **Boundary Guarantee**:
  - Perubahan status proposal (`status`, `checklistStatus`) dan penambahan/penolakan dokumen pendukung (`AwardProposalDocument`) **WAJIB** melalui eksekusi method pada `AwardProposal` Root.
  - `AwardProposalDocument` tidak boleh dimutasi secara terpisah tanpa mengevaluasi ulang `AwardChecklist` pada `AwardProposal`.

---

### B. `Student` Aggregate Root
- **Root Entity**: `Student`
- **Boundary Guarantee**:
  - Mengelola master data identitas siswa (NISN, NIS, Nama, Kelas, Status Dapodik).
  - Mutasi identitas siswa hanya dapat dilakukan melalui pendaftaran Dapodik atau pengkinian master data resmi.

---

### C. `AbsenceRecord` Aggregate Root
- **Root Entity**: `AbsenceRecord`
- **Boundary Guarantee**:
  - Menjadi **Single Source of Truth** absensi siswa resmi.
  - Diciptakan eksklusif melalui **Human-in-the-Loop Verification** dari `ExtractedItem` atau masukan langsung operator.
  - Memegang referensi kunci ke `Student` (`student_id`), `Document` (`document_id`), dan `UserActor` (`verified_by_user_id`).

---

### D. `OCRExtraction` Aggregate Root
- **Root Entity**: `OCRExtraction`
- **Internal Entities**: `ExtractedItem[]`
- **Boundary Guarantee**:
  - Mengelola lifecycle pemrosesan OCR gambar surat ketidakhadiran.
  - `verifiedCount` pada `OCRExtraction` **TIDAK BOLEH MEMBENGKAK MELEBIHI `extractedCount`**.
  - Mengubah status `verificationStatus` pada `ExtractedItem` otomatis meng-update counter `verifiedCount` pada header `OCRExtraction`.

---

### E. `Document` Aggregate Root
- **Root Entity**: `Document`
- **Internal Entities**: `DocumentVersion[]`
- **Boundary Guarantee**:
  - Mengelola integritas file fisik. Setiap pergantian/revisi file fisik menciptakan `DocumentVersion` baru dengan nomor versi inkremental dan checksum SHA-256 baru.
  - File biner fisik disimpan di Object Storage (GCS/S3), sedangkan database hanya menyimpan `storage_path` dan checksum.

---

### F. `WorkflowInstance` Aggregate Root
- **Root Entity**: `WorkflowInstance`
- **Internal Entities**: `WorkflowTransition[]` (History Ledger)
- **Boundary Guarantee**:
  - Perubahan `current_state` wajib menghasilkan entri `WorkflowTransition` baru secara atomik.
  - Transition history (`WorkflowTransition`) bersifat *Append-Only* dan tidak boleh diubah/dihapus.

---

### G. `AuditEvent` Aggregate Root
- **Root Entity**: `AuditEvent`
- **Boundary Guarantee**:
  - Bersifat **Append-Only / Immutable Ledger**.
  - Tidak memiliki entitas anak. Dilarang menyediakan method `update()` atau `delete()`.
