
## PINPOINT — EMPLOYEE / GURU / DAPODIK — 2026-10-07

- Canonical UX Guru mengikuti Master Data Siswa.
- Add Data Guru dan Edit Data Guru harus aktif dan menyimpan melalui `src/platform/actions/employee.ts`.
- `Jabatan` wajib.
- `Jenis Kelamin`: `Laki-laki` / `Perempuan`.
- NIK, bila diisi, harus tepat 16 digit.
- Dapodik status:
  - `NEW` = DATA BARU
  - `FILL_BLANK` = DATA DILENGKAPI
  - `CONFLICT` = PERLU DITINJAU
  - `UNCHANGED` = DATA SUDAH SESUAI
- Data kosong Master boleh diisi dari Dapodik.
- Data berbeda tidak boleh otomatis overwrite Master.
- `CONFLICT` wajib melalui review.
- `NEW` hanya masuk Master melalui explicit Apply.
- Preview menampilkan Field / Master / Dapodik.
- Employee server boundary: `src/platform/actions/employee.ts`
- Employee Dapodik service: `src/platform/services/dapodik/dapodik-import.ts`
- Employee UI: `src/app/app/employees/page.tsx`
- Migration: `prisma/migrations/20261004180000_add_employee_dapodik_profile_fields/migration.sql`
- Setelah perubahan Employee/Guru: `npx tsc --noEmit`, lalu test Add/Edit Guru dan Dapodik Preview.
- Jangan commit sebelum UI dinyatakan bekerja.
