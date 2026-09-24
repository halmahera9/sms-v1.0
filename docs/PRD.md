# Product Requirement Document (PRD)
# Banyubiru Administrative Intelligence Platform

## 1. Product Vision

Banyubiru Administrative Intelligence Platform adalah platform **administrative intelligence** multi-tenant untuk institusi pendidikan dan pemerintahan Indonesia.

Tujuan utamanya adalah mengubah proses administrasi yang manual, terfragmentasi, dan berulang menjadi workflow terstruktur yang dapat:

- menerima data dan dokumen;
- melakukan normalisasi;
- menerapkan rule dan policy;
- melakukan validation;
- menghasilkan exception;
- melibatkan human verification;
- menjalankan approval workflow;
- menghasilkan atau menyimpan dokumen;
- menyediakan reporting;
- menghasilkan immutable audit trail.

Banyubiru bukan sekadar aplikasi CRUD administrasi. Core product-nya adalah **workflow dan decision-support platform** yang dapat digunakan oleh beberapa domain administratif.

---

## 2. Product Principles

### 2.1 Domain-Agnostic Core

Capability berikut harus berada pada platform core dan tidak dikunci pada satu domain:

- authentication dan authorization;
- tenant isolation;
- workflow;
- validation;
- exception handling;
- human verification;
- audit trail;
- document lifecycle;
- object storage abstraction;
- document processing;
- reporting dan operational metrics.

Domain-specific logic berada pada domain module atau application service yang sesuai.

### 2.2 Single Source of Truth

Data administratif harus memiliki canonical representation.

UI tidak boleh menjadi source of truth untuk persistence atau business state.

Alur yang diharapkan:

```text
Raw Input
   ↓
Normalization
   ↓
Canonical Domain Data
   ↓
Validation / Workflow
   ↓
Persistent State
2.3 Policy-Driven Validation

Business rules dan policy tidak boleh tersebar secara acak di komponen UI.

Validation harus dapat diterapkan terhadap canonical domain data dan menghasilkan hasil yang dapat diproses oleh workflow.

2.4 Human-in-the-Loop

Automation, OCR, identity resolution, dan validation digunakan untuk mempercepat pekerjaan manusia.

Untuk hasil yang membutuhkan keputusan manusia:

Automation
    ↓
Candidate / Result
    ↓
Human Verification
    ↓
Authoritative Decision
2.5 Full Auditability

State transition, verification, exception resolution, dan tindakan administratif penting harus dapat dilacak.

Audit event harus immutable.

2.6 Tenant Isolation

Setiap tenant harus memiliki boundary data dan binary storage yang terisolasi.

Tenant context harus berasal dari authenticated execution context, bukan dipercaya dari input client.

3. Core Administrative Pipeline

Pipeline konseptual Banyubiru:

DATA
  ↓
DATA NORMALIZATION
  ↓
RULE / POLICY MODEL
  ↓
VALIDATION
  ↓
EXCEPTION QUEUE
  ↓
HUMAN VERIFICATION
  ↓
APPROVAL
  ↓
DOCUMENT GENERATION / PERSISTENCE
  ↓
REPORTING
  ↓
AUDIT TRAIL

Tidak semua workflow harus melewati seluruh tahap secara identik.

Document Intelligence, misalnya, memiliki processing pipeline tersendiri sebelum masuk ke domain workflow:

Document
  ↓
DocumentVersion
  ↓
Object Storage
  ↓
Processing Job
  ↓
Extractor / OCR
  ↓
OCRExtraction
  ↓
ExtractedItem
  ↓
Identity Resolution
  ↓
Validation
  ↓
Exception / Human Verification
  ↓
Domain Persistence
4. Current Product Domains
4.1 Student Administration

Student Administration merupakan salah satu domain utama yang telah memiliki implementation aktif.

Capability yang telah dibangun meliputi:

student master data;
student server actions;
student identity lookup;
student absence processing;
absence OCR;
OCR extraction;
student identity resolution;
validation / exception bridge;
human verification;
absence persistence;
absence export;
Dapodik import/preview workflow;
student workspace;
canonical students route.

Current route:

/app/students

Route tersebut telah diarahkan ke canonical Student Workspace implementation.

Student Document Workflow

Dokumen ketidakhadiran dapat diproses melalui Document Intelligence pipeline:

Upload
  ↓
Document
  ↓
DocumentVersion
  ↓
DocumentProcessingJob
  ↓
OCR / Extractor
  ↓
OCRExtraction
  ↓
ExtractedItem
  ↓
Student Identity Resolution
  ↓
Validation / Exception
  ↓
Human Verification
  ↓
AbsenceRecord
4.2 Employee Administration

Employee Administration merupakan domain administratif kedua.

Capability yang telah dibangun mencakup:

employee administration;
employee award proposal;
Masa Kerja / Satyalancana processing;
document requirements;
validation dan completeness checks;
award proposal document persistence;
multi-stage approval;
SIGN;
SEND;
ARCHIVE_COMPLETE workflow;
auditability.

Employee workflow menggunakan platform workflow dan document infrastructure yang sama dengan domain lain.

5. Document Intelligence

Document Intelligence merupakan capability platform yang menjadi fondasi pemrosesan dokumen lintas domain.

5.1 Canonical Document Model

Model utama meliputi:

Document
DocumentVersion
DocumentProcessingJob
OCRExtraction
ExtractedItem
HumanVerification
ExceptionItem
AuditEvent

Document dan DocumentVersion menyimpan metadata lifecycle.

Binary content tidak disimpan sebagai blob langsung pada domain entity.

Binary disimpan melalui canonical object-storage abstraction.

5.2 Processing Pipeline
Incoming File
      ↓
Object Storage
      ↓
Document
      ↓
DocumentVersion
      ↓
DocumentProcessingJob
      ↓
Extractor
      ↓
OCRExtraction
      ↓
ExtractedItem
      ↓
Identity Resolution
      ↓
Validation
      ↓
Exception / Verification
      ↓
Domain Record

Processing dapat menggunakan extractor yang sesuai dengan jenis dokumen dan konfigurasi platform.

Human verification tetap menjadi authority ketika automated extraction atau matching tidak cukup meyakinkan.

6. Object Storage

Object storage merupakan platform capability tersendiri.

Canonical contract:

src/platform/storage/types.ts

Interface utama:

IObjectStorageProvider

Current providers:

src/platform/storage/provider.ts
src/platform/storage/filesystem.ts
src/platform/storage/in-memory.ts

Production/runtime implementation saat ini menggunakan filesystem provider.

Default root:

.data/object-storage

atau:

OBJECT_STORAGE_ROOT
Storage Requirements

Provider harus mendukung:

tenant-scoped upload;
tenant-scoped download;
tenant-scoped delete;
metadata retrieval;
checksum SHA-256;
canonical storage path validation;
tenant namespace isolation.

Binary storage path tidak boleh menjadi public URL secara langsung.

7. Document File Access

Dokumen yang telah disimpan harus dapat diakses melalui authenticated server boundary.

Current endpoint:

GET /api/documents/[documentId]/file

Endpoint tersebut bertanggung jawab untuk:

resolve authenticated context;
authorize document read;
memastikan document berada pada tenant yang benar;
mengambil latest DocumentVersion;
mengambil binary dari object storage;
mengembalikan binary response.

Conceptual flow:

Browser / UI
    ↓
Authenticated Request
    ↓
Document File Route
    ↓
Authorization
    ↓
Tenant-scoped Document Lookup
    ↓
DocumentVersion
    ↓
Object Storage
    ↓
Binary Response

Client tidak boleh mengakses filesystem storage secara langsung.

8. Authentication & Authorization

Banyubiru menggunakan authenticated execution context untuk menjalankan server-side operations.

Authorization harus dilakukan pada server boundary.

Pattern utama:

Request
  ↓
Authenticated Context
  ↓
Authorization Guard
  ↓
Application Operation

Role dan permission menentukan capability yang dapat dijalankan actor.

Contoh authorization boundary yang telah digunakan:

STUDENT_WORKFLOW_READ
STUDENT_WORKFLOW_UPLOAD

Authorization tidak boleh hanya dilakukan di UI.

9. Multi-Tenancy & Data Security

Banyubiru dirancang sebagai multi-tenant platform.

Tenant isolation diterapkan pada:

PostgreSQL data;
repositories;
authenticated context;
object storage;
document access;
workflow operations;
audit events.

PostgreSQL Row Level Security digunakan sebagai salah satu security boundary.

Storage isolation menggunakan namespace:

tenant
  └── object namespace
       └── documents
            └── ...

Security invariant:

Actor dari tenant A tidak boleh membaca atau memodifikasi resource tenant B hanya dengan mengetahui identifier resource tersebut.

10. Workflow Model

Workflow state harus direpresentasikan secara eksplisit.

Contoh generic lifecycle:

DRAFT
  ↓
PENDING_VERIFICATION
  ↓
VERIFIED
  ↓
APPROVED
  ↓
COMPLETED

Tidak semua domain menggunakan state yang sama.

Employee Award workflow memiliki state tambahan yang berkaitan dengan:

SIGN
SEND
ARCHIVE_COMPLETE

State transition harus dilakukan melalui workflow/application boundary, bukan manipulasi langsung dari UI.

11. Exception & Human Verification

Exception adalah bagian resmi dari workflow, bukan error sementara.

Exception dapat muncul karena:

OCR confidence rendah;
identity tidak ditemukan;
identity ambigu;
required field tidak tersedia;
validation failure;
document requirement tidak terpenuhi;
policy mismatch.

Model konseptual:

Automated Processing
       ↓
Validation
       ↓
 ┌─────┴─────┐
 │           │
PASS       EXCEPTION
 │           │
 ↓           ↓
Continue   Human Review
             ↓
          Resolution
             ↓
          Continue
12. Reporting & Operational Visibility

Platform harus menyediakan operational visibility terhadap:

workflow status;
processing status;
exception count;
verification backlog;
document processing;
domain activity;
audit events.

Dashboard merupakan presentation layer dari operational state.

Dashboard tidak boleh menjadi source of truth.

13. UI Product Requirements

Banyubiru UI harus mendukung pekerjaan administratif yang membutuhkan:

high information density;
fast search;
filtering;
clear status;
verification workflows;
document inspection;
exception resolution;
audit visibility;
responsive operation.

Desktop:

Sidebar
    ↓
Main Workspace

Mobile:

Main Workspace
    ↓
Bottom Navigation

Primary navigation:

Beranda
Dokumen
Proses
Analitik
Akun

UI detail berada pada:

docs/UI_SPEC.md
docs/DESIGN_SYSTEM.md
14. Current Application Routes

Current application surfaces include:

/
 /login

/app
/app/students
/app/employees
/app/ocr
/app/verify
/app/audit
/app/export

/api/documents/[documentId]/file
/api/internal/document-processing
/api/public/upload

/upload/[token]

Route availability does not imply that every capability is production-complete.

Implementation status harus selalu diverifikasi terhadap source code dan tests.

15. Non-Functional Requirements
Security
tenant isolation;
authenticated server execution;
authorization at server boundary;
object-storage namespace isolation;
immutable audit trail;
safe storage path validation.
Integrity
SHA-256 checksum untuk stored binary;
canonical document/version relationship;
explicit workflow state;
transactional persistence untuk critical operations.
Reliability

Document processing menggunakan job-oriented architecture untuk memungkinkan controlled processing dan retry.

Maintainability

Domain logic tidak boleh bergantung langsung pada UI implementation.

Platform services harus dapat digunakan oleh lebih dari satu domain.

16. Testing Requirements

Critical platform capabilities harus memiliki automated tests.

Area yang telah memiliki test coverage mencakup:

authentication/session;
document intelligence orchestration;
award proposal workflow;
document upload;
student OCR server actions;
student export;
audit server actions;
exception server actions;
student server actions;
object storage;
public upload;
document processing jobs;
document extractor factory;
Gemini document extractor;
local OCR;
PDF rendering;
document processing integration.

Canonical test command:

npm test

TypeScript validation:

npx tsc --noEmit

Production build validation:

npm run build
17. Current Implementation Status

The repository currently contains a substantial implementation of the platform foundation.

Verified implementation areas include:

PostgreSQL persistence;
Prisma mapping;
tenant-aware data model;
RLS infrastructure;
authenticated execution context;
server action boundaries;
Student Administration;
Employee Administration;
Document Intelligence;
OCR/extractor pipeline;
document processing jobs;
exception handling;
human verification;
audit infrastructure;
canonical object storage;
authenticated document file access.

The current implementation should be treated as an evolving platform foundation, not as a declaration that every planned product capability is complete.

18. Known Technical Debt / Open Areas
18.1 Filesystem Storage Tracing

The current filesystem object storage implementation produces a Turbopack build warning because the storage root is dynamically resolved.

Current warning concerns:

src/platform/storage/filesystem.ts

This does not currently prevent the production build from succeeding.

The issue should be addressed separately as a deployment/build optimization concern.

18.2 Runtime Storage Artifacts

Local runtime processing produces files under:

.data/object-storage/

These are runtime artifacts and must not be committed as application source.

The repository should keep this directory ignored by Git.

18.3 Document Viewer Integration

The authenticated document file endpoint exists as a server boundary.

The next UI-level work is to integrate this endpoint with document inspection / verification surfaces without bypassing the authenticated document boundary.

19. Roadmap
Completed / Implemented Foundation
multi-tenant persistence;
PostgreSQL/RLS foundation;
authentication context;
authorization boundaries;
Student Administration foundation;
Employee Administration foundation;
Document Intelligence foundation;
OCR/extractor infrastructure;
document processing jobs;
exception/human verification infrastructure;
object storage abstraction;
canonical student route;
authenticated document file access boundary.
Next Engineering Focus

Priority should remain on completing and hardening the existing canonical architecture before adding unrelated product domains.

Near-term priorities:

integrate document file access with verification/document inspection UI;
validate document access authorization and tenant isolation with automated tests;
resolve or intentionally scope the Turbopack filesystem tracing warning;
continue hardening Document Intelligence orchestration;
reconcile documentation against implementation after each bounded architectural change.
Future Domains

Potential future domains include:

KGB;
Kenaikan Pangkat;
Admissions;
assistance / KJP / Bansos administrative workflows;
additional institution-specific workflows.

Future domains must reuse the platform core rather than creating independent parallel architectures.

20. Product Governance Rule

The PRD defines product intent and requirements.

It is not permission to invent implementation status.

When implementation and documentation diverge:

Source Code
Database Schema
Tests
Runtime Verification
        ↓
Actual System State
        ↓
Documentation Update

New implementation must be justified by a bounded requirement and must preserve established platform contracts.
