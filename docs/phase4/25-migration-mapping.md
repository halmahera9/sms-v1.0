# 25 - LocalStorage to Relational Schema Migration Mapping

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Data Migration Mapping Specification  
**Status**: DESIGN-FIRST SPECIFICATION  

---

## 1. Overview

Dokumen ini memetakan struktur data JSON sementara di `window.localStorage` (yang digunakan pada Fase 1-3) ke tabel relasional PostgreSQL resmi untuk eksekusi skrip migrasi di Fase 4E.

---

## 2. Table-by-Table Data Field Mapping Matrix

### A. LocalStorage Key `banyubiru_award_proposals_v2` ➔ `award_proposals` & `employees`

| Field LocalStorage | Tabel Target PostgreSQL | Kolom Target | Tipe Data & Transformasi |
|---|---|---|---|
| `p.id` | `award_proposals` | `id` | `UUID` (Konversi / Keep String Valid) |
| `p.employee.nip` | `employees` | `nip` | `VARCHAR(18)` |
| `p.employee.nrk` | `employees` | `nrk` | `VARCHAR(10)` |
| `p.employee.nama` | `employees` | `full_name` | `VARCHAR(255)` |
| `p.employee.jabatan` | `employees` | `jabatan` | `VARCHAR(255)` |
| `p.employee.ukpd` | `employees` | `ukpd` | `VARCHAR(255)` |
| `p.employee.wilayah` | `employees` | `wilayah` | `VARCHAR(128)` |
| `p.jenisPenghargaan` | `award_proposals` | `jenis_penghargaan` | `award_type_enum` (`MASA_KERJA`/`SATYALANCANA`) |
| `p.nilaiUsulan` | `award_proposals` | `nilai_usulan` | `VARCHAR(64)` |
| `p.status` | `award_proposals` | `status` | `proposal_status_enum` |
| `p.checklistData` | `award_proposals` | `checklist_data` | `JSONB` |

---

### B. LocalStorage Key `banyubiru_students_v2` ➔ `students`

| Field LocalStorage | Tabel Target PostgreSQL | Kolom Target | Tipe Data & Transformasi |
|---|---|---|---|
| `s.id` | `students` | `id` | `UUID` |
| `s.nisn` | `students` | `nisn` | `VARCHAR(10)` |
| `s.nis` | `students` | `nis` | `VARCHAR(20)` |
| `s.nama` | `students` | `full_name` | `VARCHAR(255)` |
| `s.kelas` | `students` | `class_name` | `VARCHAR(64)` |
| `s.jenisKelamin` | `students` | `gender` | `VARCHAR(1)` |

---

### C. LocalStorage Key `banyubiru_documents_v2` ➔ `ocr_extractions` & `extracted_items`

| Field LocalStorage | Tabel Target PostgreSQL | Kolom Target | Tipe Data & Transformasi |
|---|---|---|---|
| `doc.id` | `ocr_extractions` | `id` | `UUID` |
| `doc.status` | `ocr_extractions` | `status` | `ocr_extraction_status_enum` |
| `doc.workflowState` | `ocr_extractions` | `workflow_state` | `student_absence_workflow_state_enum` |
| `item.id` | `extracted_items` | `id` | `UUID` |
| `item.ocrText` | `extracted_items` | `ocr_text` | `TEXT` |
| `item.confidence` | `extracted_items` | `confidence_score` | `NUMERIC(5,2)` |
| `item.matchedStudentId` | `extracted_items` | `matched_student_id` | `UUID` |
| `item.verificationStatus` | `extracted_items` | `verification_status` | `verification_status_enum` |

---

### D. LocalStorage Key `banyubiru_audit_logs_v2` ➔ `audit_events`

| Field LocalStorage | Tabel Target PostgreSQL | Kolom Target | Tipe Data & Transformasi |
|---|---|---|---|
| `log.id` | `audit_events` | `id` | `UUID` |
| `log.timestamp` | `audit_events` | `created_at` | `TIMESTAMPTZ` |
| `log.actor` | `audit_events` | `actor_name` | `VARCHAR(255)` |
| `log.action` | `audit_events` | `action` | `VARCHAR(128)` |
| `log.target` | `audit_events` | `entity_id` | `UUID` |
| `log.details` | `audit_events` | `metadata` | `JSONB` (`{"details": log.details}`) |

---

## 3. Strategi Skrip Migrasi (Fase 4E)

1. **Pre-flight Validation**: Memastikan seluruh record di LocalStorage memiliki bidang wajib (NIP, NISN, ID).
2. **Default Tenant Injection**: Menyuntikkan `tenant_id` default (misal: `DEFAULT_TENANT_ID`) untuk seluruh data historis.
3. **Idempotent Upsert Script**: Menggunakan `ON CONFLICT (tenant_id, nip) DO UPDATE` untuk mencegah duplikasi saat skrip migrasi dijalankan ulang.

---

*Akhir Dokumen Pemetaan Migrasi.*
