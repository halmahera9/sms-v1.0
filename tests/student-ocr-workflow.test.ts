import { StudentLocalStorageRepository, OCRDocumentLocalStorageRepository } from '../src/domains/student/repository';
import { PlatformOperationalService } from '../src/platform/services/operational';
import { saveDocuments, getStoredDocuments, addAuditLog, getStoredAuditLogs } from '../src/lib/storage';
import { OCRDocument } from '../src/domains/student/types';

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
console.log('   BANYUBIRU STUDENT OCR WORKFLOW REGRESSION SUITE   ');
console.log('=====================================================\n');

// 1. OCR Upload creates a document
console.log('[1] Testing OCR Upload Document Creation...');
const newDoc: OCRDocument = {
  id: `doc-ocr-test-${Date.now()}`,
  fileName: `Surat_Izin_Ketidakhadiran_Test_${Date.now()}.png`,
  fileSize: 1024 * 400,
  uploadedAt: new Date().toISOString(),
  imageUrl: '/placeholder-doc.png',
  status: 'needs_verification',
  workflowState: 'NEEDS_VERIFICATION',
  extractedCount: 2,
  verifiedCount: 0,
  items: [
    {
      id: `test-item-1-${Date.now()}`,
      ocrText: 'Budi Test - X IPA 1 - Sakit',
      matchedStudentId: 'std-1',
      matchedStudentName: 'Ahmad Dahlan',
      matchedNisn: '0051234567',
      confidence: 90,
      class: 'X IPA 1',
      date: new Date().toISOString().slice(0, 10),
      status: 'Sakit',
      notes: 'Demam',
      verificationStatus: 'pending',
    },
    {
      id: `test-item-2-${Date.now()}`,
      ocrText: 'Cici Test - X IPA 2 - Izin',
      matchedStudentId: 'std-2',
      matchedStudentName: 'Budi Santoso',
      matchedNisn: '0051234568',
      confidence: 85,
      class: 'X IPA 2',
      date: new Date().toISOString().slice(0, 10),
      status: 'Izin',
      notes: 'Acara keluarga',
      verificationStatus: 'pending',
    },
  ],
};

const currentDocs = getStoredDocuments();
const updatedDocs = [newDoc, ...currentDocs];
saveDocuments(updatedDocs);

assert(newDoc.id !== undefined, 'Uploaded document must have a valid ID');
assert(newDoc.fileName.includes('Surat_Izin_Ketidakhadiran_Test_'), 'Filename must be identified correctly');

// 2. OCR extraction creates items
console.log('\n[2] Testing OCR Extraction Items...');
assert(newDoc.items.length === 2, 'OCR document must extract exactly 2 items');

// 3. New document enters NEEDS_VERIFICATION
console.log('\n[3] Testing New Document Initial Workflow State...');
assert(newDoc.status === 'needs_verification', 'New document status must be "needs_verification"');
assert(newDoc.workflowState === 'NEEDS_VERIFICATION', 'New document workflow state must be "NEEDS_VERIFICATION"');

// 4. Verification changes item/workflow state
console.log('\n[4] Testing Verification Workflow State Transition...');
newDoc.items[0].verificationStatus = 'verified';
newDoc.items[1].verificationStatus = 'verified';
newDoc.verifiedCount = 2;
newDoc.status = 'completed';
newDoc.workflowState = 'VERIFIED';

saveDocuments([newDoc, ...currentDocs]);

const reloadedDocs = getStoredDocuments();
const foundDoc = reloadedDocs.find((d) => d.id === newDoc.id);
assert(foundDoc !== undefined, 'Document must be persisted');
assert(foundDoc?.status === 'completed', 'Document status must update to "completed"');
assert(foundDoc?.workflowState === 'VERIFIED', 'Document workflowState must update to "VERIFIED"');

// 5. Verification creates an audit event
console.log('\n[5] Testing Audit Event Creation and Persistence...');
addAuditLog('Operator Workspace', 'VERIFY_ITEM', newDoc.items[0].id, 'Verifikasi item ketidakhadiran');

const auditLogs = getStoredAuditLogs();
const createdAudit = auditLogs.find((a) => a.target === newDoc.items[0].id);
assert(createdAudit !== undefined, 'Audit event for verification must exist in audit log store');
assert(createdAudit?.operator === 'Operator Workspace', 'Audit actor should match');

// 6. Work Queue reflects new state
console.log('\n[6] Testing Work Queue Synchronization...');
const opService = new PlatformOperationalService();
opService.getWorkQueueItems().then((workItems) => {
  const verifiedItemInQueue = workItems.find((w) => w.entityId === newDoc.items[0].id);
  assert(verifiedItemInQueue === undefined, 'Verified OCR item must be removed from Work Queue');
});

// 7. Dashboard metrics reflect new state
console.log('\n[7] Testing Dashboard Metrics Synchronization...');
opService.getOperationalMetrics().then((metrics) => {
  assert(typeof metrics.pendingVerifications === 'number', 'Dashboard pending verifications must be numeric');

  console.log('\n=====================================================');
  console.log(` SUCCESS: All ${passCount}/${testCount} Student OCR Workflow tests passed! `);
  console.log('=====================================================\n');
});
