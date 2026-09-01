import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';
import {
  PrismaClient,
  DocumentCategory,
  DocumentStatus,
  DocumentProcessingStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentProcessingJobRunner } from '../src/platform/services/document-processing-runner';
import {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineRequest,
  DocumentIntelligencePipelineResult,
} from '../src/platform/types';

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

class MockOrchestrator implements IDocumentIntelligenceOrchestrator {
  public lastRequest: DocumentIntelligencePipelineRequest | null = null;
  public callCount = 0;
  public mockOutcome: 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED' | 'THROW' = 'COMPLETED';
  public errorMessage: string | null = null;

  async process(request: DocumentIntelligencePipelineRequest): Promise<DocumentIntelligencePipelineResult> {
    this.callCount++;
    this.lastRequest = request;

    if (this.mockOutcome === 'THROW') {
      throw new Error(this.errorMessage || 'Simulated fatal unhandled exception');
    }

    if (this.mockOutcome === 'FAILED') {
      return {
        status: 'FAILED',
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
        errorMessage: this.errorMessage || 'Simulated pipeline failure',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    return {
      status: this.mockOutcome,
      documentId: request.documentId,
      documentVersionId: request.documentVersionId,
      processedItems: [],
      summary: {
        totalItemsExtracted: 1,
        itemsResolved: 1,
        itemsUnresolved: 0,
        itemsAmbiguous: 0,
        validationErrorsCount: 0,
        exceptionsCreatedCount: 0,
        itemsRequiringReview: this.mockOutcome === 'REQUIRES_REVIEW' ? 1 : 0,
      },
      exceptionIds: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}

async function runDocumentProcessingJobRunnerTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2-B: DOCUMENT PROCESSING JOB RUNNER TEST SUITE        ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '95555555-5555-7555-8555-555555555555';
  const TENANT_B_ID = '96666666-6666-7666-8666-666666666666';
  const ACTOR_A_ID = '9a555555-5555-7555-8555-555555555555';
  const ACTOR_B_ID = '9b666666-6666-7666-8666-666666666666';

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURE SETUP & TEARDOWN PREPARATION
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Fixture Setup ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.exceptionItem.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_A_ID },
      create: { id: TENANT_A_ID, name: 'Phase 5E Runner Tenant A', code: 'PHASE_5E_RUNNER_A', status: 'ACTIVE' },
      update: { name: 'Phase 5E Runner Tenant A', code: 'PHASE_5E_RUNNER_A', status: 'ACTIVE' },
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_B_ID },
      create: { id: TENANT_B_ID, name: 'Phase 5E Runner Tenant B', code: 'PHASE_5E_RUNNER_B', status: 'ACTIVE' },
      update: { name: 'Phase 5E Runner Tenant B', code: 'PHASE_5E_RUNNER_B', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: { id: ACTOR_A_ID, tenantId: TENANT_A_ID, username: 'actor_a_runner', email: 'actor_a@runner.test', fullName: 'Actor A', role: 'OPERATOR', status: 'ACTIVE' },
      update: { tenantId: TENANT_A_ID, role: 'OPERATOR', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_B_ID },
      create: { id: ACTOR_B_ID, tenantId: TENANT_B_ID, username: 'actor_b_runner', email: 'actor_b@runner.test', fullName: 'Actor B', role: 'OPERATOR', status: 'ACTIVE' },
      update: { tenantId: TENANT_B_ID, role: 'OPERATOR', status: 'ACTIVE' },
    });

    assert(true, 'Fixtures initialized cleanly for Phase 5E.2-B Runner suite');

    // Helper to create test document, version, and job
    async function createTestJob(opts: {
      tenantId: string;
      actorId: string;
      status?: DocumentProcessingStatus;
      attempts?: number;
      maxAttempts?: number;
      lastError?: string | null;
      metadata?: Record<string, unknown>;
    }) {
      const docId = crypto.randomUUID();
      const verId = crypto.randomUUID();
      const jobId = crypto.randomUUID();

      await adminPrisma.document.create({
        data: {
          id: docId,
          tenantId: opts.tenantId,
          title: 'Runner Test Doc',
          category: DocumentCategory.LAINNYA,
          status: DocumentStatus.PENDING_VERIFICATION,
          currentVersion: 1,
        },
      });

      await adminPrisma.documentVersion.create({
        data: {
          id: verId,
          tenantId: opts.tenantId,
          documentId: docId,
          versionNumber: 1,
          filePath: `tenants/${opts.tenantId}/documents/${docId}/v1.pdf`,
          fileSizeBytes: BigInt(1024),
          mimeType: 'application/pdf',
          checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      });

      const job = await adminPrisma.documentProcessingJob.create({
        data: {
          id: jobId,
          tenantId: opts.tenantId,
          documentId: docId,
          documentVersionId: verId,
          actorId: opts.actorId,
          targetDomain: 'student',
          status: opts.status || DocumentProcessingStatus.QUEUED,
          attempts: opts.attempts ?? 0,
          maxAttempts: opts.maxAttempts ?? 3,
          lastError: opts.lastError || null,
          metadata: (opts.metadata as any) || { testKey: 'testVal' },
        },
      });

      return { docId, verId, jobId, job };
    }

    // -----------------------------------------------------------------
    // SECTION 2: ATOMIC CLAIMING OF QUEUED JOBS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Atomic Job Claiming ---');

    const mockOrch = new MockOrchestrator();
    const runner = new DocumentProcessingJobRunner(mockOrch, adminPrisma);

    const { jobId: job1Id } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
    });

    const claim1 = await runner.claimJob(TENANT_A_ID, job1Id);
    assert(claim1 !== null, 'Queued job successfully claimed by runner');
    assert(claim1?.id === job1Id, 'Claimed job ID matches');
    assert(claim1?.status === DocumentProcessingStatus.PROCESSING, 'Claimed job status transitioned to PROCESSING');
    assert(claim1?.attempts === 1, 'Claimed job attempt counter incremented to 1');

    // Verify DB state
    const job1Db = await adminPrisma.documentProcessingJob.findUnique({ where: { id: job1Id } });
    assert(job1Db?.status === DocumentProcessingStatus.PROCESSING, 'Database reflects status PROCESSING');
    assert(job1Db?.attempts === 1, 'Database reflects attempts = 1');

    // Attempt to re-claim already PROCESSING job
    const claim1Again = await runner.claimJob(TENANT_A_ID, job1Id);
    assert(claim1Again === null, 'PROCESSING job cannot be claimed again');

    // -----------------------------------------------------------------
    // SECTION 3: CONCURRENT CLAIMING RACE CONDITION PREVENTION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Concurrent Claiming Serialization ---');

    const { jobId: raceJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
    });

    const runnerA = new DocumentProcessingJobRunner(mockOrch, adminPrisma);
    const runnerB = new DocumentProcessingJobRunner(mockOrch, adminPrisma);

    // Fire two claims simultaneously
    const [raceResA, raceResB] = await Promise.all([
      runnerA.claimJob(TENANT_A_ID, raceJobId),
      runnerB.claimJob(TENANT_A_ID, raceJobId),
    ]);

    const claimsWon = [raceResA, raceResB].filter((r) => r !== null);
    const claimsLost = [raceResA, raceResB].filter((r) => r === null);

    assert(claimsWon.length === 1, 'Exactly one concurrent runner won the claim');
    assert(claimsLost.length === 1, 'Exactly one concurrent runner lost the claim');

    const raceJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: raceJobId } });
    assert(raceJobDb?.status === DocumentProcessingStatus.PROCESSING, 'Final status is PROCESSING');
    assert(raceJobDb?.attempts === 1, 'Attempt count strictly incremented once under concurrency');

    // -----------------------------------------------------------------
    // SECTION 4: SUCCESSFUL ORCHESTRATION LIFECYCLE (-> COMPLETED)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Successful Orchestration Lifecycle ---');

    mockOrch.mockOutcome = 'COMPLETED';
    mockOrch.callCount = 0;
    mockOrch.lastRequest = null;

    const { jobId: successJobId, docId: sDocId, verId: sVerId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      metadata: { customField: 'phase5e_payload' },
    });

    const execSuccess = await runner.executeJob(TENANT_A_ID, successJobId);

    assert(execSuccess.success === true, 'executeJob returned success: true');
    assert(execSuccess.finalStatus === DocumentProcessingStatus.COMPLETED, 'finalStatus is COMPLETED');
    assert(execSuccess.attempts === 1, 'attempts count is 1');
    assert(execSuccess.processedAt !== null && execSuccess.processedAt !== undefined, 'processedAt is populated');
    assert(mockOrch.callCount === 1, 'Orchestrator was invoked exactly once');

    // Verify context passed to orchestrator
    const capturedRequest = mockOrch.lastRequest as DocumentIntelligencePipelineRequest | null;
    assert(capturedRequest?.tenantId === TENANT_A_ID, 'Passed correct tenantId');
    assert(capturedRequest?.actorId === ACTOR_A_ID, 'Passed correct actorId');
    assert(capturedRequest?.documentId === sDocId, 'Passed correct documentId');
    assert(capturedRequest?.documentVersionId === sVerId, 'Passed correct documentVersionId');
    assert(capturedRequest?.targetDomain === 'student', 'Passed correct targetDomain');
    assert(capturedRequest?.metadata?.customField === 'phase5e_payload', 'Passed full metadata context');

    // Verify DB state
    const successJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: successJobId } });
    assert(successJobDb?.status === DocumentProcessingStatus.COMPLETED, 'Database status is COMPLETED');
    assert(successJobDb?.processedAt !== null, 'Database processedAt is set');
    assert(successJobDb?.lastError === null, 'Database lastError is null');

    // -----------------------------------------------------------------
    // SECTION 5: RETRY LIFECYCLE ON ORCHESTRATION FAILURE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Retry Lifecycle on Failure ---');

    mockOrch.mockOutcome = 'FAILED';
    mockOrch.errorMessage = 'Temporary upstream OCR timeout';

    const { jobId: retryJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      attempts: 0,
      maxAttempts: 3,
    });

    const execRetry = await runner.executeJob(TENANT_A_ID, retryJobId);

    assert(execRetry.success === false, 'executeJob returned success: false on pipeline failure');
    assert(execRetry.finalStatus === DocumentProcessingStatus.QUEUED, 'Job returned to QUEUED status for retry');
    assert(execRetry.attempts === 1, 'attempts incremented to 1');
    assert(execRetry.error === 'Temporary upstream OCR timeout', 'Captured error message');

    const retryJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: retryJobId } });
    assert(retryJobDb?.status === DocumentProcessingStatus.QUEUED, 'Database status returned to QUEUED');
    assert(retryJobDb?.attempts === 1, 'Database attempts is 1');
    assert(retryJobDb?.lastError === 'Temporary upstream OCR timeout', 'Database lastError preserved');
    assert(retryJobDb?.processedAt === null, 'Database processedAt remains null while retrying');

    // -----------------------------------------------------------------
    // SECTION 6: TERMINAL FAILURE WHEN MAX ATTEMPTS EXHAUSTED
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Terminal Failure on Max Attempts ---');

    mockOrch.mockOutcome = 'FAILED';
    mockOrch.errorMessage = 'Permanent binary decode failure';

    const { jobId: fatalJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      attempts: 2,
      maxAttempts: 3,
    });

    const execFatal = await runner.executeJob(TENANT_A_ID, fatalJobId);

    assert(execFatal.success === false, 'executeJob returned success: false');
    assert(execFatal.finalStatus === DocumentProcessingStatus.FAILED, 'Job transitioned to FAILED status');
    assert(execFatal.attempts === 3, 'attempts reached maxAttempts (3)');
    assert(execFatal.error === 'Permanent binary decode failure', 'Error context preserved');

    const fatalJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: fatalJobId } });
    assert(fatalJobDb?.status === DocumentProcessingStatus.FAILED, 'Database status is FAILED');
    assert(fatalJobDb?.attempts === 3, 'Database attempts is 3');
    assert(fatalJobDb?.lastError === 'Permanent binary decode failure', 'Database lastError is set');
    assert(fatalJobDb?.processedAt !== null, 'Database processedAt is populated for terminal FAILED state');

    // -----------------------------------------------------------------
    // SECTION 7: IDEMPOTENCY & STATUS GUARDS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Idempotency & Terminal Guards ---');

    // 7.1 COMPLETED job cannot execute again
    const execCompletedAgain = await runner.executeJob(TENANT_A_ID, successJobId);
    assert(execCompletedAgain.success === false, 'COMPLETED job cannot execute again');
    assert(execCompletedAgain.finalStatus === DocumentProcessingStatus.COMPLETED, 'Status remains COMPLETED');

    // 7.2 FAILED job cannot execute automatically
    const execFailedAgain = await runner.executeJob(TENANT_A_ID, fatalJobId);
    assert(execFailedAgain.success === false, 'FAILED job cannot execute automatically');
    assert(execFailedAgain.finalStatus === DocumentProcessingStatus.FAILED, 'Status remains FAILED');

    // -----------------------------------------------------------------
    // SECTION 8: TENANT ISOLATION
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 8: Tenant Isolation ---');

    const { jobId: tenantAJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
    });

    // Tenant B runner attempts to claim Tenant A job
    const crossClaim = await runner.claimJob(TENANT_B_ID, tenantAJobId);
    assert(crossClaim === null, 'Tenant B runner cannot claim Tenant A job');

    // Tenant B runner attempts to execute Tenant A job
    const crossExec = await runner.executeJob(TENANT_B_ID, tenantAJobId);
    assert(crossExec.success === false, 'Tenant B runner cannot execute Tenant A job');

    // Tenant A job remains untouched in QUEUED status
    const isolatedJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: tenantAJobId } });
    assert(isolatedJobDb?.status === DocumentProcessingStatus.QUEUED, 'Tenant A job remains strictly QUEUED');
    assert(isolatedJobDb?.attempts === 0, 'Tenant A job attempt count remains 0');

    // -----------------------------------------------------------------
    // SECTION 9: UNHANDLED EXCEPTION RESILIENCE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 9: Unhandled Exception Resilience ---');

    mockOrch.mockOutcome = 'THROW';
    mockOrch.errorMessage = 'Network connection reset by peer';

    const { jobId: crashJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      attempts: 0,
      maxAttempts: 3,
    });

    const execCrash = await runner.executeJob(TENANT_A_ID, crashJobId);
    assert(execCrash.success === false, 'Unhandled exception handled gracefully without crash');
    assert(execCrash.finalStatus === DocumentProcessingStatus.QUEUED, 'Job requeued for retry after unhandled error');
    assert(execCrash.error === 'Network connection reset by peer', 'Error message safely captured');

    const crashJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: crashJobId } });
    assert(crashJobDb?.status === DocumentProcessingStatus.QUEUED, 'Database status is QUEUED');
    assert(crashJobDb?.lastError === 'Network connection reset by peer', 'Database recorded crash error message');

    console.log('\n================================================================');
    console.log(` ALL ${testCount} / ${testCount} PHASE 5E.2-B TESTS PASSED `);
    console.log('================================================================\n');
  } finally {
    // Teardown test artifacts
    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.exceptionItem.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });

    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runDocumentProcessingJobRunnerTests().catch((err) => {
  console.error('Phase 5E.2-B Runner test runner failed:', err);
  process.exit(1);
});
