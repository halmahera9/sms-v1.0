# 19 - Relational Schema Architecture

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Relational PostgreSQL Schema Specification  
**Status**: SPECIFICATION & DATA DEFINITION MAPPING  

---

## 1. Overview & Core Relational Blueprint

Dokumen ini mendefinisikan struktur **PostgreSQL Relational Schema** yang diterjemahkan secara mutlak dari kontrak domain Fase 4A & 4B.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TENANT ISOLATION LAYER                             │
│                     tenants (id, name, code, status)                        │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│        EMPLOYEE SUBDOMAIN            │   │         STUDENT SUBDOMAIN        │
│  employees ──► award_proposals       │   │  students ──► absence_records    │
│  award_proposal_documents            │   │  ocr_extractions ──► items       │
└──────────────────────────────────────┘   └──────────────────────────────────┘
                        │                             │
                        └───────────────┬─────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLATFORM CORE ENGINES                                │
│  documents ──► document_versions                                            │
│  workflow_instances ──► workflow_transitions                                │
│  exception_items  │  audit_events                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Table Specifications & Column Contracts

### A. Tenant Isolation Layer (`tenants`, `user_actors`)
- **`tenants`**: `id (UUID)`, `name (VARCHAR)`, `code (VARCHAR UNIQUE)`, `status (VARCHAR)`, `created_at`, `updated_at`.
- **`user_actors`**: `id (UUID)`, `tenant_id (FK)`, `username`, `full_name`, `email`, `role`, `status`, `created_at`, `updated_at`. Uniqueness: `UNIQUE(tenant_id, username)`.

---

### B. Employee Subdomain (`employees`, `employee_award_proposals`, `award_proposal_documents`)
- **`employees`**: `id (UUID)`, `tenant_id (FK)`, `nip`, `nrk`, `full_name`, `jabatan`, `ukpd`, `skpd`, `status`, `version INT DEFAULT 1`. Uniqueness: `UNIQUE(tenant_id, nip)`, `UNIQUE(tenant_id, nrk)`.
- **`employee_award_proposals`**: `id (UUID)`, `tenant_id (FK)`, `employee_id (FK)`, `jenis_penghargaan`, `nilai_usulan`, `tahun_usulan`, `masa_kerja_tahun`, `masa_kerja_bulan`, `status`, `checklist_status`, `checklist_data (JSONB)`, `version INT DEFAULT 1`. Uniqueness: `UNIQUE(tenant_id, employee_id, jenis_penghargaan, tahun_usulan)`.
- **`award_proposal_documents`**: `id (UUID)`, `proposal_id (FK)`, `document_id (FK)`, `document_type`, `verification_status`, `rejection_reason`. Uniqueness: `UNIQUE(proposal_id, document_type)`.

---

### C. Student Subdomain (`students`, `absence_records`, `ocr_extractions`, `extracted_items`)
- **`students`**: `id (UUID)`, `tenant_id (FK)`, `nisn`, `nis`, `full_name`, `class_name`, `gender`, `status`. Uniqueness: `UNIQUE(tenant_id, nisn)`.
- **`absence_records`** *(Source of Truth Absensi)*: `id (UUID)`, `tenant_id (FK)`, `student_id (FK)`, `document_id (FK Nullable)`, `absence_date`, `absence_status`, `notes`, `verified_by_user_id (FK)`.
- **`ocr_extractions`**: `id (UUID)`, `tenant_id (FK)`, `document_id (FK)`, `status`, `workflow_state`, `extracted_count`, `verified_count`.
- **`extracted_items`** *(Draft Line Items)*: `id (UUID)`, `ocr_extraction_id (FK)`, `matched_student_id (FK Nullable)`, `absence_record_id (FK Nullable UNIQUE)`, `ocr_text`, `confidence_score`, `class_name`, `absence_date`, `absence_status`, `notes`, `verification_status`.

---

### D. Platform Core Infrastructure (`documents`, `document_versions`, `workflow_instances`, `workflow_transitions`, `exception_items`, `audit_events`)
- **`documents`**: `id (UUID)`, `tenant_id (FK)`, `title`, `category`, `status`, `version INT DEFAULT 1`.
- **`document_versions`**: `id (UUID)`, `document_id (FK)`, `version_number INT`, `file_name`, `file_size_bytes`, `mime_type`, `storage_path`, `checksum_sha256`, `uploaded_by_user_id (FK)`. Uniqueness: `UNIQUE(document_id, version_number)`.
- **`workflow_instances`**: `id (UUID)`, `tenant_id (FK)`, `entity_type`, `entity_id`, `current_state`. Uniqueness: `UNIQUE(entity_type, entity_id)`.
- **`workflow_transitions`**: `id (UUID)`, `workflow_instance_id (FK)`, `from_state`, `to_state`, `trigger_action`, `actor_id (FK)`, `metadata (JSONB)`.
- **`exception_items`**: `id (UUID)`, `tenant_id (FK)`, `entity_type`, `entity_id`, `rule_id`, `severity`, `status`, `message`, `resolved_by_user_id (FK Nullable)`, `resolution_note`.
- **`audit_events`** *(Append-Only Ledger)*: `id (UUID)`, `tenant_id (FK)`, `actor_id (FK)`, `actor_name`, `action`, `entity_type`, `entity_id`, `before_state (JSONB)`, `after_state (JSONB)`, `metadata (JSONB)`.
