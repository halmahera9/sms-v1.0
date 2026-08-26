# 17 - Concurrency & Idempotency Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Concurrency Strategy, Locking Models & Idempotency  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Concurrency Strategy: Optimistic vs. Pessimistic Locking

```
                                [ MUTATION REQUEST ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      [ High Concurrency Read/Write ]            [ Critical State Transition ]
         (e.g. AwardProposal Update)                 (e.g. OCR Item Verification)
                   │                                           │
                   ▼                                           ▼
      Optimistic Locking (version)               Pessimistic Locking (FOR UPDATE)
```

### A. Optimistic Locking (`version` column)
Diterapkan pada entitas yang sering diperbarui oleh pengusul/operator tetapi memiliki tingkat konflik sedang:
- **Entitas Target**: `AwardProposal`, `Student`, `Document`.
- **Mekanisme**: Setiap entitas memiliki kolom `version INT DEFAULT 1`.
- **Query Mutasi**: `UPDATE award_proposals SET status = 'SEBAGIAN', version = version + 1 WHERE id = 'prop-101' AND version = 1;`
- **Konflik Handling**: Jika `affected_rows == 0`, lemparkan `OptimisticLockException` dan minta pengguna merefresh data.

### B. Pessimistic Locking (`SELECT ... FOR UPDATE`)
Diterapkan pada transaksi kritis di mana counter / state berpotensi diakses secara simultan oleh multiple verifikator:
- **Entitas Target**: `OCRExtraction` (saat verifikasi item berulang), `ExceptionItem` (saat klaim resolusi).
- **Mekanisme**: `SELECT * FROM ocr_extractions WHERE id = 'doc-101' FOR UPDATE;` di dalam transaksi DB.

---

## 2. Idempotency Specification

Setiap operasi kritis wajib memenuhi **Prinsip Idempotensi** (dapat dieksekusi berulang kali dengan input yang sama tanpa menghasilkan efek samping ganda):

1. **OCR Document Upload Idempotency**:
   - Idempotency key: `SHA256(file_buffer) + tenant_id`.
   - Hasil: Mengunggah file yang sama dua kali tidak akan membuat entitas `Document` baru.

2. **OCR Processing Idempotency**:
   - Memproses ulang OCR untuk `ocrExtractionId` yang sama menghapus draft `ExtractedItem` sebelumnya secara atomik sebelum menyuntikkan hasil baru.

3. **Item Verification Idempotency**:
   - Memverifikasi `ExtractedItem` yang sudah berstatus `verified` mengembalikan `AbsenceRecord` yang sudah ada (*No-Op*).

4. **Export Idempotency**:
   - Ekspor Excel/PDF bersifat *read-only idempotence*. Memanggil ekspor 10 kali menghasilkan file identical tanpa merusak state bisnis.
