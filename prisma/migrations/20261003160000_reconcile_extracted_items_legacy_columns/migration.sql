-- Reconcile physical extracted_items table with the canonical Prisma schema.
-- Legacy generic-extraction columns are no longer part of ExtractedItem.
--
-- Preserve student_name_raw into canonical text fields only when those
-- canonical fields are empty.

UPDATE "extracted_items"
SET
  "value" = CASE
    WHEN COALESCE(TRIM("value"), '') = ''
      THEN "student_name_raw"
    ELSE "value"
  END,
  "raw_value" = CASE
    WHEN COALESCE(TRIM("raw_value"), '') = ''
      THEN "student_name_raw"
    ELSE "raw_value"
  END,
  "normalized_value" = CASE
    WHEN COALESCE(TRIM("normalized_value"), '') = ''
      THEN NULLIF(TRIM("student_name_raw"), '')
    ELSE "normalized_value"
  END
WHERE "field_key" = 'raw_text'
  AND COALESCE(TRIM("student_name_raw"), '') <> '';

ALTER TABLE "extracted_items"
  DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_matched_student_id_fkey";

ALTER TABLE "extracted_items"
  DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_absence_record_id_fkey";

ALTER TABLE "extracted_items"
  DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_absence_record_id_key";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "student_name_raw";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "nisn_raw";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "absence_date_raw";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "absence_type_raw";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "matched_student_id";

ALTER TABLE "extracted_items"
  DROP COLUMN IF EXISTS "absence_record_id";
