# 36 - Trusted Tenant Context Mechanism Design

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E Trusted Tenant Context Architecture & Implementation Design  
**Status**: REVIEW GATE DELIVERABLE — IMPLEMENTATION DESIGN  

---

## 1. Executive Summary & Core Principle

Dokumen ini merancang mekanisme **Trusted Tenant Context** untuk menghubungkan otentikasi aplikasi di Next.js Server dengan penegakan kebijakan Row Level Security (RLS) di database PostgreSQL. 

### Prinsip Utama:
> **"Nilai `app.current_tenant_id` HANYA BOLEH diisi melalui fungsi PostgreSQL yang terverifikasi secara kriptografis & dua arah (`set_tenant_context`)."**
> 
> Aplikasi tidak boleh menyuplai string tenant acak secara mentah. Setiap transaksi database wajib memanggil fungsi `set_tenant_context(actor_id, tenant_id)`. PostgreSQL akan **memverifikasi keanggotaan `(actor_id, tenant_id)` pada tabel `user_actors`** sebelum mengizinkan query DML dieksekusi.

---

## 2. Authentication Boundary & JWT Claims

### Origin of Identity
Identitas aktor terautentikasi (*Authenticated Actor Identity*) berasal secara eksklusif dari **Server-Side Authentication Guard** (NextAuth / JWT Session Manager pada Next.js Server). Identitas ini diverifikasi di entrypoint HTTP sebelum transaksi database dipicu.

### Required JWT Claims
Token JWT resmi server wajib memuat klausa berikut:
```json
{
  "sub": "01917a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b",  // actor_id (UUID v7)
  "tenant_id": "01917a2b-3c4d-7e8f-9a0b-999999999999", // tenant_id (UUID v7)
  "role": "VERIFIKATOR",                               // UserRole enum
  "session_id": "01917a2b-3c4d-7e8f-9a0b-888888888888" // session_id
}
```

### Aturan Keamanan Input Tenant Client:
Nilai `tenant_id` **DILARANG KERAS** diterima secara mentah dari:
- Header HTTP client (misal: `X-Tenant-Id`)
- Query parameters (misal: `?tenantId=...`)
- Body payload request JSON
- Selector tenant di browser
*Kecuali jika server Next.js secara independen memverifikasi ulang bahwa `actor_id` dari session benar-benar memiliki akses ke `tenant_id` tersebut di `user_actors`.*

---

## 3. Server-Side Tenant Context Resolver Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               SERVER-SIDE TRUSTED CONTEXT RESOLVER FLOW                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. HTTP Request diterima Next.js Server Entrypoint                          │
│ 2. Server Auth Guard memverifikasi Cryptographic JWT Signature              │
│ 3. Server mengekstrak `actor_id` & `tenant_id` dari Verified Session        │
│ 4. Prisma Interactive Transaction (`prisma.$transaction`) dipicu            │
│ 5. Transaksi memanggil SQL:                                                 │
│    `SELECT set_tenant_context('actor-uuid'::uuid, 'tenant-uuid'::uuid);`   │
│ 6. PostgreSQL memverifikasi pasangan keanggotaan di tabel `user_actors`    │
│ 7. Jika Valid: PostgreSQL menjalankan `SET LOCAL app.current_tenant_id`     │
│ 8. Jika Invalid: PostgreSQL melemparkan SQL Exception, Transaksi Abort!     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. PostgreSQL Helper: `set_tenant_context()`

Fungsi pembantu PostgreSQL dirancang secara ketat:

```sql
CREATE OR REPLACE FUNCTION set_tenant_context(
    p_actor_id UUID,
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_is_valid BOOLEAN;
BEGIN
    -- 1. Validasi Input Non-Null
    IF p_actor_id IS NULL OR p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'SECURITY ERROR: Actor ID and Tenant ID must not be null.';
    END IF;

    -- 2. Verifikasi Keanggotaan Aktor & Status Tenant Aktif di Database
    SELECT EXISTS (
        SELECT 1 
        FROM user_actors u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = p_actor_id 
          AND u.tenant_id = p_tenant_id 
          AND u.status = 'ACTIVE'::"UserStatus"
          AND t.status = 'ACTIVE'::"TenantStatus"
    ) INTO v_is_valid;

    -- 3. Penolakan Skenario Penyamaran / Penyerangan (Impersonation Defense)
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'SECURITY ERROR: Actor % is not an active member of tenant %.', p_actor_id, p_tenant_id;
    END IF;

    -- 4. Penetapan Variable Context Ter-scope Transaksi (SET LOCAL)
    PERFORM set_config('app.current_actor_id', p_actor_id::text, true);
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$;

-- Hak Akses Eksekusi
REVOKE ALL ON FUNCTION set_tenant_context(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, UUID) TO banyubiru_app;
```

### Karakteristik Keamanan Fungsi:
* **SECURITY DEFINER**: Menjalankan pengujian keanggotaan `user_actors` dengan hak istimewa fungsi pemilik (`banyubiru_migrator`), sehingga role runtime `banyubiru_app` dapat memverifikasi tabel tanpa harus diberi hak SELECT publik berlebihan.
* **SET search_path = pg_catalog, public**: Mengunci search path untuk mencegah *Search Path Hijacking Attack*.
* **Transaction Scoping (`is_local = true`)**: `set_config(..., ..., true)` secara mutlak membatasi variabel pada transaksi aktif saja.

---

## 5. Identity Integrity & Impersonation Defense

### Mampukah `banyubiru_app` Memanggil `set_tenant_context(actor_A, tenant_B)`?
**JAWABAN: TIDAK BISA.**

Jika role aplikasi `banyubiru_app` mencoba memanggil:
```sql
SELECT set_tenant_context('UUID_ACTOR_TENANT_A', 'UUID_TENANT_B');
```
1. Fungsi `set_tenant_context` mengeksekusi query validasi ke `user_actors`.
2. Karena `actor_A` tercatat di database sebagai anggota `Tenant_A`, hasil `SELECT EXISTS` bernilai `FALSE`.
3. Fungsi melemparkan SQL Exception:  
   `SECURITY ERROR: Actor UUID_ACTOR_TENANT_A is not an active member of tenant UUID_TENANT_B.`
4. Transaksi PostgreSQL **langsung dibatalkan secara otomatis (ROLLBACK)**, dan variabel `app.current_tenant_id` **TIDAK PERNAH DIISI**.

---

## 6. Context Storage & Lifetime

* **Penyimpanan Context**: Disimpan di memori sesi transaksi PostgreSQL via `set_config('app.current_tenant_id', ..., true)` dan `set_config('app.current_actor_id', ..., true)`.
* **Masa Hidup (Lifetime)**: Berakhir secara otomatis saat `COMMIT` atau `ROLLBACK`.
* **Connection Pooling**: PgBouncer / Prisma connection pool aman dari kebocoran konteks karena `is_local = true` mereset variabel saat koneksi kembali ke pool.

---

## 7. RLS Interaction & Elimination of Admin GUC

1. **Eliminasi Total GUC `app.is_admin`**: GUC `app.is_admin` **dihapus total 100%**.
2. **Aturan RLS Policy Tunggal yang Dipercayai**:
   ```sql
   CREATE POLICY tenant_isolation_policy ON <table_name>
   FOR ALL TO banyubiru_app
   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
   WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
   ```
3. **Fail-Closed Mode**: Jika `set_tenant_context()` tidak dipanggil, `current_setting('app.current_tenant_id', true)` bernilai `NULL`. Query DML mengembalikan 0 baris data dan menolak `INSERT`.

---

## 8. Admin Boundary Isolation

Operasi administratif lintas tenant oleh Platform Administrator diisolasi secara ketat:
* **Dua Role Database Terpisah**:
  - `banyubiru_app`: DML biasa terikat RLS per tenant.
  - `banyubiru_admin_app`: Role terpisah dengan *Connection Pool* dan kredensial terisolasi.
* **Audit Immutability**: Seluruh transaksi yang dipanggil oleh `banyubiru_admin_app` mencatat entri `AuditEvent` secara otomatis.

---

## 9. Database Privileges NOT Granted to `banyubiru_app`

Role runtime `banyubiru_app` **DILARANG KERAS** memiliki hak akses berikut:
- `SUPERUSER`
- `BYPASSRLS`
- `CREATE` pada database / schema
- Kepemilikan Schema (Schema Ownership)
- Hak akses DDL (`ALTER TABLE`, `DROP TABLE`, `TRUNCATE`)
- `EXECUTE` pada fungsi admin sensitif

---

## 10. Comprehensive Threat Model & Mitigations

| Threat Vector | Attack Path | Mitigation Strategy | Result |
|---|---|---|---|
| **Forged Actor ID** | Client mengirim ID acak | Auth Guard memverifikasi JWT Signature server-side | Blocked |
| **Forged Tenant ID** | Client mengirim tenant ID lain | `set_tenant_context()` menguji `user_actors` di DB | Blocked |
| **Actor A + Tenant B Combo** | Attacker memasangkan actor A dengan tenant B | Query `SELECT EXISTS` di DB mengembalikan `FALSE` ➔ Exception | Blocked |
| **Compromised App Server** | Attacker kuasai Next.js server | Attacker tetap terikat validasi DB `user_actors` | Mitigated |
| **SQL Injection** | Attacker mengeksekusi `SET LOCAL` | `set_tenant_context()` wajib dipanggil, GUC admin dihilangkan | Blocked |
| **Connection Pooling Leakage** | PG Connection reused di pool | Parameter `is_local = true` mereset variabel saat `COMMIT` | Blocked |
| **Privilege Escalation** | Attacker coba naik hak akses admin | Role `banyubiru_app` tidak punya hak bypass RLS | Blocked |
| **SECURITY DEFINER Abuse** | Attacker ubah search_path | Klausa `SET search_path = pg_catalog, public` mengunci fungsi | Blocked |

---

## 11. Failure Modes Matrix

| Skenario Kegagalan | Respon PostgreSQL & Fungsi | Dampak Keamanan | Status |
|---|---|---|---|
| **Missing Actor ID** | Exception: `Actor ID and Tenant ID must not be null` | Transaction Abort (Fail-Closed) | **SAFE** |
| **Missing Tenant ID** | Exception: `Actor ID and Tenant ID must not be null` | Transaction Abort (Fail-Closed) | **SAFE** |
| **Invalid UUID Format** | PostgreSQL Type Casting Exception `invalid input syntax for type uuid` | Transaction Abort (Fail-Closed) | **SAFE** |
| **Actor Not Found** | Query `EXISTS` mengembalikan `FALSE` ➔ Exception | Transaction Abort (Fail-Closed) | **SAFE** |
| **Actor Not Member of Tenant** | Query `EXISTS` mengembalikan `FALSE` ➔ Exception | Transaction Abort (Fail-Closed) | **SAFE** |
| **Inactive Actor Status** | `u.status = 'ACTIVE'` bernilai `FALSE` ➔ Exception | Transaction Abort (Fail-Closed) | **SAFE** |
| **Inactive Tenant Status** | `t.status = 'ACTIVE'` bernilai `FALSE` ➔ Exception | Transaction Abort (Fail-Closed) | **SAFE** |
| **Unauthorized Cross-Tenant** | RLS Policy `tenant_id = app.current_tenant_id` menolak | 0 Rows Affected / Insert Violation | **SAFE** |

---

## 12. Audit Requirements

Operasi berikut wajib mencatat `AuditEvent`:
1. Kegagalan eksekusi `set_tenant_context()` (dicatat di application error log).
2. Seluruh transaksi DML yang dieksekusi oleh role `banyubiru_admin_app`.
3. Perubahan status `UserActor` (`ACTIVE` ➔ `INACTIVE`).

---

## 13. Implementation Boundaries

* **Application Responsibilities**: Otentikasi JWT, verifikasi session server-side, pembungkusan transaksi Prisma dengan `set_tenant_context()`.
* **PostgreSQL Responsibilities**: Eksekusi fungsi `set_tenant_context()`, penegakan RLS Policy, pembatasan hak akses RBAC.
* **Authentication Provider Responsibilities**: Penerbitan JWT Token dengan tanda tangan kriptografis terpercaya (`actor_id`, `tenant_id`).
* **Migration Responsibilities**: Penulisan DDL fungsi `set_tenant_context()`, RLS Policies, dan RBAC GRANT/REVOKE pada skrip `migration.sql`.

---

## 14. Final Security Invariants

1. **Aktor biasa HANYA dapat mengakses tenant terotorisasi mereka.**
2. **Konteks tenant TIDAK PERNAH diterima langsung dari input client.**
3. **Konteks tenant yang hilang/invalid SELALU Fail-Closed.**
4. **Akses lintas tenant diwajibkan melalui role DB terpisah `banyubiru_admin_app`.**
5. **Role `banyubiru_app` TIDAK DAPAT melompati RLS.**
6. **GUC `app.is_admin` TIDAK ADA (dihapus 100%).**

---

## 15. Final Decision

> **TRUSTED CONTEXT IMPLEMENTATION READY**

---

*Akhir Dokumen Desain Mekanisme Trusted Tenant Context Fase 4E-4.*
