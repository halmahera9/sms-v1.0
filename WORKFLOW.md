
Banyubiru Operational Workflow
OCR → Verification
1. Upload document
2. Create Document
3. Create DocumentVersion
4. Create OCRExtraction
5. Extract items
6. Validate extracted items
7. Generate exceptions when required
8. Match students
9. Operator verifies
10. Create AbsenceRecord for PASSED items
11. Record HumanVerification
12. Record AuditEvent
13. Complete document when all items are resolved
Verification Rules
PASSED

Requirements:

Extracted item exists.
Student is identified.
Student belongs to the current tenant.

Result:

AbsenceRecord created
ExtractedItem updated
HumanVerification created
AuditEvent created
FLAGGED

Result:

HumanVerification created
AuditEvent created
No AbsenceRecord
REJECTED

Result:

HumanVerification created
AuditEvent created
No AbsenceRecord
Student Identity Rule

Never create synthetic student data during verification.

Bad pattern:

OCR name
   ↓
Student does not exist
   ↓
Create fake Student

Correct pattern:

OCR data
   ↓
Match existing Student
   ↓
If unresolved → operator intervention
   ↓
PASSED only after identity is resolved
Document Completion

A document is considered verification-complete when no ExtractedItem belonging to its OCR extraction remains without an AbsenceRecord.

Unresolved or flagged business cases must remain visible to the operator rather than being silently converted into attendance records.
