-- Migration: create_letter_templates
-- Creates letter_templates table for Banyubiru letter template foundation.

CREATE TABLE IF NOT EXISTS "letter_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kode_template" VARCHAR(50) NOT NULL,
    "nama_template" VARCHAR(255) NOT NULL,
    "jenis_surat" VARCHAR(100) NOT NULL,
    "isi_template" TEXT NOT NULL,
    "variabel" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "letter_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "letter_templates_tenant_id_id_key" ON "letter_templates"("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "letter_templates_tenant_id_kode_template_key" ON "letter_templates"("tenant_id", "kode_template");
CREATE INDEX IF NOT EXISTS "letter_templates_tenant_id_jenis_surat_idx" ON "letter_templates"("tenant_id", "jenis_surat");
CREATE INDEX IF NOT EXISTS "letter_templates_tenant_id_is_active_idx" ON "letter_templates"("tenant_id", "is_active");

ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
