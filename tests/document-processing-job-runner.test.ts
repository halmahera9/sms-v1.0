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
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../src/platform/types';
import { InMemoryObjectStorageProvider } from '../src/platform/storage';
import { DeterministicDocumentExtractor } from '../src/platform/services/document-extractor';

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

class MockExtractor implements IDocumentExtractor {
  public lastRequest: DocumentExtractionRequest | null = null;
  public callCount = 0;
  public mockOutcome: 'SUCCESS' | 'FAIL' | 'THROW' = 'SUCCESS';
  public mockItems: ExtractedDocumentItem[] = [];
  public errorMessage: string | null = null;

  async extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    this.callCount++;
    this.lastRequest = request;

    if (this.mockOutcome === 'THROW') {
      throw new Error(this.errorMessage || 'Extractor crashed unhandled');
    }

    if (this.mockOutcome === 'FAIL') {
      return {
        success: false,
        items: [],
        errorMessage: this.errorMessage || 'Extraction failed to parse document layout',
      };
    }

    return {
      success: true,
      items: this.mockItems.length > 0 ? this.mockItems : (request.metadata?.items as ExtractedDocumentItem[]) || [],
      pageCount: 1,
    };
  }
}

async function runDocumentProcessingJobRunnerTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2-B / 5E.2-C: DOCUMENT PROCESSING JOB RUNNER SUITE    ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '95555555-5555-7555-8555-555555555555';
  const TENANT_B_ID = '96666666-6666-7666-8666-666666666666';
  const ACTOR_A_ID = '9a555555-5555-7555-8555-555555555555';
  const ACTOR_B_ID = '9b666666-6666-7666-8666-666666666666';

  const storageProvider = new InMemoryObjectStorageProvider();
  const samplePdfBytes = Buffer.from('%PDF-1.4 sample binary test payload for extraction');

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

    assert(true, 'Fixtures initialized cleanly for Phase 5E.2 Runner suite');

    // Helper to create test document, version, binary in storage, and job
    async function createTestJob(opts: {
      tenantId: string;
      actorId: string;
      status?: DocumentProcessingStatus;
      attempts?: number;
      maxAttempts?: number;
      lastError?: string | null;
      metadata?: Record<string, unknown>;
      customBinary?: Buffer;
    }) {
      const docId = crypto.randomUUID();
      const verId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const storagePath = `tenants/${opts.tenantId}/documents/${docId}/v1.pdf`;

      // Upload binary to in-memory storage
      const binaryPayload = opts.customBinary || samplePdfBytes;
      await storageProvider.upload({
        tenantId: opts.tenantId,
        storagePath,
        content: binaryPayload,
        mimeType: 'application/pdf',
      });

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
          filePath: storagePath,
          fileSizeBytes: BigInt(binaryPayload.byteLength),
          mimeType: 'application/pdf',
          checksumSha256: crypto.createHash('sha256').update(binaryPayload).digest('hex'),
        },
      });

      const mergedMetadata = {
        storagePath,
        mimeType: 'application/pdf',
        fileName: 'test_upload.pdf',
        fileSizeBytes: binaryPayload.byteLength,
        testKey: 'testVal',
        ...(opts.metadata || {}),
      };

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
          metadata: mergedMetadata as any,
        },
      });

      return { docId, verId, jobId, job, storagePath, binaryPayload };
    }

    // -----------------------------------------------------------------
    // SECTION 2: ATOMIC CLAIMING OF QUEUED JOBS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Atomic Job Claiming ---');

    const mockOrch = new MockOrchestrator();
    const mockExt = new MockExtractor();
    const runner = new DocumentProcessingJobRunner(mockOrch, storageProvider, mockExt, adminPrisma);

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

    const runnerA = new DocumentProcessingJobRunner(mockOrch, storageProvider, mockExt, adminPrisma);
    const runnerB = new DocumentProcessingJobRunner(mockOrch, storageProvider, mockExt, adminPrisma);

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
    mockExt.mockOutcome = 'SUCCESS';
    mockExt.callCount = 0;
    mockExt.lastRequest = null;
    mockExt.mockItems = [
      {
        ocrText: 'Budi Santoso',
        matchedStudentName: 'Budi Santoso',
        nisn: '0051111111',
        date: '2026-09-01',
        status: 'Sakit',
        confidence: 95,
      },
    ];

    const { jobId: successJobId, docId: sDocId, verId: sVerId, storagePath: sStoragePath } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      metadata: { customField: 'phase5e_payload' },
    });

    const execSuccess = await runner.executeJob(TENANT_A_ID, successJobId);

    assert(execSuccess.success === true, 'executeJob returned success: true');
    assert(execSuccess.finalStatus === DocumentProcessingStatus.COMPLETED, 'finalStatus is COMPLETED');
    assert(execSuccess.attempts === 1, 'attempts count is 1');
    assert(execSuccess.processedAt !== null && execSuccess.processedAt !== undefined, 'processedAt is populated');
    assert(mockExt.callCount === 1, 'Extractor was invoked exactly once');
    assert(mockOrch.callCount === 1, 'Orchestrator was invoked exactly once');

    // Verify context passed to Extractor (Phase 5E.2-C)
    const capturedExtRequest = mockExt.lastRequest as DocumentExtractionRequest | null;
    assert(capturedExtRequest?.tenantId === TENANT_A_ID, 'Extractor received correct tenantId');
    assert(capturedExtRequest?.documentId === sDocId, 'Extractor received correct documentId');
    assert(capturedExtRequest?.documentVersionId === sVerId, 'Extractor received correct documentVersionId');
    assert(capturedExtRequest?.mimeType === 'application/pdf', 'Extractor received correct mimeType');
    assert(capturedExtRequest?.content.byteLength === samplePdfBytes.byteLength, 'Extractor received actual binary content');

    // Verify context passed to Orchestrator
    const capturedRequest = mockOrch.lastRequest as DocumentIntelligencePipelineRequest | null;
    assert(capturedRequest?.tenantId === TENANT_A_ID, 'Passed correct tenantId to orchestrator');
    assert(capturedRequest?.actorId === ACTOR_A_ID, 'Passed correct actorId to orchestrator');
    assert(capturedRequest?.documentId === sDocId, 'Passed correct documentId to orchestrator');
    assert(capturedRequest?.documentVersionId === sVerId, 'Passed correct documentVersionId to orchestrator');
    assert(capturedRequest?.targetDomain === 'student', 'Passed correct targetDomain to orchestrator');
    assert(capturedRequest?.metadata?.customField === 'phase5e_payload', 'Persisted metadata preserved');
    assert(Array.isArray(capturedRequest?.metadata?.items), 'Extracted items forwarded in metadata.items');
    assert((capturedRequest?.metadata?.items as any[])[0]?.nisn === '0051111111', 'Extracted item payload intact');

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
    mockExt.mockOutcome = 'SUCCESS';

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

    // -----------------------------------------------------------------
    // SECTION 10: DOCUMENT EXTRACTION BOUNDARY (PHASE 5E.2-C)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 10: Document Extraction Boundary (Phase 5E.2-C) ---');

    // 10.1 Extractor failure triggers retry lifecycle
    mockOrch.mockOutcome = 'COMPLETED';
    mockExt.mockOutcome = 'FAIL';
    mockExt.errorMessage = 'Corrupted PDF catalog dictionary';

    const { jobId: extFailJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      attempts: 0,
      maxAttempts: 3,
    });

    const execExtFail = await runner.executeJob(TENANT_A_ID, extFailJobId);
    assert(execExtFail.success === false, 'Extractor failure returned success: false');
    assert(execExtFail.finalStatus === DocumentProcessingStatus.QUEUED, 'Extractor failure returned job to QUEUED for retry');
    assert(execExtFail.error === 'Corrupted PDF catalog dictionary', 'Captured extractor error message');

    const extFailJobDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: extFailJobId } });
    assert(extFailJobDb?.status === DocumentProcessingStatus.QUEUED, 'Database status is QUEUED');
    assert(extFailJobDb?.attempts === 1, 'Database attempts incremented to 1');
    assert(extFailJobDb?.lastError === 'Corrupted PDF catalog dictionary', 'Database lastError is preserved');

    // 10.2 Extractor failure reaches FAILED after max attempts exhausted
    const { jobId: extExhaustJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
      attempts: 2,
      maxAttempts: 3,
    });

    const execExtExhaust = await runner.executeJob(TENANT_A_ID, extExhaustJobId);
    assert(execExtExhaust.success === false, 'Exhausted extractor failure returned success: false');
    assert(execExtExhaust.finalStatus === DocumentProcessingStatus.FAILED, 'Job transitioned to terminal FAILED state');
    assert(execExtExhaust.attempts === 3, 'Attempts reached maxAttempts');

    const extExhaustDb = await adminPrisma.documentProcessingJob.findUnique({ where: { id: extExhaustJobId } });
    assert(extExhaustDb?.status === DocumentProcessingStatus.FAILED, 'Database status is FAILED');
    assert(extExhaustDb?.processedAt !== null, 'Database processedAt is populated for terminal FAILED state');

    // 10.3 DeterministicDocumentExtractor works standalone
    const deterministicExtractor = new DeterministicDocumentExtractor({
      defaultItems: [
        {
          ocrText: 'Citra Dewi',
          matchedStudentName: 'Citra Dewi',
          nisn: '0053333333',
          date: '2026-09-01',
          status: 'Izin',
          confidence: 90,
        },
      ],
    });

    const runnerWithDeterministic = new DocumentProcessingJobRunner(
      mockOrch,
      storageProvider,
      deterministicExtractor,
      adminPrisma
    );

    mockOrch.mockOutcome = 'COMPLETED';
    mockOrch.callCount = 0;

    const { jobId: detJobId } = await createTestJob({
      tenantId: TENANT_A_ID,
      actorId: ACTOR_A_ID,
    });

    const execDet = await runnerWithDeterministic.executeJob(TENANT_A_ID, detJobId);
    assert(execDet.success === true, 'Runner with DeterministicDocumentExtractor succeeded');
    assert(execDet.finalStatus === DocumentProcessingStatus.COMPLETED, 'Job transitioned to COMPLETED');
    assert(mockOrch.callCount === 1, 'Orchestrator called with extracted items from DeterministicDocumentExtractor');
    const detOrchReq = mockOrch.lastRequest as DocumentIntelligencePipelineRequest | null;
    assert((detOrchReq?.metadata?.items as any[])[0]?.ocrText === 'Citra Dewi', 'Deterministic extractor items correctly forwarded');

    console.log('\n================================================================');
    console.log(` ALL ${testCount} / ${testCount} PHASE 5E.2-B / 5E.2-C TESTS PASSED `);
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
  console.error('Phase 5E.2-B / 5E.2-C Runner test runner failed:', err);
  process.exit(1);
});
