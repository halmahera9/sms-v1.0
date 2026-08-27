import 'dotenv/config';
import pg from 'pg';
import { Employee } from '@prisma/client';
import { PostgresEmployeeRepository } from '../src/platform/repositories/employee';
import { runInTenantContext } from '../src/platform/db/tenant-context';

// Connection pool using MIGRATION_DATABASE_URL exclusively for setup & teardown
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const repository = new PostgresEmployeeRepository();

// Dedicated Hex UUID Fixture IDs for Employee Repository Tests
const TENANT_A_ID = '44444444-4444-4444-8444-444444444444';
const TENANT_B_ID = '55555555-5555-4555-8555-555555555555';

const ACTOR_A_ID = 'd4444444-4444-4444-8444-444444444444';
const ACTOR_B_ID = 'e5555555-5555-4555-8555-555555555555';

const EMP_1_ID = 'c1111111-1111-4111-8111-111111111111';
const EMP_2_ID = 'c2222222-2222-4222-8222-222222222222';
const EMP_3_ID = 'c3333333-3333-4333-8333-333333333333';
const EMP_4_ID = 'c4444444-4444-4444-8444-444444444444';
const EMP_5_ID = 'c5555555-5555-4555-8555-555555555555';

const EMP_B1_ID = 'd1111111-1111-4111-8111-111111111111';

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
      `DELETE FROM employees WHERE id IN ('${EMP_1_ID}', '${EMP_2_ID}', '${EMP_3_ID}', '${EMP_4_ID}', '${EMP_5_ID}', '${EMP_B1_ID}');`
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
    ('${TENANT_A_ID}', 'EMP-TENANT-A', 'Employee Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'EMP-TENANT-B', 'Employee Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  // 2. Create Active Actor A in Tenant A, Active Actor B in Tenant B
  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'emp_actor_a', 'emp_actor_a@test.local', 'Emp Actor A', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'emp_actor_b', 'emp_actor_b@test.local', 'Emp Actor B', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW());
  `);

  // 3. Create Employee 1 in Tenant A, Employee B1 in Tenant B
  await migrationPool.query(`
    INSERT INTO employees (id, tenant_id, nip, nrk, nama_lengkap, gelar_depan, gelar_belakang, jabatan, unit_kerja, instansi, status_kepegawaian, created_at, updated_at) VALUES
    ('${EMP_1_ID}', '${TENANT_A_ID}', '198501012010011001', '180001', 'Drs. Bambang Hidayat, M.Pd', 'Drs.', 'M.Pd', 'Guru Utama', 'SMKN 1 Jakarta', 'Dinas Pendidikan', 'PNS', NOW(), NOW()),
    ('${EMP_B1_ID}', '${TENANT_B_ID}', '198702022012022002', '180002', 'Hj. Endang Sri, S.Pd', 'Hj.', 'S.Pd', 'Guru Madya', 'SMKN 2 Jakarta', 'Dinas Pendidikan', 'PNS', NOW(), NOW());
  `);
}

async function runEmployeeRepositoryTestSuite() {
  console.log('===========================================================');
  console.log('  BANYUBIRU PHASE 4G-6 POSTGRES EMPLOYEE REPOSITORY TESTS ');
  console.log('===========================================================\n');

  try {
    console.log('[Setup] Provisioning deterministic test fixtures via migrator...');
    await setupFixtures();
    console.log('[Setup] Fixtures created successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1 — findByIdInContext (Happy Path)
    // ------------------------------------------------------------------------
    console.log('[1] Testing findByIdInContext...');
    const emp1 = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, EMP_1_ID);
    assert(
      emp1 !== null && emp1.id === EMP_1_ID && emp1.fullName === 'Drs. Bambang Hidayat, M.Pd',
      'TEST 1: findByIdInContext returns Employee 1 in Tenant A context',
      `Found employee: ${emp1?.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 2 — findAllInContext (Tenant Isolation)
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing findAllInContext...');
    const tenantAEmployees = await repository.findAllInContext(ACTOR_A_ID, TENANT_A_ID);
    const hasEmp1 = tenantAEmployees.some((e) => e.id === EMP_1_ID);
    const hasEmpB1 = tenantAEmployees.some((e) => e.id === EMP_B1_ID);
    assert(
      hasEmp1 && !hasEmpB1,
      'TEST 2: findAllInContext returns only Tenant A employees',
      `Tenant A employee count: ${tenantAEmployees.length}, has Emp 1: ${hasEmp1}, has Emp B1: ${hasEmpB1}`
    );

    // ------------------------------------------------------------------------
    // TEST 3 — saveInContext CREATE
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing saveInContext CREATE...');
    const newEmp2: Employee = {
      id: EMP_2_ID,
      tenantId: TENANT_A_ID,
      nip: '199003032015031003',
      nrk: '180003',
      fullName: 'Ahmad Subagyo, S.T.',
      gelarDepan: null,
      gelarBelakang: 'S.T.',
      jabatan: 'Guru Muda',
      unitKerja: 'SMKN 1 Jakarta',
      instansi: 'Dinas Pendidikan',
      statusKepegawaian: 'PNS',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const createdEmp = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newEmp2);
    assert(
      createdEmp.id === EMP_2_ID && createdEmp.fullName === 'Ahmad Subagyo, S.T.',
      'TEST 3: saveInContext successfully creates new Employee 2 in Tenant A',
      `Created employee: ${createdEmp.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 4 — saveInContext UPDATE (Allowed fields updated, tenantId immutable)
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing saveInContext UPDATE...');
    const updatePayload: Employee = {
      ...createdEmp,
      jabatan: 'Kepala Bengkel',
      fullName: 'Ahmad Subagyo, S.T., M.T.',
      gelarBelakang: 'S.T., M.T.',
    };
    const updatedEmp = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updatePayload);
    assert(
      updatedEmp.id === EMP_2_ID &&
        updatedEmp.fullName === 'Ahmad Subagyo, S.T., M.T.' &&
        updatedEmp.jabatan === 'Kepala Bengkel' &&
        updatedEmp.tenantId === TENANT_A_ID,
      'TEST 4: saveInContext successfully updates Employee allowed fields while preserving tenantId immutability',
      `Updated employee: ${updatedEmp.fullName}, jabatan: ${updatedEmp.jabatan}`
    );

    // ------------------------------------------------------------------------
    // TEST 5 — Application Tenant Invariant Validation
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Application Tenant Invariant Validation...');
    let invariantCaught = false;
    let invariantErrorMessage = '';

    const mismatchedEmp: Employee = {
      id: EMP_3_ID,
      tenantId: TENANT_B_ID, // Mismatched! Entity says Tenant B, context is Tenant A
      nip: '199204042018041004',
      nrk: '180004',
      fullName: 'Mismatched Employee',
      gelarDepan: null,
      gelarBelakang: null,
      jabatan: 'Staff',
      unitKerja: 'SMKN 1 Jakarta',
      instansi: 'Dinas Pendidikan',
      statusKepegawaian: 'PNS',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, mismatchedEmp);
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
    const batchEmployees: Employee[] = [
      {
        id: EMP_3_ID,
        tenantId: TENANT_A_ID,
        nip: '199204042018041004',
        nrk: '180004',
        fullName: 'Citra Kirana, S.Pd',
        gelarDepan: null,
        gelarBelakang: 'S.Pd',
        jabatan: 'Guru Pertama',
        unitKerja: 'SMKN 1 Jakarta',
        instansi: 'Dinas Pendidikan',
        statusKepegawaian: 'PPPK',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: EMP_4_ID,
        tenantId: TENANT_A_ID,
        nip: '199505052020052005',
        nrk: '180005',
        fullName: 'Deni Kurniawan, S.Kom',
        gelarDepan: null,
        gelarBelakang: 'S.Kom',
        jabatan: 'Pranata Komputer',
        unitKerja: 'SMKN 1 Jakarta',
        instansi: 'Dinas Pendidikan',
        statusKepegawaian: 'PNS',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const savedBatch = await repository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, batchEmployees);
    assert(
      savedBatch.length === 2 && savedBatch[0].id === EMP_3_ID && savedBatch[1].id === EMP_4_ID,
      'TEST 6: saveAllInContext atomically creates batch employees in Tenant A',
      `Saved batch count: ${savedBatch.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 7 — saveAllInContext Atomic Rollback on Constraint Violation
    // ------------------------------------------------------------------------
    console.log('\n[7] Testing saveAllInContext Atomic Rollback...');
    let rollbackCaught = false;
    const rollbackBatch: Employee[] = [
      {
        id: EMP_5_ID,
        tenantId: TENANT_A_ID,
        nip: '199806062022061006',
        nrk: '180006',
        fullName: 'Erlina Kusuma, M.Si',
        gelarDepan: null,
        gelarBelakang: 'M.Si',
        jabatan: 'Laboran',
        unitKerja: 'SMKN 1 Jakarta',
        instansi: 'Dinas Pendidikan',
        statusKepegawaian: 'PNS',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        // Deliberately duplicate NIP of Employee 1 ('198501012010011001') to cause DB unique constraint failure
        id: 'c6666666-6666-4666-8666-666666666666',
        tenantId: TENANT_A_ID,
        nip: '198501012010011001',
        nrk: '180007',
        fullName: 'Fajar Nugraha',
        gelarDepan: null,
        gelarBelakang: null,
        jabatan: 'Teknisi',
        unitKerja: 'SMKN 1 Jakarta',
        instansi: 'Dinas Pendidikan',
        statusKepegawaian: 'PNS',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    try {
      await repository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, rollbackBatch);
    } catch (err) {
      rollbackCaught = true;
    }

    // Verify Employee 5 was NOT saved (rolled back)
    const emp5Check = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, EMP_5_ID);

    assert(
      rollbackCaught && emp5Check === null,
      'TEST 7: saveAllInContext rolls back entire transaction atomically when a constraint error occurs',
      `Rollback caught: ${rollbackCaught}, Emp 5 in DB: ${emp5Check !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 8 — READ Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[8] Testing READ Cross-Tenant Isolation...');
    const emp1InB = await repository.findByIdInContext(ACTOR_B_ID, TENANT_B_ID, EMP_1_ID);
    assert(
      emp1InB === null,
      'TEST 8: READ cross-tenant — Tenant B actor cannot retrieve Tenant A employee',
      `Emp 1 visible in Tenant B: ${emp1InB !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 9 — UPDATE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[9] Testing UPDATE Cross-Tenant Isolation...');
    let updateCrossTenantCaught = false;
    const illegalUpdatePayload: Employee = {
      id: EMP_1_ID,
      tenantId: TENANT_A_ID, // Employee 1 belongs to Tenant A
      nip: '198501012010011001',
      nrk: '180001',
      fullName: 'HACKED BY B',
      gelarDepan: 'Drs.',
      gelarBelakang: 'M.Pd',
      jabatan: 'Hacked Jabatan',
      unitKerja: 'Hacked Unit',
      instansi: 'Hacked Instansi',
      statusKepegawaian: 'PNS',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      // Tenant B actor attempts to update Employee 1 in Tenant B context
      await repository.saveInContext(ACTOR_B_ID, TENANT_B_ID, illegalUpdatePayload);
    } catch (err) {
      updateCrossTenantCaught = true;
    }

    // Verify Employee 1 in Tenant A was NOT modified
    const emp1PostUpdateAttempt = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, EMP_1_ID);
    assert(
      updateCrossTenantCaught && emp1PostUpdateAttempt?.fullName === 'Drs. Bambang Hidayat, M.Pd',
      'TEST 9: UPDATE cross-tenant — Tenant B cannot update Tenant A employee, DB state remains unchanged',
      `Update rejected: ${updateCrossTenantCaught}, Full name in DB: ${emp1PostUpdateAttempt?.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 10 — DELETE Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[10] Testing DELETE Cross-Tenant Isolation...');
    const deleteCrossTenantResult = await repository.deleteInContext(ACTOR_B_ID, TENANT_B_ID, EMP_1_ID);
    const emp1PostDeleteAttempt = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, EMP_1_ID);
    assert(
      deleteCrossTenantResult === false && emp1PostDeleteAttempt !== null,
      'TEST 10: DELETE cross-tenant — Tenant B deleteInContext returns false (P2025 under RLS), DB state remains intact',
      `Delete result: ${deleteCrossTenantResult}, Emp 1 still in DB: ${emp1PostDeleteAttempt !== null}`
    );

    // ------------------------------------------------------------------------
    // TEST 11 — Unauthorized Context Lockout
    // ------------------------------------------------------------------------
    console.log('\n[11] Testing Unauthorized Context Lockout...');
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
      'TEST 11: Unauthorized context (Actor A + Tenant B) fails set_tenant_context() and callback does not execute',
      `Unauth caught: ${unauthCaught}, Callback executed: ${callbackExecuted}`
    );

    // ------------------------------------------------------------------------
    // TEST 12 — deleteInContext (Delete existing vs Non-existing P2025)
    // ------------------------------------------------------------------------
    console.log('\n[12] Testing deleteInContext...');
    const deleteSuccess = await repository.deleteInContext(ACTOR_A_ID, TENANT_A_ID, EMP_4_ID);
    const deleteNonExisting = await repository.deleteInContext(
      ACTOR_A_ID,
      TENANT_A_ID,
      '99999999-9999-4999-8999-999999999999'
    );

    assert(
      deleteSuccess === true && deleteNonExisting === false,
      'TEST 12: deleteInContext returns true for deleted record and false for non-existing record (P2025)',
      `Delete existing: ${deleteSuccess}, Delete non-existing: ${deleteNonExisting}`
    );

    // ------------------------------------------------------------------------
    // TEST 13 — Transaction-Bound Methods (*Tx inside custom transaction)
    // ------------------------------------------------------------------------
    console.log('\n[13] Testing Transaction-Bound Methods inside runInTenantContext...');
    const txResult = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const foundInTx = await repository.findByIdTx(tx, EMP_1_ID);
      const allInTx = await repository.findAllTx(tx);
      return { foundInTx, count: allInTx.length };
    });

    assert(
      txResult.foundInTx !== null && txResult.foundInTx.id === EMP_1_ID,
      'TEST 13: Transaction-bound repository methods (*Tx) execute cleanly using active TenantTransactionClient',
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

runEmployeeRepositoryTestSuite().catch((err) => {
  console.error('Employee repository test execution error:', err);
  process.exit(1);
});
