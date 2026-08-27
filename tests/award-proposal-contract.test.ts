import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { employeeAwardValidationEngine, calculateProposalStatus } from '../src/domains/employee/awards/rules';
import { PrismaAwardProposalRepository } from '../src/domains/employee/awards/prisma-repository';
import { AwardProposal, ProposalStatus } from '../src/domains/employee/awards/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runAwardProposalContractTests() {
  console.log('=====================================================');
  console.log('   AWARD PROPOSAL CONTRACT & WORKFLOW TEST SUITE   ');
  console.log('================================================-----\n');

  const testTenantId = '11111111-1111-7111-8111-111111111111';
  const testEmployeeId = '22222222-2222-7222-8222-222222222222';
  const testProposalId = '33333333-3333-7333-8333-333333333333';

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
    id: testProposalId,
    employeeId: testEmployeeId,
    employee: {
      id: testEmployeeId,
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

  // 3. Audit Prisma Repository Contract Instantiation
  console.log('\n[3] Testing Prisma Repository Contract Instantiation...');
  const prismaRepo = new PrismaAwardProposalRepository();
  assert(typeof prismaRepo.findById === 'function', 'PrismaAwardProposalRepository has findById');
  assert(typeof prismaRepo.findByNipAndYear === 'function', 'PrismaAwardProposalRepository has findByNipAndYear');
  assert(typeof prismaRepo.findByStatus === 'function', 'PrismaAwardProposalRepository has findByStatus');
  assert(typeof prismaRepo.save === 'function', 'PrismaAwardProposalRepository has save');
  assert(typeof prismaRepo.delete === 'function', 'PrismaAwardProposalRepository has delete');

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

  // 5. Audit Real PostgreSQL Database Round-Trip Persistence (CASE A, B, C, UPDATE, LEGACY NULL)
  console.log('\n[5] Testing Real Database Round-Trip Persistence (CASE A, B, C, UPDATE, LEGACY NULL)...');
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const pgModule = await import('pg');

  const adminPool = new pgModule.default.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const testEmpAId = '22222222-2222-7222-8222-222222222221';
  const testEmpBId = '22222222-2222-7222-8222-222222222222';
  const testEmpCId = '22222222-2222-7222-8222-222222222223';
  const testEmpLegacyId = '22222222-2222-7222-8222-222222222224';

  // Ensure test tenant and employees exist
  await adminPrisma.tenant.upsert({
    where: { code: 'BKD_DKI_TEST' },
    create: {
      id: testTenantId,
      name: 'BKD DKI Jakarta Test',
      code: 'BKD_DKI_TEST',
      status: 'ACTIVE',
    },
    update: {},
  });

  for (const [id, nip, nrk, name] of [
    [testEmpAId, '198501012010011001', '180001', 'Budi Santoso'],
    [testEmpBId, '198501012010011002', '180002', 'Agus Setiawan'],
    [testEmpCId, '198501012010011003', '180003', 'Dewi Lestari'],
    [testEmpLegacyId, '198501012010011004', '180004', 'Siti Rahayu'],
  ]) {
    await adminPrisma.employee.upsert({
      where: {
        tenantId_id: {
          tenantId: testTenantId,
          id,
        },
      },
      create: {
        id,
        tenantId: testTenantId,
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

  const caseAId = '55555555-5555-7555-8555-555555555555';
  const caseAFixture: AwardProposal = {
    id: caseAId,
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

  const caseBId = '66666666-6666-7666-8666-666666666666';
  const caseBFixture: AwardProposal = {
    ...caseAFixture,
    id: caseBId,
    employeeId: testEmpBId,
    employee: {
      ...caseAFixture.employee,
      id: testEmpBId,
      nip: '198501012010011002',
      nrk: '180002',
      nama: 'Agus Setiawan',
    },
    nilaiUsulan: '30',
    tahunUsulan: 2026,
    masaKerjaTahun: 30,
    masaKerjaBulan: 0,
  };

  const caseCId = '77777777-7777-7777-8777-777777777777';
  const caseCFixture: AwardProposal = {
    ...caseAFixture,
    id: caseCId,
    employeeId: testEmpCId,
    employee: {
      ...caseAFixture.employee,
      id: testEmpCId,
      nip: '198501012010011003',
      nrk: '180003',
      nama: 'Dewi Lestari',
    },
    jenisPenghargaan: 'SATYALANCANA',
    nilaiUsulan: 'X',
    tahunUsulan: 2026,
    masaKerjaTahun: 22,
    masaKerjaBulan: 6,
  };

  const legacyCaseId = '88888888-8888-7888-8888-888888888888';

  try {
    // CASE A: MASA_KERJA + 10 + 22 Thn + 6 Bln
    await prismaRepo.save(testTenantId, caseAFixture);
    const retA = await prismaRepo.findById(testTenantId, caseAId);
    assert(retA !== null, 'CASE A: findById() retrieved saved record from PostgreSQL');
    assert(retA!.nilaiUsulan === '10', 'CASE A: exact nilaiUsulan (10) preserved independently of masaKerjaTahun (22)');
    assert(retA!.masaKerjaTahun === 22, 'CASE A: exact masaKerjaTahun (22) preserved');
    assert(retA!.masaKerjaBulan === 6, 'CASE A: exact masaKerjaBulan (6) preserved');
    assert(retA!.tahunUsulan === 2026, 'CASE A: exact tahunUsulan (2026) preserved');

    // CASE B: MASA_KERJA + 30 + 30 Thn + 0 Bln
    await prismaRepo.save(testTenantId, caseBFixture);
    const retB = await prismaRepo.findById(testTenantId, caseBId);
    assert(retB !== null, 'CASE B: findById() retrieved saved record from PostgreSQL');
    assert(retB!.nilaiUsulan === '30', 'CASE B: exact nilaiUsulan (30) preserved');
    assert(retB!.masaKerjaTahun === 30, 'CASE B: exact masaKerjaTahun (30) preserved');
    assert(retB!.masaKerjaBulan === 0, 'CASE B: exact masaKerjaBulan (0) preserved');

    // CASE C: SATYALANCANA + X + 22 Thn + 6 Bln
    await prismaRepo.save(testTenantId, caseCFixture);
    const retC = await prismaRepo.findById(testTenantId, caseCId);
    assert(retC !== null, 'CASE C: findById() retrieved saved record from PostgreSQL');
    assert(retC!.nilaiUsulan === 'X', 'CASE C: exact nilaiUsulan (X) preserved');
    assert(retC!.jenisPenghargaan === 'SATYALANCANA', 'CASE C: exact jenisPenghargaan (SATYALANCANA) preserved');
    assert(retC!.masaKerjaTahun === 22, 'CASE C: exact masaKerjaTahun (22) preserved');

    // UPDATE CASE: Update CASE A ke 20, 2027, 25 Thn, 3 Bln
    const updatedAFixture: AwardProposal = {
      ...caseAFixture,
      nilaiUsulan: '20',
      tahunUsulan: 2027,
      masaKerjaTahun: 25,
      masaKerjaBulan: 3,
    };
    await prismaRepo.save(testTenantId, updatedAFixture);
    const retUpdatedA = await prismaRepo.findById(testTenantId, caseAId);
    assert(retUpdatedA !== null, 'UPDATE CASE: findById() retrieved updated record from PostgreSQL');
    assert(retUpdatedA!.nilaiUsulan === '20', 'UPDATE CASE: exact updated nilaiUsulan (20) persisted');
    assert(retUpdatedA!.tahunUsulan === 2027, 'UPDATE CASE: exact updated tahunUsulan (2027) persisted');
    assert(retUpdatedA!.masaKerjaTahun === 25, 'UPDATE CASE: exact updated masaKerjaTahun (25) persisted');
    assert(retUpdatedA!.masaKerjaBulan === 3, 'UPDATE CASE: exact updated masaKerjaBulan (3) persisted');

    // LEGACY NULL CASE: Insert baris langsung dengan nilai_usulan = NULL via admin
    await adminPrisma.awardProposal.create({
      data: {
        id: legacyCaseId,
        tenantId: testTenantId,
        employeeId: testEmpLegacyId,
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2024,
        masaKerjaTahun: 15,
        masaKerjaBulan: 0,
        nilaiUsulan: null,
        status: 'NOMINATIF',
      },
    });
    const retLegacy = await prismaRepo.findById(testTenantId, legacyCaseId);
    assert(retLegacy !== null, 'LEGACY CASE: findById() retrieved legacy record from PostgreSQL');
    assert(retLegacy!.nilaiUsulan === undefined, 'LEGACY CASE: legacy NULL is preserved as undefined (NOT silently converted to 10)');
  } finally {
    // Guaranteed Cleanup without silent error swallowing
    const cleanErrs: Error[] = [];
    for (const idToClean of [caseAId, caseBId, caseCId, legacyCaseId]) {
      try {
        await prismaRepo.delete(testTenantId, idToClean);
      } catch (e) {
        cleanErrs.push(e as Error);
      }
    }
    // Clean up test employees & tenant via adminPrisma
    try {
      await adminPrisma.awardProposal.deleteMany({ where: { tenantId: testTenantId } });
      await adminPrisma.employee.deleteMany({ where: { tenantId: testTenantId } });
      await adminPrisma.tenant.deleteMany({ where: { id: testTenantId } });
    } catch (e) {
      cleanErrs.push(e as Error);
    } finally {
      await adminPrisma.$disconnect();
      await adminPool.end();
    }

    if (cleanErrs.length > 0) {
      throw new Error(`DB Cleanup failed for ${cleanErrs.length} records: ${cleanErrs.map((e) => e.message).join(', ')}`);
    }
  }

  console.log('\n=====================================================');
  console.log(' SUCCESS: All AwardProposal Contract tests passed! ');
  console.log('=====================================================\n');
}

runAwardProposalContractTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
