# 01 - Domain Model Architecture

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4A Refined Domain Model Specification  
**Status**: NON-CODE ARCHITECTURAL SPECIFICATION  

---

## 1. Domain Overview & Bounding Contexts

Platform **Banyubiru Administrative Intelligence** dirancang menggunakan prinsip **Domain-Driven Design (DDD)** dengan memisahkan platform menjadi tiga Bounding Context utama:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLATFORM CORE BOUNDING CONTEXT                        │
│  (Tenant, UserActor, PlatformDocument, Workflow, Validation, Exception, Audit) │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│  EMPLOYEE ADMINISTRATION SUBDOMAIN   │   │   STUDENT ADMINISTRATION SUBDOMAIN│
│ (Employee, AwardProposal, Checklist) │   │(Student, AbsenceRecord, OCRItem) │
└──────────────────────────────────────┘   └──────────────────────────────────┘
```

---

## 2. Core Domain Architecture

### A. Subdomain Administrasi Pegawai (Employee Administration Domain)

Mengelola usulan penghargaan pegawai (Masa Kerja 10/20/30 Tahun dan Satyalancana Karya Satya X/XX/XXX) dengan alur tertutup:

```
[Employee] 
    └──► [AwardProposal]
            ├──► [AwardProposalDocument] (Refers to Platform Document)
            ├──► [Validation Engine Evaluation]
            ├──► [Workflow Instance & Transition Ledger]
            ├──► [Verification & Approval]
            └──► [Generated Document / SK PDF]
```

#### Entitas & Value Objects Utama:
1. **`Employee`** *(Aggregate Root / Source Entity)*: Menjadi rujukan identitas pegawai (NIP, NRK, Nama, Jabatan, SKPD, UKPD).
2. **`AwardProposal`** *(Aggregate Root)*: Mengidentifikasi transaksi usulan penghargaan tertentu.
3. **`AwardProposalDocument`** *(Entity)*: Menghubungkan usulan penghargaan dengan dokumen pendukung spesifik (SK CPNS, SK PNS, SK Pangkat, SKP) yang tersimpan pada `Document` platform.
4. **`AwardChecklist`** *(Value Object)*: Status kelengkapan dokumen pendukung hasil kalkulasi otomatis.

---

### B. Subdomain Administrasi Siswa (Student Administration Domain)

Mengelola absensi siswa dan pemrosesan bukti fisik ketidakhadiran berbasis ekstraksi OCR:

```
[Student]
    └──► [AbsenceRecord] (Source of Truth untuk Absensi Siswa)
            ▲
            │ (Hasil Verifikasi Manusia / Human-in-the-Loop)
            │
[Document] ──► [OCRExtraction] ──► [ExtractedItem]
```

#### Prinsip Penting Refinemen:
- **`OCRExtraction` & `ExtractedItem` BUKAN Source of Truth final**.
- Ekstraksi OCR bersifat **draft / rekomendasi sementara**.
- **`AbsenceRecord`** baru tercipta atau terbarui **hanya setelah verifikasi manusia (*Human Verification*)** berhasil mengonfirmasi item OCR tersebut.

#### Entitas Utama:
1. **`Student`** *(Aggregate Root / Master Data)*: Identitas resmi siswa terdaftar (NISN, NIS, Nama, Kelas, Gender, Status Dapodik).
2. **`AbsenceRecord`** *(Aggregate Root / Source of Truth Absensi)*: Catatan resmi ketidakhadiran siswa yang telah diverifikasi (Tanggal, Status Sakit/Izin/Alpha, Dokumen Referensi, Catatan Operator).
3. **`OCRExtraction`** *(Entity)*: Hasil pemrosesan ekstraksi OCR atas suatu `Document` fisik.
4. **`ExtractedItem`** *(Entity / Draft)*: Item baris kandidat hasil bacaan OCR yang belum/sedang diverifikasi.

---

## 3. Platform Core Shared Domain Services

Seluruh domain menggunakan **Domain-Agnostic Platform Core Engines**:

1. **`PlatformWorkflowEngine`**: Mengelola status transisi entitas bisnis tanpa menyimpan aturan spesifik domain di dalam engine.
2. **`PlatformValidationEngine`**: Mengompilasi dan mengevaluasi kumpulan `ValidationRule` terhadap entitas bisnis.
3. **`PlatformExceptionQueue`**: Menampung hasil evaluasi validasi ber-severity `ERROR` / `WARNING` untuk dikelola pada *Unified Exception Center*.
4. **`PlatformAuditEngine`**: Merekam jejak aktivitas aktor dan perubahan state entitas secara *immutable*.
5. **`PlatformDocumentService`**: Mengelola versi file, checksum integrity, dan metadata dokumen fisik.

---

## 4. Ubiquitous Language Dictionary

- **`Tenant`**: Entitas organisasi sekolah / instansi pemilik isolasi data.
- **`UserActor`**: Pengguna terotentikasi pengoperasi platform.
- **`Human-in-the-Loop Verification`**: Proses wajib konfirmasi manusia sebelum data otomatis (OCR / Ekstraksi) dipromosikan menjadi *Source of Truth*.
- **`Validation Severity`**: Level dampak kegagalan aturan bisnis (`CRITICAL`, `ERROR`, `WARNING`, `INFO`).
- **`Exception Resolution`**: Tindakan administratif penyelesaian pengecualian aturan (`IN_REVIEW`, `RESOLVED`, `DISMISSED`).
