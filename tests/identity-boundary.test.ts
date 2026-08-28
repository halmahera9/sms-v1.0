import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AuthenticatedActorContext,
  AuthenticationError,
  ISessionProvider,
  getAuthenticatedActorContext,
  getAuthenticatedSession,
  executeInAuthenticatedContext,
  setSessionProvider,
  resetSessionProvider,
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

async function runIdentityBoundaryTests() {
  console.log('=====================================================');
  console.log(' APPLICATION IDENTITY BOUNDARY TEST SUITE            ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-111111111111';
  const ACTOR_A_ID = 'a1111111-1111-7111-8111-111111111111';

  try {
    // Setup database prerequisites for live context execution test
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Identity Tenant A', code: 'ID_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Identity Tenant A', code: 'ID_TENANT_A' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'id_actor_user',
        email: 'id_actor@sec.local',
        fullName: 'Identity Actor User',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    // ---------------------------------------------------------------------------------
    // TEST 1: Default Provider (No Session) => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    let unauthCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        unauthCaught = true;
      }
    }
    assert(unauthCaught, 'Default session provider fails closed with AuthenticationError when unauthenticated');

    // ---------------------------------------------------------------------------------
    // TEST 2: Missing Actor ID => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: '',
        tenantId: TENANT_A_ID,
        username: 'test_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    let missingActorCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        missingActorCaught = true;
      }
    }
    assert(missingActorCaught, 'Missing actorId fails closed with AuthenticationError');

    // ---------------------------------------------------------------------------------
    // TEST 3: Malformed Actor ID (Non-UUID) => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: 'invalid-actor-uuid-format',
        tenantId: TENANT_A_ID,
        username: 'test_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    let malformedActorCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        malformedActorCaught = true;
      }
    }
    assert(malformedActorCaught, 'Malformed non-UUID actorId fails closed with AuthenticationError');

    // ---------------------------------------------------------------------------------
    // TEST 4: Missing Tenant ID => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: '',
        username: 'test_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    let missingTenantCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        missingTenantCaught = true;
      }
    }
    assert(missingTenantCaught, 'Missing tenantId fails closed with AuthenticationError');

    // ---------------------------------------------------------------------------------
    // TEST 5: Malformed Tenant ID (Non-UUID) => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: '12345-not-a-real-uuid',
        username: 'test_user',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    let malformedTenantCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        malformedTenantCaught = true;
      }
    }
    assert(malformedTenantCaught, 'Malformed non-UUID tenantId fails closed with AuthenticationError');

    // ---------------------------------------------------------------------------------
    // TEST 6: Inactive Status => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'test_user',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    let inactiveCaught = false;
    try {
      await getAuthenticatedActorContext();
    } catch (err) {
      if (err instanceof AuthenticationError) {
        inactiveCaught = true;
      }
    }
    assert(inactiveCaught, 'INACTIVE account status fails closed with AuthenticationError');

    // ---------------------------------------------------------------------------------
    // TEST 7: Valid Session => Resolves AuthenticatedActorContext
    // ---------------------------------------------------------------------------------
    const validContext: AuthenticatedActorContext = {
      actorId: ACTOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'id_actor_user',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => validContext,
    });
    const resolvedContext = await getAuthenticatedActorContext();
    assert(
      resolvedContext.actorId === ACTOR_A_ID &&
      resolvedContext.tenantId === TENANT_A_ID &&
      resolvedContext.username === 'id_actor_user' &&
      resolvedContext.role === 'VERIFIKATOR' &&
      resolvedContext.status === 'ACTIVE',
      'Valid session successfully resolves complete AuthenticatedActorContext'
    );

    // ---------------------------------------------------------------------------------
    // TEST 8: Backward-compatible getAuthenticatedSession() Alias
    // ---------------------------------------------------------------------------------
    const legacySession = await getAuthenticatedSession();
    assert(
      legacySession.actorId === ACTOR_A_ID &&
      legacySession.tenantId === TENANT_A_ID,
      'Backward-compatible getAuthenticatedSession() resolves identical AuthenticatedActorSession'
    );

    // ---------------------------------------------------------------------------------
    // TEST 9: executeInAuthenticatedContext executes callback inside runInTenantContext
    // ---------------------------------------------------------------------------------
    const executionResult = await executeInAuthenticatedContext(async (ctx, tx) => {
      // Query PostgreSQL setting set_tenant_context GUCs to verify execution under RLS
      const gucResult = await tx.$queryRaw<Array<{ current_tenant_id: string; current_actor_id: string }>>`
        SELECT
          current_setting('app.current_tenant_id', true) as current_tenant_id,
          current_setting('app.current_actor_id', true) as current_actor_id;
      `;
      return {
        contextPassed: ctx.actorId === ACTOR_A_ID,
        gucTenantId: gucResult[0]?.current_tenant_id,
        gucActorId: gucResult[0]?.current_actor_id,
      };
    });

    assert(
      executionResult.contextPassed &&
      executionResult.gucTenantId === TENANT_A_ID &&
      executionResult.gucActorId === ACTOR_A_ID,
      'executeInAuthenticatedContext propagates actorId and tenantId directly into database transaction context'
    );

    // ---------------------------------------------------------------------------------
    // TEST 10: executeInAuthenticatedContext fails closed on unauthenticated session
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    let execCallbackExecuted = false;
    let execErrorCaught = false;

    try {
      await executeInAuthenticatedContext(async () => {
        execCallbackExecuted = true;
        return true;
      });
    } catch (err) {
      if (err instanceof AuthenticationError) {
        execErrorCaught = true;
      }
    }

    assert(
      execErrorCaught && !execCallbackExecuted,
      'executeInAuthenticatedContext fails closed without executing query callback when session is missing'
    );

    console.log(`\n=====================================================`);
    console.log(` RESULT: ${passCount}/${testCount} Identity Boundary tests PASSED `);
    console.log(`=====================================================\n`);
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runIdentityBoundaryTests().catch((err) => {
  console.error('Fatal Identity Boundary Test Runner Error:', err);
  process.exit(1);
});
