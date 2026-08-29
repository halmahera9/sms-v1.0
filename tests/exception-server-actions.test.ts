import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, ExceptionStatus, Severity, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getExceptionsAction,
  updateExceptionStatusAction,
  createExceptionAction,
} from '../src/platform/actions/exception';
import {
  RULE_MESSAGE_CATALOG,
  EMPLOYEE_ENTITY_TYPES,
  STUDENT_ENTITY_TYPES,
} from '../src/platform/repositories/exception';
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
  const ACTOR_SUPERADMIN_A_ID = 'a4444444-4444-7444-8444-444444444444';
  const ACTOR_ADMINTENANT_A_ID = 'a5555555-5555-7555-8555-555555555555';
  const ACTOR_AUDITOR_A_ID = 'a6666666-6666-7666-8666-666666666666';
  const ACTOR_PEGAWAI_A_ID = 'a7777777-7777-7777-8777-777777777777';

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

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_SUPERADMIN_A_ID },
      create: {
        id: ACTOR_SUPERADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_superadmin_a',
        email: 'exc_superadmin_a@sec.local',
        fullName: 'Exc Superadmin User A',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'ADMIN_TENANT', fullName: 'Exc Superadmin User A', username: 'exc_superadmin_a' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMINTENANT_A_ID },
      create: {
        id: ACTOR_ADMINTENANT_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_admintenant_a',
        email: 'exc_admintenant_a@sec.local',
        fullName: 'Exc Admin Tenant User A',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'ADMIN_TENANT', fullName: 'Exc Admin Tenant User A', username: 'exc_admintenant_a' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_AUDITOR_A_ID },
      create: {
        id: ACTOR_AUDITOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_auditor_a',
        email: 'exc_auditor_a@sec.local',
        fullName: 'Exc Auditor User A',
        role: 'AUDITOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'AUDITOR', fullName: 'Exc Auditor User A', username: 'exc_auditor_a' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_PEGAWAI_A_ID },
      create: {
        id: ACTOR_PEGAWAI_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_pegawai_a',
        email: 'exc_pegawai_a@sec.local',
        fullName: 'Exc Pegawai User A',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE', role: 'OPERATOR', fullName: 'Exc Pegawai User A', username: 'exc_pegawai_a' },
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
        resolutionNotes: 'Catatan awal sebelum verifikasi',
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
        resolutionNotes: 'Catatan format file',
      },
    });

    const wfStudentId = crypto.randomUUID();
    const studentEntityId = crypto.randomUUID();
    await adminPrisma.workflowInstance.upsert({
      where: { id: wfStudentId },
      create: {
        id: wfStudentId,
        tenantId: TENANT_A_ID,
        entityType: 'Student',
        entityId: studentEntityId,
        currentState: 'NEEDS_VERIFICATION',
      },
      update: {},
    });

    const excStudentId = crypto.randomUUID();
    await adminPrisma.exceptionItem.create({
      data: {
        id: excStudentId,
        tenantId: TENANT_A_ID,
        workflowInstanceId: wfStudentId,
        ruleCode: 'STUDENT_NISN_FORMAT_RULE',
        severity: Severity.HIGH,
        status: ExceptionStatus.OPEN,
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
        role: UserRole.VERIFIKATOR,
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
        role: UserRole.VERIFIKATOR,
        status: 'ACTIVE',
      }),
    });
    const res4 = await getExceptionsAction();
    assert(
      !res4.success && res4.error?.code === 'UNAUTHENTICATED',
      'getExceptionsAction fails closed when actor UUID is malformed'
    );

    // ---------------------------------------------------------------------------------
    // TEST 5: RBAC - OPERATOR Cannot Read Exception Data => FORBIDDEN
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_operator_a',
        role: UserRole.OPERATOR,
        status: 'ACTIVE',
      }),
    });
    const res5Read = await getExceptionsAction();
    assert(
      !res5Read.success && res5Read.error?.code === 'FORBIDDEN',
      'getExceptionsAction rejects OPERATOR role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 6: RBAC - OPERATOR Cannot Mutate Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    const res6Mutate = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
    });
    assert(
      !res6Mutate.success && res6Mutate.error?.code === 'FORBIDDEN',
      'updateExceptionStatusAction rejects OPERATOR role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 7: RBAC - PEGAWAI Cannot Read Exception Data => FORBIDDEN
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_pegawai_a',
        role: UserRole.PEGAWAI,
        status: 'ACTIVE',
      }),
    });
    const res7Pegawai = await getExceptionsAction();
    assert(
      !res7Pegawai.success && res7Pegawai.error?.code === 'FORBIDDEN',
      'getExceptionsAction rejects PEGAWAI role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 8: RBAC - AUDITOR Can Read Exception Data => SUCCESS
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_OPERATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'exc_auditor_a',
        role: 'AUDITOR' as any,
        status: 'ACTIVE',
      }),
    });
    const res8AuditorRead = await getExceptionsAction();
    assert(
      res8AuditorRead.success === true && Array.isArray(res8AuditorRead.data),
      'getExceptionsAction permits AUDITOR role with read access'
    );

    // ---------------------------------------------------------------------------------
    // TEST 9: RBAC - AUDITOR Cannot Mutate Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    const res9AuditorMutate = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
    });
    assert(
      !res9AuditorMutate.success && res9AuditorMutate.error?.code === 'FORBIDDEN',
      'updateExceptionStatusAction rejects AUDITOR mutation with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 10: Authenticated Exception Query (VERIFIKATOR) => Field Projection & Message Source
    // ---------------------------------------------------------------------------------
    const sessionVerifA: AuthenticatedActorContext = {
      actorId: ACTOR_ADMIN_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_verif_a',
      role: UserRole.VERIFIKATOR,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionVerifA,
    });

    const res10 = await getExceptionsAction();
    assert(
      res10.success === true && Array.isArray(res10.data) && res10.data.length >= 3,
      'getExceptionsAction returns exception items for authenticated tenant'
    );

    const docCompletenessExc = res10.data!.find((e) => e.ruleCode === 'DOC_COMPLETENESS_RULE')!;
    assert(
      docCompletenessExc.message === RULE_MESSAGE_CATALOG['DOC_COMPLETENESS_RULE'] &&
      docCompletenessExc.resolutionNotes === 'Catatan awal sebelum verifikasi',
      'Exception message derives from RULE_MESSAGE_CATALOG and does NOT overwrite resolutionNotes'
    );

    // ---------------------------------------------------------------------------------
    // TEST 11: Domain Mapping Determinism
    // ---------------------------------------------------------------------------------
    const awardExc = res10.data!.find((e) => e.entityType === 'AwardProposal')!;
    const studentExc = res10.data!.find((e) => e.entityType === 'Student')!;

    assert(
      awardExc.domain === 'EMPLOYEE' && studentExc.domain === 'STUDENT',
      'Domain mapping correctly maps AwardProposal to EMPLOYEE and Student to STUDENT'
    );

    // ---------------------------------------------------------------------------------
    // TEST 12: Limit Validation
    // ---------------------------------------------------------------------------------
    const res12Neg = await getExceptionsAction({ limit: -1 });
    const res12Zero = await getExceptionsAction({ limit: 0 });
    const res12Over = await getExceptionsAction({ limit: 500 });
    const res12Decimal = await getExceptionsAction({ limit: 12.3 as any });

    assert(
      !res12Neg.success && res12Neg.error?.code === 'VALIDATION_ERROR' &&
      !res12Zero.success && res12Zero.error?.code === 'VALIDATION_ERROR' &&
      !res12Over.success && res12Over.error?.code === 'VALIDATION_ERROR' &&
      !res12Decimal.success && res12Decimal.error?.code === 'VALIDATION_ERROR',
      'getExceptionsAction rejects out-of-bounds limit filter parameters'
    );

    // ---------------------------------------------------------------------------------
    // TEST 13: Severity & Status Filters
    // ---------------------------------------------------------------------------------
    const res13Severity = await getExceptionsAction({ severity: Severity.CRITICAL });
    assert(
      res13Severity.success === true &&
      res13Severity.data!.every((item) => item.severity === Severity.CRITICAL),
      'getExceptionsAction filters accurately by Severity'
    );

    const res13Status = await getExceptionsAction({ status: ExceptionStatus.OPEN });
    assert(
      res13Status.success === true &&
      res13Status.data!.every((item) => item.status === ExceptionStatus.OPEN),
      'getExceptionsAction filters accurately by Status'
    );

    // ---------------------------------------------------------------------------------
    // TEST 14: Cross-Tenant Read Isolation (RLS)
    // ---------------------------------------------------------------------------------
    const sessionVerifB: AuthenticatedActorContext = {
      actorId: ACTOR_VERIF_B_ID,
      tenantId: TENANT_B_ID,
      username: 'exc_verif_b',
      role: UserRole.VERIFIKATOR,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionVerifB,
    });

    const res14 = await getExceptionsAction();
    assert(
      res14.success === true &&
      res14.data!.every((item) => item.id !== excA1Id && item.id !== excA2Id),
      'Tenant B cannot observe any exceptions belonging to Tenant A'
    );

    // ---------------------------------------------------------------------------------
    // TEST 15: State Transition: OPEN -> IN_REVIEW (Message Integrity Preserved)
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifA,
    });

    const res15 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.IN_REVIEW,
      resolutionNote: 'Sedang ditinjau oleh tim BKD',
    });

    assert(
      res15.success === true &&
      res15.data?.status === ExceptionStatus.IN_REVIEW &&
      res15.data.resolvedAt === null &&
      res15.data.message === RULE_MESSAGE_CATALOG['DOC_COMPLETENESS_RULE'] &&
      res15.data.resolutionNotes === 'Sedang ditinjau oleh tim BKD',
      'Status transition OPEN -> IN_REVIEW preserves original rule catalog message and stores resolutionNotes'
    );

    // ---------------------------------------------------------------------------------
    // TEST 16: State Transition: IN_REVIEW -> RESOLVED (Message Integrity & Atomic Audit)
    // ---------------------------------------------------------------------------------
    const res16 = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.RESOLVED,
      resolutionNote: 'SK CPNS telah disusulkan dan terverifikasi',
    });

    assert(
      res16.success === true &&
      res16.data?.status === ExceptionStatus.RESOLVED &&
      res16.data.message === RULE_MESSAGE_CATALOG['DOC_COMPLETENESS_RULE'] &&
      res16.data.resolutionNotes === 'SK CPNS telah disusulkan dan terverifikasi' &&
      typeof res16.data.resolvedAt === 'string' &&
      res16.data.resolvedBy === 'Exc Verifikator User A',
      'Resolved exception preserves original rule catalog message while independently storing resolutionNotes'
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
    // TEST 17: State Transition: OPEN -> DISMISSED
    // ---------------------------------------------------------------------------------
    const res17 = await updateExceptionStatusAction({
      exceptionId: excA2Id,
      status: ExceptionStatus.DISMISSED,
      resolutionNote: 'Pengecualian dikesampingkan dengan persetujuan kepala dinas',
    });

    assert(
      res17.success === true &&
      res17.data?.status === ExceptionStatus.DISMISSED &&
      res17.data.message === RULE_MESSAGE_CATALOG['DOC_FORMAT_RULE'] &&
      typeof res17.data.resolvedAt === 'string',
      'Status transition OPEN -> DISMISSED succeeds with rule message integrity'
    );

    // ---------------------------------------------------------------------------------
    // TEST 18: Invalid State Transitions Rejected
    // ---------------------------------------------------------------------------------
    // Cannot transition from terminal RESOLVED to OPEN
    const res18ResolvedToOpen = await updateExceptionStatusAction({
      exceptionId: excA1Id,
      status: ExceptionStatus.OPEN,
    });
    // Cannot transition from terminal DISMISSED to IN_REVIEW
    const res18DismissedToReview = await updateExceptionStatusAction({
      exceptionId: excA2Id,
      status: ExceptionStatus.IN_REVIEW,
    });

    assert(
      !res18ResolvedToOpen.success && res18ResolvedToOpen.error?.code === 'VALIDATION_ERROR' &&
      !res18DismissedToReview.success && res18DismissedToReview.error?.code === 'VALIDATION_ERROR',
      'Invalid lifecycle transitions from terminal states are rejected with VALIDATION_ERROR'
    );

    // ---------------------------------------------------------------------------------
    // TEST 19: Cross-Tenant Mutation Rejection (RLS Enforcement)
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifB,
    });

    const res19 = await updateExceptionStatusAction({
      exceptionId: excA1Id, // Tenant A exception
      status: ExceptionStatus.OPEN,
    });

    assert(
      !res19.success && (res19.error?.code === 'VALIDATION_ERROR' || res19.error?.code === 'FORBIDDEN'),
      'Tenant B cannot mutate an exception belonging to Tenant A'
    );

    // ---------------------------------------------------------------------------------
    // TEST 20: Unauthenticated createExceptionAction => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const res20 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });
    assert(
      !res20.success && res20.error?.code === 'UNAUTHENTICATED',
      'createExceptionAction fails closed with UNAUTHENTICATED when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 21: Authorized ADMIN Access => SUCCESS
    // ---------------------------------------------------------------------------------
    const sessionSuperAdminA: AuthenticatedActorContext = {
      actorId: ACTOR_SUPERADMIN_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_superadmin_a',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionSuperAdminA,
    });

    const entityAdminId = crypto.randomUUID();
    const res21 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: entityAdminId,
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
      resolutionNotes: 'Dibuat oleh Superadmin',
    });

    assert(
      res21.success === true &&
      res21.data?.ruleCode === 'DOC_COMPLETENESS_RULE' &&
      res21.data?.status === ExceptionStatus.OPEN &&
      res21.data?.severity === Severity.CRITICAL &&
      res21.data?.resolutionNotes === 'Dibuat oleh Superadmin',
      'createExceptionAction permits ADMIN role and persists exception'
    );

    // ---------------------------------------------------------------------------------
    // TEST 22: Authorized ADMIN_TENANT Access => SUCCESS
    // ---------------------------------------------------------------------------------
    const sessionAdminTenantA: AuthenticatedActorContext = {
      actorId: ACTOR_ADMINTENANT_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_admintenant_a',
      role: UserRole.ADMIN_TENANT,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionAdminTenantA,
    });

    const entityAdminTenantId = crypto.randomUUID();
    const res22 = await createExceptionAction({
      entityType: 'Student',
      entityId: entityAdminTenantId,
      ruleCode: 'STUDENT_NISN_FORMAT_RULE',
      severity: Severity.HIGH,
    });

    assert(
      res22.success === true &&
      res22.data?.domain === 'STUDENT' &&
      res22.data?.status === ExceptionStatus.OPEN &&
      res22.data?.severity === Severity.HIGH,
      'createExceptionAction permits ADMIN_TENANT role and persists student exception'
    );

    // ---------------------------------------------------------------------------------
    // TEST 23: Authorized VERIFIKATOR Access => SUCCESS
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifA,
    });

    const entityVerifId = crypto.randomUUID();
    const res23 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: entityVerifId,
      ruleCode: 'SE_BKD_22_2026_RULE',
      severity: Severity.MEDIUM,
      resolutionNotes: 'Temuan hukuman disiplin oleh Verifikator',
    });

    assert(
      res23.success === true &&
      res23.data?.ruleCode === 'SE_BKD_22_2026_RULE' &&
      res23.data?.status === ExceptionStatus.OPEN &&
      res23.data?.severity === Severity.MEDIUM,
      'createExceptionAction permits VERIFIKATOR role and persists exception'
    );

    // ---------------------------------------------------------------------------------
    // TEST 24: RBAC Rejection - OPERATOR Cannot Create Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    const sessionOperatorA: AuthenticatedActorContext = {
      actorId: ACTOR_OPERATOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_operator_a',
      role: UserRole.OPERATOR,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionOperatorA,
    });

    const res24 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });

    assert(
      !res24.success && res24.error?.code === 'FORBIDDEN',
      'createExceptionAction rejects OPERATOR role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 25: RBAC Rejection - AUDITOR Cannot Create Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    const sessionAuditorA: AuthenticatedActorContext = {
      actorId: ACTOR_AUDITOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_auditor_a',
      role: UserRole.AUDITOR,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionAuditorA,
    });

    const res25 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });

    assert(
      !res25.success && res25.error?.code === 'FORBIDDEN',
      'createExceptionAction rejects AUDITOR role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 26: RBAC Rejection - PEGAWAI Cannot Create Exception => FORBIDDEN
    // ---------------------------------------------------------------------------------
    const sessionPegawaiA: AuthenticatedActorContext = {
      actorId: ACTOR_PEGAWAI_A_ID,
      tenantId: TENANT_A_ID,
      username: 'exc_pegawai_a',
      role: UserRole.PEGAWAI,
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionPegawaiA,
    });

    const res26 = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });

    assert(
      !res26.success && res26.error?.code === 'FORBIDDEN',
      'createExceptionAction rejects PEGAWAI role with FORBIDDEN'
    );

    // ---------------------------------------------------------------------------------
    // TEST 27: Tenant Isolation - Created Item Belongs to Caller's Tenant
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifA, // Tenant A
    });

    const isolatedEntityId = crypto.randomUUID();
    const res27Create = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: isolatedEntityId,
      ruleCode: 'MASA_KERJA_ELIGIBILITY_RULE',
      severity: Severity.HIGH,
    });

    assert(res27Create.success === true, 'Tenant A creates exception successfully');
    const createdAId = res27Create.data!.id;

    // Switch to Tenant B session
    setSessionProvider({
      getSession: async () => sessionVerifB, // Tenant B
    });

    const res27TenantBRead = await getExceptionsAction();
    assert(
      res27TenantBRead.success === true &&
      !res27TenantBRead.data!.some((item) => item.id === createdAId),
      'Tenant B cannot observe exception created by Tenant A'
    );

    // ---------------------------------------------------------------------------------
    // TEST 28: Input Validation Rejections
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionVerifA,
    });

    const res28NullDto = await createExceptionAction(null as any);
    const res28BadEntityId = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: 'not-a-valid-uuid',
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });
    const res28EmptyEntityType = await createExceptionAction({
      entityType: '   ',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });
    const res28EmptyRuleCode = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: '',
      severity: Severity.CRITICAL,
    });
    const res28BadSeverity = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: 'SUPER_CRITICAL' as any,
    });
    const res28BadId = await createExceptionAction({
      id: 'invalid-id-uuid',
      entityType: 'AwardProposal',
      entityId: crypto.randomUUID(),
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });

    assert(
      !res28NullDto.success && res28NullDto.error?.code === 'VALIDATION_ERROR' &&
      !res28BadEntityId.success && res28BadEntityId.error?.code === 'VALIDATION_ERROR' &&
      !res28EmptyEntityType.success && res28EmptyEntityType.error?.code === 'VALIDATION_ERROR' &&
      !res28EmptyRuleCode.success && res28EmptyRuleCode.error?.code === 'VALIDATION_ERROR' &&
      !res28BadSeverity.success && res28BadSeverity.error?.code === 'VALIDATION_ERROR' &&
      !res28BadId.success && res28BadId.error?.code === 'VALIDATION_ERROR',
      'createExceptionAction validates all input fields and rejects invalid parameters'
    );

    // ---------------------------------------------------------------------------------
    // TEST 29: Existing WorkflowInstance Reuse
    // ---------------------------------------------------------------------------------
    const sharedEntityId = crypto.randomUUID();
    const res29First = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: sharedEntityId,
      ruleCode: 'DOC_COMPLETENESS_RULE',
      severity: Severity.CRITICAL,
    });
    const res29Second = await createExceptionAction({
      entityType: 'AwardProposal',
      entityId: sharedEntityId,
      ruleCode: 'DOC_FORMAT_RULE',
      severity: Severity.LOW,
    });

    assert(
      res29First.success === true &&
      res29Second.success === true &&
      res29First.data!.id !== res29Second.data!.id,
      'createExceptionAction reuses existing WorkflowInstance for duplicate (tenantId, entityType, entityId)'
    );

    // ---------------------------------------------------------------------------------
    // TEST 30: Repository Error Propagation
    // ---------------------------------------------------------------------------------
    const mockFailingRepo = {
      findManyTx: async () => [],
      findByIdTx: async () => null,
      updateStatusTx: async () => { throw new Error('Unreachable'); },
      createTx: async () => {
        throw new Error('Validation Error: Simulated repository domain validation failure.');
      },
    };

    const res30 = await createExceptionAction(
      {
        entityType: 'AwardProposal',
        entityId: crypto.randomUUID(),
        ruleCode: 'DOC_COMPLETENESS_RULE',
        severity: Severity.CRITICAL,
      },
      mockFailingRepo
    );

    assert(
      !res30.success &&
      res30.error?.code === 'VALIDATION_ERROR' &&
      res30.error.message.includes('Simulated repository domain validation failure'),
      'createExceptionAction cleanly propagates repository Validation Errors'
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
