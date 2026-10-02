-- Migration: remove_legacy_absence_records
-- Removes legacy absence_records table and AbsenceStatus enum.

-- 1. Drop foreign key constraints on absence_records
ALTER TABLE IF EXISTS "absence_records" DROP CONSTRAINT IF EXISTS "absence_records_tenant_id_fkey";
ALTER TABLE IF EXISTS "absence_records" DROP CONSTRAINT IF EXISTS "absence_records_tenant_id_student_id_fkey";
ALTER TABLE IF EXISTS "absence_records" DROP CONSTRAINT IF EXISTS "absence_records_tenant_id_document_id_fkey";

-- 2. Drop absence_records table
DROP TABLE IF EXISTS "absence_records" CASCADE;

-- 3. Drop AbsenceStatus enum
DROP TYPE IF EXISTS "AbsenceStatus" CASCADE;
