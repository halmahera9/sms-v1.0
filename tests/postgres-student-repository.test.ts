import 'dotenv/config';
import pg from 'pg';
import { Student } from '@prisma/client';
import { PostgresStudentRepository } from '../src/platform/repositories/student';
import { runInTenantContext } from '../src/platform/db/tenant-context';

// Connection pool using MIGRATION_DATABASE_URL exclusively for setup & teardown
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const repository = new PostgresStudentRepository();

// Dedicated Hex UUID Fixture IDs for Student Repository Tests
const TENANT_A_ID = '44444444-4444-4444-8444-444444444444';
const TENANT_B_ID = '55555555-5555-4555-8555-555555555555';

const ACTOR_A_ID = 'd4444444-4444-4444-8444-444444444444';
const ACTOR_B_ID = 'e5555555-5555-4555-8555-555555555555';

const STUDENT_1_ID = 'a1111111-1111-4111-8111-111111111111';
const STUDENT_2_ID = 'a2222222-2222-4222-8222-222222222222';
const STUDENT_3_ID = 'a3333333-3333-4333-8333-333333333333';
const STUDENT_4_ID = 'a4444444-4444-4444-8444-444444444444';
const STUDENT_5_ID = 'a5555555-5555-4555-8555-555555555555';

const STUDENT_B1_ID = 'b1111111-1111-4111-8111-111111111111';

let testCount = 0;
let passCount = 0;
const results: { test: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    results.push({ test: message, status: 'PASS', detail });
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    results.push({ test: message, status: 'FAIL', detail: detail || 'Assertion failed' });
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function cleanupFixtures() {
  try {
    await migrationPool.query(
      `DELETE FROM students WHERE id IN ('${STUDENT_1_ID}', '${STUDENT_2_ID}', '${STUDENT_3_ID}', '${STUDENT_4_ID}', '${STUDENT_5_ID}', '${STUDENT_B1_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM user_actors WHERE id IN ('${ACTOR_A_ID}', '${ACTOR_B_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM tenants WHERE id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
  } catch (err) {
    console.warn('Cleanup warning:', (err as Error).message);
  }
}

async function setupFixtures() {
  await cleanupFixtures();

  // 1. Create Active Tenant A & Active Tenant B
  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
    ('${TENANT_A_ID}', 'STD-TENANT-A', 'Student Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'STD-TENANT-B', 'Student Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  // 2. Create Active Actor A in Tenant A, Active Actor B in Tenant B
  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'std_actor_a', 'std_actor_a@test.local', 'Std Actor A', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'std_actor_b', 'std_actor_b@test.local', 'Std Actor B', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW());
  `);

  // 3. Create Student 1 in Tenant A, Student B1 in Tenant B
  await migrationPool.query(`
    INSERT INTO students (id, tenant_id, nisn, nis, nama_lengkap, kelas, jurusan, status, created_at, updated_at) VALUES
    ('${STUDENT_1_ID}', '${TENANT_A_ID}', '0051234561', '21221001', 'Ahmad Dahlan', 'X IPA 1', 'IPA', 'ACTIVE', NOW(), NOW()),
    ('${STUDENT_B1_ID}', '${TENANT_B_ID}', '0059999999', '21229999', 'Siti Rahma', 'X IPS 1', 'IPS', 'ACTIVE', NOW(), NOW());
  `);
}

async function runStudentRepositoryTestSuite() {
  console.log('===========================================================');
  console.log('  BANYUBIRU PHASE 4G-5 POSTGRES STUDENT REPOSITORY TESTS   ');
  console.log('===========================================================\n');

  try {
    console.log('[Setup] Provisioning deterministic test fixtures via migrator...');
    await setupFixtures();
    console.log('[Setup] Fixtures created successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1 — findByIdInContext (Happy Path)
    // ------------------------------------------------------------------------
    console.log('[1] Testing findByIdInContext...');
    const student1 = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, STUDENT_1_ID);
    assert(
      student1 !== null && student1.id === STUDENT_1_ID && student1.fullName === 'Ahmad Dahlan',
      'TEST 1: findByIdInContext returns Student 1 in Tenant A context',
      `Found student: ${student1?.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 2 — findAllInContext (Tenant Isolation)
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing findAllInContext...');
    const tenantAStudents = await repository.findAllInContext(ACTOR_A_ID, TENANT_A_ID);
    const hasStudent1 = tenantAStudents.some((s) => s.id === STUDENT_1_ID);
    const hasStudentB1 = tenantAStudents.some((s) => s.id === STUDENT_B1_ID);
    assert(
      hasStudent1 && !hasStudentB1,
      'TEST 2: findAllInContext returns only Tenant A students',
      `Tenant A student count: ${tenantAStudents.length}, has Student 1: ${hasStudent1}, has Student B1: ${hasStudentB1}`
    );

    // ------------------------------------------------------------------------
    // TEST 3 — saveInContext CREATE
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing saveInContext CREATE...');
    const newStudent2: Student = {
      id: STUDENT_2_ID,
      tenantId: TENANT_A_ID,
      nisn: '0051234562',
      nis: '21221002',
      fullName: 'Budi Santoso',
      className: 'X IPA 1',
      jurusan: 'IPA',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdStudent = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newStudent2);
    assert(
      createdStudent.id === STUDENT_2_ID && createdStudent.fullName === 'Budi Santoso',
      'TEST 3: saveInContext successfully creates new Student 2 in Tenant A',
      `Created student: ${createdStudent.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 4 — saveInContext UPDATE (Allowed fields updated, tenantId immutable)
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing saveInContext UPDATE...');
    const updatePayload: Student = {
      ...createdStudent,
      className: 'X IPA 2',
      fullName: 'Budi Santoso Updated',
    };
    const updatedStudent = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updatePayload);
    assert(
      updatedStudent.id === STUDENT_2_ID &&
        updatedStudent.fullName === 'Budi Santoso Updated' &&
        updatedStudent.className === 'X IPA 2' &&
        updatedStudent.tenantId === TENANT_A_ID,
      'TEST 4: saveInContext successfully updates Student allowed fields while preserving tenantId immutability',
      `Updated student: ${updatedStudent.fullName}, class: ${updatedStudent.className}`
    );

    // ------------------------------------------------------------------------
    // TEST 5 — Application Tenant Invariant Validation
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Application Tenant Invariant Validation...');
    let invariantCaught = false;
    let invariantErrorMessage = '';

    const mismatchedStudent: Student = {
      id: STUDENT_3_ID,
      tenantId: TENANT_B_ID, // Mismatched! Entity says Tenant B, context is Tenant A
      nisn: '0051234563',
      nis: '21221003',
      fullName: 'Mismatched Student',
      className: 'X IPA 1',
      jurusan: 'IPA',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, mismatchedStudent);
    } catch (err) {
      invariantCaught = true;
      invariantErrorMessage = (err as Error).message;
    }

    assert(
      invariantCaught && invariantErrorMessage.includes('SECURITY ERROR'),
      'TEST 5: saveInContext rejects mismatched entity.tenantId before reaching DB',
      `Caught error: ${invariantErrorMessage}`
    );

    // ------------------------------------------------------------------------
    // TEST 6 — saveAllInContext (Batch Creation)
    // ------------------------------------------------------------------------
    console.log('\n[6] Testing saveAllInContext (Batch Creation)...');
    const batchStudents: Student[] = [
      {
        id: STUDENT_3_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051234563',
        nis: '21221003',
        fullName: 'Candra Wijaya',
        className: 'X IPA 1',
        jurusan: 'IPA',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: STUDENT_4_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051234564',
        nis: '21221004',
        fullName: 'Dewi Lestari',
        className: 'X IPA 1',
        jurusan: 'IPA',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const savedBatch = await repository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, batchStudents);
    assert(
      savedBatch.length === 2 && savedBatch[0].id === STUDENT_3_ID && savedBatch[1].id === STUDENT_4_ID,
      'TEST 6: saveAllInContext atomically creates batch students in Tenant A',
      `Saved batch count: ${savedBatch.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 7 — saveAllInContext Atomic Rollback on Constraint Violation
    // ------------------------------------------------------------------------
    console.log('\n[7] Testing saveAllInContext Atomic Rollback...');
    let rollbackCaught = false;
    const rollbackBatch: Student[] = [
      {
        id: STUDENT_5_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051234565',
        nis: '21221005',
        fullName: 'Eka Putri',
        className: 'X IPA 1',
        jurusan: 'IPA',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        // Deliberately duplicate nisn of Student 1 ('0051234561') to cause DB unique constraint failure
        id: 'a6666666-6666-4666-8666-666666666666',
        tenantId: TENANT_A_ID,
        nisn: '0051234561',
        nis: '21221006',
        fullName: 'Fajar Shodiq',
        className: 'X IPA 1',
        jurusan: 'IPA',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    try {
      await repository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, rollbackBatch);
    } catch (err) {
      rollbackCaught = true;
    }

    // Verify Student 5 was NOT saved (rolled back)
    const student5Check = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, STUDENT_5_ID);

    assert(
      rollbackCaught && student5Check === null,
      'TEST 7: saveAllInContext rolls back entire transaction atomically when a constraint error occurs',
      `Rollback caught: ${rollbackCaught}, Student 5 in DB: ${student5Check !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 8 — Cross-Tenant Isolation (READ, UPDATE, DELETE)
    // ------------------------------------------------------------------------
    console.log('\n[8] Testing Cross-Tenant Isolation (READ, UPDATE, DELETE)...');

    // 8A. READ Cross-Tenant
    const student1InB = await repository.findByIdInContext(ACTOR_B_ID, TENANT_B_ID, STUDENT_1_ID);
    assert(
      student1InB === null,
      'TEST 8A: READ cross-tenant — Tenant B actor cannot retrieve Tenant A student',
      `Student 1 visible in Tenant B: ${student1InB !== null}`
    );

    // 8B. UPDATE Cross-Tenant
    let updateCrossTenantCaught = false;
    const illegalUpdatePayload: Student = {
      id: STUDENT_1_ID,
      tenantId: TENANT_A_ID, // Student 1 belongs to Tenant A
      nisn: '0051234561',
      nis: '21221001',
      fullName: 'Ahmad Dahlan HACKED BY B',
      className: 'X IPA 1',
      jurusan: 'IPA',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      // Tenant B actor attempts to update Student 1 in Tenant B context
      await repository.saveInContext(ACTOR_B_ID, TENANT_B_ID, illegalUpdatePayload);
    } catch (err) {
      updateCrossTenantCaught = true;
    }

    // Verify Student 1 in Tenant A was NOT modified
    const student1PostUpdateAttempt = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, STUDENT_1_ID);
    assert(
      updateCrossTenantCaught && student1PostUpdateAttempt?.fullName === 'Ahmad Dahlan',
      'TEST 8B: UPDATE cross-tenant — Tenant B cannot update Tenant A student, DB state remains unchanged',
      `Update rejected: ${updateCrossTenantCaught}, Full name in DB: ${student1PostUpdateAttempt?.fullName}`
    );

    // 8C. DELETE Cross-Tenant
    // Tenant B actor attempts to delete Tenant A's Student 1
    const deleteCrossTenantResult = await repository.deleteInContext(ACTOR_B_ID, TENANT_B_ID, STUDENT_1_ID);
    // Verify Student 1 still exists in Tenant A
    const student1PostDeleteAttempt = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, STUDENT_1_ID);
    assert(
      deleteCrossTenantResult === false && student1PostDeleteAttempt !== null,
      'TEST 8C: DELETE cross-tenant — Tenant B deleteInContext returns false (P2025 under RLS), DB state remains intact',
      `Delete result: ${deleteCrossTenantResult}, Student 1 still in DB: ${student1PostDeleteAttempt !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 9 — Unauthorized Context Lockout
    // ------------------------------------------------------------------------
    console.log('\n[9] Testing Unauthorized Context Lockout...');
    let unauthCaught = false;
    let callbackExecuted = false;

    try {
      // Actor A belongs to Tenant A, so using TENANT_B_ID must fail set_tenant_context()
      await runInTenantContext(ACTOR_A_ID, TENANT_B_ID, async () => {
        callbackExecuted = true;
      });
    } catch (err) {
      unauthCaught = true;
    }

    assert(
      unauthCaught && !callbackExecuted,
      'TEST 9: Unauthorized context (Actor A + Tenant B) fails set_tenant_context() and callback does not execute',
      `Unauth caught: ${unauthCaught}, Callback executed: ${callbackExecuted}`
    );

    // ------------------------------------------------------------------------
    // TEST 10 — deleteInContext (Delete existing vs Non-existing P2025)
    // ------------------------------------------------------------------------
    console.log('\n[10] Testing deleteInContext...');
    const deleteSuccess = await repository.deleteInContext(ACTOR_A_ID, TENANT_A_ID, STUDENT_4_ID);
    const deleteNonExisting = await repository.deleteInContext(
      ACTOR_A_ID,
      TENANT_A_ID,
      '99999999-9999-4999-8999-999999999999'
    );

    assert(
      deleteSuccess === true && deleteNonExisting === false,
      'TEST 10: deleteInContext returns true for deleted record and false for non-existing record (P2025)',
      `Delete existing: ${deleteSuccess}, Delete non-existing: ${deleteNonExisting}`
    );

    // ------------------------------------------------------------------------
    // TEST 11 — Transaction-Bound Methods (*Tx inside custom transaction)
    // ------------------------------------------------------------------------
    console.log('\n[11] Testing Transaction-Bound Methods inside runInTenantContext...');
    const txResult = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const foundInTx = await repository.findByIdTx(tx, STUDENT_1_ID);
      const allInTx = await repository.findAllTx(tx);
      return { foundInTx, count: allInTx.length };
    });

    assert(
      txResult.foundInTx !== null && txResult.foundInTx.id === STUDENT_1_ID,
      'TEST 11: Transaction-bound repository methods (*Tx) execute cleanly using active TenantTransactionClient',
      `Found in tx: ${txResult.foundInTx?.fullName}`
    );
  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    await cleanupFixtures();
    await migrationPool.end();
    console.log('[Teardown] Cleanup complete.');
  }

  console.log('\n===========================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED`);
  console.log('===========================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runStudentRepositoryTestSuite().catch((err) => {
  console.error('Student repository test execution error:', err);
  process.exit(1);
});
