# 16 - Data Integrity Invariants

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B Explicit Domain & Database Integrity Invariants  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Explicit Domain Invariant Catalogue

Berikut adalah **7 Invariant Mutlak** yang ditegakkan di level Domain Layer dan Database Constraints:

### INVARIANT 1: Counter Verification Cap
> **`verifiedCount` pada header `OCRExtraction` TIDAK BOLEH MEMBENGKAK MELEBIHI `extractedCount`.**
- *Penegakan*: Database `CHECK (verified_count <= extracted_count)` dan validasi domain entity.

---

### INVARIANT 2: Strict Workflow Verification Completion
> **Status dokumen `VERIFIED` / `COMPLETED` MEMBUTUHKAN SELURUH ITEM EKSTRAKSI ber-status `verificationStatus == 'verified'`.**
- *Penegakan*: State machine guard menolak transisi jika `verifiedCount < extractedCount`.

---

### INVARIANT 3: Human-in-the-Loop Source of Truth Promotion
> **Hasil ekstraksi OCR TIDAK BOLEH MENJADI entitas `AbsenceRecord` resmi TANPA KONFIRMASI MANUSIA (*Human Verification*).**
- *Penegakan*: Entitas `AbsenceRecord` hanya memiliki constructor/factory yang membutuhkan `verified_by_user_id`.

---

### INVARIANT 4: Exception Resolution Accountability
> **Mengubah status `ExceptionItem` menjadi `RESOLVED` atau `DISMISSED` WAJIB MENCANTUMKAN `resolvedBy` (Actor ID) dan `resolutionNote` (Catatan Alasan).**
- *Penegakan*: Database `CHECK (status NOT IN ('RESOLVED', 'DISMISSED') OR (resolved_by IS NOT NULL AND resolution_note IS NOT NULL))`.

---

### INVARIANT 5: Audit Event Immutability
> **Catatan `AuditEvent` TIDAK BOLEH DIUBAH (`UPDATE`) ATAU DIHAPUS (`DELETE`).**
- *Penegakan*: PostgreSQL Triggers `BEFORE UPDATE` dan `BEFORE DELETE` melempar exception mutlak.

---

### INVARIANT 6: Strict Tenant Boundary Isolation
> **Entitas dari `tenant_id` A TIDAK BOLEH DILINK ATAU DIMUTASI oleh transaksi dari `tenant_id` B.**
- *Penegakan*: PostgreSQL Row-Level Security (RLS) dan filter `tenant_id` pada seluruh query repository.

---

### INVARIANT 7: State Transition Validity
> **Transisi workflow HANYA BOLEH TERJADI jika aksi yang dipicu VALID UNTUK STATE TERKINI.**
- *Penegakan*: `PlatformWorkflowEngine` melempar `InvalidStateTransitionException` jika event tidak terdaftar dalam matriks transisi state saat ini.
