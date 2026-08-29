import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { employeeAwardWorkflowEngine } from '../src/domains/employee/awards/workflow';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import {
  signProposalAction,
  SignProposalDTO,
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

async function runAwardProposalSignTests() {
  console.log('=====================================================');
  console.log('  AWARD PROPOSAL SIGN WORKFLOW & ACTION TEST SUITE   ');
  console.log('=====================================================\n');

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
  const proposalIdGenerated = '77777777-7777-7777-8777-777777777791';
  const proposalIdNominatif = '77777777-7777-7777-8777-777777777792';

  const proposalRepo = new PostgresAwardProposalRepository();
  const service = new AwardProposalApplicationService(proposalRepo);

  try {
    // -------------------------------------------------------------
    // 1. Setup Tenants, Users, Employee & Proposal Fixtures
    // -------------------------------------------------------------
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Sign Tenant A', code: 'SIGN_TENANT_A', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Sign Tenant B', code: 'SIGN_TENANT_B', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN },
      create: {
        id: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_sign_user',
        email: 'admin@sign.local',
        fullName: 'Admin Sign User',
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
        username: 'verif_sign_user',
        email: 'verif@sign.local',
        fullName: 'Verifikator Sign User',
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
        username: 'op_sign_user',
        email: 'op@sign.local',
        fullName: 'Operator Sign User',
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
        username: 'pegawai_sign_user',
        email: 'pegawai@sign.local',
        fullName: 'Pegawai Sign User',
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
        username: 'inactive_sign_user',
        email: 'inactive@sign.local',
        fullName: 'Inactive Sign User',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_TENANT_B },
      create: {
        id: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_sign_user',
        email: 'tb@sign.local',
        fullName: 'Tenant B Sign User',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    const testNip = '198205122008019999';
    const testNrk = '189999';

    // Initial cleanup
    await adminPrisma.awardProposal.deleteMany({
      where: { id: { in: [proposalIdGenerated, proposalIdNominatif] } },
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
        fullName: 'Dra. Sri Wahyuni, M.Si',
        jabatan: 'Kepala Sub Bagian Tata Usaha',
        unitKerja: 'BKD Provinsi DKI Jakarta',
        instansi: 'Badan Kepegawaian Daerah',
        statusKepegawaian: 'PNS',
      },
    });

    const proposalGeneratedFixture: AwardProposal = {
      id: proposalIdGenerated,
      tenantId: TENANT_A_ID,
      employeeId: testEmpId,
      employee: {
        id: testEmpId,
        nip: testNip,
        nrk: testNrk,
        nama: 'Dra. Sri Wahyuni, M.Si',
        jabatan: 'Kepala Sub Bagian Tata Usaha',
        unitKerja: 'BKD Provinsi DKI Jakarta',
        perangkatDaerah: 'Badan Kepegawaian Daerah',
        ukpd: 'BKD Provinsi DKI Jakarta',
        wilayah: 'Jakarta Pusat',
      },
      jenisPenghargaan: 'MASA_KERJA',
      nilaiUsulan: '20',
      tahunUsulan: 2026,
      masaKerjaTahun: 20,
      masaKerjaBulan: 0,
      status: 'GENERATED',
      catatan: 'Dokumen usulan PDF telah digenerate.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    const proposalNominatifFixture: AwardProposal = {
      ...proposalGeneratedFixture,
      id: proposalIdNominatif,
      tahunUsulan: 2025,
      status: 'NOMINATIF',
    };

    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalGeneratedFixture);
      await proposalRepo.saveTx(tx, TENANT_A_ID, proposalNominatifFixture);
    });

    // -------------------------------------------------------------
    // 2. Unit Level: PlatformWorkflowEngine Transition Tests
    // -------------------------------------------------------------
    console.log('[1] Testing Workflow Engine SIGN Transition Contract...');
    const validSignTransition = employeeAwardWorkflowEngine.transition('GENERATED', 'SIGN', {}, ACTOR_VERIFIKATOR);
    assert(
      validSignTransition.success === true && validSignTransition.toState === 'DITANDATANGANI',
      'Workflow engine transitions from GENERATED to DITANDATANGANI on SIGN'
    );

    const invalidSignFromNominatif = employeeAwardWorkflowEngine.transition('NOMINATIF', 'SIGN', {}, ACTOR_VERIFIKATOR);
    assert(
      invalidSignFromNominatif.success === false,
      'Workflow engine rejects SIGN transition from NOMINATIF'
    );

    const invalidSignFromSiapGenerate = employeeAwardWorkflowEngine.transition('SIAP_GENERATE', 'SIGN', {}, ACTOR_VERIFIKATOR);
    assert(
      invalidSignFromSiapGenerate.success === false,
      'Workflow engine rejects SIGN transition from SIAP_GENERATE'
    );

    // -------------------------------------------------------------
    // 3. Service Level: signProposalTx Persistence & Audit Tests
    // -------------------------------------------------------------
    console.log('\n[2] Testing AwardProposalApplicationService.signProposalTx...');
    let signedProposal: AwardProposal | null = null;
    await runInTenantContext(ACTOR_VERIFIKATOR, TENANT_A_ID, async (tx) => {
      signedProposal = await service.signProposalTx(tx, TENANT_A_ID, proposalIdGenerated, ACTOR_VERIFIKATOR);
    });

    assert(
      signedProposal !== null && (signedProposal as AwardProposal).status === 'DITANDATANGANI',
      'signProposalTx successfully updates proposal status to DITANDATANGANI'
    );
    assert(
      signedProposal !== null && (signedProposal as AwardProposal).nilaiUsulan === '20',
      'signProposalTx preserves nilaiUsulan'
    );
    assert(
      signedProposal !== null && (signedProposal as AwardProposal).employee.nama === 'Dra. Sri Wahyuni, M.Si',
      'signProposalTx preserves employee identity'
    );

    // Verify DB record directly via admin prisma
    const dbProposal = await adminPrisma.awardProposal.findUnique({
      where: { id: proposalIdGenerated },
    });
    assert(
      dbProposal?.status === 'DITANDATANGANI',
      'Proposal status persisted as DITANDATANGANI in PostgreSQL database'
    );

    // Verify AuditEvent creation in database
    const auditRecord = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityType: 'AwardProposal',
        entityId: proposalIdGenerated,
        action: 'SIGN',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditRecord !== null, 'AuditEvent with action SIGN was recorded atomically');
    assert(auditRecord?.actorUserId === ACTOR_VERIFIKATOR, 'AuditEvent captures actorUserId correctly');
    const payload = auditRecord?.payloadJson as any;
    assert(payload?.beforeState?.status === 'GENERATED', 'AuditEvent captures beforeState.status = GENERATED');
    assert(payload?.afterState?.status === 'DITANDATANGANI', 'AuditEvent captures afterState.status = DITANDATANGANI');

    // Test signProposalInContext rejects invalid workflow transition
    let inContextInvalidThrew = false;
    try {
      await service.signProposalInContext(ACTOR_VERIFIKATOR, TENANT_A_ID, proposalIdNominatif);
    } catch (e: any) {
      inContextInvalidThrew = e.message.includes('Workflow transition failed');
    }
    assert(inContextInvalidThrew, 'signProposalInContext rejects signing proposal in NOMINATIF status');

    // -------------------------------------------------------------
    // 4. Server Action Level: signProposalAction Security & RBAC
    // -------------------------------------------------------------
    console.log('\n[3] Testing signProposalAction Server Action Security & RBAC...');

    // Reset proposal back to GENERATED for server action testing
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalGeneratedFixture,
        status: 'GENERATED',
      });
    });

    // 4.1 Anonymous session (Fail-Closed)
    resetSessionProvider();
    const resNoAuth = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resNoAuth.success === false && resNoAuth.error?.code === 'UNAUTHENTICATED',
      'Anonymous request is rejected with UNAUTHENTICATED'
    );

    // 4.2 Inactive session
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_sign_user',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const resInactive = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resInactive.success === false && resInactive.error?.code === 'UNAUTHENTICATED',
      'INACTIVE actor is rejected with UNAUTHENTICATED'
    );

    // 4.3 RBAC: PEGAWAI role -> FORBIDDEN
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_sign_user',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      }),
    });
    const resPegawai = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resPegawai.success === false && resPegawai.error?.code === 'FORBIDDEN',
      'PEGAWAI role is forbidden from executing SIGN_PROPOSAL'
    );

    // 4.4 RBAC: OPERATOR role -> FORBIDDEN
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'op_sign_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resOperator = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resOperator.success === false && resOperator.error?.code === 'FORBIDDEN',
      'OPERATOR role is forbidden from executing SIGN_PROPOSAL'
    );

    // 4.5 Validation Error (empty proposalId)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verif_sign_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resInvalidDto = await signProposalAction({ proposalId: '' });
    assert(
      resInvalidDto.success === false && resInvalidDto.error?.code === 'VALIDATION_ERROR',
      'Empty proposalId is rejected with VALIDATION_ERROR'
    );

    // 4.6 Cross-Tenant isolation: Tenant B cannot sign Tenant A proposal
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_sign_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resCrossTenant = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resCrossTenant.success === false && resCrossTenant.error?.code === 'DOMAIN_ERROR',
      'Tenant B actor cannot access or sign Tenant A proposal (Tenant RLS boundary)'
    );

    // 4.7 Domain Error (attempting to sign NOMINATIF proposal)
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verif_sign_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resDomainError = await signProposalAction({ proposalId: proposalIdNominatif });
    assert(
      resDomainError.success === false && resDomainError.error?.code === 'DOMAIN_ERROR',
      'Signing proposal in NOMINATIF status returns DOMAIN_ERROR'
    );

    // 4.8 Authorized VERIFIKATOR execution -> Success
    const resVerifikatorSuccess = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resVerifikatorSuccess.success === true && resVerifikatorSuccess.data?.status === 'DITANDATANGANI',
      'Authorized VERIFIKATOR successfully executes signProposalAction and receives status DITANDATANGANI'
    );

    // 4.9 Authorized ADMIN execution -> Success (on newly reset generated proposal)
    await runInTenantContext(ACTOR_ADMIN, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, {
        ...proposalGeneratedFixture,
        status: 'GENERATED',
      });
    });
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_sign_user',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    });
    const resAdminSuccess = await signProposalAction({ proposalId: proposalIdGenerated });
    assert(
      resAdminSuccess.success === true && resAdminSuccess.data?.status === 'DITANDATANGANI',
      'Authorized ADMIN successfully executes signProposalAction'
    );

    // 4.10 Response Serializability
    const jsonSerialized = JSON.stringify(resAdminSuccess);
    const parsed = JSON.parse(jsonSerialized);
    assert(
      parsed.data.status === 'DITANDATANGANI' && parsed.success === true,
      'signProposalAction response is 100% JSON serializable for client consumption'
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

runAwardProposalSignTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
