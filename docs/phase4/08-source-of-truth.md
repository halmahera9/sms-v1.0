# 08 - Source of Truth & External Integration Analysis

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Source of Truth, Metric Rules & External Integration Analysis  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Source of Truth vs. Derived Metrics Mapping

```
                                  [ PRIMARY SOURCE OF TRUTH TABLES ]
       ┌───────────────────────────────┬───────────────────────────────┐
       ▼                               ▼                               ▼
[award_proposals]              [absence_records]               [exception_items]
       │                               │                               │
       └───────────────────────┬───────┴───────────────────────────────┘
                               │
                               ▼ (Read-Only Dynamic Aggregation)
                     [PlatformOperationalService]
                               │
                               ├──► pendingVerifications
                               ├──► pendingApprovals
                               ├──► totalOpenExceptions
                               └──► totalActionableWorkQueue
```

### Rule Penting Arsitektur Metrik:
1. **Counter Dashboard BUKAN Source of Truth**: Counter pada UI/Dashboard tidak boleh disimpan sebagai kolom mutable di database utama.
2. **Kalkulasi Dinamis / View**: Metrik dihitung secara dinamis dari tabel entitas resmi atau di-cache sementara via Redis/Materialized View.

---

## 2. Inventaris Lengkap Asumsi Mock / Hardcoded Saat Ini

Berdasarkan audit menyeluruh atas basis kode, berikut adalah daftar asumsi yang masih berstatus **MOCK / HARDCODED**:

| # | Komponen Data | Status Mock / Hardcoded Saat Ini | Rencana Penggantian Fase Production |
|---|---|---|---|
| 1 | **1,078 Proposals Pegawai** | Generator otomatis `generateMockProposals()` di `src/domains/employee/awards/repository.ts`. | Integrasi API SIMPEG Pemprov DKI / PostgreSQL Table. |
| 2 | **8 Master Student Dapodik** | Hardcoded array 8 siswa di `src/domains/student/repository.ts`. | Integrasi API Dapodik Kemendikbud. |
| 3 | **Dokumen OCR File & URL** | Mock file `/placeholder-doc.png` & generator string file di `StudentWorkspace.tsx`. | Upload file fisik ke Cloud Storage (GCS/S3) & Tesseract/Cloud Vision API. |
| 4 | **Aktor Role Toggle** | Tombol switcher UI (`Admin`, `Verifikator`, `User`) di `UnifiedNavigation.tsx`. | OAuth2 / OIDC / NextAuth dengan JWT Session riil. |
| 5 | **Storage Persistence** | Membaca & menulis ke `window.localStorage` browser via `LocalStorageRepository`. | Database Client PostgreSQL (Prisma ORM / Kysely Driver). |

---

## 3. Identifikasi Integrasi Eksternal (External System Integration Assumptions)

1. **Sistem Informasi Manajemen Kepegawaian (SIMPEG)**:
   - *Arah*: Inbound Read / Sync (Master Data Pegawai, Riwayat Hukdis, Masa Kerja).
2. **Data Pokok Pendidikan (Dapodik Kemendikbud)**:
   - *Arah*: Inbound Read / Sync (Master Data Siswa, NISN, Rombel/Kelas).
3. **Cloud Object Storage (Google Cloud Storage / AWS S3)**:
   - *Arah*: Inbound Upload / Outbound Download Signed URL (Penyimpanan Dokumen Pendukung & Hasil OCR).
4. **Optical Character Recognition (OCR Engine / Google Cloud Vision)**:
   - *Arah*: Outbound Process / Inbound JSON Response (Ekstraksi Teks Surat Fisik).
5. **Identity & Authentication Provider (Keycloak / Google Workspace / NextAuth)**:
   - *Arah*: Auth Handshake & JWT Token Validation.
