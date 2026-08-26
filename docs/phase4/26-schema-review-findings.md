# 26 - Schema Review Findings & Architectural Corrections

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4D Schema Review Gate Analysis & Architectural Corrections  
**Status**: REVIEW GATE FINDINGS — PROPOSED CORRECTIONS  

---

## 1. Executive Summary

Laporan peninjauan arsitektur (*Schema Review Gate*) ini secara terperinci mengidentifikasi 7 temuan kritis pada rancangan skema Prisma (`prisma/schema.prisma`) terhadap spesifikasi arsitektur yang telah disetujui pada Fase 4A, 4B, dan 4C.

Semua perbaikan di bawah ini diusulkan untuk peninjauan dan persetujuan **sebelum** adanya pembuatan file migrasi PostgreSQL (`prisma migrate`), eksekusi `prisma db push`, atau koneksi ke database.

---

## 2. Detailed Findings & Correction Proposals

---

### Finding 1: UUID v7 Strategy Mismatch

* **Severity**: **CRITICAL**
* **Current Schema**:
  ```prisma
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ```
  *(Catatan: `gen_random_uuid()` adalah fungsi bawaan PostgreSQL untuk UUID v4 acak).*
* **Architectural Requirement**:
  Arsitektur Fase 4B/4C mewajibkan **UUID v7** (time-ordered UUID) untuk performa indeks B-Tree yang tinggi, pencegahan fragmentasi indeks, dan pengurutan kronologis instan secara bawaan.
* **Proposed Correction Options**:
  - **Opsi A (PostgreSQL 17 / Extension `pg_uuidv7` - Disarankan)**:
    Menggunakan fungsi database `uuidv7()` yang terpasang melalui extension PostgreSQL:
    ```prisma
    id String @id @default(dbgenerated("uuidv7()")) @db.Uuid
    ```
  - **Opsi B (Application-Level UUID v7 di Prisma Client Extension)**:
    Menggunakan Prisma Client `$extends` middleware dengan library `uuidv7` (npm) untuk membangkitkan UUID v7 sebelum query `INSERT` dikirim ke database.
* **Migration Impact**:
  Memerlukan penambahan pembuatan extension `CREATE EXTENSION IF NOT EXISTS "pg_uuidv7";` pada skrip migrasi PostgreSQL pertama.
* **Decision Required**:
  Konfirmasi apakah menggunakan **Opsi A (`uuidv7()` database-level)** atau **Opsi B (Application-level UUID v7)**.

---

### Finding 2: Cross-Tenant Child Association Leakage

* **Severity**: **CRITICAL**
* **Current Schema**:
  ```prisma
  model AwardProposalDocument {
    proposalId String @map("proposal_id") @db.Uuid
    documentId String @map("document_id") @db.Uuid
    proposal   AwardProposal @relation(fields: [proposalId], references: [id])
    document   Document      @relation(fields: [documentId], references: [id])
  }
  ```
  *(Catatan: Tanpa `tenant_id` pada tabel relasi, `AwardProposalDocument` berisiko mereferensikan `proposalId` milik Tenant A dan `documentId` milik Tenant B).*
* **Architectural Requirement**:
  Isolasi multi-tenancy harus berlaku secara ketat pada seluruh tabel anak (*child/association tables*): `AwardProposalDocument`, `DocumentVersion`, `WorkflowTransition`, `HumanVerification`, `ValidationResult`, `ExceptionItem`.
* **Proposed Correction**:
  Tambahkan kolom `tenant_id` dan gunakan **Composite Tenant-Aware Foreign Keys**:
  ```prisma
  model AwardProposalDocument {
    id              String @id @default(dbgenerated("uuidv7()")) @db.Uuid
    tenantId        String @map("tenant_id") @db.Uuid
    proposalId      String @map("proposal_id") @db.Uuid
    documentId      String @map("document_id") @db.Uuid
    requirementCode String @map("requirement_code") @db.VarChar(64)
    
    tenant   Tenant        @relation(fields: [tenantId], references: [id], onDelete: Restrict)
    proposal AwardProposal @relation(fields: [tenantId, proposalId], references: [tenantId, id], onDelete: Cascade)
    document Document      @relation(fields: [tenantId, documentId], references: [tenantId, id], onDelete: Restrict)

    @@unique([tenantId, proposalId, requirementCode])
    @@index([tenantId, verificationStatus])
    @@map("award_proposal_documents")
  }
  ```
  *(Catatan: Model induk `AwardProposal` dan `Document` juga menambahkan `@@unique([tenantId, id])` untuk mendukung Composite FK ini).*
* **Migration Impact**:
  Menjamin 100% *zero cross-tenant data corruption* secara deklaratif pada skema relasional PostgreSQL.
* **Decision Required**:
  Persetujuan struktur Composite Tenant-Aware FK `(tenantId, id)` pada seluruh tabel asosiasi anak.

---

### Finding 3: Audit Trail Immutability Enforcement

* **Severity**: **HIGH**
* **Current Schema**:
  ```prisma
  model AuditEvent {
    id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
    ...
  }
  ```
  *(Catatan: Prisma ORM secara default membuat method `update()` dan `delete()` pada client yang berisiko dipanggil oleh aplikasi).*
* **Architectural Requirement**:
  Tabel `audit_events` harus bersifat **Append-Only Immutable Ledger** tanpa kemampuan `UPDATE` atau `DELETE`, baik dari level aplikasi maupun query SQL langsung.
* **Proposed Correction**:
  1. **Level Aplikasi (Repository Contract)**: Repository interface `AuditEventRepository` hanya menyediakan method `recordEvent()` dan `getLogs()`, tanpa ada method `update()` atau `delete()`.
  2. **Level Database PostgreSQL (Migration Trigger Strategy)**:
     Menambahkan skrip DDL Trigger pada migrasi awal:
     ```sql
     CREATE OR REPLACE FUNCTION prevent_audit_modification()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'SECURITY ERROR: Audit log entries are immutable and cannot be updated or deleted.';
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER audit_events_immutability_trigger
     BEFORE UPDATE OR DELETE ON audit_events
     FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
     ```
* **Migration Impact**:
  Trigger akan otomatis memblokir perintah SQL `UPDATE` atau `DELETE` pada tabel `audit_events` dengan pesan error keamanan.
* **Decision Required**:
  Persetujuan DDL Trigger `prevent_audit_modification()` pada file migrasi PostgreSQL.

---

### Finding 4: Workflow Instance Uniqueness Scope

* **Severity**: **HIGH**
* **Current Schema**:
  ```prisma
  model WorkflowInstance {
    ...
    @@unique([entityType, entityId])
  }
  ```
* **Architectural Requirement**:
  Untuk mendukung isolasi multi-tenant yang konsisten dan pemindaian indeks tenant yang efisien, uniqueness constraint harus menyertakan `tenant_id`.
* **Proposed Correction**:
  Ubah Uniqueness Constraint menjadi:
  ```prisma
  @@unique([tenantId, entityType, entityId])
  ```
* **Migration Impact**:
  Indeks unik `(tenant_id, entity_type, entity_id)` akan memastikan pencarian instance workflow ter-scope per tenant.
* **Decision Required**:
  Persetujuan perubahan uniqueness scope `WorkflowInstance` menjadi `(tenantId, entityType, entityId)`.

---

### Finding 5: Domain Vocabulary Drift (Enum Alignment)

* **Severity**: **MEDIUM**
* **Current Schema**:
  ```prisma
  enum ExceptionStatus {
    OPEN
    IN_REVIEW
    RESOLVED
    IGNORED
  }
  ```
* **Architectural Requirement**:
  Terminologi resmi Fase 4A/4B untuk status pengabaian exception adalah **`DISMISSED`** (bukan `IGNORED`).
* **Proposed Correction**:
  Selaraskan enum `ExceptionStatus` ke terminologi resmi:
  ```prisma
  enum ExceptionStatus {
    OPEN
    IN_REVIEW
    RESOLVED
    DISMISSED
  }
  ```
* **Migration Impact**:
  Menghilangkan *vocabulary drift* antara dokumentasi arsitektur, domain logic, dan nilai enum PostgreSQL.
* **Decision Required**:
  Persetujuan pergantian nilai enum `IGNORED` menjadi `DISMISSED`.

---

### Finding 6: Polymorphic Human Verification Referential Integrity

* **Severity**: **MEDIUM**
* **Current Schema**:
  ```prisma
  model HumanVerification {
    targetEntityType String @map("target_entity_type") @db.VarChar(64)
    targetEntityId   String @map("target_entity_id") @db.Uuid
  }
  ```
* **Architectural Requirement**:
  Tabel `human_verifications` mencatat jejak verifikasi manual operator secara polimorfik untuk berbagai jenis entitas (`ExtractedItem`, `AwardProposalDocument`).
* **Limitations & Application-Level Enforcement**:
  - **Keterbatasan RDBMS**: PostgreSQL tidak mendukung Foreign Key relasional langsung pada kolom polimorfik (`target_entity_type` + `target_entity_id`).
  - **Penegakan Integritas**: Aplikasi (Service Layer) wajib memverifikasi keberadaan `target_entity_id` pada entitas spesifik sebelum menyimpan record `HumanVerification`.
* **Migration Impact**:
  Penambahan composite index `@@index([tenantId, targetEntityType, targetEntityId])` untuk mempercepat query jejak verifikasi.
* **Decision Required**:
  Konfirmasi penegakan integritas referensial polimorfik di tingkat Service Layer.

---

### Finding 7: Prisma 7 Configuration Requirement (`prisma.config.ts`)

* **Severity**: **INFO / COMPLIANCE**
* **Current Status**: `DATABASE_URL` belum diperkenalkan dan `prisma.config.ts` belum dibuat.
* **Prisma 7 Requirement**:
  Di Prisma 7, variabel `url = env("DATABASE_URL")` di dalam file `schema.prisma` telah dihapus (*deprecated*). Saat `DATABASE_URL` diperkenalkan di Fase 4D, file `prisma.config.ts` wajib dibuat di root proyek:
  ```typescript
  import { defineConfig } from '@prisma/config';

  export default defineConfig({
    earlyAccess: true,
    schema: {
      kind: 'single',
      filePath: 'prisma/schema.prisma',
    },
    migrations: {
      path: 'prisma/migrations',
    },
    datasource: {
      url: process.env.DATABASE_URL,
    },
  });
  ```
* **Migration Impact**:
  Memastikan kepatuhan 100% pada arsitektur Prisma 7 CLI & Migration Engine.
* **Decision Required**:
  Dokumentasi pembuatan `prisma.config.ts` disetujui untuk diimplementasikan saat koneksi PostgreSQL diperkenalkan.

---

## 3. Master Decision & Correction Summary Matrix

| Finding ID | Topik | Keputusan Diperlukan | Status Usulan |
|---|---|---|---|
| **F-01** | UUID v7 Strategy | Memilih Opsi A (`uuidv7()` DB) atau Opsi B (Client Extension) | PENDING REVIEW |
| **F-02** | Tenant Isolation FKs | Mengaktifkan Composite Tenant-Aware FK `(tenantId, id)` pada child tables | PENDING REVIEW |
| **F-03** | Audit Immutability | Menambahkan PostgreSQL Trigger `prevent_audit_modification()` | PENDING REVIEW |
| **F-04** | Workflow Uniqueness | Mengubah constraint ke `@@unique([tenantId, entityType, entityId])` | PENDING REVIEW |
| **F-05** | Vocabulary Drift | Mengubah `ExceptionStatus.IGNORED` ➔ `DISMISSED` | PENDING REVIEW |
| **F-06** | Polymorphic Integrity | Penegakan integritas `HumanVerification` di Service Layer | PENDING REVIEW |
| **F-07** | Prisma 7 Config | Konfigurasi `prisma.config.ts` saat `DATABASE_URL` aktif | PENDING REVIEW |

---

*Akhir Dokumen Laporan Temuan Peninjauan Skema Fase 4D.*
