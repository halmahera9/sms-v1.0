# 15 - State Transition Contracts & Guards

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4B State Transition Contracts, Pre/Post-Conditions & Audit Triggers  
**Status**: NON-CODE SPECIFICATION DESIGN  

---

## 1. Employee Award Transition Contracts

### A. Transition: `LENGKAP` ──► `SIAP_GENERATE`
- **Trigger Event**: `VERIFY_APPROVE`
- **Pre-Conditions (Guards)**:
  1. `checklist_status` == `'LENGKAP'` (Seluruh 4 dokumen wajib terverifikasi).
  2. `SE_BKD_22_2026_RULE` == `Valid` (Bebas hukuman disiplin).
  3. `MASA_KERJA_ELIGIBILITY_RULE` == `Valid` (Masa kerja CPNS sesuai usulan).
  4. Tidak ada `ExceptionItem` ber-status `OPEN` untuk proposal ini.
- **Post-Conditions**:
  1. Status proposal berubah menjadi `SIAP_GENERATE`.
  2. Proposal masuk ke dalam antrean *Siap Cetak PDF* (Work Queue).
- **Audit Event**: Log `VERIFY_SUCCESS` direkam ke `audit_events`.

---

### B. Transition: `SIAP_GENERATE` ──► `GENERATED`
- **Trigger Event**: `GENERATE_PDF`
- **Pre-Conditions (Guards)**:
  1. Status proposal == `SIAP_GENERATE`.
  2. Verifikator memiliki role `ADMIN_EMPLOYEE` / `TENANT_ADMIN`.
- **Post-Conditions**:
  1. Dokumen SK PDF diterbitkan & disimpan di `Document` platform.
  2. Status proposal berubah menjadi `GENERATED`.
- **Audit Event**: Log `GENERATE_SK` direkam ke `audit_events`.

---

## 2. Student Absence Transition Contracts

### A. Transition: `NEEDS_VERIFICATION` ──► `VERIFIED`
- **Trigger Event**: `VERIFY_ALL_ITEMS`
- **Pre-Conditions (Guards)**:
  1. `verifiedCount == extractedCount` (Seluruh item ekstraksi telah dikonfirmasi operator).
  2. Seluruh `ExtractedItem` memiliki status `verificationStatus == 'verified'`.
- **Post-Conditions**:
  1. Dokumen OCR berubah status menjadi `completed` & `workflowState = 'VERIFIED'`.
  2. Seluruh item dipromosikan menjadi entitas `AbsenceRecord` resmi.
- **Audit Event**: Log `COMPLETE_DOCUMENT_VERIF` direkam ke `audit_events`.
