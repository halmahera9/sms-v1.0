import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import {
  archiveCompleteProposalAction,
  ArchiveCompleteProposalDTO,
} from '../src/domains/employee/awards/actions';
import {
  setSessionProvider,
  resetSessionProvider,
} from '../src/platform/auth/session';
import { AwardProposal } from '../src/domains/employee/awards/types';
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

async function runAwardProposalArchiveCompleteTests() {
  console.log('================================================================');
  console.log('  AWARD PROPOSAL ARCHIVE COMPLETE WORKFLOW & ACTION TEST SUITE  ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_ADMIN = 'a0000000-0000-7000-8000-000000000000';
  const ACTOR_VERIFIKATOR = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_OPERATOR = 'a2222222-2222-7222-8222-222222222222';
  const ACTOR_PEGAWAI = 'a3333333-3333-7333-8333-333333333333';
  const ACTOR_INACTIVE = 'a4444444-4444-7444-8444-444444444444';
  const ACTOR_TENANT_B = 'b2222222-2222-7222-8222-222222222222';

  const testEmpId = '22222222-2222-7222-8222-222222222299';
  const proposalIdSent = '77777777-7777-7777-8777-777777777798';
  const proposalIdSigned = '77777777-7777-7777-8777-777777777797';
  const proposalIdGenerated = '77777777-7777-7777-8777-777777777796';

  const proposalRepo = new PostgresAwardProposalRepository();
  const service = new AwardProposalApplicationService(proposalRepo);

  try {
    // -------------------------------------------------------------
    // 1. Setup Tenants, Users, Employee & Proposal Fixtures
    // -------------------------------------------------------------
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Archive Tenant A', code: 'ARCHIVE_TENANT_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Archive Tenant B', code: 'ARCHIVE_TENANT_B', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN },
      create: {
        id: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_archive_user',
        email: 'admin@archive.local',
        fullName: 'Admin Archive User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_VERIFIKATOR },
      create: {
        id: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verif_archive_user',
        email: 'verif@archive.local',
        fullName: 'Verifikator Archive User',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR },
      create: {
        id: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_archive_user',
        email: 'op@archive.local',
        fullName: 'Operator Archive User',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_PEGAWAI },
      create: {
        id: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_archive_user',
        email: 'pegawai@archive.local',
        fullName: 'Pegawai Archive User',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE },
      create: {
        id: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_archive_user',
        email: 'inactive@archive.local',
        fullName: 'Inactive Archive User',
        role: 'OPERATOR',
        status: 'INACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_TENANT_B },
      create: {
        id: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_archive_user',
        email: 'tb@archive.local',
        fullName: 'Tenant B Archive User',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    const testNip = '198205122008019999';
    const testNrk = '199999';

    // Initial cleanup
    await adminPrisma.awardProposal.deleteMany({
      where: {
        OR: [
          { id: { in: [proposalIdSent, proposalIdSigned, proposalIdGenerated] } },
          { employeeId: testEmpId },
        ],
      },
    });
    await adminPrisma.employee.deleteMany({
      where: { OR: [{ id: testEmpId }, { nip: testNip }] },
    });

    await adminPrisma.employee.create({
      data: {
        id: testEmpId,
        tenantId: TENANT_A_ID,
        nip: testNip,
        nrk: testNrk,
        fullName: 'Drs. H. Mulyadi, M.Pd',
        jabatan: 'Kepala Bidang Pembinaan',
        unitKerja: 'BKD Provinsi DKI Jakarta',
        instansi: 'Badan Kepegawaian Daerah',
        statusKepegawaian: 'PNS',
      },
    });

    const proposalSentFixture: AwardProposal = {
      id: proposalIdSent,
      tenantId: TENANT_A_ID,
      employeeId: testEmpId,
      employee: {
        id: testEmpId,
        nip: testNip,
        nrk: testNrk,
        nama: 'Drs. H. Mulyadi, M.Pd',
        jabatan: 'Kepala Bidang Pembinaan',
        unitKerja: 'BKD Provinsi DKI Jakarta',
        perangkatDaerah: 'Badan Kepegawaian Daerah',
        ukpd: 'BKD Provinsi DKI Jakarta',
        wilayah: 'Jakarta Pusat',
      },
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan: '30',
      tahunUsulan: 2026,
      masaKerjaTahun: 30,
      masaKerjaBulan: 0,
      status: 'DIKIRIM',
      catatan: 'Dokumen usulan telah dikirim ke instansi penerbit.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    const proposalSignedFixture: AwardProposal = {
      ...proposalSentFixture,
      id: proposalIdSigned,
      tahunUsulan: 2025,
      status: 'DITANDATANGANI',
    };

    const proposalGeneratedFixture: AwardProposal = {
      ...proposalSentFixture,
      id: proposalIdGenerated,
      tahunUsulan: 2024,
      status: 'GENERATED',
    };

    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalSentFixture);
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalSignedFixture);
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalGeneratedFixture);
    });

    // -------------------------------------------------------------
    // 2. Unit Level: PlatformWorkflowEngine Transition Tests
    // -------------------------------------------------------------
    console.log('[1] Testing Workflow Engine ARCHIVE_COMPLETE Transition Contract...');
    const validArchiveTransition = employeeAwardWorkflowEngine.transition('DIKIRIM', 'ARCHIVE_COMPLETE', {}, ACTOR_OPERATOR);
    assert(
      validArchiveTransition.success === true && validArchiveTransition.toState === 'SELESAI',
      'Workflow engine transitions from DIKIRIM to SELESAI on ARCHIVE_COMPLETE'
    );

    const invalidArchiveFromSigned = employeeAwardWorkflowEngine.transition('DITANDATANGANI', 'ARCHIVE_COMPLETE', {}, ACTOR_OPERATOR);
    assert(
      invalidArchiveFromSigned.success === false,
      'Workflow engine rejects ARCHIVE_COMPLETE transition from DITANDATANGANI'
    );

    const invalidArchiveFromGenerated = employeeAwardWorkflowEngine.transition('GENERATED', 'ARCHIVE_COMPLETE', {}, ACTOR_OPERATOR);
    assert(
      invalidArchiveFromGenerated.success === false,
      'Workflow engine rejects ARCHIVE_COMPLETE transition from GENERATED'
    );

    const invalidArchiveFromNominatif = employeeAwardWorkflowEngine.transition('NOMINATIF', 'ARCHIVE_COMPLETE', {}, ACTOR_OPERATOR);
    assert(
      invalidArchiveFromNominatif.success === false,
      'Workflow engine rejects ARCHIVE_COMPLETE transition from NOMINATIF'
    );

    // -------------------------------------------------------------
    // 3. Service Level: archiveCompleteProposalTx Persistence & Audit Tests
    // -------------------------------------------------------------
    console.log('\n[2] Testing AwardProposalApplicationService.archiveCompleteProposalTx...');
    let completedProposal: AwardProposal | null = null;
    await runInTenantContext(ACTOR_OPERATOR, TENANT_A_ID, async (tx) => {
      completedProposal = await service.archiveCompleteProposalTx(tx, TENANT_A_ID, proposalIdSent, ACTOR_OPERATOR);
    });

    assert(
      completedProposal !== null && (completedProposal as AwardProposal).status === 'SELESAI',
      'archiveCompleteProposalTx successfully updates proposal status to SELESAI'
    );
    assert(
      completedProposal !== null && (completedProposal as AwardProposal).nilaiUsulan === '30',
      'archiveCompleteProposalTx preserves nilaiUsulan'
    );
    assert(
      completedProposal !== null && (completedProposal as AwardProposal).employee.nama === 'Drs. H. Mulyadi, M.Pd',
      'archiveCompleteProposalTx preserves employee identity'
    );

    // Verify DB record directly via admin prisma
    const dbProposal = await adminPrisma.awardProposal.findUnique({
      where: { id: proposalIdSent },
    });
    assert(
      dbProposal?.status === 'SELESAI',
      'Proposal status persisted as SELESAI in PostgreSQL database'
    );

    // Verify AuditEvent creation in database
    const auditRecord = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityType: 'AwardProposal',
        entityId: proposalIdSent,
        action: 'ARCHIVE_COMPLETE',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditRecord !== null, 'AuditEvent with action ARCHIVE_COMPLETE was recorded atomically');
    assert(auditRecord?.actorUserId === ACTOR_OPERATOR, 'AuditEvent captures actorUserId correctly');
    const payload = auditRecord?.payloadJson as any;
    assert(payload?.beforeState?.status === 'DIKIRIM', 'AuditEvent captures beforeState.status = DIKIRIM');
    assert(payload?.afterState?.status === 'SELESAI', 'AuditEvent captures afterState.status = SELESAI');

    // Test archiveCompleteProposalInContext rejects invalid workflow transition
    let inContextInvalidThrew = false;
    try {
      await service.archiveCompleteProposalInContext(ACTOR_OPERATOR, TENANT_A_ID, proposalIdSigned);
    } catch (e: any) {
      inContextInvalidThrew = e.message.includes('Workflow transition failed');
    }
    assert(inContextInvalidThrew, 'archiveCompleteProposalInContext rejects completing proposal in DITANDATANGANI status');

    // -------------------------------------------------------------
    // 4. Server Action Level: archiveCompleteProposalAction Security & RBAC
    // -------------------------------------------------------------
    console.log('\n[3] Testing archiveCompleteProposalAction Server Action Security & RBAC...');

    // Reset proposal back to DIKIRIM for server action testing
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSentFixture,
        status: 'DIKIRIM',
      });
    });

    // 4.1 Anonymous session (Fail-Closed)
    resetSessionProvider();
    const resNoAuth = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resNoAuth.success === false && resNoAuth.error?.code === 'UNAUTHENTICATED',
      'Anonymous request is rejected with UNAUTHENTICATED'
    );

    // 4.2 Inactive session
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_archive_user',
        role: 'OPERATOR',
        status: 'INACTIVE',
      }),
    });
    const resInactive = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resInactive.success === false && resInactive.error?.code === 'UNAUTHENTICATED',
      'INACTIVE actor is rejected with UNAUTHENTICATED'
    );

    // 4.3 RBAC: PEGAWAI role -> FORBIDDEN
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_archive_user',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      }),
    });
    const resPegawai = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resPegawai.success === false && resPegawai.error?.code === 'FORBIDDEN',
      'PEGAWAI role is forbidden from executing ARCHIVE_COMPLETE_PROPOSAL'
    );

    // 4.4 Validation Error (empty proposalId)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_archive_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resInvalidDto = await archiveCompleteProposalAction({ proposalId: '' });
    assert(
      resInvalidDto.success === false && resInvalidDto.error?.code === 'VALIDATION_ERROR',
      'Empty proposalId is rejected with VALIDATION_ERROR'
    );

    // 4.5 Cross-Tenant isolation: Tenant B cannot archive/complete Tenant A proposal
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_archive_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resCrossTenant = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resCrossTenant.success === false && resCrossTenant.error?.code === 'DOMAIN_ERROR',
      'Tenant B actor cannot access or complete Tenant A proposal (Tenant RLS boundary)'
    );

    // 4.6 Domain Error (attempting to archive proposal in DITANDATANGANI status)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_archive_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resDomainError = await archiveCompleteProposalAction({ proposalId: proposalIdSigned });
    assert(
      resDomainError.success === false && resDomainError.error?.code === 'DOMAIN_ERROR',
      'Completing proposal in DITANDATANGANI status returns DOMAIN_ERROR'
    );

    // 4.7 Authorized OPERATOR execution -> Success
    const resOperatorSuccess = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resOperatorSuccess.success === true && resOperatorSuccess.data?.status === 'SELESAI',
      'Authorized OPERATOR successfully executes archiveCompleteProposalAction and receives status SELESAI'
    );

    // 4.8 Authorized VERIFIKATOR execution -> Success (on reset proposal)
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSentFixture,
        status: 'DIKIRIM',
      });
    });
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verif_archive_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resVerifSuccess = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resVerifSuccess.success === true && resVerifSuccess.data?.status === 'SELESAI',
      'Authorized VERIFIKATOR successfully executes archiveCompleteProposalAction'
    );

    // 4.9 Authorized ADMIN execution -> Success (on reset proposal)
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSentFixture,
        status: 'DIKIRIM',
      });
    });
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_archive_user',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    });
    const resAdminSuccess = await archiveCompleteProposalAction({ proposalId: proposalIdSent });
    assert(
      resAdminSuccess.success === true && resAdminSuccess.data?.status === 'SELESAI',
      'Authorized ADMIN successfully executes archiveCompleteProposalAction'
    );

    // 4.10 Response Serializability
    const jsonSerialized = JSON.stringify(resAdminSuccess);
    const parsed = JSON.parse(jsonSerialized);
    assert(
      parsed.data.status === 'SELESAI' && parsed.success === true,
      'archiveCompleteProposalAction response is 100% JSON serializable for client consumption'
    );

  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runAwardProposalArchiveCompleteTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
