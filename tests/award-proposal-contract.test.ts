import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { employeeAwardValidationEngine, calculateProposalStatus } from '../src/domains/employee/awards/rules';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import { AwardProposal, ProposalStatus } from '../src/domains/employee/awards/types';
import { runInTenantContext } from '../src/platform/db/tenant-context';

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

async function runAwardProposalContractTests() {
  console.log('=====================================================');
  console.log('   AWARD PROPOSAL CONTRACT & WORKFLOW TEST SUITE   ');
  console.log('=====================================================\n');

  // 1. Audit Lifecycle & Workflow Engine Transitions
  console.log('[1] Testing Lifecycle & Workflow State Transitions...');
  let currentStatus: ProposalStatus = 'NOMINATIF';

  const res1 = employeeAwardWorkflowEngine.transition(currentStatus, 'SUBMIT_NOMINATIVE', {}, 'test-actor');
  assert(res1.success && res1.toState === 'BELUM_UPLOAD', 'NOMINATIF -> SUBMIT_NOMINATIVE should yield BELUM_UPLOAD');
  currentStatus = res1.toState!;

  const res2 = employeeAwardWorkflowEngine.transition(currentStatus, 'UPLOAD_DOCUMENT', {}, 'test-actor');
  assert(res2.success && res2.toState === 'SEBAGIAN', 'BELUM_UPLOAD -> UPLOAD_DOCUMENT should yield SEBAGIAN');
  currentStatus = res2.toState!;

  const res3 = employeeAwardWorkflowEngine.transition(currentStatus, 'COMPLETE_DOCUMENTS', {}, 'test-actor');
  assert(res3.success && res3.toState === 'LENGKAP', 'SEBAGIAN -> COMPLETE_DOCUMENTS should yield LENGKAP');
  currentStatus = res3.toState!;

  const res4 = employeeAwardWorkflowEngine.transition(currentStatus, 'VERIFY_DOCUMENTS', {}, 'test-actor');
  assert(res4.success && res4.toState === 'DIVERIFIKASI', 'LENGKAP -> VERIFY_DOCUMENTS should yield DIVERIFIKASI');
  currentStatus = res4.toState!;

  // Test Guard: APPROVE_GENERATION without mandatory documents verified should fail
  const resGuardFail = employeeAwardWorkflowEngine.transition(currentStatus, 'APPROVE_GENERATION', { allMandatoryVerified: false }, 'test-actor');
  assert(!resGuardFail.success, 'APPROVE_GENERATION should fail if mandatory documents are unverified');

  const resGuardPass = employeeAwardWorkflowEngine.transition(currentStatus, 'APPROVE_GENERATION', { allMandatoryVerified: true }, 'test-actor');
  assert(resGuardPass.success && resGuardPass.toState === 'SIAP_GENERATE', 'APPROVE_GENERATION should succeed when all mandatory documents are verified');
  currentStatus = resGuardPass.toState!;

  const res5 = employeeAwardWorkflowEngine.transition(currentStatus, 'MARK_GENERATED', {}, 'test-actor');
  assert(res5.success && res5.toState === 'GENERATED', 'SIAP_GENERATE -> MARK_GENERATED should yield GENERATED');
  currentStatus = res5.toState!;

  // 2. Audit Business Invariants & Rules Engine
  console.log('\n[2] Testing Employee Recipient & Document Invariants...');
  const mockProposal: AwardProposal = {
    id: '33333333-3333-7333-8333-333333333333',
    employeeId: '22222222-2222-7222-8222-222222222222',
    employee: {
      id: '22222222-2222-7222-8222-222222222222',
      nip: '198501012010011001',
      nrk: '180001',
      nama: 'Budi Santoso',
      jabatan: 'Penata Laksana Kepegawaian',
      unitKerja: 'BKD DKI Jakarta',
      perangkatDaerah: 'BKD Provinsi DKI Jakarta',
      ukpd: 'BKD DKI Jakarta',
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

  const validationResults = employeeAwardValidationEngine.validateEntity(mockProposal);
  assert(Array.isArray(validationResults), 'Validation engine should return an array');
  const identityRule = validationResults.find((r) => r.ruleId === 'EMP_IDENTITY_RULE');
  assert(identityRule !== undefined && identityRule.valid, 'Valid employee identity should pass EMP_IDENTITY_RULE');

  const computedEmptyStatus = calculateProposalStatus('MASA_KERJA', [], 'NOMINATIF');
  assert(computedEmptyStatus === 'BELUM_UPLOAD', 'Empty documents must compute proposal status to BELUM_UPLOAD');

  // 3. Audit Postgres Award Proposal Repository Contract Instantiation
  console.log('\n[3] Testing Postgres Award Proposal Repository Contract Instantiation...');
  const proposalRepo = new PostgresAwardProposalRepository();
  assert(typeof proposalRepo.findByIdTx === 'function', 'PostgresAwardProposalRepository has findByIdTx');
  assert(typeof proposalRepo.findByEmployeeAndAwardAndYearTx === 'function', 'PostgresAwardProposalRepository has findByEmployeeAndAwardAndYearTx');
  assert(typeof proposalRepo.findByStatusTx === 'function', 'PostgresAwardProposalRepository has findByStatusTx');
  assert(typeof proposalRepo.findAllTx === 'function', 'PostgresAwardProposalRepository has findAllTx');
  assert(typeof proposalRepo.saveTx === 'function', 'PostgresAwardProposalRepository has saveTx');
  assert(typeof proposalRepo.saveAllTx === 'function', 'PostgresAwardProposalRepository has saveAllTx');
  assert(typeof proposalRepo.deleteTx === 'function', 'PostgresAwardProposalRepository has deleteTx');

  // 4. Audit Excel Importer Field Mapping & Semantics
  console.log('\n[4] Testing Excel Importer Field Mapping & Semantics...');
  const { parseNominatifExcel } = await import('../src/lib/excel-import');
  const XLSX = await import('xlsx');

  const ws = XLSX.utils.json_to_sheet([
    {
      NRK: '180002',
      NAMA: 'Siti Aminah',
      NIP: '199001012015012002',
      JENIS_PENGHARGAAN: 'MASA_KERJA',
      USULAN: '20',
      TAHUN_USULAN: 2026,
      MASA_KERJA_TAHUN: 22,
      MASA_KERJA_BULAN: 5,
    },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nominatif');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  const importRes = parseNominatifExcel(buf);
  assert(importRes.proposals.length === 1, 'Excel importer parses 1 nominatif row');
  assert(importRes.proposals[0].tahunUsulan === 2026, 'Importer explicitly maps TAHUN_USULAN to 2026');
  assert(importRes.proposals[0].masaKerjaTahun === 22, 'Importer explicitly maps MASA_KERJA_TAHUN to 22');
  assert(importRes.proposals[0].masaKerjaBulan === 5, 'Importer explicitly maps MASA_KERJA_BULAN to 5');

  // 5. Audit Real PostgreSQL Database Persistence Suite (12 Contract Scenarios via runInTenantContext)
  console.log('\n[5] Testing Real PostgreSQL Database Persistence Suite (12 Contract Scenarios)...');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_A_ID = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_B_ID = 'b2222222-2222-7222-8222-222222222222';

  const testEmpAId = '22222222-2222-7222-8222-222222222221';
  const testEmpBId = '22222222-2222-7222-8222-222222222222';
  const testEmpCId = '22222222-2222-7222-8222-222222222223';
  const testEmpMultiId = '22222222-2222-7222-8222-222222222224';
  const testEmpLegacyId = '22222222-2222-7222-8222-222222222225';
  const testEmpTenantBId = '22222222-2222-7222-8222-222222222226';

  const caseAId = '55555555-5555-7555-8555-555555555551';
  const caseBId = '55555555-5555-7555-8555-555555555552';
  const caseCId = '55555555-5555-7555-8555-555555555553';
  const multiAward1Id = '55555555-5555-7555-8555-555555555554';
  const multiAward2Id = '55555555-5555-7555-8555-555555555555';
  const legacyCaseId = '55555555-5555-7555-8555-555555555556';
  const deleteTestId = '55555555-5555-7555-8555-555555555557';

  try {
    // Setup Tenants
    await adminPrisma.tenant.upsert({
      where: { code: 'AWARD_TENANT_A' },
      create: { id: TENANT_A_ID, name: 'Award Tenant A', code: 'AWARD_TENANT_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { code: 'AWARD_TENANT_B' },
      create: { id: TENANT_B_ID, name: 'Award Tenant B', code: 'AWARD_TENANT_B', status: 'ACTIVE' },
      update: {},
    });

    // Setup Actors
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'actor_a_award',
        email: 'actor_a@test.local',
        fullName: 'Actor A Award',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_B_ID },
      create: {
        id: ACTOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'actor_b_award',
        email: 'actor_b@test.local',
        fullName: 'Actor B Award',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    // Setup Employees in Tenant A
    for (const [id, nip, nrk, name] of [
      [testEmpAId, '198501012010011001', '180001', 'Budi Santoso'],
      [testEmpBId, '198501012010011002', '180002', 'Agus Setiawan'],
      [testEmpCId, '198501012010011003', '180003', 'Dewi Lestari'],
      [testEmpMultiId, '198501012010011004', '180004', 'Multi Award Employee'],
      [testEmpLegacyId, '198501012010011005', '180005', 'Legacy Employee'],
    ]) {
      await adminPrisma.employee.upsert({
        where: { id },
        create: {
          id,
          tenantId: TENANT_A_ID,
          nip,
          nrk,
          fullName: name,
          jabatan: 'Penata Laksana Kepegawaian',
          unitKerja: 'BKD DKI Jakarta',
          instansi: 'BKD Provinsi DKI Jakarta',
          statusKepegawaian: 'PNS',
        },
        update: {},
      });
    }

    // Setup Employee in Tenant B
    await adminPrisma.employee.upsert({
      where: { id: testEmpTenantBId },
      create: {
        id: testEmpTenantBId,
        tenantId: TENANT_B_ID,
        nip: '198501012010011006',
        nrk: '180006',
        fullName: 'Tenant B Employee',
        jabatan: 'Staf Tenant B',
        unitKerja: 'UKPD Tenant B',
        instansi: 'Instansi Tenant B',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    // 1. Scenario 1: CREATE (saveTx) & Scenario 2: findByIdTx in Tenant A
    const caseAFixture: AwardProposal = {
      id: caseAId,
      tenantId: TENANT_A_ID,
      employeeId: testEmpAId,
      employee: {
        id: testEmpAId,
        nip: '198501012010011001',
        nrk: '180001',
        nama: 'Budi Santoso',
        jabatan: 'Penata Laksana Kepegawaian',
        unitKerja: 'BKD DKI Jakarta',
        perangkatDaerah: 'BKD Provinsi DKI Jakarta',
        ukpd: 'BKD DKI Jakarta',
        wilayah: 'Jakarta Pusat',
      },
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan: '10',
      tahunUsulan: 2026,
      masaKerjaTahun: 22,
      masaKerjaBulan: 6,
      status: 'NOMINATIF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, caseAFixture);
      const retA = await proposalRepo.findByIdTx(tx, caseAId);
      assert(retA !== null, 'Scenario 1 & 2: saveTx and findByIdTx retrieve Case A record');
      assert(retA!.nilaiUsulan === '10', 'Scenario 2: exact nilaiUsulan (10) preserved independently of masaKerjaTahun (22)');
      assert(retA!.masaKerjaTahun === 22, 'Scenario 2: exact masaKerjaTahun (22) preserved');
      assert(retA!.masaKerjaBulan === 6, 'Scenario 2: exact masaKerjaBulan (6) preserved');
      assert(retA!.tahunUsulan === 2026, 'Scenario 2: exact tahunUsulan (2026) preserved');
    });

    // Scenario 3: findAllTx & Scenario 4: findByStatusTx
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const all = await proposalRepo.findAllTx(tx);
      assert(all.length >= 1 && all.some((p) => p.id === caseAId), 'Scenario 3: findAllTx returns Tenant A proposals');

      const byStatus = await proposalRepo.findByStatusTx(tx, 'NOMINATIF');
      assert(byStatus.some((p) => p.id === caseAId), 'Scenario 4: findByStatusTx returns proposals matching NOMINATIF status');
    });

    // Scenario 5: findByEmployeeAndAwardAndYearTx
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const found = await proposalRepo.findByEmployeeAndAwardAndYearTx(
        tx,
        TENANT_A_ID,
        testEmpAId,
        'MASA_KERJA',
        2026
      );
      assert(found !== null && found.id === caseAId, 'Scenario 5: findByEmployeeAndAwardAndYearTx deterministically retrieves exact proposal');
    });

    // Scenario 6: Update without tenant mutation
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const updatedAFixture: AwardProposal = {
        ...caseAFixture,
        nilaiUsulan: '20',
        tahunUsulan: 2027,
        masaKerjaTahun: 25,
        masaKerjaBulan: 3,
      };
      await proposalRepo.saveTx(tx, TENANT_A_ID, updatedAFixture);
      const retUpdated = await proposalRepo.findByIdTx(tx, caseAId);
      assert(retUpdated !== null, 'Scenario 6: findByIdTx retrieved updated record');
      assert(retUpdated!.nilaiUsulan === '20', 'Scenario 6: exact updated nilaiUsulan (20) persisted');
      assert(retUpdated!.tahunUsulan === 2027, 'Scenario 6: exact updated tahunUsulan (2027) persisted');
      assert(retUpdated!.masaKerjaTahun === 25, 'Scenario 6: exact updated masaKerjaTahun (25) persisted');
      assert(retUpdated!.masaKerjaBulan === 3, 'Scenario 6: exact updated masaKerjaBulan (3) persisted');
    });

    // Scenario 7: Tenant consistency violation
    let threwConsistency = false;
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        const invalidTenantProposal: AwardProposal = {
          ...caseAFixture,
          id: '55555555-5555-7555-8555-555555555599',
          tenantId: TENANT_B_ID, // Mismatched tenant
        };
        await proposalRepo.saveTx(tx, TENANT_A_ID, invalidTenantProposal);
      });
    } catch (e: any) {
      threwConsistency = e.message.includes('SECURITY ERROR: Entity tenantId');
    }
    assert(threwConsistency, 'Scenario 7: saveTx throws Security Error on tenantId mismatch');

    // Scenario 8: Cross-tenant isolation (Tenant B cannot read or delete Tenant A proposal)
    await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      const crossRead = await proposalRepo.findByIdTx(tx, caseAId);
      assert(crossRead === null, 'Scenario 8: READ cross-tenant — Tenant B actor cannot retrieve Tenant A proposal');

      const crossDelete = await proposalRepo.deleteTx(tx, caseAId);
      assert(crossDelete === false, 'Scenario 8: DELETE cross-tenant — Tenant B deleteTx returns false (P2025 under RLS)');
    });

    // Scenario 9: Delete existing record & Scenario 10: Delete missing record returns false
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const deleteFixture: AwardProposal = {
        ...caseAFixture,
        id: deleteTestId,
      };
      await proposalRepo.saveTx(tx, TENANT_A_ID, deleteFixture);

      const deletedExisting = await proposalRepo.deleteTx(tx, deleteTestId);
      assert(deletedExisting === true, 'Scenario 9: deleteTx returns true when deleting existing record');

      const deletedMissing = await proposalRepo.deleteTx(tx, '00000000-0000-4000-8000-000000000000');
      assert(deletedMissing === false, 'Scenario 10: deleteTx returns false on non-existent ID (P2025)');
    });

    // Scenario 11: Legacy NULL nilai_usulan maps to undefined
    await adminPrisma.awardProposal.create({
      data: {
        id: legacyCaseId,
        tenantId: TENANT_A_ID,
        employeeId: testEmpLegacyId,
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2024,
        masaKerjaTahun: 15,
        masaKerjaBulan: 0,
        nilaiUsulan: null,
        status: 'NOMINATIF',
      },
    });

    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const legacyRet = await proposalRepo.findByIdTx(tx, legacyCaseId);
      assert(legacyRet !== null, 'Scenario 11: legacy record retrieved from PostgreSQL');
      assert(legacyRet!.nilaiUsulan === undefined, 'Scenario 11: legacy NULL is preserved as undefined (NOT defaulted to 10)');
    });

    // Scenario 12: Multiple award types for same employee/year resolve deterministically
    const multiMkFixture: AwardProposal = {
      ...caseAFixture,
      id: multiAward1Id,
      employeeId: testEmpMultiId,
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan: '20',
      tahunUsulan: 2026,
    };
    const multiSlFixture: AwardProposal = {
      ...caseAFixture,
      id: multiAward2Id,
      employeeId: testEmpMultiId,
      jenisPenghargaan: 'SATYALANCANA',
      nilaiUsulan: 'XX',
      tahunUsulan: 2026,
    };

    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, multiMkFixture);
      await proposalRepo.saveTx(tx, TENANT_A_ID, multiSlFixture);

      const foundMk = await proposalRepo.findByEmployeeAndAwardAndYearTx(
        tx,
        TENANT_A_ID,
        testEmpMultiId,
        'MASA_KERJA',
        2026
      );
      assert(foundMk !== null && foundMk.id === multiAward1Id && foundMk.nilaiUsulan === '20', 'Scenario 12: findByEmployeeAndAwardAndYearTx deterministically retrieves MASA_KERJA proposal');

      const foundSl = await proposalRepo.findByEmployeeAndAwardAndYearTx(
        tx,
        TENANT_A_ID,
        testEmpMultiId,
        'SATYALANCANA',
        2026
      );
      assert(foundSl !== null && foundSl.id === multiAward2Id && foundSl.nilaiUsulan === 'XX', 'Scenario 12: findByEmployeeAndAwardAndYearTx deterministically retrieves SATYALANCANA proposal');
    });

  } finally {
    // Guaranteed Teardown
    try {
      await adminPrisma.awardProposal.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.employee.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.userActor.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.tenant.deleteMany({
        where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr);
    } finally {
      await adminPrisma.$disconnect();
      await adminPool.end();
    }
  }

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('=====================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runAwardProposalContractTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
