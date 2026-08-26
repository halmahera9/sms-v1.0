# 22 - LocalStorage to PostgreSQL Migration Mapping Specification

**System**: Banyubiru Administrative Intelligence Platform  
**Document**: Phase 4C Field-by-Field Migration Mapping Specification  
**Status**: SPECIFICATION & DATA DEFINITION MAPPING  

---

## 1. Field Mapping: `banyubiru_proposals_v1` ──► `employees` & `employee_award_proposals`

```
[ LocalStorage Item: AwardProposal ]
   ├── employee.nip ──────────────► employees.nip (UNIQUE tenant_id, nip)
   ├── employee.nrk ──────────────► employees.nrk (UNIQUE tenant_id, nrk)
   ├── employee.nama ─────────────► employees.full_name
   ├── employee.jabatan ──────────► employees.jabatan
   ├── employee.ukpd ─────────────► employees.ukpd
   ├── employee.skpd ─────────────► employees.skpd
   │
   ├── id ────────────────────────► employee_award_proposals.id
   ├── jenisPenghargaan ──────────► employee_award_proposals.jenis_penghargaan
   ├── nilaiUsulan ───────────────► employee_award_proposals.nilai_usulan
   ├── masaKerjaTahun ────────────► employee_award_proposals.masa_kerja_tahun
   ├── masaKerjaBulan ────────────► employee_award_proposals.masa_kerja_bulan
   ├── status ────────────────────► employee_award_proposals.status
   ├── checklistStatus ───────────► employee_award_proposals.checklist_status
   └── documents (Checklist) ─────► employee_award_proposals.checklist_data (JSONB)
```

---

## 2. Field Mapping: `banyubiru_sms_students_v1` ──► `students`

```
[ LocalStorage Item: Student ]
   ├── id ────────────────────────► students.id
   ├── nisn ──────────────────────► students.nisn (UNIQUE tenant_id, nisn)
   ├── nis ───────────────────────► students.nis
   ├── name ──────────────────────► students.full_name
   ├── class ─────────────────────► students.class_name
   ├── gender ────────────────────► students.gender
   └── status ────────────────────► students.status
```

---

## 3. Field Mapping: `banyubiru_sms_documents_v1` ──► `documents`, `ocr_extractions`, `extracted_items`

```
[ LocalStorage Item: OCRDocument ]
   ├── id ────────────────────────► documents.id & ocr_extractions.id
   ├── fileName ──────────────────► documents.title & document_versions.file_name
   ├── fileSize ──────────────────► document_versions.file_size_bytes
   ├── uploadedAt ────────────────► ocr_extractions.created_at
   ├── status ────────────────────► ocr_extractions.status
   ├── workflowState ─────────────► ocr_extractions.workflow_state
   ├── extractedCount ────────────► ocr_extractions.extracted_count
   ├── verifiedCount ─────────────► ocr_extractions.verified_count
   │
   └── items[i] (ExtractedItem) ──► extracted_items table
         ├── id ──────────────────► extracted_items.id
         ├── ocrText ─────────────► extracted_items.ocr_text
         ├── confidence ──────────► extracted_items.confidence_score
         ├── class ───────────────► extracted_items.class_name
         ├── date ────────────────► extracted_items.absence_date
         ├── status ──────────────► extracted_items.absence_status
         ├── notes ───────────────► extracted_items.notes
         └── verificationStatus ──► extracted_items.verification_status
```

---

## 4. Field Mapping: `banyubiru_sms_audit_logs` ──► `audit_events`

```
[ LocalStorage Item: AuditLog ]
   ├── id ────────────────────────► audit_events.id
   ├── timestamp ─────────────────► audit_events.created_at
   ├── operator ──────────────────► audit_events.actor_name & actor_id (mapped)
   ├── action ────────────────────► audit_events.action
   ├── target ────────────────────► audit_events.entity_id & entity_type
   └── details ───────────────────► audit_events.metadata -> { "details": details }
```
