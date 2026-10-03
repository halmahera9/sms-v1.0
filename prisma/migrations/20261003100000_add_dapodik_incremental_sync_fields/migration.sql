-- Additive Dapodik fields for incremental synchronization.
-- Existing records are preserved; all new fields are nullable.

ALTER TABLE "employees"
  ADD COLUMN "jenis_kelamin" VARCHAR(20),
  ADD COLUMN "tempat_lahir" VARCHAR(100),
  ADD COLUMN "tanggal_lahir" TIMESTAMPTZ,
  ADD COLUMN "jenis_gtk" VARCHAR(100),
  ADD COLUMN "alamat" TEXT,
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "tanggal_surat_tugas" TIMESTAMPTZ;

ALTER TABLE "students"
  ADD COLUMN "nik" VARCHAR(16),
  ADD COLUMN "no_kk" VARCHAR(16),
  ADD COLUMN "jenis_kelamin" VARCHAR(20),
  ADD COLUMN "tingkat_kelas" VARCHAR(20),
  ADD COLUMN "agama" VARCHAR(50),
  ADD COLUMN "tanggal_masuk" TIMESTAMPTZ;
