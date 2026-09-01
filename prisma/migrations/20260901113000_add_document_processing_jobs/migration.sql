-- =============================================================================
-- BANYUBIRU PLATFORM - DOCUMENT PROCESSING JOB MIGRATION (PHASE 5E.2-A)
-- Target RDBMS: PostgreSQL 17
-- =============================================================================

-- 1. Ensure Composite Tenant Index on document_versions if not present
CREATE UNIQUE INDEX IF NOT EXISTS "document_versions_tenant_id_id_key" ON "document_versions"("tenant_id", "id");

-- 2. Create Enum Type
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- 3. Create Table
CREATE TABLE "document_processing_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_domain" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "document_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- 4. Unique & Performance Indexes
CREATE UNIQUE INDEX "document_processing_jobs_tenant_id_id_key" ON "document_processing_jobs"("tenant_id", "id");
CREATE UNIQUE INDEX "document_processing_jobs_tenant_id_document_version_id_key" ON "document_processing_jobs"("tenant_id", "document_version_id");
CREATE INDEX "document_processing_jobs_tenant_id_status_idx" ON "document_processing_jobs"("tenant_id", "status");
CREATE INDEX "document_processing_jobs_status_created_at_idx" ON "document_processing_jobs"("status", "created_at");

-- 5. Foreign Key Constraints (with Tenant Isolation)
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_tenant_id_document_id_fkey" FOREIGN KEY ("tenant_id", "document_id") REFERENCES "documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_tenant_id_document_version_id_fkey" FOREIGN KEY ("tenant_id", "document_version_id") REFERENCES "document_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_tenant_id_actor_id_fkey" FOREIGN KEY ("tenant_id", "actor_id") REFERENCES "user_actors"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Row-Level Security (RLS) Policy
ALTER TABLE "document_processing_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_processing_jobs_app_isolation" ON "document_processing_jobs" FOR ALL TO banyubiru_app USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY "document_processing_jobs_admin_access" ON "document_processing_jobs" FOR ALL TO banyubiru_admin_app USING (true) WITH CHECK (true);

-- 7. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "document_processing_jobs" TO banyubiru_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "document_processing_jobs" TO banyubiru_admin_app;
GRANT SELECT ON TABLE "document_processing_jobs" TO banyubiru_readonly;
