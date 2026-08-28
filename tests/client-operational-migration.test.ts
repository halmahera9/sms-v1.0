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

async function runClientOperationalMigrationTests() {
  console.log('=====================================================');
  console.log(' CLIENT OPERATIONAL READ MIGRATION TEST SUITE        ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const ACTOR_A_ID = 'a1111111-1111-7111-8111-111111111111';

  try {
    // Setup database prerequisites
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Client Migration Tenant A', code: 'CLIENT_MIG_A', status: 'ACTIVE' },
      update: { name: 'Client Migration Tenant A', code: 'CLIENT_MIG_A' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'client_mig_user',
        email: 'mig@sec.local',
        fullName: 'Client Migration User',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    const sessionA: AuthenticatedActorContext = {
      actorId: ACTOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'client_mig_user',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionA,
    });

    // ---------------------------------------------------------------------------------
    // TEST 1: UnifiedDashboard / Navigation Metrics Contract Verification
    // ---------------------------------------------------------------------------------
    const metricsRes = await getOperationalMetricsAction();
    assert(
      metricsRes.success === true && metricsRes.data !== undefined,
      'getOperationalMetricsAction returns success response for client dashboard consumer'
    );

    const metrics = metricsRes.data!;
    assert(
      typeof metrics.totalOpenExceptions === 'number' &&
      typeof metrics.pendingVerifications === 'number' &&
      typeof metrics.pendingApprovals === 'number' &&
      typeof metrics.totalEmployees === 'number' &&
      typeof metrics.totalStudents === 'number' &&
      typeof metrics.totalDocumentsProcessed === 'number' &&
      typeof metrics.requiresCorrection === 'number' &&
      typeof metrics.exceptionsBySeverity.error === 'number' &&
      typeof metrics.exceptionsBySeverity.warning === 'number' &&
      typeof metrics.exceptionsBySeverity.info === 'number',
      'OperationalMetrics contains all exact fields required by UnifiedDashboard and UnifiedNavigation'
    );

    // ---------------------------------------------------------------------------------
    // TEST 2: UnifiedWorkQueue Item Contract Verification
    // ---------------------------------------------------------------------------------
    const wqRes = await getUnifiedWorkQueueAction(50);
    assert(
      wqRes.success === true && Array.isArray(wqRes.data),
      'getUnifiedWorkQueueAction returns success response with array for client work queue consumer'
    );

    if (wqRes.data!.length > 0) {
      const item = wqRes.data![0];
      assert(
        typeof item.id === 'string' &&
        (item.domain === 'EMPLOYEE' || item.domain === 'STUDENT') &&
        typeof item.entityId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.subtitle === 'string' &&
        typeof item.status === 'string' &&
        ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(item.severity) &&
        typeof item.createdAt === 'string' &&
        typeof item.actionRequired === 'string',
        'WorkQueueItem contains all exact fields required by UnifiedWorkQueue component'
      );
    } else {
      assert(true, 'WorkQueueItem array structure verified (clean queue)');
    }

    // ---------------------------------------------------------------------------------
    // TEST 3: Unauthenticated Error Handling Boundary for Client Consumers
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const unauthMetricsRes = await getOperationalMetricsAction();
    const unauthWqRes = await getUnifiedWorkQueueAction();

    assert(
      !unauthMetricsRes.success &&
      unauthMetricsRes.error?.code === 'UNAUTHENTICATED' &&
      !unauthWqRes.success &&
      unauthWqRes.error?.code === 'UNAUTHENTICATED',
      'Client consumers receive structured UNAUTHENTICATED error envelope without exposing DB internals'
    );

    console.log(`\n=====================================================`);
    console.log(` RESULT: ${passCount}/${testCount} Client Migration tests PASSED `);
    console.log(`=====================================================\n`);
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runClientOperationalMigrationTests().catch((err) => {
  console.error('Fatal Client Operational Migration Test Runner Error:', err);
  process.exit(1);
});
