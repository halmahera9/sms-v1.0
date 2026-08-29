import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import { sendProposalAction } from '../src/domains/employee/awards/actions';
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

async function runAwardProposalSendTests() {
  console.log('=====================================================');
  console.log('  AWARD PROPOSAL SEND WORKFLOW & ACTION TEST SUITE   ');
  console.log('=====================================================\n');

  console.log('STEP A: Creating admin pool...');
const adminPool = new pg.Pool({
  connectionString: process.env.ADMIN_DATABASE_URL
});
console.log('STEP A OK: Pool created');

console.log('STEP B: Creating Prisma...');
const adminPrisma = new PrismaClient({
  adapter: new PrismaPg(adminPool)
});
console.log('STEP B OK: Prisma created');

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_ADMIN = 'a0000000-0000-7000-8000-000000000000';
  const ACTOR_VERIFIKATOR = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_OPERATOR = 'a2222222-2222-7222-8222-222222222222';
  const ACTOR_PEGAWAI = 'a3333333-3333-7333-8333-333333333333';
  const ACTOR_INACTIVE = 'a4444444-4444-7444-8444-444444444444';
  const ACTOR_TENANT_B = 'b2222222-2222-7222-8222-222222222222';

  const testEmpId = '22222222-2222-7222-8222-222222222288';
  const proposalIdSigned = '77777777-7777-7777-8777-777777777788';
  const proposalIdGenerated = '77777777-7777-7777-8777-777777777789';

  console.log('STEP C: Creating repository/service...');

const proposalRepo = new PostgresAwardProposalRepository();
console.log('STEP C1 OK: Repository created');

const service = new AwardProposalApplicationService(proposalRepo);
console.log('STEP C2 OK: Service created');

  try {
    // -------------------------------------------------------------
    // 1. Setup Tenants, Users, Employee & Proposal Fixtures
    // -------------------------------------------------------------
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Send Tenant A', code: 'SEND_TENANT_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Send Tenant B', code: 'SEND_TENANT_B', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN },
      create: {
        id: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_send_user',
        email: 'admin@send.local',
        fullName: 'Admin Send User',
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
        username: 'verif_send_user',
        email: 'verif@send.local',
        fullName: 'Verifikator Send User',
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
        username: 'op_send_user',
        email: 'op@send.local',
        fullName: 'Operator Send User',
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
        username: 'pegawai_send_user',
        email: 'pegawai@send.local',
        fullName: 'Pegawai Send User',
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
        username: 'inactive_send_user',
        email: 'inactive@send.local',
        fullName: 'Inactive Send User',
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
        username: 'tenant_b_send_user',
        email: 'tb@send.local',
        fullName: 'Tenant B Send User',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    const testNip = '198205122008018888';
    const testNrk = '188888';

    // Initial cleanup
    await adminPrisma.awardProposal.deleteMany({
      where: { id: { in: [proposalIdSigned, proposalIdGenerated] } },
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

    const proposalSignedFixture: AwardProposal = {
      id: proposalIdSigned,
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
      status: 'DITANDATANGANI',
      catatan: 'Dokumen usulan telah ditandatangani basah/digital.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    const proposalGeneratedFixture: AwardProposal = {
      ...proposalSignedFixture,
      id: proposalIdGenerated,
      tahunUsulan: 2025,
      status: 'GENERATED',
    };

    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalSignedFixture);
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalGeneratedFixture);
    });

    // -------------------------------------------------------------
    // 2. Unit Level: PlatformWorkflowEngine Transition Tests
    // -------------------------------------------------------------
    console.log('[1] Testing Workflow Engine SEND Transition Contract...');
    const validSendTransition = employeeAwardWorkflowEngine.transition('DITANDATANGANI', 'SEND', {}, ACTOR_OPERATOR);
    assert(
      validSendTransition.success === true && validSendTransition.toState === 'DIKIRIM',
      'Workflow engine transitions from DITANDATANGANI to DIKIRIM on SEND'
    );

    const invalidSendFromGenerated = employeeAwardWorkflowEngine.transition('GENERATED', 'SEND', {}, ACTOR_OPERATOR);
    assert(
      invalidSendFromGenerated.success === false,
      'Workflow engine rejects SEND transition from GENERATED'
    );

    const invalidSendFromNominatif = employeeAwardWorkflowEngine.transition('NOMINATIF', 'SEND', {}, ACTOR_OPERATOR);
    assert(
      invalidSendFromNominatif.success === false,
      'Workflow engine rejects SEND transition from NOMINATIF'
    );

    // -------------------------------------------------------------
    // 3. Service Level: sendProposalTx Persistence & Audit Tests
    // -------------------------------------------------------------
    console.log('\n[2] Testing AwardProposalApplicationService.sendProposalTx...');
    let sentProposal: AwardProposal | null = null;
    await runInTenantContext(ACTOR_OPERATOR, TENANT_A_ID, async (tx) => {
      sentProposal = await service.sendProposalTx(tx, TENANT_A_ID, proposalIdSigned, ACTOR_OPERATOR);
    });

    assert(
      sentProposal !== null && (sentProposal as AwardProposal).status === 'DIKIRIM',
      'sendProposalTx successfully updates proposal status to DIKIRIM'
    );
    assert(
      sentProposal !== null && (sentProposal as AwardProposal).nilaiUsulan === '30',
      'sendProposalTx preserves nilaiUsulan'
    );
    assert(
      sentProposal !== null && (sentProposal as AwardProposal).employee.nama === 'Drs. H. Mulyadi, M.Pd',
      'sendProposalTx preserves employee identity'
    );

    // Verify DB record directly via admin prisma
    const dbProposal = await adminPrisma.awardProposal.findUnique({
      where: { id: proposalIdSigned },
    });
    assert(
      dbProposal?.status === 'DIKIRIM',
      'Proposal status persisted as DIKIRIM in PostgreSQL database'
    );

    // Verify AuditEvent creation in database
    const auditRecord = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityType: 'AwardProposal',
        entityId: proposalIdSigned,
        action: 'SEND',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditRecord !== null, 'AuditEvent with action SEND was recorded atomically');
    assert(auditRecord?.actorUserId === ACTOR_OPERATOR, 'AuditEvent captures actorUserId correctly');
    const payload = auditRecord?.payloadJson as any;
    assert(payload?.beforeState?.status === 'DITANDATANGANI', 'AuditEvent captures beforeState.status = DITANDATANGANI');
    assert(payload?.afterState?.status === 'DIKIRIM', 'AuditEvent captures afterState.status = DIKIRIM');

    // Test sendProposalInContext rejects invalid workflow transition
    let inContextInvalidThrew = false;
    try {
      await service.sendProposalInContext(ACTOR_OPERATOR, TENANT_A_ID, proposalIdGenerated);
    } catch (e: any) {
      inContextInvalidThrew = e.message.includes('Workflow transition failed');
    }
    assert(inContextInvalidThrew, 'sendProposalInContext rejects sending proposal in GENERATED status');

    // -------------------------------------------------------------
    // 4. Server Action Level: sendProposalAction Security & RBAC
    // -------------------------------------------------------------
    console.log('\n[3] Testing sendProposalAction Server Action Security & RBAC...');

    // Reset proposal back to DITANDATANGANI for server action testing
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSignedFixture,
        status: 'DITANDATANGANI',
      });
    });

    // 4.1 Anonymous session (Fail-Closed)
    resetSessionProvider();
    const resNoAuth = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resNoAuth.success === false && resNoAuth.error?.code === 'UNAUTHENTICATED',
      'Anonymous request is rejected with UNAUTHENTICATED'
    );

    // 4.2 Inactive session
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_send_user',
        role: 'OPERATOR',
        status: 'INACTIVE',
      }),
    });
    const resInactive = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resInactive.success === false && resInactive.error?.code === 'UNAUTHENTICATED',
      'INACTIVE actor is rejected with UNAUTHENTICATED'
    );

    // 4.3 RBAC: PEGAWAI role -> FORBIDDEN
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_send_user',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      }),
    });
    const resPegawai = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resPegawai.success === false && resPegawai.error?.code === 'FORBIDDEN',
      'PEGAWAI role is forbidden from executing SEND_PROPOSAL'
    );

    // 4.4 Validation Error (empty proposalId)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_send_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resInvalidDto = await sendProposalAction({ proposalId: '' });
    assert(
      resInvalidDto.success === false && resInvalidDto.error?.code === 'VALIDATION_ERROR',
      'Empty proposalId is rejected with VALIDATION_ERROR'
    );

    // 4.5 Cross-Tenant isolation: Tenant B cannot send Tenant A proposal
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_send_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resCrossTenant = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resCrossTenant.success === false && resCrossTenant.error?.code === 'DOMAIN_ERROR',
      'Tenant B actor cannot access or send Tenant A proposal (Tenant RLS boundary)'
    );

    // 4.6 Domain Error (attempting to send GENERATED proposal)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_send_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resDomainError = await sendProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resDomainError.success === false && resDomainError.error?.code === 'DOMAIN_ERROR',
      'Sending proposal in GENERATED status returns DOMAIN_ERROR'
    );

    // 4.7 Authorized OPERATOR execution -> Success
    const resOperatorSuccess = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resOperatorSuccess.success === true && resOperatorSuccess.data?.status === 'DIKIRIM',
      'Authorized OPERATOR successfully executes sendProposalAction and receives status DIKIRIM'
    );

    // 4.8 Authorized VERIFIKATOR execution -> Success (on reset proposal)
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSignedFixture,
        status: 'DITANDATANGANI',
      });
    });
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verif_send_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resVerifSuccess = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resVerifSuccess.success === true && resVerifSuccess.data?.status === 'DIKIRIM',
      'Authorized VERIFIKATOR successfully executes sendProposalAction'
    );

    // 4.9 Authorized ADMIN execution -> Success (on reset proposal)
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalSignedFixture,
        status: 'DITANDATANGANI',
      });
    });
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_send_user',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    });
    const resAdminSuccess = await sendProposalAction({ proposalId: proposalIdSigned });
    assert(
      resAdminSuccess.success === true && resAdminSuccess.data?.status === 'DIKIRIM',
      'Authorized ADMIN successfully executes sendProposalAction'
    );

    // 4.10 Response Serializability
    const jsonSerialized = JSON.stringify(resAdminSuccess);
    const parsed = JSON.parse(jsonSerialized);
    assert(
      parsed.data.status === 'DIKIRIM' && parsed.success === true,
      'sendProposalAction response is 100% JSON serializable for client consumption'
    );

  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED `);
  console.log('=====================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runAwardProposalSendTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
