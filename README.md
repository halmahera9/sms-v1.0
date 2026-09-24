# Banyubiru Administrative Intelligence Platform

Banyubiru adalah platform **administrative intelligence** multi-tenant untuk institusi pendidikan dan pemerintahan Indonesia.

Platform ini dirancang untuk mengubah proses administrasi yang manual, terfragmentasi, dan berulang menjadi workflow terstruktur berbasis:

- data normalization
- rule / policy model
- validation
- exception handling
- human verification
- approval
- document generation
- reporting
- immutable audit trail

## Current Product Domains

### Student Administration

Workflow utama saat ini:

- Student records
- Absence document processing
- OCR extraction
- Student identity resolution
- Human verification
- Validation / exception bridge
- Absence persistence and export

### Employee Administration

Workflow utama saat ini:

- Employee award proposals
- Masa Kerja / Satyalancana processing
- Document requirements
- Validation and completeness checks
- Multi-stage approval
- SIGN / SEND / ARCHIVE_COMPLETE workflow
- Canonical document persistence

## Current Architecture

Banyubiru menggunakan layered architecture:

```text
Presentation
    ↓
Application / Server Action Boundary
    ↓
Domain Services / Workflow
    ↓
Platform Services
    ↓
Repositories / PostgreSQL
    ↓
Tenant-Isolated Data
Architectural Boundaries

UI tidak menjadi tempat utama untuk business rules atau persistence.

UI / App Router
      ↓
Server Actions / Route Handlers
      ↓
Application Services
      ↓
Domain / Workflow Services
      ↓
Platform Infrastructure
      ↓
Repositories
      ↓
PostgreSQL

Binary documents menggunakan canonical object-storage abstraction:

Upload
  ↓
IObjectStorageProvider
  ↓
FileSystemObjectStorageProvider
  ↓
Tenant-isolated object namespace

Document metadata dan workflow state tetap disimpan di PostgreSQL.

Document Intelligence

Document Intelligence adalah salah satu capability inti Banyubiru.

Pipeline canonical:

Document
   ↓
DocumentVersion
   ↓
Object Storage
   ↓
Document Processing Job
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
Exception / Human Verification
   ↓
Workflow State
   ↓
Audit Trail

Human verification tetap menjadi authority untuk hasil OCR yang membutuhkan keputusan manusia.

Object Storage

Canonical storage contract berada di:

src/platform/storage/types.ts

Provider saat ini:

src/platform/storage/provider.ts
src/platform/storage/filesystem.ts
src/platform/storage/in-memory.ts

Production implementation saat ini menggunakan filesystem provider dengan tenant isolation.

Default storage root:

.data/object-storage

atau nilai dari:

OBJECT_STORAGE_ROOT

Storage path tidak boleh digunakan sebagai akses langsung dari browser. File dokumen diakses melalui authenticated server boundary.

Current document file route:

GET /api/documents/[documentId]/file

Route melakukan:

authentication context resolution
authorization check
tenant-scoped document lookup
latest DocumentVersion resolution
object storage download
response sebagai binary document
Security Model

Banyubiru menggunakan:

multi-tenant data model
PostgreSQL Row Level Security
authenticated execution context
server action authorization
tenant-scoped repository access
immutable audit events
canonical object-storage tenant namespace

Tenant ID harus berasal dari trusted authenticated context dan tidak boleh dipercaya dari input browser sebagai sumber otoritas.

Technology Stack
Next.js 16.3.1
React 19.2.8
TypeScript 5
Tailwind CSS 4
PostgreSQL 17
Prisma 7.10.x
@prisma/adapter-pg
xlsx
jspdf
jspdf-autotable
fuse.js
Lucide React
Google Gemini via @google/genai
Repository Structure
src/
├── app/
│   ├── api/
│   └── app/
├── domains/
│   ├── document/
│   ├── employee/
│   └── student/
├── platform/
│   ├── actions/
│   ├── auth/
│   ├── db/
│   ├── repositories/
│   ├── services/
│   ├── storage/
│   └── ...
└── ...

docs/
├── PRD.md
├── ARCHITECTURE.md
├── UI_SPEC.md
├── DATABASE.md
├── DOMAIN_MODEL.md
├── WORKFLOWS.md
├── RBAC.md
├── VALIDATION_RULES.md
├── phase4/
└── ai-context/
Development

Install dependencies:

npm install

Development server:

npm run dev

Production build:

npm run build

Tests:

npm test

Type checking:

npx tsc --noEmit

Diff validation:

git diff --check
Current Repository State

The current implementation has passed the production build:

next build
✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages

The build currently emits a Turbopack warning related to dynamic filesystem tracing in:

src/platform/storage/filesystem.ts

This warning is architectural/deployment-related and should be handled separately from the functional document-file route implementation.

Documentation Map
Document	Purpose
README.md	Project entry point and current system overview
docs/PRD.md	Product scope, principles, capabilities, roadmap
docs/ARCHITECTURE.md	Canonical system architecture and boundaries
docs/UI_SPEC.md	Existing UI specification
docs/DESIGN_SYSTEM.md	Canonical visual and interaction design system
docs/DATABASE.md	Database architecture and persistence
docs/DOMAIN_MODEL.md	Domain entities and relationships
docs/WORKFLOWS.md	Workflow/state-machine definitions
docs/RBAC.md	Authorization model
docs/VALIDATION_RULES.md	Validation and policy rules
AGENTS.md	Repository engineering and AI-agent rules
docs/ai-context/	Detailed engineering handoff/context package
Engineering Rule

Do not treat documentation as a substitute for source-of-truth code.

When documenting implementation state:

Code / Schema / Tests
        ↓
Verified Fact
        ↓
Documentation

Never reverse this direction by implementing behavior merely because an old document says it should exist.

Current Progress

The canonical document binary access boundary is implemented and is now consumed by the existing Student verification preview and Employee Award document links.

Current flow:

Document Consumer
      ↓
/api/documents/[documentId]/file
      ↓
Authenticated Context
      ↓
Authorization
      ↓
Tenant-scoped DocumentVersion
      ↓
Object Storage
      ↓
Binary Response

The underlying object-storage path is no longer exposed directly by these document consumers.

Next Engineering Focus

Continue hardening the existing document boundary and inspect remaining consumers for direct storage-path exposure.

Before introducing new abstractions:

inspect the existing contract
inspect current implementation
verify tenant isolation
verify authorization
verify tests
implement the smallest bounded change
run typecheck/build/tests
review diff
commit only after the working tree is understood
