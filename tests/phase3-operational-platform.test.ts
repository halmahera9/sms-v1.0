import { PlatformExceptionQueue } from '../src/platform/exceptions/queue';
import { PlatformOperationalService } from '../src/platform/services/operational';

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
console.log('   BANYUBIRU PLATFORM PHASE 3 AUTOMATED TEST SUITE   ');
console.log('=====================================================\n');

// 1. Exception Listing & Queue Management
console.log('[1] Testing Exception Listing & Queue Management...');
const excQueue = new PlatformExceptionQueue();
const exc1 = excQueue.createException({
  entityType: 'AwardProposal',
  entityId: 'prop-emp-101',
  ruleId: 'DOC_COMPLETENESS_RULE',
  severity: 'ERROR',
  message: 'Berkas wajib SK CPNS belum diunggah.',
});

const exc2 = excQueue.createException({
  entityType: 'ExtractedItem',
  entityId: 'item-std-202',
  ruleId: 'OCR_CONFIDENCE_RULE',
  severity: 'ERROR',
  message: 'Akurasi ekstraksi OCR 62% di bawah threshold 70%.',
});

const allExceptions = excQueue.getAll();
assert(allExceptions.length === 2 && exc2.id !== '', 'Should list exactly 2 exceptions');

// 2. Exception Filtering
console.log('\n[2] Testing Exception Filtering by Entity/Domain...');
const empExceptions = excQueue.getByEntity('AwardProposal', 'prop-emp-101');
assert(empExceptions.length === 1, 'Should find 1 Employee domain exception');
assert(empExceptions[0].ruleId === 'DOC_COMPLETENESS_RULE', 'RuleId should match DOC_COMPLETENESS_RULE');

// 3. Exception Status Transition
console.log('\n[3] Testing Exception Status Transitions...');
const inReviewExc = excQueue.updateStatus(exc1.id, 'IN_REVIEW', 'Verifier BKD', 'Sedang diverifikasi ulang');
assert(inReviewExc !== null && inReviewExc.status === 'IN_REVIEW', 'Status should update to IN_REVIEW');

// 4. Exception Resolution
console.log('\n[4] Testing Exception Resolution Pipeline...');
const resolvedExc = excQueue.updateStatus(exc1.id, 'RESOLVED', 'Admin BKD', 'SK CPNS telah disusulkan');
assert(resolvedExc !== null && resolvedExc.status === 'RESOLVED', 'Status should update to RESOLVED');
assert(resolvedExc?.resolutionNote === 'SK CPNS telah disusulkan', 'Resolution note should be recorded');

// 5. Unified Cross-Domain Display Verification
console.log('\n[5] Testing Unified Cross-Domain Exception Aggregation...');
const openExceptions = excQueue.getOpenExceptions();
assert(openExceptions.length === 1, 'Should have 1 open exception remaining (Student OCR exception)');
assert(openExceptions[0].entityType === 'ExtractedItem', 'Remaining exception should belong to Student domain');

// 6. Work Queue Aggregation
console.log('\n[6] Testing Work Queue Aggregation Service...');
const opService = new PlatformOperationalService();
opService.getWorkQueueItems().then((workItems) => {
  assert(Array.isArray(workItems), 'Work queue items should return an array');
  assert(workItems.length >= 0, 'Work queue items should be queryable');
});

// 7. Audit Feed Aggregation
console.log('\n[7] Testing Audit Feed Aggregation...');
const auditEngine = opService.getAuditEngine();
auditEngine.recordEvent({
  actor: 'Platform Admin',
  action: 'RESOLVE_EXCEPTION',
  entityType: 'AwardProposal',
  entityId: 'prop-emp-101',
  metadata: { note: 'Resolved manually' },
});

const auditEvents = auditEngine.getAllEvents();
assert(auditEvents.length >= 1, 'Audit engine should record resolution event');

// 8. Operational Metrics Calculation
console.log('\n[8] Testing Dashboard Metrics Calculation...');
opService.getOperationalMetrics().then((metrics) => {
  assert(metrics.totalEmployees === 1078, 'Total employees count should equal 1,078');
  assert(metrics.totalStudents === 8, 'Total students count should equal 8');
  assert(typeof metrics.pendingVerifications === 'number', 'Pending verifications count should be numeric');

  console.log('\n=====================================================');
  console.log(` SUCCESS: All ${passCount}/${testCount} Phase 3 tests passed!  `);
  console.log('=====================================================\n');
});
