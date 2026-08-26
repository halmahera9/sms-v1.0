-- =============================================================================
-- BANYUBIRU PLATFORM - INITIAL SCHEMA & SECURITY MIGRATION (PHASE 4F-2 ARTIFACT)
-- Target RDBMS: PostgreSQL 17
-- Status: PREFLIGHT ARTIFACT - NOT EXECUTED YET
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: POSTGRESQL NATIVE ENUMS (17 ENUM TYPES)
-- -----------------------------------------------------------------------------
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "UserRole" AS ENUM ('ADMIN_TENANT', 'VERIFIKATOR', 'OPERATOR', 'AUDITOR');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "EmployeeStatus" AS ENUM ('PNS', 'PPPK', 'HONORER', 'NON_ASN');
CREATE TYPE "AwardType" AS ENUM ('SATYALANCANA_X', 'SATYALANCANA_XX', 'SATYALANCANA_XXX', 'PEGAWAI_TELADAN', 'INOVASI_PELAYANAN');
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED_STAGE_1', 'VERIFIED_STAGE_2', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WAIVED');
CREATE TYPE "DocumentCategory" AS ENUM ('SK_CPNS', 'SK_PNS', 'SK_JABATAN', 'SKP_2_TAHUN', 'SURAT_PENGANTAR', 'DP3', 'SERTIFIKAT', 'FOTO', 'IDENTITAS', 'LAINNYA');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'IN_PROGRESS', 'VERIFIED', 'FLAGGED_EXCEPTION');
CREATE TYPE "VerificationDecision" AS ENUM ('PASSED', 'FLAGGED', 'REJECTED');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'DROPPED_OUT', 'SUSPENDED');
CREATE TYPE "AbsenceStatus" AS ENUM ('ALPHA', 'IZIN', 'SAKIT', 'DISPENSASI');
CREATE TYPE "OCRExtractionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "StudentAbsenceWorkflowState" AS ENUM ('DATA_CAPTURED', 'NEEDS_VERIFICATION', 'EXCEPTION_RAISED', 'APPROVED', 'DISMISSED');
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ExceptionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- -----------------------------------------------------------------------------
-- SECTION 2: CORE DOMAIN TABLES (17 TABLES)
-- Primary Keys: UUID v7 generated at application boundary (NO DB DEFAULT)
-- -----------------------------------------------------------------------------

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_actors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_actors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nip" VARCHAR(18) NOT NULL,
    "nrk" VARCHAR(10) NOT NULL,
    "nama_lengkap" VARCHAR(255) NOT NULL,
    "gelar_depan" VARCHAR(50),
    "gelar_belakang" VARCHAR(50),
    "jabatan" VARCHAR(255) NOT NULL,
    "unit_kerja" VARCHAR(255) NOT NULL,
    "instansi" VARCHAR(255) NOT NULL,
    "status_kepegawaian" "EmployeeStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "jenis_penghargaan" "AwardType" NOT NULL,
    "tahun_usulan" INTEGER NOT NULL,
    "masa_kerja_tahun" INTEGER NOT NULL,
    "masa_kerja_bulan" INTEGER NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "catatan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "award_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "award_proposal_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "document_id" UUID,
    "requirement_code" VARCHAR(100) NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "catatan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "award_proposal_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nisn" VARCHAR(10) NOT NULL,
    "nis" VARCHAR(20) NOT NULL,
    "nama_lengkap" VARCHAR(255) NOT NULL,
    "kelas" VARCHAR(50) NOT NULL,
    "jurusan" VARCHAR(100),
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "absence_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "absence_date" DATE NOT NULL,
    "status" "AbsenceStatus" NOT NULL,
    "reason" TEXT,
    "document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "absence_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ocr_extractions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "status" "OCRExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "raw_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ocr_extractions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "extracted_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ocr_extraction_id" UUID NOT NULL,
    "student_name_raw" VARCHAR(255) NOT NULL,
    "nisn_raw" VARCHAR(20),
    "absence_date_raw" VARCHAR(50),
    "absence_type_raw" VARCHAR(50),
    "confidence_score" DECIMAL(5,2) NOT NULL,
    "matched_student_id" UUID,
    "absence_record_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "extracted_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "human_verifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "verified_by_user_id" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_instances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "current_state" "StudentAbsenceWorkflowState" NOT NULL,
    "locked_by_user_id" UUID,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_instance_id" UUID NOT NULL,
    "from_state" "StudentAbsenceWorkflowState" NOT NULL,
    "to_state" "StudentAbsenceWorkflowState" NOT NULL,
    "triggered_by_user_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "validation_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_code" VARCHAR(100) NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exception_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_instance_id" UUID NOT NULL,
    "rule_code" VARCHAR(100) NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "ExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" UUID,
    "resolution_notes" TEXT,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exception_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload_json" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- -----------------------------------------------------------------------------
-- SECTION 3: UNIQUE CONSTRAINTS & PARENT COMPOSITE KEYS (14 PARENT KEYS)
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");
CREATE UNIQUE INDEX "user_actors_tenant_id_username_key" ON "user_actors"("tenant_id", "username");
CREATE UNIQUE INDEX "user_actors_tenant_id_email_key" ON "user_actors"("tenant_id", "email");
CREATE UNIQUE INDEX "user_actors_tenant_id_id_key" ON "user_actors"("tenant_id", "id");

CREATE UNIQUE INDEX "employees_tenant_id_nip_key" ON "employees"("tenant_id", "nip");
CREATE UNIQUE INDEX "employees_tenant_id_nrk_key" ON "employees"("tenant_id", "nrk");
CREATE UNIQUE INDEX "employees_tenant_id_id_key" ON "employees"("tenant_id", "id");

CREATE UNIQUE INDEX "award_proposals_tenant_id_employee_id_jenis_penghargaan_t_key" ON "award_proposals"("tenant_id", "employee_id", "jenis_penghargaan", "tahun_usulan");
CREATE UNIQUE INDEX "award_proposals_tenant_id_id_key" ON "award_proposals"("tenant_id", "id");

CREATE UNIQUE INDEX "award_proposal_documents_proposal_id_requirement_code_key" ON "award_proposal_documents"("proposal_id", "requirement_code");
CREATE UNIQUE INDEX "award_proposal_documents_tenant_id_id_key" ON "award_proposal_documents"("tenant_id", "id");

CREATE UNIQUE INDEX "students_tenant_id_nisn_key" ON "students"("tenant_id", "nisn");
CREATE UNIQUE INDEX "students_tenant_id_nis_key" ON "students"("tenant_id", "nis");
CREATE UNIQUE INDEX "students_tenant_id_id_key" ON "students"("tenant_id", "id");

CREATE UNIQUE INDEX "absence_records_tenant_id_student_id_absence_date_key" ON "absence_records"("tenant_id", "student_id", "absence_date");
CREATE UNIQUE INDEX "absence_records_tenant_id_id_key" ON "absence_records"("tenant_id", "id");

CREATE UNIQUE INDEX "ocr_extractions_tenant_id_id_key" ON "ocr_extractions"("tenant_id", "id");
CREATE UNIQUE INDEX "documents_tenant_id_id_key" ON "documents"("tenant_id", "id");
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");
CREATE UNIQUE INDEX "workflow_instances_tenant_id_entity_type_entity_id_key" ON "workflow_instances"("tenant_id", "entity_type", "entity_id");
CREATE UNIQUE INDEX "workflow_instances_tenant_id_id_key" ON "workflow_instances"("tenant_id", "id");

-- -----------------------------------------------------------------------------
-- SECTION 4: 23 COMPOSITE TENANT-AWARE FOREIGN KEYS
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

ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_ocr_extraction_id_fkey" FOREIGN KEY ("tenant_id", "ocr_extraction_id") REFERENCES "ocr_extractions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_matched_student_id_fkey" FOREIGN KEY ("tenant_id", "matched_student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_tenant_id_absence_record_id_fkey" FOREIGN KEY ("tenant_id", "absence_record_id") REFERENCES "absence_records"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_tenant_id_verified_by_user_id_fkey" FOREIGN KEY ("tenant_id", "verified_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_locked_by_user_id_fkey" FOREIGN KEY ("tenant_id", "locked_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_workflow_instance_id_fkey" FOREIGN KEY ("tenant_id", "workflow_instance_id") REFERENCES "workflow_instances"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_triggered_by_user_id_fkey" FOREIGN KEY ("tenant_id", "triggered_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_workflow_instance_id_fkey" FOREIGN KEY ("tenant_id", "workflow_instance_id") REFERENCES "workflow_instances"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_assigned_to_user_id_fkey" FOREIGN KEY ("tenant_id", "assigned_to_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exception_items" ADD CONSTRAINT "exception_items_tenant_id_resolved_by_user_id_fkey" FOREIGN KEY ("tenant_id", "resolved_by_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_actor_user_id_fkey" FOREIGN KEY ("tenant_id", "actor_user_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- SECTION 5: PERFORMANCE B-TREE INDEXES (14 TENANT COMPOUND INDEXES)
-- -----------------------------------------------------------------------------

CREATE INDEX "idx_user_actors_tenant_role" ON "user_actors"("tenant_id", "role");
CREATE INDEX "idx_user_actors_tenant_status" ON "user_actors"("tenant_id", "status");
CREATE INDEX "idx_employees_tenant_status" ON "employees"("tenant_id", "status_kepegawaian");
CREATE INDEX "idx_award_proposals_tenant_status" ON "award_proposals"("tenant_id", "status");
CREATE INDEX "idx_students_tenant_kelas" ON "students"("tenant_id", "kelas");
CREATE INDEX "idx_absence_records_tenant_date" ON "absence_records"("tenant_id", "absence_date");
CREATE INDEX "idx_ocr_extractions_tenant_status" ON "ocr_extractions"("tenant_id", "status");
CREATE INDEX "idx_documents_tenant_category" ON "documents"("tenant_id", "category");
CREATE INDEX "idx_documents_tenant_status" ON "documents"("tenant_id", "status");
CREATE INDEX "idx_workflow_instances_tenant_state" ON "workflow_instances"("tenant_id", "current_state");
CREATE INDEX "idx_validation_results_tenant_target" ON "validation_results"("tenant_id", "target_entity_type", "target_entity_id");
CREATE INDEX "idx_exception_items_tenant_status" ON "exception_items"("tenant_id", "status");
CREATE INDEX "idx_exception_items_tenant_severity" ON "exception_items"("tenant_id", "severity");
CREATE INDEX "idx_audit_events_tenant_created" ON "audit_events"("tenant_id", "created_at" DESC);

-- -----------------------------------------------------------------------------
-- SECTION 6: BUSINESS CHECK CONSTRAINTS (7 CHECK CONSTRAINTS)
-- -----------------------------------------------------------------------------

ALTER TABLE "employees" ADD CONSTRAINT "chk_employees_nip_length" CHECK (LENGTH("nip") = 18);
ALTER TABLE "employees" ADD CONSTRAINT "chk_employees_nrk_length" CHECK (LENGTH("nrk") BETWEEN 6 AND 10);
ALTER TABLE "students" ADD CONSTRAINT "chk_students_nisn_length" CHECK (LENGTH("nisn") = 10);
ALTER TABLE "award_proposals" ADD CONSTRAINT "chk_award_proposals_masa_kerja" CHECK ("masa_kerja_tahun" >= 0 AND "masa_kerja_bulan" BETWEEN 0 AND 11);
ALTER TABLE "extracted_items" ADD CONSTRAINT "chk_ocr_extracted_items_confidence" CHECK ("confidence_score" BETWEEN 0.00 AND 100.00);
ALTER TABLE "document_versions" ADD CONSTRAINT "chk_document_versions_file_size" CHECK ("file_size_bytes" > 0);
ALTER TABLE "workflow_instances" ADD CONSTRAINT "chk_workflow_instances_lock" CHECK (("locked_by_user_id" IS NULL AND "locked_until" IS NULL) OR ("locked_by_user_id" IS NOT NULL AND "locked_until" IS NOT NULL));

-- -----------------------------------------------------------------------------
-- SECTION 7: AUDIT EVENT IMMUTABILITY TRIGGER FUNCTION (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY ERROR: Audit log entries are immutable and cannot be updated or deleted.';
END;
$$;

CREATE TRIGGER audit_events_immutability_trigger
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- -----------------------------------------------------------------------------
-- SECTION 8: TRUSTED TENANT CONTEXT HELPER FUNCTION (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_tenant_context(
    p_actor_id UUID,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_is_valid BOOLEAN;
BEGIN
    IF p_actor_id IS NULL OR p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'SECURITY ERROR: Actor ID and Tenant ID must not be null.';
    END IF;

    SELECT EXISTS (
        SELECT 1 
        FROM user_actors u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = p_actor_id 
          AND u.tenant_id = p_tenant_id 
          AND u.status = 'ACTIVE'::"UserStatus"
          AND t.status = 'ACTIVE'::"TenantStatus"
    ) INTO v_is_valid;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'SECURITY ERROR: Actor % is not an active member of tenant %.', p_actor_id, p_tenant_id;
    END IF;

    PERFORM set_config('app.current_actor_id', p_actor_id::text, true);
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 9: ROW LEVEL SECURITY (RLS) POLICIES FOR ALL 17 DOMAIN TABLES
-- -----------------------------------------------------------------------------

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_app_isolation" ON "tenants" FOR SELECT TO banyubiru_app USING ("id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "tenants_admin_access" ON "tenants" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "user_actors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_actors_app_isolation" ON "user_actors" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "user_actors_admin_access" ON "user_actors" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_app_isolation" ON "employees" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "employees_admin_access" ON "employees" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "award_proposals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "award_proposals_app_isolation" ON "award_proposals" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "award_proposals_admin_access" ON "award_proposals" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "award_proposal_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "award_proposal_documents_app_isolation" ON "award_proposal_documents" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "award_proposal_documents_admin_access" ON "award_proposal_documents" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_app_isolation" ON "students" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "students_admin_access" ON "students" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "absence_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absence_records_app_isolation" ON "absence_records" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "absence_records_admin_access" ON "absence_records" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "ocr_extractions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocr_extractions_app_isolation" ON "ocr_extractions" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "ocr_extractions_admin_access" ON "ocr_extractions" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "extracted_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extracted_items_app_isolation" ON "extracted_items" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "extracted_items_admin_access" ON "extracted_items" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_app_isolation" ON "documents" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "documents_admin_access" ON "documents" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_versions_app_isolation" ON "document_versions" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "document_versions_admin_access" ON "document_versions" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "human_verifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "human_verifications_app_isolation" ON "human_verifications" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "human_verifications_admin_access" ON "human_verifications" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_instances_app_isolation" ON "workflow_instances" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "workflow_instances_admin_access" ON "workflow_instances" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "workflow_transitions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_transitions_app_isolation" ON "workflow_transitions" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "workflow_transitions_admin_access" ON "workflow_transitions" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "validation_results" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "validation_results_app_isolation" ON "validation_results" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "validation_results_admin_access" ON "validation_results" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "exception_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exception_items_app_isolation" ON "exception_items" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "exception_items_admin_access" ON "exception_items" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_app_isolation" ON "audit_events" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "audit_events_admin_access" ON "audit_events" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- SECTION 10: PRIVILEGE BOUNDARIES (GRANT / REVOKE)
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION set_tenant_context(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, UUID) TO banyubiru_app;

GRANT USAGE ON SCHEMA public TO banyubiru_app;
GRANT USAGE ON SCHEMA public TO banyubiru_admin_app;
GRANT USAGE ON SCHEMA public TO banyubiru_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO banyubiru_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO banyubiru_admin_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO banyubiru_readonly;

REVOKE CREATE ON SCHEMA public FROM banyubiru_app;
