# 23 - Transaction Boundaries & Concurrency Control

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Transaction Mapping & Locking Architecture  
**Status**: DESIGN-FIRST SPECIFICATION  

---

## 1. Overview

Dokumen ini mendefinisikan batas-batas transaksi (*Transaction Boundaries*), mekanisme *Optimistic Concurrency Control* (OCC), *Pessimistic Locking* untuk mencegah persaingan klaim antrean (*race conditions*), serta penggunaan *Idempotency Keys*.

---

## 2. Critical Use Case Transaction Boundaries

Setiap use case kritis harus dieksekusi dalam **Single ACID Transaction**:

### Use Case 1: Verifikasi Item Ketidakhadiran & Pembuatan Record Absensi
1. Lock `extracted_items` row via `SELECT FOR UPDATE`.
2. Pastikan `verification_status = 'PENDING'`.
3. Create `absence_records` (Source of Truth).
4. Update `extracted_items` (`verification_status = 'VERIFIED'`, `absence_record_id = new_id`).
5. Increment `ocr_extractions.verified_count`.
6. Insert `human_verifications` audit record.
7. Insert `audit_events` log.
8. Update `workflow_instances` state jika seluruh item selesai.

### Use Case 2: Persetujuan Generate Berkas Usulan Pegawai
1. Lock `award_proposals` row via `SELECT ... FOR UPDATE` (Optimistic Check: `version = expected_version`).
2. Jalankan `PlatformValidationEngine` (Pastikan 100% dokumen wajib `VERIFIED`).
3. Update `award_proposals` (`status = 'SIAP_GENERATE'`, `version = version + 1`).
4. Insert `workflow_transitions`.
5. Insert `audit_events`.

---

## 3. Optimistic Locking Implementation Strategy

Pada tabel utama (`employees`, `award_proposals`, `documents`, `workflow_instances`), digunakan kolom `version INT NOT NULL DEFAULT 1`:

```sql
-- Contoh Eksekusi Optimistic Lock Update:
UPDATE award_proposals 
SET status = 'SIAP_GENERATE', 
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'proposal-uuid' AND version = 2;

-- Jika return row count = 0, lemparkan ConcurrencyException (409 Conflict)
```

---

## 4. Pessimistic Locking Requirements for Queue Claiming

Untuk operasi dengan tingkat kontensi tinggi (*high contention*) seperti penugasan antrean verifikasi atau penanganan exception oleh banyak operator simultaneously:

### Antrean Verification & Exception Claim:
```sql
-- Klaim Antrean Verifikasi OCR:
SELECT id, currentState 
FROM workflow_instances 
WHERE tenant_id = 'tenant-uuid' 
  AND current_state = 'NEEDS_VERIFICATION' 
  AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
LIMIT 1 
FOR UPDATE SKIP LOCKED;

UPDATE workflow_instances
SET locked_by_user_id = 'operator-user-uuid',
    locked_until = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
WHERE id = 'claimed-instance-id';
```

---

## 5. Idempotency Key Strategy

Untuk mencegah eksekusi ganda pada API mutasi (seperti Upload OCR Batch atau Batch PDF Generation):
- Client mengirimkan HTTP Header `X-Idempotency-Key: <UUID>`.
- Server mencatat key tersebut di `metadata` `audit_events` atau cache redis. Jika key yang sama diterima dalam window 24 jam, kembalikan respon ter-cache tanpa mengeksekusi ulang transaksi.

---

*Akhir Dokumen Transaksi & Locking.*
