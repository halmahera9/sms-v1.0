import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import { PrismaClient, DocumentCategory, PublicUploadInvitationStatus, DocumentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { submitPublicDocumentUploadAction } from '../src/domains/document/invitation/upload';
import { createPublicUploadInvitationAction } from '../src/domains/document/invitation/actions';
import {
  setSessionProvider,
  resetSessionProvider,
  AuthenticatedActorContext,
} from '../src/platform/auth';
import {
  InMemoryObjectStorageProvider,
} from '../src/platform/storage';
import {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineRequest,
  DocumentIntelligencePipelineResult,
} from '../src/platform/types';
import { DocumentIntelligenceOrchestrator } from '../src/platform/services/document-intelligence';
import { PostgresAuditEventRepository } from '../src/platform/repositories/audit-event';
import { PostgresExceptionRepository } from '../src/platform/repositories/exception';

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

class SpyOrchestrator implements IDocumentIntelligenceOrchestrator {
  public callCount = 0;
  public lastRequest?: DocumentIntelligencePipelineRequest;
  public shouldThrow = false;
  public returnStatus: 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED' = 'COMPLETED';

  public async process(
    request: DocumentIntelligencePipelineRequest
  ): Promise<DocumentIntelligencePipelineResult> {
    this.callCount++;
    this.lastRequest = request;

    if (this.shouldThrow) {
      throw new Error('Simulated downstream OCR infrastructure timeout');
    }

    return {
      status: this.returnStatus,
      documentId: request.documentId,
      documentVersionId: request.documentVersionId,
      processedItems: [],
      summary: {
        totalItemsExtracted: 0,
        itemsResolved: 0,
        itemsUnresolved: 0,
        itemsAmbiguous: 0,
        validationErrorsCount: 0,
        exceptionsCreatedCount: 0,
        itemsRequiringReview: 0,
      },
      exceptionIds: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}

async function runPostCommitOrchestrationTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2: POST-COMMIT INTELLIGENCE TRIGGER TEST SUITE       ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_ID = '95555555-5555-7555-8555-555555555555';
  const ACTOR_CREATOR_ID = '9a555555-5555-7555-8555-555555555555';
  const TARGET_STUDENT_ID = '9e555555-5555-7555-8555-555555555555';

  const storageProvider = new InMemoryObjectStorageProvider();

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP
    // -----------------------------------------------------------------
    await adminPrisma.exceptionItem.deleteMany({ where: { tenantId: TENANT_ID } });
    await adminPrisma.publicUploadInvitation.deleteMany({ where: { tenantId: TENANT_ID } });
    await adminPrisma.documentVersion.deleteMany({ where: { tenantId: TENANT_ID } });
    await adminPrisma.document.deleteMany({ where: { tenantId: TENANT_ID } });
    await adminPrisma.student.deleteMany({ where: { tenantId: TENANT_ID } });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_ID },
      create: { id: TENANT_ID, name: 'Phase 5E Tenant', code: 'PHASE_5E2_TENANT', status: 'ACTIVE' },
      update: { name: 'Phase 5E Tenant', code: 'PHASE_5E2_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_CREATOR_ID },
      create: {
        id: ACTOR_CREATOR_ID,
        tenantId: TENANT_ID,
        username: 'creator_5e',
        email: 'creator_5e@test.local',
        fullName: 'Creator Phase 5E',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.student.upsert({
      where: { id: TARGET_STUDENT_ID },
      create: {
        id: TARGET_STUDENT_ID,
        tenantId: TENANT_ID,
        nisn: '0055555555',
        nis: '12345',
        fullName: 'Budi Test 5E',
        className: 'X IPA 1',
      },
      update: {},
    });

    assert(true, 'Fixtures initialized cleanly for Phase 5E.2');

    // Helper: Create an invitation
    async function createTestInvitation(): Promise<{ invitationId: string; rawToken: string }> {
      setSessionProvider({
        getSession: async (): Promise<AuthenticatedActorContext | null> => ({
          actorId: ACTOR_CREATOR_ID,
          tenantId: TENANT_ID,
          username: 'creator_5e',
          role: 'ADMIN_TENANT',
          status: 'ACTIVE',
        }),
      });

      const createRes = await createPublicUploadInvitationAction({
        recipientEmail: 'student.parent@test.local',
        recipientName: 'Wali Murid Budi',
        documentCategory: DocumentCategory.SURAT_PENGANTAR,
        targetEntityType: 'Student',
        targetEntityId: TARGET_STUDENT_ID,
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
    // SECTION 2: CANONICAL POST-COMMIT TRIGGER DISPATCH
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Canonical Post-Commit Trigger Dispatch ---');

    const inv1 = await createTestInvitation();
    const spyOrchestrator = new SpyOrchestrator();

    const samplePdfBuffer = Buffer.from('%PDF-1.4 canonical test pdf content for 5e');
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
      storageProvider,
      spyOrchestrator
    );

    assert(uploadRes1.success === true, 'Upload submission returned success');
    assert(spyOrchestrator.callCount === 1, 'Orchestrator was called exactly once post-commit');
    assert(spyOrchestrator.lastRequest !== undefined, 'Orchestration request payload is defined');
    assert(spyOrchestrator.lastRequest?.tenantId === TENANT_ID, 'tenantId correctly forwarded');
    assert(spyOrchestrator.lastRequest?.actorId === ACTOR_CREATOR_ID, 'actorId mapped to invitation creator');
    assert(spyOrchestrator.lastRequest?.documentId === uploadRes1.data?.documentId, 'documentId matches committed document');
    assert(spyOrchestrator.lastRequest?.documentVersionId === uploadRes1.data?.documentVersionId, 'documentVersionId matches committed version');
    assert(spyOrchestrator.lastRequest?.targetDomain === 'student', 'targetDomain mapped to student');
    assert(spyOrchestrator.lastRequest?.metadata?.invitationId === inv1.invitationId, 'metadata.invitationId matches');
    assert(spyOrchestrator.lastRequest?.metadata?.targetEntityType === 'Student', 'metadata.targetEntityType matches');
    assert(spyOrchestrator.lastRequest?.metadata?.targetEntityId === TARGET_STUDENT_ID, 'metadata.targetEntityId matches');

    // -----------------------------------------------------------------
    // SECTION 3: DOWNSTREAM FAULT ISOLATION (Orchestrator Throws Exception)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Fault Isolation: Orchestrator Exception Does Not Rollback ---');

    const inv2 = await createTestInvitation();
    const throwingOrchestrator = new SpyOrchestrator();
    throwingOrchestrator.shouldThrow = true;

    const uploadRes2 = await submitPublicDocumentUploadAction(
      {
        rawToken: inv2.rawToken,
        fileName: 'surat_sakit_failing_orch.pdf',
        fileBuffer: samplePdfBuffer,
        mimeType: 'application/pdf',
      },
      undefined,
      undefined,
      undefined,
      storageProvider,
      throwingOrchestrator
    );

    assert(uploadRes2.success === true, 'Upload submission returned success despite orchestrator throwing');
    assert(throwingOrchestrator.callCount === 1, 'Failing orchestrator was called post-commit');

    // Verify DB committed state is intact
    const dbDoc = await adminPrisma.document.findUnique({
      where: { id: uploadRes2.data!.documentId },
    });
    assert(dbDoc !== null, 'Canonical Document remains committed in DB');
    assert(dbDoc?.status === DocumentStatus.PENDING_VERIFICATION, 'Document status is PENDING_VERIFICATION');

    const dbVersion = await adminPrisma.documentVersion.findUnique({
      where: { id: uploadRes2.data!.documentVersionId },
    });
    assert(dbVersion !== null, 'Canonical DocumentVersion remains committed in DB');

    const dbInv = await adminPrisma.publicUploadInvitation.findUnique({
      where: { id: inv2.invitationId },
    });
    assert(dbInv?.status === PublicUploadInvitationStatus.SUBMITTED, 'Invitation remains committed as SUBMITTED');
    assert(dbInv?.uploadAttempts === 1, 'uploadAttempts is strictly 1');
    assert(dbInv?.consumedAt !== null, 'consumedAt is not null');

    const downloadedFile = await storageProvider.download(TENANT_ID, dbVersion!.filePath);
    assert(downloadedFile.byteLength > 0, 'Object in storage is NOT deleted because DB committed successfully');

    // -----------------------------------------------------------------
    // SECTION 4: REAL END-TO-END ORCHESTRATOR TRIGGER
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Real DocumentIntelligenceOrchestrator Integration ---');

    const inv3 = await createTestInvitation();
    const auditRepo = new PostgresAuditEventRepository();
    const exceptionRepo = new PostgresExceptionRepository(auditRepo);
    const realOrchestrator = new DocumentIntelligenceOrchestrator(auditRepo, exceptionRepo);

    const uploadRes3 = await submitPublicDocumentUploadAction(
      {
        rawToken: inv3.rawToken,
        fileName: 'real_orchestration_test.pdf',
        fileBuffer: samplePdfBuffer,
        mimeType: 'application/pdf',
      },
      undefined,
      undefined,
      undefined,
      storageProvider,
      realOrchestrator
    );

    assert(uploadRes3.success === true, 'Upload succeeded with real orchestrator');

    // Verify both AuditEvents exist in DB
    const uploadAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_ID,
        action: 'PUBLIC_UPLOAD_SUBMITTED',
        entityId: inv3.invitationId,
      },
    });
    assert(uploadAudit !== null, 'PUBLIC_UPLOAD_SUBMITTED audit event exists in DB');

    const diAudit = await adminPrisma.auditEvent.findFirst({
      where: {
        tenantId: TENANT_ID,
        action: 'PROCESS_DOCUMENT_INTELLIGENCE',
        entityId: uploadRes3.data!.documentId,
      },
    });
    assert(diAudit !== null, 'PROCESS_DOCUMENT_INTELLIGENCE audit event recorded in DB via real orchestrator');

    console.log('\n================================================================');
    console.log(` ALL ${testCount} / ${testCount} POST-COMMIT ORCHESTRATION TESTS PASSED `);
    console.log('================================================================\n');
  } finally {
    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runPostCommitOrchestrationTests().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
