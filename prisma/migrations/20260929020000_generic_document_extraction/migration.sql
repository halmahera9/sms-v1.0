-- Migration: generic_document_extraction
-- Makes extracted_items generic and decouples from student absence workflow.

-- 1. Drop legacy foreign key constraints
ALTER TABLE "extracted_items" DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_matched_student_id_fkey";
ALTER TABLE "extracted_items" DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_absence_record_id_fkey";

-- 2. Drop unique constraint on absence_record_id
ALTER TABLE "extracted_items" DROP CONSTRAINT IF EXISTS "extracted_items_tenant_id_absence_record_id_key";

-- 3. Drop legacy absence-specific columns
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "student_name_raw";
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "nisn_raw";
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "absence_date_raw";
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "absence_type_raw";
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "matched_student_id";
ALTER TABLE "extracted_items" DROP COLUMN IF EXISTS "absence_record_id";

-- 4. Add generic key-value extraction columns
ALTER TABLE "extracted_items" ADD COLUMN "field_key" VARCHAR(100) NOT NULL DEFAULT 'raw_text';
ALTER TABLE "extracted_items" ADD COLUMN "field_name" VARCHAR(100);
ALTER TABLE "extracted_items" ADD COLUMN "value" TEXT NOT NULL DEFAULT '';
ALTER TABLE "extracted_items" ADD COLUMN "raw_value" TEXT;
ALTER TABLE "extracted_items" ADD COLUMN "normalized_value" TEXT;
ALTER TABLE "extracted_items" ADD COLUMN "page_number" INTEGER;
ALTER TABLE "extracted_items" ADD COLUMN "bounding_box" JSONB;
ALTER TABLE "extracted_items" ADD COLUMN "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

-- 5. Add index on (tenant_id, field_key)
CREATE INDEX IF NOT EXISTS "extracted_items_tenant_id_field_key_idx" ON "extracted_items"("tenant_id", "field_key");
