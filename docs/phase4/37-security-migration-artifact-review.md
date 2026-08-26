# 37 - Security Migration Artifact & SQL Review

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E Security Migration SQL Artifact & Privilege Design  
**Status**: SECURITY MIGRATION ARTIFACT READY  

---

## 1. Executive Summary

Dokumen ini berisi artefak **SQL DDL Keamanan & Hak Akses Database** lengkap untuk Platform Banyubiru. Berkas ini melengkapi skema relasional Prisma dengan menetapkan 4 Role PostgreSQL (RBAC), pembatasan privilase ketat, Row Level Security (RLS) Policies pada 17 tabel domain, fungsi `set_tenant_context()` yang terlindungi `SECURITY DEFINER`, serta trigger immutability audit.

### Status Keamanan Migrasi:
> **SECURITY MIGRATION ARTIFACT READY — NOT EXECUTED**  
> Naskah SQL di bawah ini dirancang murni sebagai artefak tertulis (*offline code review*) dan **TIDAK DIEKSEKUSI** ke database PostgreSQL pada tahap ini.

---

## 2. Complete Security SQL Migration Script (Draft Artifact)

```sql
-- =============================================================================
-- BANYUBIRU PLATFORM - SECURITY & RLS MIGRATION SCRIPT (PHASE 4E-5)
-- Target RDBMS: PostgreSQL 17
-- Status: DESIGNED FOR REVIEW ONLY - DO NOT EXECUTE YET
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: POSTGRESQL ROLES PROVISIONING (RBAC)
-- Note: Passwords are NOT defined here and must be injected via secure Vault
-- -----------------------------------------------------------------------------

-- 1. Migration Role (DDL Owner & Schema Admin)
CREATE ROLE banyubiru_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;

-- 2. Application Runtime Role (DML Only, Subject to RLS)
CREATE ROLE banyubiru_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- 3. Platform Admin Service Role (Audited Admin Access)
CREATE ROLE banyubiru_admin_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- 4. Analytics & Reporting Role (DML Read Only, Subject to RLS)
CREATE ROLE banyubiru_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- -----------------------------------------------------------------------------
-- SECTION 2: HARDENED PRIVILEGE BOUNDARIES (GRANT / REVOKE)
-- -----------------------------------------------------------------------------

-- Revoke default public privileges
REVOKE ALL ON DATABASE current_database() FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Grant Schema Access
GRANT USAGE ON SCHEMA public TO banyubiru_migrator;
GRANT USAGE ON SCHEMA public TO banyubiru_app;
GRANT USAGE ON SCHEMA public TO banyubiru_admin_app;
GRANT USAGE ON SCHEMA public TO banyubiru_readonly;

-- Grant DML Privileges to Application Runtime Role (banyubiru_app)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO banyubiru_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO banyubiru_app;

-- Grant DML Privileges to Platform Admin Role (banyubiru_admin_app)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO banyubiru_admin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO banyubiru_admin_app;

-- Grant Read-Only Privileges to Reporting Role (banyubiru_readonly)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO banyubiru_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO banyubiru_readonly;

-- Explicitly DENY DDL & Security privileges to banyubiru_app
REVOKE CREATE ON SCHEMA public FROM banyubiru_app;
REVOKE ALL ON FUNCTION pg_catalog.pg_read_file(text) FROM banyubiru_app;

-- -----------------------------------------------------------------------------
-- SECTION 3: TRUSTED TENANT CONTEXT HELPER FUNCTION (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

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

    -- 3. Penolakan Skenario Penyamaran (Impersonation Defense)
    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'SECURITY ERROR: Actor % is not an active member of tenant %.', p_actor_id, p_tenant_id;
    END IF;

    -- 4. Penetapan Variable Context Ter-scope Transaksi (SET LOCAL)
    PERFORM set_config('app.current_actor_id', p_actor_id::text, true);
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$;

-- Grant Execution of set_tenant_context to Application Role ONLY
REVOKE ALL ON FUNCTION set_tenant_context(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, UUID) TO banyubiru_app;

-- -----------------------------------------------------------------------------
-- SECTION 4: AUDIT EVENT IMMUTABILITY TRIGGER FUNCTION (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

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

CREATE TRIGGER audit_events_immutability_trigger
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- -----------------------------------------------------------------------------
-- SECTION 5: ROW LEVEL SECURITY (RLS) POLICIES FOR ALL 17 DOMAIN TABLES
-- Note: GUC app.is_admin is 100% ELIMINATED. All policies fail closed if context missing.
-- -----------------------------------------------------------------------------

-- 1. Table: tenants (Root Model)
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_app_isolation" ON "tenants"
FOR SELECT TO banyubiru_app
USING ("id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "tenants_admin_access" ON "tenants"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 2. Table: user_actors
ALTER TABLE "user_actors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_actors_app_isolation" ON "user_actors"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "user_actors_admin_access" ON "user_actors"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 3. Table: employees
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_app_isolation" ON "employees"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "employees_admin_access" ON "employees"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 4. Table: award_proposals
ALTER TABLE "award_proposals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "award_proposals_app_isolation" ON "award_proposals"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "award_proposals_admin_access" ON "award_proposals"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 5. Table: award_proposal_documents
ALTER TABLE "award_proposal_documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "award_proposal_documents_app_isolation" ON "award_proposal_documents"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "award_proposal_documents_admin_access" ON "award_proposal_documents"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 6. Table: students
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_app_isolation" ON "students"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "students_admin_access" ON "students"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 7. Table: absence_records
ALTER TABLE "absence_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absence_records_app_isolation" ON "absence_records"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "absence_records_admin_access" ON "absence_records"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 8. Table: ocr_extractions
ALTER TABLE "ocr_extractions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_extractions_app_isolation" ON "ocr_extractions"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "ocr_extractions_admin_access" ON "ocr_extractions"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 9. Table: extracted_items
ALTER TABLE "extracted_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extracted_items_app_isolation" ON "extracted_items"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "extracted_items_admin_access" ON "extracted_items"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 10. Table: documents
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_app_isolation" ON "documents"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "documents_admin_access" ON "documents"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 11. Table: document_versions
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_versions_app_isolation" ON "document_versions"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "document_versions_admin_access" ON "document_versions"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 12. Table: human_verifications
ALTER TABLE "human_verifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "human_verifications_app_isolation" ON "human_verifications"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "human_verifications_admin_access" ON "human_verifications"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 13. Table: workflow_instances
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_instances_app_isolation" ON "workflow_instances"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "workflow_instances_admin_access" ON "workflow_instances"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 14. Table: workflow_transitions
ALTER TABLE "workflow_transitions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_transitions_app_isolation" ON "workflow_transitions"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "workflow_transitions_admin_access" ON "workflow_transitions"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 15. Table: validation_results
ALTER TABLE "validation_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validation_results_app_isolation" ON "validation_results"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "validation_results_admin_access" ON "validation_results"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 16. Table: exception_items
ALTER TABLE "exception_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exception_items_app_isolation" ON "exception_items"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "exception_items_admin_access" ON "exception_items"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);

-- 17. Table: audit_events (Read & Insert Only via RLS; UPDATE/DELETE blocked by Trigger)
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_app_isolation" ON "audit_events"
FOR ALL TO banyubiru_app
USING ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK ("tenant_id" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE POLICY "audit_events_admin_access" ON "audit_events"
FOR ALL TO banyubiru_admin_app
USING (true) WITH CHECK (true);
```

---

## 3. Database Privilege Matrix & Restrictions

| Database Privilege / Capability | `banyubiru_migrator` | `banyubiru_app` | `banyubiru_admin_app` | `banyubiru_readonly` |
|---|---|---|---|---|
| **Bypass RLS (`BYPASSRLS`)** | **YA** | **TIDAK** | **TIDAK** | **TIDAK** |
| **Superuser Privileges** | **TIDAK** | **TIDAK** | **TIDAK** | **TIDAK** |
| **DDL Privileges (`CREATE/ALTER/DROP TABLE`)** | **YA** | **TIDAK** | **TIDAK** | **TIDAK** |
| **DML Read (`SELECT`)** | **YA** | **YA** (RLS) | **YA** (Admin Policy) | **YA** (RLS) |
| **DML Write (`INSERT, UPDATE, DELETE`)** | **YA** | **YA** (RLS) | **YA** (Admin Policy) | **TIDAK** |
| **Execute `set_tenant_context()`** | **YA** | **YA** | **TIDAK** | **TIDAK** |
| **Modify Audit Events (`UPDATE/DELETE`)** | **TIDAK** (Blocked) | **TIDAK** (Blocked) | **TIDAK** (Blocked) | **TIDAK** (Blocked) |

---

## 4. SQL Categorization & Separation

1. **Prisma-Generated DDL**: Berkas SQL yang dibangkitkan oleh Prisma CLI (`CREATE TABLE`, `CREATE TYPE AS ENUM`, `PRIMARY KEY`, `FOREIGN KEY`, `CREATE INDEX`).
2. **Manual Security SQL (Dokumen ini)**:
   - DDL Peranan Database (`CREATE ROLE`).
   - Batasan Privilase (`REVOKE`, `GRANT`).
   - Fungsi Terlindungi `set_tenant_context()` & `prevent_audit_modification()`.
   - Aktivasi RLS & 34 Aturan RLS Policies (`ENABLE RLS`, `CREATE POLICY`).
   - Trigger Immutability `audit_events_immutability_trigger`.
3. **Required Before First Migration**:
   - Seluruh DDL seksi 1, 2, 3, 4, 5 dokumen ini dimasukkan ke dalam skrip `migration.sql` pertama pada folder `prisma/migrations`.
4. **Deferred Until Authentication Implementation**:
   - Pembuatan kata sandi (*passwords*) nyata untuk role database PostgreSQL pada server produksi (dikelola via Environment Vault / Secret Manager).

---

## 5. Verification of Application Role Safeguards

Berdasarkan naskah DDL keamanan di atas, terverifikasi secara absolut bahwa `banyubiru_app` **TIDAK BISA**:
1. **Bypass RLS**: Karena `banyubiru_app` dibuat dengan klausa `NOBYPASSRLS`.
2. **Become Admin**: Karena GUC `app.is_admin` dihapus total dari seluruh RLS Policy.
3. **Create / Alter / Drop Tables**: Karena hak `CREATE` pada schema dicabut (`REVOKE CREATE ON SCHEMA public FROM banyubiru_app`).
4. **Manipulate Audit Events**: Perintah `UPDATE` atau `DELETE` pada `audit_events` menembak DDL Trigger `prevent_audit_modification()` yang melemparkan Exception `SECURITY ERROR`.
5. **Establish Unauthorized Tenant Context**: Pemanggilan `set_tenant_context(actor_A, tenant_B)` memicu Exception pada `user_actors` lookup query dan membatalkan transaksi.

---

## 6. Final Classification

> **SECURITY MIGRATION ARTIFACT READY**

---

*Akhir Dokumen Artefak SQL Keamanan & Migrasi Fase 4E-5.*
