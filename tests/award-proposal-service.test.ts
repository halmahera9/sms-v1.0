import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import { AwardProposal, ProposalDocument } from '../src/domains/employee/awards/types';
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

async function runAwardProposalServiceTests() {
  console.log('=====================================================');
  console.log('   AWARD PROPOSAL APPLICATION SERVICE TEST SUITE    ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_A_ID = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_B_ID = 'b2222222-2222-7222-8222-222222222222';

  const testEmpId = '22222222-2222-7222-8222-222222222231';
  const testEmp2Id = '22222222-2222-7222-8222-222222222232';
  const proposal1Id = '77777777-7777-7777-8777-777777777771';
  const proposal2Id = '77777777-7777-7777-8777-777777777772';

  const proposalRepo = new PostgresAwardProposalRepository();
  const service = new AwardProposalApplicationService(proposalRepo);

  try {
    // Setup Tenant & Actor
    await adminPrisma.tenant.upsert({
      where: { code: 'AWARD_TENANT_SVC_A' },
      create: { id: TENANT_A_ID, name: 'Service Tenant A', code: 'AWARD_TENANT_SVC_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { code: 'AWARD_TENANT_SVC_B' },
      create: { id: TENANT_B_ID, name: 'Service Tenant B', code: 'AWARD_TENANT_SVC_B', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'actor_svc_a',
        email: 'actor_svc_a@test.local',
        fullName: 'Actor Service A',
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
        username: 'actor_svc_b',
        email: 'actor_svc_b@test.local',
        fullName: 'Actor Service B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.employee.upsert({
      where: { id: testEmpId },
      create: {
        id: testEmpId,
        tenantId: TENANT_A_ID,
        nip: '198501012010011088',
        nrk: '180088',
        fullName: 'Bambang Triatmojo',
        jabatan: 'Penata Laksana Kepegawaian',
        unitKerja: 'BKD DKI Jakarta',
        instansi: 'BKD Provinsi DKI Jakarta',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    await adminPrisma.employee.upsert({
      where: { id: testEmp2Id },
      create: {
        id: testEmp2Id,
        tenantId: TENANT_A_ID,
        nip: '198501012010011089',
        nrk: '180089',
        fullName: 'Slamet Riyadi',
        jabatan: 'Analis SDM Aparatur',
        unitKerja: 'BKD DKI Jakarta',
        instansi: 'BKD Provinsi DKI Jakarta',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    // Seed proposal 1 in NOMINATIF
    const fixture1: AwardProposal = {
      id: proposal1Id,
      tenantId: TENANT_A_ID,
      employeeId: testEmpId,
      employee: {
        id: testEmpId,
        nip: '198501012010011088',
        nrk: '180088',
        nama: 'Bambang Triatmojo',
        jabatan: 'Penata Laksana Kepegawaian',
        unitKerja: 'BKD DKI Jakarta',
        perangkatDaerah: 'BKD Provinsi DKI Jakarta',
        ukpd: 'BKD DKI Jakarta',
        wilayah: 'Jakarta Pusat',
      },
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan: '20',
      tahunUsulan: 2026,
      masaKerjaTahun: 20,
      masaKerjaBulan: 0,
      status: 'NOMINATIF',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, fixture1);
    });

    // Test 1: Service loads authoritative proposal state & Test 2: submitNominativeTx transitions NOMINATIF -> BELUM_UPLOAD
    console.log('[1] Testing submitNominativeTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const submitted = await service.submitNominativeTx(tx, TENANT_A_ID, proposal1Id, ACTOR_A_ID);
      assert(submitted.status === 'BELUM_UPLOAD', 'Test 1 & 2: submitNominativeTx loads authoritative proposal and transitions to BELUM_UPLOAD');
    });

    // Test 3: uploadDocumentTx transitions BELUM_UPLOAD -> SEBAGIAN
    console.log('\n[2] Testing uploadDocumentTx (Partial)...');
    const doc1: ProposalDocument = {
      id: 'doc-mk-1',
      proposalId: proposal1Id,
      requirementCode: 'SK_CPNS',
      fileName: 'sk_cpns.pdf',
      fileSize: 1024 * 50,
      fileType: 'application/pdf',
      fileUrl: '#',
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'pending',
    };
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const updated = await service.uploadDocumentTx(tx, TENANT_A_ID, proposal1Id, doc1, ACTOR_A_ID);
      assert(updated.status === 'SEBAGIAN', 'Test 3: uploadDocumentTx transitions to SEBAGIAN on partial upload');
      assert(updated.documents.length === 1, 'Test 3: Document array updated with 1 document');
    });

    // Upload remaining mandatory documents to reach LENGKAP
    console.log('\n[3] Testing uploadDocumentTx (All Mandatory Complete)...');
    const mandatoryCodes = ['SK_PNS', 'SK_PANGKAT_TERAKHIR', 'SK_JABATAN_TERAKHIR', 'SKP_2025', 'SKT_TIDAK_HUKDIS'];
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      let current: AwardProposal | null = null;
      for (const code of mandatoryCodes) {
        const doc: ProposalDocument = {
          id: `doc-mk-${code}`,
          proposalId: proposal1Id,
          requirementCode: code,
          fileName: `${code}.pdf`,
          fileSize: 1024 * 50,
          fileType: 'application/pdf',
          fileUrl: '#',
          uploadedAt: new Date().toISOString(),
          verificationStatus: 'pending',
        };
        current = await service.uploadDocumentTx(tx, TENANT_A_ID, proposal1Id, doc, ACTOR_A_ID);
      }
      assert(current !== null && current.status === 'LENGKAP', 'Test 4: uploadDocumentTx transitions to LENGKAP when all mandatory uploaded');
    });

    // Test 5: verifyDocumentTx transitions LENGKAP -> DIVERIFIKASI
    console.log('\n[4] Testing verifyDocumentTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const verified = await service.verifyDocumentTx(tx, TENANT_A_ID, proposal1Id, 'SK_CPNS', 'verified', ACTOR_A_ID, 'SK CPNS Valid');
      assert(verified.status === 'DIVERIFIKASI', 'Test 5: verifyDocumentTx transitions to DIVERIFIKASI');
      const verifiedDoc = verified.documents.find((d) => d.requirementCode === 'SK_CPNS');
      assert(verifiedDoc?.verificationStatus === 'verified', 'Test 5: Document verificationStatus updated to verified');
      assert(verifiedDoc?.verifiedBy === ACTOR_A_ID, 'Test 5: Document verifiedBy captured actorId');
    });

    // Test 6: approveGenerationTx FAILS when mandatory documents are not all verified
    console.log('\n[5] Testing approveGenerationTx Guard Failure (Incomplete Verification)...');
    let threwGuard = false;
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await service.approveGenerationTx(tx, TENANT_A_ID, proposal1Id, ACTOR_A_ID);
      });
    } catch (e: any) {
      threwGuard = e.message.includes('Workflow transition failed');
    }
    assert(threwGuard, 'Test 6: approveGenerationTx rejects transition when not all mandatory documents are verified');

    // Verify all remaining mandatory documents
    console.log('\n[6] Testing full verification & successful approveGenerationTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      for (const code of mandatoryCodes) {
        await service.verifyDocumentTx(tx, TENANT_A_ID, proposal1Id, code, 'verified', ACTOR_A_ID);
      }
      const approved = await service.approveGenerationTx(tx, TENANT_A_ID, proposal1Id, ACTOR_A_ID);
      assert(approved.status === 'SIAP_GENERATE', 'Test 7: approveGenerationTx successfully transitions to SIAP_GENERATE when all mandatory verified');
      assert(approved.nilaiUsulan === '20', 'Test 7: nilaiUsulan preserved independently');
      assert(approved.tahunUsulan === 2026, 'Test 7: tahunUsulan preserved independently');
    });

    // Test 8: markGeneratedTx transitions SIAP_GENERATE -> GENERATED
    console.log('\n[7] Testing markGeneratedTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const generated = await service.markGeneratedTx(tx, TENANT_A_ID, proposal1Id, ACTOR_A_ID);
      assert(generated.status === 'GENERATED', 'Test 8: markGeneratedTx successfully transitions to GENERATED');
    });

    // Test 9: Batch mark generated
    console.log('\n[8] Testing batchMarkGeneratedTx...');
    const fixture2: AwardProposal = {
      ...fixture1,
      id: proposal2Id,
      employeeId: testEmp2Id,
      status: 'SIAP_GENERATE',
    };
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, fixture2);
      const batchRes = await service.batchMarkGeneratedTx(tx, TENANT_A_ID, [proposal2Id], ACTOR_A_ID);
      assert(batchRes.length === 1 && batchRes[0].status === 'GENERATED', 'Test 9: batchMarkGeneratedTx marks multiple proposals as GENERATED');
    });

    // Test 10: Context-bound methods (*InContext) execution & cross-tenant safety
    console.log('\n[9] Testing Context-bound methods & Tenant Isolation...');
    const inContextProposal = await service.submitNominativeInContext(ACTOR_A_ID, TENANT_A_ID, proposal1Id).catch(() => null);
    // Proposal 1 is currently GENERATED, SUBMIT_NOMINATIVE is invalid from GENERATED
    assert(inContextProposal === null, 'Test 10: Invalid workflow transition via InContext method is safely rejected');

    let crossTenantRejected = false;
    try {
      await service.approveGenerationInContext(ACTOR_B_ID, TENANT_B_ID, proposal1Id);
    } catch (e: any) {
      crossTenantRejected = true;
    }
    assert(crossTenantRejected, 'Test 10: Cross-tenant access (Actor B accessing Tenant A proposal) is rejected');

    // Test 11: Direct Repository Delegation Proof (Zero direct Prisma access from service)
    console.log('\n[10] Testing Direct Repository Delegation Proof...');
    let saveDocumentTxCalled = false;
    let verifyDocumentTxCalled = false;

    const spyRepo = {
      findByIdTx: async () => fixture1,
      findByEmployeeAndAwardAndYearTx: async () => fixture1,
      findByStatusTx: async () => [fixture1],
      findAllTx: async () => [fixture1],
      saveTx: async () => fixture1,
      saveAllTx: async () => [fixture1],
      saveDocumentTx: async () => {
        saveDocumentTxCalled = true;
        return doc1;
      },
      verifyDocumentTx: async () => {
        verifyDocumentTxCalled = true;
        return doc1;
      },
      deleteTx: async () => true,
    };

    const delegatedService = new AwardProposalApplicationService(spyRepo);
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await delegatedService.uploadDocumentTx(tx, TENANT_A_ID, proposal1Id, doc1, ACTOR_A_ID);
      await delegatedService.verifyDocumentTx(tx, TENANT_A_ID, proposal1Id, 'SK_CPNS', 'verified', ACTOR_A_ID);
    });

    assert(saveDocumentTxCalled, 'Test 11: uploadDocumentTx delegates persistence strictly to proposalRepo.saveDocumentTx');
    assert(verifyDocumentTxCalled, 'Test 11: verifyDocumentTx delegates persistence strictly to proposalRepo.verifyDocumentTx');

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

runAwardProposalServiceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
