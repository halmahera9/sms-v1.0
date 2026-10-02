-- Migration: remove_legacy_student_major
-- Drops legacy jurusan column from students table.

ALTER TABLE "students" DROP COLUMN IF EXISTS "jurusan";
