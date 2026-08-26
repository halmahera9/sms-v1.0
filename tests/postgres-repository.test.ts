import 'dotenv/config';
import pg from 'pg';
import { UserActor } from '@prisma/client';
import { PostgresUserActorRepository } from '../src/platform/repositories/user-actor';
import { runInTenantContext } from '../src/platform/db/tenant-context';

// Connection pool using MIGRATION_DATABASE_URL exclusively for setup & teardown
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error('SECURITY ERROR: MIGRATION_DATABASE_URL environment variable is missing.');
}
const migrationPool = new pg.Pool({ connectionString: migrationUrl });

const repository = new PostgresUserActorRepository();

// Dedicated Hex UUID Fixture IDs for Repository Tests (to avoid collisions with security test fixtures)
const TENANT_A_ID = '44444444-4444-4444-8444-444444444444';
const TENANT_B_ID = '55555555-5555-4555-8555-555555555555';

const ACTOR_A_ID = 'd4444444-4444-4444-8444-444444444444';
const ACTOR_B_ID = 'e5555555-5555-4555-8555-555555555555';

const REPO_ACTOR_1_ID = 'f1111111-1111-4111-8111-111111111111';
const REPO_ACTOR_2_ID = 'f2222222-2222-4222-8222-222222222222';

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
    await migrationPool.query(
      `DELETE FROM user_actors WHERE id IN ('${ACTOR_A_ID}', '${ACTOR_B_ID}', '${REPO_ACTOR_1_ID}', '${REPO_ACTOR_2_ID}');`
    );
    await migrationPool.query(
      `DELETE FROM tenants WHERE id IN ('${TENANT_A_ID}', '${TENANT_B_ID}');`
    );
  } catch (err) {
    console.warn('Cleanup warning:', (err as Error).message);
  }
}

async function setupFixtures() {
  await cleanupFixtures();

  // 1. Create Active Tenant A & Active Tenant B
  await migrationPool.query(`
    INSERT INTO tenants (id, code, name, status, created_at, updated_at) VALUES
    ('${TENANT_A_ID}', 'REPO-TENANT-A', 'Repo Test Tenant A', 'ACTIVE', NOW(), NOW()),
    ('${TENANT_B_ID}', 'REPO-TENANT-B', 'Repo Test Tenant B', 'ACTIVE', NOW(), NOW());
  `);

  // 2. Create Active Actor A in Tenant A, Active Actor B in Tenant B
  await migrationPool.query(`
    INSERT INTO user_actors (id, tenant_id, username, email, full_name, role, status, created_at, updated_at) VALUES
    ('${ACTOR_A_ID}', '${TENANT_A_ID}', 'repo_actor_a', 'repo_actor_a@test.local', 'Repo Actor A', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW()),
    ('${ACTOR_B_ID}', '${TENANT_B_ID}', 'repo_actor_b', 'repo_actor_b@test.local', 'Repo Actor B', 'VERIFIKATOR', 'ACTIVE', NOW(), NOW());
  `);
}

async function runRepositoryTestSuite() {
  console.log('=====================================================');
  console.log('  BANYUBIRU PHASE 4G-4 POSTGRES REPOSITORY TEST SUITE ');
  console.log('=====================================================\n');

  try {
    console.log('[Setup] Provisioning deterministic test fixtures...');
    await setupFixtures();
    console.log('[Setup] Fixtures created successfully.\n');

    // ------------------------------------------------------------------------
    // TEST 1 — findByIdInContext (Happy Path)
    // ------------------------------------------------------------------------
    console.log('[1] Testing findByIdInContext...');
    const actorA = await repository.findByIdInContext(ACTOR_A_ID, TENANT_A_ID, ACTOR_A_ID);
    assert(
      actorA !== null && actorA.id === ACTOR_A_ID && actorA.username === 'repo_actor_a',
      'TEST 1: findByIdInContext returns Actor A in Tenant A context',
      `Found actor: ${actorA?.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 2 — saveInContext (Create & Update with Tenant Immutability)
    // ------------------------------------------------------------------------
    console.log('\n[2] Testing saveInContext (Create & Update)...');
    const newActor: UserActor = {
      id: REPO_ACTOR_1_ID,
      tenantId: TENANT_A_ID,
      username: 'repo_new_1',
      email: 'repo_new_1@test.local',
      fullName: 'Repo New Actor 1',
      role: 'OPERATOR',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create via repository
    const createdActor = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, newActor);
    assert(
      createdActor.id === REPO_ACTOR_1_ID && createdActor.fullName === 'Repo New Actor 1',
      'TEST 2A: saveInContext successfully creates new UserActor in Tenant A',
      `Created actor: ${createdActor.fullName}`
    );

    // Update via repository (verify tenantId is immutable)
    const updatedPayload: UserActor = {
      ...createdActor,
      fullName: 'Repo New Actor 1 Updated',
    };
    const updatedActor = await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, updatedPayload);
    assert(
      updatedActor.id === REPO_ACTOR_1_ID &&
        updatedActor.fullName === 'Repo New Actor 1 Updated' &&
        updatedActor.tenantId === TENANT_A_ID,
      'TEST 2B: saveInContext successfully updates UserActor while preserving tenantId immutability',
      `Updated actor: ${updatedActor.fullName}`
    );

    // ------------------------------------------------------------------------
    // TEST 3 — Application-Level Tenant Consistency Invariant Validation
    // ------------------------------------------------------------------------
    console.log('\n[3] Testing Application-Level Tenant Invariant Validation...');
    let invariantCaught = false;
    let invariantErrorMessage = '';

    const mismatchedEntity: UserActor = {
      id: REPO_ACTOR_2_ID,
      tenantId: TENANT_B_ID, // Mismatched! Entity says Tenant B, context is Tenant A
      username: 'mismatched_actor',
      email: 'mismatched@test.local',
      fullName: 'Mismatched Actor',
      role: 'OPERATOR',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await repository.saveInContext(ACTOR_A_ID, TENANT_A_ID, mismatchedEntity);
    } catch (err) {
      invariantCaught = true;
      invariantErrorMessage = (err as Error).message;
    }

    assert(
      invariantCaught && invariantErrorMessage.includes('SECURITY ERROR'),
      'TEST 3: saveInContext rejects mismatched entity.tenantId before reaching DB',
      `Caught error: ${invariantErrorMessage}`
    );

    // ------------------------------------------------------------------------
    // TEST 4 — saveAllInContext (Batch Creation & Pre-validation)
    // ------------------------------------------------------------------------
    console.log('\n[4] Testing saveAllInContext (Batch Creation)...');
    const batchActors: UserActor[] = [
      {
        id: REPO_ACTOR_2_ID,
        tenantId: TENANT_A_ID,
        username: 'repo_batch_2',
        email: 'repo_batch_2@test.local',
        fullName: 'Repo Batch Actor 2',
        role: 'OPERATOR',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const savedBatch = await repository.saveAllInContext(ACTOR_A_ID, TENANT_A_ID, batchActors);
    assert(
      savedBatch.length === 1 && savedBatch[0].id === REPO_ACTOR_2_ID,
      'TEST 4: saveAllInContext atomically creates batch actors in Tenant A',
      `Saved batch count: ${savedBatch.length}`
    );

    // ------------------------------------------------------------------------
    // TEST 5 — Cross-Tenant Repository Isolation
    // ------------------------------------------------------------------------
    console.log('\n[5] Testing Cross-Tenant Repository Isolation...');
    const allActorsInB = await repository.findAllInContext(ACTOR_B_ID, TENANT_B_ID);
    const actorAInB = allActorsInB.some((a) => a.id === ACTOR_A_ID);
    const actorBInB = allActorsInB.some((a) => a.id === ACTOR_B_ID);

    assert(
      !actorAInB && actorBInB,
      'TEST 5: repository.findAllInContext(Actor B, Tenant B) cannot see Tenant A actors',
      `Tenant B count: ${allActorsInB.length}, Actor A visible: ${actorAInB}`
    );

    // ------------------------------------------------------------------------
    // TEST 6 — deleteInContext (Delete existing vs Non-existing)
    // ------------------------------------------------------------------------
    console.log('\n[6] Testing deleteInContext...');
    const deleteSuccess = await repository.deleteInContext(ACTOR_A_ID, TENANT_A_ID, REPO_ACTOR_2_ID);
    const deleteNonExisting = await repository.deleteInContext(
      ACTOR_A_ID,
      TENANT_A_ID,
      '99999999-9999-4999-8999-999999999999'
    );

    assert(
      deleteSuccess === true && deleteNonExisting === false,
      'TEST 6: deleteInContext returns true for deleted record and false (P2025) for non-existing record',
      `Delete existing: ${deleteSuccess}, Delete non-existing: ${deleteNonExisting}`
    );

    // ------------------------------------------------------------------------
    // TEST 7 — Transaction-Bound Methods (findByIdTx, saveTx inside custom transaction)
    // ------------------------------------------------------------------------
    console.log('\n[7] Testing Transaction-Bound Methods inside runInTenantContext...');
    const txResult = await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const foundInTx = await repository.findByIdTx(tx, REPO_ACTOR_1_ID);
      const allInTx = await repository.findAllTx(tx);
      return { foundInTx, count: allInTx.length };
    });

    assert(
      txResult.foundInTx !== null && txResult.foundInTx.id === REPO_ACTOR_1_ID,
      'TEST 7: Transaction-bound repository methods execute cleanly using active TenantTransactionClient',
      `Found in tx: ${txResult.foundInTx?.fullName}`
    );
  } finally {
    console.log('\n[Teardown] Cleaning up test fixtures...');
    await cleanupFixtures();
    await migrationPool.end();
    console.log('[Teardown] Cleanup complete.');
  }

  console.log('\n=====================================================');
  console.log(` SUMMARY: ${passCount} / ${testCount} TESTS PASSED`);
  console.log('=====================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runRepositoryTestSuite().catch((err) => {
  console.error('Repository test execution error:', err);
  process.exit(1);
});
