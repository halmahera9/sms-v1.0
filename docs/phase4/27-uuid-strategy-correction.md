# 27 - UUID v7 Application-Boundary Strategy Correction

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4D UUID v7 Application Boundary Implementation Analysis  
**Status**: REVIEW GATE DELIVERABLE — STRATEGY SPECIFICATION  

---

## 1. Current ID Definition & Inconsistency Analysis

### Current Schema State
Dalam skema `prisma/schema.prisma` saat ini, 17 model didefinisikan dengan atribut berikut:
```prisma
id String @id @default(uuid()) @db.Uuid
```

### Problem Statement: Why `@default(uuid())` Does Not Satisfy the UUID v7 Requirement
1. **Prisma Default UUID Behavior**: Atribut `@default(uuid())` pada Prisma ORM membangkitkan **UUID v4 (Random UUID)** secara *client-side* menggunakan generator internal Prisma yang berbasis nilai acak 128-bit acak.
2. **Penolakan Time-Ordered Indexing (UUID v7)**: UUID v4 tidak memiliki urutan waktu (*non-monotonic*). Hal ini menyebabkan fragmentasi indeks B-Tree yang tinggi pada database PostgreSQL saat volume data bertambah.
3. **Bypass Boundary Domain**: Atribut `@default(uuid())` menyerahkan pembuatan ID kepada Prisma Client secara tersembunyi, sehingga lapisan domain aplikasi (*domain factory/service layer*) tidak memegang kendali atas pembuatan timestamp pada bit terdepan UUID v7.

---

## 2. Affected Models (17 Entitas Domain)

Seluruh 17 model berikut terpengaruh dan akan diubah definisi ID-nya:
1. `Tenant`
2. `UserActor`
3. `Employee`
4. `AwardProposal`
5. `AwardProposalDocument`
6. `Student`
7. `AbsenceRecord`
8. `OCRExtraction`
9. `ExtractedItem`
10. `Document`
11. `DocumentVersion`
12. `HumanVerification`
13. `WorkflowInstance`
14. `WorkflowTransition`
15. `ValidationResult`
16. `ExceptionItem`
17. `AuditEvent`

---

## 3. Exact Schema Changes Required

Atribut `@default(uuid())` akan **dihapus sepenuhnya** dari skema Prisma. Definisi kolom `id` pada seluruh 17 model di `prisma/schema.prisma` diubah secara eksplisit menjadi:

```prisma
// Definisi Kolom Utama yang Disetujui:
id String @id @db.Uuid
```

### Contoh Perubahan pada Model `Tenant`:
```prisma
// SEBELUM:
model Tenant {
  id String @id @default(uuid()) @db.Uuid
  ...
}

// SESUDAH (Application-Bound UUID v7):
model Tenant {
  id String @id @db.Uuid
  ...
}
```

---

## 4. Application-Layer Changes Required (Future Phase 4D Task)

Ketika implementasi repository Prisma dimulai pada tahap berikutnya, lapisan aplikasi wajib menangani pembuatan ID secara eksplisit:

1. **Paket Generasi UUID v7**:
   Penggunaan pustaka `uuidv7` (atau fungsi *pure TypeScript* `generateUuidV7()`) di lapisan domain DTO/Factory.
2. **Injeksi ID pada Entity Factory**:
   ```typescript
   import { uuidv7 } from 'uuidv7';

   export function createStudentEntity(data: CreateStudentDTO): StudentEntity {
     return {
       id: uuidv7(), // Explicit UUID v7 timestamp creation
       ...data,
     };
   }
   ```
3. **Penanganan pada Prisma Repository**:
   Repository Prisma akan menerima data yang sudah memiliki `id` bertipe UUID v7 yang sah sebelum memanggil `prisma.<model>.create({ data })`.

---

## 5. Migration Implications

1. **PostgreSQL Column Types**:
   Tipe data di PostgreSQL tetap berupa `uuid NOT NULL PRIMARY KEY`.
2. **No Database Default Clause**:
   Perintah DDL migrasi PostgreSQL tidak akan menyertakan klausa `DEFAULT` pada kolom `id`.
3. **Guaranteed Contract**:
   Pengujian integrasi database akan langsung menolak query `INSERT` jika lapisan aplikasi lupa memberikan nilai `id`, sehingga menjamin 100% pembuatan ID selalu melalui skenario UUID v7 di *Application Boundary*.

---

*Akhir Dokumen Laporan Koreksi Strategi UUID v7.*
