# 05 - Platform Document & Storage Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Platform-Level Document Storage & Versioning Architecture  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Promotion of Document to Platform-Level Entity

Pada arsitektur terdahulu, pengelolaan dokumen terikat secara kaku pada `OCRDocument` di domain siswa. Pada refosialisasi Fase 4A, **`Document` dipromosikan menjadi Platform Core Entity (Domain-Agnostic)** yang dapat digunakan oleh seluruh subdomain:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLATFORM DOCUMENT ENGINE                             │
│                  Document ──► DocumentVersion (SHA-256)                      │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│        AwardProposalDocument         │   │      StudentAbsenceDocument      │
│  (SK CPNS, SK PNS, SK Pangkat, SKP)  │   │   (Surat Izin / Sakit Physical)  │
└──────────────────────────────────────┘   └──────────────────────────────────┘
```

---

## 2. Platform Entity Contract

### A. Entitas Header: `Document`
- `id`: Primary Key (`doc-uuid`).
- `tenant_id`: Foreign Key `Tenant` penjamin isolasi data.
- `title`: Judul / Deskripsi Dokumen (`Surat Izin Sakit Ahmad Dahlan`).
- `category`: Kategori Dokumen (`EMPLOYEE_SUPPORTING_DOC`, `STUDENT_ABSENCE_PROOF`, `GENERATED_OFFICIAL_SK`).
- `status`: Status ketersediaan (`DRAFT`, `ACTIVE`, `ARCHIVED`, `DELETED`).
- `created_at`: Timestamp pembuatan UTC.
- `updated_at`: Timestamp pembaruan UTC.

### B. Entitas Versi & Fisik File: `DocumentVersion`
- `id`: Primary Key (`docver-uuid`).
- `document_id`: Foreign Key `Document`.
- `version_number`: Nomor versi dokumen (`1`, `2`, `3`).
- `file_name`: Nama file asli (`Surat_Izin_Sakit.png`).
- `file_size_bytes`: Ukuran file dalam bytes (`665600`).
- `mime_type`: Type MIME resmi (`image/png`, `image/jpeg`, `application/pdf`).
- `storage_path`: Relative Storage Path / Bucket Object Key (`tenants/tenant-01/docs/2026/08/docver-99.png`).
- `checksum_sha256`: Hash SHA-256 integritas file untuk mendeteksi manipulasi berkas fisik.
- `uploaded_by`: Foreign Key `UserActor`.
- `created_at`: Timestamp upload UTC.

---

## 3. Extension Subdomain Specific Tables

### A. Subdomain Employee: `AwardProposalDocument`
Pivot table yang menghubungkan `AwardProposal` dengan `Document` platform:
- `id`: Primary Key (`propdoc-uuid`).
- `proposal_id`: Foreign Key `AwardProposal`.
- `document_id`: Foreign Key `Document` platform.
- `document_type`: Tipe Dokumen Pendukung (`SK_CPNS`, `SK_PNS`, `SK_PANGKAT_TERAKHIR`, `SKP_2_TAHUN`).
- `verification_status`: Status Verifikasi Berkas (`PENDING`, `VERIFIED`, `REJECTED`).
- `rejection_reason`: Alasan penolakan jika berkas tidak valid.

### B. Subdomain Student: `StudentAbsenceDocument`
Pivot table yang menghubungkan `AbsenceRecord` dengan `Document` bukti fisik:
- `id`: Primary Key (`stdabsdoc-uuid`).
- `absence_record_id`: Foreign Key `AbsenceRecord`.
- `document_id`: Foreign Key `Document` platform.
- `ocr_extraction_id`: Foreign Key `OCRExtraction` asal ekstraksi (jika diproses melalui OCR).
