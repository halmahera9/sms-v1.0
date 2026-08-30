import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, UserRole, UserStatus, DocumentCategory, PublicUploadInvitationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  createPublicUploadInvitationAction,
  revokePublicUploadInvitationAction,
  getPublicUploadInvitationAction,
  validatePublicUploadInvitationToken,
} from '../src/domains/document/invitation/actions';
import { generateInvitationToken, hashInvitationToken } from '../src/domains/document/invitation/token';
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

async function runPublicUploadInvitationTests() {
  console.log('=====================================================');
  console.log(' PHASE 5A: PUBLIC UPLOAD INVITATION CORE TEST SUITE   ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '91111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '92222222-2222-7222-8222-222222222222';

  const ACTOR_ADMIN_A_ID = '9a111111-1111-7111-8111-111111111111';
  const ACTOR_OPERATOR_A_ID = '9a222222-2222-7222-8222-222222222222';
  const ACTOR_AUDITOR_A_ID = '9a333333-3333-7333-8333-333333333333';
  const ACTOR_INACTIVE_A_ID = '9a444444-4444-7444-8444-444444444444';
  const ACTOR_ADMIN_B_ID = '9b111111-1111-7111-8111-111111111111';

  const TARGET_STUDENT_A_ID = '9e111111-1111-7111-8111-111111111111';
  const TARGET_STUDENT_B_ID = '9e222222-2222-7222-8222-222222222222';

  try {
    // -----------------------------------------------------------------
    // SECTION 1: CRYPTOGRAPHIC ENTROPY & DETERMINISTIC HASHING TESTS
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Token Cryptography & Invariant Verification ---');

    // Invariant 1: 256-bit entropy token generation
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();
    assert(typeof token1 === 'string' && token1.length >= 43, 'Token 1 has >= 256-bit base64url length (43+ chars)');
    assert(typeof token2 === 'string' && token2.length >= 43, 'Token 2 has >= 256-bit base64url length (43+ chars)');
    assert(token1 !== token2, 'Generated tokens are unique and non-colliding');

    // Invariant 2 & 3: Deterministic SHA-256 hashing
    const hash1a = hashInvitationToken(token1);
    const hash1b = hashInvitationToken(token1);
    assert(hash1a === hash1b, 'Same raw token produces identical SHA-256 hash');
    assert(hash1a.length === 64, 'SHA-256 hash is strictly 64 hex characters');
    assert(/^[0-9a-f]{64}$/.test(hash1a), 'SHA-256 hash matches lowercase hex format');

    // Invariant 4: Differential hashing
    const hash2 = hashInvitationToken(token2);
    assert(hash1a !== hash2, 'Different tokens produce distinct SHA-256 hashes');

    // -----------------------------------------------------------------
    // SECTION 2: TEST FIXTURE SETUP
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Fixture Setup ---');

    // Cleanup previous test run records (publicUploadInvitation only)
    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    // Upsert Tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Invitation Tenant A', code: 'INV_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Invitation Tenant A', code: 'INV_TENANT_A', status: 'ACTIVE' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Invitation Tenant B', code: 'INV_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Invitation Tenant B', code: 'INV_TENANT_B', status: 'ACTIVE' },
    });

    // Upsert UserActors for Tenant A
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN_A_ID },
      create: { id: ACTOR_ADMIN_A_ID, tenantId: TENANT_A_ID, username: 'admin_a', email: 'admin_a@example.com', fullName: 'Admin Tenant A', role: UserRole.ADMIN_TENANT, status: UserStatus.ACTIVE },
      update: { role: UserRole.ADMIN_TENANT, status: UserStatus.ACTIVE },
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_OPERATOR_A_ID },
      create: { id: ACTOR_OPERATOR_A_ID, tenantId: TENANT_A_ID, username: 'op_a', email: 'op_a@example.com', fullName: 'Operator Tenant A', role: UserRole.OPERATOR, status: UserStatus.ACTIVE },
      update: { role: UserRole.OPERATOR, status: UserStatus.ACTIVE },
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_AUDITOR_A_ID },
      create: { id: ACTOR_AUDITOR_A_ID, tenantId: TENANT_A_ID, username: 'auditor_a', email: 'auditor_a@example.com', fullName: 'Auditor Tenant A', role: UserRole.AUDITOR, status: UserStatus.ACTIVE },
      update: { role: UserRole.AUDITOR, status: UserStatus.ACTIVE },
    });
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_INACTIVE_A_ID },
      create: { id: ACTOR_INACTIVE_A_ID, tenantId: TENANT_A_ID, username: 'inactive_a', email: 'inactive_a@example.com', fullName: 'Inactive Tenant A', role: UserRole.OPERATOR, status: UserStatus.INACTIVE },
      update: { role: UserRole.OPERATOR, status: UserStatus.INACTIVE },
    });

    // Upsert UserActors for Tenant B
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN_B_ID },
      create: { id: ACTOR_ADMIN_B_ID, tenantId: TENANT_B_ID, username: 'admin_b', email: 'admin_b@example.com', fullName: 'Admin Tenant B', role: UserRole.ADMIN_TENANT, status: UserStatus.ACTIVE },
      update: { role: UserRole.ADMIN_TENANT, status: UserStatus.ACTIVE },
    });

    // Upsert Target Student Fixtures
    await adminPrisma.student.upsert({
      where: { id: TARGET_STUDENT_A_ID },
      create: { id: TARGET_STUDENT_A_ID, tenantId: TENANT_A_ID, nisn: '0011223344', nis: '1001', fullName: 'Siswa Target A', className: 'XII-A' },
      update: { fullName: 'Siswa Target A', className: 'XII-A' },
    });
    await adminPrisma.student.upsert({
      where: { id: TARGET_STUDENT_B_ID },
      create: { id: TARGET_STUDENT_B_ID, tenantId: TENANT_B_ID, nisn: '0011223355', nis: '1002', fullName: 'Siswa Target B', className: 'XII-B' },
      update: { fullName: 'Siswa Target B', className: 'XII-B' },
    });

    assert(true, 'Test fixtures initialized cleanly');

    // -----------------------------------------------------------------
    // SECTION 3: AUTHENTICATED CREATION & SECURITY INVARIANTS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Authenticated Invitation Creation ---');

    // Mock session for Tenant A Operator
    const mockOperatorSession: AuthenticatedActorContext = {
      tenantId: TENANT_A_ID,
      actorId: ACTOR_OPERATOR_A_ID,
      username: 'op_a',
      role: UserRole.OPERATOR,
      status: UserStatus.ACTIVE,
    };
    setSessionProvider({
      getSession: async () => mockOperatorSession,
    });

    const createRes = await createPublicUploadInvitationAction({
      recipientEmail: 'ortu.siswa@example.com',
      recipientName: 'Orang Tua Siswa',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      expiresInHours: 72,
      maxUploadAttempts: 3,
    });

    assert(createRes.success === true, 'createPublicUploadInvitationAction succeeded');
    const createdInvitation = createRes.data!;
    assert(Boolean(createdInvitation.id), 'Invitation record has a generated UUID');
    assert(Boolean(createdInvitation.rawToken), 'Raw token is returned exactly ONCE at creation');
    assert(createdInvitation.recipientEmail === 'ortu.siswa@example.com', 'Recipient email matches');
    assert(createdInvitation.status === PublicUploadInvitationStatus.PENDING, 'Initial status is PENDING');
    assert(createdInvitation.uploadAttempts === 0, 'Initial upload attempts is 0');
    assert(createdInvitation.maxUploadAttempts === 3, 'Max upload attempts is 3');

    // Verify DB Persistence: Stores ONLY SHA-256 hash, never the raw token!
    const dbRecord = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: createdInvitation.id },
    });
    assert(Boolean(dbRecord), 'Invitation persisted in PostgreSQL database');
    assert(dbRecord?.tenantId === TENANT_A_ID, 'Invitation belongs to Tenant A');
    assert(dbRecord?.tokenHash === hashInvitationToken(createdInvitation.rawToken), 'Database stores exact SHA-256 hash');
    // Verify that the table schema has no raw_token column
    assert(!('rawToken' in (dbRecord as any)) && !('raw_token' in (dbRecord as any)), 'Raw token column does not exist on table');

    // Verify Audit Event recorded
    const auditRecord = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityId: createdInvitation.id,
        action: 'CREATE_PUBLIC_INVITATION',
      },
    });
    assert(Boolean(auditRecord), 'AuditEvent CREATE_PUBLIC_INVITATION recorded');

    // -----------------------------------------------------------------
    // SECTION 4: INVITATION READ & RAW TOKEN PRIVACY
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Read Action & Token Privacy Invariant ---');

    const readRes = await getPublicUploadInvitationAction(createdInvitation.id);
    assert(readRes.success === true, 'getPublicUploadInvitationAction succeeded');
    const readData = readRes.data!;
    assert(readData.id === createdInvitation.id, 'Read invitation ID matches');
    assert(!('rawToken' in (readData as any)), 'Raw token is NOT exposed in read DTO');
    assert(!('tokenHash' in (readData as any)), 'Token hash is NOT exposed in read DTO');

    // -----------------------------------------------------------------
    // SECTION 5: PUBLIC TOKEN LOOKUP & VALIDATION (FAIL-CLOSED INVARIANTS)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Public Token Lookup & Fail-Closed Invariants ---');

    // 1. Valid Token Lookup (Least-Privilege Disclosure)
    const validLookup = await validatePublicUploadInvitationToken(createdInvitation.rawToken);
    assert(validLookup.isValid === true, 'Valid raw token lookup returns isValid: true');
    assert(validLookup.invitation?.id === createdInvitation.id, 'Lookup correctly resolves invitation metadata');
    assert(validLookup.invitation?.recipientName === 'Orang Tua Siswa', 'Lookup returns recipientName for UI');
    assert(validLookup.invitation?.documentCategory === DocumentCategory.IDENTITAS, 'Lookup returns documentCategory');
    assert(!('tenantId' in (validLookup.invitation as any)), 'Least-Privilege: tenantId is NOT exposed to public caller');
    assert(!('recipientEmail' in (validLookup.invitation as any)), 'Least-Privilege: recipientEmail is NOT exposed to public caller');
    assert(!('targetEntityId' in (validLookup.invitation as any)), 'Least-Privilege: targetEntityId is NOT exposed to public caller');
    assert(!('targetEntityType' in (validLookup.invitation as any)), 'Least-Privilege: targetEntityType is NOT exposed to public caller');

    // 2. Non-existent Token Lookup
    const fakeToken = generateInvitationToken();
    const fakeLookup = await validatePublicUploadInvitationToken(fakeToken);
    assert(fakeLookup.isValid === false, 'Non-existent token lookup fails');
    assert(fakeLookup.errorCode === 'NOT_FOUND', 'ErrorCode is NOT_FOUND for unknown token');

    // 3. Expired Token Invariant
    const expiredRes = await createPublicUploadInvitationAction({
      recipientEmail: 'expired.user@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      expiresInHours: 1,
    });
    // Artificially age the expiration in DB
    await adminPrisma.publicUploadInvitation.update({
      where: { id: expiredRes.data!.id },
      data: { expiresAt: new Date(Date.now() - 10000) }, // 10 seconds in the past
    });
    const expiredLookup = await validatePublicUploadInvitationToken(expiredRes.data!.rawToken);
    assert(expiredLookup.isValid === false, 'Expired invitation fails validation');
    assert(expiredLookup.errorCode === 'EXPIRED', 'ErrorCode is EXPIRED');

    // 4. Max Upload Attempts Exceeded Invariant
    const maxAttemptsRes = await createPublicUploadInvitationAction({
      recipientEmail: 'attempts.user@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      maxUploadAttempts: 2,
    });
    // Set upload attempts = max
    await adminPrisma.publicUploadInvitation.update({
      where: { id: maxAttemptsRes.data!.id },
      data: { uploadAttempts: 2 },
    });
    const maxAttemptsLookup = await validatePublicUploadInvitationToken(maxAttemptsRes.data!.rawToken);
    assert(maxAttemptsLookup.isValid === false, 'Max upload attempts reached fails validation');
    assert(maxAttemptsLookup.errorCode === 'MAX_ATTEMPTS_EXCEEDED', 'ErrorCode is MAX_ATTEMPTS_EXCEEDED');

    // 5. Already Submitted Invariant
    const submittedRes = await createPublicUploadInvitationAction({
      recipientEmail: 'submitted.user@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    await adminPrisma.publicUploadInvitation.update({
      where: { id: submittedRes.data!.id },
      data: { status: PublicUploadInvitationStatus.SUBMITTED, consumedAt: new Date() },
    });
    const submittedLookup = await validatePublicUploadInvitationToken(submittedRes.data!.rawToken);
    assert(submittedLookup.isValid === false, 'Submitted invitation fails validation');
    assert(submittedLookup.errorCode === 'ALREADY_SUBMITTED', 'ErrorCode is ALREADY_SUBMITTED');

    // -----------------------------------------------------------------
    // SECTION 6: REVOCATION FLOW & AUDIT
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Revocation & Audit Verification ---');

    const revokeRes = await revokePublicUploadInvitationAction({
      invitationId: createdInvitation.id,
      reason: 'Permintaan dibatalkan oleh sekolah',
    });
    assert(revokeRes.success === true, 'revokePublicUploadInvitationAction succeeded');
    assert(revokeRes.data?.status === PublicUploadInvitationStatus.REVOKED, 'Status updated to REVOKED');

    // Verify revoked token lookup fails closed
    const revokedLookup = await validatePublicUploadInvitationToken(createdInvitation.rawToken);
    assert(revokedLookup.isValid === false, 'Revoked token lookup fails validation');
    assert(revokedLookup.errorCode === 'REVOKED', 'ErrorCode is REVOKED');

    // Verify Revoke Audit Event recorded
    const revokeAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        entityId: createdInvitation.id,
        action: 'REVOKE_PUBLIC_INVITATION',
      },
    });
    assert(Boolean(revokeAudit), 'AuditEvent REVOKE_PUBLIC_INVITATION recorded');

    // -----------------------------------------------------------------
    // SECTION 7: CROSS-TENANT RLS ISOLATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Cross-Tenant RLS Rejection ---');

    // Create an invitation in Tenant B
    const mockAdminBSession: AuthenticatedActorContext = {
      tenantId: TENANT_B_ID,
      actorId: ACTOR_ADMIN_B_ID,
      username: 'admin_b',
      role: UserRole.ADMIN_TENANT,
      status: UserStatus.ACTIVE,
    };
    setSessionProvider({
      getSession: async () => mockAdminBSession,
    });

    const tenantBInvitation = await createPublicUploadInvitationAction({
      recipientEmail: 'ortu.tenantb@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_B_ID,
    });
    assert(tenantBInvitation.success === true, 'Tenant B successfully created invitation');

    // Switch back to Tenant A session and attempt to read / revoke Tenant B's invitation
    setSessionProvider({
      getSession: async () => mockOperatorSession,
    });

    const crossReadRes = await getPublicUploadInvitationAction(tenantBInvitation.data!.id);
    assert(crossReadRes.success === false, 'Cross-tenant invitation read is rejected');
    assert(crossReadRes.error?.code === 'VALIDATION_ERROR' || crossReadRes.error?.code === 'DOMAIN_ERROR', 'Cross-tenant read returns error');

    const crossRevokeRes = await revokePublicUploadInvitationAction({
      invitationId: tenantBInvitation.data!.id,
    });
    assert(crossRevokeRes.success === false, 'Cross-tenant invitation revocation is rejected');

    // -----------------------------------------------------------------
    // SECTION 8: AUTHENTICATION & RBAC ENFORCEMENT
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 8: Authentication & RBAC Enforcement ---');

    // 1. Inactive User Session
    const mockInactiveSession: AuthenticatedActorContext = {
      tenantId: TENANT_A_ID,
      actorId: ACTOR_INACTIVE_A_ID,
      username: 'inactive_a',
      role: UserRole.OPERATOR,
      status: UserStatus.INACTIVE,
    };
    setSessionProvider({
      getSession: async () => mockInactiveSession,
    });

    const inactiveRes = await createPublicUploadInvitationAction({
      recipientEmail: 'test@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    assert(inactiveRes.success === false, 'Inactive actor is rejected');
    assert(inactiveRes.error?.code === 'UNAUTHENTICATED', 'Inactive actor receives UNAUTHENTICATED error code');

    // 2. Unauthorized Role (AUDITOR cannot create invitations)
    const mockAuditorSession: AuthenticatedActorContext = {
      tenantId: TENANT_A_ID,
      actorId: ACTOR_AUDITOR_A_ID,
      username: 'auditor_a',
      role: UserRole.AUDITOR,
      status: UserStatus.ACTIVE,
    };
    setSessionProvider({
      getSession: async () => mockAuditorSession,
    });

    const unauthorizedRes = await createPublicUploadInvitationAction({
      recipientEmail: 'test@example.com',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    assert(unauthorizedRes.success === false, 'Unauthorized role (AUDITOR) is rejected');
    assert(unauthorizedRes.error?.code === 'FORBIDDEN', 'Unauthorized role receives FORBIDDEN error code');

    // -----------------------------------------------------------------
    // SECTION 9: SUMMARY REPORT
    // -----------------------------------------------------------------
    console.log('\n=====================================================');
    console.log(` ALL ${passCount} / ${testCount} INVITATION CORE TESTS PASSED `);
    console.log('=====================================================\n');
  } finally {
    resetSessionProvider();
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runPublicUploadInvitationTests().catch((err) => {
  console.error('Fatal error in public upload invitation tests:', err);
  process.exit(1);
});
