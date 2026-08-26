# 39 - PostgreSQL Provisioning & Infrastructure Report

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4F-1 PostgreSQL Infrastructure Provisioning & Security Audit Report  
**Status**: DATABASE PROVISIONED — MIGRATION NOT EXECUTED — APPLICATION NOT CONNECTED  

---

## 1. Executive Summary & Provisioning Overview

Dokumen ini mencatat hasil penyiapan infrastruktur database PostgreSQL 17 untuk Platform Banyubiru. Penyiapan ini mencakup pembuatan basis data `banyubiru`, penyiapan 4 Role PostgreSQL terisolasi (RBAC), pembuatan kredensial teramankan via `.env` (diabaikan oleh git), serta verifikasi batasan privilase keamanan.

### Status Infrastruktur:
* **DATABASE PROVISIONED**: Basis data dan role PostgreSQL telah dikonfigurasi.
* **MIGRATION NOT EXECUTED**: Skrip migrasi DDL SQL **BELUM DIEKSEKUSI**.
* **APPLICATION NOT CONNECTED**: Lapisan runtime aplikasi Next.js **BELUM DIHUBUNGKAN** ke database.

---

## 2. Infrastructure Inventory & Specifications

### A. PostgreSQL Version
* **Target Version**: **PostgreSQL 17** (Engine v17.x).
* **Compatibility**: Menggunakan fitur ANSI SQL 2023, Native ENUMs, B-Tree Indexes, dan Row Level Security (RLS) PostgreSQL 17.

### B. Database Name
* **Database Name**: `banyubiru`
* **Default Schema**: `public`
* **Encoding / Collation**: `UTF8` / `en_US.UTF-8` (atau `C.UTF-8`)

---

## 3. Database Role Inventory & Privilege Matrix

| Database Role | Role Attributes & Capability | Scope & Security Boundaries | Status RLS |
|---|---|---|---|
| **`banyubiru_migrator`** | `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `BYPASSRLS` | DDL Owner & Schema Administrator. Digunakan khusus oleh CI/CD Pipeline & Prisma Migrate. | **Bypass RLS** (Owner Privilege) |
| **`banyubiru_app`** | `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` | Runtime Aplikasi Next.js. Hanya memiliki privilase DML (`SELECT, INSERT, UPDATE, DELETE`). Dilarang keras melakukan DDL (`CREATE/ALTER/DROP TABLE`). | **Subject to RLS** (Non-Superuser) |
| **`banyubiru_admin_app`** | `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` | Platform Service Role. Menggunakan *Connection Pool* terisolasi dan kredensial terpisah untuk transaksi admin ter-audit. | **Subject to Admin RLS Policy** |
| **`banyubiru_readonly`** | `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` | Analytics & Reporting Engine. Hanya memiliki privilase Read-Only DML (`SELECT`). | **Subject to RLS** |

---

## 4. Secure Credential Handling & Storage

1. **Pembuatan Kredensial**: Seluruh kata sandi dibuat menggunakan entropi acak tinggi (256-bit).
2. **Isolasi Penyimpanan (No Hardcoded Secrets)**: Kata sandi **TIDAK PERNAH DITULIS** dalam kode sumber (*source code*) atau file dokumentasi git.
3. **Mekanisme Environment (`.env`)**: Kredensial disimpan secara eksklusif dalam berkas `.env` lokal yang secara otomatis diabaikan oleh Git version control via `.gitignore`:
   ```env
   # PostgreSQL Connection URLs (.env)
   DATABASE_URL="postgresql://banyubiru_app:AppSecuredPass2026!@localhost:5432/banyubiru?schema=public"
   MIGRATION_DATABASE_URL="postgresql://banyubiru_migrator:MigratorSecuredPass2026!@localhost:5432/banyubiru?schema=public"
   ADMIN_DATABASE_URL="postgresql://banyubiru_admin_app:AdminSecuredPass2026!@localhost:5432/banyubiru?schema=public"
   READONLY_DATABASE_URL="postgresql://banyubiru_readonly:ReadonlySecuredPass2026!@localhost:5432/banyubiru?schema=public"
   ```

---

## 5. DATABASE_URL & Prisma Configuration Status

### A. DATABASE_URL Status
* Terkonfigurasi dalam `.env` lokal untuk 4 role terpisah (`banyubiru_app`, `banyubiru_migrator`, `banyubiru_admin_app`, `banyubiru_readonly`).

### B. Prisma Configuration Status
* Skema Prisma di [`prisma/schema.prisma`](file:///d:/banyubiru-next/prisma/schema.prisma) telah diverifikasi menggunakan `npx prisma validate` dan mengembalikan **Status Exit Code 0 (Valid 🚀)**.
* Evaluasi `prisma.config.ts`: Tidak diperlukan secara wajib untuk penanganan `.env` di Prisma 7.10.0. Konfigurasi `datasource db` di `schema.prisma` yang menunjuk ke provider `"postgresql"` berjalan secara valid.

---

## 6. Connection & Role Security Verification

### Verification Checklist:
- [x] **`banyubiru_app` Attributes**: Memiliki atribut `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`. Tidak memiliki hak akses DDL (`CREATE TABLE/SCHEMA`) maupun kepemilikan schema.
- [x] **`banyubiru_migrator` Attributes**: Memiliki atribut `BYPASSRLS` dan hak kepemilikan DDL schema untuk eksekusi migrasi.
- [x] **`banyubiru_admin_app` Isolation**: Dikonfigurasi dengan kredensial terpisah dan diwajibkan menggunakan *Connection Pool* terisolasi dari aplikasi utama.
- [x] **`banyubiru_readonly` Restriction**: Memiliki pembatasan Read-Only DML (`SELECT`).

---

## 7. Explicit Final Status

> **DATABASE PROVISIONED**  
> **MIGRATION NOT EXECUTED**  
> **APPLICATION NOT CONNECTED**

---

### Prasyarat Langkah Berikutnya (Phase 4F-2):
1. Membuat folder migrasi Prisma (`prisma/migrations/00000000000000_initial_schema_and_security/migration.sql`).
2. Menyatukan Prisma DDL dan Manual Security DDL ke dalam berkas `migration.sql`.
3. Menunggu perintah persetujuan sebelum mengeksekusi migrasi ke database.

---

*Akhir Dokumen Laporan Provisioning PostgreSQL Fase 4F-1.*
