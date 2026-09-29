# Banyubiru — School Document Intelligence Platform

Banyubiru adalah platform **Document Intelligence untuk administrasi sekolah**, multi-tenant,
yang mengubah dokumen fisik/digital menjadi data terstruktur melalui pipeline:

```text
Dokumen Masuk (Document Intake)
        ↓
Pembacaan Dokumen (OCR)
        ↓
Ekstraksi Data
        ↓
Pencocokan Data (Identity Matching)
        ↓
Validasi
        ↓
Workflow
        ↓
Dokumen Keluaran / Surat
```

Banyubiru bukan sekadar aplikasi CRUD administrasi sekolah.
Fondasi utamanya adalah **Document Intelligence**, dengan master data dan workflow sebagai
sistem pendukung.

---

## Project Reset — September 2026

### Alasan Reset

Repository ini menjalani **project reset** untuk mengembalikan arsitektur ke bentuk yang
bounded, canonical, dan berorientasi pada alur dokumen yang jelas.

Reset dilakukan karena:

- Terdapat duplikasi arsitektur antar domain yang tidak terkoordinasi.
- Beberapa field dan model legacy tidak lagi relevan dengan kontrak phase saat ini.
- Terminologi teknis internal digunakan langsung sebagai label UI.
- Beberapa persistence dibuat tanpa kontrak idempotensi yang eksplisit.

### Prinsip Reset

| Prinsip | Aturan |
|---|---|
| Bounded change | Setiap phase hanya mengerjakan scope yang disepakati |
| Kontrak canonical | Satu kontrak per domain; tidak ada duplikasi |
| Multi-tenant isolation | Setiap query dan mutation harus scoped ke `tenantId` |
| Auditability | Setiap operasi signifikan harus meninggalkan audit trail |
| Idempotency | Persistence yang dijalankan ulang tidak menghasilkan duplicate |
| Immutable original | File asli dokumen tidak boleh diubah atau digantikan oleh hasil OCR |
| No scope creep | Jangan memperluas scope tanpa kontrak phase yang disetujui |
| Legacy removal | Field/model yang tidak lagi relevan dihapus, bukan dipertahankan sebagai beban |

---

## Identitas Canonical

**Nama:** Banyubiru — School Document Intelligence Platform
**Repository:** `sms-v1.0`
**Branch aktif:** `main`

---

## Arsitektur Canonical (Post-Reset)

### Lapisan Aplikasi

```text
UI / App Router
      ↓
Server Actions / Route Handlers
      ↓
Application Services
      ↓
Domain / Workflow Services
      ↓
Platform Infrastructure (Repositories, Storage, Audit)
      ↓
PostgreSQL + Object Storage
```

UI tidak menjadi tempat untuk business rules atau persistence logic.

### Prinsip Penyimpanan

```text
PostgreSQL
→ metadata dokumen
→ identity (Siswa, Guru & Karyawan)
→ hasil OCR (teks)
→ hasil ekstraksi
→ hasil matching
→ audit trail

Object Storage
→ binary file dokumen asli
```

Dokumen asli **tidak boleh** dimasukkan sebagai binary record di database.
Akses file melalui authenticated server boundary:

```
GET /api/documents/[documentId]/file
```

### Object Storage

Contract canonical berada di `src/platform/storage/types.ts`.

Provider aktif:
- `src/platform/storage/filesystem.ts` (production)
- `src/platform/storage/in-memory.ts` (testing)

Storage root default: `.data/object-storage` atau `OBJECT_STORAGE_ROOT`.

### Security Model

- Multi-tenant data model
- PostgreSQL Row Level Security (RLS)
- Authenticated execution context via `runInTenantContext()`
- Server action authorization
- Tenant-scoped repository access
- Immutable audit events
- Canonical object-storage tenant namespace

`tenantId` harus berasal dari trusted authenticated context.
Tidak boleh dipercaya dari input browser sebagai sumber otoritas.

---

## Master Data Canonical

### Siswa

| Field | Keterangan |
|---|---|
| `fullName` | Nama lengkap |
| `nisn` | NISN (10 digit) |
| `nis` | NIS lokal sekolah |
| `className` | Kelas |
| `status` | `ACTIVE` / `GRADUATED` / `TRANSFERRED` |

> **Catatan:** Field `Student.jurusan` telah dihapus dari schema. Tidak boleh dikembalikan
> tanpa keputusan architecture baru.

Priority matching identity: `NISN → NIS → nama ternormalisasi`

### Guru & Karyawan

| Field | Keterangan |
|---|---|
| `fullName` | Nama lengkap |
| `nip` | NIP (nullable — tidak semua pegawai memiliki NIP) |
| `nik` | NIK KTP (nullable) |
| `nrk` | NRK lokal |
| `jabatan` | Jabatan |
| `unitKerja` | Unit kerja |
| `instansi` | Instansi |
| `gelarDepan` | Gelar depan (nullable) |
| `gelarBelakang` | Gelar belakang (nullable) |
| `statusKepegawaian` | `PNS` / `PPPK` / `HONORER` / `NON_ASN` |

> **Penting:** `NIP` bersifat nullable. Jangan mengasumsikan semua Guru & Karyawan memiliki NIP.

Priority matching identity: `NIP → NIK → nama ternormalisasi`

**Terminologi UI canonical:** **Guru & Karyawan** (bukan "Employee", bukan "Pegawai" saja).

---

## Document Intelligence Baseline

### P0-G — Document Intake

Dokumen yang masuk disimpan di object storage dengan kontrak:

- File asli disimpan via `IObjectStorageProvider`
- Database hanya menyimpan metadata: `storageKey`, SHA-256 checksum, `mimeType`, `fileSizeBytes`, `storageStatus`
- `DocumentVersion` merepresentasikan setiap versi file
- Fondasi retention dan archival tersedia: `retentionUntil`, `archivedAt`, `archiveLocation`, `isTemporary`

File asli **tidak boleh** digantikan oleh hasil OCR.

### P0-H — Pembacaan Dokumen (OCR)

OCR menghasilkan `OCRExtraction` yang menyimpan:

- `extractedText` — teks hasil pembacaan
- `status` — `QUEUED / PROCESSING / COMPLETED / FAILED`
- `startedAt`, `completedAt` — timestamp
- `errorMessage` — jika gagal
- Referensi ke `DocumentVersion`

OCR **tidak** melakukan identity matching. OCR hanya membaca dan menyimpan teks.

### P0-I — Ekstraksi Data

`ExtractionResult` menyimpan field terstruktur hasil ekstraksi dari teks OCR:

| Field Canonical | Contoh |
|---|---|
| `NOMOR_SURAT` | 001/PKS/IX/2026 |
| `TANGGAL_SURAT` | 2026-09-01 |
| `PERIHAL` | Permohonan Surat Keterangan |
| `NAMA` | Siti Rahayu |
| `NIK` | 3201010101010001 |
| `NIS` | 2024001 |
| `NISN` | 1234567890 |
| `NIP` | 198001012006011001 |
| `PIHAK_TERKAIT` | — |
| `KATEGORI_DOKUMEN` | — |

`ExtractionResult` bersifat idempotent: satu field per OCR extraction.

Constraint: `@@unique([tenantId, ocrExtractionId, field])`

### P0-J / P0-J.1 — Pencocokan Data (Identity Matching)

#### Struktur

```text
ExtractionResult
       ↓
MatchingResult          (satu per tenant + documentVersion + extractionResult + entityType)
       ↓
MatchingCandidate[]     (satu atau lebih kandidat)
```

#### MatchingResult

Merepresentasikan satu **proses pencocokan** untuk kombinasi:

```text
tenantId + documentVersionId + extractionResultId + entityType
```

Field penting:
- `status` — `COCOK` / `PERLU_DIPERIKSA` / `TIDAK_DITEMUKAN`
- `manuallyConfirmed` — keputusan manual oleh administrator
- `confirmedCandidateId` — kandidat yang dipilih secara manual
- `confirmedByUserId` — siapa yang mengkonfirmasi
- `confirmedAt` — kapan konfirmasi dilakukan

#### MatchingCandidate

Merepresentasikan satu **kandidat entitas** yang berpotensi cocok:

- `matchedEntityId` — ID Siswa atau Guru & Karyawan
- `entityType` — `STUDENT` atau `EMPLOYEE`
- `matchedField` — field yang digunakan untuk mencocokkan
- `candidateScore` — skor deterministic (100 = identifier exact, 60 = nama exact)
- `ranking` — urutan kandidat (1 = terbaik)

#### Aturan Matching P0-J.1 (Deterministic)

**Siswa:** `NISN → NIS → nama ternormalisasi`

**Guru & Karyawan:** `NIP → NIK → nama ternormalisasi`

Tidak ada fuzzy matching atau AI matching pada P0-J.1.

#### Status Determination

| Kondisi | Status |
|---|---|
| 1 kandidat via identifier exact | `COCOK` |
| 1 kandidat via nama (unik) | `COCOK` |
| >1 kandidat | `PERLU_DIPERIKSA` |
| 0 kandidat | `TIDAK_DITEMUKAN` |

---

## Kontrak Idempotensi

### MatchingResult

```text
@@unique([tenantId, documentVersionId, extractionResultId, entityType])
```

### MatchingCandidate

```text
@@unique([tenantId, matchingResultId, matchedEntityId])
```

Persistence menggunakan `upsert`. Database unique constraint adalah **final safeguard**
terhadap duplicate record.

Run #1 = INSERT, Run #2 dan seterusnya = UPDATE/NO-OP.

---

## Perlindungan Keputusan Manual

Jika `MatchingResult.manuallyConfirmed = true`, automatic matcher **dilarang** mengubah:

- `status`
- `confirmedCandidateId`
- `confirmedByUserId`
- `confirmedAt`

Re-run matcher akan mengembalikan `wasReused: true` dan mencatat audit `MATCHING_REUSED`.
Keputusan administrator selalu dipertahankan.

---

## Status Phase

| Phase | Status | Catatan |
|---|---|---|
| P0-C | ✅ COMPLETE | Master identity contract |
| P0-D | ✅ COMPLETE | Letter Template foundation |
| P0-E | ✅ COMPLETE | School Profile & Letterhead |
| P0-F | ✅ COMPLETE | Employee identity contract |
| P0-G | ✅ COMPLETE | Document Intake Foundation |
| P0-H | ✅ COMPLETE | Pembacaan Dokumen (OCR) Foundation |
| P0-I | ✅ COMPLETE | Document Data Extraction Foundation |
| P0-J | ✅ COMPLETE | MatchingResult + MatchingCandidate schema correction |
| P0-J.1 | ✅ COMPLETE | Repository + Identity Matcher Foundation |

---

## Git Baseline Saat Ini

```text
Branch:  main
Commit:  d461321  feat: establish document identity matching foundation
Working tree:  clean
```

> Branch belum tentu tersinkronisasi dengan `origin/main`. Verifikasi dengan `git status`
> sebelum melakukan push.

---

## Status Validasi P0-J.1

| Perintah | Hasil |
|---|---|
| `npx prisma validate` | ✅ PASS |
| `npx prisma generate` | ✅ PASS |
| `npx tsc --noEmit` | ✅ PASS |
| `npm run build` | ✅ PASS (1 pre-existing Turbopack warning pada `filesystem.ts`) |
| `npm test` | ⚠️ NOT VERIFIED — database server `127.0.0.1:15432` tidak reachable |

> Test suite untuk P0-J.1 tersedia di `tests/document-identity-matcher.test.ts`.
> Test harus dijalankan terhadap database development yang aktif.

### Skenario Test yang Tersedia

- NISN exact match → COCOK
- NIS exact match → COCOK
- NIP exact match → COCOK
- NIK exact match → COCOK
- Nama unik → COCOK
- Nama duplikat → PERLU_DIPERIKSA
- Tidak ditemukan → TIDAK_DITEMUKAN
- Guru & Karyawan tanpa NIP (NIP nullable)
- Tenant isolation (Tenant A tidak dapat melihat data Tenant B)
- Idempotency (3 run → tetap 1 MatchingResult, 1 MatchingCandidate)
- Perlindungan keputusan manual (manuallyConfirmed = true)
- Multiple candidates tersimpan sebagai record terpisah

---

## Konsep Legacy yang Telah Dihapus

Konsep-konsep berikut **tidak lagi menjadi bagian dari canonical baseline**:

| Konsep | Status |
|---|---|
| `Student.jurusan` | Dihapus dari schema |
| `AbsenceRecord` | Dihapus dari canonical schema |
| Award / Candidate domain (legacy) | Tidak aktif; jangan dikembalikan tanpa keputusan architecture baru |
| Absence UI lama | Tidak dikembalikan sebagai domain aktif |

Jangan menggunakan terminology lama tersebut sebagai bagian dari active product architecture.

---

## Terminologi UI Canonical

| Konteks | Terminologi Canonical |
|---|---|
| Proses masuknya dokumen | Dokumen Masuk |
| Proses OCR | Pembacaan Dokumen |
| Proses ekstraksi field | Ekstraksi Data |
| Proses matching | Pencocokan Data |
| Entitas peserta didik | Siswa |
| Entitas tenaga pendidik/kependidikan | Guru & Karyawan |
| Template surat | Template Surat |
| Konfigurasi institusi | Identitas Sekolah |
| Hasil pembacaan yang ambigu | Perlu Diperiksa |

Hindari istilah teknis internal (OCR Pipeline, Worker, Intake, Identity Matching) sebagai
label UI apabila padanan Bahasa Indonesia sudah ditetapkan.

---

## Phase Berikutnya

### P0-J.2 — Server Action + Persistence Boundary

Scope:

- Server action pemanggil `matchDocumentIdentity`
- Tenant validation dan RBAC
- Retrieval `ExtractionResult` yang berstatus siap dicocokkan
- Invocation matcher dalam boundary yang aman
- DTO response untuk action caller
- Action tests

**UI matching dan manual confirmation UI belum menjadi bagian P0-J.2.**

---

## Development Protocol

```text
AUDIT      → baca kode dan kontrak yang sudah ada
    ↓
CONTRACT   → sepakati kontrak phase sebelum implementasi
    ↓
IMPLEMENT  → bounded, hanya scope phase ini
    ↓
TEST       → skenario minimal yang membuktikan kontrak terpenuhi
    ↓
VALIDATE   → prisma validate, tsc --noEmit, build
    ↓
COMMIT     → satu commit per phase; pesan deskriptif
    ↓
STOP       → jangan melanjutkan ke phase berikutnya tanpa persetujuan
    ↓
NEXT PHASE → mulai dari AUDIT kembali
```

### Aturan Wajib

Setiap phase harus:

1. **Bounded** — tidak melampaui scope yang disepakati
2. **Atomic** — satu phase = satu commit yang berdiri sendiri
3. **Tenant-safe** — semua query dan mutation harus scoped ke `tenantId`
4. **Auditable** — operasi signifikan meninggalkan audit event
5. **Idempotent** (jika ada persistence) — upsert, bukan insert tanpa guard
6. **Tervalidasi** — `prisma validate`, `tsc --noEmit`, `npm run build` sebelum commit
7. **Clean working tree** — `git diff --check` dan `git status` sebelum pindah ke phase berikutnya

Larangan:

- Jangan melakukan unrelated cleanup dalam satu phase
- Jangan melompat ke phase berikutnya hanya karena implementasi terlihat mudah
- Jangan mengubah schema yang sudah divalidasi tanpa melaporkan lebih dahulu
- Jangan menganggap test "passed" jika database tidak reachable

---

## Stack Teknologi

| Teknologi | Versi |
|---|---|
| Next.js | 16.3.1 |
| React | 19.2.8 |
| TypeScript | 5 |
| PostgreSQL | 17 |
| Prisma | 7.10.x |
| `@prisma/adapter-pg` | — |

---

## Struktur Repository

```text
src/
├── app/                  — Next.js App Router pages dan routes
│   ├── api/              — Route handlers
│   └── ...
├── domains/              — Domain logic
│   ├── document/
│   ├── employee/
│   └── student/
└── platform/             — Infrastructure dan cross-cutting concerns
    ├── actions/          — Server Actions
    ├── auth/             — Authentication
    ├── db/               — Prisma client dan tenant context
    ├── repositories/     — Database access layer
    ├── services/         — Application services
    ├── storage/          — Object storage abstraction
    └── types/            — Shared types dan contracts

prisma/
└── schema.prisma         — Canonical Prisma schema

tests/
└── *.test.ts             — Integration dan unit tests

docs/
├── PRD.md
├── ARCHITECTURE.md
├── DATABASE.md
├── DOMAIN_MODEL.md
├── WORKFLOWS.md
├── RBAC.md
└── VALIDATION_RULES.md
```

---

## Perintah Pengembangan

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Tests (membutuhkan database aktif)
npm test

# Type checking
npx tsc --noEmit

# Schema validation
npx prisma validate

# Generate Prisma client
npx prisma generate

# Diff validation sebelum commit
git diff --check
```

---

## Prinsip Dokumentasi

```text
Kode / Schema / Tests
        ↓
Fakta Terverifikasi
        ↓
Dokumentasi
```

Jangan mendokumentasikan sesuatu yang belum diverifikasi di kode.
Jangan mengimplementasikan sesuatu hanya karena dokumentasi lama menyebutkannya.