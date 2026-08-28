import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PostgresAuditEventRepository, AuditEventInput } from '../src/platform/repositories/audit-event';
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

async function runAuditEventRepositoryTests() {
  console.log('=====================================================');
  console.log('      AUDIT EVENT REPOSITORY TEST SUITE              ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '11111111-1111-7111-8111-11111111114a';
  const TENANT_B_ID = '99999999-9999-7999-8999-99999999994b';

  const ACTOR_A_ID = 'a1111111-1111-7111-8111-11111111114a';
  const ACTOR_B_ID = 'b2222222-2222-7222-8222-22222222224b';

  const ENTITY_1_ID = crypto.randomUUID();
  const ENTITY_2_ID = crypto.randomUUID();
  const EXPLICIT_EVENT_ID = crypto.randomUUID();

  const auditRepo = new PostgresAuditEventRepository();

  try {
    // 0. Setup Tenants and Actors
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Audit Tenant A', code: 'AUDIT_TENANT_A_4H', status: 'ACTIVE' },
      update: {},
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Audit Tenant B', code: 'AUDIT_TENANT_B_4H', status: 'ACTIVE' },
      update: {},
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'actor_audit_a',
        email: 'actor_audit_a@test.local',
        fullName: 'Actor Audit A',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_B_ID },
      create: {
        id: ACTOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'actor_audit_b',
        email: 'actor_audit_b@test.local',
        fullName: 'Actor Audit B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: {},
    });

    // 1. Insert audit event with exact UUID & actorUserId
    console.log('[1] Testing recordTx (Insert Audit Event with exact UUID & Actor)...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const input: AuditEventInput = {
        id: EXPLICIT_EVENT_ID,
        actorUserId: ACTOR_A_ID,
        action: 'VERIFY_DOCUMENTS',
        entityType: 'AwardProposal',
        entityId: ENTITY_1_ID,
        beforeState: { status: 'SEBAGIAN' },
        afterState: { status: 'DIVERIFIKASI' },
        metadata: { requirementCode: 'SK_CPNS' },
      };

      const recorded = await auditRepo.recordTx(tx, TENANT_A_ID, input);
      assert(recorded.id === EXPLICIT_EVENT_ID, 'Test 1: Exact event UUID is preserved');
      assert(recorded.tenantId === TENANT_A_ID, 'Test 2: Tenant ID correctly assigned');
      assert(recorded.actorUserId === ACTOR_A_ID, 'Test 3: actorUserId correctly bound');
      assert(recorded.action === 'VERIFY_DOCUMENTS', 'Test 4: Action matches input');
      assert(recorded.entityId === ENTITY_1_ID, 'Test 5: Exact entity UUID is preserved');
    });

    // 2. Insert audit event with NULLABLE actorUserId (System/Automated Action)
    console.log('\n[2] Testing recordTx with System Action (Nullable actorUserId)...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const input: AuditEventInput = {
        actor: 'system-cron',
        action: 'AUTOMATED_VALIDATION',
        entityType: 'AwardProposal',
        entityId: ENTITY_2_ID,
        metadata: { automated: true },
      };

      const recorded = await auditRepo.recordTx(tx, TENANT_A_ID, input);
      assert(recorded.actorUserId === undefined, 'Test 6: actorUserId is safely undefined/null for system actor');
      assert(recorded.actor === 'system-cron', 'Test 7: Raw system actor name preserved in domain model');
    });

    // 3. Read Recent Events
    console.log('\n[3] Testing findRecentTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const recent = await auditRepo.findRecentTx(tx, TENANT_A_ID, 10);
      assert(recent.length >= 2, 'Test 8: findRecentTx returns at least 2 events recorded');
      assert(recent[0].timestamp !== '', 'Test 9: Events have valid timestamps');
    });

    // 4. Read Events by Entity
    console.log('\n[4] Testing findByEntityTx...');
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const entityEvents = await auditRepo.findByEntityTx(tx, TENANT_A_ID, 'AwardProposal', ENTITY_1_ID);
      assert(entityEvents.length === 1, 'Test 10: findByEntityTx returns exactly 1 event for ENTITY_1_ID');
      assert(entityEvents[0].id === EXPLICIT_EVENT_ID, 'Test 11: Returned event matches ENTITY_1_ID record');
    });

    // 5. Rejection of non-UUID entityId (Semantic validation)
    console.log('\n[5] Testing rejection of non-UUID entityId...');
    let threwInvalidUuid = false;
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await auditRepo.recordTx(tx, TENANT_A_ID, {
          action: 'TEST_NON_UUID',
          entityType: 'AwardProposal',
          entityId: 'legacy-prop-101', // Non-UUID
        });
      });
    } catch (err: any) {
      threwInvalidUuid = err.message.includes('Audit entityId must be a valid UUID');
    }
    assert(threwInvalidUuid, 'Test 12: recordTx rejects non-UUID entityId without silent random generation');

    // 6. Tenant Isolation (Tenant B cannot read Tenant A audit events)
    console.log('\n[6] Testing Tenant Isolation (RLS enforcement)...');
    await runInTenantContext(ACTOR_B_ID, TENANT_B_ID, async (tx) => {
      const tenantBRecent = await auditRepo.findRecentTx(tx, TENANT_B_ID);
      assert(tenantBRecent.length === 0, 'Test 13: Tenant B cannot see Tenant A audit events (0 records)');

      const tenantBEntity = await auditRepo.findByEntityTx(tx, TENANT_B_ID, 'AwardProposal', ENTITY_1_ID);
      assert(tenantBEntity.length === 0, 'Test 14: Tenant B query by entity returns 0 records');
    });

    // 7. Transaction Rollback Atomicity (When outer tx fails, audit event rolls back)
    console.log('\n[7] Testing Transaction Rollback Atomicity...');
    const ROLLBACK_ENTITY_ID = crypto.randomUUID();
    try {
      await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
        await auditRepo.recordTx(tx, TENANT_A_ID, {
          action: 'DOOMED_TRANSACTION',
          entityType: 'AwardProposal',
          entityId: ROLLBACK_ENTITY_ID,
        });
        throw new Error('Simulated Domain Failure triggering Rollback');
      });
    } catch (err: any) {
      // Expected rollback error
    }

    // Verify after rollback that the audit event was NOT committed
    await runInTenantContext(ACTOR_A_ID, TENANT_A_ID, async (tx) => {
      const rolledBack = await auditRepo.findByEntityTx(tx, TENANT_A_ID, 'AwardProposal', ROLLBACK_ENTITY_ID);
      assert(rolledBack.length === 0, 'Test 15: Audit event was rolled back atomically when domain transaction failed');
    });

    // 8. Context-Bound Methods
    console.log('\n[8] Testing Context-Bound Methods (recordInContext & findRecentInContext)...');
    const inContextEntityId = crypto.randomUUID();
    await auditRepo.recordInContext(ACTOR_A_ID, TENANT_A_ID, {
      action: 'IN_CONTEXT_TEST',
      entityType: 'AwardProposal',
      entityId: inContextEntityId,
    });

    const foundInContext = await auditRepo.findByEntityInContext(ACTOR_A_ID, TENANT_A_ID, 'AwardProposal', inContextEntityId);
    assert(foundInContext.length === 1 && foundInContext[0].action === 'IN_CONTEXT_TEST', 'Test 16: recordInContext and findByEntityInContext work seamlessly');

  } finally {
    // Note: audit_events table is immutable (protected by PostgreSQL prevent_audit_modification trigger)
    // Test tenants and actors remain for deterministic idempotent upsert in future test runs.
    try {
      // Disconnect cleanly
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

runAuditEventRepositoryTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
