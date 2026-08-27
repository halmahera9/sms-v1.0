import { PlatformExceptionQueue } from '../src/platform/exceptions/queue';
import { PlatformAuditEngine } from '../src/platform/audit/engine';
import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { employeeAwardValidationEngine, calculateProposalStatus } from '../src/domains/employee/awards/rules';
import { AwardProposal } from '../src/domains/employee/awards/types';
import { EmployeeAwardLocalStorageRepository } from '../src/domains/employee/awards/repository';

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
console.log('   BANYUBIRU PLATFORM PHASE 1 AUTOMATED TEST SUITE   ');
console.log('=====================================================\n');

// 1. Workflow Transition Validation
console.log('[1] Testing Workflow Engine Transitions...');
const availableEvents = employeeAwardWorkflowEngine.getAvailableTransitions('NOMINATIF');
assert(availableEvents.includes('SUBMIT_NOMINATIVE'), 'NOMINATIF should allow SUBMIT_NOMINATIVE');
assert(availableEvents.includes('UPLOAD_DOCUMENT'), 'NOMINATIF should allow UPLOAD_DOCUMENT');

const transitionRes = employeeAwardWorkflowEngine.transition('NOMINATIF', 'SUBMIT_NOMINATIVE', {}, 'test-actor');
assert(transitionRes.success === true, 'Transition from NOMINATIF via SUBMIT_NOMINATIVE should succeed');
assert(transitionRes.toState === 'BELUM_UPLOAD', 'Target state should be BELUM_UPLOAD');

// 2. Invalid Workflow Transition
console.log('\n[2] Testing Invalid Workflow Transitions...');
const invalidRes = employeeAwardWorkflowEngine.transition('NOMINATIF', 'SIGN', {}, 'test-actor');
assert(invalidRes.success === false, 'Transition from NOMINATIF via SIGN should fail');
assert(invalidRes.toState === 'NOMINATIF', 'State should remain unchanged on invalid transition');
assert(Boolean(invalidRes.reason), 'Failure reason should be provided');

// 3. Validation Result Structure
console.log('\n[3] Testing Validation Engine Contract...');
const dummyProposal: AwardProposal = {
  id: 'test-prop-1',
  employeeId: 'emp-1',
  employee: {
    id: 'emp-1',
    nip: '198001012010011001',
    nrk: '180001',
    nama: 'Budi Santoso',
    jabatan: 'Staf',
    unitKerja: 'BKD',
    perangkatDaerah: 'BKD',
    ukpd: 'BKD',
    wilayah: 'Jakarta Pusat',
  },
  jenisPenghargaan: 'MASA_KERJA',
  nilaiUsulan: '10',
  tahunUsulan: 2026,
  masaKerjaTahun: 10,
  masaKerjaBulan: 0,
  status: 'NOMINATIF',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  documents: [],
};

const validationResults = employeeAwardValidationEngine.validateEntity(dummyProposal);
assert(Array.isArray(validationResults), 'Validation results must be an array');
assert(validationResults.length > 0, 'Should return validation rule results');
assert(validationResults[0].ruleId !== undefined, 'Result must contain ruleId');
assert(validationResults[0].severity !== undefined, 'Result must contain severity');

// 4. Exception Creation
console.log('\n[4] Testing Exception Queue Creation...');
const excQueue = new PlatformExceptionQueue();
const excItems = excQueue.createFromValidationResults('AwardProposal', dummyProposal.id, validationResults);
assert(excItems.length > 0, 'Exception items should be created from invalid validation results');
assert(excItems[0].status === 'OPEN', 'Initial exception status must be OPEN');

// 5. Exception Resolution
console.log('\n[5] Testing Exception Resolution...');
const firstExcId = excItems[0].id;
const updatedExc = excQueue.updateStatus(firstExcId, 'RESOLVED', 'Admin Test', 'Dokumen disusulkan');
assert(updatedExc !== null, 'Updated exception should not be null');
assert(updatedExc?.status === 'RESOLVED', 'Exception status should update to RESOLVED');
assert(updatedExc?.resolvedBy === 'Admin Test', 'Resolver name should be updated');

// 6. Audit Event Creation
console.log('\n[6] Testing Audit Trail Engine...');
const auditEngine = new PlatformAuditEngine();
const auditEv = auditEngine.recordEvent({
  actor: 'Operator A',
  action: 'VERIFY_DOCUMENT',
  entityType: 'AwardProposal',
  entityId: dummyProposal.id,
  beforeState: { status: 'NOMINATIF' },
  afterState: { status: 'DIVERIFIKASI' },
});
assert(auditEv.id.startsWith('audit-'), 'Audit event ID should have audit- prefix');
assert(auditEv.actor === 'Operator A', 'Audit actor should match');
assert(auditEngine.getEvents().length === 1, 'Audit engine should store recorded event');

// 7. Employee Award Checklist Validation
console.log('\n[7] Testing Employee Award Checklist Calculation...');
const emptyStatus = calculateProposalStatus('MASA_KERJA', [], 'NOMINATIF');
assert(emptyStatus === 'BELUM_UPLOAD', 'Empty documents should compute to BELUM_UPLOAD');

// 8. Repository Behavior
console.log('\n[8] Testing Repository Abstraction...');
const repo = new EmployeeAwardLocalStorageRepository();
const mockProposals = repo.generateInitialMockProposals();
assert(mockProposals.length === 1078, 'Mock generator should produce exactly 1,078 proposals');
const mkCount = mockProposals.filter((p) => p.jenisPenghargaan === 'MASA_KERJA').length;
const slCount = mockProposals.filter((p) => p.jenisPenghargaan === 'SATYALANCANA').length;
assert(mkCount === 449, 'Masa Kerja proposals must count 449');
assert(slCount === 629, 'Satyalancana proposals must count 629');

console.log('\n=====================================================');
console.log(` SUCCESS: All ${passCount}/${testCount} tests passed cleanly! `);
console.log('=====================================================\n');
