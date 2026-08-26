# 06 - Tenant Isolation & Security Architecture

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Multi-Tenancy, RBAC & Row-Level Security (RLS) Specification  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Multi-Tenancy Architecture Strategy

Platform dirancang mendukung **Multi-Tenancy** sejak level arsitektur database data model. Setiap data instansi / sekolah diisolasi secara logis menggunakan kolom **`tenant_id`**.

```
                           [ API Gateway / Middleware ]
                                        │
                       (Extract Tenant ID from JWT/Session)
                                        │
                                        ▼
                           SET app.current_tenant_id = 'tenant-01';
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Row-Level Security (RLS)                      │
│   SELECT * FROM employees WHERE tenant_id = current_setting('app.current_tenant_id'); │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tenant-Scoped Uniqueness Constraints

Uniqueness constraint di tingkat database **TIDAK BOLEH BERSIFAT GLOBAL**, melainkan **WAJIB TERIKAT PADA SCOPE TENANT (`tenant_id`)**:

1. **NIP Pegawai**: `UNIQUE (tenant_id, nip)`
2. **NRK Pegawai**: `UNIQUE (tenant_id, nrk)`
3. **NISN Siswa**: `UNIQUE (tenant_id, nisn)`
4. **Kode Sekolah / Instansi**: `UNIQUE (code)` (Global)

Penerapan ini memungkinkan dua sekolah / tenant berbeda memiliki siswa/pegawai dengan identifier terisolasi tanpa memicu *unique constraint violation*.

---

## 3. RBAC Taxonomy (Role & Permission)

### A. Core Roles:
1. `SUPER_ADMIN`: Akses penuh lintas tenant & pengaturan platform core.
2. `TENANT_ADMIN`: Akses penuh administrasi di dalam 1 tenant.
3. `EMPLOYEE_VERIFIER`: Verifikator usulan penghargaan pegawai (BKD / TU).
4. `STUDENT_OPERATOR`: Operator verifikasi absensi & OCR siswa.
5. `EMPLOYEE_USER`: User pegawai self-service.

### B. Table Model RBAC:
- **`roles`**: `id`, `name`, `description`.
- **`permissions`**: `id`, `code` (`proposal:read`, `proposal:verify`, `student:ocr:upload`, `audit:read`).
- **`role_permissions`**: Pivot `role_id` -> `permission_id`.
- **`user_tenant_memberships`**: Pivot `user_id`, `tenant_id`, `role_id`, `status`.

---

## 4. Strategy PostgreSQL Row-Level Security (RLS)

Pada transisi backend PostgreSQL di Fase 4B, keamanan isolasi tenant ditegakkan di level engine PostgreSQL via RLS:

### Kebijakan RLS (Policy Definition Blueprint):

```sql
-- Enable RLS on Tenant-Scoped Tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy Blueprint
CREATE POLICY tenant_isolation_policy ON employees
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY tenant_isolation_policy ON award_proposals
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY tenant_isolation_policy ON students
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY tenant_isolation_policy ON absence_records
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
```
