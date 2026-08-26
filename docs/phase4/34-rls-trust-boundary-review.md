# 34 - RLS Trust Boundary & Privilege Escalation Architectural Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E RLS Trust Boundary & Privilege Escalation Vulnerability Audit  
**Status**: REVIEW GATE DELIVERABLE — VULNERABILITY AUDIT  

---

## 1. Executive Summary & Critical Security Finding

Audit arsitektur ini mengidentifikasi **kerentanan eskalasi hak akses (*Privilege Escalation Vulnerability*)** yang sangat krusial pada rancangan RLS Fase 4E-1. 

### Critical Vulnerability Finding:
> Dalam engine PostgreSQL, variabel sesi kustom (*Custom GUC*) seperti `app.current_tenant_id` dan `app.is_admin` **dapat dieksekusi dan diubah oleh ROLE DATABASE APAPUN** yang terhubung, termasuk role runtime biasa `banyubiru_app`.
> 
> Pernyataan:
> ```sql
> SET LOCAL app.is_admin = 'true';
> ```
> dapat dipanggil secara sepihak oleh koneksi aplikasi biasa. Akibatnya, penyerang yang berhasil mengeksekusi SQL Injection atau menembus lapisan aplikasi dapat **secara instan mematikan seluruh pembatas RLS** pada 17 tabel domain!

Oleh karena itu, rancangan RLS Fase 4E-1 **BELUM AMAN** dan **DIBLOKIR (`BLOCKED`)** untuk migrasi sampai batas kepercayaan (*Trust Boundary*) diperbaiki.

---

## 2. Core Concepts: Scope vs Authenticity vs Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             DISTINCTION OF SECURITY CONCEPTS IN POSTGRESQL                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ A. Transaction Scoping (SET LOCAL)                                          │
│    - HANYA menjamin variabel dibersihkan saat transaksi `COMMIT`/`ROLLBACK`.│
│    - TIDAK MEMBERIKAN otentikasi, integritas, atau validasi asal request.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ B. Authentication                                                           │
│    - Verifikasi identitas user di lapisan Auth Service (JWT Token / Session).│
│    - PostgreSQL `SET LOCAL` TIDAK tahu apakah nilai GUC berasal dari JWT    │
│      yang sah atau dari manipulasi input.                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ C. Authorization                                                            │
│    - Penentuan hak akses role database (RBAC) & baris data (RLS).           │
│    - Menyerahkan otorisasi admin pada `app.is_admin = 'true'` adalah CACAT  │
│      KERTAS SECURITY karena role biasa memiliki hak mengubah variabel tsb.  │
├─────────────────────────────────────────────────────────────────────────────┤
│ D. Privilege Elevation Barrier                                              │
│    - Mekanisme yang MENCEGAH role biasa naik tingkat menjadi role berhak   │
│      akses tinggi. Penggunaan `app.is_admin` GUC MENGHANCURKAN barrier ini. │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comprehensive 12-Point Vulnerability Audit

### 1. Bisakah `banyubiru_app` Mengubah `app.current_tenant_id` Secara Bebas?
* **Hasil Audit**: **YA**. PostgreSQL tidak membatasi role `banyubiru_app` untuk mengeksekusi `SET app.current_tenant_id = '<random_uuid>'`.
* **Dampak**: Jika terjadi SQL Injection minor, penyerang dapat membaca data tenant manapun.

### 2. Bisakah `banyubiru_app` Mengubah `app.is_admin` Secara Bebas?
* **Hasil Audit**: **SANGAT BISA**. Perintah `SET LOCAL app.is_admin = 'true'` valid di PostgreSQL untuk role non-superuser.
* **Dampak**: **ESKALASI HAK AKSES TOTAL**. Penyerang mendapatkan akses *read/write/delete* penuh ke 17 tabel di seluruh tenant.

### 3. Bisakah Request Aplikasi Palsu Memalsukan Konteks Tenant?
* **Hasil Audit**: **YA**, jika lapisan aplikasi (*Application Middleware*) tidak memverifikasi JWT Token / Session secara ketat sebelum menetapkan variabel `SET LOCAL`.

### 4. Bisakah Prisma `$transaction` Membuat Konteks Untrusted?
* **Hasil Audit**: **YA**, jika metode `$executeRaw` di Prisma menerima parameter string mentah dari HTTP request tanpa validasi tipe UUID v7 yang ketat.

### 5. Apakah `SET LOCAL` Memberikan Integritas/Otentisitas Data?
* **Hasil Audit**: **TIDAK**. `SET LOCAL` **hanya memberikan Transaction Scoping**, bukan otentisitas atau integritas.

### 6. Bisakah Custom GUC PostgreSQL Dimanipulasi Role Aplikasi?
* **Hasil Audit**: **YA**. Dalam arsitektur bawaan PostgreSQL, seluruh Custom GUC (`app.*`) bersifat *read-write* bagi sesi yang aktif.

### 7. Apakah Mekanisme `app.is_admin = true` Merupakan Trust Boundary yang Aman?
* **Hasil Audit**: **TIDAK SAMA SEKALI**. Mekanisme ini merupakan **vektor kerentanan keamanan utama** (*Critical Privilege Escalation Vector*).

### 8. Bagaimana Akses Admin Lintas Tenant Seharusnya Dirancang?
* **Rekomendasi Arsitektur Terbaik**:
  - **Dilarang keras menggunakan GUC `app.is_admin`**.
  - Operasi admin lintas-tenant wajib menggunakan **Dua Role Database Terpisah**:
    1. Role `banyubiru_app`: DML terikat RLS per tenant.
    2. Role `banyubiru_admin_app`: Role terpisah dengan *Connection Pool* terpisah, terautentikasi dengan kredensial DB khusus admin, dan memiliki RLS Admin Policy khusus yang diaudit ketat.

### 9. Perilaku RLS Saat Konteks Tenant Absen (Kosong)
* **Perilaku**: **Fail-Closed**.
* **Ekspresi**: `NULLIF(current_setting('app.current_tenant_id', true), '')` mengembalikan `NULL`. Pembandingan `tenant_id = NULL` bernilai `UNKNOWN/FALSE`, mengembalikan 0 baris data dan menolak `INSERT`.

### 10. Perilaku RLS Saat Konteks Tenant Tidak Valid
* **Perilaku**: **Fail-Closed**. Cast string non-UUID ke `::uuid` memicu SQL Exception, membatalkan transaksi.

### 11. Cara Mencegah Eskalasi Akses pada Request Aplikasi Biasa
1. **Hapus total GUC `app.is_admin`** dari seluruh RLS Policy.
2. Kebijakan RLS pada 17 tabel **HANYA MEMERIKSA `tenant_id`**:
   ```sql
   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
   ```
3. Role `banyubiru_app` tidak pernah memiliki kemampuan melewati aturan ini.

### 12. Pengaruh Connection Pooling pada Keamanan Konteks
* `SET LOCAL` mencegah *context leakage* antartransaksi pada PgBouncer, namun integritas konteks bergantung 100% pada Auth Middleware aplikasi yang memvalidasi token pengguna sebelum mengeksekusi `SET LOCAL`.

---

## 4. Threat & Vulnerability Matrix

| Vulnerability Threat | Attack Path | Current Protection (Phase 4E-1) | Remaining Risk | Severity | Required Architectural Mitigation |
|---|---|---|---|---|---|
| **Admin Privilege Escalation via GUC** | Penyerang mengeksekusi `SET LOCAL app.is_admin = 'true'` via SQLi atau app breach | Tidak Ada (Policy mengevaluasi `OR app.is_admin = true`) | **100% Bypass RLS pada seluruh tenant** | **CRITICAL** | **Hapus total GUC `app.is_admin`**. Gunakan Role DB terpisah `banyubiru_admin_app`. |
| **Tenant Context Tampering** | Penyerang mengubah `app.current_tenant_id` ke UUID tenant lain | Tidak Ada di DB layer (GUC dapat diubah oleh role `banyubiru_app`) | Akses data tenant lain jika app terpancing | **HIGH** | Validasi UUID v7 & JWT di App Auth Guard sebelum `SET LOCAL`. Tambahkan Composite FKs. |
| **Connection Leakage in PgBouncer** | Transaksi selesai tanpa mereset `tenant_id` | Diproteksi oleh `SET LOCAL` | Low (jika transaksi tidak menggunakan `SET LOCAL`) | **MEDIUM** | Wajibkan pembungkus `SET LOCAL` dalam transaksi interaktif Prisma. |
| **Fail-Open on Missing Context** | Query dijalankan tanpa `app.current_tenant_id` | Diproteksi oleh `NULLIF(...)` | Zero (Fail-Closed) | **LOW** | Pertahankan ekspresi `NULLIF(..., '')::uuid`. |

---

## 5. Required Architectural Corrections (Before Migration)

1. **Eliminasi Total `app.is_admin`**:
   Atribut `app.is_admin` dihapus dari seluruh skrip DDL RLS Policy.
2. **Skema RLS Murni (Single-Tenant Enforcement)**:
   ```sql
   -- Standard RLS Policy untuk role banyubiru_app:
   CREATE POLICY tenant_isolation_policy ON <table_name>
   FOR ALL TO banyubiru_app
   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
   WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
   ```
3. **Pemisahan Role Administrator (`banyubiru_admin_app`)**:
   Operasi lintas tenant dilakukan melalui role database terpisah `banyubiru_admin_app` dengan kredensial terisolasi dan *Connection Pool* terpisah.

---

## 6. Final Status Determination

> **RLS TRUST BOUNDARY BLOCKED**

### Alasan Pemblokiran:
Mekanisme `app.is_admin = 'true'` pada RLS Policy Fase 4E-1 terbukti secara teknis membawa kerentanan *Privilege Escalation* tingkat **CRITICAL**. Migrasi PostgreSQL **DILARANG DIJALANKAN** sampai RLS Policy diselaraskan menggunakan *Single-Tenant Enforcement* tanpa GUC admin.

---

*Akhir Dokumen Laporan Peninjauan RLS Trust Boundary & Privilege Escalation Fase 4E-2.*
