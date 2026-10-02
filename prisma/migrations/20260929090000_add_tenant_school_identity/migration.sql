-- Migration: add_tenant_school_identity
-- Adds school identity fields, letterhead, and signers configuration to tenants table.

ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "npsn" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "alamat" TEXT,
ADD COLUMN IF NOT EXISTS "telepon" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "email" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "logo_path" VARCHAR(512),
ADD COLUMN IF NOT EXISTS "kop_surat" JSONB,
ADD COLUMN IF NOT EXISTS "penandatangan" JSONB;
