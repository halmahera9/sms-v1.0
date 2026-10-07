# Banyubiru

Banyubiru is an Administrative Intelligence Platform for school administration.

Current implementation focuses on:

- Student administration
- Employee administration
- Document and OCR processing
- Human verification workflow
- Student matching
- Absence record generation
- Audit trail
- Export
- Operational dashboard
- Configurable document/signatory settings

## Current Status

Baseline: `418a00b`

Current branch:

```text
main
Remote:
origin/main

Latest commits:

418a00b chore: anchor student workspace and sidebar baseline
e0da826 fix: redirect root to application dashboard
03b21d0 feat: add canonical extracted item student matching
4db3c3b fix: prevent invalid student creation during verification
d4f0469 feat: migrate verification page to canonical workflow
Application Routes
/                       Root application entry
/login                  Authentication
/app                    Application dashboard
/app/students           Student administration
/app/employees          Employee administration
/app/ocr                OCR upload and processing
/app/verify             Operator verification
/app/export             Export
/app/audit              Audit trail
/upload/[token]         Public upload
Student Administration Status

The current Student Administration baseline includes:

- PostgreSQL-backed student master data
- Student preview and edit workspace
- NISN, NIS, NIK, No. KK, gender, grade level, religion, entry date, class, and status fields
- Dapodik Excel import foundation
- Dapodik student preview server action
- Student master sidebar navigation with route-specific active state

Current Dapodik update flow:

Select Dapodik Excel
        ↓
Current implementation imports directly to the student master

The previewDapodikAction server boundary already exists, but the Student
Workspace has not yet been migrated to use the preview-first flow.

Target flow:

Select Dapodik Excel
        ↓
Dapodik Preview
        ↓
Admin Review
        ↓
Apply
        ↓
Student Master

Dapodik import must distinguish:

UNCHANGED
FILL_BLANK
CONFLICT
NEW

NEW records must not be inserted into the master automatically without
explicit administrative approval.

Verification Workflow

The canonical verification flow is:

Document
   ↓
OCRExtraction
   ↓
ExtractedItem
   ↓
Student Matching
   ↓
Human Verification
   ↓
AbsenceRecord
   ↓
AuditEvent

Important rule:

Verification must never create a fake student record.

A student must already exist or be explicitly matched before a PASSED verification can create an AbsenceRecord.

Verification Decisions
PASSED
FLAGGED
REJECTED

Only PASSED creates the canonical AbsenceRecord.

FLAGGED and REJECTED record the human decision and audit event without creating attendance data.

Validation

Before committing:

# Generate Prisma client
npx prisma generate

# Diff validation sebelum commit
git diff --check
npx tsc --noEmit
npm run build

Then:

git status --short
git log --oneline -5


## PINPOINT — EMPLOYEE / GURU / DAPODIK

Implementation baseline: see `PRD.md` section `PINPOINT — EMPLOYEE / GURU / DAPODIK — 2026-10-07`.

Canonical source files:
- `src/app/app/employees/page.tsx`
- `src/platform/actions/employee.ts`
- `src/platform/services/dapodik/dapodik-import.ts`
