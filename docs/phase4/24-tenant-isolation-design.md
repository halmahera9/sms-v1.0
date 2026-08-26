# 24 - Multi-Tenancy & Row-Level Security (RLS) Design

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Tenant Isolation Architecture & PostgreSQL RLS Design  
**Status**: DESIGN-FIRST SPECIFICATION (NO SQL EXECUTION YET)  

---

## 1. Overview

Dokumen ini menjelaskan strategi pengisolasian data antar-tenant (*Multi-Tenancy Isolation*) untuk menjamin bahwa data instansi/sekolah A tidak dapat diakses atau diubah oleh instansi/sekolah B.

---

## 2. Shared-Database, Shared-Schema Tenant Strategy

Sistem Banyubiru mengadopsi model **Shared-Database, Discriminator Column Architecture**:
- Semua tenant berbagi database PostgreSQL dan schema yang sama.
- Setiap tabel berlingkup tenant diwajibkan memiliki kolom `tenant_id UUID NOT NULL REFERENCES tenants(id)`.

---

## 3. Tenant-Scoped Uniqueness Constraints

Uniqueness constraint dibuat dengan menyertakan `tenant_id` untuk mencegah konflik ID antar-tenant:
- `employees`: `UNIQUE(tenant_id, nip)`, `UNIQUE(tenant_id, nrk)`
- `students`: `UNIQUE(tenant_id, nisn)`, `UNIQUE(tenant_id, nis)`
- `user_actors`: `UNIQUE(tenant_id, username)`, `UNIQUE(tenant_id, email)`
- `award_proposals`: `UNIQUE(tenant_id, employee_id, jenis_penghargaan, tahun_usulan)`
- `absence_records`: `UNIQUE(tenant_id, student_id, absence_date)`

---

## 4. PostgreSQL Row-Level Security (RLS) Conceptual Design

PostgreSQL Native Row-Level Security (RLS) digunakan sebagai benteng keamanan lapis pertama di tingkat database.

### Konsep Eksekusi Session Variable:
Saat koneksi database dibuka dari Application Server, *session variable* di-set sesuai tenant pengguna yang terautentikasi:
```sql
-- Konsep Setting Context Tenant pada Session Database (Di-set oleh Prisma Middleware/Extension):
SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
```

### Konsep Kebijakan RLS (Policy Blueprint):
```sql
-- Konsep Kebijakan RLS untuk Tabel Employees (Tidak dieksekusi sekarang):
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON employees
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

---

## 5. Security & Isolation Invariants

1. **Zero Cross-Tenant Leakage**: Query `SELECT` tanpa menyertakan `tenant_id` atau tanpa RLS session aktif akan mengembalikan 0 baris.
2. **Audit Accountability**: Setiap aktivitas penulisan mencatat `tenant_id` dan `actor_id` secara imutabel pada `audit_events`.

---

*Akhir Dokumen Desain Isolasi Tenant & RLS.*
