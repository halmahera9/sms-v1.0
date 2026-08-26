# 19 - Relational Schema Architecture & Entity Definitions

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Normalized Relational PostgreSQL Schema Specification  
**Status**: DESIGN-FIRST SPECIFICATION  

---

## 1. Executive Blueprint & Relational Design Principles

Dokumen ini mendefinisikan rancangan **Relational PostgreSQL Schema** ter-normalisasi (3NF) yang ditranslasikan dari Domain Model dan Spesifikasi Kontrak Fase 4A & 4B.

### Prinsip Utama Desain Skema Relasional:
1. **Tenant Isolation by Default**: Setiap tabel berlingkup tenant (`tenant-scoped`) memiliki kolom `tenant_id UUID NOT NULL` sebagai Foreign Key yang merujuk ke tabel `tenants`.
2. **Surrogate Primary Keys**: Menggunakan `UUID` (v4/v7) sebagai Primary Key (`id`) di seluruh tabel untuk keandalan distribusi data dan pencegahan penomoran sekuensial yang tertebak.
3. **Explicit Foreign Key Cascades**: Mengatur perilaku `ON DELETE` dan `ON UPDATE` secara tegas untuk menjaga integritas referensial.
4. **Immutability for Audit Trail**: Tabel `audit_events` bersifat *append-only* tanpa hak akses `UPDATE` atau `DELETE`.
5. **Optimistic & Pessimistic Concurrency Readiness**: Setiap agregat utama memiliki kolom `version INT DEFAULT 1 NOT NULL` untuk *optimistic locking*.

---

## 2. Diagram Relasi Entitas & Kardinalitas (ERD Blueprint)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TENANT LAYER                                         │
│                      tenants (1) ───◄ (N) user_actors                                  │
└───────────────────────────┬────────────────────────────────┬───────────────────────────┘
                            │ (1:N)                          │ (1:N)
                            ▼                                ▼
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│           EMPLOYEE SUBDOMAIN            │    │            STUDENT SUBDOMAIN            │
│ employees (1) ───◄ (N) award_proposals  │    │ students (1) ───◄ (N) absence_records   │
│ award_proposals (1) ───◄ (N) docs       │    │ ocr_extractions (1) ───◄ (N) items      │
└─────────────────────────────────────────┘    └─────────────────────────────────────────┘
                            │                                │
                            └────────────────┬───────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PLATFORM CORE ENGINES                                  │
│ documents (1) ───◄ (N) document_versions                                               │
│ workflow_instances (1) ───◄ (N) workflow_transitions                                   │
│ human_verifications (1) ───◄ (1) extracted_items / award_proposal_documents            │
│ validation_results (1) ───◄ (N) exception_items                                        │
│ audit_events (Append-Only Ledger)                                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Lengkap Tabel, Kolom, Kardinalitas & Perilaku Cascades

Berikut adalah rincian 17 entitas relasional yang dipetakan:

### 1. `tenants` (Penyewa Utama / Instansi Sekolah & BKD)
* **Kardinalitas**: 1 Tenant memiliki Banyak User, Employee, Student, Document, dll (1:N).
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `name`: `VARCHAR(255) NOT NULL` (Nama Sekolah / Instansi)
  - `code`: `VARCHAR(64) UNIQUE NOT NULL` (Kode unik instansi, misal: `SMAN1_JKT`)
  - `status`: `tenant_status_enum NOT NULL DEFAULT 'ACTIVE'`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

---

### 2. `user_actors` (Aktor Pengguna / User System)
* **Kardinalitas**: N User milik 1 Tenant (N:1).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `username`: `VARCHAR(128) NOT NULL`
  - `email`: `VARCHAR(255) NOT NULL`
  - `full_name`: `VARCHAR(255) NOT NULL`
  - `role`: `user_role_enum NOT NULL` (`ADMIN`, `VERIFIKATOR`, `PEGAWAI`, `OPERATOR`)
  - `status`: `user_status_enum NOT NULL DEFAULT 'ACTIVE'`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Uniqueness Constraints**: `UNIQUE(tenant_id, username)`, `UNIQUE(tenant_id, email)`

---

### 3. `employees` (Pegawai Pengusul Penghargaan)
* **Kardinalitas**: 1 Employee milik 1 Tenant (N:1); 1 Employee memiliki N `award_proposals` (1:N).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `nip`: `VARCHAR(18) NOT NULL`
  - `nrk`: `VARCHAR(10) NOT NULL`
  - `full_name`: `VARCHAR(255) NOT NULL`
  - `jabatan`: `VARCHAR(255) NOT NULL`
  - `ukpd`: `VARCHAR(255) NOT NULL`
  - `skpd`: `VARCHAR(255) NOT NULL`
  - `wilayah`: `VARCHAR(128) NOT NULL`
  - `status`: `employee_status_enum NOT NULL DEFAULT 'ACTIVE'`
  - `version`: `INT NOT NULL DEFAULT 1` (Optimistic Locking)
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(tenant_id, nip)`, `UNIQUE(tenant_id, nrk)`

---

### 4. `award_proposals` (Usulan Penghargaan Pegawai)
* **Kardinalitas**: N Usulan milik 1 Employee (N:1); 1 Usulan memiliki N `award_proposal_documents` (1:N).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `employee_id`: `UUID NOT NULL`
  - `jenis_penghargaan`: `award_type_enum NOT NULL` (`MASA_KERJA`, `SATYALANCANA`)
  - `nilai_usulan`: `VARCHAR(64) NOT NULL` (Misal: '10 Tahun', '20 Tahun', 'X Karya Satya')
  - `tahun_usulan`: `INT NOT NULL`
  - `masa_kerja_tahun`: `INT NOT NULL DEFAULT 0`
  - `masa_kerja_bulan`: `INT NOT NULL DEFAULT 0`
  - `status`: `proposal_status_enum NOT NULL DEFAULT 'NOMINATIF'`
  - `checklist_status`: `checklist_status_enum NOT NULL DEFAULT 'BELUM_LENGKAP'`
  - `checklist_data`: `JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `version`: `INT NOT NULL DEFAULT 1` (Optimistic Locking)
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(tenant_id, employee_id, jenis_penghargaan, tahun_usulan)`

---

### 5. `documents` (Master File Dokumen Platform)
* **Kardinalitas**: 1 Document milik 1 Tenant (N:1); 1 Document memiliki N `document_versions` (1:N).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `title`: `VARCHAR(255) NOT NULL`
  - `category`: `document_category_enum NOT NULL` (`SURAT_IZIN`, `SK_CPNS`, `SK_PNS`, `SK_PANGKAT`, `SK_JABATAN`, `SKP`, `SURAT_KETERANGAN`)
  - `status`: `document_status_enum NOT NULL DEFAULT 'ACTIVE'`
  - `current_version_number`: `INT NOT NULL DEFAULT 1`
  - `version`: `INT NOT NULL DEFAULT 1`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`

---

### 6. `document_versions` (Versi Biner Dokumen / File Storage Metadata)
* **Kardinalitas**: N Versi milik 1 Document (N:1).
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `document_id`: `UUID NOT NULL`
  - `version_number`: `INT NOT NULL`
  - `file_name`: `VARCHAR(255) NOT NULL`
  - `file_size_bytes`: `BIGINT NOT NULL`
  - `mime_type`: `VARCHAR(128) NOT NULL`
  - `storage_path`: `VARCHAR(512) NOT NULL` (Object storage URI / path)
  - `checksum_sha256`: `VARCHAR(64) NOT NULL`
  - `uploaded_by_user_id`: `UUID NOT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (uploaded_by_user_id) REFERENCES user_actors(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(document_id, version_number)`

---

### 7. `award_proposal_documents` (Lampiran Dokumen Usulan Pegawai)
* **Kardinalitas**: N Lampiran milik 1 Usulan (N:1); N Lampiran merujuk ke 1 Document (N:1).
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `proposal_id`: `UUID NOT NULL`
  - `document_id`: `UUID NOT NULL`
  - `requirement_code`: `VARCHAR(64) NOT NULL` (Misal: 'SK_CPNS', 'SK_PNS')
  - `verification_status`: `verification_status_enum NOT NULL DEFAULT 'PENDING'`
  - `verified_at`: `TIMESTAMPTZ NULL`
  - `verified_by_user_id`: `UUID NULL`
  - `rejection_reason`: `TEXT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (proposal_id) REFERENCES award_proposals(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (verified_by_user_id) REFERENCES user_actors(id) ON DELETE SET NULL ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(proposal_id, requirement_code)`

---

### 8. `students` (Siswa Sekolah)
* **Kardinalitas**: 1 Student milik 1 Tenant (N:1); 1 Student memiliki N `absence_records` (1:N).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `nisn`: `VARCHAR(10) NOT NULL`
  - `nis`: `VARCHAR(20) NOT NULL`
  - `full_name`: `VARCHAR(255) NOT NULL`
  - `class_name`: `VARCHAR(64) NOT NULL`
  - `gender`: `VARCHAR(1) NOT NULL` ('L' / 'P')
  - `status`: `student_status_enum NOT NULL DEFAULT 'ACTIVE'`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(tenant_id, nisn)`, `UNIQUE(tenant_id, nis)`

---

### 9. `absence_records` (Source of Truth Absensi Siswa)
* **Kardinalitas**: N Absence Record milik 1 Student (N:1).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `student_id`: `UUID NOT NULL`
  - `document_id`: `UUID NULL` (Dokumen pendukung / Surat Izin)
  - `absence_date`: `DATE NOT NULL`
  - `absence_status`: `absence_status_enum NOT NULL` (`Sakit`, `Izin`, `Alpha`)
  - `notes`: `TEXT NULL`
  - `verified_by_user_id`: `UUID NOT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL ON UPDATE CASCADE`
  - `FOREIGN KEY (verified_by_user_id) REFERENCES user_actors(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(tenant_id, student_id, absence_date)`

---

### 10. `ocr_extractions` (Batch Hasil Ekstraksi OCR Dokumen Absensi)
* **Kardinalitas**: N OCR Extraction milik 1 Document (N:1); 1 OCR Extraction memiliki N `extracted_items` (1:N).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `document_id`: `UUID NOT NULL`
  - `status`: `ocr_extraction_status_enum NOT NULL DEFAULT 'NEEDS_VERIFICATION'`
  - `workflow_state`: `student_absence_workflow_state_enum NOT NULL DEFAULT 'DRAFT'`
  - `extracted_count`: `INT NOT NULL DEFAULT 0`
  - `verified_count`: `INT NOT NULL DEFAULT 0`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT ON UPDATE CASCADE`

---

### 11. `extracted_items` (Draft Line-Item Hasil OCR)
* **Kardinalitas**: N Item milik 1 `ocr_extractions` (N:1); 1 Item berhubungan 1:1 opsional dengan `absence_records`.
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `ocr_extraction_id`: `UUID NOT NULL`
  - `matched_student_id`: `UUID NULL` (Hasil pencocokan fuzzy)
  - `absence_record_id`: `UUID NULL UNIQUE` (Direct Link ke Source of Truth setelah verifikasi)
  - `ocr_text`: `TEXT NOT NULL`
  - `confidence_score`: `NUMERIC(5,2) NOT NULL` (Misal: 94.50%)
  - `class_name`: `VARCHAR(64) NOT NULL`
  - `absence_date`: `DATE NOT NULL`
  - `absence_status`: `absence_status_enum NOT NULL`
  - `notes`: `TEXT NULL`
  - `verification_status`: `verification_status_enum NOT NULL DEFAULT 'PENDING'`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (ocr_extraction_id) REFERENCES ocr_extractions(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (matched_student_id) REFERENCES students(id) ON DELETE SET NULL ON UPDATE CASCADE`
  - `FOREIGN KEY (absence_record_id) REFERENCES absence_records(id) ON DELETE SET NULL ON UPDATE CASCADE`

---

### 12. `human_verifications` (Jejak Aksi Verifikasi Operator / Human-in-the-Loop)
* **Kardinalitas**: N Human Verification dibuat oleh 1 User (N:1).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `verifier_user_id`: `UUID NOT NULL`
  - `target_entity_type`: `VARCHAR(64) NOT NULL` ('ExtractedItem', 'AwardProposalDocument')
  - `target_entity_id`: `UUID NOT NULL`
  - `verification_decision`: `verification_decision_enum NOT NULL` (`VERIFIED`, `REJECTED`, `CORRECTED`)
  - `notes`: `TEXT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (verifier_user_id) REFERENCES user_actors(id) ON DELETE RESTRICT ON UPDATE CASCADE`

---

### 13. `workflow_instances` (Instansi State Machine Workflow)
* **Kardinalitas**: 1 Workflow Instance untuk 1 Entitas Bisnis (1:1 per entitas).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `entity_type`: `VARCHAR(64) NOT NULL` ('AwardProposal', 'OCRExtraction')
  - `entity_id`: `UUID NOT NULL`
  - `workflow_definition_id`: `VARCHAR(64) NOT NULL`
  - `current_state`: `VARCHAR(64) NOT NULL`
  - `locked_by_user_id`: `UUID NULL` (Pessimistic Lock untuk antrean verifikasi)
  - `locked_until`: `TIMESTAMPTZ NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (locked_by_user_id) REFERENCES user_actors(id) ON DELETE SET NULL ON UPDATE CASCADE`
* **Uniqueness Constraints**: `UNIQUE(entity_type, entity_id)`

---

### 14. `workflow_transitions` (Riwayat Transisi State Machine Workflow)
* **Kardinalitas**: N Transisi milik 1 Workflow Instance (N:1).
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `workflow_instance_id`: `UUID NOT NULL`
  - `from_state`: `VARCHAR(64) NOT NULL`
  - `to_state`: `VARCHAR(64) NOT NULL`
  - `trigger_event`: `VARCHAR(64) NOT NULL`
  - `actor_id`: `UUID NOT NULL`
  - `metadata`: `JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE ON UPDATE CASCADE`
  - `FOREIGN KEY (actor_id) REFERENCES user_actors(id) ON DELETE RESTRICT ON UPDATE CASCADE`

---

### 15. `validation_results` (Hasil Evaluasi Rules Engine)
* **Kardinalitas**: 1 Validation Result mencatat evaluasi 1 Entitas (1:N terhadap exception jika bermasalah).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `entity_type`: `VARCHAR(64) NOT NULL`
  - `entity_id`: `UUID NOT NULL`
  - `rule_id`: `VARCHAR(64) NOT NULL`
  - `is_valid`: `BOOLEAN NOT NULL`
  - `severity`: `severity_enum NOT NULL` (`INFO`, `WARNING`, `ERROR`)
  - `message`: `TEXT NOT NULL`
  - `metadata`: `JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`

---

### 16. `exception_items` (Antrean Pengecualian / Exception Queue)
* **Kardinalitas**: 1 Exception Item milik 1 Tenant (N:1).
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `entity_type`: `VARCHAR(64) NOT NULL`
  - `entity_id`: `UUID NOT NULL`
  - `rule_id`: `VARCHAR(64) NOT NULL`
  - `severity`: `severity_enum NOT NULL`
  - `status`: `exception_status_enum NOT NULL DEFAULT 'OPEN'` (`OPEN`, `IN_REVIEW`, `RESOLVED`, `IGNORED`)
  - `message`: `TEXT NOT NULL`
  - `assigned_to_user_id`: `UUID NULL` (Pessimistic Claim Lock)
  - `resolved_by_user_id`: `UUID NULL`
  - `resolved_at`: `TIMESTAMPTZ NULL`
  - `resolution_note`: `TEXT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (assigned_to_user_id) REFERENCES user_actors(id) ON DELETE SET NULL ON UPDATE CASCADE`
  - `FOREIGN KEY (resolved_by_user_id) REFERENCES user_actors(id) ON DELETE SET NULL ON UPDATE CASCADE`

---

### 17. `audit_events` (Append-Only Immutable Ledger)
* **Kardinalitas**: 1 Audit Event mencatat 1 aksi historis dalam sistem.
* **Tenant Strategy**: `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT`
* **Definisi Kolom**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id`: `UUID NOT NULL`
  - `actor_id`: `UUID NOT NULL`
  - `actor_name`: `VARCHAR(255) NOT NULL`
  - `action`: `VARCHAR(128) NOT NULL`
  - `entity_type`: `VARCHAR(64) NOT NULL`
  - `entity_id`: `UUID NOT NULL`
  - `before_state`: `JSONB NULL`
  - `after_state`: `JSONB NULL`
  - `metadata`: `JSONB NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **Foreign Keys & Cascades**:
  - `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE`
  - `FOREIGN KEY (actor_id) REFERENCES user_actors(id) ON DELETE RESTRICT ON UPDATE CASCADE`
* **Constraint Khusus**: Immutable. Tidak ada izin UPDATE / DELETE.

---

*Akhir Dokumen Spesifikasi Skema Relasional.*
