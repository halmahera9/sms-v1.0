# 21 - Database Indexing Strategy Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Query Pattern & Database Indexing Specification  
**Status**: SPECIFICATION & DATA DEFINITION MAPPING  

---

## 1. Indexing Principles Based on Query Patterns

Indeks database PostgreSQL dirancang **berdasarkan pola query nyata (*Actual Query Patterns*)** dari platform operasional:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACTUAL OPERATIONAL QUERY PATTERNS                     │
│  1. Tenant-Filtered Queries  ──► WHERE tenant_id = 'x' AND status = 'y'     │
│  2. Audit Feed Sorting       ──► WHERE tenant_id = 'x' ORDER BY created_at  │
│  3. Student Absence Range    ──► WHERE tenant_id = 'x' AND absence_date BETWEEN│
│  4. OCR Verification Queue   ──► WHERE ocr_extraction_id = 'x' AND status = 'p'│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventory Index Spesifik per Tabel

| Tabel Target | Nama Index | Tipe Index | Kolom Index | Pola Query Terkait |
|---|---|---|---|---|
| `employees` | `idx_employees_tenant_status` | B-Tree | `(tenant_id, status)` | Filter pegawai aktif per tenant. |
| `employee_award_proposals` | `idx_proposals_tenant_status` | B-Tree | `(tenant_id, status)` | Dashboard & Work Queue usulan pegawai. |
| `employee_award_proposals` | `idx_proposals_employee_id` | B-Tree | `(employee_id)` | Lookup histori usulan milik 1 pegawai. |
| `award_proposal_documents` | `idx_proposal_docs_proposal_id` | B-Tree | `(proposal_id)` | Rendering checklist berkas usulan. |
| `students` | `idx_students_tenant_class` | B-Tree | `(tenant_id, class_name)` | Filter master data siswa per kelas. |
| `absence_records` | `idx_absence_tenant_date` | B-Tree | `(tenant_id, absence_date)` | Rekapitulasi absensi bulanan/harian. |
| `absence_records` | `idx_absence_student_id` | B-Tree | `(student_id)` | Histori absensi per individu siswa. |
| `documents` | `idx_documents_tenant_category` | B-Tree | `(tenant_id, category)` | Filter perpustakaan dokumen platform. |
| `document_versions` | `idx_docver_checksum` | B-Tree | `(checksum_sha256)` | Cek integritas & deteksi file duplikat. |
| `ocr_extractions` | `idx_ocr_tenant_status` | B-Tree | `(tenant_id, status)` | Antrean verifikasi dokumen OCR. |
| `extracted_items` | `idx_extracted_verif_status` | B-Tree | `(ocr_extraction_id, verification_status)` | Filter item ekstraksi belum terverifikasi. |
| `workflow_instances` | `idx_workflow_tenant_state` | B-Tree | `(tenant_id, current_state)` | Filter state machine platform. |
| `workflow_transitions` | `idx_workflow_trg_instance` | B-Tree | `(workflow_instance_id, created_at)` | Render histori transisi workflow. |
| `exception_items` | `idx_exceptions_tenant_status` | B-Tree | `(tenant_id, status)` | Workspace Unified Exception Center. |
| `audit_events` | `idx_audit_tenant_created` | B-Tree (Desc) | `(tenant_id, created_at DESC)` | Feeds Unified Audit Feed real-time. |
