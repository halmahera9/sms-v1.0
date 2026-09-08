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
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { AzureDocumentExtractor } from '../src/platform/services/azure-document-extractor';
import { GeminiDocumentExtractor } from '../src/platform/services/gemini-document-extractor';
import { LocalOcrGeminiDocumentExtractor } from '../src/platform/services/local-ocr-gemini-document-extractor';
import { InMemoryObjectStorageProvider } from '../src/platform/storage';
import type {
  IDocumentIntelligenceOrchestrator,
  DocumentIntelligencePipelineRequest,
  DocumentIntelligencePipelineResult,
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../src/platform/types';
import type {
  IPdfPageRenderer,
  PdfPageRenderRequest,
  PdfPageRenderResult,
} from '../src/platform/services/pdf-page-renderer';
import type {
  ILocalOcrEngine,
  LocalOcrRequest,
  LocalOcrResult,
} from '../src/platform/services/local-ocr-engine';

let testCount = 0;
let passCount = 0;

function assert(condition: unknown, message: string, detail?: string) {
  testCount++;
  if (Boolean(condition)) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message} (${detail || ''})`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Environment Isolation Helper
// ---------------------------------------------------------------------------

function clearExtractorEnv(): () => void {
  const saved: Record<string, string | undefined> = {
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    AZURE_DOCUMENT_INTELLIGENCE_KEY: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
    AZURE_FORM_RECOGNIZER_ENDPOINT: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY: process.env.AZURE_FORM_RECOGNIZER_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TESSERACT_BINARY_PATH: process.env.TESSERACT_BINARY_PATH,
  };

  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  delete process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  delete process.env.AZURE_FORM_RECOGNIZER_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.TESSERACT_BINARY_PATH;

  return () => {
    for (const [key, val] of Object.entries(saved)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Test Doubles (Hermetic, In-Memory)
// ---------------------------------------------------------------------------

class MockOrchestrator implements IDocumentIntelligenceOrchestrator {
  public lastRequest: DocumentIntelligencePipelineRequest | null = null;
  public callCount = 0;
  public mockOutcome: 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED' = 'COMPLETED';
  public errorMessage: string | null = null;

  async process(request: DocumentIntelligencePipelineRequest): Promise<DocumentIntelligencePipelineResult> {
    this.callCount++;
    this.lastRequest = request;

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
        errorMessage: this.errorMessage || 'Orchestration pipeline failure',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    const items = (request.metadata?.items as ExtractedDocumentItem[]) || [];
    return {
      status: this.mockOutcome,
      documentId: request.documentId,
      documentVersionId: request.documentVersionId,
      processedItems: [],
      summary: {
        totalItemsExtracted: items.length,
        itemsResolved: items.length,
        itemsUnresolved: 0,
        itemsAmbiguous: 0,
        validationErrorsCount: 0,
        exceptionsCreatedCount: 0,
        itemsRequiringReview: this.mockOutcome === 'REQUIRES_REVIEW' ? items.length : 0,
      },
      exceptionIds: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
}

class MockPdfRenderer implements IPdfPageRenderer {
  public renderCalls: PdfPageRenderRequest[] = [];
  constructor(private readonly result: PdfPageRenderResult) {}
  async renderPages(req: PdfPageRenderRequest): Promise<PdfPageRenderResult> {
    this.renderCalls.push(req);
    return this.result;
  }
}

class MockOcrEngine implements ILocalOcrEngine {
  public recogniseCalls: LocalOcrRequest[] = [];
  constructor(private readonly handler: (req: LocalOcrRequest) => LocalOcrResult) {}
  async recognise(req: LocalOcrRequest): Promise<LocalOcrResult> {
    this.recogniseCalls.push(req);
    return this.handler(req);
  }
}

class SpyGeminiExtractor extends GeminiDocumentExtractor {
  public extractFromTextCalls: { ocrText: string; request: DocumentExtractionRequest }[] = [];
  constructor(private readonly textResponse: DocumentExtractionResult) {
    super({ apiKey: 'hermetic-gemini-key' });
  }

  public override async extractFromText(
    ocrText: string,
    req: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    this.extractFromTextCalls.push({ ocrText, request: req });
    return this.textResponse;
  }
}

// ---------------------------------------------------------------------------
// Main Integration Test Suite
// ---------------------------------------------------------------------------

async function runIntegrationTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.8: JOB RUNNER + EXTRACTOR FACTORY INTEGRATION SUITE   ');
  console.log('================================================================\n');

  const adminPool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const adminPrisma = new PrismaClient({ adapter: new PrismaPg(adminPool) });

  const TENANT_ID = '97777777-7777-7777-7777-777777777777';
  const OTHER_TENANT_ID = '98888888-8888-7888-8888-888888888888';
  const ACTOR_ID = '9a777777-7777-7777-7777-777777777777';

  const storageProvider = new InMemoryObjectStorageProvider();
  const samplePdfBytes = Buffer.from('%PDF-1.4 hermetic test pdf buffer');

  try {
    // -----------------------------------------------------------------------
    // SECTION 1: Fixtures Setup
    // -----------------------------------------------------------------------
    console.log('--- SECTION 1: Test Fixtures Setup ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });

    await adminPrisma.tenant.upsert({
      where: { id: TENANT_ID },
      create: { id: TENANT_ID, name: 'Integration Test Tenant', code: 'INT_TEST_TENANT', status: 'ACTIVE' },
      update: { name: 'Integration Test Tenant', code: 'INT_TEST_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.tenant.upsert({
      where: { id: OTHER_TENANT_ID },
      create: { id: OTHER_TENANT_ID, name: 'Other Test Tenant', code: 'OTHER_INT_TENANT', status: 'ACTIVE' },
      update: { name: 'Other Test Tenant', code: 'OTHER_INT_TENANT', status: 'ACTIVE' },
    });

    await adminPrisma.userActor.upsert({
      where: { id: ACTOR_ID },
      create: {
        id: ACTOR_ID,
        tenantId: TENANT_ID,
        username: 'actor_integration_runner',
        email: 'actor@integration.test',
        fullName: 'Integration Actor',
        role: 'OPERATOR',
        status: 'ACTIVE',
      },
      update: { tenantId: TENANT_ID, role: 'OPERATOR', status: 'ACTIVE' },
    });

    assert(true, 'Test fixtures created and tenant context established');

    // Helper to persist a document, version, and queued job
    async function createJobFixture(opts: {
      tenantId?: string;
      actorId?: string;
      attempts?: number;
      maxAttempts?: number;
      status?: DocumentProcessingStatus;
      metadata?: Record<string, unknown>;
      content?: Buffer;
    }) {
      const tenant = opts.tenantId || TENANT_ID;
      const actor = opts.actorId || ACTOR_ID;
      const docId = crypto.randomUUID();
      const verId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const storagePath = `tenants/${tenant}/documents/${docId}/v1.pdf`;
      const binary = opts.content || samplePdfBytes;

      await storageProvider.upload({
        tenantId: tenant,
        storagePath,
        content: binary,
        mimeType: 'application/pdf',
      });

      await adminPrisma.document.create({
        data: {
          id: docId,
          tenantId: tenant,
          title: 'Integration Test Document',
          category: DocumentCategory.LAINNYA,
          status: DocumentStatus.PENDING_VERIFICATION,
          currentVersion: 1,
        },
      });

      await adminPrisma.documentVersion.create({
        data: {
          id: verId,
          tenantId: tenant,
          documentId: docId,
          versionNumber: 1,
          filePath: storagePath,
          fileSizeBytes: BigInt(binary.byteLength),
          mimeType: 'application/pdf',
          checksumSha256: crypto.createHash('sha256').update(binary).digest('hex'),
        },
      });

      const mergedMeta = {
        storagePath,
        mimeType: 'application/pdf',
        fileName: 'document.pdf',
        fileSizeBytes: binary.byteLength,
        customJobTag: 'integration_val',
        ...(opts.metadata || {}),
      };

      const job = await adminPrisma.documentProcessingJob.create({
        data: {
          id: jobId,
          tenantId: tenant,
          documentId: docId,
          documentVersionId: verId,
          actorId: actor,
          targetDomain: 'student',
          status: opts.status || DocumentProcessingStatus.QUEUED,
          attempts: opts.attempts ?? 0,
          maxAttempts: opts.maxAttempts ?? 3,
          metadata: mergedMeta as any,
        },
      });

      return { docId, verId, jobId, storagePath, job };
    }

    // -----------------------------------------------------------------------
    // SECTION 2: Canonical Factory Selection Permutations (No Singleton/Leakage)
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 2: Canonical Factory Precedence & Selection Permutations ---');

    {
      // 2.1: Azure fully configured -> AzureDocumentExtractor
      const restore = clearExtractorEnv();
      try {
        process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://int.cognitiveservices.azure.com';
        process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'azure-key-int-001';
        const extractor = getDocumentExtractor();
        assert(extractor instanceof AzureDocumentExtractor, 'Priority 1: Primary Azure configuration yields AzureDocumentExtractor');
      } finally { restore(); }
    }

    {
      // 2.2: Partial Azure (endpoint only) -> UnavailableDocumentExtractor (fail-closed)
      const restore = clearExtractorEnv();
      try {
        process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://int.cognitiveservices.azure.com';
        process.env.GEMINI_API_KEY = 'gemini-key-fallback-attempt';
        const extractor = getDocumentExtractor();
        assert(extractor instanceof UnavailableDocumentExtractor, 'Priority 1 Guard: Partial Azure (missing key) fails closed to UnavailableDocumentExtractor with zero Gemini fallthrough');
      } finally { restore(); }
    }

    {
      // 2.3: Azure absent + Gemini set + Tesseract available -> LocalOcrGeminiDocumentExtractor
      const restore = clearExtractorEnv();
      try {
        process.env.GEMINI_API_KEY = 'gemini-test-key-int';
        process.env.TESSERACT_BINARY_PATH = process.execPath;
        const extractor = getDocumentExtractor();
        assert(extractor instanceof LocalOcrGeminiDocumentExtractor, 'Priority 2A: Gemini set + Tesseract available yields LocalOcrGeminiDocumentExtractor');
      } finally { restore(); }
    }

    {
      // 2.4: Azure absent + Gemini set + Tesseract unavailable -> GeminiDocumentExtractor
      const restore = clearExtractorEnv();
      try {
        process.env.GEMINI_API_KEY = 'gemini-test-key-int';
        process.env.TESSERACT_BINARY_PATH = 'nonexistent_tesseract_binary_int_test';
        const extractor = getDocumentExtractor();
        assert(extractor instanceof GeminiDocumentExtractor, 'Priority 2B: Gemini set + Tesseract unavailable yields GeminiDocumentExtractor (direct multimodal)');
      } finally { restore(); }
    }

    {
      // 2.5: Neither configured -> UnavailableDocumentExtractor
      const restore = clearExtractorEnv();
      try {
        const extractor = getDocumentExtractor();
        assert(extractor instanceof UnavailableDocumentExtractor, 'Priority 3: No providers configured yields UnavailableDocumentExtractor');
      } finally { restore(); }
    }

    {
      // 2.6: Factory returns fresh distinct instances (No singleton mutation)
      const restore = clearExtractorEnv();
      try {
        process.env.GEMINI_API_KEY = 'gemini-key-singleton-test';
        process.env.TESSERACT_BINARY_PATH = process.execPath;
        const instA = getDocumentExtractor();
        const instB = getDocumentExtractor();
        assert(instA !== instB, 'Factory guarantees fresh instance creation without global singleton pollution');
      } finally { restore(); }
    }

    // -----------------------------------------------------------------------
    // SECTION 3: Atomic Claim and Tenant Isolation Guarantees
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 3: Atomic Claim & Tenant Isolation Guards ---');

    {
      // 3.1: Atomic claim transitions QUEUED to PROCESSING and increments attempts
      const { jobId } = await createJobFixture({ attempts: 0 });
      const mockOrch = new MockOrchestrator();
      const runner = new DocumentProcessingJobRunner(mockOrch, storageProvider, new DeterministicDocumentExtractor(), adminPrisma);

      const claimed = await runner.claimJob(TENANT_ID, jobId);
      assert(claimed !== null, 'claimJob returns claimed DTO for valid QUEUED job');
      assert(claimed?.status === DocumentProcessingStatus.PROCESSING, 'Claimed job status is PROCESSING');
      assert(claimed?.attempts === 1, 'Claimed job attempts counter incremented to 1');

      // 3.2: Re-claiming an active PROCESSING job returns null
      const doubleClaim = await runner.claimJob(TENANT_ID, jobId);
      assert(doubleClaim === null, 'claimJob returns null when job is already PROCESSING (idempotency/anti-double-claim)');
    }

    {
      // 3.3: Tenant mismatch remains strictly fail-closed
      const { jobId } = await createJobFixture({ tenantId: TENANT_ID, attempts: 0 });
      const mockOrch = new MockOrchestrator();
      const runner = new DocumentProcessingJobRunner(mockOrch, storageProvider, new DeterministicDocumentExtractor(), adminPrisma);

      // Attempt claim with OTHER_TENANT_ID
      const foreignClaim = await runner.claimJob(OTHER_TENANT_ID, jobId);
      assert(foreignClaim === null, 'Foreign tenant cannot claim job under another tenant');

      // Attempt executeJob with OTHER_TENANT_ID
      const foreignExec = await runner.executeJob(OTHER_TENANT_ID, jobId);
      assert(foreignExec.success === false, 'executeJob with tenant mismatch returns success: false');
      assert(foreignExec.error?.includes('not found') || foreignExec.error?.includes('cannot be claimed'), 'Error reflects tenant separation');

      // Verify original job remains strictly QUEUED with 0 attempts
      const untouched = await adminPrisma.documentProcessingJob.findUnique({ where: { id: jobId } });
      assert(untouched?.status === DocumentProcessingStatus.QUEUED, 'Target job remains QUEUED in database');
      assert(untouched?.attempts === 0, 'Target job attempts count untouched');
    }

    // -----------------------------------------------------------------------
    // SECTION 4: Hybrid Extractor Injection through Runner Seam
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 4: Hybrid Extractor Seam & Multi-Page Metadata Flow ---');

    {
      const { jobId } = await createJobFixture({
        metadata: { sourceOrigin: 'hybrid_integration_test' },
      });

      // Hermetic mock renderer returning 2 pages
      const mockPdfRenderer = new MockPdfRenderer({
        success: true,
        pages: [
          { pageNumber: 1, imageBuffer: Buffer.from('page1_png_bytes'), mimeType: 'image/png' },
          { pageNumber: 2, imageBuffer: Buffer.from('page2_png_bytes'), mimeType: 'image/png' },
        ],
        pageCount: 2,
      });

      // Hermetic mock OCR engine returning per-page OCR lines
      const mockOcrEngine = new MockOcrEngine((req) => {
        const text = req.imageBuffer.toString().includes('page1')
          ? 'SISWA: AHMAD FAUZI\nNISN: 1234567890'
          : 'SISWA: SITI NURHALIZA\nNISN: 0987654321';
        return {
          success: true,
          lines: [{ text, confidence: 95 }],
          rawText: text,
        };
      });

      // Spy Gemini extractor producing structured items from aggregated OCR text
      const spyGemini = new SpyGeminiExtractor({
        success: true,
        items: [
          { id: crypto.randomUUID(), ocrText: 'AHMAD FAUZI', matchedStudentName: 'AHMAD FAUZI', matchedNisn: '1234567890', confidence: 95 },
          { id: crypto.randomUUID(), ocrText: 'SITI NURHALIZA', matchedStudentName: 'SITI NURHALIZA', matchedNisn: '0987654321', confidence: 92 },
        ],
        rawText: 'AHMAD FAUZI\nSITI NURHALIZA',
        pageCount: 2,
      });

      // Construct hybrid extractor via pure DI without host Tesseract or sharp
      const hybridExtractor = new LocalOcrGeminiDocumentExtractor({
        pdfRenderer: mockPdfRenderer,
        ocrEngine: mockOcrEngine,
        geminiExtractor: spyGemini,
      });

      const mockOrchestrator = new MockOrchestrator();

      // Inject hybrid extractor into runner
      const runner = new DocumentProcessingJobRunner(
        mockOrchestrator,
        storageProvider,
        hybridExtractor,
        adminPrisma
      );

      // Execute job
      const execResult = await runner.executeJob(TENANT_ID, jobId);

      // Verify runner execution outcome
      assert(execResult.success === true, 'Runner successfully completes job with hybrid extractor');
      assert(execResult.finalStatus === DocumentProcessingStatus.COMPLETED, 'Final status is COMPLETED');
      assert(execResult.attempts === 1, 'Attempt count is 1');
      assert(execResult.processedAt instanceof Date, 'processedAt timestamp is set');

      // Verify hybrid pipeline was exercised hermetically
      assert(mockPdfRenderer.renderCalls.length === 1, 'PDF renderer was called once by hybrid pipeline');
      assert(mockOcrEngine.recogniseCalls.length === 2, 'OCR engine was called for each rendered page');
      assert(spyGemini.extractFromTextCalls.length === 1, 'Gemini extractFromText called once with aggregated OCR text');

      const aggregatedText = spyGemini.extractFromTextCalls[0].ocrText;
      assert(aggregatedText.includes('--- Page 1 ---'), 'Aggregated text includes Page 1 header');
      assert(aggregatedText.includes('--- Page 2 ---'), 'Aggregated text includes Page 2 header');

      // Verify metadata forwarded to orchestrator
      assert(mockOrchestrator.callCount === 1, 'DocumentIntelligenceOrchestrator called once');
      assert(mockOrchestrator.lastRequest?.documentId !== undefined, 'Orchestrator received valid documentId');
      assert(mockOrchestrator.lastRequest?.metadata?.customJobTag === 'integration_val', 'Pre-existing job metadata preserved');
      assert(mockOrchestrator.lastRequest?.metadata?.sourceOrigin === 'hybrid_integration_test', 'Additional metadata preserved');

      const forwardedItems = mockOrchestrator.lastRequest?.metadata?.items as ExtractedDocumentItem[];
      assert(Array.isArray(forwardedItems) && forwardedItems.length === 2, 'Orchestrator received exactly 2 extracted items');
      assert(forwardedItems[0].ocrText === 'AHMAD FAUZI', 'First item ocrText matches');
      assert(forwardedItems[1].ocrText === 'SITI NURHALIZA', 'Second item ocrText matches');

      // Verify DB persistence
      const dbJob = await adminPrisma.documentProcessingJob.findUnique({ where: { id: jobId } });
      assert(dbJob?.status === DocumentProcessingStatus.COMPLETED, 'Database record reflects COMPLETED status');
      assert(dbJob?.lastError === null, 'Database record lastError is null');
      assert(dbJob?.processedAt !== null, 'Database record processedAt is populated');
    }

    // -----------------------------------------------------------------------
    // SECTION 5: Extractor Failure Lifecycle (Retry vs Exhausted)
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 5: Extractor Failure & Terminal Lifecycle ---');

    {
      // 5.1: Extractor failure with remaining attempts -> Returns to QUEUED
      const { jobId } = await createJobFixture({ attempts: 0, maxAttempts: 3 });

      class FailingExtractor implements IDocumentExtractor {
        async extract(): Promise<DocumentExtractionResult> {
          return {
            success: false,
            items: [],
            errorMessage: 'Simulated OCR engine failure: corrupted raster stream',
          };
        }
      }

      const mockOrch = new MockOrchestrator();
      const runner = new DocumentProcessingJobRunner(mockOrch, storageProvider, new FailingExtractor(), adminPrisma);

      const failResult = await runner.executeJob(TENANT_ID, jobId);
      assert(failResult.success === false, 'executeJob returns success: false on extractor failure');
      assert(failResult.finalStatus === DocumentProcessingStatus.QUEUED, 'Job returns to QUEUED status for retry');
      assert(failResult.attempts === 1, 'Attempt count incremented to 1');
      assert(failResult.processedAt === null, 'processedAt is null while job is in retryable QUEUED status');
      assert(failResult.error?.includes('corrupted raster stream'), 'Error message captures extractor error');

      const dbRetryJob = await adminPrisma.documentProcessingJob.findUnique({ where: { id: jobId } });
      assert(dbRetryJob?.status === DocumentProcessingStatus.QUEUED, 'Database reflects QUEUED status');
      assert(dbRetryJob?.attempts === 1, 'Database attempts is 1');
      assert(dbRetryJob?.lastError?.includes('corrupted raster stream'), 'Database lastError is preserved');
      assert(dbRetryJob?.processedAt === null, 'Database processedAt is null');
    }

    {
      // 5.2: Extractor failure with exhausted attempts (attempts >= maxAttempts) -> Transitions to FAILED
      const { jobId } = await createJobFixture({ attempts: 2, maxAttempts: 3 }); // Will become 3 upon claim

      class ExhaustingExtractor implements IDocumentExtractor {
        async extract(): Promise<DocumentExtractionResult> {
          return {
            success: false,
            items: [],
            errorMessage: 'Terminal extraction timeout: binary unreadable',
          };
        }
      }

      const mockOrch = new MockOrchestrator();
      const runner = new DocumentProcessingJobRunner(mockOrch, storageProvider, new ExhaustingExtractor(), adminPrisma);

      const exhaustResult = await runner.executeJob(TENANT_ID, jobId);
      assert(exhaustResult.success === false, 'executeJob returns success: false on exhausted attempts');
      assert(exhaustResult.finalStatus === DocumentProcessingStatus.FAILED, 'Job transitions to terminal FAILED status');
      assert(exhaustResult.attempts === 3, 'Attempts reached maxAttempts (3)');
      assert(exhaustResult.processedAt instanceof Date, 'processedAt timestamp is populated for terminal FAILED state');

      const dbFailedJob = await adminPrisma.documentProcessingJob.findUnique({ where: { id: jobId } });
      assert(dbFailedJob?.status === DocumentProcessingStatus.FAILED, 'Database reflects FAILED status');
      assert(dbFailedJob?.attempts === 3, 'Database reflects attempts = 3');
      assert(dbFailedJob?.lastError?.includes('binary unreadable'), 'Database reflects terminal lastError');
      assert(dbFailedJob?.processedAt !== null, 'Database reflects non-null processedAt');
    }

    // -----------------------------------------------------------------------
    // SECTION 6: Runner Integration with Production Factory (Default State)
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 6: Runner with Default Factory (Fail-Closed Hermetic Run) ---');

    {
      // When no external cloud providers are configured in the hermetic test environment,
      // getDocumentExtractor() returns UnavailableDocumentExtractor.
      // Running the job with this factory-selected extractor must fail-closed cleanly
      // without unhandled exceptions or crashes.
      const restore = clearExtractorEnv();
      try {
        const { jobId } = await createJobFixture({ attempts: 0, maxAttempts: 2 });
        const mockOrch = new MockOrchestrator();

        // Runner constructed with default factory extractor (getDocumentExtractor())
        const runner = new DocumentProcessingJobRunner(
          mockOrch,
          storageProvider,
          getDocumentExtractor(),
          adminPrisma
        );

        const result = await runner.executeJob(TENANT_ID, jobId);
        assert(result.success === false, 'Default factory with unconfigured environment fails closed');
        assert(result.finalStatus === DocumentProcessingStatus.QUEUED, 'Failed extraction requeues job when attempts < max');
        assert(
          result.error?.includes('Extraction Engine Unavailable') || result.error?.includes('No OCR provider'),
          'Captured descriptive error from UnavailableDocumentExtractor'
        );

        // Execute second time to exhaust maxAttempts (2)
        const secondResult = await runner.executeJob(TENANT_ID, jobId);
        assert(secondResult.success === false, 'Second execution returns success: false');
        assert(secondResult.finalStatus === DocumentProcessingStatus.FAILED, 'Job reaches terminal FAILED status on exhausted attempts');
        assert(secondResult.attempts === 2, 'Attempts reached maxAttempts (2)');

        const dbFinalJob = await adminPrisma.documentProcessingJob.findUnique({ where: { id: jobId } });
        assert(dbFinalJob?.status === DocumentProcessingStatus.FAILED, 'DB confirms FAILED status from default factory fail-closed flow');
      } finally {
        restore();
      }
    }

    // -----------------------------------------------------------------------
    // SECTION 7: Cleanup
    // -----------------------------------------------------------------------
    console.log('\n--- SECTION 7: Teardown & Cleanup ---');

    await adminPrisma.documentProcessingJob.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.documentVersion.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.document.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.userActor.deleteMany({
      where: { tenantId: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });
    await adminPrisma.tenant.deleteMany({
      where: { id: { in: [TENANT_ID, OTHER_TENANT_ID] } },
    });

    await adminPool.end();

    console.log('\n================================================================');
    console.log(` ALL ${passCount} / ${testCount} PHASE 5E.8 INTEGRATION TESTS PASSED `);
    console.log('================================================================\n');
  } catch (err) {
    await adminPool.end();
    throw err;
  }
}

runIntegrationTests().catch((err) => {
  console.error('[Integration Test Fatal Error]:', err);
  process.exit(1);
});
