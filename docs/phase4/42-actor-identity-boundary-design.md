# 42 - Actor Identity Boundary & Secure Context Propagation Design

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4E/4F Actor Identity Binding & Application-to-Database Context Integration Flow  
**Status**: APPROVED — ACTOR BOUNDARY DESIGN COMPLETED  

---

## 1. Executive Summary & Security Goal

Dokumen ini merancang batas pertahanan identitas aktor (*Actor-Identity Boundary*) pada lapisan Next.js Server untuk menjamin integritas propagasi identitas pengguna (`actor_id` & `tenant_id`) ke engine PostgreSQL RLS.

### Tujuan Utama:
> **"Mencegah penyerang atau pengguna biasa memanipulasi variabel sesi `app.current_tenant_id` dan `app.current_actor_id` secara langsung melalui manipulasi input request client."**

---

## 2. Server-Side Actor Identity Verification Flow

Lapisan Next.js Server bertindak sebagai **Trusted Boundary** yang melakukan otentikasi dan otorisasi sebelum meneruskan kueri ke Prisma Client:

```
[ Client Browser ]
        │ (Kirim Request + HttpOnly Cookie / JWT Token)
        ▼
[ Next.js Server Middleware / Server Action ]
        │ 1. Verifikasi tanda tangan kriptografis token JWT (Server-Side)
        │ 2. Ekstrak `session.user.actorId` & `session.user.tenantId`
        │ 3. Larang keras membaca parameter tenant dari URL, Headers, atau Body
        ▼
[ Prisma Repository Interactive Transaction ]
        │ 4. Panggil `set_tenant_context(actorId, tenantId)`
        │ 5. DB memvalidasi keanggotaan aktor di tabel `user_actors`
        ▼
[ PostgreSQL Engine Execution ]
        │ 6. RLS Policy secara otomatis membatasi akses baris data
        ▼
[ Clean Fail-Closed / Output Data ]
```

---

## 3. Node.js / Prisma Code Integration Blueprint

Implementasi pemanggilan transaksi interaktif di Next.js Server wajib mengikuti pola penulisan berikut:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Menjalankan operasi database di dalam transaksi interaktif ter-scope tenant.
 * @param actorId UUID Aktor terautentikasi dari JWT resmi server
 * @param tenantId UUID Tenant resmi aktor dari JWT resmi server
 * @param queryBlock Fungsi callback yang mengeksekusi query bisnis
 */
export async function runInTenantContext<T>(
  actorId: string,
  tenantId: string,
  queryBlock: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$use' | '$on' | '$transaction'>) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    // 1. Injeksi secara aman menggunakan parameterized raw query untuk mencegah SQL Injection
    await tx.$executeRaw`SELECT set_tenant_context(${actorId}::uuid, ${tenantId}::uuid)`;

    // 2. Eksekusi logika kueri domain bisnis
    return await queryBlock(tx);
  });
}
```

---

## 4. Final Security Gate Invariants (Batas Kepercayaan)

1. **HttpOnly Cookies**: Session tokens disimpan pada HttpOnly Cookies dengan enkripsi server-side penuh untuk mencegah pencurian token oleh XSS.
2. **Double-Checked Security**:
   - Lapisan Aplikasi memeriksa otentikasi JWT.
   - Lapisan Database memvalidasi keanggotaan `(actor_id, tenant_id)` melalui `SELECT EXISTS` di `set_tenant_context()`.
3. **No client bypass**: Masukan `tenant_id` dari client-side dilarang untuk otorisasi akses baris data.

---

*Akhir Dokumen Desain Batas Kepercayaan Identitas Aktor Fase 4F-2.*
