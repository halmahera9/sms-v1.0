import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getRecentAuditEventsAction } from '../src/platform/actions/audit';
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

async function runAuditServerActionsTests() {
  console.log('=====================================================');
  console.log(' AUDIT SERVER ACTIONS READ BOUNDARY TEST SUITE       ');
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
      create: { id: TENANT_A_ID, name: 'Audit Action Tenant A', code: 'AUDIT_ACT_A', status: 'ACTIVE' },
      update: { name: 'Audit Action Tenant A', code: 'AUDIT_ACT_A' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Audit Action Tenant B', code: 'AUDIT_ACT_B', status: 'ACTIVE' },
      update: { name: 'Audit Action Tenant B', code: 'AUDIT_ACT_B' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'audit_actor_a',
        email: 'audit_a@sec.local',
        fullName: 'Audit Action Actor A',
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
        username: 'audit_actor_b',
        email: 'audit_b@sec.local',
        fullName: 'Audit Action Actor B',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });

    // Create known audit event entries in tenant A
    const entityAId = crypto.randomUUID();
    await adminPrisma.auditEvent.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: TENANT_A_ID,
        actorUserId: ACTOR_A_ID,
        action: 'VERIFY_DOCUMENT',
        entityType: 'AwardProposal',
        entityId: entityAId,
        payloadJson: {
          actor: 'audit_actor_a',
          metadata: { details: 'Verified proposal documents' },
        },
      },
    });

    // Create known audit event in tenant B
    const entityBId = crypto.randomUUID();
    await adminPrisma.auditEvent.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: TENANT_B_ID,
        actorUserId: ACTOR_B_ID,
        action: 'VERIFY_DOCUMENT',
        entityType: 'AwardProposal',
        entityId: entityBId,
        payloadJson: {
          actor: 'audit_actor_b',
          metadata: { details: 'Tenant B private audit event' },
        },
      },
    });

    // ---------------------------------------------------------------------------------
    // TEST 1: Unauthenticated => Fail-Closed
    // ---------------------------------------------------------------------------------
    resetSessionProvider();
    const res1 = await getRecentAuditEventsAction();
    assert(
      !res1.success && res1.error?.code === 'UNAUTHENTICATED',
      'getRecentAuditEventsAction fails closed with UNAUTHENTICATED error when unauthenticated'
    );

    // ---------------------------------------------------------------------------------
    // TEST 2: Inactive Account => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'audit_actor_a',
        role: 'VERIFIKATOR',
        status: 'INACTIVE',
      }),
    });
    const res2 = await getRecentAuditEventsAction();
    assert(
      !res2.success && res2.error?.code === 'UNAUTHENTICATED',
      'getRecentAuditEventsAction fails closed with UNAUTHENTICATED error when account is inactive'
    );

    // ---------------------------------------------------------------------------------
    // TEST 3: Malformed Non-UUID Identity => Fail-Closed
    // ---------------------------------------------------------------------------------
    setSessionProvider({
      getSession: async () => ({
        actorId: 'non-uuid-actor',
        tenantId: TENANT_A_ID,
        username: 'audit_actor_a',
        role: 'VERIFIKATOR',
        status: 'ACTIVE',
      }),
    });
    const res3 = await getRecentAuditEventsAction();
    assert(
      !res3.success && res3.error?.code === 'UNAUTHENTICATED',
      'getRecentAuditEventsAction fails closed with UNAUTHENTICATED error when actorId is malformed'
    );

    // ---------------------------------------------------------------------------------
    // TEST 4: Limit Validation
    // ---------------------------------------------------------------------------------
    const sessionA: AuthenticatedActorContext = {
      actorId: ACTOR_A_ID,
      tenantId: TENANT_A_ID,
      username: 'audit_actor_a',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionA,
    });

    const res4Neg = await getRecentAuditEventsAction(-1);
    const res4Zero = await getRecentAuditEventsAction(0);
    const res4Over = await getRecentAuditEventsAction(500);
    const res4Decimal = await getRecentAuditEventsAction(15.7 as any);

    assert(
      !res4Neg.success && res4Neg.error?.code === 'VALIDATION_ERROR' &&
      !res4Zero.success && res4Zero.error?.code === 'VALIDATION_ERROR' &&
      !res4Over.success && res4Over.error?.code === 'VALIDATION_ERROR' &&
      !res4Decimal.success && res4Decimal.error?.code === 'VALIDATION_ERROR',
      'getRecentAuditEventsAction validates and rejects out-of-bounds limit parameters'
    );

    // ---------------------------------------------------------------------------------
    // TEST 5: Authenticated DTO & Structure Verification
    // ---------------------------------------------------------------------------------
    const res5 = await getRecentAuditEventsAction(25);
    assert(
      res5.success === true && Array.isArray(res5.data) && res5.data.length > 0,
      'getRecentAuditEventsAction returns valid AuditEventRecord[] array'
    );

    const firstEvent = res5.data![0];
    assert(
      typeof firstEvent.id === 'string' &&
      typeof firstEvent.timestamp === 'string' &&
      typeof firstEvent.actor === 'string' &&
      typeof firstEvent.action === 'string' &&
      typeof firstEvent.entityType === 'string' &&
      typeof firstEvent.entityId === 'string',
      'AuditEventRecord fields match exact shape required by UnifiedAuditFeed'
    );

    // ---------------------------------------------------------------------------------
    // TEST 6: Strict Cross-Tenant RLS Isolation
    // ---------------------------------------------------------------------------------
    const sessionB: AuthenticatedActorContext = {
      actorId: ACTOR_B_ID,
      tenantId: TENANT_B_ID,
      username: 'audit_actor_b',
      role: 'VERIFIKATOR',
      status: 'ACTIVE',
    };
    setSessionProvider({
      getSession: async () => sessionB,
    });

    const res6 = await getRecentAuditEventsAction(50);
    assert(
      res6.success === true && Array.isArray(res6.data),
      'getRecentAuditEventsAction retrieves tenant B audit events successfully'
    );

    const crossTenantLeak = res6.data!.some((e) => e.entityId === entityAId);
    assert(
      !crossTenantLeak,
      'Tenant B context cannot observe any audit events belonging to Tenant A'
    );

    console.log(`\n=====================================================`);
    console.log(` RESULT: ${passCount}/${testCount} Audit Server Action tests PASSED `);
    console.log(`=====================================================\n`);
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runAuditServerActionsTests().catch((err) => {
  console.error('Fatal Audit Server Actions Test Runner Error:', err);
  process.exit(1);
});
