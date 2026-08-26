# 13 - Application Service Contracts & Use Case Transaction Specifications

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Application Service Contracts, Transaction Boundaries & Idempotency Rules  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Subdomain Administrasi Siswa (Student Use Case Contracts)

### A. Use Case: `UploadStudentAbsenceDocument`
- **Tujuan**: Menerima file gambar surat izin/sakit siswa, membuat `Document`, `DocumentVersion`, dan header `OCRExtraction`.
- **Input**: `tenantId`, `actorId`, `fileName`, `fileSizeBytes`, `mimeType`, `fileBuffer`.
- **Output**: `documentId`, `ocrExtractionId`, `status`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Insert `Document` & `DocumentVersion`.
  - Insert `OCRExtraction` (status `DRAFT`).
  - Insert `AuditEvent` (`UPLOAD_OCR`).
  - `COMMIT TRANSACTION`
- **Idempotency Guarantee**: Idempotency Key berbasis `checksum_sha256` file + `tenant_id`. Mengunggah file persis sama dua kali akan mengembalikan entitas dokumen yang sudah ada tanpa duplikasi.

---

### B. Use Case: `ProcessStudentAbsenceOCR`
- **Tujuan**: Mengirim file ke OCR Engine, mengekstrak item teks, mencocokkan dengan data `Student` Dapodik, dan mengisi `ExtractedItem[]`.
- **Input**: `tenantId`, `documentId`, `ocrExtractionId`.
- **Output**: `extractedCount`, `items[]`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Insert `ExtractedItem[]`.
  - Update `OCRExtraction` status -> `NEEDS_VERIFICATION`.
  - Evaluasi `OCR_CONFIDENCE_THRESHOLD_RULE`. Jika confidence `<70%`, Insert `ExceptionItem` (`WARNING`).
  - Insert `AuditEvent` (`PROCESS_OCR`).
  - `COMMIT TRANSACTION`
- **Idempotency Guarantee**: Jika OCR diproses ulang untuk `ocrExtractionId` yang sama, item ekstraksi draft sebelumnya di-overwrite secara atomik.

---

### C. Use Case: `VerifyExtractedAbsenceItem` (Human-in-the-Loop)
- **Tujuan**: Operator mengonfirmasi keabsahan 1 item ekstraksi OCR dan mempromosikannya menjadi `AbsenceRecord` resmi.
- **Input**: `tenantId`, `actorId`, `extractedItemId`, `confirmedStatus` (`Sakit` | `Izin` | `Alpha`), `notes`.
- **Output**: `absenceRecordId`, `verificationStatus`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Update `ExtractedItem`: `verification_status = 'verified'`.
  - Update `OCRExtraction`: `verified_count = verified_count + 1`.
  - Check jika `verified_count == extracted_count`: Update `OCRExtraction` status -> `COMPLETED`, workflowState -> `VERIFIED`.
  - Insert `AbsenceRecord` (Source of Truth Absensi).
  - Resolve `ExceptionItem` terkait (jika ada).
  - Insert `AuditEvent` (`VERIFY_ITEM`).
  - `COMMIT TRANSACTION`
- **Idempotency Guarantee**: Memverifikasi item yang sudah berstatus `verified` mengembalikan `AbsenceRecord` yang sudah ada (*No-Op*).

---

### D. Use Case: `ExportStudentAbsenceRecap`
- **Tujuan**: Mengekspor data absensi terverifikasi ke format Excel `.xlsx` / PDF.
- **Input**: `tenantId`, `actorId`, `selectedClass`, `dateRange`.
- **Output**: File stream `.xlsx` / `.pdf`.
- **Transaction Boundary**: **Read-Only Transaction**.
  - Insert `AuditEvent` (`EXPORT_EXCEL` / `EXPORT_PDF`).
- **Catatan Penting**: Ekspor file **TIDAK MENGUBAH STATUS WORKFLOW** entitas absensi.

---

## 2. Subdomain Administrasi Pegawai (Employee Use Case Contracts)

### A. Use Case: `ImportEmployeeNominative`
- **Tujuan**: Membaca data nominatif pegawai dari SIMPEG/Excel dan menginisiasi `AwardProposal[]`.
- **Input**: `tenantId`, `actorId`, `nominativeList[]`.
- **Output**: `createdProposalCount`, `errors[]`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Insert/Update `Employee` master data.
  - Insert `AwardProposal` (status `NOMINATIF`).
  - Create `WorkflowInstance` (`NOMINATIF`).
  - Insert `AuditEvent` (`IMPORT_NOMINATIVE`).
  - `COMMIT TRANSACTION`
- **Idempotency Guarantee**: Mengimpor NIP + Tahun Usulan yang sama tidak akan mendaftarkan proposal ganda (`UNIQUE(tenant_id, nip, jenis_penghargaan, tahun_usulan)`).

---

### B. Use Case: `VerifyAwardProposalDocument`
- **Tujuan**: Verifikator BKD menyetujui/menolak 1 dokumen pendukung usulan pegawai.
- **Input**: `tenantId`, `actorId`, `proposalDocumentId`, `isApproved`, `rejectionReason`.
- **Output**: `checklistStatus`, `proposalStatus`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Update `AwardProposalDocument`: `verification_status = 'VERIFIED' | 'REJECTED'`.
  - Hitung ulang `AwardChecklist`.
  - Jika 4 dokumen wajib terverifikasi: Update `AwardProposal.checklist_status = 'LENGKAP'`.
  - Evaluasi `SE_BKD_22_2026_RULE` & `MASA_KERJA_ELIGIBILITY_RULE`.
  - Jika lulus validasi: Update `AwardProposal.status = 'SIAP_GENERATE'`.
  - Insert `WorkflowTransition`.
  - Insert `AuditEvent` (`VERIFY_DOCUMENT`).
  - `COMMIT TRANSACTION`

---

### C. Use Case: `ApproveAwardProposalAndGenerateSK`
- **Tujuan**: Menerbitkan Dokumen SK PDF dan mengubah status usulan menjadi `GENERATED` / `APPROVED`.
- **Input**: `tenantId`, `actorId`, `proposalId`, `skNumber`.
- **Output**: `generatedDocumentId`, `proposalStatus`.
- **Transaction Boundary**:
  - `BEGIN TRANSACTION`
  - Verify state == `SIAP_GENERATE`.
  - Create `Document` & `DocumentVersion` (SK PDF Resmi).
  - Update `AwardProposal`: `status = 'GENERATED'`.
  - Create `WorkflowTransition` (`SIAP_GENERATE` -> `GENERATED`).
  - Insert `AuditEvent` (`GENERATE_SK`).
  - `COMMIT TRANSACTION`
