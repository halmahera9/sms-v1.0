import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PostgresOperationalQueryRepository,
  OperationalMetrics,
  WorkQueueItem,
} from '../src/platform/repositories/operational-query';
import { runInTenantContext } from '../src/platform/db/tenant-context';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function runOperationalQueryRepositoryTests() {
  console.log('=====================================================');
  console.log('    OPERATIONAL QUERY REPOSITORY TEST SUITE          ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-11111111114a';
  const TENANT_B_ID = '99999999-9999-7999-8999-99999999994b';
  const EMPTY_TENANT_ID = '33333333-3333-7333-8333-33333333334e';

  const ACTOR_A_ID = 'a1111111-1111-7111-8111-11111111114a';
  const ACTOR_B_ID = 'b2222222-2222-7222-8222-22222222224b';
  const ACTOR_EMPTY_ID = 'e3333333-3333-7333-8333-33333333334e';

  const opRepo = new PostgresOperationalQueryRepository();

  try {
    // 0. Setup Tenants and Actors
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Op Tenant A', code: 'OP_TENANT_A_4H', status: 'ACTIVE' },
      update: { name: 'Op Tenant A', code: 'OP_TENANT_A_4H' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Op Tenant B', code: 'OP_TENANT_B_4H', status: 'ACTIVE' },
      update: { name: 'Op Tenant B', code: 'OP_TENANT_B_4H' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: EMPTY_TENANT_ID },
      create: { id: EMPTY_TENANT_ID, name: 'Op Empty Tenant', code: 'OP_EMPTY_TENANT_4H', status: 'ACTIVE' },
      update: { name: 'Op Empty Tenant', code: 'OP_EMPTY_TENANT_4H' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'actor_op_a',
        email: 'actor_op_a@test.local',
        fullName: 'Actor Op A',
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
        username: 'actor_op_b',
        email: 'actor_op_b@test.local',
        fullName: 'Actor Op B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_EMPTY_ID },
      create: {
        id: ACTOR_EMPTY_ID,
        tenantId: EMPTY_TENANT_ID,
        username: 'actor_op_empty',
        email: 'actor_op_empty@test.local',
        fullName: 'Actor Op Empty',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    // Cleanup mutable domain test entities for fresh deterministic run
    await adminPrisma.extractedItem.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.oCRExtraction.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.exceptionItem.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.workflowTransition.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.workflowInstance.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.awardProposalDocument.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.awardProposal.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.documentVersion.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.document.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.student.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });
    await adminPrisma.employee.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID, EMPTY_TENANT_ID] } } });

    // 1. Provision Tenant A Fixtures
    // Employees: 2 ACTIVE, 1 INACTIVE
    const emp1Id = crypto.randomUUID();
    const emp2Id = crypto.randomUUID();
    const emp3Id = crypto.randomUUID();
    await adminPrisma.employee.createMany({
      data: [
        { id: emp1Id, tenantId: TENANT_A_ID, nip: '198001012005011001', nrk: '100001', fullName: 'Budi Santoso', jabatan: 'Guru', unitKerja: 'Dinas Pendidikan', instansi: 'Pemprov DKI', statusKepegawaian: 'PNS' },
        { id: emp2Id, tenantId: TENANT_A_ID, nip: '198202022006022002', nrk: '100002', fullName: 'Siti Aminah', jabatan: 'Staf TU', unitKerja: 'Sudin JT 1', instansi: 'Pemprov DKI', statusKepegawaian: 'PNS' },
        { id: emp3Id, tenantId: TENANT_A_ID, nip: '198503032007031003', nrk: '100003', fullName: 'Pensiun User', jabatan: 'Pustakawan', unitKerja: 'Dinas Pendidikan', instansi: 'Pemprov DKI', statusKepegawaian: 'NON_ASN' },
      ],
    });

    // Students: 3 ACTIVE, 1 INACTIVE
    const std1Id = crypto.randomUUID();
    const std2Id = crypto.randomUUID();
    const std3Id = crypto.randomUUID();
    const std4Id = crypto.randomUUID();
    await adminPrisma.student.createMany({
      data: [
        { id: std1Id, tenantId: TENANT_A_ID, nisn: '0012345671', nis: '101', fullName: 'Ahmad Siswa', className: 'XII-A', status: 'ACTIVE' },
        { id: std2Id, tenantId: TENANT_A_ID, nisn: '0012345672', nis: '102', fullName: 'Bambang Siswa', className: 'XII-B', status: 'ACTIVE' },
        { id: std3Id, tenantId: TENANT_A_ID, nisn: '0012345673', nis: '103', fullName: 'Citra Siswa', className: 'XI-A', status: 'ACTIVE' },
        { id: std4Id, tenantId: TENANT_A_ID, nisn: '0012345674', nis: '104', fullName: 'Deni Lulus', className: 'ALUMNI', status: 'GRADUATED' },
      ],
    });

    // Documents: 3 documents
    const doc1Id = crypto.randomUUID();
    const doc2Id = crypto.randomUUID();
    const doc3Id = crypto.randomUUID();
    await adminPrisma.document.createMany({
      data: [
        { id: doc1Id, tenantId: TENANT_A_ID, title: 'Presensi Siswa Kelas XII-A', category: 'SURAT_PENGANTAR', currentVersion: 1, status: 'DRAFT' },
        { id: doc2Id, tenantId: TENANT_A_ID, title: 'SK CPNS Budi Santoso', category: 'SK_CPNS', currentVersion: 1, status: 'DRAFT' },
        { id: doc3Id, tenantId: TENANT_A_ID, title: 'SK CPNS Siti Aminah', category: 'SK_CPNS', currentVersion: 1, status: 'DRAFT' },
      ],
    });

    // Award Proposals:
    // Prop 1: SIAP_GENERATE (Approval needed)
    // Prop 2: LENGKAP (Verification needed)
    // Prop 3: SEBAGIAN (Verification needed)
    const prop1Id = crypto.randomUUID();
    const prop2Id = crypto.randomUUID();
    const prop3Id = crypto.randomUUID();
    await adminPrisma.awardProposal.createMany({
      data: [
        {
          id: prop1Id,
          tenantId: TENANT_A_ID,
          employeeId: emp1Id,
          jenisPenghargaan: 'SATYALANCANA_XX',
          tahunUsulan: 2026,
          status: 'SIAP_GENERATE',
          nilaiUsulan: '20',
          masaKerjaTahun: 22,
          masaKerjaBulan: 5,
        },
        {
          id: prop2Id,
          tenantId: TENANT_A_ID,
          employeeId: emp2Id,
          jenisPenghargaan: 'SATYALANCANA_X',
          tahunUsulan: 2026,
          status: 'LENGKAP',
          nilaiUsulan: '10',
          masaKerjaTahun: 12,
          masaKerjaBulan: 3,
        },
        {
          id: prop3Id,
          tenantId: TENANT_A_ID,
          employeeId: emp1Id,
          jenisPenghargaan: 'MASA_KERJA',
          tahunUsulan: 2026,
          status: 'SEBAGIAN',
          nilaiUsulan: '10',
          masaKerjaTahun: 10,
          masaKerjaBulan: 0,
        },
      ],
    });

    // OCR Extractions:
    // OCR 1: COMPLETED with 1 unverified ExtractedItem (confidence 65.5 -> CRITICAL severity)
    // OCR 2: COMPLETED
    const ocr1Id = crypto.randomUUID();
    const ocr2Id = crypto.randomUUID();
    await adminPrisma.oCRExtraction.createMany({
      data: [
        { id: ocr1Id, tenantId: TENANT_A_ID, documentId: doc1Id, status: 'COMPLETED' },
        { id: ocr2Id, tenantId: TENANT_A_ID, documentId: doc1Id, status: 'COMPLETED' },
      ],
    });
    const extItem1Id = crypto.randomUUID();
    await adminPrisma.extractedItem.create({
      data: {
        id: extItem1Id,
        tenantId: TENANT_A_ID,
        ocrExtractionId: ocr1Id,
        studentNameRaw: 'Ahmad Siswa',
        confidenceScore: '65.50',
        matchedStudentId: std1Id,
      },
    });

    // Workflow Instances & Exceptions:
    const wf1Id = crypto.randomUUID();
    const wf2Id = crypto.randomUUID();
    await adminPrisma.workflowInstance.createMany({
      data: [
        { id: wf1Id, tenantId: TENANT_A_ID, entityType: 'AwardProposal', entityId: prop1Id, currentState: 'NEEDS_VERIFICATION' },
        { id: wf2Id, tenantId: TENANT_A_ID, entityType: 'StudentAbsence', entityId: std1Id, currentState: 'NEEDS_VERIFICATION' },
      ],
    });

    // Exceptions:
    // Exc 1: OPEN, ERROR (requiresCorrection + 1)
    // Exc 2: IN_REVIEW, WARNING
    // Exc 3: RESOLVED, ERROR (should NOT be counted in open exceptions)
    const exc1Id = crypto.randomUUID();
    const exc2Id = crypto.randomUUID();
    const exc3Id = crypto.randomUUID();
    await adminPool.query(`
      INSERT INTO exception_items (id, tenant_id, workflow_instance_id, rule_code, severity, status, resolution_notes, created_at, updated_at) VALUES
      ('${exc1Id}', '${TENANT_A_ID}', '${wf1Id}', 'AWARD_DOC_MISMATCH', 'CRITICAL', 'OPEN', 'NIP pada SK CPNS tidak cocok', NOW(), NOW()),
      ('${exc2Id}', '${TENANT_A_ID}', '${wf2Id}', 'STUDENT_OCR_LOW_CONFIDENCE', 'HIGH', 'IN_REVIEW', 'Tulisan tanggal surat kabur', NOW(), NOW()),
      ('${exc3Id}', '${TENANT_A_ID}', '${wf1Id}', 'PREVIOUS_RESOLVED_RULE', 'CRITICAL', 'RESOLVED', 'Sudah diperbaiki kemarin', NOW(), NOW());
    `);

    // ==========================================
    // 1. TEST METRICS AGGREGATION ON TENANT A
    // ==========================================
    console.log('[1] Testing Operational Metrics with Known Fixture Data...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const metrics: OperationalMetrics = await opRepo.getAggregatedMetricsTx(tx, TENANT_A_ID);

      // 1. totalOpenExceptions = 2 (Exc 1: OPEN, Exc 2: IN_REVIEW)
      assert(metrics.totalOpenExceptions === 2, 'Test 1: totalOpenExceptions correctly counts OPEN and IN_REVIEW only (2)');

      // 2. exceptionsBySeverity
      assert(metrics.exceptionsBySeverity.error === 1, 'Test 2: exceptionsBySeverity.error matches OPEN error count (1)');
      assert(metrics.exceptionsBySeverity.warning === 1, 'Test 3: exceptionsBySeverity.warning matches IN_REVIEW warning count (1)');
      assert(metrics.exceptionsBySeverity.info === 0, 'Test 4: exceptionsBySeverity.info is 0');

      // 3. requiresCorrection
      assert(metrics.requiresCorrection === 1, 'Test 5: requiresCorrection matches error count (1)');

      // 4. pendingApprovals = 1 (Prop 1: SIAP_GENERATE)
      assert(metrics.pendingApprovals === 1, 'Test 6: pendingApprovals counts SIAP_GENERATE proposals (1)');

      // 5. pendingVerifications = 3 (Prop 2: LENGKAP + Prop 3: SEBAGIAN + OCR 1: NEEDS_VERIFICATION)
      assert(metrics.pendingVerifications === 3, 'Test 7: pendingVerifications combines proposals (2) and OCR extractions (1) (total 3)');

      // 6. totalEmployees = 3 (from employees table in Tenant A)
      assert(metrics.totalEmployees === 3, 'Test 8: totalEmployees directly queries employees table (3), not proposals');

      // 7. totalStudents = 3 (from active students table, excluding GRADUATED student 4)
      assert(metrics.totalStudents === 3, 'Test 9: totalStudents counts ACTIVE students only (3)');

      // 8. totalDocumentsProcessed = 3
      assert(metrics.totalDocumentsProcessed === 3, 'Test 10: totalDocumentsProcessed counts documents in tenant (3)');
    });

    // ==========================================
    // 2. TEST ZERO-SAFE METRICS ON EMPTY TENANT
    // ==========================================
    console.log('\n[2] Testing Zero-Safe Metrics on Empty Tenant...');
    await runInTenantContext(ACTOR_EMPTY_ID, EMPTY_TENANT_ID, async (tx) => {
      const metrics: OperationalMetrics = await opRepo.getAggregatedMetricsTx(tx, EMPTY_TENANT_ID);
      assert(metrics.totalOpenExceptions === 0, 'Test 11: Empty tenant totalOpenExceptions is 0');
      assert(metrics.pendingVerifications === 0, 'Test 12: Empty tenant pendingVerifications is 0');
      assert(metrics.pendingApprovals === 0, 'Test 13: Empty tenant pendingApprovals is 0');
      assert(metrics.totalEmployees === 0, 'Test 14: Empty tenant totalEmployees is 0');
      assert(metrics.totalStudents === 0, 'Test 15: Empty tenant totalStudents is 0');
      assert(metrics.totalDocumentsProcessed === 0, 'Test 16: Empty tenant totalDocumentsProcessed is 0');
    });

    // ==========================================
    // 3. TEST UNIFIED WORK QUEUE PROJECTIONS
    // ==========================================
    console.log('\n[3] Testing Unified Work Queue Projections...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const workQueue: WorkQueueItem[] = await opRepo.getUnifiedWorkQueueItemsTx(tx, TENANT_A_ID, 20);

      // Expected total work queue items in Tenant A:
      // - 3 Award Proposals (1 SIAP_GENERATE, 1 LENGKAP, 1 SEBAGIAN)
      // - 1 OCR Extracted Item (confidence 65.5%)
      // - 2 Open Exceptions (1 ERROR, 1 WARNING)
      // Total = 6 work items
      assert(workQueue.length === 6, `Test 17: Unified work queue projects exactly 6 items (received ${workQueue.length})`);

      // Verify Award Proposal Projections
      const siapGenerate = workQueue.find((w) => w.entityId === prop1Id);
      assert(
        Boolean(siapGenerate && siapGenerate.severity === 'HIGH' && siapGenerate.actionRequired === 'Persetujuan Siap Cetak PDF'),
        'Test 18: SIAP_GENERATE proposal projected with severity HIGH and action Persetujuan Siap Cetak PDF'
      );
      assert(
        Boolean(siapGenerate && siapGenerate.title === 'Budi Santoso' && siapGenerate.subtitle.includes('SATYALANCANA')),
        'Test 19: Proposal item contains joined employee name and subtitle details'
      );

      const lengkap = workQueue.find((w) => w.entityId === prop2Id);
      assert(
        Boolean(lengkap && lengkap.severity === 'MEDIUM' && lengkap.actionRequired === 'Verifikasi Kelengkapan Dokumen'),
        'Test 20: LENGKAP proposal projected with severity MEDIUM and action Verifikasi Kelengkapan Dokumen'
      );

      // Verify OCR Projection
      const ocrItem = workQueue.find((w) => w.domain === 'STUDENT' && w.id.startsWith('wq-std-'));
      assert(
        Boolean(ocrItem && ocrItem.severity === 'CRITICAL'),
        'Test 21: OCR item with confidence < 70% is projected with CRITICAL severity'
      );
      assert(
        Boolean(ocrItem && ocrItem.actionRequired === 'Verifikasi Manual Ekstraksi Ketidakhadiran'),
        'Test 22: OCR item contains action Verifikasi Manual Ekstraksi Ketidakhadiran'
      );

      // Verify Exception Projections
      const excError = workQueue.find((w) => w.entityId === exc1Id);
      assert(
        Boolean(excError && excError.severity === 'CRITICAL' && excError.title.includes('AWARD_DOC_MISMATCH')),
        'Test 23: ERROR exception projected with severity CRITICAL'
      );

      const excWarning = workQueue.find((w) => w.entityId === exc2Id);
      assert(
        Boolean(excWarning && excWarning.severity === 'HIGH' && excWarning.title.includes('STUDENT_OCR_LOW_CONFIDENCE')),
        'Test 24: WARNING exception projected with severity HIGH'
      );

      // Verify Resolved exception was NOT included in work queue
      const resolvedExc = workQueue.find((w) => w.entityId === exc3Id);
      assert(resolvedExc === undefined, 'Test 25: RESOLVED exception is strictly excluded from work queue');
    });

    // ==========================================
    // 4. TEST ORDERING AND LIMIT BEHAVIOR
    // ==========================================
    console.log('\n[4] Testing Ordering and Limit Behavior...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      // Test LIMIT = 3
      const limited = await opRepo.getUnifiedWorkQueueItemsTx(tx, TENANT_A_ID, 3);
      assert(limited.length === 3, 'Test 26: Limit parameter strictly constrains result count to 3');

      // Test Deterministic Ordering (createdAt DESC)
      const fullList = await opRepo.getUnifiedWorkQueueItemsTx(tx, TENANT_A_ID, 20);
      let isOrdered = true;
      for (let i = 0; i < fullList.length - 1; i++) {
        const timeA = new Date(fullList[i].createdAt).getTime();
        const timeB = new Date(fullList[i + 1].createdAt).getTime();
        if (timeA < timeB) {
          isOrdered = false;
          break;
        }
      }
      assert(isOrdered, 'Test 27: Unified work queue items are deterministically sorted by createdAt DESC');
    });

    // ==========================================
    // 5. TEST TENANT ISOLATION & RLS ENFORCEMENT
    // ==========================================
    console.log('\n[5] Testing Cross-Tenant Data Isolation (RLS Enforcement)...');
    await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      const tenantBMetrics = await opRepo.getAggregatedMetricsTx(tx, TENANT_B_ID);
      assert(tenantBMetrics.totalOpenExceptions === 0, 'Test 28: Tenant B cannot see Tenant A exceptions (0 records)');
      assert(tenantBMetrics.totalEmployees === 0, 'Test 29: Tenant B cannot see Tenant A employees (0 records)');
      assert(tenantBMetrics.pendingVerifications === 0, 'Test 30: Tenant B cannot see Tenant A pending verifications (0 records)');

      const tenantBWorkQueue = await opRepo.getUnifiedWorkQueueItemsTx(tx, TENANT_B_ID, 20);
      assert(tenantBWorkQueue.length === 0, 'Test 31: Tenant B work queue returns 0 items under RLS');
    });

    // ==========================================
    // 6. TEST CONTEXT-BOUND CONVENIENCE METHODS
    // ==========================================
    console.log('\n[6] Testing Context-Bound Convenience Methods...');
    const ctxMetrics = await opRepo.getAggregatedMetricsInContext(ACTOR_A_ID, TENANT_A_ID);
    assert(ctxMetrics.totalEmployees === 3, 'Test 32: getAggregatedMetricsInContext runs seamlessly');

    const ctxWorkQueue = await opRepo.getUnifiedWorkQueueItemsInContext(ACTOR_A_ID, TENANT_A_ID, 5);
    assert(ctxWorkQueue.length === 5, 'Test 33: getUnifiedWorkQueueItemsInContext runs seamlessly with limit');

  } finally {
    try {
      // Disconnect cleanly
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

runOperationalQueryRepositoryTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
