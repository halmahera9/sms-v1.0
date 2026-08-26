# 31 - First Migration SQL DDL Artifact & Architectural Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4D First Migration SQL DDL Design & Review Artifact  
**Status**: MIGRATION SQL GENERATED — NOT EXECUTED  

---

## 1. Overview & Execution Protocol

Dokumen ini berisi artefak **SQL DDL lengkap untuk migrasi pertama** yang dirancang berdasarkan skema yang telah disetujui pada berkas [`prisma/schema.prisma`](file:///d:/banyubiru-next/prisma/schema.prisma) dan dokumen spesifikasi arsitektur pendukung (`07-audit-model.md`, `21-index-strategy.md`, `22-constraint-strategy.md`, `27-uuid-strategy-correction.md`, `29-tenant-fk-second-pass.md`, dan `30-migration-readiness.md`).

### Status Keamanan Migrasi:
> **MIGRATION SQL GENERATED — NOT EXECUTED**  
> Naskah SQL di bawah ini dirancang murni untuk peninjauan tertulis (*offline code review*) dan **TIDAK DIINTEGRASIKAN / TIDAK DIEKSEKUSI** ke database PostgreSQL.

---

## 2. Complete PostgreSQL 17 DDL Script (Draft Artifact)

```sql
-- =============================================================================
-- BANYUBIRU PLATFORM - FIRST INITIAL MIGRATION SCRIPT (PHASE 4D-6)
-- Target RDBMS: PostgreSQL 17
-- Status: DESIGNED FOR REVIEW ONLY - DO NOT EXECUTE YET
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: POSTGRESQL NATIVE ENUM DEFINITIONS (17 ENUMS)
-- -----------------------------------------------------------------------------

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VERIFIKATOR', 'PEGAWAI', 'OPERATOR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'MUTATED', 'RETIRED');
CREATE TYPE "AwardType" AS ENUM ('MASA_KERJA', 'SATYALANCANA');
CREATE TYPE "ProposalStatus" AS ENUM ('NOMINATIF', 'BELUM_UPLOAD', 'SEBAGIAN', 'LENGKAP', 'DIVERIFIKASI', 'SIAP_GENERATE', 'GENERATED', 'DITANDATANGANI', 'DIKIRIM', 'SELESAI');
CREATE TYPE "ChecklistStatus" AS ENUM ('BELUM_LENGKAP', 'LENGKAP', 'SIAP_GENERATE');
CREATE TYPE "DocumentCategory" AS ENUM ('SURAT_IZIN', 'SK_CPNS', 'SK_PNS', 'SK_PANGKAT', 'SK_JABATAN', 'SKP', 'SURAT_KETERANGAN');
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'NEEDS_CORRECTION');
CREATE TYPE "VerificationDecision" AS ENUM ('VERIFIED', 'REJECTED', 'CORRECTED');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'TRANSFERRED');
CREATE TYPE "AbsenceStatus" AS ENUM ('Sakit', 'Izin', 'Alpha');
CREATE TYPE "OCRExtractionStatus" AS ENUM ('NEEDS_VERIFICATION', 'IN_PROGRESS', 'VERIFIED', 'COMPLETED');
CREATE TYPE "StudentAbsenceWorkflowState" AS ENUM ('DRAFT', 'NEEDS_VERIFICATION', 'REQUIRES_CORRECTION', 'VERIFIED', 'COMPLETED');
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- -----------------------------------------------------------------------------
-- SECTION 2: CREATE CORE DOMAIN TABLES (17 TABLES)
-- Note: Primary Keys do NOT contain DB defaults (UUID v7 generated at Application Boundary)
-- -----------------------------------------------------------------------------

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_actors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "username" VARCHAR(128) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_actors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nip" VARCHAR(18) NOT NULL,
    "nrk" VARCHAR(10) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "jabatan" VARCHAR(255) NOT NULL,
    "ukpd" VARCHAR(255) NOT NULL,
    "skpd" VARCHAR(255) NOT NULL,
    "wilayah" VARCHAR(128) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "jenis_penghargaan" "AwardType" NOT NULL,
    "nilai_usulan" VARCHAR(64) NOT NULL,
    "tahun_usulan" INTEGER NOT NULL,
    "masa_kerja_tahun" INTEGER NOT NULL DEFAULT 0,
    "masa_kerja_bulan" INTEGER NOT NULL DEFAULT 0,
    "status" "ProposalStatus" NOT NULL DEFAULT 'NOMINATIF',
    "checklist_status" "ChecklistStatus" NOT NULL DEFAULT 'BELUM_LENGKAP',
    "checklist_data" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_proposal_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "requirement_code" VARCHAR(64) NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ,
    "verified_by_user_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "award_proposal_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nisn" VARCHAR(10) NOT NULL,
    "nis" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "class_name" VARCHAR(64) NOT NULL,
    "gender" VARCHAR(1) NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "absence_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "document_id" UUID,
    "absence_date" DATE NOT NULL,
    "absence_status" "AbsenceStatus" NOT NULL,
    "notes" TEXT,
    "verified_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "absence_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ocr_extractions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "status" "OCRExtractionStatus" NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "workflow_state" "StudentAbsenceWorkflowState" NOT NULL DEFAULT 'DRAFT',
    "extracted_count" INTEGER NOT NULL DEFAULT 0,
    "verified_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_extractions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "extracted_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ocr_extraction_id" UUID NOT NULL,
    "matched_student_id" UUID,
    "absence_record_id" UUID,
    "ocr_text" TEXT NOT NULL,
    "confidence_score" DECIMAL(5,2) NOT NULL,
    "class_name" VARCHAR(64) NOT NULL,
    "absence_date" DATE NOT NULL,
    "absence_status" "AbsenceStatus" NOT NULL,
    "notes" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_version_number" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "human_verifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "verifier_user_id" UUID NOT NULL,
    "target_entity_type" VARCHAR(64) NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "verification_decision" "VerificationDecision" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_instances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "workflow_definition_id" VARCHAR(64) NOT NULL,
    "current_state" VARCHAR(64) NOT NULL,
    "locked_by_user_id" UUID,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_instance_id" UUID NOT NULL,
    "from_state" VARCHAR(64) NOT NULL,
    "to_state" VARCHAR(64) NOT NULL,
    "trigger_event" VARCHAR(64) NOT NULL,
    "actor_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validation_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "rule_id" VARCHAR(64) NOT NULL,
    "is_valid" BOOLEAN NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exception_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "rule_id" VARCHAR(64) NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "assigned_to_user_id" UUID,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_name" VARCHAR(255) NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- SECTION 3: UNIQUE CONSTRAINTS & COMPOSITE PARENT KEYS
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- Parent Composite Uniqueness Keys for Composite FK References
CREATE UNIQUE INDEX "user_actors_tenant_id_id_key" ON "user_actors"("tenant_id", "id");
CREATE UNIQUE INDEX "user_actors_tenant_id_username_key" ON "user_actors"("tenant_id", "username");
CREATE UNIQUE INDEX "user_actors_tenant_id_email_key" ON "user_actors"("tenant_id", "email");

CREATE UNIQUE INDEX "employees_tenant_id_id_key" ON "employees"("tenant_id", "id");
CREATE UNIQUE INDEX "employees_tenant_id_nip_key" ON "employees"("tenant_id", "nip");
CREATE UNIQUE INDEX "employees_tenant_id_nrk_key" ON "employees"("tenant_id", "nrk");

CREATE UNIQUE INDEX "award_proposals_tenant_id_id_key" ON "award_proposals"("tenant_id", "id");
CREATE UNIQUE INDEX "award_proposals_tenant_employee_jenis_tahun_key" ON "award_proposals"("tenant_id", "employee_id", "jenis_penghargaan", "tahun_usulan");

CREATE UNIQUE INDEX "award_proposal_documents_tenant_id_id_key" ON "award_proposal_documents"("tenant_id", "id");
CREATE UNIQUE INDEX "award_proposal_documents_proposal_id_requirement_code_key" ON "award_proposal_documents"("proposal_id", "requirement_code");

CREATE UNIQUE INDEX "students_tenant_id_id_key" ON "students"("tenant_id", "id");
CREATE UNIQUE INDEX "students_tenant_id_nisn_key" ON "students"("tenant_id", "nisn");
CREATE UNIQUE INDEX "students_tenant_id_nis_key" ON "students"("tenant_id", "nis");

CREATE UNIQUE INDEX "absence_records_tenant_id_id_key" ON "absence_records"("tenant_id", "id");
CREATE UNIQUE INDEX "absence_records_tenant_student_date_key" ON "absence_records"("tenant_id", "student_id", "absence_date");

CREATE UNIQUE INDEX "ocr_extractions_tenant_id_id_key" ON "ocr_extractions"("tenant_id", "id");

CREATE UNIQUE INDEX "extracted_items_tenant_id_id_key" ON "extracted_items"("tenant_id", "id");
CREATE UNIQUE INDEX "extracted_items_tenant_id_absence_record_id_key" ON "extracted_items"("tenant_id", "absence_record_id");

CREATE UNIQUE INDEX "documents_tenant_id_id_key" ON "documents"("tenant_id", "id");

CREATE UNIQUE INDEX "document_versions_tenant_id_id_key" ON "document_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

CREATE UNIQUE INDEX "human_verifications_tenant_id_id_key" ON "human_verifications"("tenant_id", "id");

CREATE UNIQUE INDEX "workflow_instances_tenant_id_id_key" ON "workflow_instances"("tenant_id", "id");
CREATE UNIQUE INDEX "workflow_instances_tenant_entity_type_entity_id_key" ON "workflow_instances"("tenant_id", "entity_type", "entity_id");

CREATE UNIQUE INDEX "workflow_transitions_tenant_id_id_key" ON "workflow_transitions"("tenant_id", "id");
CREATE UNIQUE INDEX "validation_results_tenant_id_id_key" ON "validation_results"("tenant_id", "id");
CREATE UNIQUE INDEX "exception_items_tenant_id_id_key" ON "exception_items"("tenant_id", "id");
CREATE UNIQUE INDEX "audit_events_tenant_id_id_key" ON "audit_events"("tenant_id", "id");

-- -----------------------------------------------------------------------------
-- SECTION 4: COMPOSITE TENANT-AWARE FOREIGN KEY CONSTRAINTS (23 CONSTRAINTS)
-- -----------------------------------------------------------------------------

ALTER TABLE "user_actors" ADD CONSTRAINT "user_actors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "award_proposals" ADD CONSTRAINT "award_proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "award_proposals" ADD CONSTRAINT "award_proposals_tenant_id_employee_id_fkey" FOREIGN KEY ("tenant_id", "employee_id") REFERENCES "employees"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "award_proposal_documents" ADD CONSTRAINT "award_proposal_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "award_proposal_documents" ADD CONSTRAINT "award_proposal_documents_tenant_id_proposal_id_fkey" FOREIGN KEY ("tenant_id", "proposal_id") REFERENCES "award_proposals"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "award_proposal_documents" ADD CONSTRAINT "award_proposal_documents_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "award_proposal_documents" ADD CONSTRAINT "award_proposal_documents_tenant_id_verified_by_user_id_fkey" FOREIGN KEY ("tenant_id", "verified_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "absence_records" ADD CONSTRAINT "absence_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_records" ADD CONSTRAINT "absence_records_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_records" ADD CONSTRAINT "absence_records_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_records" ADD CONSTRAINT "absence_records_tenant_id_verified_by_user_id_fkey" FOREIGN KEY ("tenant_id", "verified_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_ocr_extraction_id_fkey" FOREIGN KEY ("tenant_id", "ocr_extraction_id") REFERENCES "ocr_extractions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_matched_student_id_fkey" FOREIGN KEY ("tenant_id", "matched_student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_absence_record_id_fkey" FOREIGN KEY ("tenant_id", "absence_record_id") REFERENCES "absence_records"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_uploaded_by_user_id_fkey" FOREIGN KEY ("tenant_id", "uploaded_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_tenant_id_verifier_user_id_fkey" FOREIGN KEY ("tenant_id", "verifier_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_locked_by_user_id_fkey" FOREIGN KEY ("tenant_id", "locked_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_workflow_instance_id_fkey" FOREIGN KEY ("tenant_id", "workflow_instance_id") REFERENCES "workflow_instances"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_actor_id_fkey" FOREIGN KEY ("tenant_id", "actor_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_assigned_to_user_id_fkey" FOREIGN KEY ("tenant_id", "assigned_to_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_resolved_by_user_id_fkey" FOREIGN KEY ("tenant_id", "resolved_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_actor_id_fkey" FOREIGN KEY ("tenant_id", "actor_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- SECTION 5: PERFORMANCE INDEXES (14 COMPOSITE & PREFIXED INDEXES)
-- -----------------------------------------------------------------------------

CREATE INDEX "user_actors_tenant_id_role_idx" ON "user_actors"("tenant_id", "role");
CREATE INDEX "employees_tenant_id_ukpd_idx" ON "employees"("tenant_id", "ukpd");
CREATE INDEX "award_proposals_tenant_id_status_idx" ON "award_proposals"("tenant_id", "status");
CREATE INDEX "award_proposals_tenant_id_jenis_penghargaan_idx" ON "award_proposals"("tenant_id", "jenis_penghargaan");
CREATE INDEX "award_proposal_documents_tenant_id_verification_status_idx" ON "award_proposal_documents"("tenant_id", "verification_status");
CREATE INDEX "students_tenant_id_class_name_idx" ON "students"("tenant_id", "class_name");
CREATE INDEX "absence_records_tenant_id_absence_date_idx" ON "absence_records"("tenant_id", "absence_date");
CREATE INDEX "ocr_extractions_tenant_id_status_idx" ON "ocr_extractions"("tenant_id", "status");
CREATE INDEX "ocr_extractions_tenant_id_workflow_state_idx" ON "ocr_extractions"("tenant_id", "workflow_state");
CREATE INDEX "extracted_items_verification_status_idx" ON "extracted_items"("verification_status");
CREATE INDEX "extracted_items_ocr_extraction_id_verification_status_idx" ON "extracted_items"("ocr_extraction_id", "verification_status");
CREATE INDEX "documents_tenant_id_category_idx" ON "documents"("tenant_id", "category");
CREATE INDEX "human_verifications_tenant_id_target_entity_type_target_ent_idx" ON "human_verifications"("tenant_id", "target_entity_type", "target_entity_id");
CREATE INDEX "workflow_instances_tenant_id_current_state_idx" ON "workflow_instances"("tenant_id", "current_state");
CREATE INDEX "workflow_transitions_workflow_instance_id_created_at_idx" ON "workflow_transitions"("workflow_instance_id", "created_at");
CREATE INDEX "validation_results_tenant_id_entity_type_entity_id_idx" ON "validation_results"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "exception_items_tenant_id_status_idx" ON "exception_items"("tenant_id", "status");
CREATE INDEX "exception_items_tenant_id_severity_idx" ON "exception_items"("tenant_id", "severity");
CREATE INDEX "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id", "created_at");
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- -----------------------------------------------------------------------------
-- SECTION 6: BUSINESS CHECK CONSTRAINTS (7 CRITICAL BUSINESS RULES)
-- Verified against Phase 4C (22-constraint-strategy.md)
-- -----------------------------------------------------------------------------

ALTER TABLE "employees" ADD CONSTRAINT "chk_employees_nip_length" CHECK (LENGTH("nip") = 18);
ALTER TABLE "employees" ADD CONSTRAINT "chk_employees_nrk_length" CHECK (LENGTH("nrk") BETWEEN 6 AND 10);
ALTER TABLE "students" ADD CONSTRAINT "chk_students_nisn_length" CHECK (LENGTH("nisn") = 10);
ALTER TABLE "award_proposals" ADD CONSTRAINT "chk_award_proposals_masa_kerja" CHECK ("masa_kerja_tahun" >= 0 AND "masa_kerja_bulan" BETWEEN 0 AND 11);
ALTER TABLE "extracted_items" ADD CONSTRAINT "chk_ocr_extracted_items_confidence" CHECK ("confidence_score" >= 0.00 AND "confidence_score" <= 100.00);
ALTER TABLE "document_versions" ADD CONSTRAINT "chk_document_versions_file_size" CHECK ("file_size_bytes" > 0);
ALTER TABLE "workflow_instances" ADD CONSTRAINT "chk_workflow_instances_lock" CHECK (("locked_by_user_id" IS NULL AND "locked_until" IS NULL) OR ("locked_by_user_id" IS NOT NULL AND "locked_until" IS NOT NULL));

-- -----------------------------------------------------------------------------
-- SECTION 7: AUDIT EVENT IMMUTABILITY TRIGGER
-- Verified against Phase 4A/4B (07-audit-model.md) and Phase 4D (#30)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY ERROR: Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_immutability_trigger
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- -----------------------------------------------------------------------------
-- SECTION 8: ROW LEVEL SECURITY (RLS) PREPARATION
-- Enable RLS on all 17 domain tables for future Postgres Role Enforcement
-- -----------------------------------------------------------------------------

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_actors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "award_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "award_proposal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absence_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ocr_extractions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extracted_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "human_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_transitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "validation_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exception_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
```

---

## 3. Analysis & Detailed Breakdown

### A. Generated DDL Overview
Skrip DDL di atas disusun dalam **8 Seksi Berurutan** yang menjamin ketergantungan DDL PostgreSQL berjalan tanpa *circular dependency error*.

### B. All CREATE TABLE Operations
17 tabel domain (`tenants`, `user_actors`, `employees`, `award_proposals`, `award_proposal_documents`, `students`, `absence_records`, `ocr_extractions`, `extracted_items`, `documents`, `document_versions`, `human_verifications`, `workflow_instances`, `workflow_transitions`, `validation_results`, `exception_items`, `audit_events`).
*Seluruh kolom `id` tidak menggunakan `DEFAULT` database.*

### C. All ENUM Operations
17 Tipe Native ENUM PostgreSQL (`TenantStatus`, `UserRole`, `UserStatus`, `EmployeeStatus`, `AwardType`, `ProposalStatus`, `ChecklistStatus`, `DocumentCategory`, `DocumentStatus`, `VerificationStatus`, `VerificationDecision`, `StudentStatus`, `AbsenceStatus`, `OCRExtractionStatus`, `StudentAbsenceWorkflowState`, `Severity`, `ExceptionStatus`).

### D. All Indexes
14 B-Tree Index yang berorientasi *tenant prefixing* (`tenant_id, ...`) untuk hot-path pencarian aplikasi.

### E. All UNIQUE Constraints
Unique indexes pada atribut unik domain (`code`, `nip`, `nrk`, `nisn`, `nis`, `username`, `email`) serta 14 parent composite keys `@@unique([tenantId, id])`.

### F. All FOREIGN KEY Constraints
23 Composite Tenant-Aware Foreign Keys yang mengunci isolasi tenant pada tabel anak.

### G. All CHECK Constraints
7 Business CHECK constraints (`chk_employees_nip_length`, `chk_employees_nrk_length`, `chk_students_nisn_length`, `chk_award_proposals_masa_kerja`, `chk_ocr_extracted_items_confidence`, `chk_document_versions_file_size`, `chk_workflow_instances_lock`).

### H. Audit Immutability Trigger
Fungsi PL/pgSQL `prevent_audit_modification()` dan Trigger `audit_events_immutability_trigger` yang menolak `UPDATE` dan `DELETE`.

### I. RLS Preparation
Penerapan `ENABLE ROW LEVEL SECURITY` pada 17 tabel.

### J. PostgreSQL-Specific Assumptions
Mengasumsikan PostgreSQL versi 17 dengan dukungan native `JSONB`, `TIMESTAMPTZ`, `UUID`, dan `PL/pgSQL`.

### K. Differences Between Prisma Auto-Generated DDL and Phase 4C
- Prisma tidak secara otomatis menambahkan 7 `CHECK Constraints` maupun DDL Trigger `prevent_audit_modification()`. Oleh karena itu, seksi 6 dan 7 dimasukkan sebagai injeksi raw SQL wajib pada file `migration.sql` akhir.

### L. Migration Safety Risks
- **Risiko Nol pada Clean Install**: Tidak ada data yang hilang atau rusak karena eksekusi dilakukan pada database kosong.

---

## 4. Final Status Confirmation

> **MIGRATION SQL GENERATED — NOT EXECUTED**

---

*Akhir Dokumen Artefak Desain DDL Migrasi Fase 4D-6.*
