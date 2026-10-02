-- Migration: add_employee_nik_identity
-- Adds optional nik (Nomor Induk Kependudukan) column and unique tenant index to employees table.

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "nik" VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS "employees_tenant_id_nik_key" ON "employees"("tenant_id", "nik");
