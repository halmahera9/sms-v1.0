-- Migration: ocr_foundation_enhancements
-- Enhances ocr_extractions with document_version_id, extracted_text, started_at, completed_at

ALTER TABLE "ocr_extractions" ADD COLUMN IF NOT EXISTS "document_version_id" UUID;
ALTER TABLE "ocr_extractions" ADD COLUMN IF NOT EXISTS "extracted_text" TEXT;
ALTER TABLE "ocr_extractions" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ;
ALTER TABLE "ocr_extractions" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "ocr_extractions_tenant_id_document_version_id_idx" ON "ocr_extractions"("tenant_id", "document_version_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ocr_extractions_tenant_id_document_version_id_fkey'
  ) THEN
    ALTER TABLE "ocr_extractions"
      ADD CONSTRAINT "ocr_extractions_tenant_id_document_version_id_fkey"
      FOREIGN KEY ("tenant_id", "document_version_id")
      REFERENCES "document_versions"("tenant_id", "id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
