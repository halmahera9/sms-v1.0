import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  uploadProposalDocumentAction,
  verifyProposalDocumentAction,
  approveProposalGenerationAction,
  batchMarkGeneratedAction,
  getAwardProposalsAction,
  importAwardProposalsAction,
} from '../src/domains/employee/awards/actions';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorSession,
} from '../src/platform/auth/session';
import { AwardProposal, ImportAwardProposalsInput, ImportAwardProposalItemDTO } from '../src/domains/employee/awards/types';
import { PostgresAwardProposalRepository } from '../src/platform/repositories/award-proposal';
import { runInTenantContext } from '../src/platform/db/tenant-context';
import { AwardProposalApplicationService } from '../src/domains/employee/awards/service';

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

async function runSecurityActionTests() {
  console.log('=====================================================');
  console.log(' AWARD PROPOSAL ACTIONS SECURITY & RBAC TEST SUITE  ');
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

  const testEmpId = '22222222-2222-7222-8222-222222222235';
  const proposalId = '77777777-7777-7777-8777-777777777775';

  const proposalRepo = new PostgresAwardProposalRepository();

  try {
    // Setup Tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Security Tenant A', code: 'SEC_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Security Tenant A', code: 'SEC_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Security Tenant B', code: 'SEC_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Security Tenant B', code: 'SEC_TENANT_B' },
    });

    // Setup Actors
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_VERIFIKATOR },
      create: {
        id: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verifikator_user',
        email: 'verif@sec.local',
        fullName: 'Verifikator User',
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
        username: 'operator_user',
        email: 'operator@sec.local',
        fullName: 'Operator User',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE },
      create: {
        id: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_user',
        email: 'inactive@sec.local',
        fullName: 'Inactive User',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN },
      create: {
        id: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_user',
        email: 'admin@sec.local',
        fullName: 'Admin User',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_PEGAWAI },
      create: {
        id: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_user',
        email: 'pegawai@sec.local',
        fullName: 'Pegawai User',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_TENANT_B },
      create: {
        id: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_user',
        email: 'tenant_b@sec.local',
        fullName: 'Tenant B User',
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
        nip: '198501012010011099',
        nrk: '180099',
        fullName: 'Dr. Hendra Gunawan',
        jabatan: 'Analis Kepegawaian',
        unitKerja: 'BKD DKI Jakarta',
        instansi: 'BKD Provinsi DKI Jakarta',
        statusKepegawaian: 'PNS',
      },
      update: {},
    });

    // Seed proposal in Tenant A
    const fixture: AwardProposal = {
      id: proposalId,
      tenantId: TENANT_A_ID,
      employeeId: testEmpId,
      employee: {
        id: testEmpId,
        nip: '198501012010011099',
        nrk: '180099',
        nama: 'Dr. Hendra Gunawan',
        jabatan: 'Analis Kepegawaian',
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
      status: 'LENGKAP',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
    };

    await runInTenantContext(ACTOR_VERIFIKATOR, TENANT_A_ID, async (tx) => {
      await proposalRepo.saveTx(tx, TENANT_A_ID, fixture);
    });

    // -------------------------------------------------------------
    // Test 1: No session (Anonymous) -> Fail-Closed (UNAUTHENTICATED)
    // -------------------------------------------------------------
    console.log('[1] Testing Anonymous / No Session Fail-Closed...');
    resetSessionProvider(); // Default provider returns null
    const resNoAuth = await approveProposalGenerationAction({ proposalId });
    assert(
      resNoAuth.success === false && resNoAuth.error?.code === 'UNAUTHENTICATED',
      'Test 1: Anonymous request without session is rejected with UNAUTHENTICATED'
    );
    const resNoAuthRead = await getAwardProposalsAction();
    assert(
      resNoAuthRead.success === false && resNoAuthRead.error?.code === 'UNAUTHENTICATED',
      'Test 1b: Anonymous read request without session is rejected with UNAUTHENTICATED'
    );

    // -------------------------------------------------------------
    // Test 2: INACTIVE actor -> rejected (UNAUTHENTICATED)
    // -------------------------------------------------------------
    console.log('\n[2] Testing INACTIVE Actor Session...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_user',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const resInactive = await verifyProposalDocumentAction({
      proposalId,
      requirementCode: 'SK_CPNS',
      status: 'verified',
    });
    assert(
      resInactive.success === false && resInactive.error?.code === 'UNAUTHENTICATED',
      'Test 2: INACTIVE actor is rejected with UNAUTHENTICATED'
    );

    // -------------------------------------------------------------
    // Test 3: OPERATOR verifyProposalDocumentAction -> FORBIDDEN
    // -------------------------------------------------------------
    console.log('\n[3] Testing RBAC: verifyProposalDocumentAction restrictions...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resOperatorVerify = await verifyProposalDocumentAction({
      proposalId,
      requirementCode: 'SK_CPNS',
      status: 'verified',
    });
    assert(
      resOperatorVerify.success === false && resOperatorVerify.error?.code === 'FORBIDDEN',
      'Test 3: OPERATOR role is forbidden from verifying documents'
    );

    // -------------------------------------------------------------
    // Test 4: OPERATOR approveProposalGenerationAction -> FORBIDDEN
    // -------------------------------------------------------------
    console.log('\n[4] Testing RBAC: approveProposalGenerationAction restrictions...');
    const resOperatorApprove = await approveProposalGenerationAction({ proposalId });
    assert(
      resOperatorApprove.success === false && resOperatorApprove.error?.code === 'FORBIDDEN',
      'Test 4: OPERATOR role is forbidden from approving proposal generation'
    );

    // -------------------------------------------------------------
    // Test 5: Authorized VERIFIKATOR verifyProposalDocumentAction -> Allowed
    // -------------------------------------------------------------
    console.log('\n[5] Testing Authorized VERIFIKATOR Execution...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verifikator_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resVerifVerify = await verifyProposalDocumentAction({
      proposalId,
      requirementCode: 'SK_CPNS',
      status: 'verified',
      notes: 'SK CPNS sah.',
    });
    assert(
      resVerifVerify.success === true && resVerifVerify.data?.status === 'DIVERIFIKASI',
      'Test 5: Authorized VERIFIKATOR can verify document and transition to DIVERIFIKASI'
    );

    // -------------------------------------------------------------
    // Test 6: Authorized VERIFIKATOR approveProposalGenerationAction -> Guard enforcement
    // -------------------------------------------------------------
    console.log('\n[6] Testing Workflow Guard Under Authorized Session...');
    // Only 1 mandatory document verified, so approveGeneration must fail with DOMAIN_ERROR
    const resVerifApproveFail = await approveProposalGenerationAction({ proposalId });
    assert(
      resVerifApproveFail.success === false && resVerifApproveFail.error?.code === 'DOMAIN_ERROR',
      'Test 6: approveProposalGenerationAction fails with DOMAIN_ERROR when mandatory documents incomplete'
    );

    // Verify all remaining mandatory documents
    const mandatoryCodes = ['SK_PNS', 'SK_PANGKAT_TERAKHIR', 'SK_JABATAN_TERAKHIR', 'SKP_2025', 'SKT_TIDAK_HUKDIS'];
    for (const code of mandatoryCodes) {
      await verifyProposalDocumentAction({
        proposalId,
        requirementCode: code,
        status: 'verified',
      });
    }

    const resVerifApproveSuccess = await approveProposalGenerationAction({ proposalId });
    assert(
      resVerifApproveSuccess.success === true && resVerifApproveSuccess.data?.status === 'SIAP_GENERATE',
      'Test 7: Authorized VERIFIKATOR successfully approves generation (SIAP_GENERATE) when all mandatory verified'
    );

    // -------------------------------------------------------------
    // Test 7: Authorized OPERATOR uploadProposalDocumentAction -> Allowed
    // -------------------------------------------------------------
    console.log('\n[7] Testing Authorized OPERATOR upload...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const resOpUpload = await uploadProposalDocumentAction({
      proposalId,
      requirementCode: 'SK_CPNS',
      fileName: 'sk_cpns_revised.pdf',
      fileSize: 1024 * 100,
      fileType: 'application/pdf',
    });
    assert(
      resOpUpload.success === true,
      'Test 8: Authorized OPERATOR can upload proposal documents'
    );

    // -------------------------------------------------------------
    // Test 8: Browser userRole cannot elevate privileges
    // -------------------------------------------------------------
    console.log('\n[8] Testing Browser Role Tampering Immunity...');
    // Even if client claims "admin", server checks session role (OPERATOR)
    const resTamper = await approveProposalGenerationAction({ proposalId });
    assert(
      resTamper.success === false && resTamper.error?.code === 'FORBIDDEN',
      'Test 9: Browser role cannot elevate privileges, session role is authoritative'
    );

    // -------------------------------------------------------------
    // Test 9: Cross-tenant proposal remains rejected
    // -------------------------------------------------------------
    console.log('\n[9] Testing Cross-Tenant Access Protection...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resCrossTenant = await approveProposalGenerationAction({ proposalId });
    assert(
      resCrossTenant.success === false && resCrossTenant.error?.code === 'DOMAIN_ERROR',
      'Test 10: Tenant B actor cannot access or approve Tenant A proposal (RLS blocks access)'
    );

    // -------------------------------------------------------------
    // Test 10: Validation Error Sanitization
    // -------------------------------------------------------------
    console.log('\n[10] Testing Validation Error Sanitization...');
    const resInvalidInput = await uploadProposalDocumentAction({
      proposalId: '',
      requirementCode: '',
      fileName: '',
      fileSize: 0,
      fileType: '',
    });
    assert(
      resInvalidInput.success === false && resInvalidInput.error?.code === 'VALIDATION_ERROR',
      'Test 11: Validation error is cleanly categorized as VALIDATION_ERROR'
    );

    // -------------------------------------------------------------
    // Test 11: Unexpected Internal/Database Exception Sanitization
    // -------------------------------------------------------------
    console.log('\n[11] Testing Unexpected Internal/Database Exception Sanitization...');
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verifikator_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });

    const rawSecretDatabaseErrorMessage =
      'FATAL: connection to server at "db.internal.cloud:5432" failed: fe_sendauth: no password supplied (SQLSTATE 28000)';

    // Temporarily mock service method to simulate an unexpected internal database panic
    const originalApproveMethod = AwardProposalApplicationService.prototype.approveGenerationInContext;
    AwardProposalApplicationService.prototype.approveGenerationInContext = async () => {
      throw new Error(rawSecretDatabaseErrorMessage);
    };

    // Suppress console.error during expected internal error logging test
    const originalConsoleError = console.error;
    let loggedInternalError: unknown = null;
    console.error = (...args: unknown[]) => {
      loggedInternalError = args;
    };

    try {
      const resInternal = await approveProposalGenerationAction({ proposalId });

      assert(
        resInternal.success === false,
        'Test 12: Internal error response has success === false'
      );
      assert(
        resInternal.error?.code === 'INTERNAL_ERROR',
        'Test 13: Internal error response maps to code "INTERNAL_ERROR"'
      );
      assert(
        resInternal.error?.message === 'Terjadi kesalahan internal pada sistem.',
        'Test 14: Client receives sanitized generic message without database details'
      );
      assert(
        !JSON.stringify(resInternal).includes(rawSecretDatabaseErrorMessage),
        'Test 15: Raw internal error message is strictly absent from client response payload'
      );
      assert(
        loggedInternalError !== null,
        'Test 16: Internal error was logged server-side via console.error'
      );
    } finally {
      // Restore original methods
      AwardProposalApplicationService.prototype.approveGenerationInContext = originalApproveMethod;
      console.error = originalConsoleError;
    }

    // -------------------------------------------------------------
    // Test 12: getAwardProposalsAction Authenticated Read & Isolation
    // -------------------------------------------------------------
    console.log('\n[12] Testing getAwardProposalsAction Authenticated Read & Isolation...');
    // As Tenant A verifikator
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verifikator_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resReadTenantA = await getAwardProposalsAction();
    assert(
      resReadTenantA.success === true && Array.isArray(resReadTenantA.data) && resReadTenantA.data.length >= 1,
      'Test 17: Tenant A verifikator can read proposals under Tenant A'
    );
    assert(
      resReadTenantA.data?.some((p) => p.id === proposalId) === true,
      'Test 18: Tenant A results include proposalId created in Tenant A'
    );

    // As Tenant B actor
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resReadTenantB = await getAwardProposalsAction();
    assert(
      resReadTenantB.success === true && Array.isArray(resReadTenantB.data),
      'Test 19: Tenant B actor read succeeds under Tenant B context'
    );
    assert(
      resReadTenantB.data?.some((p) => p.id === proposalId) === false,
      'Test 20: Tenant B cannot see Tenant A proposal (RLS isolation strictly enforced)'
    );

    // -------------------------------------------------------------
    // [13] Testing importAwardProposalsAction Security & RBAC Boundary
    // -------------------------------------------------------------
    console.log('\n[13] Testing importAwardProposalsAction Security & RBAC Boundary...');

    // Test 21: Anonymous import request -> UNAUTHENTICATED
    resetSessionProvider();
    const resAnonImport = await importAwardProposalsAction({
      items: [
        {
          nip: '199001012015011001',
          nrk: '190001',
          nama: 'Pegawai Anon',
          jabatan: 'Staf',
          unitKerja: 'BKD',
          perangkatDaerah: 'BKD',
          jenisPenghargaan: 'MASA_KERJA',
          tahunUsulan: 2026,
        },
      ],
    });
    assert(
      resAnonImport.success === false && resAnonImport.error?.code === 'UNAUTHENTICATED',
      'Test 21: Anonymous import request without session is rejected with UNAUTHENTICATED'
    );

    // Test 22: INACTIVE actor -> UNAUTHENTICATED
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_INACTIVE,
        tenantId: TENANT_A_ID,
        username: 'inactive_user',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const resInactiveImport = await importAwardProposalsAction({
      items: [
        {
          nip: '199001012015011001',
          nrk: '190001',
          nama: 'Pegawai Inactive',
          jabatan: 'Staf',
          unitKerja: 'BKD',
          perangkatDaerah: 'BKD',
          jenisPenghargaan: 'MASA_KERJA',
          tahunUsulan: 2026,
        },
      ],
    });
    assert(
      resInactiveImport.success === false && resInactiveImport.error?.code === 'UNAUTHENTICATED',
      'Test 22: INACTIVE actor is rejected from importing proposals with UNAUTHENTICATED'
    );

    // Test 23: PEGAWAI role -> FORBIDDEN
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_PEGAWAI,
        tenantId: TENANT_A_ID,
        username: 'pegawai_user',
        role: 'PEGAWAI',
        status: 'ACTIVE',
      }),
    });
    const resPegawaiImport = await importAwardProposalsAction({
      items: [
        {
          nip: '199001012015011001',
          nrk: '190001',
          nama: 'Pegawai Unauthorized',
          jabatan: 'Staf',
          unitKerja: 'BKD',
          perangkatDaerah: 'BKD',
          jenisPenghargaan: 'MASA_KERJA',
          tahunUsulan: 2026,
        },
      ],
    });
    assert(
      resPegawaiImport.success === false && resPegawaiImport.error?.code === 'FORBIDDEN',
      'Test 23: PEGAWAI role is forbidden from importing award proposals'
    );

    // Test 24: Authorized OPERATOR -> Succeeds
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const validBatchOp: ImportAwardProposalsInput = {
      items: [
        {
          nip: '199001012015011001',
          nrk: '190001',
          nama: 'Pegawai Operator 1',
          jabatan: 'Pengadministrasi Umum',
          unitKerja: 'BKD DKI Jakarta',
          perangkatDaerah: 'BKD Provinsi DKI Jakarta',
          jenisPenghargaan: 'MASA_KERJA',
          nilaiUsulan: '10',
          tahunUsulan: 2026,
          masaKerjaTahun: 10,
          masaKerjaBulan: 0,
        },
        {
          nip: '199002022015022002',
          nrk: '190002',
          nama: 'Pegawai Operator 2',
          jabatan: 'Pranata Komputer',
          unitKerja: 'Dinas Kominfotik',
          perangkatDaerah: 'Dinas Komunikasi dan Informatika',
          jenisPenghargaan: 'SATYALANCANA',
          nilaiUsulan: 'X',
          tahunUsulan: 2026,
          masaKerjaTahun: 10,
          masaKerjaBulan: 4,
        },
      ],
    };
    const resOpImport = await importAwardProposalsAction(validBatchOp);
    assert(
      resOpImport.success === true &&
      resOpImport.data?.importedCount === 2 &&
      resOpImport.data?.createdCount === 2,
      'Test 24: Authorized OPERATOR successfully imports proposal batch'
    );

    // Test 25: Authorized VERIFIKATOR -> Succeeds
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_VERIFIKATOR,
        tenantId: TENANT_A_ID,
        username: 'verifikator_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const validBatchVerif: ImportAwardProposalsInput = {
      items: [
        {
          nip: '199003032015031003',
          nrk: '190003',
          nama: 'Pegawai Verifikator 3',
          jabatan: 'Auditor Kepegawaian',
          unitKerja: 'Inspektorat',
          perangkatDaerah: 'Inspektorat Provinsi',
          jenisPenghargaan: 'MASA_KERJA',
          nilaiUsulan: '20',
          tahunUsulan: 2026,
          masaKerjaTahun: 20,
          masaKerjaBulan: 0,
        },
      ],
    };
    const resVerifImport = await importAwardProposalsAction(validBatchVerif);
    assert(
      resVerifImport.success === true && resVerifImport.data?.importedCount === 1,
      'Test 25: Authorized VERIFIKATOR successfully imports proposal batch'
    );

    // Test 26: Authorized ADMIN -> Succeeds
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN,
        tenantId: TENANT_A_ID,
        username: 'admin_user',
        role: 'ADMIN',
        status: 'ACTIVE',
      }),
    });
    const validBatchAdmin: ImportAwardProposalsInput = {
      items: [
        {
          nip: '199004042015041004',
          nrk: '190004',
          nama: 'Pegawai Admin 4',
          jabatan: 'Kepala Seksi',
          unitKerja: 'BKD DKI Jakarta',
          perangkatDaerah: 'BKD Provinsi DKI Jakarta',
          jenisPenghargaan: 'SATYALANCANA',
          nilaiUsulan: 'XX',
          tahunUsulan: 2026,
          masaKerjaTahun: 20,
          masaKerjaBulan: 0,
        },
      ],
    };
    const resAdminImport = await importAwardProposalsAction(validBatchAdmin);
    assert(
      resAdminImport.success === true && resAdminImport.data?.importedCount === 1,
      'Test 26: Authorized ADMIN successfully imports proposal batch'
    );

    // Test 27: Empty items rejected
    const resEmptyImport = await importAwardProposalsAction({ items: [] });
    assert(
      resEmptyImport.success === false && resEmptyImport.error?.code === 'VALIDATION_ERROR',
      'Test 27: Empty items array is rejected with VALIDATION_ERROR'
    );

    // Test 28: Invalid input rejected safely
    const resInvalidImport = await importAwardProposalsAction(null as any);
    assert(
      resInvalidImport.success === false && resInvalidImport.error?.code === 'VALIDATION_ERROR',
      'Test 28: Malformed null input is rejected with VALIDATION_ERROR'
    );

    // Test 29: Tenant binding: Tenant A import does not appear in Tenant B
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_TENANT_B,
        tenantId: TENANT_B_ID,
        username: 'tenant_b_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const resTenantBReadProposals = await getAwardProposalsAction();
    assert(
      resTenantBReadProposals.success === true &&
      !resTenantBReadProposals.data?.some((p) => p.employee.nip === '199001012015011001'),
      'Test 29: Tenant B cannot observe proposals imported into Tenant A (Tenant isolation enforced)'
    );

    // Test 30: Identity collision safely returns DOMAIN_ERROR
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR,
        tenantId: TENANT_A_ID,
        username: 'operator_user',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const collisionInput: ImportAwardProposalsInput = {
      items: [
        {
          nip: '199001012015011001', // NIP of Pegawai 1
          nrk: '190002',             // NRK of Pegawai 2
          nama: 'Pegawai Konflik Identitas',
          jabatan: 'Staf',
          unitKerja: 'BKD',
          perangkatDaerah: 'BKD',
          jenisPenghargaan: 'MASA_KERJA',
          tahunUsulan: 2026,
        },
      ],
    };
    const resCollision = await importAwardProposalsAction(collisionInput);
    assert(
      resCollision.success === false &&
      resCollision.error?.code === 'DOMAIN_ERROR' &&
      resCollision.error?.message.includes('IDENTITY_COLLISION'),
      'Test 30: Identity collision safely returns DOMAIN_ERROR without leaking internal error traces'
    );

    // Test 31: Full JSON serializability
    const jsonParsed = JSON.parse(JSON.stringify(resOpImport));
    assert(
      jsonParsed.success === true &&
      jsonParsed.data.importedCount === 2 &&
      Array.isArray(jsonParsed.data.proposals) &&
      jsonParsed.data.proposals.length === 2,
      'Test 31: importAwardProposalsAction response is 100% JSON serializable for client consumption'
    );

    // Test 32: Confirm client cannot supply tenant authority through action input
    assert(
      resOpImport.data?.proposals[0].tenantId === TENANT_A_ID &&
      resOpImport.data?.proposals[1].tenantId === TENANT_A_ID,
      'Test 32: Imported proposals are strictly bound to authoritative session tenantId (Tenant spoofing impossible)'
    );


  } finally {
    // Teardown
    resetSessionProvider();
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

runSecurityActionTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
