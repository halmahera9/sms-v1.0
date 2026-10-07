
Banyubiru Architecture
Architectural Direction

Banyubiru uses a layered application architecture.

Next.js App Router
        ↓
Server Action Boundary
        ↓
Application / Domain Services
        ↓
Repositories / Infrastructure
        ↓
PostgreSQL
Major Domains
Tenant
UserActor
Student
Employee
Document
DocumentVersion
OCRExtraction
ExtractedItem
HumanVerification
AbsenceRecord
WorkflowInstance
WorkflowTransition
ValidationResult
ExceptionItem
AuditEvent
Document Intelligence

Canonical document processing model:

Document
  └── DocumentVersion
        └── OCRExtraction
              └── ExtractedItem
                    ├── Student Matching
                    ├── Validation
                    ├── Exception
                    └── HumanVerification
Student Matching

Student matching must be deterministic and tenant-scoped.

Resolution order:

Existing matchedStudentId
        ↓
NISN lookup
        ↓
Exact student-name lookup
        ↓
Unresolved

Unresolved items must not automatically create a student.

The operator must resolve the identity before a successful verification can generate an AbsenceRecord.

Dapodik Student Synchronization

Dapodik student synchronization is implemented through a protected server
action boundary.

Current structure:

Student Workspace
        ↓
Server Action
        ↓
Dapodik Import Service
        ↓
Student Repository
        ↓
PostgreSQL

The Dapodik service currently supports:

- Excel parsing
- NISN/NIS-based student lookup
- Student field extraction
- Blank-field enrichment
- Import result reporting
- Preview operation

The preview boundary is available through:

previewDapodikAction

The Student Workspace has not yet been migrated to a preview-first
interaction. The current upload handler still invokes the import operation
directly.

Required target architecture:

Student Workspace
        ↓
previewDapodikAction
        ↓
Dapodik Preview
        ↓
Administrative Approval
        ↓
Apply Action
        ↓
Dapodik Import Service
        ↓
Student Repository
        ↓
PostgreSQL

Dapodik Resolution States

UNCHANGED
    No master mutation.

FILL_BLANK
    Populate fields that are blank in the master record.

CONFLICT
    Existing master values must not be silently overwritten.

NEW
    Must require explicit administrative approval before insertion.

Important Constraint

Dapodik import must not bypass the server action authorization boundary,
tenant context, repository layer, or administrative approval workflow.

Verification Transaction

The canonical PASSED path is transactional:

Fetch ExtractedItem
        ↓
Resolve Student
        ↓
Create AbsenceRecord
        ↓
Update ExtractedItem
        ↓
Create HumanVerification
        ↓
Record AuditEvent
        ↓
Check remaining items
        ↓
Complete Document when appropriate
Security

Operations are executed through the authenticated context and tenant context.

Authorization is asserted before protected workflow operations.

Example:

STUDENT_WORKFLOW_VERIFY
Audit

Administrative mutations must produce an immutable audit trail.

Relevant verification event:

VERIFY_ITEM
Database

Primary persistence layer:

PostgreSQL
Prisma

Tenant isolation is enforced at the persistence layer and application boundary.

Important Constraint

Do not bypass canonical repositories, authorization boundaries, tenant context, or audit recording merely to make a UI operation work.

## PINPOINT — EMPLOYEE / GURU / DAPODIK

Server boundary:
`src/app/app/employees/page.tsx` → `src/platform/actions/employee.ts` → Employee repository / database.

Dapodik flow:
Dapodik Excel → `src/platform/services/dapodik/dapodik-import.ts` → Preview → explicit Apply → Employee Master.

Rules:
- FILL_BLANK may fill empty Master fields.
- CONFLICT must not overwrite existing Master values automatically.
- NEW requires explicit Apply.
- UI status terminology follows the canonical Student UX.

Detailed implementation baseline is maintained in `PRD.md`.
