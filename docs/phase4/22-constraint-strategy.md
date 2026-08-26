# 22 - Integrity Constraint & Enum Strategy

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Relational Integrity & Database Boundaries  
**Status**: DESIGN-FIRST SPECIFICATION  

---

## 1. Overview

Dokumen ini mengatur aturan batasan integritas (*Integrity Constraints*), strategi PostgreSQL Enums, serta batasan tegas mengenai **apa yang BOLEH dan TIDAK BOLEH disimpan di dalam Database**.

---

## 2. CHECK Constraints & Data Integrity Mechanisms

### A. Critical Business CHECK Constraints
1. **`chk_employees_nip_length`**: `LENGTH(nip) = 18` (Memastikan NIP tepat 18 digit).
2. **`chk_employees_nrk_length`**: `LENGTH(nrk) BETWEEN 6 AND 10` (Memastikan NRK valid).
3. **`chk_students_nisn_length`**: `LENGTH(nisn) = 10` (Memastikan NISN tepat 10 digit).
4. **`chk_award_proposals_masa_kerja`**: `masa_kerja_tahun >= 0 AND masa_kerja_bulan BETWEEN 0 AND 11`.
5. **`chk_ocr_extracted_items_confidence`**: `confidence_score BETWEEN 0.00 AND 100.00`.
6. **`chk_document_versions_file_size`**: `file_size_bytes > 0`.
7. **`chk_workflow_instances_lock`**: `(locked_by_user_id IS NULL AND locked_until IS NULL) OR (locked_by_user_id IS NOT NULL AND locked_until IS NOT NULL)`.

---

## 3. PostgreSQL Native Enum Strategy

Seluruh enum direpresentasikan sebagai PostgreSQL Native Enums (`CREATE TYPE ... AS ENUM (...)`):
- `tenant_status_enum`: `'ACTIVE'`, `'SUSPENDED'`, `'ARCHIVED'`
- `user_role_enum`: `'ADMIN'`, `'VERIFIKATOR'`, `'PEGAWAI'`, `'OPERATOR'`
- `award_type_enum`: `'MASA_KERJA'`, `'SATYALANCANA'`
- `proposal_status_enum`: `'NOMINATIF'`, `'BELUM_UPLOAD'`, `'SEBAGIAN'`, `'LENGKAP'`, `'DIVERIFIKASI'`, `'SIAP_GENERATE'`, `'GENERATED'`, `'DITANDATANGANI'`, `'DIKIRIM'`, `'SELESAI'`
- `verification_status_enum`: `'PENDING'`, `'VERIFIED'`, `'REJECTED'`, `'NEEDS_CORRECTION'`
- `severity_enum`: `'INFO'`, `'WARNING'`, `'ERROR'`
- `exception_status_enum`: `'OPEN'`, `'IN_REVIEW'`, `'RESOLVED'`, `'IGNORED'`

---

## 4. Things We Must NOT Put Into the Database

Untuk menjaga kebersihan arsitektur dan mencegah kontaminasi database, data berikut **HARUS DITOLAK / TIDAK BOLEH DISIMPAN DI DATABASE**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 THINGS WE MUST NOT PUT INTO THE DATABASE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Transient UI State (modal open/close, active tab, hover states).         │
│ 2. Presentation Formatting (HTML formatted text, CSS classes, colors).      │
│ 3. Derived Dashboard Counters as Source-of-Truth (rekapan dihitung via View)│
│ 4. OCR Confidence Score as Final Business Truth (hanya sebagai meta draft). │
│ 5. Temporary Client Side Form Drafts (disimpan di LocalStorage/Session).     │
│ 6. Unhashed Passwords or Plaintext API Keys.                                 │
│ 7. Binary File Contents (Blob PDF/Image disimpan di GCS/S3 Storage).        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Akhir Dokumen Aturan Batasan Integritas.*
