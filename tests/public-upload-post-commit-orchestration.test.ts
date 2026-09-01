import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import {
  PrismaClient,
  DocumentCategory,
  PublicUploadInvitationStatus,
  DocumentStatus,
  DocumentProcessingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { submitPublicDocumentUploadAction } from '../src/domains/document/invitation/upload';
import { createPublicUploadInvitationAction } from '../src/domains/document/invitation/actions';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';
import { InMemoryObjectStorageProvider } from '../src/platform/storage';

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

async function runPostCommitOrchestrationTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2-A: DOCUMENT PROCESSING JOB ATOMIC PERSISTENCE SUITE ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '95555555-5555-7555-8555-555555555555';
  const TENANT_B_ID = '96666666-6666-7666-8666-666666666666';
  const ACTOR_CREATOR_A_ID = '9a555555-5555-7555-8555-555555555555';
  const ACTOR_CREATOR_B_ID = '9b666666-6666-7666-8666-666666666666';
  const TARGET_STUDENT_A_ID = '9e555555-5555-7555-8555-555555555555';

  const storageProvider = new InMemoryObjectStorageProvider();

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Fixture Setup ---');
    await adminPrisma.documentProcessingJob.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.exceptionItem.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.publicUploadInvitation.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.documentVersion.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.document.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.student.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Phase 5E Tenant A', code: 'PHASE_5E2_TENANT_A', status: 'ACTIVE' },
      update: { name: 'Phase 5E Tenant A', code: 'PHASE_5E2_TENANT_A', status: 'ACTIVE' },
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Phase 5E Tenant B', code: 'PHASE_5E2_TENANT_B', status: 'ACTIVE' },
      update: { name: 'Phase 5E Tenant B', code: 'PHASE_5E2_TENANT_B', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_CREATOR_A_ID },
      create: {
        id: ACTOR_CREATOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'creator_5e_a',
        email: 'creator_5e_a@test.local',
        fullName: 'Creator Phase 5E A',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_CREATOR_B_ID },
      create: {
        id: ACTOR_CREATOR_B_ID,
        tenantId: TENANT_B_ID,
        username: 'creator_5e_b',
        email: 'creator_5e_b@test.local',
        fullName: 'Creator Phase 5E B',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.student.upsert({
      where: { id: TARGET_STUDENT_A_ID },
      create: {
        id: TARGET_STUDENT_A_ID,
        tenantId: TENANT_A_ID,
        nisn: '0055555555',
        nis: '12345',
        fullName: 'Budi Test 5E',
        className: 'X IPA 1',
      },
      update: {},
    });

    assert(true, 'Fixtures initialized cleanly for Phase 5E.2-A');

    // Helper: Create an invitation in Tenant A
    async function createTestInvitation(): Promise<{ invitationId: string; rawToken: string }> {
      setSessionProvider({
        getSession: async (): Promise<AuthenticatedActorContext | null> => ({
          actorId: ACTOR_CREATOR_A_ID,
          tenantId: TENANT_A_ID,
          username: 'creator_5e_a',
          role: 'ADMIN_TENANT',
          status: 'ACTIVE',
        }),
      });

      const createRes = await createPublicUploadInvitationAction({
        recipientEmail: 'student.parent@test.local',
        recipientName: 'Wali Murid Budi',
        documentCategory: DocumentCategory.SURAT_PENGANTAR,
        targetEntityType: 'Student',
        targetEntityId: TARGET_STUDENT_A_ID,
        expiresInHours: 24,
      });

      resetSessionProvider();

      if (!createRes.success || !createRes.data) {
        throw new Error(`Failed to create test invitation: ${createRes.error?.message}`);
      }

      return {
        invitationId: createRes.data.id,
        rawToken: createRes.data.rawToken,
      };
    }

    // -----------------------------------------------------------------
    // SECTION 2: ATOMIC PERSISTENCE OF DOCUMENT PROCESSING JOB
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Atomic Persistence of DocumentProcessingJob ---');

    const inv1 = await createTestInvitation();
    const samplePdfBuffer = Buffer.from('%PDF-1.4 canonical test pdf content for 5e.2-a');

    const uploadRes1 = await submitPublicDocumentUploadAction(
      {
        rawToken: inv1.rawToken,
        fileName: 'surat_keterangan_sakit.pdf',
        fileBuffer: samplePdfBuffer,
        mimeType: 'application/pdf',
      },
      undefined,
      undefined,
      undefined,
      storageProvider
    );

    assert(uploadRes1.success === true, 'Upload submission returned success');
    assert(uploadRes1.data !== undefined, 'Upload response data is defined');
    assert(typeof uploadRes1.data?.processingJobId === 'string', 'Returned processingJobId is a string UUID');

    const processingJobId = uploadRes1.data!.processingJobId!;

    // 1. Verify DocumentProcessingJob record exists in DB
    const dbJob = await adminPrisma.documentProcessingJob.findUnique({
      where: { id: processingJobId },
    });

    assert(dbJob !== null, 'DocumentProcessingJob record persisted in database');
    assert(dbJob?.tenantId === TENANT_A_ID, 'Job tenantId matches Tenant A');
    assert(dbJob?.documentId === uploadRes1.data!.documentId, 'Job documentId matches committed Document');
    assert(dbJob?.documentVersionId === uploadRes1.data!.documentVersionId, 'Job documentVersionId matches committed DocumentVersion');
    assert(dbJob?.actorId === ACTOR_CREATOR_A_ID, 'Job actorId is mapped to the invitation creator');
    assert(dbJob?.targetDomain === 'student', 'Job targetDomain is resolved to "student"');
    assert(dbJob?.status === DocumentProcessingStatus.QUEUED, 'Job initial status is strictly QUEUED');
    assert(dbJob?.attempts === 0, 'Job initial attempts count is strictly 0');
    assert(dbJob?.maxAttempts === 3, 'Job maxAttempts is strictly 3');
    assert(dbJob?.lastError === null, 'Job lastError is initially null');
    assert(dbJob?.createdAt !== null, 'Job createdAt timestamp is set');
    assert(dbJob?.updatedAt !== null, 'Job updatedAt timestamp is set');
    assert(dbJob?.processedAt === null, 'Job processedAt is initially null');

    // 2. Verify Execution Context in Metadata (Worker does not need to re-read invitation)
    const meta = dbJob?.metadata as Record<string, any>;
    assert(meta !== null && typeof meta === 'object', 'Job metadata is valid JSON object');
    assert(meta.invitationId === inv1.invitationId, 'metadata.invitationId matches');
    assert(meta.targetEntityType === 'Student', 'metadata.targetEntityType matches');
    assert(meta.targetEntityId === TARGET_STUDENT_A_ID, 'metadata.targetEntityId matches');
    assert(meta.documentCategory === DocumentCategory.SURAT_PENGANTAR, 'metadata.documentCategory matches');
    assert(meta.fileName === 'surat_keterangan_sakit.pdf', 'metadata.fileName matches');
    assert(meta.fileSizeBytes === samplePdfBuffer.byteLength, 'metadata.fileSizeBytes matches');
    assert(typeof meta.checksumSha256 === 'string', 'metadata.checksumSha256 is present');
    assert(typeof meta.storagePath === 'string', 'metadata.storagePath is present');
    assert(meta.mimeType === 'application/pdf', 'metadata.mimeType matches');

    // 3. Verify Document and Version are committed
    const dbDoc = await adminPrisma.document.findUnique({
      where: { id: uploadRes1.data!.documentId },
    });
    assert(dbDoc?.status === DocumentStatus.PENDING_VERIFICATION, 'Document status is PENDING_VERIFICATION');

    const dbInv = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: inv1.invitationId },
    });
    assert(dbInv?.status === PublicUploadInvitationStatus.SUBMITTED, 'Invitation status is SUBMITTED');
    assert(dbInv?.uploadAttempts === 1, 'Invitation uploadAttempts is 1');

    // -----------------------------------------------------------------
    // SECTION 3: IDEMPOTENCY PROTECTION (Unique on tenant_id, document_version_id)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Idempotency Protection ---');

    let duplicateJobErrorCaught = false;
    try {
      await adminPrisma.documentProcessingJob.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: TENANT_A_ID,
          documentId: uploadRes1.data!.documentId,
          documentVersionId: uploadRes1.data!.documentVersionId, // DUPLICATE VERSION ID
          actorId: ACTOR_CREATOR_A_ID,
          targetDomain: 'student',
          status: DocumentProcessingStatus.QUEUED,
        },
      });
    } catch (err: any) {
      duplicateJobErrorCaught = true;
    }
    assert(duplicateJobErrorCaught === true, 'Duplicate DocumentProcessingJob for same version is rejected by unique constraint');

    // -----------------------------------------------------------------
    // SECTION 4: TENANT ISOLATION (Tenant B cannot access Tenant A Jobs)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Tenant Isolation ---');

    const tenantBJobs = await adminPrisma.documentProcessingJob.findMany({
      where: { tenantId: TENANT_B_ID },
    });
    assert(tenantBJobs.length === 0, 'Tenant B has zero processing jobs (Tenant A jobs isolated)');

    // -----------------------------------------------------------------
    // SECTION 5: AUDIT TRAIL ATOMIC PERSISTENCE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Audit Trail Verification ---');

    const uploadAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_A_ID,
        action: 'PUBLIC_UPLOAD_SUBMITTED',
        entityId: inv1.invitationId,
      },
    });
    assert(uploadAudit !== null, 'PUBLIC_UPLOAD_SUBMITTED audit event exists in DB');
    const auditMeta = uploadAudit?.payloadJson as Record<string, any>;
    assert(auditMeta?.metadata?.processingJobId === processingJobId, 'AuditEvent captures processingJobId');

    console.log('\n================================================================');
    console.log(` ALL ${testCount} / ${testCount} PHASE 5E.2-A TESTS PASSED `);
    console.log('================================================================\n');
  } finally {
    // Cleanup fixtures
    await adminPrisma.documentProcessingJob.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.exceptionItem.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.publicUploadInvitation.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.documentVersion.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.document.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.student.deleteMany({ where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } } });
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runPostCommitOrchestrationTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
