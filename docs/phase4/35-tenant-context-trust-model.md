# 35 - Tenant Context Trust Model & Authentication Boundary Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E Tenant Context Trust Model & Threat Vector Analysis  
**Status**: REVIEW GATE DELIVERABLE — TRUST MODEL AUDIT  

---

## 1. Executive Summary & Core Security Question

Audit arsitektur ini menjawab pertanyaan mendasar mengenai batas kepercayaan (*Trust Model*):
> **"Apakah `app.current_tenant_id` secara otomatis dapat dipercaya (*trustworthy*) saat disuplai oleh lapisan aplikasi?"**

### Kesimpulan Utama:
> **"Menghapus `app.is_admin` TIDAK SECARA OTOMATIS membuat `app.current_tenant_id` menjadi terpercaya."**
> 
> Nilai `app.current_tenant_id` pada engine PostgreSQL **hanya seaman mekanisme autentikasi & pengisian variabel di lapisan aplikasi**. Jika lapisan aplikasi menerima `tenant_id` dari input HTTP client yang tidak tervalidasi, atau jika role `banyubiru_app` dapat memanipulasi variabel tersebut tanpa memverifikasi keanggotaan aktor, maka **batas kepercayaan database (*Database Trust Boundary*) dapat ditembus**.

---

## 2. Distinction of Security Domains

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 DISTINCTION OF SECURITY DOMAINS & RESPONSIBILITIES          │
├─────────────────────────────────────────────────────────────────────────────┤
│ A. User Authentication                                                      │
│    - Tanggung Jawab: Next.js Auth Service (JWT / Session Manager).          │
│    - Mengautentikasi kredensial pengguna dan menerbitkan JWT Token resmi.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ B. Tenant Membership Authorization                                          │
│    - Tanggung Jawab: Server-side Auth Guard & PostgreSQL `user_actors`.     │
│    - Memastikan aktor U1 (Tenant A) TIDAK DAPAT mengklaim keanggotaan       │
│      Tenant B. Stored secara absolut di kolom `user_actors.tenant_id`.       │
├─────────────────────────────────────────────────────────────────────────────┤
│ C. Tenant Context Propagation                                               │
│    - Tanggung Jawab: Prisma Interactive Transaction Wrapper.                 │
│    - Meneruskan `actor_id` & `tenant_id` dari token terverifikasi ke PG via  │
│      perintah `SET LOCAL`.                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ D. Tenant Context Integrity & Database Enforcement                          │
│    - Tanggung Jawab: PostgreSQL RLS Policies & Verification Helper.         │
│    - PostgreSQL memvalidasi bahwa `tenant_id` yang diset cocok dengan       │
│      `tenant_id` milik `actor_id` pada tabel `user_actors`.                │
├─────────────────────────────────────────────────────────────────────────────┤
│ E. Administrative Cross-Tenant Authorization                                │
│    - Tanggung Jawab: Role Database Terpisah `banyubiru_admin_app`.          │
│    - Koneksi terisolasi khusus platform admin dengan audit ketat.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Explicit Attack Scenario: Tenant Impersonation Attempt

### Skenario Serangan:
Seorang pengguna terautentikasi dari **Tenant A** (`UserActor_A`, `tenant_id = Tenant_A`) mencoba memaksa aplikasi untuk menetapkan konteks ke **Tenant B**:
```sql
SET LOCAL app.current_tenant_id = 'UUID_TENANT_B';
```

### Analisis Kerentanan & Blokade Serangan:

1. **Jalur Serangan 1: Client Mengirim `x-tenant-id: Tenant_B` di HTTP Header**:
   - *Tanpa Perlindungan*: Jika aplikasi mengambil `tenant_id` dari header HTTP client ➔ **SERANGAN BERHASIL (SECURITY BREACH)**.
   - *Dengan Perlindungan*: Aplikasi **WAJIB MENOLAK** seluruh input tenant dari client HTTP header/body. `tenant_id` HANYA diekstrak dari payload JWT Server-Side yang telah ditandatangani secara kriptografis (*Cryptographically Signed JWT*).

2. **Jalur Serangan 2: Penyerang Melakukan SQL Injection via Parameter Query**:
   - *Tanpa Perlindungan*: Penyerang mengeksekusi `SET LOCAL app.current_tenant_id = 'Tenant_B'` via SQLi ➔ **SERANGAN BERHASIL** jika RLS hanya memeriksa GUC.
   - *Dengan Perlindungan (Defense-in-Depth)*: PostgreSQL RLS tidak hanya memeriksa `app.current_tenant_id`, melainkan memverifikasi keanggotaan aktor via fungsi pembantu `set_tenant_context(actor_id, tenant_id)` yang menguji:
     ```sql
     EXISTS (
       SELECT 1 FROM user_actors 
       WHERE id = p_actor_id 
         AND tenant_id = p_tenant_id 
         AND status = 'ACTIVE'
     )
     ```
     Karena `UserActor_A` tercatat di database sebagai milik `Tenant_A`, pengujian keanggotaan `(UserActor_A, Tenant_B)` **GAGAL DAN DITOLAK OLEH POSTGRESQL**!

---

## 4. Comprehensive 20-Point Technical Trust Audit

1. **Who authenticates the user?**: Lapisan aplikasi server-side (NextAuth / Server Component Auth Guard) melalui verifikasi Kriptografis JWT.
2. **Who determines user's tenant membership?**: Lapisan server-side dengan membaca kolom `tenant_id` pada entitas `user_actors` saat login.
3. **Where is tenant membership stored?**: Tersimpan secara permanen pada tabel `user_actors.tenant_id` di database PostgreSQL.
4. **How does application derive `tenant_id`?**: Dari JWT Payload terverifikasi di server (`session.user.tenantId`), **bukan dari input client**.
5. **Can client/browser directly provide `tenant_id`?**: **DILARANG KERAS**. Seluruh parameter `tenant_id` dari HTTP client dianggap *untrusted*.
6. **Can authenticated user change `tenant_id` in request?**: **TIDAK BISA**, karena token JWT ditandatangani dengan secret key server (`JWT_SECRET`).
7. **Can database role `banyubiru_app` execute `SET LOCAL` arbitrarily?**: **YA**, secara teknis di PostgreSQL role koneksi dapat mengeksekusi `SET LOCAL`.
8. **What happens if application itself is compromised?**: Jika aplikasi terkena RCE/SQLi, penyerang bisa mengubah GUC. Oleh karena itu, PostgreSQL diwajibkan memverifikasi relasi `(actor_id, tenant_id)`.
9. **Can malicious request cause application to set wrong tenant?**: Tidak, jika `tenant_id` diikat mutlak pada session token server.
10. **Can PostgreSQL independently verify tenant membership?**: **BISA**, melalui fungsi `set_tenant_context(actor_id, tenant_id)` yang memvalidasi keberadaan pasangan aktor-tenant di tabel `user_actors`.
11. **How should tenant context be derived?**: Dari kombinasi **Authenticated Actor Identity (`actor_id`)** + **Validated Tenant ID (`tenant_id`)** yang diverifikasi dua arah.
12. **How connection pooling affects design**: `SET LOCAL` membatasi variabel pada transaksi aktif. Transaksi wajib mengeksekusi `set_tenant_context(actor_id, tenant_id)` secara atomik di awal transaksi.
13. **Atomic establishment**: Menggunakan fungsi pembantu PostgreSQL:
    ```sql
    SELECT set_tenant_context('actor-uuid'::uuid, 'tenant-uuid'::uuid);
    ```
14. **Missing tenant context behavior**: **Fail-Closed** (0 baris dikembalikan, `INSERT` ditolak).
15. **Invalid tenant context behavior**: **Fail-Closed** (SQL Exception dipicu, transaksi dibatalkan).
16. **Isolation of cross-tenant admin operations**: Menggunakan role database terpisah `banyubiru_admin_app` dengan kredensial DB terisolasi.
17. **Privileges `banyubiru_app` MUST NOT have**: DDL (`CREATE`, `ALTER`, `DROP`), `TRUNCATE`, `SUPERUSER`, `BYPASSRLS`.
18. **Privileges `banyubiru_admin_app` may have**: Akses DML ter-audit khusus admin lintas tenant.
19. **Preventing application from changing sensitive GUCs**: GUC `app.is_admin` **dihapus total**. GUC `app.current_tenant_id` dan `app.current_actor_id` diisi secara aman via fungsi `set_tenant_context()`.
20. **Verify actor-to-tenant membership in RLS**: **WAJIB**. RLS memvalidasi konteks berdasarkan aktor terverifikasi.

---

## 5. Threat & Mitigation Matrix

| Vulnerability Threat | Attack Path | Existing Protection | Remaining Risk | Severity | Required Architectural Mitigation |
|---|---|---|---|---|---|
| **Client-side Tenant Forgery** | User mengubah header HTTP `x-tenant-id: tenant_B` | RLS Policy `tenant_id = GUC` | High jika aplikasi membaca header | **CRITICAL** | Server **WAJIB** mengekstrak `tenant_id` HANYA dari JWT Session resmi server. |
| **SQLi Context Manipulation** | Penyerang menjalankan `SET LOCAL app.current_tenant_id = 'tenant_B'` via SQLi | Transaction Scoping (`SET LOCAL`) | Akses data tenant B jika actor ID tidak divalidasi | **HIGH** | PostgreSQL diwajibkan memverifikasi keanggotaan `(actor_id, tenant_id)` di `user_actors`. |
| **Untrusted GUC Admin Override** | Sesi mengeksekusi `app.is_admin = true` | None (GUC di-override) | Access Bypass | **CRITICAL** | **Hapus total GUC `app.is_admin`**. Gunakan Role DB `banyubiru_admin_app`. |
| **Context Leakage in Connection Pool** | Koneksi PgBouncer membawa sisa `tenant_id` transaksi sebelumnya | `SET LOCAL` | Low jika transaksi selalu dibungkus | **MEDIUM** | Wajibkan wrapper `set_tenant_context()` pada setiap transaksi interaktif Prisma. |

---

## 6. Final Status Determination

> **TENANT CONTEXT TRUSTED WITH CONDITIONS**

### Persyaratan Kondisi Persetujuan (*Mandatory Conditions*):
1. **App-Side Integrity**: Lapisan aplikasi server-side HANYA menggunakan `tenant_id` dari JWT Session terautentikasi (dilarang keras membaca dari HTTP header/params/body).
2. **DB-Side Actor Verification**: PostgreSQL menyediakan fungsi `set_tenant_context(actor_id, tenant_id)` yang memvalidasi bahwa `actor_id` benar-benar terdaftar di `user_actors` dengan `tenant_id` yang sesuai sebelum RLS Policy mengevaluasi query.
3. **No Admin GUC**: GUC `app.is_admin` dihapus total dari seluruh rancangan skema.

---

*Akhir Dokumen Laporan Tenant Context Trust Model Fase 4E-3.*
