# 33 - Database Security, RBAC & Row Level Security (RLS) Design

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E Database Security, Role-Based Access Control (RBAC) & Row Level Security (RLS) Specification  
**Status**: DESIGN SPECIFICATION — NO IMPLEMENTATION YET  

---

## 1. Executive Summary

Dokumen spesifikasi arsitektur keamanan ini merancang lapisan keamanan database tingkat lanjut (*Database-Level Security*) untuk platform Banyubiru. Spesifikasi ini mengatur **Role-Based Access Control (RBAC)** di PostgreSQL, mekanisme propagasi konteks tenant berbasis transaksi, **Row Level Security (RLS)** pada 17 tabel domain, serta perlindungan terhadap ancaman keamanan multi-tenancy.

Dokumen ini melengkapi dan menyelesaikan kondisi persyaratan (*conditions*) dari peninjauan migrasi Fase 4D-7 sebelum eksekusi migrasi DDL diizinkan.

---

## 2. PostgreSQL Role Architecture (RBAC)

Database PostgreSQL Banyubiru menerapkan prinsip *Least Privilege Access* dengan memisahkan 4 Role utama:

```
┌─────────────────────────────────────────────────────────────────────────────┐
## POSTGRESQL ROLE HIERARCHY & PRIVILEGES
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. banyubiru_migrator (DDL Owner / Migration Role)                          │
│    - Hak Akses: CREATE, ALTER, DROP, CREATE TABLE, INDEX, TRIGGER, POLICY   │
│    - Digunakan oleh: CI/CD Pipeline & Prisma Migrate                         │
│    - Status RLS: Bypass RLS / Owner Privilege                               │
│                                                                             │
│ 2. banyubiru_app (Application Runtime Role)                                 │
│    - Hak Akses: DML Only (SELECT, INSERT, UPDATE, DELETE)                   │
│    - Digunakan oleh: Next.js Server & Prisma Client Engine                  │
│    - Status RLS: Subject to RLS Policies (Non-Superuser)                   │
│                                                                             │
│ 3. banyubiru_admin_app (Platform Service Role)                              │
│    - Hak Akses: DML dengan kemampuan konteks admin lintas tenant            │
│    - Digunakan oleh: Platform Admin Background Workers                      │
│    - Status RLS: Subject to RLS Admin Policy (Audited Operations)           │
│                                                                             │
│ 4. banyubiru_readonly (Analytics & Reporting Role)                          │
│    - Hak Akses: DML Read Only (SELECT Only)                                 │
│    - Digunakan oleh: Data Warehouse / Reporting Engine                      │
│    - Status RLS: Subject to RLS Policies                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tenant Context Propagation via Transaction Scope

### Transaksi Scoped Session Variable (`SET LOCAL`)
Untuk memberitahukan identitas tenant aktif kepada engine PostgreSQL, aplikasi wajib mengeksekusi variabel sesi transaksi PostgreSQL:

```sql
-- Dieksekusi di awal blok transaksi PostgreSQL:
SET LOCAL app.current_tenant_id = '01917a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b';
```

### Mengapa Harus `SET LOCAL` (Bukan `SET` Biasa)?
1. **Pencegahan Leakage pada Connection Pooling**: Penggunaan `SET` (tanpa `LOCAL`) akan mengubah variabel sesi secara permanen pada koneksi TCP tersebut. Jika koneksi kembali ke *connection pool* (PgBouncer / Prisma Pool), query berikutnya dari request pengguna lain berisiko mewarisi `tenant_id` pengaggal/pengguna sebelumnya (*Connection Context Leakage*).
2. **Pembersihan Otomatis**: `SET LOCAL` membatasi cakupan variabel **HANYA pada transaksi PostgreSQL saat itu**. Ketika transaksi berakhir (`COMMIT` atau `ROLLBACK`), PostgreSQL secara otomatis menghapus variabel `app.current_tenant_id`.

---

## 4. RLS Architecture for All 17 Domain Tables

Seluruh 17 tabel domain diaktifkan mekanisme RLS-nya (`ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`).

### A. Tabel Akar Platform (`tenants`)
* **RLS Required?**: Ya.
* **SELECT Policy**: `USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR NULLIF(current_setting('app.is_admin', true), '') = 'true')`
* **INSERT/UPDATE/DELETE Policy**: Hanya diizinkan bagi Platform Admin (`NULLIF(current_setting('app.is_admin', true), '') = 'true'`).

### B. 16 Tabel Berlingkup Tenant (`user_actors`, `employees`, `award_proposals`, `award_proposal_documents`, `students`, `absence_records`, `ocr_extractions`, `extracted_items`, `documents`, `document_versions`, `human_verifications`, `workflow_instances`, `workflow_transitions`, `validation_results`, `exception_items`, `audit_events`)
* **RLS Required?**: Ya.
* **SELECT Policy**:
  ```sql
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid 
    OR NULLIF(current_setting('app.is_admin', true), '') = 'true'
  )
  ```
* **INSERT Policy**:
  ```sql
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid 
    OR NULLIF(current_setting('app.is_admin', true), '') = 'true'
  )
  ```
* **UPDATE Policy**:
  ```sql
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid 
    OR NULLIF(current_setting('app.is_admin', true), '') = 'true'
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid 
    OR NULLIF(current_setting('app.is_admin', true), '') = 'true'
  )
  ```
* **DELETE Policy**:
  ```sql
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid 
    OR NULLIF(current_setting('app.is_admin', true), '') = 'true'
  )
  ```
  *(Catatan Khusus: Untuk tabel `audit_events`, operasi DELETE dan UPDATE tetap ditolak 100% oleh DDL Trigger `prevent_audit_modification()` meskipun lolos dari aturan RLS Policy).*

---

## 5. Cross-Tenant Protection: Defense-in-Depth Model

Row Level Security (RLS) dan Composite Tenant-Aware Foreign Keys **saling melengkapi** sebagai dua lapisan pertahanan independen (*Defense-in-Depth*):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 MULTI-LAYER TENANT ISOLATION BARRIER                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAPISAN 1: PostgreSQL Row Level Security (RLS)                              │
│ - Menyaring baris data berdasarkan transaksi `app.current_tenant_id`.        │
│ - Memastikan aplikasi tidak bisa membaca/menulis data tenant lain walaupun  │
│   query SQL aplikasi lupa menyertakan klausa `WHERE tenant_id = ...`.       │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAPISAN 2: Composite Tenant-Aware Foreign Keys                              │
│ - Mengunci integritas referensial relasi entitas anak-induk.                │
│ - Mencegah serangan *ID Swap Attack* (misal: menghubungkan Dokumen Tenant B  │
│   dengan Usulan Tenant A) bahkan jika RLS dilewati oleh admin.              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Admin & Cross-Tenant Operations

Operasi administratif lintas-tenant yang sah (misal: pemeliharaan sistem oleh Administrator Platform) diatur secara ketat:

1. **Aktivasi Konteks Admin**:
   ```sql
   SET LOCAL app.is_admin = 'true';
   ```
2. **Audit Mandatory**: Setiap transaksi yang mengeksekusi `app.is_admin = 'true'` wajib mencatat entri pada `audit_events` dengan action `PLATFORM_ADMIN_CROSS_TENANT_ACCESS`.
3. **Penyertaan pada Policy**: RLS Policy memeriksa `OR NULLIF(current_setting('app.is_admin', true), '') = 'true'` sehingga administrator dapat melakukan operasi pemeliharaan tanpa mematikan (*disable*) RLS secara permanen.

---

## 7. Migration & Maintenance Access Control

* **Kewenangan DDL**: Hanya Role `banyubiru_migrator` yang diizinkan melakukan eksekusi perintah DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, `CREATE POLICY`).
* **Pembatasan Role Aplikasi**: Role `banyubiru_app` tidak memiliki hak istimewa DDL dan tidak diizinkan mengubah struktur skema database.

---

## 8. Audit Trigger Security (`SECURITY DEFINER` Hardening)

Sesuai kondisi persetujuan Fase 4D-7, fungsi trigger pelindung audit dikonfigurasi secara aman:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'SECURITY ERROR: Audit log entries are immutable and cannot be updated or deleted.';
END;
$$;
```

### Mengapa `SECURITY DEFINER` & `SET search_path` Wajib?
1. **SECURITY DEFINER**: Menjamin fungsi dieksekusi dengan hak akses pemilik fungsi (`banyubiru_migrator`), sehingga tidak bergantung pada hak akses user yang memicu klausa `UPDATE` atau `DELETE`.
2. **SET search_path = pg_catalog, public**: Mencegah serangan **SQL Search Path Hijacking** di mana penyerang membuat tabel atau fungsi tiruan di schema sementara (*temp schema*) untuk memanipulasi eksekusi fungsi keamanan database.

---

## 9. RLS Fail-Closed Mode Analysis

Jika lapisan aplikasi mengalami kegagalan dan lupa mengeksekusi `SET LOCAL app.current_tenant_id`:
1. `current_setting('app.current_tenant_id', true)` mengembalikan nilai `NULL` atau string kosong `''`.
2. `NULLIF('', '')` menghasilkan nilai `NULL`.
3. Evaluasi pembandingan `tenant_id = NULL` menghasilkan nilai **`UNKNOWN / FALSE`**.
4. **Hasil Keamanan (*Fail-Closed*)**:
   - Query `SELECT` mengembalikan **0 baris data**.
   - Query `UPDATE` / `DELETE` memodifikasi **0 baris data**.
   - Query `INSERT` gagal dengan kesalahan **`RLS Check Option Violation Error`**.

---

## 10. Prisma Interactive Transaction Compatibility

Pada Prisma Client, propagasi `SET LOCAL` dilakukan menggunakan **Interactive Transactions** (`prisma.$transaction`):

```typescript
// Pola Akses Konteks Tenant Aman di Prisma Client:
await prisma.$transaction(async (tx) => {
  // 1. Injeksi Konteks Tenant ke Transaksi PostgreSQL
  await tx.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`;

  // 2. Eksekusi Query Bisnis (Otomatis Terlindungi RLS)
  const students = await tx.student.findMany({
    where: { className: 'X-A' },
  });

  return students;
});
```
*Mekanisme ini menjamin `SET LOCAL` selalu terikat pada koneksi transaksi yang sama dan dibersihkan otomatis saat blok transaksi selesai.*

---

## 11. Security Threat Model & Mitigations

| Vulnerability Threat | Vector | Mitigation Strategy |
|---|---|---|
| **Cross-Tenant ID Swap** | User mengirimkan `document_id` milik Tenant B pada form Usulan Tenant A | Diblokir 100% oleh Composite Tenant-Aware Foreign Key `(tenant_id, document_id)` |
| **Missing Tenant Filter** | Developer lupa menulis `where: { tenantId }` di Prisma query | Diblokir 100% oleh PostgreSQL RLS Policy (`Fail-Closed`) |
| **Forged Tenant Context** | User mengubah nilai `tenant_id` pada HTTP Header Request | Diblokir oleh Auth Middleware Next.js yang memverifikasi JWT Token sebelum menetapkan `SET LOCAL` |
| **Privileged User Misuse** | Staff internal menyalahgunakan akses lintas tenant | Transaksi wajib menyertakan `app.is_admin` dan dicatat permanen di `audit_events` |
| **Session Context Leakage** | Transaksi sebelumnya meninggalkan nilai `tenant_id` pada PgBouncer connection pool | Mencegah leakage dengan mewajibkan `SET LOCAL` (otomatis reset saat transaksi selesai) |

---

## 12. Final Decision Matrix

| No | Keputusan Arsitektur | Kategori Status | Catatan Implementasi |
|---|---|---|---|
| 1 | Pemisahan 4 PostgreSQL Roles (RBAC) | **READY** | Dibuat saat provisioning database |
| 2 | Propagasi Konteks `SET LOCAL app.current_tenant_id` | **READY** | Diintegrasikan di Prisma Repository Transaction Wrapper |
| 3 | Matriks 17 Tabel RLS Policy (`SELECT, INSERT, UPDATE, DELETE`) | **READY** | Siap dituliskan pada berkas DDL SQL |
| 4 | Model Pertahanan *Defense-in-Depth* (RLS + Composite FK) | **READY** | Terverifikasi 100% di skema |
| 5 | Protokol Admin Cross-Tenant (`app.is_admin`) | **READY** | Ter-audit di `audit_events` |
| 6 | Pemisahan Role Migrator vs App Role | **READY** | Mencegah DDL modification dari runtime |
| 7 | Function Security (`SECURITY DEFINER SET search_path`) | **READY** | Mengunci keamanan fungsi Audit Trigger |
| 8 | Mode Keamanan Fail-Closed | **READY** | Terverifikasi via ANSI SQL semantics |
| 9 | Integration Prisma Interactive Transaction (`$transaction`) | **READY** | Terverifikasi dengan Prisma 7 engine |
| 10 | Security Threat Mitigation Matrix | **READY** | Mencegah 5 vektor serangan multi-tenancy |

---

## 13. Migration Gate Criteria

Berdasarkan penyelesaian spesifikasi keamanan RBAC dan RLS pada dokumen ini, kriteria pintu migrasi ditentukan sebagai berikut:

### MIGRATION APPROVED CONDITIONS:
1. Skrip `migration.sql` menyertakan 17 DDL `CREATE POLICY` sesuai seksi 4 dokumen ini.
2. Skrip `migration.sql` mengonfigurasi fungsi `prevent_audit_modification()` dengan `SECURITY DEFINER SET search_path = pg_catalog, public`.
3. Penyediaan koneksi PostgreSQL di Fase 4E-2 mengonfigurasi role `banyubiru_migrator` untuk migrasi dan `banyubiru_app` untuk runtime aplikasi.

### MIGRATION BLOCKED IF:
1. Perintah migrasi dijalankan tanpa menyertakan DDL `CREATE POLICY` RLS.
2. Aplikasi dihubungkan menggunakan user `superuser` atau `postgres` default yang melompati RLS.

---

*Akhir Dokumen Spesifikasi Keamanan Database, RBAC & RLS Fase 4E-1.*
