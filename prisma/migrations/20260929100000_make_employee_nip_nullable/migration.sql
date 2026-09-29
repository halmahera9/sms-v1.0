-- Migration: make_employee_nip_nullable
-- Allows employee nip to be nullable for non-ASN / honorary teachers and staff.

ALTER TABLE "employees" ALTER COLUMN "nip" DROP NOT NULL;
