import fs from 'fs';
import path from 'path';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runStudentClientMigrationTests() {
  console.log('=====================================================');
  console.log(' STUDENT CLIENT MIGRATION TEST SUITE                 ');
  console.log('=====================================================\n');

  const componentPath = path.join(
    process.cwd(),
    'src/domains/student/components/StudentWorkspace.tsx'
  );

  assert(fs.existsSync(componentPath), 'StudentWorkspace.tsx file exists');
  const componentSource = fs.readFileSync(componentPath, 'utf8');

  // TEST 1: StudentWorkspace imports getStudentsAction
  assert(
    componentSource.includes('getStudentsAction') &&
      componentSource.includes("from '@/platform/actions/student'"),
    'TEST 1: StudentWorkspace imports getStudentsAction server action'
  );

  // TEST 2: StudentWorkspace imports saveStudentAction
  assert(
    componentSource.includes('saveStudentAction') &&
      componentSource.includes("from '@/platform/actions/student'"),
    'TEST 2: StudentWorkspace imports saveStudentAction server action'
  );

  // TEST 3: Student Master Data does not use getStoredStudents
  assert(
    !componentSource.includes('getStoredStudents'),
    'TEST 3: StudentWorkspace has removed getStoredStudents for Master Data'
  );

  // TEST 4: Student Master Data does not write localStorage
  assert(
    !componentSource.includes("localStorage.setItem('banyubiru_students") &&
      !componentSource.includes('localStorage.setItem("banyubiru_students'),
    'TEST 4: Student Master Data does not write to localStorage'
  );

  // TEST 5: StudentLocalStorageRepository is not instantiated
  assert(
    !componentSource.includes('StudentLocalStorageRepository') &&
      !componentSource.includes('new StudentLocalStorageRepository'),
    'TEST 5: StudentLocalStorageRepository is not instantiated in StudentWorkspace'
  );

  // TEST 6: No actorId is supplied by client
  assert(
    !componentSource.includes('actorId:') &&
      !componentSource.includes('actorId ='),
    'TEST 6: Client does not supply actorId authority'
  );

  // TEST 7: No tenantId is supplied as authority
  assert(
    !componentSource.includes('tenantId:') &&
      !componentSource.includes('tenantId ='),
    'TEST 7: Client does not supply tenantId authority'
  );

  // TEST 8: No role is supplied as authority
  assert(
    !componentSource.includes('role:') &&
      !componentSource.includes('role ='),
    'TEST 8: Client does not supply role authority'
  );

  // TEST 9: Server Action error is handled
  assert(
    componentSource.includes('studentError') &&
      componentSource.includes('formError') &&
      componentSource.includes('res.error'),
    'TEST 9: StudentWorkspace handles Server Action errors explicitly'
  );

  // TEST 10: Loading state exists for master data retrieval
  assert(
    componentSource.includes('loadingStudents') &&
      componentSource.includes('setLoadingStudents'),
    'TEST 10: StudentWorkspace implements loading state for student retrieval'
  );

  // TEST 11: Duplicate save submission is prevented
  assert(
    componentSource.includes('isSaving') &&
      componentSource.includes('if (isSaving) return;') &&
      componentSource.includes('disabled={isSaving}'),
    'TEST 11: StudentWorkspace prevents duplicate form submissions while saving'
  );

  // TEST 12: OCR/document transitional dependencies remain intact
  assert(
    componentSource.includes('getStoredDocuments') &&
      componentSource.includes('saveDocuments') &&
      componentSource.includes('addAuditLog'),
    'TEST 12: OCR/document transitional dependencies remain legitimately present'
  );

  console.log(`\n=====================================================`);
  console.log(` RESULT: All ${passCount}/${testCount} Student Client Migration tests PASSED `);
  console.log(`=====================================================\n`);
}

runStudentClientMigrationTests().catch((err) => {
  console.error('Fatal Student Client Migration Test Error:', err);
  process.exit(1);
});
