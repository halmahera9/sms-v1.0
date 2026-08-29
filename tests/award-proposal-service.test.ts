import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import { AwardProposal, ProposalDocument, ImportAwardProposalItemDTO } from '../src/domains/employee/awards/types';
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
    // Initial cleanup of mutable test entities
    await adminPrisma.awardProposal.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.employee.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    // Setup Tenant & Actor
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Service Tenant A', code: 'AWARD_TENANT_SVC_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
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
    console.log('\n[10] Testing Direct Repository Delegation Proof & getAllInContext...');
    let saveDocumentTxCalled = false;
    let verifyDocumentTxCalled = false;
    let findAllTxCalled = false;

    const spyRepo = {
      findByIdTx: async () => fixture1,
      findByEmployeeAndAwardAndYearTx: async () => fixture1,
      findByStatusTx: async () => [fixture1],
      findAllTx: async () => {
        findAllTxCalled = true;
        return [fixture1];
      },
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

    const readResults = await delegatedService.getAllInContext(ACTOR_A_ID, TENANT_A_ID);

    assert(saveDocumentTxCalled, 'Test 11: uploadDocumentTx delegates persistence strictly to proposalRepo.saveDocumentTx');
    assert(verifyDocumentTxCalled, 'Test 11: verifyDocumentTx delegates persistence strictly to proposalRepo.verifyDocumentTx');
    assert(findAllTxCalled && readResults.length === 1, 'Test 12: getAllInContext delegates strictly to proposalRepo.findAllTx');

    // ========================================================
    // [11] Testing Phase 4H-2J.5.1C Excel Import Application Service
    // ========================================================
    console.log('\n[11] Testing Award Excel Import Application Service...');

    // Test 13 & 14: Successful batch import & Fresh Employee + Fresh Proposal creation with initial status NOMINATIF
    const importBatch1: ImportAwardProposalItemDTO[] = [
      {
        nip: '198501012010011001',
        nrk: '123401',
        nama: 'Ahmad Pegawai Import 1',
        gelar: 'S.Kom',
        jabatan: 'Analis Sistem Informasi',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        ukpd: 'Bidang Sistem Informasi',
        wilayah: 'Jakarta Pusat',
        jenisPenghargaan: 'MASA_KERJA',
        nilaiUsulan: '10',
        tahunUsulan: 2026,
        masaKerjaTahun: 10,
        masaKerjaBulan: 2,
        catatan: 'Usulan 10 tahun MASA_KERJA',
      },
      {
        nip: '198802022012012002',
        nrk: '123402',
        nama: 'Budi Pegawai Import 2',
        gelar: 'M.M',
        jabatan: 'Pranata Komputer',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        ukpd: 'Bidang Tata Kelola',
        wilayah: 'Jakarta Pusat',
        jenisPenghargaan: 'SATYALANCANA',
        nilaiUsulan: 'X',
        tahunUsulan: 2026,
        masaKerjaTahun: 10,
        masaKerjaBulan: 0,
        catatan: 'Usulan 10 tahun SATYALANCANA',
      },
    ];

    const importResult1 = await service.importProposalsInContext(ACTOR_A_ID, TENANT_A_ID, importBatch1);

    assert(
      importResult1.importedCount === 2 && importResult1.createdCount === 2 && importResult1.updatedCount === 0,
      'Test 13: Batch import creates 2 fresh proposals and reports createdCount: 2'
    );
    assert(
      importResult1.proposals[0].status === 'NOMINATIF' && importResult1.proposals[1].status === 'NOMINATIF',
      'Test 14: Freshly imported proposals strictly initialize with status NOMINATIF'
    );

    const savedProposal1 = importResult1.proposals[0];

    // Test 15-17: Re-importing same proposal is idempotent (same ID, updatedCount increases, no duplicates)
    const reimportBatch: ImportAwardProposalItemDTO[] = [
      {
        nip: '198501012010011001',
        nrk: '123401',
        nama: 'Ahmad Pegawai Import 1 (Updated)',
        gelar: 'S.Kom, M.TI',
        jabatan: 'Analis Sistem Informasi Ahli Muda',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        jenisPenghargaan: 'MASA_KERJA',
        nilaiUsulan: '10',
        tahunUsulan: 2026,
        masaKerjaTahun: 10,
        masaKerjaBulan: 5,
        catatan: 'Updated catatan masa kerja',
      },
    ];

    const reimportResult = await service.importProposalsInContext(ACTOR_A_ID, TENANT_A_ID, reimportBatch);

    assert(
      reimportResult.importedCount === 1 && reimportResult.createdCount === 0 && reimportResult.updatedCount === 1,
      'Test 15: Re-importing existing natural key proposal updates existing record (updatedCount: 1, createdCount: 0)'
    );
    assert(
      reimportResult.proposals[0].id === savedProposal1.id,
      'Test 16: Idempotent re-import preserves authoritative proposal ID'
    );
    assert(
      reimportResult.proposals[0].employee.nama === 'Ahmad Pegawai Import 1 (Updated)' &&
      reimportResult.proposals[0].masaKerjaBulan === 5,
      'Test 17: Re-import updates factual employee and proposal data accurately'
    );

    // Test 18: Workflow Preservation (existing advanced proposal status is NOT reset to NOMINATIF)
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      await service.submitNominativeTx(tx, TENANT_A_ID, savedProposal1.id, ACTOR_A_ID);
    });

    const proposalAfterAdvance = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await proposalRepo.findByIdTx(tx, savedProposal1.id);
    });
    assert(
      proposalAfterAdvance?.status === 'BELUM_UPLOAD',
      'Test 18A: Proposal 1 successfully advanced to BELUM_UPLOAD'
    );

    // Re-import proposal 1 again
    const workflowPreserveResult = await service.importProposalsInContext(ACTOR_A_ID, TENANT_A_ID, reimportBatch);
    assert(
      workflowPreserveResult.proposals[0].status === 'BELUM_UPLOAD',
      'Test 18B: Re-import preserves advanced workflow status (BELUM_UPLOAD is NOT reset to NOMINATIF)'
    );

    // Test 19: Identity Collision Rejection
    const collisionBatch: ImportAwardProposalItemDTO[] = [
      {
        nip: '198501012010011001', // belongs to Employee 1
        nrk: '123402',             // belongs to Employee 2
        nama: 'Pegawai Konflik Identitas',
        jabatan: 'Staf',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2026,
      },
    ];

    let collisionErrorMsg = '';
    try {
      await service.importProposalsInContext(ACTOR_A_ID, TENANT_A_ID, collisionBatch);
    } catch (err: any) {
      collisionErrorMsg = err.message || '';
    }
    assert(
      collisionErrorMsg.includes('IDENTITY_COLLISION'),
      'Test 19: Identity collision (NIP of Employee A paired with NRK of Employee B) fails with IDENTITY_COLLISION error'
    );

    // Test 20: Aggregate Audit Event Verification
    const auditEvents = await adminPrisma.auditEvent.findMany({
      where: {
        tenantId: TENANT_A_ID,
        action: 'IMPORT_AWARD_PROPOSALS',
      },
    });
    assert(
      auditEvents.length >= 1,
      'Test 20A: Aggregate audit event IMPORT_AWARD_PROPOSALS is persisted in database'
    );
    const lastAuditEvent = auditEvents[auditEvents.length - 1];
    const payload = lastAuditEvent.payloadJson as any;
    const meta = payload?.metadata || {};
    assert(
      lastAuditEvent.entityType === 'Tenant' &&
      lastAuditEvent.entityId === TENANT_A_ID &&
      meta.targetScope === 'AWARD_EXCEL_IMPORT' &&
      typeof meta.rowCount === 'number',
      'Test 20B: Audit event accurately records Tenant entityType, entityId, targetScope, and rowCount'
    );

    // Test 21: Atomicity Requirement (Rollback on failure)
    const atomicBatch: ImportAwardProposalItemDTO[] = [
      {
        nip: '199999992020011999',
        nrk: '999999',
        nama: 'Calon Pegawai Batal',
        jabatan: 'Staf',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2026,
      },
      {
        nip: '199999992020011888',
        nrk: '888888',
        nama: 'Calon Pegawai Gagal Validasi',
        jabatan: 'Staf',
        unitKerja: 'Dinas Komunikasi dan Informatika',
        perangkatDaerah: 'Dinas Kominfotik',
        jenisPenghargaan: 'MASA_KERJA',
        tahunUsulan: 2026,
        masaKerjaBulan: 15, // INVALID: must be 0-11
      },
    ];

    let atomicErrorCaught = false;
    try {
      await service.importProposalsInContext(ACTOR_A_ID, TENANT_A_ID, atomicBatch);
    } catch (err: any) {
      atomicErrorCaught = true;
    }
    assert(atomicErrorCaught, 'Test 21A: Batch with invalid second item throws validation error');

    // Verify item 1 was completely rolled back from Employee and AwardProposal tables
    const rolledBackEmp = await adminPrisma.employee.findFirst({
      where: { tenantId: TENANT_A_ID, nip: '199999992020011999' },
    });
    assert(
      rolledBackEmp === null,
      'Test 21B: Atomic failure rolls back entire transaction — Employee 1 was NOT persisted'
    );

  } finally {
    // Guaranteed Teardown of mutable test entities
    try {
      await adminPrisma.awardProposal.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
      await adminPrisma.employee.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
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
