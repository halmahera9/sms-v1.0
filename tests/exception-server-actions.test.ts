import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, ExceptionStatus, Severity } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getExceptionsAction,
  updateExceptionStatusAction,
} from '../src/platform/actions/exception';
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

async function runExceptionServerActionsTests() {
  console.log('=====================================================');
  console.log(' EXCEPTION SERVER ACTIONS TEST SUITE                 ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_ADMIN_A_ID = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_OPERATOR_A_ID = 'a3333333-3333-7333-8333-333333333333';
  const ACTOR_VERIF_B_ID = 'b2222222-2222-7222-8222-222222222222';

  try {
    // 1. Setup tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Exc Tenant A', code: 'EXC_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Exc Tenant A', code: 'EXC_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Exc Tenant B', code: 'EXC_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Exc Tenant B', code: 'EXC_TENANT_B' },
    });

    // 2. Setup actors
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN_A_ID },
      create: {
        id: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_verif_a',
        email: 'exc_verif_a@sec.local',
        fullName: 'Exc Verifikator User A',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'VERIFIKATOR', fullName: 'Exc Verifikator User A', username: 'exc_verif_a' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A_ID },
      create: {
        id: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_operator_a',
        email: 'exc_operator_a@sec.local',
        fullName: 'Exc Operator User A',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'OPERATOR', fullName: 'Exc Operator User A', username: 'exc_operator_a' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_VERIF_B_ID },
      create: {
        id: ACTOR_VERIF_B_ID,
        tenantId: TENANT_B_ID,
        username: 'exc_verif_b',
        email: 'exc_verif_b@sec.local',
        fullName: 'Exc Verifikator User B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'VERIFIKATOR', fullName: 'Exc Verifikator User B', username: 'exc_verif_b' },
    });

    // 3. Setup workflow instances and exceptions
    const wfAId = crypto.randomUUID();
    const entityAId = crypto.randomUUID();
    await adminPrisma.workflowInstance.upsert({
      where: { id: wfAId },
      create: {
        id: wfAId,
        tenantId: TENANT_A_ID,
        entityType: 'AwardProposal',
        entityId: entityAId,
        currentState: 'NEEDS_VERIFICATION',
      },
      update: {},
    });

    const excA1Id = crypto.randomUUID();
    await adminPrisma.exceptionItem.create({
      data: {
        id: excA1Id,
        tenantId: TENANT_A_ID,
        workflowInstanceId: wfAId,
        ruleCode: 'DOC_COMPLETENESS_RULE',
        severity: Severity.CRITICAL,
        status: ExceptionStatus.OPEN,
        resolutionNotes: 'Berkas SK CPNS belum lengkap',
      },
    });

    const excA2Id = crypto.randomUUID();
    await adminPrisma.exceptionItem.create({
      data: {
        id: excA2Id,
        tenantId: TENANT_A_ID,
        workflowInstanceId: wfAId,
        ruleCode: 'DOC_FORMAT_RULE',
        severity: Severity.MEDIUM,
        status: ExceptionStatus.OPEN,
        resolutionNotes: 'Format file tidak standar',
      },
    });

    const wfBId = crypto.randomUUID();
    const entityBId = crypto.randomUUID();
    await adminPrisma.workflowInstance.upsert({
      where: { id: wfBId },
      create: {
        id: wfBId,
        tenantId: TENANT_B_ID,
        entityType: 'AwardProposal',
        entityId: entityBId,
        currentState: 'NEEDS_VERIFICATION',
      },
      update: {},
    });

    const excBId = crypto.randomUUID();
    await adminPrisma.exceptionItem.create({
      data: {
        id: excBId,
        tenantId: TENANT_B_ID,
        workflowInstanceId: wfBId,
        ruleCode: 'OCR_CONFIDENCE_RULE',
        severity: Severity.HIGH,
        status: ExceptionStatus.OPEN,
        resolutionNotes: 'Akurasi OCR rendah di Tenant B',
      },
    });

    // ---------------------------------------------------------------------------------
    // TEST 1: Unauthenticated Read => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const res1 = await getExceptionsAction();
    assert(
      !res1.success && res1.error?.code === 'UNAUTHENTICATED',
      'getExceptionsAction fails closed with UNAUTHENTICATED when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 2: Unauthenticated Mutation => Fail-Closed
    // ---------------------------------------------------------------------------------
    const res2 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
    });
    assert(
      !res2.success && res2.error?.code === 'UNAUTHENTICATED',
      'updateExceptionStatusAction fails closed with UNAUTHENTICATED when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 3: Inactive Identity => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_verif_a',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const res3 = await getExceptionsAction();
    assert(
      !res3.success && res3.error?.code === 'UNAUTHENTICATED',
      'getExceptionsAction fails closed when account is inactive'
    );

    // ---------------------------------------------------------------------------------
    // TEST 4: Malformed Identity UUID => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: 'non-uuid-actor-id',
        tenantId: TENANT_A_ID,
        username: 'exc_verif_a',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const res4 = await getExceptionsAction();
    assert(
      !res4.success && res4.error?.code === 'UNAUTHENTICATED',
      'getExceptionsAction fails closed when actor UUID is malformed'
    );

    // ---------------------------------------------------------------------------------
    // TEST 5: OPERATOR Role Cannot Mutate Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_operator_a',
        role: 'OPERATOR',
        status: 'ACTIVE',
      }),
    });
    const res5 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
    });
    assert(
      !res5.success && res5.error?.code === 'FORBIDDEN',
      'updateExceptionStatusAction rejects OPERATOR / unprivileged role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 6: Authenticated Exception Query (Admin A) => Success & Field Projection
    // ---------------------------------------------------------------------------------
    const sessionAdminA: AuthenticatedActorContext = {
      actorId: ACTOR_ADMIN_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_verif_a',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionAdminA,
    });

    const res6 = await getExceptionsAction();
    assert(
      res6.success === true && Array.isArray(res6.data) && res6.data.length >= 2,
      'getExceptionsAction returns exception items for authenticated tenant'
    );

    const firstExc = res6.data![0];
    assert(
      typeof firstExc.id === 'string' &&
      typeof firstExc.ruleCode === 'string' &&
      (firstExc.domain === 'EMPLOYEE' || firstExc.domain === 'STUDENT') &&
      typeof firstExc.entityType === 'string' &&
      typeof firstExc.entityId === 'string' &&
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(firstExc.severity) &&
      ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'].includes(firstExc.status) &&
      typeof firstExc.message === 'string',
      'ExceptionItemRecord DTO projection contains all required UI-bound fields'
    );

    // ---------------------------------------------------------------------------------
    // TEST 7: Limit Validation
    // ---------------------------------------------------------------------------------
    const res7Neg = await getExceptionsAction({ limit: -1 });
    const res7Zero = await getExceptionsAction({ limit: 0 });
    const res7Over = await getExceptionsAction({ limit: 500 });
    const res7Decimal = await getExceptionsAction({ limit: 12.3 as any });

    assert(
      !res7Neg.success && res7Neg.error?.code === 'VALIDATION_ERROR' &&
      !res7Zero.success && res7Zero.error?.code === 'VALIDATION_ERROR' &&
      !res7Over.success && res7Over.error?.code === 'VALIDATION_ERROR' &&
      !res7Decimal.success && res7Decimal.error?.code === 'VALIDATION_ERROR',
      'getExceptionsAction rejects out-of-bounds limit filter parameters'
    );

    // ---------------------------------------------------------------------------------
    // TEST 8: Severity & Status Filters
    // ---------------------------------------------------------------------------------
    const res8Severity = await getExceptionsAction({ severity: Severity.CRITICAL });
    assert(
      res8Severity.success === true &&
      res8Severity.data!.every((item) => item.severity === Severity.CRITICAL),
      'getExceptionsAction filters accurately by Severity'
    );

    const res8Status = await getExceptionsAction({ status: ExceptionStatus.OPEN });
    assert(
      res8Status.success === true &&
      res8Status.data!.every((item) => item.status === ExceptionStatus.OPEN),
      'getExceptionsAction filters accurately by Status'
    );

    // ---------------------------------------------------------------------------------
    // TEST 9: Cross-Tenant Read Isolation (RLS)
    // ---------------------------------------------------------------------------------
    const sessionVerifB: AuthenticatedActorContext = {
      actorId: ACTOR_VERIF_B_ID,
      tenantId: TENANT_B_ID,
      username: 'exc_verif_b',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionVerifB,
    });

    const res9 = await getExceptionsAction();
    assert(
      res9.success === true &&
      res9.data!.every((item) => item.id !== excA1Id && item.id !== excA2Id),
      'Tenant B cannot observe any exceptions belonging to Tenant A'
    );

    // ---------------------------------------------------------------------------------
    // TEST 10: State Transition: OPEN -> IN_REVIEW
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionAdminA,
    });

    const res10 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
      resolutionNote: 'Sedang ditinjau oleh tim BKD',
    });

    assert(
      res10.success === true &&
      res10.data?.status === ExceptionStatus.IN_REVIEW &&
      res10.data.resolvedAt === null &&
      res10.data.resolutionNotes === 'Sedang ditinjau oleh tim BKD',
      'Status transition OPEN -> IN_REVIEW succeeds with notes and null resolution timestamp'
    );

    // ---------------------------------------------------------------------------------
    // TEST 11: State Transition: IN_REVIEW -> RESOLVED (Atomic Audit & Resolved Fields)
    // ---------------------------------------------------------------------------------
    const res11 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.RESOLVED,
      resolutionNote: 'SK CPNS telah disusulkan dan terverifikasi',
    });

    assert(
      res11.success === true &&
      res11.data?.status === ExceptionStatus.RESOLVED &&
      typeof res11.data.resolvedAt === 'string' &&
      res11.data.resolvedBy === 'Exc Verifikator User A',
      'Status transition IN_REVIEW -> RESOLVED populates resolvedBy and resolvedAt',
      JSON.stringify(res11)
    );

    // Verify audit event side-effect in database
    const auditRecord = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityId: excA1Id,
        action: 'RESOLVE_EXCEPTION',
      },
      orderBy: { createdAt: 'desc' },
    });

    assert(
      auditRecord !== null &&
      auditRecord.action === 'RESOLVE_EXCEPTION' &&
      auditRecord.actorUserId === ACTOR_ADMIN_A_ID,
      'Atomic audit event is recorded for RESOLVE_EXCEPTION transition'
    );

    // ---------------------------------------------------------------------------------
    // TEST 12: State Transition: OPEN -> DISMISSED
    // ---------------------------------------------------------------------------------
    const res12 = await updateExceptionStatusAction({
      exceptionId: excA2Id,
      status: ExceptionStatus.DISMISSED,
      resolutionNote: 'Pengecualian dikesampingkan dengan persetujuan kepala dinas',
    });

    assert(
      res12.success === true &&
      res12.data?.status === ExceptionStatus.DISMISSED &&
      typeof res12.data.resolvedAt === 'string',
      'Status transition OPEN -> DISMISSED succeeds'
    );

    // ---------------------------------------------------------------------------------
    // TEST 13: Invalid State Transitions Rejected
    // ---------------------------------------------------------------------------------
    // Cannot transition from terminal RESOLVED to OPEN
    const res13ResolvedToOpen = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.OPEN,
    });
    // Cannot transition from terminal DISMISSED to IN_REVIEW
    const res13DismissedToReview = await updateExceptionStatusAction({
      exceptionId: excA2Id,
      status: ExceptionStatus.IN_REVIEW,
    });

    assert(
      !res13ResolvedToOpen.success && res13ResolvedToOpen.error?.code === 'VALIDATION_ERROR' &&
      !res13DismissedToReview.success && res13DismissedToReview.error?.code === 'VALIDATION_ERROR',
      'Invalid lifecycle transitions from terminal states are rejected with VALIDATION_ERROR'
    );

    // ---------------------------------------------------------------------------------
    // TEST 14: Cross-Tenant Mutation Rejection (RLS Enforcement)
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifB,
    });

    const res14 = await updateExceptionStatusAction({
      exceptionId: excA1Id, // Tenant A exception
      status: ExceptionStatus.OPEN,
    });

    assert(
      !res14.success && (res14.error?.code === 'VALIDATION_ERROR' || res14.error?.code === 'FORBIDDEN'),
      'Tenant B cannot mutate an exception belonging to Tenant A'
    );

    console.log(`\n=====================================================`);
    console.log(` RESULT: ${passCount}/${testCount} Exception Server Action tests PASSED `);
    console.log(`=====================================================\n`);
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runExceptionServerActionsTests().catch((err) => {
  console.error('Fatal Exception Server Actions Test Runner Error:', err);
  process.exit(1);
});
