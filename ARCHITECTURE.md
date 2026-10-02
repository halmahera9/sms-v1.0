
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
