# 18 - Migration Readiness & External Integration Boundaries

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Migration Pipeline & External Integration Contract  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Migration Pipeline Architecture

```
[ LocalStorage Data ]
         │
         ▼ (Step 1: Snapshot Extraction)
[ JSON Dump Snapshot ]
         │
         ▼ (Step 2: Schema & Data Invariant Validation)
[ Sanitized Payload ] ──► (Invalid Payload) ──► [ Reject Log Report ]
         │
         ▼ (Step 3: Database Transaction Import)
[ PostgreSQL Database ]
         │
         ▼ (Step 4: Cutover & Switch Primary Repository)
[ PostgreSQL Authoritative Engine ]
```

---

## 2. Migration Conflict Resolution Rules

| Skenario Konflik Data | Aturan Resolusi Otomatis |
|---|---|
| **NIP Pegawai Duplikat di LocalStorage** | Ambil usulan dengan `updated_at` paling mutakhir. Log warning ke migration audit report. |
| **NISN Siswa Tidak Ditemukan di Dapodik** | Daftarkan `Student` sementara dengan status `'Perlu_Verifikasi_Dapodik'` dan buat `ExceptionItem` (`WARNING`). |
| **Audit Event Tanpa `actor_id` Legitim** | Petakan `actor_id` ke `'legacy-migrated-user'`. |

---

## 3. External Integration Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BANYUBIRU ADMINISTRATIVE PLATFORM                        │
└───────────┬──────────────┬──────────────┬──────────────┬─────────────┬──────┘
            │              │              │              │             │
            ▼              ▼              ▼              ▼             ▼
       [ SIMPEG ]     [ Dapodik ]   [ OCR Engine ]   [ Storage ]    [ TTE BSrE ]
```

1. **SIMPEG API (Inbound)**: Mengambil data identitas, pangkat, UKPD, dan riwayat hukdis pegawai.
2. **Dapodik API (Inbound)**: Mengambil data master siswa resmi (NISN, NIS, Nama, Rombel).
3. **OCR Processing Engine (Service Sidecar / Vision API)**: Menerima file image, mengembalikan JSON ekstraksi koordinat & teks.
4. **Cloud Object Storage (GCS / S3)**: Menerima upload biner dokumen & mengembalikan Signed Read/Write URL.
5. **Authentication Provider (Keycloak / OAuth2 OIDC)**: Validasi JWT Bearer token & pertukaran klaim User Role.
6. **TTE BSrE Service**: Melakukan digital signing pada file PDF SK resmi.
