import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, DocumentCategory, PublicUploadInvitationStatus, DocumentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { submitPublicDocumentUploadAction } from '../src/domains/document/invitation/upload';
import { createPublicUploadInvitationAction } from '../src/domains/document/invitation/actions';
import { generateInvitationToken, hashInvitationToken } from '../src/domains/document/invitation/token';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';
import {
  InMemoryObjectStorageProvider,
  calculateSha256,
  IObjectStorageProvider,
  UploadObjectInput,
  StorageObjectMetadata,
} from '../src/platform/storage';

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

async function runPublicUploadSubmissionTests() {
  console.log('=====================================================');
  console.log(' PHASE 5B: PUBLIC DOCUMENT UPLOAD SUBMISSION SUITE  ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '91111111-1111-7111-8111-111111111111';
  const TENANT_B_ID = '92222222-2222-7222-8222-222222222222';

  const ACTOR_ADMIN_A_ID = '9a111111-1111-7111-8111-111111111111';
  const TARGET_STUDENT_A_ID = '9e111111-1111-7111-8111-111111111111';

  const storageProvider = new InMemoryObjectStorageProvider();

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Fixture Setup ---');

    // Clean up test records
    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    // Upsert Tenants
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Submission Tenant A', code: 'SUB_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Submission Tenant A', code: 'SUB_TENANT_A', status: 'ACTIVE' },
    });
    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Submission Tenant B', code: 'SUB_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Submission Tenant B', code: 'SUB_TENANT_B', status: 'ACTIVE' },
    });

    // Upsert Admin Actor for Tenant A
    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN_A_ID },
      create: {
        id: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        email: 'admin_sub_a@test.local',
        fullName: 'Admin Sub A',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    assert(true, 'Test fixtures initialized cleanly');

    // -----------------------------------------------------------------
    // SECTION 2: CANONICAL SUCCESSFUL PUBLIC UPLOAD SUBMISSION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Canonical Successful Public Upload ---');

    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createRes = await createPublicUploadInvitationAction({
      recipientEmail: 'wali.murid@example.com',
      recipientName: 'Bapak Budi',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      expiresInHours: 24,
      maxUploadAttempts: 3,
    });

    assert(createRes.success && !!createRes.data?.rawToken, 'Invitation created with valid rawToken');
    const rawToken1 = createRes.data!.rawToken;
    const invitation1Id = createRes.data!.id;

    // Reset session provider to simulate completely unauthenticated public caller
    resetSessionProvider();

    const samplePdfContent = Buffer.from('%PDF-1.4 sample public document payload for testing');
    const expectedChecksum = calculateSha256(samplePdfContent);

    const uploadRes = await submitPublicDocumentUploadAction(
      rawToken1,
      samplePdfContent,
      'kartu-keluarga.pdf',
      'application/pdf',
      storageProvider
    );

    assert(uploadRes.success === true, 'submitPublicDocumentUploadAction succeeded');
    assert(uploadRes.data?.invitationId === invitation1Id, 'Returned invitationId matches');
    assert(!!uploadRes.data?.documentId, 'Returned canonical documentId exists');
    assert(!!uploadRes.data?.documentVersionId, 'Returned canonical documentVersionId exists');
    assert(uploadRes.data?.documentCategory === DocumentCategory.IDENTITAS, 'Returned category matches');
    assert(uploadRes.data?.fileName === 'kartu-keluarga.pdf', 'Returned fileName matches');
    assert(uploadRes.data?.fileSize === samplePdfContent.byteLength, 'Returned fileSize matches bytes');
    assert(uploadRes.data?.checksumSha256 === expectedChecksum, 'Returned checksum matches calculated SHA-256');
    assert(uploadRes.data?.status === PublicUploadInvitationStatus.SUBMITTED, 'Returned status is SUBMITTED');
    assert(!!uploadRes.data?.consumedAt, 'Returned consumedAt timestamp exists');

    // Invariant Verification in Database
    const dbInvitation = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: invitation1Id },
    });
    assert(dbInvitation !== null, 'Invitation found in database');
    assert(dbInvitation?.status === PublicUploadInvitationStatus.SUBMITTED, 'Database invitation status is SUBMITTED');
    assert(dbInvitation?.consumedAt !== null, 'Database invitation consumedAt is populated');
    assert(dbInvitation?.documentId === uploadRes.data?.documentId, 'Database invitation documentId points to canonical Document');
    assert(dbInvitation?.uploadAttempts === 1, 'Database invitation uploadAttempts incremented to 1');

    // Canonical Document verification
    const dbDoc = await adminPrisma.document.findUnique({
      where: { id: uploadRes.data!.documentId },
    });
    assert(dbDoc !== null, 'Canonical Document record exists in database');
    assert(dbDoc?.tenantId === TENANT_A_ID, 'Canonical Document belongs to Tenant A (resolved server-side)');
    assert(dbDoc?.title === 'kartu-keluarga.pdf', 'Canonical Document title matches');
    assert(dbDoc?.category === DocumentCategory.IDENTITAS, 'Canonical Document category matches');
    assert(dbDoc?.currentVersion === 1, 'Canonical Document currentVersion is 1');
    assert(dbDoc?.status === DocumentStatus.PENDING_VERIFICATION, 'Canonical Document status is PENDING_VERIFICATION');

    // Canonical DocumentVersion verification
    const dbDocVersion = await adminPrisma.documentVersion.findUnique({
      where: { id: uploadRes.data!.documentVersionId },
    });
    assert(dbDocVersion !== null, 'Canonical DocumentVersion record exists in database');
    assert(dbDocVersion?.tenantId === TENANT_A_ID, 'Canonical DocumentVersion belongs to Tenant A');
    assert(dbDocVersion?.documentId === dbDoc?.id, 'Canonical DocumentVersion documentId matches Document id');
    assert(dbDocVersion?.versionNumber === 1, 'Canonical DocumentVersion versionNumber is 1');
    assert(dbDocVersion?.checksumSha256 === expectedChecksum, 'Canonical DocumentVersion checksum matches real SHA-256');
    assert(Number(dbDocVersion?.fileSizeBytes) === samplePdfContent.byteLength, 'Canonical DocumentVersion fileSizeBytes matches');
    assert(dbDocVersion?.mimeType === 'application/pdf', 'Canonical DocumentVersion mimeType matches');

    // Object Storage verification
    const downloadedBuffer = await storageProvider.download(TENANT_A_ID, dbDocVersion!.filePath);
    assert(downloadedBuffer.equals(samplePdfContent), 'Downloaded binary from storage matches uploaded bytes');

    // -----------------------------------------------------------------
    // SECTION 3: RE-SUBMISSION & FAIL-CLOSED STATE INVARIANTS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Re-Submission & Fail-Closed Invariants ---');

    // Test 1: Re-submitting already SUBMITTED invitation fails
    const reSubmitRes = await submitPublicDocumentUploadAction(
      rawToken1,
      samplePdfContent,
      'kartu-keluarga-lagi.pdf',
      'application/pdf',
      storageProvider
    );
    assert(reSubmitRes.success === false, 'Re-submission of already SUBMITTED invitation fails');
    assert(reSubmitRes.error?.message.includes('telah digunakan') || reSubmitRes.error?.code === 'DOMAIN_ERROR', 'Error indicates already submitted');

    // Verify uploadAttempts was NOT incremented on rejected re-submission
    const dbInvitationAfterReject = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: invitation1Id },
    });
    assert(dbInvitationAfterReject?.uploadAttempts === 1, 'uploadAttempts remains 1 after rejected re-submission');

    // Test 2: Revoked invitation fails
    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createRevokedRes = await createPublicUploadInvitationAction({
      recipientEmail: 'revoked.user@example.com',
      documentCategory: DocumentCategory.FOTO,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    const revokedToken = createRevokedRes.data!.rawToken;
    const revokedId = createRevokedRes.data!.id;

    // Revoke directly
    await adminPrisma.publicUploadInvitation.update({
      where: { id: revokedId },
      data: { status: PublicUploadInvitationStatus.REVOKED },
    });

    resetSessionProvider();

    const revokedUploadRes = await submitPublicDocumentUploadAction(
      revokedToken,
      samplePdfContent,
      'foto.png',
      'image/png',
      storageProvider
    );
    assert(revokedUploadRes.success === false, 'Upload to REVOKED invitation fails');
    assert(revokedUploadRes.error?.message.includes('dicabut') || revokedUploadRes.error?.code === 'DOMAIN_ERROR', 'Error indicates invitation revoked');

    // Test 3: Expired invitation fails
    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createExpiredRes = await createPublicUploadInvitationAction({
      recipientEmail: 'expired.user@example.com',
      documentCategory: DocumentCategory.SK_PNS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    const expiredToken = createExpiredRes.data!.rawToken;
    const expiredId = createExpiredRes.data!.id;

    // Set expires_at in the past
    await adminPrisma.publicUploadInvitation.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60) },
    });

    resetSessionProvider();

    const expiredUploadRes = await submitPublicDocumentUploadAction(
      expiredToken,
      samplePdfContent,
      'sk-pns.pdf',
      'application/pdf',
      storageProvider
    );
    assert(expiredUploadRes.success === false, 'Upload to EXPIRED invitation fails');
    assert(expiredUploadRes.error?.message.includes('kedaluwarsa') || expiredUploadRes.error?.code === 'DOMAIN_ERROR', 'Error indicates invitation expired');

    // Test 4: Max upload attempts reached fails
    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createMaxRes = await createPublicUploadInvitationAction({
      recipientEmail: 'max.attempts@example.com',
      documentCategory: DocumentCategory.SERTIFIKAT,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      maxUploadAttempts: 3,
    });
    const maxToken = createMaxRes.data!.rawToken;
    const maxId = createMaxRes.data!.id;

    await adminPrisma.publicUploadInvitation.update({
      where: { id: maxId },
      data: { uploadAttempts: 3 },
    });

    resetSessionProvider();

    const maxUploadRes = await submitPublicDocumentUploadAction(
      maxToken,
      samplePdfContent,
      'sertifikat.pdf',
      'application/pdf',
      storageProvider
    );
    assert(maxUploadRes.success === false, 'Upload to MAX_ATTEMPTS_EXCEEDED invitation fails');
    assert(maxUploadRes.error?.message.includes('maksimum') || maxUploadRes.error?.code === 'DOMAIN_ERROR', 'Error indicates max attempts exceeded');

    // Test 5: Invalid / fake token fails
    const fakeUploadRes = await submitPublicDocumentUploadAction(
      'fake-invalid-token-123456789012345678901234567890',
      samplePdfContent,
      'doc.pdf',
      'application/pdf',
      storageProvider
    );
    assert(fakeUploadRes.success === false, 'Upload with non-existent token fails');
    assert(fakeUploadRes.error?.code === 'VALIDATION_ERROR' || fakeUploadRes.error?.code === 'DOMAIN_ERROR', 'Error returned for non-existent token');

    // Test 6: Empty payload / buffer validation
    const emptyPayloadRes = await submitPublicDocumentUploadAction(
      rawToken1,
      Buffer.alloc(0),
      'empty.pdf',
      'application/pdf',
      storageProvider
    );
    assert(emptyPayloadRes.success === false, 'Empty file buffer is rejected at input validation');
    assert(emptyPayloadRes.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // -----------------------------------------------------------------
    // SECTION 4: CONCURRENT SUBMISSION ATTEMPTS SERIALIZATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Concurrent Submission Serialization ---');

    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createConcurrentRes = await createPublicUploadInvitationAction({
      recipientEmail: 'concurrent.upload@example.com',
      recipientName: 'Concurrent User',
      documentCategory: DocumentCategory.SKP_2_TAHUN,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      maxUploadAttempts: 3,
    });
    const concurrentToken = createConcurrentRes.data!.rawToken;
    const concurrentId = createConcurrentRes.data!.id;

    resetSessionProvider();

    const bufferA = Buffer.from('%PDF-1.4 Concurrent Payload Alpha');
    const bufferB = Buffer.from('%PDF-1.4 Concurrent Payload Beta');

    // Dispatch two concurrent submission promises simultaneously
    const [resA, resB] = await Promise.all([
      submitPublicDocumentUploadAction(concurrentToken, bufferA, 'skp-alpha.pdf', 'application/pdf', storageProvider),
      submitPublicDocumentUploadAction(concurrentToken, bufferB, 'skp-beta.pdf', 'application/pdf', storageProvider),
    ]);

    const successCount = (resA.success ? 1 : 0) + (resB.success ? 1 : 0);
    const failureCount = (!resA.success ? 1 : 0) + (!resB.success ? 1 : 0);

    assert(successCount === 1, 'Exactly one concurrent submission succeeded (race serialized)');
    assert(failureCount === 1, 'Exactly one concurrent submission failed (already submitted / locked)');

    const finalConcurrentDb = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: concurrentId },
    });
    assert(finalConcurrentDb?.status === PublicUploadInvitationStatus.SUBMITTED, 'Final concurrent invitation status is SUBMITTED');
    assert(finalConcurrentDb?.uploadAttempts === 1, 'Final uploadAttempts is strictly 1 (no double increment)');

    // -----------------------------------------------------------------
    // SECTION 5: STORAGE FAILURE & DATABASE COMPENSATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Storage Failure & DB Compensation ---');

    // Case 1: Storage Upload Failure -> Invitation is NOT consumed
    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createStorageFailRes = await createPublicUploadInvitationAction({
      recipientEmail: 'storage.fail@example.com',
      documentCategory: DocumentCategory.DP3,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    const storageFailToken = createStorageFailRes.data!.rawToken;
    const storageFailId = createStorageFailRes.data!.id;

    resetSessionProvider();

    // Mock storage provider that fails on upload
    const failingStorageProvider: IObjectStorageProvider = {
      upload: async () => {
        throw new Error('STORAGE_DISK_FULL: Simulated disk write failure');
      },
      download: async () => Buffer.alloc(0),
      delete: async () => true,
    };

    const failUploadRes = await submitPublicDocumentUploadAction(
      storageFailToken,
      samplePdfContent,
      'dp3.pdf',
      'application/pdf',
      failingStorageProvider
    );
    assert(failUploadRes.success === false, 'Storage failure results in action failure');

    const dbStorageFailInv = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: storageFailId },
    });
    assert(dbStorageFailInv?.status === PublicUploadInvitationStatus.PENDING, 'Invitation remains PENDING after storage failure');
    assert(dbStorageFailInv?.uploadAttempts === 0, 'uploadAttempts remains 0 after storage failure');
    assert(dbStorageFailInv?.consumedAt === null, 'consumedAt remains null after storage failure');
    assert(dbStorageFailInv?.documentId === null, 'documentId remains null after storage failure');

    // Case 2: DB Failure after Storage Write -> Storage Compensation Deletes File
    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_sub_a',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createCompRes = await createPublicUploadInvitationAction({
      recipientEmail: 'compensation.test@example.com',
      documentCategory: DocumentCategory.LAINNYA,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });
    const compToken = createCompRes.data!.rawToken;
    const compId = createCompRes.data!.id;

    resetSessionProvider();

    const compState = {
      uploadCalled: false,
      compensationDeleteCalled: false,
      deletedPath: null as string | null,
      deletedTenantId: null as string | null,
    };

    const compensatingStorageProvider: IObjectStorageProvider = {
      upload: async (input: UploadObjectInput): Promise<StorageObjectMetadata> => {
        compState.uploadCalled = true;
        const metadata = await storageProvider.upload(input);
        return {
          ...metadata,
          checksumSha256: 'a'.repeat(100), // Exceeds @db.VarChar(64) to deterministically fail tx.documentVersion.create
        };
      },
      download: async (tenantId: string, path: string) => storageProvider.download(tenantId, path),
      delete: async (tenantId: string, path: string) => {
        compState.compensationDeleteCalled = true;
        compState.deletedPath = path;
        compState.deletedTenantId = tenantId;
        return storageProvider.delete(tenantId, path);
      },
    };

    const compUploadRes = await submitPublicDocumentUploadAction(
      compToken,
      samplePdfContent,
      'compensate-fail.pdf',
      'application/pdf',
      compensatingStorageProvider
    );

    assert(compUploadRes.success === false, 'Compensation submission failed due to simulated DB error');
    assert(compState.uploadCalled === true, 'storageProvider.upload was invoked prior to DB failure');
    assert(compState.compensationDeleteCalled === true, 'storageProvider.delete was invoked on DB failure compensation');
    assert(compState.deletedTenantId === TENANT_A_ID, 'storageProvider.delete targeted the exact tenantId');
    assert(
      compState.deletedPath !== null &&
        compState.deletedPath.includes(TENANT_A_ID) &&
        compState.deletedPath.endsWith('compensate-fail.pdf'),
      'storageProvider.delete targeted the exact storagePath'
    );

    const compInvInDb = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: compId },
    });
    assert(compInvInDb?.status === PublicUploadInvitationStatus.PENDING, 'Invitation remains PENDING after DB failure compensation');
    assert(compInvInDb?.consumedAt === null, 'consumedAt remains null after DB failure compensation');
    assert(compInvInDb?.documentId === null, 'documentId remains null after DB failure compensation');
    assert(compInvInDb?.uploadAttempts === 0, 'uploadAttempts is unchanged (0) after DB failure compensation');

    const orphanedDocs = await adminPrisma.document.findMany({
      where: { title: 'compensate-fail.pdf' },
    });
    assert(orphanedDocs.length === 0, 'No canonical Document record was persisted after compensation');

    console.log('\n=====================================================');
    console.log(` ALL ${passCount} / ${testCount} SUBMISSION TESTS PASSED `);
    console.log('=====================================================\n');
  } finally {
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runPublicUploadSubmissionTests().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
