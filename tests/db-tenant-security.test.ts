import 'dotenv/config';
import pg from 'pg';
import { runInTenantContext } from '../src/platform/db/tenant-context';
import { prisma } from '../src/platform/db/prisma';

// Setup connection pool using MIGRATION_DATABASE_URL exclusively for deterministic fixture setup & teardown
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

// Deterministic Hex UUID Fixture IDs (0-9, a-f)
const TENANT_A_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_B_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_C_ID = '33333333-3333-4333-8333-333333333333';

const ACTOR_A_ID = 'a1111111-1111-4111-8111-111111111111';
const ACTOR_B_ID = 'b2222222-2222-4222-8222-222222222222';
const ACTOR_C_ID = 'c3333333-3333-4333-8333-333333333333';

const AUDIT_EVENT_A_ID = 'e1111111-1111-4111-8111-111111111111';

let testCount = 0;
let passCount = 0;
const results: { test: string; status: 'PASS' | 'FAIL'; detail?: string }[] = [];

function assert(condition: boolean, message: string, detail?: string) {
  testCount++;
  if (condition) {
    passCount++;
    results.push({ test: message, status: 'PASS', detail });
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    results.push({ test: message, status: 'FAIL', detail: detail || 'Assertion failed' });
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
  }
}

async function cleanupFixtures() {
  try {
    await migrationPool.query(`DELETE FROM audit_events WHERE id IN ('${AUDIT_EVENT_A_ID}');`);
    await migrationPool.query(`DELETE FROM user_actors WHERE id IN ('${ACTOR_A_ID}', '${ACTOR_B_ID}', '${ACTOR_C_ID}');`);
    await migrationPool.query(`DELETE FROM tenants WHERE id IN ('${TENANT_A_ID}', '${TENANT_B_ID}', '${TENANT_C_ID}');`);
  } catch (err) {
    console.warn('Cleanup warning:', (err as Error).message);
  }
}

async function setupFixtures() {
  await cleanupFixtures();

  // 1. Create Active Tenant A, Active Tenant B, Suspended Tenant C
  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
    ('${TENANT_A_ID}', 'SEC-TENANT-A', 'Security Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'SEC-TENANT-B', 'Security Test Tenant B', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_C_ID}', 'SEC-TENANT-C', 'Security Test Tenant C', 'SUSPENDED', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name;
  `);

  // 2. Create Active Actor A in Tenant A, Active Actor B in Tenant B, Inactive Actor C in Tenant C
  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'actor_sec_a', 'actor_sec_a@test.local', 'Actor Security A', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'actor_sec_b', 'actor_sec_b@test.local', 'Actor Security B', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_C_ID}', '${TENANT_C_ID}', 'actor_sec_c', 'actor_sec_c@test.local', 'Actor Security C', 'OPERATOR', 'INACTIVE', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, role = EXCLUDED.role;
  `);

  // 3. Create AuditEvent Fixture in Tenant A using actor_user_id column
  await migrationPool.query(`
    INSERT INTO audit_events (id, tenant_id, actor_user_id, action, entity_type, entity_id, payload_json, created_at) VALUES
    ('${AUDIT_EVENT_A_ID}', '${TENANT_A_ID}', '${ACTOR_A_ID}', 'INITIAL_SECURITY_AUDIT', 'USER_ACTOR', '${ACTOR_A_ID}', '{}'::jsonb, NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function runSecurityTestSuite() {
  console.log('=====================================================');
  console.log('  BANYUBIRU PHASE 4G-3 DATABASE SECURITY TEST SUITE ');
  console.log('=====================================================\n');

  try {
    console.log('[Setup] Provisioning deterministic test fixtures via banyubiru_migrator...');
    await setupFixtures();
    console.log('[Setup] Fixtures created successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1 — Valid Actor + Valid Tenant Access (Happy Path)
    // ------------------------------------------------------------------------
    console.log('[1] Testing Valid Actor + Valid Tenant Access...');
    const result1 = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await tx.userActor.findUnique({
        where: { id: ACTOR_A_ID },
      });
    });
    assert(
      result1 !== null && result1.id === ACTOR_A_ID && result1.fullName === 'Actor Security A',
      'TEST 1: Valid Actor A + Tenant A successfully queries Tenant A user actor',
      `Found actor: ${result1?.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 2 — Cross-Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing Cross-Tenant Data Isolation...');
    const result2 = await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      const allActorsInContextB = await tx.userActor.findMany();
      const directAttemptActorA = await tx.userActor.findUnique({
        where: { id: ACTOR_A_ID },
      });
      return { allActorsInContextB, directAttemptActorA };
    });

    const actorAVisibleInB = result2.allActorsInContextB.some((a) => a.id === ACTOR_A_ID);
    const actorBVisibleInB = result2.allActorsInContextB.some((a) => a.id === ACTOR_B_ID);

    assert(
      !actorAVisibleInB && result2.directAttemptActorA === null && actorBVisibleInB,
      'TEST 2: Actor B in Tenant B cannot see Tenant A data (Cross-Tenant Isolation PASS)',
      `Tenant B sees Actor B: ${actorBVisibleInB}, Tenant A Actor visible: ${actorAVisibleInB}`
    );

    // ------------------------------------------------------------------------
    // TEST 3 — Invalid Actor / Tenant Membership (Fail-Closed Check)
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing Invalid Actor/Tenant Membership Lockout...');
    let callbackExecuted3 = false;
    let errorCaught3 = false;
    let errorMessage3 = '';

    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_B_ID, async (tx) => {
        callbackExecuted3 = true;
        return await tx.userActor.findMany();
      });
    } catch (err) {
      errorCaught3 = true;
      errorMessage3 = (err as Error).message;
    }

    assert(
      errorCaught3 && !callbackExecuted3 && errorMessage3.includes('SECURITY ERROR'),
      'TEST 3: Unauthorized set_tenant_context(Actor A, Tenant B) throws SECURITY ERROR and aborts callback',
      `Caught error: ${errorMessage3}`
    );

    // ------------------------------------------------------------------------
    // TEST 4 — Direct Query Without Tenant Context (Bypass Prevention)
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing Direct Query Without Tenant Context (Fail-Closed Check)...');
    const directResult4 = await prisma.userActor.findMany();
    assert(
      directResult4.length === 0,
      'TEST 4: Direct query without set_tenant_context() returns 0 rows (Fail-Closed PASS)',
      `Rows returned: ${directResult4.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 5 — Inactive Actor / Inactive Tenant Lockout
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Inactive Actor / Inactive Tenant Lockout...');
    let callbackExecuted5 = false;
    let errorCaught5 = false;
    let errorMessage5 = '';

    try {
      await runInTenantContext(ACTOR_C_ID, TENANT_C_ID, async (tx) => {
        callbackExecuted5 = true;
        return await tx.userActor.findMany();
      });
    } catch (err) {
      errorCaught5 = true;
      errorMessage5 = (err as Error).message;
    }

    assert(
      errorCaught5 && !callbackExecuted5 && errorMessage5.includes('SECURITY ERROR'),
      'TEST 5: Inactive Actor C / Suspended Tenant C rejected by set_tenant_context()',
      `Caught error: ${errorMessage5}`
    );

    // ------------------------------------------------------------------------
    // TEST 6 — Audit Event Immutability
    // ------------------------------------------------------------------------
    console.log('\n[6] Testing Audit Event Immutability...');
    let updateCaught6 = false;
    let deleteCaught6 = false;

    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      // Attempt UPDATE on audit_events via banyubiru_app
      try {
        await tx.$executeRaw`UPDATE audit_events SET action = 'ATTEMPTED_MUTATION' WHERE id = ${AUDIT_EVENT_A_ID}::uuid;`;
      } catch (err) {
        updateCaught6 = true;
      }

      // Attempt DELETE on audit_events via banyubiru_app
      try {
        await tx.$executeRaw`DELETE FROM audit_events WHERE id = ${AUDIT_EVENT_A_ID}::uuid;`;
      } catch (err) {
        deleteCaught6 = true;
      }
    });

    assert(
      updateCaught6 && deleteCaught6,
      'TEST 6: PostgreSQL trigger rejects UPDATE and DELETE on audit_events for banyubiru_app',
      `Update blocked: ${updateCaught6}, Delete blocked: ${deleteCaught6}`
    );

    // ------------------------------------------------------------------------
    // TEST 7 — Transaction Context Isolation (No Leak Between Transactions)
    // ------------------------------------------------------------------------
    console.log('\n[7] Testing Transaction Context Scope & Anti-Leak Boundary...');
    // Step 7.1: Execute Transaction Tenant A
    const res7A = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      return await tx.userActor.findMany();
    });

    // Step 7.2: Query directly outside transaction immediately after
    const res7Direct = await prisma.userActor.findMany();

    // Step 7.3: Execute Transaction Tenant B
    const res7B = await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      return await tx.userActor.findMany();
    });

    const tenantAIn7A = res7A.some((a) => a.id === ACTOR_A_ID);
    const tenantAIn7Direct = res7Direct.some((a) => a.id === ACTOR_A_ID);
    const tenantAIn7B = res7B.some((a) => a.id === ACTOR_A_ID);
    const tenantBIn7B = res7B.some((a) => a.id === ACTOR_B_ID);

    assert(
      tenantAIn7A && !tenantAIn7Direct && !tenantAIn7B && tenantBIn7B,
      'TEST 7: Transaction context does NOT leak outside transaction or between consecutive transactions',
      `Tenant A in Tx A: ${tenantAIn7A}, in Direct: ${tenantAIn7Direct}, in Tx B: ${tenantAIn7B}, Tenant B in Tx B: ${tenantBIn7B}`
    );
  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    await cleanupFixtures();
    await migrationPool.end();
    await prisma.$disconnect();
    console.log('[Teardown] Cleanup complete.');
  }

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED`);
  console.log('=====================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
