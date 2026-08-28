import { studentAbsenceWorkflowEngine } from '../src/domains/student/workflow';
import { studentValidationEngine, ocrItemValidationEngine, ocrDocumentValidationEngine } from '../src/domains/student/rules';
import { StudentLocalStorageRepository, OCRDocumentLocalStorageRepository } from '../src/domains/student/repository';
import { PlatformExceptionQueue } from '../src/platform/exceptions/queue';
import { PlatformAuditEngine } from '../src/platform/audit/engine';
import { Student, ExtractedItem, OCRDocument } from '../src/domains/student/types';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('=====================================================');
console.log('   BANYUBIRU PLATFORM PHASE 2 AUTOMATED TEST SUITE   ');
console.log('=====================================================\n');

// 1. Student Repository
console.log('[1] Testing Student Repository Abstraction...');
const studentRepo = new StudentLocalStorageRepository();
const mockStudents = studentRepo.generateInitialMockStudents();
assert(mockStudents.length === 8, 'Should produce 8 initial mock students');
assert(mockStudents[0].nisn === '0051234567', 'First student NISN should match');

const docRepo = new OCRDocumentLocalStorageRepository();
const mockDocs = docRepo.generateInitialMockDocuments();
assert(mockDocs.length === 1, 'Should produce 1 initial mock OCR document');
assert(mockDocs[0].items.length === 2, 'Mock OCR document should contain 2 items');

// 2. Student Workflow (Valid & Invalid Transitions)
console.log('\n[2] Testing Student Workflow Engine (Domain-Agnostic Engine Reuse)...');
const availableEvents = studentAbsenceWorkflowEngine.getAvailableTransitions('DRAFT');
assert(availableEvents.includes('PROCESS_OCR'), 'DRAFT should allow PROCESS_OCR');
assert(availableEvents.includes('SUBMIT_FOR_VERIFICATION'), 'DRAFT should allow SUBMIT_FOR_VERIFICATION');

const validTransition = studentAbsenceWorkflowEngine.transition('DRAFT', 'PROCESS_OCR', {}, 'OCR-System');
assert(validTransition.success === true, 'Transition from DRAFT via PROCESS_OCR should succeed');
assert(validTransition.toState === 'NEEDS_VERIFICATION', 'Target state should be NEEDS_VERIFICATION');

const invalidTransition = studentAbsenceWorkflowEngine.transition('DRAFT', 'ARCHIVE_COMPLETE', {}, 'User');
assert(invalidTransition.success === false, 'Direct transition from DRAFT to ARCHIVE_COMPLETE should fail');
assert(invalidTransition.toState === 'DRAFT', 'State should remain DRAFT on invalid transition');

// Guard check test
const guardFailTransition = studentAbsenceWorkflowEngine.transition(
  'NEEDS_VERIFICATION',
  'VERIFY_ALL_ITEMS',
  { allItemsVerified: false },
  'Operator'
);
assert(guardFailTransition.success === false, 'Guard check should block verification when items are not all verified');

const guardPassTransition = studentAbsenceWorkflowEngine.transition(
  'NEEDS_VERIFICATION',
  'VERIFY_ALL_ITEMS',
  { allItemsVerified: true },
  'Operator'
);
assert(guardPassTransition.success === true, 'Guard check should allow verification when all items are verified');
assert(guardPassTransition.toState === 'VERIFIED', 'Target state should be VERIFIED');

// 3. Student Validation Rules
console.log('\n[3] Testing Student Validation Rules Engine...');
const validStudent: Student = { id: 's-1', nisn: '0051234567', name: 'Ahmad Dahlan', class: 'X IPA 1', status: 'Aktif' };
const invalidStudent: Student = { id: 's-2', nisn: '', name: '', class: 'X IPA 1', status: 'Aktif' };

const validResults = studentValidationEngine.validateEntity(validStudent);
assert(validResults.every((r) => r.valid), 'Valid student entity should pass validation');

const invalidResults = studentValidationEngine.validateEntity(invalidStudent);
assert(invalidResults.some((r) => !r.valid && r.severity === 'ERROR'), 'Invalid student should return ERROR validation result');

// 4. OCR Extraction Confidence & Exception Queue
console.log('\n[4] Testing OCR Confidence Validation & Exception Queue...');
const lowConfidenceItem: ExtractedItem = {
  id: 'item-low-conf',
  ocrText: 'Budi S - X IPA 1',
  matchedStudentId: undefined, // Unmatched
  confidence: 65, // Below 70% threshold
  class: 'X IPA 1',
  date: '2026-08-21',
  status: 'Izin',
  verificationStatus: 'pending',
};

const ocrValidationRes = ocrItemValidationEngine.validateEntity(lowConfidenceItem);
assert(ocrValidationRes.some((r) => !r.valid), 'Low confidence OCR item should fail validation');

const excQueue = new PlatformExceptionQueue();
const exceptions = excQueue.createFromValidationResults('ExtractedItem', lowConfidenceItem.id, ocrValidationRes);
assert(exceptions.length === 1, 'Should create 1 exception item for failed OCR extraction');
assert(exceptions[0].status === 'OPEN', 'Exception status should be OPEN');
assert(exceptions[0].severity === 'HIGH', 'Exception severity should be ExceptionSeverity HIGH');

// 5. Exception Resolution
console.log('\n[5] Testing Exception Resolution Pipeline...');
const resolvedExc = excQueue.updateStatus(exceptions[0].id, 'RESOLVED', 'Operator Guru', 'Siswa berhasil dicocokkan secara manual');
assert(resolvedExc !== null && resolvedExc.status === 'RESOLVED', 'Exception should update to RESOLVED');
assert(resolvedExc?.resolvedBy === 'Operator Guru', 'ResolvedBy actor should be recorded');

// 6. Student Audit Events
console.log('\n[6] Testing Student Audit Event Logging...');
const auditEngine = new PlatformAuditEngine();
const auditEv = auditEngine.recordEvent({
  actor: 'Operator Sekolah',
  action: 'VERIFY_ABSENCE_ITEM',
  entityType: 'ExtractedItem',
  entityId: lowConfidenceItem.id,
  beforeState: { verificationStatus: 'pending' },
  afterState: { verificationStatus: 'verified' },
  metadata: { matchedStudentId: 'std-2' },
});

assert(auditEv.id.startsWith('audit-'), 'Audit event ID should be generated');
assert(auditEv.actor === 'Operator Sekolah', 'Audit actor should match');
assert(auditEngine.getEvents().length === 1, 'Audit engine should store 1 event');

// 7. OCR Extraction -> Human Verification Flow
console.log('\n[7] Testing End-to-End OCR Pipeline (Human-in-the-Loop)...');
const sampleDoc: OCRDocument = {
  id: 'doc-pipeline-1',
  fileName: 'Surat_Izin.png',
  fileSize: 500000,
  uploadedAt: new Date().toISOString(),
  imageUrl: '/placeholder.png',
  status: 'needs_verification',
  workflowState: 'NEEDS_VERIFICATION',
  extractedCount: 1,
  verifiedCount: 0,
  items: [lowConfidenceItem],
};

// Verify initial state
assert(sampleDoc.status === 'needs_verification', 'Document initial status should be needs_verification');

// Human verification action (Human remains authoritative)
sampleDoc.items[0].verificationStatus = 'verified';
sampleDoc.items[0].matchedStudentId = 'std-2';
sampleDoc.verifiedCount = 1;

const finalDocValidation = ocrDocumentValidationEngine.validateEntity(sampleDoc);
assert(finalDocValidation.every((r) => r.severity !== 'ERROR' || r.valid), 'Document with verified items should pass error validation');

console.log('\n=====================================================');
console.log(` SUCCESS: All ${passCount}/${testCount} Phase 2 tests passed!  `);
console.log('=====================================================\n');
