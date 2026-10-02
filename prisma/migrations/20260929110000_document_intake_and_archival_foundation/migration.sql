-- Migration: document_intake_and_archival_foundation
-- Adds source, retention, and archival fields to documents and document_versions.

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "sumber" VARCHAR(50) NOT NULL DEFAULT 'UNGGAH_LANGSUNG';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "retention_until" TIMESTAMPTZ;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "archive_location" VARCHAR(500);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_temporary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "documents_tenant_id_sumber_idx" ON "documents"("tenant_id", "sumber");
CREATE INDEX IF NOT EXISTS "documents_tenant_id_status_idx" ON "documents"("tenant_id", "status");

ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(500);
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "storage_status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
