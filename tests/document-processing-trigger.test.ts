import 'dotenv/config';
import pg from 'pg';
import { PrismaClient, DocumentCategory, DocumentProcessingStatus, DocumentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest } from 'next/server';
import { POST, GET } from '../src/app/api/internal/document-processing/route';
import { DocumentProcessingWorker } from '../src/platform/services/document-processing-worker';
import {
  IDocumentProcessingJobRunner,
  IDocumentProcessingWorker,
  DocumentProcessingJobExecutionResult,
  DocumentProcessingJobDTO,
} from '../src/platform/types/document-processing';

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

/**
 * Mock Runner to simulate deterministic job execution outcomes.
 */
class MockRunner implements IDocumentProcessingJobRunner {
  public executedJobs: Array<{ tenantId: string; jobId: string }> = [];
  public failJobIds: Set<string> = new Set();

  constructor(private readonly prisma: PrismaClient) {}

  public async claimJob(tenantId: string, jobId: string): Promise<DocumentProcessingJobDTO | null> {
    const job = await this.prisma.documentProcessingJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.tenantId !== tenantId || job.status !== DocumentProcessingStatus.QUEUED) {
      return null;
    }
    return {
      id: job.id,
      tenantId: job.tenantId,
      documentId: job.documentId,
      documentVersionId: job.documentVersionId,
      actorId: job.actorId,
      targetDomain: job.targetDomain,
      metadata: (job.metadata as Record<string, unknown>) || null,
      status: DocumentProcessingStatus.PROCESSING,
      attempts: job.attempts + 1,
      maxAttempts: job.maxAttempts,
      lastError: null,
      createdAt: job.createdAt,
      updatedAt: new Date(),
      processedAt: null,
    };
  }

  public async executeJob(
    tenantId: string,
    jobId: string
  ): Promise<DocumentProcessingJobExecutionResult> {
    this.executedJobs.push({ tenantId, jobId });

    const isFailing = this.failJobIds.has(jobId);
    const finalStatus = isFailing
      ? DocumentProcessingStatus.FAILED
      : DocumentProcessingStatus.COMPLETED;

    await this.prisma.documentProcessingJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        processedAt: new Date(),
        lastError: isFailing ? 'Simulated extraction failure' : null,
      },
    });

    return {
      success: !isFailing,
      jobId,
      tenantId,
      previousStatus: DocumentProcessingStatus.QUEUED,
      finalStatus,
      attempts: 1,
      maxAttempts: 3,
      processedAt: new Date(),
      error: isFailing ? 'Simulated extraction failure' : null,
    };
  }
}

async function runDocumentProcessingTriggerTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2-E: DOCUMENT PROCESSING RUNTIME TRIGGER TEST SUITE  ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_A_ID = '91111111-1111-7111-8111-111111111111';
  const ACTOR_A_ID = '9a111111-1111-7111-8111-111111111111';
  const TEST_SECRET = 'trigger-test-auth-secret-key-12345';

  // Helper to seed jobs
  async function seedJob(opts: {
    tenantId: string;
    status: DocumentProcessingStatus;
    createdAt?: Date;
  }) {
    const docId = crypto.randomUUID();
    const verId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    await adminPrisma.document.create({
      data: {
        id: docId,
        tenantId: opts.tenantId,
        title: 'Trigger Test Document',
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
        fileSizeBytes: BigInt(100),
        mimeType: 'application/pdf',
        checksumSha256: 'dummy_hash',
      },
    });

    const job = await adminPrisma.documentProcessingJob.create({
      data: {
        id: jobId,
        tenantId: opts.tenantId,
        documentId: docId,
        documentVersionId: verId,
        actorId: ACTOR_A_ID,
        targetDomain: 'student',
        status: opts.status,
        attempts: opts.status === DocumentProcessingStatus.QUEUED ? 0 : 1,
        maxAttempts: 3,
        createdAt: opts.createdAt || new Date(),
        updatedAt: opts.createdAt || new Date(),
      },
    });

    return { docId, verId, jobId, job };
  }

  try {
    // -----------------------------------------------------------------
    // SECTION 1: FIXTURES SETUP
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Fixtures Setup ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
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
      create: { id: TENANT_A_ID, name: 'Trigger Test Tenant', code: 'TRIGGER_TENANT', status: 'ACTIVE' },
      update: { name: 'Trigger Test Tenant', code: 'TRIGGER_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_A_ID },
      create: {
        id: ACTOR_A_ID,
        tenantId: TENANT_A_ID,
        username: 'actor_trigger',
        email: 'actor_trigger@test.local',
        fullName: 'Actor Trigger',
        role: 'ADMIN_TENANT',
        status: 'ACTIVE',
      },
      update: { role: 'ADMIN_TENANT', status: 'ACTIVE' },
    });

    assert(true, 'Test fixtures initialized cleanly');

    // -----------------------------------------------------------------
    // SECTION 2: UNAUTHORIZED INVOCATION REJECTION (401 UNAUTHORIZED)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Unauthorized Invocation Rejection ---');

    // Case 2A: Missing Authorization header
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
      });
      const res = await POST(req, { secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 401, 'Missing authorization header returns HTTP 401');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');
    }

    // Case 2B: Invalid Bearer token
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-invalid-secret-token',
        },
      });
      const res = await POST(req, { secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 401, 'Invalid Bearer token returns HTTP 401');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');
    }

    // Case 2C: Invalid custom header
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          'x-internal-key': 'wrong-key',
        },
      });
      const res = await POST(req, { secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 401, 'Invalid x-internal-key header returns HTTP 401');
      assert(json.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');
    }

    // Case 2D: Unconfigured secret in environment fails closed
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: 'Bearer some-secret',
        },
      });
      // Pass empty secret to simulate unconfigured environment
      const res = await POST(req, { secret: '' });
      const json = await res.json();

      assert(res.status === 401, 'Unconfigured environment secret fails closed (HTTP 401)');
      assert(json.success === false, 'Response has success: false');
      assert(json.error?.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');
    }

    // -----------------------------------------------------------------
    // SECTION 3: AUTHORIZED INVOCATION REACHES WORKER
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Authorized Invocation Reaches Worker ---');

    const mockRunner = new MockRunner(adminPrisma);
    const worker: IDocumentProcessingWorker = new DocumentProcessingWorker(mockRunner, adminPrisma);

    // Case 3A: Authorized via Bearer header
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'Bearer authorized request returns HTTP 200');
      assert(json.success === true, 'Response has success: true');
      assert(typeof json.data?.jobsProcessed === 'number', 'jobsProcessed is returned');
      assert(typeof json.data?.hasMore === 'boolean', 'hasMore is returned');
      assert(Array.isArray(json.data?.results), 'results array is returned');
    }

    // Case 3B: Authorized via x-internal-key header
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          'x-internal-key': TEST_SECRET,
        },
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'x-internal-key authorized request returns HTTP 200');
      assert(json.success === true, 'Response has success: true');
    }

    // Case 3C: Authorized via GET (cron trigger)
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
      });

      const res = await GET(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'GET authorized request returns HTTP 200');
      assert(json.success === true, 'Response has success: true');
    }

    // -----------------------------------------------------------------
    // SECTION 4: EMPTY QUEUE SUCCEEDS
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Empty Queue Execution ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });

    mockRunner.executedJobs = [];

    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: TENANT_A_ID }),
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'Empty queue execution returns HTTP 200');
      assert(json.success === true, 'Empty queue response has success: true');
      assert(json.data?.jobsProcessed === 0, 'jobsProcessed is 0 on empty queue');
      assert(json.data?.hasMore === false, 'hasMore is false on empty queue');
      assert(json.data?.results.length === 0, 'results array is empty on empty queue');
      assert(mockRunner.executedJobs.length === 0, 'Runner was not invoked on empty queue');
    }

    // -----------------------------------------------------------------
    // SECTION 5: BOUNDED BATCH LIMIT IS RESPECTED
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Bounded Batch Limit & FIFO Processing ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });

    const now = Date.now();
    // Seed 4 queued jobs with distinct timestamps
    const { jobId: j1 } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 40000),
    });
    const { jobId: j2 } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 30000),
    });
    const { jobId: j3 } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 20000),
    });
    const { jobId: j4 } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 10000),
    });

    mockRunner.executedJobs = [];

    // Trigger with limit = 2
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: TENANT_A_ID, limit: 2 }),
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'Batch execution returns HTTP 200');
      assert(json.data?.jobsProcessed === 2, 'Exactly 2 jobs processed when limit is 2');
      assert(json.data?.hasMore === true, 'hasMore is true when batch limit reached');
      assert(json.data?.results.length === 2, 'results array length matches jobsProcessed');
      assert(mockRunner.executedJobs.length === 2, 'Runner was invoked exactly twice');
      assert(mockRunner.executedJobs[0]?.jobId === j1, 'Oldest job j1 processed first');
      assert(mockRunner.executedJobs[1]?.jobId === j2, 'Second oldest job j2 processed second');
    }

    // Next trigger processes remaining 2 jobs
    {
      mockRunner.executedJobs = [];
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: TENANT_A_ID, limit: 5 }),
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'Remaining batch returns HTTP 200');
      assert(json.data?.jobsProcessed === 2, 'Remaining 2 jobs processed');
      assert(json.data?.hasMore === false, 'hasMore is false when queue is exhausted before limit');
      assert(mockRunner.executedJobs.length === 2, 'Runner invoked for remaining 2 jobs');
      assert(mockRunner.executedJobs[0]?.jobId === j3, 'j3 processed in second batch');
      assert(mockRunner.executedJobs[1]?.jobId === j4, 'j4 processed in second batch');
    }

    // -----------------------------------------------------------------
    // SECTION 6: FAILURE RESILIENCE
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Failure Resilience (Does Not Crash Trigger) ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });

    const { jobId: successJobId } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 20000),
    });
    const { jobId: failJobId } = await seedJob({
      tenantId: TENANT_A_ID,
      status: DocumentProcessingStatus.QUEUED,
      createdAt: new Date(now - 10000),
    });

    mockRunner.executedJobs = [];
    mockRunner.failJobIds = new Set([failJobId]);

    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: TENANT_A_ID, limit: 5 }),
      });

      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 200, 'Batch containing a failing job still returns HTTP 200');
      assert(json.success === true, 'Response success is true despite individual job failure');
      assert(json.data?.jobsProcessed === 2, 'Both jobs were processed');
      assert(json.data?.results[0]?.success === true, 'First job succeeded');
      assert(json.data?.results[0]?.jobId === successJobId, 'First job ID matches');
      assert(json.data?.results[1]?.success === false, 'Second job failed as expected');
      assert(json.data?.results[1]?.jobId === failJobId, 'Second job ID matches');
      assert(json.data?.results[1]?.finalStatus === DocumentProcessingStatus.FAILED, 'Second job finalStatus is FAILED');
      assert(json.data?.results[1]?.error === 'Simulated extraction failure', 'Failure error message preserved');
    }

    // -----------------------------------------------------------------
    // SECTION 7: INPUT VALIDATION ERRORS (HTTP 400)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Input Validation Errors (HTTP 400) ---');

    // Invalid limit (< 1)
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ limit: -5 }),
      });
      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 400, 'Negative limit returns HTTP 400');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    }

    // Invalid tenantId format
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: 'not-a-valid-uuid' }),
      });
      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 400, 'Invalid tenantId UUID returns HTTP 400');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    }

    // Malformed JSON body
    {
      const req = new NextRequest('http://localhost:3000/api/internal/document-processing', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          'content-type': 'application/json',
        },
        body: 'invalid-json-{',
      });
      const res = await POST(req, { worker, secret: TEST_SECRET });
      const json = await res.json();

      assert(res.status === 400, 'Malformed JSON body returns HTTP 400');
      assert(json.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');
    }

    console.log('\n================================================================');
    console.log(` ALL ${testCount} / ${testCount} PHASE 5E.2-E TRIGGER TESTS PASSED `);
    console.log('================================================================\n');
  } finally {
    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
    await adminPrisma.publicUploadInvitation.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: TENANT_A_ID },
    });

    await adminPrisma.$disconnect();
    await adminPool.end();
  }
}

runDocumentProcessingTriggerTests().catch((err) => {
  console.error('Phase 5E.2-E Trigger test runner failed:', err);
  process.exit(1);
});
