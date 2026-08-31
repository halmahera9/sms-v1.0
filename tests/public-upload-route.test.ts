import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, DocumentCategory, PublicUploadInvitationStatus, DocumentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/public/upload/route';
import { createPublicUploadInvitationAction } from '../src/domains/document/invitation/actions';
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

async function runPublicUploadRouteTests() {
  console.log('=====================================================');
  console.log(' PHASE 5B: PUBLIC DOCUMENT UPLOAD HTTP ROUTE SUITE   ');
  console.log('=====================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '91111111-1111-7111-8111-111111111111';
  const ACTOR_ADMIN_A_ID = '9a111111-1111-7111-8111-111111111111';
  const TARGET_STUDENT_A_ID = '9e111111-1111-7111-8111-111111111111';

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Fixture Setup ---');

    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Route Test Tenant', code: 'ROUTE_TENANT', status: 'ACTIVE' },
      update: { name: 'Route Test Tenant', code: 'ROUTE_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ADMIN_A_ID },
      create: {
        id: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_route',
        email: 'admin_route@test.local',
        fullName: 'Admin Route',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    assert(true, 'Test fixtures initialized cleanly');

    // -----------------------------------------------------------------
    // SECTION 2: HTTP BOUNDARY INPUT VALIDATION (400 VALIDATION_ERROR)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: HTTP Boundary Input Validation ---');

    // Test 1: Missing token field in FormData
    {
      const formData = new FormData();
      formData.append('file', new File([Buffer.from('test content')], 'test.pdf', { type: 'application/pdf' }));

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Missing token returns HTTP 400');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
      assert(json.error?.message === 'Token field is required.', 'Error message indicates token required');
    }

    // Test 2: Empty/whitespace token in FormData
    {
      const formData = new FormData();
      formData.append('token', '   ');
      formData.append('file', new File([Buffer.from('test content')], 'test.pdf', { type: 'application/pdf' }));

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Empty/whitespace token returns HTTP 400');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
      assert(json.error?.message === 'Token field is required.', 'Error message indicates token required');
    }

    // Test 3: Missing file field in FormData
    {
      const formData = new FormData();
      formData.append('token', 'some-valid-looking-token-12345');

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Missing file returns HTTP 400');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
      assert(json.error?.message === 'File field is required.', 'Error message indicates file required');
    }

    // Test 4: File field is string instead of File
    {
      const formData = new FormData();
      formData.append('token', 'some-valid-looking-token-12345');
      formData.append('file', 'not-a-file-instance');

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Non-File field returns HTTP 400');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
      assert(json.error?.message === 'File field is required.', 'Error message indicates file required');
    }

    // -----------------------------------------------------------------
    // SECTION 3: SUCCESSFUL MULTIPART UPLOAD (HTTP 200)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Successful Multipart Upload (HTTP 200) ---');

    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_route',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createRes = await createPublicUploadInvitationAction({
      recipientEmail: 'wali.murid@example.com',
      recipientName: 'Bapak Ahmad',
      documentCategory: DocumentCategory.IDENTITAS,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
      expiresInHours: 24,
      maxUploadAttempts: 3,
    });

    assert(createRes.success && !!createRes.data?.rawToken, 'Invitation created for HTTP route test');
    const validRawToken = createRes.data!.rawToken;
    const validInvitationId = createRes.data!.id;

    resetSessionProvider();

    const samplePdfBytes = Buffer.from('%PDF-1.4 Route Test Document Content');
    const sampleFile = new File([samplePdfBytes], 'kartu-keluarga.pdf', { type: 'application/pdf' });

    const successFormData = new FormData();
    successFormData.append('token', validRawToken);
    successFormData.append('file', sampleFile);

    const successReq = new NextRequest('http://localhost:3000/api/public/upload', {
      method: 'POST',
      body: successFormData,
    });

    const successRes = await POST(successReq);
    const successJson = await successRes.json();

    assert(successRes.status === 200, 'Successful upload returns HTTP 200');
    assert(successJson.success === true, 'Response JSON has success: true');
    assert(successJson.data?.invitationId === validInvitationId, 'Returned invitationId matches');
    assert(!!successJson.data?.documentId, 'Returned canonical documentId');
    assert(!!successJson.data?.documentVersionId, 'Returned canonical documentVersionId');
    assert(successJson.data?.fileName === 'kartu-keluarga.pdf', 'Returned fileName matches');
    assert(successJson.data?.fileSize === samplePdfBytes.byteLength, 'Returned fileSize matches bytes');
    assert(successJson.data?.status === PublicUploadInvitationStatus.SUBMITTED, 'Returned status is SUBMITTED');
    assert(!!successJson.data?.consumedAt, 'Returned consumedAt timestamp');

    // Database Invariant check
    const dbInv = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: validInvitationId },
    });
    assert(dbInv?.status === PublicUploadInvitationStatus.SUBMITTED, 'Database invitation status is SUBMITTED');
    assert(dbInv?.uploadAttempts === 1, 'Database uploadAttempts is 1');

    // -----------------------------------------------------------------
    // SECTION 4: TOKEN TRIMMING & FILE DELEGATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Token Trimming & File Delegation ---');

    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_route',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createTrimRes = await createPublicUploadInvitationAction({
      recipientEmail: 'trim.test@example.com',
      documentCategory: DocumentCategory.FOTO,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });

    const rawTrimToken = createTrimRes.data!.rawToken;
    const trimInvId = createTrimRes.data!.id;

    resetSessionProvider();

    const imageBytes = Buffer.from('PNG_FAKE_IMAGE_BYTES_123456');
    const imageFile = new File([imageBytes], 'pasfoto.png', { type: 'image/png' });

    // Append token with surrounding whitespace
    const trimFormData = new FormData();
    trimFormData.append('token', `   ${rawTrimToken}   \n`);
    trimFormData.append('file', imageFile);

    const trimReq = new NextRequest('http://localhost:3000/api/public/upload', {
      method: 'POST',
      body: trimFormData,
    });

    const trimRes = await POST(trimReq);
    const trimJson = await trimRes.json();

    assert(trimRes.status === 200, 'Whitespace-padded token is trimmed and succeeds with HTTP 200');
    assert(trimJson.success === true, 'Response has success: true');
    assert(trimJson.data?.invitationId === trimInvId, 'Invitation ID matches');
    assert(trimJson.data?.fileName === 'pasfoto.png', 'File name preserved correctly');

    // -----------------------------------------------------------------
    // SECTION 5: DOMAIN VALIDATION ERROR MAPPING (HTTP 400)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Domain Validation Error Mapping (HTTP 400) ---');

    setSessionProvider({
      getSession: async (): Promise<AuthenticatedActorContext | null> => ({
        actorId: ACTOR_ADMIN_A_ID,
        tenantId: TENANT_A_ID,
        username: 'admin_route',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      }),
    });

    const createEmptyFileRes = await createPublicUploadInvitationAction({
      recipientEmail: 'empty.file@example.com',
      documentCategory: DocumentCategory.SERTIFIKAT,
      targetEntityType: 'Student',
      targetEntityId: TARGET_STUDENT_A_ID,
    });

    const emptyFileToken = createEmptyFileRes.data!.rawToken;

    resetSessionProvider();

    // Pass an empty file (0 bytes) -> triggers domain validation error
    const emptyFormData = new FormData();
    emptyFormData.append('token', emptyFileToken);
    emptyFormData.append('file', new File([], 'empty.pdf', { type: 'application/pdf' }));

    const emptyReq = new NextRequest('http://localhost:3000/api/public/upload', {
      method: 'POST',
      body: emptyFormData,
    });

    const emptyRes = await POST(emptyReq);
    const emptyJson = await emptyRes.json();

    assert(emptyRes.status === 400, 'Domain validation error maps to HTTP 400');
    assert(emptyJson.success === false, 'Response has success: false');
    assert(emptyJson.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // -----------------------------------------------------------------
    // SECTION 6: DOMAIN ERROR MAPPING (HTTP 400)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Domain Error Mapping (HTTP 400) ---');

    // Case 6A: Re-submitting already consumed token -> DOMAIN_ERROR -> 400
    {
      const reSubmitFormData = new FormData();
      reSubmitFormData.append('token', validRawToken);
      reSubmitFormData.append('file', new File([Buffer.from('doc bytes')], 'doc.pdf', { type: 'application/pdf' }));

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: reSubmitFormData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Already submitted invitation returns HTTP 400');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'DOMAIN_ERROR', 'Error code is DOMAIN_ERROR');
      assert(json.error?.message.includes('telah digunakan'), 'Message indicates already submitted');
    }

    // Case 6B: Revoked token -> DOMAIN_ERROR -> 400
    {
      setSessionProvider({
        getSession: async (): Promise<AuthenticatedActorContext | null> => ({
          actorId: ACTOR_ADMIN_A_ID,
          tenantId: TENANT_A_ID,
          username: 'admin_route',
          role: 'ADMIN_TENANT',
          status: 'ACTIVE',
        }),
      });

      const createRevRes = await createPublicUploadInvitationAction({
        recipientEmail: 'rev.route@example.com',
        documentCategory: DocumentCategory.SK_PNS,
        targetEntityType: 'Student',
        targetEntityId: TARGET_STUDENT_A_ID,
      });
      const revToken = createRevRes.data!.rawToken;
      const revId = createRevRes.data!.id;

      await adminPrisma.publicUploadInvitation.update({
        where: { id: revId },
        data: { status: PublicUploadInvitationStatus.REVOKED },
      });

      resetSessionProvider();

      const revFormData = new FormData();
      revFormData.append('token', revToken);
      revFormData.append('file', new File([Buffer.from('doc bytes')], 'sk.pdf', { type: 'application/pdf' }));

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: revFormData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Revoked invitation returns HTTP 400');
      assert(json.error?.code === 'DOMAIN_ERROR', 'Error code is DOMAIN_ERROR');
      assert(json.error?.message.includes('dicabut'), 'Message indicates revoked');
    }

    // Case 6C: Expired token -> DOMAIN_ERROR -> 400
    {
      setSessionProvider({
        getSession: async (): Promise<AuthenticatedActorContext | null> => ({
          actorId: ACTOR_ADMIN_A_ID,
          tenantId: TENANT_A_ID,
          username: 'admin_route',
          role: 'ADMIN_TENANT',
          status: 'ACTIVE',
        }),
      });

      const createExpRes = await createPublicUploadInvitationAction({
        recipientEmail: 'exp.route@example.com',
        documentCategory: DocumentCategory.SK_CPNS,
        targetEntityType: 'Student',
        targetEntityId: TARGET_STUDENT_A_ID,
      });
      const expToken = createExpRes.data!.rawToken;
      const expId = createExpRes.data!.id;

      await adminPrisma.publicUploadInvitation.update({
        where: { id: expId },
        data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60) },
      });

      resetSessionProvider();

      const expFormData = new FormData();
      expFormData.append('token', expToken);
      expFormData.append('file', new File([Buffer.from('doc bytes')], 'skcpns.pdf', { type: 'application/pdf' }));

      const req = new NextRequest('http://localhost:3000/api/public/upload', {
        method: 'POST',
        body: expFormData,
      });

      const res = await POST(req);
      const json = await res.json();

      assert(res.status === 400, 'Expired invitation returns HTTP 400');
      assert(json.error?.code === 'DOMAIN_ERROR', 'Error code is DOMAIN_ERROR');
      assert(json.error?.message.includes('kedaluwarsa'), 'Message indicates expired');
    }

    // -----------------------------------------------------------------
    // SECTION 7: INTERNAL / UNHANDLED ERROR MAPPING (HTTP 500)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Internal Error Mapping (HTTP 500) ---');

    {
      // Mock request whose formData() throws an unexpected error
      const malformedReq = {
        formData: async () => {
          throw new Error('Unexpected stream parser failure');
        },
      } as unknown as NextRequest;

      const res = await POST(malformedReq);
      const json = await res.json();

      assert(res.status === 500, 'Unexpected exception returns HTTP 500');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'INTERNAL_ERROR', 'Error code is INTERNAL_ERROR');
      assert(json.error?.message === 'Internal server error.', 'Message is Internal server error.');
    }

    console.log('\n=====================================================');
    console.log(` ALL ${passCount} / ${testCount} ROUTE TESTS PASSED `);
    console.log('=====================================================\n');
  } finally {
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runPublicUploadRouteTests().catch((err) => {
  console.error('Route Test Suite Exception:', err);
  process.exit(1);
});
