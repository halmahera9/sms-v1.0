# 10 - Master Refined Technical Specification & Architectural Decisions

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Master Synthesis, Blockers & Architecture Decision Records (ADR)  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. BLOCKERS BEFORE POSTGRESQL IMPLEMENTATION

Sebelum penulisan kode database PostgreSQL atau skema Prisma ORM dilakukan pada Fase 4B, **seluruh poin blocker berikut wajib disepakati dan dipenuhi**:

1. **[BLOCKER 1] Tenant Identification & Onboarding Mechanism**:
   - Kepastian mekanisme pembuatan `tenant_id` dan penentuan isolasi instansi (apakah 1 instansi = 1 tenant, atau 1 wilayah = 1 tenant).

2. **[BLOCKER 2] Object Storage Infrastructure Provisioning**:
   - Penyediaan endpoint resmi Cloud Object Storage (GCS / S3) untuk pengunggahan file fisik dokumen `Document` & `DocumentVersion` (karena PostgreSQL tidak digunakan untuk menyimpan file biner langsung).

3. **[BLOCKER 3] Official API Contract with SIMPEG & Dapodik**:
   - Finalisasi skema API inbound dari SIMPEG Pemprov DKI Jakarta (untuk pegawai) dan Dapodik Kemendikbud (untuk siswa) guna menggantikan generator mock data.

4. **[BLOCKER 4] Authentication & Identity Provider Selection**:
   - Kepastian Auth Provider yang digunakan (Keycloak / NextAuth / OAuth2 OIDC) untuk menyuntikkan `actor_id` resmi pada `AuditEvent` dan `WorkflowTransition`.

5. **[BLOCKER 5] Regulatory Approval of Digital Signature (E-Sign / BSrE)**:
   - Kepastian spesifikasi integrasi sertifikat Tanda Tangan Elektronik (TTE BSrE) untuk penandatanganan SK Penghargaan pada state `APPROVED`.

---

## 2. Architecture Decision Records (ADR Summary)

### ADR-01: Promotion of Document to Platform Core Entity
- **Keputusan**: Mempromosikan `Document` dari entitas khusus domain siswa (`OCRDocument`) menjadi entitas umum di `Platform Core Layer`.
- **Alasan**: Seluruh subdomain (Employee & Student) membutuhkan versi file, checksum SHA-256 integrity, dan penyimpanan object storage terstandar.

### ADR-02: Human-in-the-Loop Threshold for Student Absence Source of Truth
- **Keputusan**: Ekstraksi OCR (`OCRExtraction`, `ExtractedItem`) tidak boleh secara otomatis menjadi *Source of Truth*. `AbsenceRecord` hanya tercipta setelah verifikasi manusia (*Human Verification*).
- **Alasan**: Mencegah kesalahan data ketidakhadiran siswa akibat kelemahan akurasi bacaan gambar/tangan.

### ADR-03: Strict Immutable Triggers for Audit Events
- **Keputusan**: Menerapkan PostgreSQL Trigger `BEFORE UPDATE` dan `BEFORE DELETE` yang memblokir mutasi pada tabel `audit_events`.
- **Alasan**: Jaminan keabsahan jejak audit administratif yang akuntabel dan tahan manipulasi.

### ADR-04: Tenant-Scoped Uniqueness Constraints
- **Keputusan**: Mengganti Uniqueness Constraint global pada NIP, NRK, dan NISN menjadi `UNIQUE (tenant_id, identifier)`.
- **Alasan**: Mendukung multi-tenancy skala besar tanpa potensi bentrok identifier antar-instansi.

---

## 3. Risk Matrix & Mitigations

| Risiko | Dampak | Strategi Mitigasi |
|---|---|---|
| **Performance Bottleneck pada Audit Event Scanning** | Tinggi | Penerapan *partitioning* tabel `audit_events` berdasarkan rentang bulan/tahun (`RANGE PARTITION BY (created_at)`). |
| **Race Condition pada Transisi Workflow** | Sedang | Penerapan *Optimistic Locking* (`version` column) atau *Pessimistic Locking* (`FOR UPDATE`) saat mutasi `WorkflowInstance`. |
| **Penyimpanan Terlampau Besar untuk JSONB Metadata** | Rendah | Mengizinkan penulisan metadata hanya untuk key yang terdaftar di schema registry. |

---

## 4. Open Questions

1. Apakah arsip dokumen `ARCHIVED` membutuhkan mekanisme retensi otomatis (misalnya penghapusan berkas fisik setelah 5 tahun sesuai aturan arsip daerah)?
2. Apakah integrasi Tanda Tangan Elektronik (TTE) BSrE memerlukan service sidecar khusus di backend?

---

## 5. Recommended Implementation Sequence (Fase 4B & 5)

```
1. Phase 4B: Provisioning PostgreSQL Engine & Environment Variables
2. Phase 4C: Implementation of PostgresRepository<T> & DDL Migration Script
3. Phase 4D: Integration of Cloud Object Storage Client (GCS / S3)
4. Phase 4E: Integration of NextAuth / OAuth2 JWT Session Provider
5. Phase 5: Production Deployment & Field Verification
```

---

*Akhir Dokumen Spesifikasi Non-Kode Fase 4A.*
