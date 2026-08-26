# 09 - Non-Destructive Migration Strategy

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A LocalStorage to PostgreSQL Migration Strategy  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Migration Phasing Strategy

Proses migrasi dari browser `LocalStorage` ke PostgreSQL dilaksanakan secara bertahap tanpa mengganggu operasional sistem:

```
[ Phase 4A: Architecture Refinement & Non-Code Spec ] (CURRENT PHASE)
       │
       ▼
[ Phase 4B: PostgreSQL Schema DDL & Server Repository Implementation ]
       │
       ▼
[ Phase 4C: Data Extraction & Sanitization CLI Script ]
       │
       ▼
[ Phase 4D: Dual-Write / Sync Bridge Deployment ]
       │
       ▼
[ Phase 4E: Full Cloud DB Native & LocalStorage Cutover ]
```

---

## 2. Extraction & Sanitization Pipeline

1. **Extraction**: Membaca snapshot data dari browser `LocalStorage` (`banyubiru_proposals_v1`, `banyubiru_sms_students_v1`, `banyubiru_sms_documents_v1`, `banyubiru_sms_audit_logs`).
2. **Schema Sanitization**:
   - Memastikan NIP, NRK, dan NISN terbebas dari karakter ilegal / spasi.
   - Memastikan `tenant_id` terikat pada default tenant (`tenant-default-01`).
   - Mengonversi format tanggal legacy ke ISO 8601 UTC.
3. **Transactional Insertion**: Menyuntikkan data yang telah disanitasi ke dalam PostgreSQL menggunakan `saveAll()` dalam transaksi atomik (`BEGIN ... COMMIT`).

---

## 3. Rollback & Safety Fallback Strategy

Jika terjadi gangguan koneksi database selama masa transisi:
- Layer repository terabstraksi (`IRepository<T>`) secara otomatis menggunakan *Fallback Adapter* yang membaca *read-only cache* tanpa merusak integritas state bisnis.
