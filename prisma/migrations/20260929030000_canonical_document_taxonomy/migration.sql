-- Migration: canonical_document_taxonomy
-- Replaces legacy award-specific DocumentCategory with canonical school document taxonomy

-- 1. Create temporary new enum
CREATE TYPE "DocumentCategory_new" AS ENUM (
  'KARTU_KELUARGA',
  'KTP',
  'AKTA_KELAHIRAN',
  'IJAZAH',
  'RAPOR',
  'SERTIFIKAT',
  'SURAT_PERNYATAAN',
  'SURAT_PERMOHONAN',
  'SURAT_TUGAS',
  'SURAT_KEPUTUSAN',
  'LAINNYA'
);

-- 2. Update documents table category column with safe fallback mapping
ALTER TABLE "documents" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING (
  CASE "category"::text
    WHEN 'SERTIFIKAT' THEN 'SERTIFIKAT'::"DocumentCategory_new"
    WHEN 'LAINNYA' THEN 'LAINNYA'::"DocumentCategory_new"
    WHEN 'IDENTITAS' THEN 'KTP'::"DocumentCategory_new"
    WHEN 'SURAT_PENGANTAR' THEN 'SURAT_PERNYATAAN'::"DocumentCategory_new"
    ELSE 'LAINNYA'::"DocumentCategory_new"
  END
);

-- 3. Update public_upload_invitations table document_category column with safe fallback mapping
ALTER TABLE "public_upload_invitations" ALTER COLUMN "document_category" TYPE "DocumentCategory_new" USING (
  CASE "document_category"::text
    WHEN 'SERTIFIKAT' THEN 'SERTIFIKAT'::"DocumentCategory_new"
    WHEN 'LAINNYA' THEN 'LAINNYA'::"DocumentCategory_new"
    WHEN 'IDENTITAS' THEN 'KTP'::"DocumentCategory_new"
    WHEN 'SURAT_PENGANTAR' THEN 'SURAT_PERNYATAAN'::"DocumentCategory_new"
    ELSE 'LAINNYA'::"DocumentCategory_new"
  END
);

-- 4. Drop old enum and rename new enum
DROP TYPE "DocumentCategory";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
