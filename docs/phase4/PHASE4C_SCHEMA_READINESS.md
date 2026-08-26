# PHASE 4C - Master Relational Schema Readiness Assessment

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Schema Readiness & Architecture Approval Matrix  
**Status**: DESIGN-FIRST SPECIFICATION COMPLETED  

---

## 1. Status Overview Matrix

```
[ READY ]      ──► Phase 4C Relational Schema & Prisma Design Specification Complete
[ NOT READY ]  ──► Code-Level ORM Setup (Prisma Package Installation & Postgres Connection)
[ BLOCKED ]    ──► Database Host Infrastructure Provisioning (PostgreSQL Instance / Cloud SQL)
```

---

## 2. Status Categorization

### A. READY (Spesifikasi & Desain Arsitektur Selesai 100%)
- [x] Transkripsi 17 Entitas Domain ke Model Relasional 3NF ter-normalisasi ([19-relational-schema.md](file:///d:/banyubiru-next/docs/phase4/19-relational-schema.md)).
- [x] Rancangan Model & Enum Prisma ORM ([20-prisma-design.md](file:///d:/banyubiru-next/docs/phase4/20-prisma-design.md)).
- [x] Strategi Pengindeksan B-Tree Multi-Tenancy & Antrean ([21-index-strategy.md](file:///d:/banyubiru-next/docs/phase4/21-index-strategy.md)).
- [x] Batasan Integritas Data, CHECK Constraints, & Non-Database Boundaries ([22-constraint-strategy.md](file:///d:/banyubiru-next/docs/phase4/22-constraint-strategy.md)).
- [x] Pemetaan Batas Transaksi, Optimistic & Pessimistic Locking ([23-transaction-mapping.md](file:///d:/banyubiru-next/docs/phase4/23-transaction-mapping.md)).
- [x] Konsep Isolasi Tenant & Policy Row-Level Security (RLS) ([24-tenant-isolation-design.md](file:///d:/banyubiru-next/docs/phase4/24-tenant-isolation-design.md)).
- [x] Pemetaan Matriks Migrasi Data LocalStorage ke Relasional ([25-migration-mapping.md](file:///d:/banyubiru-next/docs/phase4/25-migration-mapping.md)).

---

### B. NOT READY (Dikerjakan Pada Fase 4D / 4E)
- [ ] Instalasi package `prisma` & `@prisma/client` via `npm install`.
- [ ] Penulisan biner file `prisma/schema.prisma` fisik di lingkungan dev.
- [ ] Implementasi driver `PostgresRepository<T>` pengganti `LocalStorageRepository<T>`.
- [ ] Skrip otomatisasi migrasi ETL dari LocalStorage ke PostgreSQL.

---

### C. BLOCKED (Membutuhkan Penyediaan Resource Infrastructure)
- [ ] **PostgreSQL Database Server**: Belum ada instance PostgreSQL (Local Docker Container / Cloud Managed PostgreSQL DB) yang dikonfigurasi pada `.env.local`.
- [ ] **Cloud Object Storage (GCS/S3)**: Belum ada bucket credential untuk menyimpan file biner dokumen fisik.

---

## 3. OPEN DECISIONS (Keputusan Terbuka Arsitektur)

1. **UUID Versioning**: Apakah akan menggunakan **UUID v4** (`gen_random_uuid()`) atau **UUID v7** (time-ordered UUID untuk performa indeks B-Tree yang lebih cepat)?
2. **Batch Audit Storage**: Apakah event audit bertrafik tinggi akan langsung ditulis ke PostgreSQL secara sinkron atau melalui antrean async (misal: Redis PubSub / Message Queue)?

---

## 4. SCHEMA RISKS & MITIGATION

1. **Risiko**: *Large Text OCR Storage Bloat* (Menyimpan teks OCR berukuran sangat besar di `extracted_items.ocr_text`).  
   **Mitigasi**: Gunakan tipe data `TEXT` dan lakukan pengarsipan otomatis untuk batch yang sudah berusia > 1 tahun.
2. **Risiko**: *Cross-Tenant Data Leakage* jika developer lupa menyertakan `tenant_id` pada custom query.  
   **Mitigasi**: Wajibkan skema RLS (Row Level Security) aktif di level database PostgreSQL.

---

## 5. Summary Check: Non-Database Boundaries Enforced

Telah dipastikan bahwa data berikut **TIDAK DIMASUKKAN KE DALAM DATABASE**:
- UI State & Layout Controls
- Presentation Formatting & Styling
- Agregasi Rekapitulasi Dashboard sebagai Source-of-Truth
- Temporary Form Drafts
- File Biner Dokumen (Hanya path & metadata yang disimpan)

---

*Akhir Dokumen Penilaian Kesiapan Skema Fase 4C.*
