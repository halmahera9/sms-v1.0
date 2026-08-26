# 21 - Database Index Strategy

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Indexing & Query Optimization Strategy  
**Status**: DESIGN-FIRST SPECIFICATION  

---

## 1. Overview & Strategy Principles

Dokumen ini mendefinisikan strategi pengindeksan B-Tree dan Composite Index pada PostgreSQL untuk menjamin pencarian berperforma tinggi ($< 10\text{ms}$) pada beban data tinggi dan mengisolasi query antartenant.

### Prinsip Pengindeksan:
1. **Tenant Compound Prefixing**: Semua indeks pada tabel berlingkup tenant menempatkan `tenant_id` pada posisi pertama kolom indeks (`(tenant_id, ...)`).
2. **Queue Hot-Path Indexing**: Indeks khusus antrean (`workflow_instances`, `exception_items`, `extracted_items`) difokuskan pada kombinasi `status` dan timestamp.
3. **Lookup Identifier Indexing**: Unique B-Tree Index untuk pengenal bisnis nasional (NIP, NRK, NISN, NIS, Checksum SHA256).

---

## 2. Rincian Indeks per Kategori Pola Akses

### A. Tenant Filtering & Multi-Tenancy Isolation Indexes
Setiap query operational diawali filter `tenant_id`:
- `idx_user_actors_tenant_role`: `(tenant_id, role)`
- `idx_employees_tenant_ukpd`: `(tenant_id, ukpd)`
- `idx_students_tenant_class`: `(tenant_id, class_name)`
- `idx_documents_tenant_category`: `(tenant_id, category)`

### B. Business Identifiers & Lookup Indexes (NIP, NRK, NISN, NIS)
- `idx_employees_tenant_nip`: `UNIQUE (tenant_id, nip)`
- `idx_employees_tenant_nrk`: `UNIQUE (tenant_id, nrk)`
- `idx_students_tenant_nisn`: `UNIQUE (tenant_id, nisn)`
- `idx_students_tenant_nis`: `UNIQUE (tenant_id, nis)`

### C. Workflow & Operational Queue Indexes
- `idx_workflow_instances_tenant_state`: `(tenant_id, current_state)`
- `idx_workflow_instances_entity`: `UNIQUE (entity_type, entity_id)`
- `idx_workflow_transitions_instance_created`: `(workflow_instance_id, created_at DESC)`

### D. Exception Queue & Verification Queue Indexes
- `idx_exception_items_tenant_status`: `(tenant_id, status)`
- `idx_exception_items_tenant_severity`: `(tenant_id, severity)`
- `idx_extracted_items_verification_status`: `(verification_status)`
- `idx_extracted_items_batch_status`: `(ocr_extraction_id, verification_status)`

### E. Document Lookup & File Storage Metadata Indexes
- `idx_document_versions_doc_ver`: `UNIQUE (document_id, version_number)`
- `idx_document_versions_checksum`: `(checksum_sha256)`
- `idx_award_proposal_docs_proposal_req`: `UNIQUE (proposal_id, requirement_code)`

### F. Audit Timeline & Event Ledger Indexes
- `idx_audit_events_tenant_created`: `(tenant_id, created_at DESC)`
- `idx_audit_events_entity`: `(entity_type, entity_id)`

---

## 3. Ringkasan Tabel Strategi Indeks

| Tabel Target | Nama Indeks | Kolom Indeks | Jenis Indeks | Pola Query Target |
|---|---|---|---|---|
| `user_actors` | `idx_user_actors_tenant_username` | `(tenant_id, username)` | UNIQUE B-Tree | Login / User Authentication |
| `employees` | `idx_employees_tenant_nip` | `(tenant_id, nip)` | UNIQUE B-Tree | Lookup Pegawai via NIP |
| `employees` | `idx_employees_tenant_nrk` | `(tenant_id, nrk)` | UNIQUE B-Tree | Lookup Pegawai via NRK |
| `award_proposals` | `idx_award_proposals_status` | `(tenant_id, status)` | Composite B-Tree | Filter Daftar Usulan per Status |
| `students` | `idx_students_tenant_nisn` | `(tenant_id, nisn)` | UNIQUE B-Tree | Lookup Siswa via NISN |
| `absence_records` | `idx_absence_records_student_date` | `(tenant_id, student_id, absence_date)` | UNIQUE B-Tree | Perekaman Absensi Harian |
| `ocr_extractions` | `idx_ocr_extractions_status` | `(tenant_id, status)` | Composite B-Tree | Antrean OCR Needs Verification |
| `extracted_items` | `idx_extracted_items_verification` | `(ocr_extraction_id, verification_status)` | Composite B-Tree | Verifikasi Line Item OCR |
| `exception_items` | `idx_exception_items_queue` | `(tenant_id, status, severity)` | Composite B-Tree | Antrean Exception Center |
| `audit_events` | `idx_audit_events_timeline` | `(tenant_id, created_at DESC)` | Composite B-Tree | Feeds Log Audit Real-time |

---

*Akhir Dokumen Strategi Indeks Database.*
