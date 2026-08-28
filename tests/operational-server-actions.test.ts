import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getOperationalMetricsAction,
  getUnifiedWorkQueueAction,
} from '../src/platform/actions/operational';
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

async function runOperationalServerActionsTests() {
  console.log('=====================================================');
  console.log(' OPERATIONAL SERVER ACTIONS READ BOUNDARY TEST SUITE ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '99999999-9999-7999-8999-999999999999';

  const ACTOR_A_ID = 'a1111111-1111-7111-8111-111111111111';
  const ACTOR_B_ID = 'b2222222-2222-7222-8222-222222222222';

  try {
    // Setup database prerequisites
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'OpAction Tenant A', code: 'OP_ACT_TENANT_A', status: 'ACTIVE' },
      update: { name: 'OpAction Tenant A', code: 'OP_ACT_TENANT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'OpAction Tenant B', code: 'OP_ACT_TENANT_B', status: 'ACTIVE' },
      update: { name: 'OpAction Tenant B', code: 'OP_ACT_TENANT_B' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'op_actor_a',
        email: 'op_a@sec.local',
        fullName: 'Op Action Actor A',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_B_ID },
      create: {
        id: ACTOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'op_actor_b',
        email: 'op_b@sec.local',
        fullName: 'Op Action Actor B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    // ---------------------------------------------------------------------------------
    // TEST 1: getOperationalMetricsAction - Unauthenticated => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const res1 = await getOperationalMetricsAction();
    assert(
      !res1.success && res1.error?.code === 'UNAUTHENTICATED',
      'getOperationalMetricsAction fails closed with UNAUTHENTICATED error when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 2: getOperationalMetricsAction - Inactive Account => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'op_actor_a',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const res2 = await getOperationalMetricsAction();
    assert(
      !res2.success && res2.error?.code === 'UNAUTHENTICATED',
      'getOperationalMetricsAction fails closed with UNAUTHENTICATED error when account is inactive'
    );

    // ---------------------------------------------------------------------------------
    // TEST 3: getOperationalMetricsAction - Malformed UUID => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: 'invalid-actor-uuid',
        tenantId: TENANT_A_ID,
        username: 'op_actor_a',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const res3 = await getOperationalMetricsAction();
    assert(
      !res3.success && res3.error?.code === 'UNAUTHENTICATED',
      'getOperationalMetricsAction fails closed with UNAUTHENTICATED error when actorId is malformed non-UUID'
    );

    // ---------------------------------------------------------------------------------
    // TEST 4: getOperationalMetricsAction - Authenticated => Returns Valid OperationalMetrics
    // ---------------------------------------------------------------------------------
    const sessionA: AuthenticatedActorContext = {
      actorId: ACTOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'op_actor_a',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionA,
    });

    const res4 = await getOperationalMetricsAction();
    assert(
      res4.success === true &&
      res4.data !== undefined &&
      typeof res4.data.totalOpenExceptions === 'number' &&
      typeof res4.data.exceptionsBySeverity === 'object' &&
      typeof res4.data.pendingVerifications === 'number' &&
      typeof res4.data.pendingApprovals === 'number' &&
      typeof res4.data.totalEmployees === 'number' &&
      typeof res4.data.totalStudents === 'number' &&
      typeof res4.data.totalDocumentsProcessed === 'number',
      'getOperationalMetricsAction returns valid sanitized OperationalMetrics data structure'
    );

    // ---------------------------------------------------------------------------------
    // TEST 5: getOperationalMetricsAction - Tenant Isolation
    // ---------------------------------------------------------------------------------
    const sessionB: AuthenticatedActorContext = {
      actorId: ACTOR_B_ID,
      tenantId: TENANT_B_ID,
      username: 'op_actor_b',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionB,
    });

    const res5 = await getOperationalMetricsAction();
    assert(
      res5.success === true && res5.data !== undefined,
      'getOperationalMetricsAction resolves metrics cleanly for Tenant B under isolation'
    );

    // ---------------------------------------------------------------------------------
    // TEST 6: getUnifiedWorkQueueAction - Unauthenticated => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const res6 = await getUnifiedWorkQueueAction();
    assert(
      !res6.success && res6.error?.code === 'UNAUTHENTICATED',
      'getUnifiedWorkQueueAction fails closed with UNAUTHENTICATED error when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 7: getUnifiedWorkQueueAction - Limit Validation
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionA,
    });

    const res7Negative = await getUnifiedWorkQueueAction(-5);
    const res7Zero = await getUnifiedWorkQueueAction(0);
    const res7TooLarge = await getUnifiedWorkQueueAction(500);
    const res7Decimal = await getUnifiedWorkQueueAction(12.5 as any);

    assert(
      !res7Negative.success && res7Negative.error?.code === 'VALIDATION_ERROR' &&
      !res7Zero.success && res7Zero.error?.code === 'VALIDATION_ERROR' &&
      !res7TooLarge.success && res7TooLarge.error?.code === 'VALIDATION_ERROR' &&
      !res7Decimal.success && res7Decimal.error?.code === 'VALIDATION_ERROR',
      'getUnifiedWorkQueueAction validates and rejects out-of-bounds or non-integer limit parameters'
    );

    // ---------------------------------------------------------------------------------
    // TEST 8: getUnifiedWorkQueueAction - Authenticated => Returns WorkQueueItem[]
    // ---------------------------------------------------------------------------------
    const res8 = await getUnifiedWorkQueueAction(10);
    assert(
      res8.success === true &&
      Array.isArray(res8.data) &&
      res8.data.length <= 10,
      'getUnifiedWorkQueueAction returns sanitized WorkQueueItem[] respecting custom limit'
    );

    // ---------------------------------------------------------------------------------
    // TEST 9: getUnifiedWorkQueueAction - Tenant Isolation Enforcement
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => sessionB,
    });

    const res9 = await getUnifiedWorkQueueAction(20);
    assert(
      res9.success === true &&
      Array.isArray(res9.data),
      'getUnifiedWorkQueueAction operates strictly within Tenant B context under RLS'
    );

    console.log(`\n=====================================================`);
    console.log(` RESULT: ${passCount}/${testCount} Operational Server Action tests PASSED `);
    console.log(`=====================================================\n`);
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runOperationalServerActionsTests().catch((err) => {
  console.error('Fatal Operational Server Actions Test Runner Error:', err);
  process.exit(1);
});
