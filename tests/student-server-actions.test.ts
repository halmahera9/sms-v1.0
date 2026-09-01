import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, StudentStatus, UserRole, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getStudentsAction,
  saveStudentAction,
  STUDENT_RBAC_POLICY,
  SaveStudentDTO,
} from '../src/platform/actions/student';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runStudentServerActionsTests() {
  console.log('=====================================================');
  console.log(' STUDENT SERVER ACTIONS TEST SUITE                   ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '22222222-2222-7222-8222-222222222222';
  const TENANT_B_ID = '33333333-3333-7333-8333-333333333333';

  const ACTOR_OPERATOR_A_ID = 'c1111111-1111-7111-8111-111111111111';
  const ACTOR_VERIFIKATOR_A_ID = 'c2222222-2222-7222-8222-222222222222';
  const ACTOR_INACTIVE_A_ID = 'c5555555-5555-7555-8555-555555555555';
  const ACTOR_OPERATOR_B_ID = 'd1111111-1111-7111-8111-111111111111';

  const STUDENT_A1_ID = 'e1111111-1111-7111-8111-111111111111';
  const STUDENT_A2_ID = 'e2222222-2222-7222-8222-222222222222';
  const STUDENT_B1_ID = 'f1111111-1111-7111-8111-111111111111';

  try {
    // 1. Setup tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Student SA Tenant A', code: 'STD_SA_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Student SA Tenant A', code: 'STD_SA_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Student SA Tenant B', code: 'STD_SA_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Student SA Tenant B', code: 'STD_SA_TENANT_B' },
    });

    // 2. Setup user actors (using DB-valid UserRoles: OPERATOR, VERIFIKATOR)
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A_ID },
      create: {
        id: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'std_sa_op_a',
        email: 'std_sa_op_a@test.local',
        fullName: 'Student Operator User A',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.OPERATOR, fullName: 'Student Operator User A' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_VERIFIKATOR_A_ID },
      create: {
        id: ACTOR_VERIFIKATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'std_sa_verif_a',
        email: 'std_sa_verif_a@test.local',
        fullName: 'Student Verifikator User A',
        role: UserRole.VERIFIKATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.VERIFIKATOR, fullName: 'Student Verifikator User A' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE_A_ID },
      create: {
        id: ACTOR_INACTIVE_A_ID,
        tenantId: TENANT_A_ID,
        username: 'std_sa_inact_a',
        email: 'std_sa_inact_a@test.local',
        fullName: 'Student Inactive User A',
        role: UserRole.OPERATOR,
        status: UserStatus.INACTIVE,
      },
      update: { status: UserStatus.INACTIVE, role: UserRole.OPERATOR, fullName: 'Student Inactive User A' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_B_ID },
      create: {
        id: ACTOR_OPERATOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'std_sa_op_b',
        email: 'std_sa_op_b@test.local',
        fullName: 'Student Operator User B',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
      },
      update: { status: UserStatus.ACTIVE, role: UserRole.OPERATOR, fullName: 'Student Operator User B' },
    });

    // 3. Setup initial students
    await adminPrisma.student.upsert({
      where: { id: STUDENT_A1_ID },
      create: {
        id: STUDENT_A1_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111111',
        nis: '21221101',
        fullName: 'Ahmad Albar',
        className: 'X IPA 1',
        jurusan: 'IPA',
        status: StudentStatus.ACTIVE,
      },
      update: { fullName: 'Ahmad Albar', className: 'X IPA 1', status: StudentStatus.ACTIVE },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_A2_ID },
      create: {
        id: STUDENT_A2_ID,
        tenantId: TENANT_A_ID,
        nisn: '0051111112',
        nis: '21221102',
        fullName: 'Bambang Sudibyo',
        className: 'X IPS 1',
        jurusan: 'IPS',
        status: StudentStatus.ACTIVE,
      },
      update: { fullName: 'Bambang Sudibyo', className: 'X IPS 1', status: StudentStatus.ACTIVE },
    });

    await adminPrisma.student.upsert({
      where: { id: STUDENT_B1_ID },
      create: {
        id: STUDENT_B1_ID,
        tenantId: TENANT_B_ID,
        nisn: '0052222221',
        nis: '21222201',
        fullName: 'Citra Permata',
        className: 'XI IPA 1',
        jurusan: 'IPA',
        status: StudentStatus.ACTIVE,
      },
      update: { fullName: 'Citra Permata', className: 'XI IPA 1', status: StudentStatus.ACTIVE },
    });

    // =========================================================================
    // TEST 1 — Unauthenticated Read
    // =========================================================================
    console.log('[1] Testing Unauthenticated Read...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return null;
      },
    });

    const unauthReadRes = await getStudentsAction();
    assert(
      !unauthReadRes.success && unauthReadRes.error?.code === 'UNAUTHENTICATED',
      'TEST 1: getStudentsAction fails-closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 2 — Unauthenticated Write
    // =========================================================================
    console.log('\n[2] Testing Unauthenticated Write...');
    const unauthWriteRes = await saveStudentAction({
      nisn: '0059999991',
      nis: '21229991',
      fullName: 'Unauth Student',
      className: 'X IPA 1',
    });
    assert(
      !unauthWriteRes.success && unauthWriteRes.error?.code === 'UNAUTHENTICATED',
      'TEST 2: saveStudentAction fails-closed with UNAUTHENTICATED when session is null'
    );

    // =========================================================================
    // TEST 3 — Inactive Account Rejection
    // =========================================================================
    console.log('\n[3] Testing Inactive Account Rejection...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_INACTIVE_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_inact_a',
          role: UserRole.OPERATOR,
          status: UserStatus.INACTIVE,
        };
      },
    });

    const inactiveReadRes = await getStudentsAction();
    assert(
      !inactiveReadRes.success && inactiveReadRes.error?.code === 'UNAUTHENTICATED',
      'TEST 3: Inactive actor session is rejected with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 4 — Malformed Authenticated UUID
    // =========================================================================
    console.log('\n[4] Testing Malformed Authenticated UUID...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: 'not-a-valid-uuid',
          tenantId: TENANT_A_ID,
          username: 'malformed_actor',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const malformedReadRes = await getStudentsAction();
    assert(
      !malformedReadRes.success && malformedReadRes.error?.code === 'UNAUTHENTICATED',
      'TEST 4: Malformed actor UUID fails session validation with UNAUTHENTICATED'
    );

    // =========================================================================
    // TEST 5 — Authorized Read (Operator & Verifikator)
    // =========================================================================
    console.log('\n[5] Testing Authorized Read...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const opReadRes = await getStudentsAction();
    assert(
      opReadRes.success && Array.isArray(opReadRes.data) && opReadRes.data.length >= 2,
      'TEST 5A: Operator can read student records for their tenant'
    );

    // Verifikator Read
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_VERIFIKATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_verif_a',
          role: UserRole.VERIFIKATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });
    const verifReadRes = await getStudentsAction();
    assert(
      verifReadRes.success && Array.isArray(verifReadRes.data),
      'TEST 5B: Verifikator can read student records for their tenant'
    );

    // =========================================================================
    // TEST 6 — Authorized Write (Operator)
    // =========================================================================
    console.log('\n[6] Testing Authorized Write...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const newStudentDto: SaveStudentDTO = {
      nisn: '0051111119',
      nis: '21221109',
      fullName: 'Dewi Sartika',
      className: 'X IPA 1',
      jurusan: 'IPA',
      status: StudentStatus.ACTIVE,
    };

    const writeRes = await saveStudentAction(newStudentDto);
    assert(
      writeRes.success && writeRes.data !== undefined && writeRes.data.fullName === 'Dewi Sartika',
      'TEST 6A: Operator successfully creates student record'
    );
    assert(
      writeRes.data?.tenantId === TENANT_A_ID,
      'TEST 6B: Created student record is attached to authenticated Tenant A'
    );

    // Update student
    const updateDto: SaveStudentDTO = {
      id: writeRes.data!.id,
      nisn: '0051111119',
      nis: '21221109',
      fullName: 'Dewi Sartika Updated',
      className: 'X IPA 2',
      jurusan: 'IPA',
      status: StudentStatus.ACTIVE,
    };

    const updateRes = await saveStudentAction(updateDto);
    assert(
      updateRes.success &&
        updateRes.data?.fullName === 'Dewi Sartika Updated' &&
        updateRes.data?.className === 'X IPA 2',
      'TEST 6C: Operator successfully updates existing student record'
    );

    // =========================================================================
    // TEST 7 — Unauthorized Read (Pegawai)
    // =========================================================================
    console.log('\n[7] Testing Unauthorized Read (Pegawai)...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_peg_a',
          role: UserRole.PEGAWAI,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const pegawaiReadRes = await getStudentsAction();
    assert(
      !pegawaiReadRes.success && pegawaiReadRes.error?.code === 'FORBIDDEN',
      'TEST 7: Pegawai role is forbidden from reading student master data'
    );

    // =========================================================================
    // TEST 8 — Unauthorized Write (Verifikator & Pegawai)
    // =========================================================================
    console.log('\n[8] Testing Unauthorized Write (Verifikator, Pegawai)...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_VERIFIKATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_verif_a',
          role: UserRole.VERIFIKATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const verifWriteRes = await saveStudentAction(newStudentDto);
    assert(
      !verifWriteRes.success && verifWriteRes.error?.code === 'FORBIDDEN',
      'TEST 8A: Verifikator role is forbidden from writing student master records'
    );

    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_peg_a',
          role: UserRole.PEGAWAI,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const pegWriteRes = await saveStudentAction(newStudentDto);
    assert(
      !pegWriteRes.success && pegWriteRes.error?.code === 'FORBIDDEN',
      'TEST 8B: Pegawai role is forbidden from writing student records'
    );

    // =========================================================================
    // TEST 9 — Tenant Isolation on Read
    // =========================================================================
    console.log('\n[9] Testing Tenant Isolation on Read...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const tenantAStudentsRes = await getStudentsAction();
    const hasStudentA1 = tenantAStudentsRes.data?.some((s) => s.id === STUDENT_A1_ID);
    const hasStudentB1InA = tenantAStudentsRes.data?.some((s) => s.id === STUDENT_B1_ID);

    assert(
      hasStudentA1 === true && hasStudentB1InA === false,
      'TEST 9A: Actor in Tenant A can only read Tenant A students (Tenant B is isolated)'
    );

    // Read as Tenant B
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_B_ID,
          tenantId: TENANT_B_ID,
          username: 'std_sa_op_b',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    const tenantBStudentsRes = await getStudentsAction();
    const hasStudentB1 = tenantBStudentsRes.data?.some((s) => s.id === STUDENT_B1_ID);
    const hasStudentA1InB = tenantBStudentsRes.data?.some((s) => s.id === STUDENT_A1_ID);

    assert(
      hasStudentB1 === true && hasStudentA1InB === false,
      'TEST 9B: Actor in Tenant B can only read Tenant B students (Tenant A is isolated)'
    );

    // =========================================================================
    // TEST 10 — Tenant Isolation on Write
    // =========================================================================
    console.log('\n[10] Testing Tenant Isolation on Write...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_B_ID,
          tenantId: TENANT_B_ID,
          username: 'std_sa_op_b',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    // Tenant B actor attempts to mutate Tenant A student ID
    await saveStudentAction({
      id: STUDENT_A1_ID, // Student A1 belongs to Tenant A!
      nisn: '0051111111',
      nis: '21221101',
      fullName: 'Ahmad Albar HACKED BY B',
      className: 'X IPA 1',
    });

    // Verify Tenant A student in DB remains unchanged:
    const studentA1Direct = await adminPrisma.student.findUnique({
      where: { id: STUDENT_A1_ID },
    });

    assert(
      studentA1Direct?.tenantId === TENANT_A_ID && studentA1Direct?.fullName === 'Ahmad Albar',
      'TEST 10: Actor in Tenant B cannot modify student belonging to Tenant A'
    );

    // =========================================================================
    // TEST 11 — Validation Errors
    // =========================================================================
    console.log('\n[11] Testing Validation Errors...');
    setSessionProvider({
      async getSession(): Promise<AuthenticatedActorContext | null> {
        return {
          actorId: ACTOR_OPERATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'std_sa_op_a',
          role: UserRole.OPERATOR,
          status: UserStatus.ACTIVE,
        };
      },
    });

    // 11A. Invalid NISN (not 10 digits)
    const invalidNisnRes = await saveStudentAction({
      nisn: '12345',
      nis: '21220001',
      fullName: 'Test Student',
      className: 'X IPA 1',
    });
    assert(
      !invalidNisnRes.success && invalidNisnRes.error?.code === 'VALIDATION_ERROR',
      'TEST 11A: Short NISN triggers VALIDATION_ERROR'
    );

    // 11B. Empty Full Name
    const emptyNameRes = await saveStudentAction({
      nisn: '0053333333',
      nis: '21220002',
      fullName: '   ',
      className: 'X IPA 1',
    });
    assert(
      !emptyNameRes.success && emptyNameRes.error?.code === 'VALIDATION_ERROR',
      'TEST 11B: Empty student name triggers VALIDATION_ERROR'
    );

    // 11C. Invalid UUID format
    const invalidUuidRes = await saveStudentAction({
      id: 'not-valid-uuid',
      nisn: '0053333334',
      nis: '21220003',
      fullName: 'Test UUID Student',
      className: 'X IPA 1',
    });
    assert(
      !invalidUuidRes.success && invalidUuidRes.error?.code === 'VALIDATION_ERROR',
      'TEST 11C: Malformed student UUID triggers VALIDATION_ERROR'
    );

    // =========================================================================
    // TEST 12 — Client-supplied tenantId is ignored
    // =========================================================================
    console.log('\n[12] Testing Client-Supplied tenantId Ignored...');
    const fakeTenantStudentRes = await saveStudentAction({
      // @ts-expect-error deliberately injecting tenantId to test security rejection/override
      tenantId: '00000000-0000-0000-0000-000000000000',
      nisn: '0054444444',
      nis: '21224444',
      fullName: 'Tenant Injected Student',
      className: 'X IPA 1',
    });

    assert(
      fakeTenantStudentRes.success && fakeTenantStudentRes.data?.tenantId === TENANT_A_ID,
      'TEST 12: Client cannot forge tenantId; saved record is pinned to authenticated Tenant A'
    );

    // =========================================================================
    // TEST 13 — JSON Serializability
    // =========================================================================
    console.log('\n[13] Testing DTO JSON Serializability...');
    const serialized = JSON.stringify(opReadRes.data);
    const parsed = JSON.parse(serialized);
    assert(
      Array.isArray(parsed) &&
        typeof parsed[0].createdAt === 'string' &&
        typeof parsed[0].updatedAt === 'string',
      'TEST 13: Returned StudentRecordDTO array is completely JSON serializable'
    );

    // =========================================================================
    // TEST 14 — Filter Query Functionality
    // =========================================================================
    console.log('\n[14] Testing Filter Query Functionality...');
    const searchFilterRes = await getStudentsAction({ search: 'Albar' });
    assert(
      searchFilterRes.success &&
        searchFilterRes.data?.length === 1 &&
        searchFilterRes.data[0].fullName === 'Ahmad Albar',
      'TEST 14A: Search filter finds student by name substring'
    );

    const classFilterRes = await getStudentsAction({ className: 'X IPS 1' });
    assert(
      classFilterRes.success &&
        classFilterRes.data?.every((s) => s.className === 'X IPS 1') === true,
      'TEST 14B: Class filter returns only students matching className'
    );

    console.log('\n=====================================================');
    console.log(` RESULT: All ${passCount}/${testCount} Student Server Action tests PASSED `);
    console.log('=====================================================\n');
  } finally {
    resetSessionProvider();
    // Cleanup fixtures
    try {
      await adminPrisma.student.deleteMany({
        where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
      });
    } catch (err) {
      console.warn('Cleanup error:', err);
    }
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runStudentServerActionsTests().catch((err) => {
  console.error('Student server actions test runner failed:', err);
  process.exit(1);
});
