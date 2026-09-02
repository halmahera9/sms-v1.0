import crypto from 'crypto';
import {
  AzureDocumentExtractor,
  AzureDocumentExtractorOptions,
} from '../src/platform/services/azure-document-extractor';
import { DocumentExtractionRequest, ExtractedDocumentItem } from '../src/platform/types';

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

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.3: AZURE DOCUMENT INTELLIGENCE EXTRACTOR ADAPTER TESTS');
  console.log('================================================================\n');

  const tenantId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const documentVersionId = crypto.randomUUID();
  const samplePdfBuffer = Buffer.from('%PDF-1.4 Mock PDF Binary Stream Content');

  // Preserve original environment
  const originalEnvEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const originalEnvKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  const originalEnvFrEndpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  const originalEnvFrKey = process.env.AZURE_FORM_RECOGNIZER_KEY;

  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  delete process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  delete process.env.AZURE_FORM_RECOGNIZER_KEY;

  try {
    // -------------------------------------------------------------------------
    // A. Configuration Tests (Fail Closed)
    // -------------------------------------------------------------------------
    console.log('--- SECTION A: Configuration & Fail-Closed Behavior ---');

    {
      // Missing both endpoint and apiKey
      const extractor = new AzureDocumentExtractor();
      const result = await extractor.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'absence_list.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result.success === false, 'Missing endpoint & apiKey returns success: false');
      assert(Array.isArray(result.items) && result.items.length === 0, 'Missing configuration returns empty items array');
      assert(
        typeof result.errorMessage === 'string' &&
          result.errorMessage.includes('configuration missing'),
        'Returns clear configuration error message'
      );
    }

    {
      // Missing API key only
      const extractorMissingKey = new AzureDocumentExtractor({
        endpoint: 'https://test-resource.cognitiveservices.azure.com',
      });
      const result = await extractorMissingKey.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result.success === false, 'Missing API key returns success: false');
      assert(
        result.errorMessage?.includes('configuration missing') === true,
        'Missing API key produces clear configuration error'
      );
    }

    {
      // Missing Endpoint only
      const extractorMissingEndpoint = new AzureDocumentExtractor({
        apiKey: 'secret-key-12345',
      });
      const result = await extractorMissingEndpoint.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result.success === false, 'Missing endpoint returns success: false');
      assert(
        result.errorMessage?.includes('configuration missing') === true,
        'Missing endpoint produces clear configuration error'
      );
    }

    {
      // Empty binary payload validation
      const extractor = new AzureDocumentExtractor({
        endpoint: 'https://test-resource.cognitiveservices.azure.com',
        apiKey: 'dummy-key',
      });
      const result = await extractor.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'empty.pdf',
        mimeType: 'application/pdf',
        content: Buffer.alloc(0),
      });

      assert(result.success === false, 'Empty binary content returns success: false');
      assert(
        result.errorMessage?.includes('Binary content cannot be empty') === true,
        'Empty binary returns validation error message'
      );
    }

    // -------------------------------------------------------------------------
    // B. Request Construction & Headers Tests
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION B: Request Construction & Headers Forwarding ---');

    {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: any = null;

      const mockFetch: typeof fetch = async (input, init) => {
        capturedUrl = input.toString();
        capturedMethod = init?.method || 'GET';
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = init?.body;

        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({
            status: 'succeeded',
            analyzeResult: {
              apiVersion: '2024-11-30',
              modelId: 'prebuilt-layout',
              content: 'Test content',
              pages: [{ pageNumber: 1, lines: [{ content: 'Test content', confidence: 0.99 }] }],
            },
          }),
        } as unknown as Response;
      };

      const options: AzureDocumentExtractorOptions = {
        endpoint: 'https://custom-doc-ai.cognitiveservices.azure.com/',
        apiKey: 'test-subscription-key-999',
        apiVersion: '2024-11-30',
        modelId: 'prebuilt-layout',
        fetchImpl: mockFetch,
      };

      const extractor = new AzureDocumentExtractor(options);

      const request: DocumentExtractionRequest = {
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'rekap_kehadiran.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
        metadata: { source: 'public_upload' },
      };

      const result = await extractor.extract(request);

      assert(result.success === true, 'Extraction with mocked fetchImpl succeeded');
      assert(
        capturedUrl ===
          'https://custom-doc-ai.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30',
        'Analyze URL correctly constructed without double slashes, including modelId and apiVersion'
      );
      assert(capturedMethod === 'POST', 'HTTP Method is POST');
      assert(
        capturedHeaders['Ocp-Apim-Subscription-Key'] === 'test-subscription-key-999',
        'Ocp-Apim-Subscription-Key header correctly forwarded'
      );
      assert(
        capturedHeaders['Content-Type'] === 'application/pdf',
        'Content-Type matches request mimeType'
      );
      assert(capturedBody === samplePdfBuffer, 'Exact binary request body buffer forwarded');
    }

    // -------------------------------------------------------------------------
    // C. Successful Async Analysis Flow (202 -> Succeeded)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION C: Successful Async Flow & Mapping ---');

    {
      let pollCallCount = 0;
      const opLocationUrl =
        'https://test-doc-ai.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-layout/analyzeResults/job-async-123?api-version=2024-11-30';

      const rawTextContent =
        'DAFTAR KETIDAKHADIRAN SISWA\nTanggal: 2026-09-01\n1. Ahmad Pratama (NISN: 0012345678) - Sakit\n2. Budi Santoso (NISN: 0012345679) - Izin';

      const mockFetch: typeof fetch = async (url) => {
        if (url.toString().includes(':analyze?')) {
          const headers = new Headers();
          headers.set('operation-location', opLocationUrl);
          return {
            status: 202,
            ok: true,
            headers,
            json: async () => ({}),
          } as unknown as Response;
        }

        if (url.toString() === opLocationUrl) {
          pollCallCount++;
          if (pollCallCount === 1) {
            return {
              status: 200,
              ok: true,
              headers: new Headers(),
              json: async () => ({ status: 'running' }),
            } as unknown as Response;
          }

          return {
            status: 200,
            ok: true,
            headers: new Headers(),
            json: async () => ({
              status: 'succeeded',
              analyzeResult: {
                apiVersion: '2024-11-30',
                modelId: 'prebuilt-layout',
                content: rawTextContent,
                pages: [
                  {
                    pageNumber: 1,
                    lines: [
                      { content: 'DAFTAR KETIDAKHADIRAN SISWA', confidence: 0.99 },
                      { content: 'Tanggal: 2026-09-01', confidence: 0.95 },
                      { content: '1. Ahmad Pratama (NISN: 0012345678) - Sakit', confidence: 0.92 },
                      { content: '2. Budi Santoso (NISN: 0012345679) - Izin', confidence: 0.88 },
                    ],
                  },
                ],
              },
            }),
          } as unknown as Response;
        }

        throw new Error(`Unexpected URL: ${url}`);
      };

      const extractor = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'test-key',
        pollIntervalMs: 0,
        fetchImpl: mockFetch,
      });

      const result = await extractor.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'daftar_absen.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
        metadata: { uploadBatchId: 'batch-101' },
      });

      assert(result.success === true, 'Asynchronous 202 extraction succeeded');
      assert(pollCallCount === 2, 'Polled operation-location through running state to succeeded');
      assert(result.rawText === rawTextContent, 'Full rawText is preserved from analyzeResult.content');
      assert(result.pageCount === 1, 'Page count is 1');
      assert(Array.isArray(result.items), 'items is an array');
      assert(result.items.length === 4, 'Exactly 4 line items extracted');
      assert(
        result.items[0].ocrText === 'DAFTAR KETIDAKHADIRAN SISWA',
        'First item ocrText matches line 1'
      );
      assert(result.items[0].confidence === 99, 'Line 1 confidence mapped to percentage (99)');
      assert(
        result.items[2].ocrText === '1. Ahmad Pratama (NISN: 0012345678) - Sakit',
        'Line 3 ocrText contains raw OCR text'
      );
      assert(result.items[2].confidence === 92, 'Line 3 confidence is 92');
      assert(
        typeof result.items[0].id === 'string' && result.items[0].id.length > 0,
        'Item id is assigned UUID'
      );
      assert(
        result.metadata?.provider === 'azure-document-intelligence',
        'Metadata provider is azure-document-intelligence'
      );
      assert(result.metadata?.modelId === 'prebuilt-layout', 'Metadata modelId preserved');
      assert(result.metadata?.apiVersion === '2024-11-30', 'Metadata apiVersion preserved');
      assert(result.metadata?.pageCount === 1, 'Metadata pageCount preserved');
      assert(result.metadata?.uploadBatchId === 'batch-101', 'Preserved caller metadata');
    }

    // -------------------------------------------------------------------------
    // D. Failure Handling Tests
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION D: Failure Handling ---');

    {
      // D.1 POST HTTP 401 Unauthorized
      const mock401Fetch: typeof fetch = async () => {
        return {
          status: 401,
          ok: false,
          headers: new Headers(),
          json: async () => ({
            error: { code: '401', message: 'Access denied due to invalid subscription key.' },
          }),
        } as unknown as Response;
      };

      const extractor401 = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'invalid-key',
        fetchImpl: mock401Fetch,
      });

      const result401 = await extractor401.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'unauthorized.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result401.success === false, 'HTTP 401 returns success: false');
      assert(result401.items.length === 0, 'HTTP 401 returns empty items');
      assert(
        result401.errorMessage?.includes('HTTP 401') === true,
        'Error message includes HTTP 401 code'
      );
      assert(
        result401.errorMessage?.includes('invalid subscription key') === true,
        'Error message includes Azure failure detail'
      );
    }

    {
      // D.2 POST HTTP 500 Server Error
      const mock500Fetch: typeof fetch = async () => {
        return {
          status: 500,
          ok: false,
          headers: new Headers(),
          json: async () => ({
            error: { code: 'InternalServerError', message: 'Azure OCR processing engine error.' },
          }),
        } as unknown as Response;
      };

      const extractor500 = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mock500Fetch,
      });

      const result500 = await extractor500.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'server_error.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result500.success === false, 'HTTP 500 returns success: false');
      assert(
        result500.errorMessage?.includes('HTTP 500') === true,
        'Error message includes HTTP 500 status'
      );
    }

    {
      // D.3 Missing operation-location header on 202
      const mockMissingOpLocFetch: typeof fetch = async () => {
        return {
          status: 202,
          ok: true,
          headers: new Headers(), // No operation-location
          json: async () => ({}),
        } as unknown as Response;
      };

      const extractorMissingOpLoc = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockMissingOpLocFetch,
      });

      const resultMissingOpLoc = await extractorMissingOpLoc.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'no_op_loc.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultMissingOpLoc.success === false, 'Missing operation-location returns success: false');
      assert(
        resultMissingOpLoc.errorMessage?.includes('Operation-Location') === true,
        'Error message notes missing Operation-Location header'
      );
    }

    {
      // D.4 Async Polling returns failed status
      const mockFailedOpFetch: typeof fetch = async (url) => {
        if (url.toString().includes(':analyze?')) {
          const headers = new Headers();
          headers.set('operation-location', 'https://test/op-failed');
          return {
            status: 202,
            ok: true,
            headers,
            json: async () => ({}),
          } as unknown as Response;
        }

        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({
            status: 'failed',
            error: { code: 'InvalidContent', message: 'Corrupted document payload cannot be parsed.' },
          }),
        } as unknown as Response;
      };

      const extractorOpFailed = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        pollIntervalMs: 0,
        fetchImpl: mockFailedOpFetch,
      });

      const resultOpFailed = await extractorOpFailed.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'corrupt.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultOpFailed.success === false, 'Failed async operation returns success: false');
      assert(
        resultOpFailed.errorMessage?.includes('Corrupted document payload') === true,
        'Error message captures operation failure detail'
      );
    }

    {
      // D.5 Malformed JSON response
      const mockMalformedFetch: typeof fetch = async () => {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => {
            throw new Error('Unexpected token < in JSON at position 0');
          },
        } as unknown as Response;
      };

      const extractorMalformed = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockMalformedFetch,
      });

      const resultMalformed = await extractorMalformed.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'malformed.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultMalformed.success === false, 'Malformed JSON returns success: false');
      assert(
        resultMalformed.errorMessage?.includes('malformed') === true,
        'Error message indicates malformed JSON'
      );
    }

    {
      // D.6 Polling Timeout (exceeding maxPollAttempts)
      let attempts = 0;
      const mockTimeoutFetch: typeof fetch = async (url) => {
        if (url.toString().includes(':analyze?')) {
          const headers = new Headers();
          headers.set('operation-location', 'https://test/op-timeout');
          return {
            status: 202,
            ok: true,
            headers,
            json: async () => ({}),
          } as unknown as Response;
        }

        attempts++;
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({ status: 'running' }),
        } as unknown as Response;
      };

      const extractorTimeout = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        pollIntervalMs: 0,
        maxPollAttempts: 3,
        fetchImpl: mockTimeoutFetch,
      });

      const resultTimeout = await extractorTimeout.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'timeout.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultTimeout.success === false, 'Polling timeout returns success: false');
      assert(attempts === 3, 'Polled exactly maxPollAttempts (3) times');
      assert(
        resultTimeout.errorMessage?.includes('timed out after 3 attempts') === true,
        'Error message clearly explains polling timeout'
      );
    }

    {
      // D.7 Network Exception
      const mockNetworkErrorFetch: typeof fetch = async () => {
        throw new Error('ECONNREFUSED connect to azure endpoint');
      };

      const extractorNetErr = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockNetworkErrorFetch,
      });

      const resultNetErr = await extractorNetErr.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'net_err.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultNetErr.success === false, 'Network exception returns success: false');
      assert(
        resultNetErr.errorMessage?.includes('ECONNREFUSED') === true,
        'Network exception message captured cleanly'
      );
    }

    // -------------------------------------------------------------------------
    // E. Contract Safety & Non-Fabrication
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION E: Contract Safety & Domain Non-Fabrication ---');

    {
      // E.1 Verify that extractor does NOT fabricate student/NISN/attendance domain properties
      const mockFetch: typeof fetch = async () => {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({
            status: 'succeeded',
            analyzeResult: {
              content: 'NISN 1234567890 Student Name Here',
              pages: [
                {
                  pageNumber: 1,
                  lines: [{ content: 'NISN 1234567890 Student Name Here', confidence: 0.95 }],
                },
              ],
            },
          }),
        } as unknown as Response;
      };

      const extractor = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockFetch,
      });

      const result = await extractor.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'test_safety.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(result.success === true, 'Extraction succeeds');
      assert(result.items.length === 1, 'Extracted 1 generic item');
      const item = result.items[0];

      assert(item.ocrText === 'NISN 1234567890 Student Name Here', 'ocrText preserved as-is');
      assert(item.matchedStudentId === undefined, 'matchedStudentId is NOT fabricated');
      assert(item.matchedStudentName === undefined, 'matchedStudentName is NOT fabricated');
      assert(item.matchedNisn === undefined, 'matchedNisn is NOT fabricated');
      assert(item.nisn === undefined, 'nisn is NOT fabricated');
      assert(item.status === undefined, 'status is NOT fabricated');
      assert(item.date === undefined, 'date is NOT fabricated');
    }

    {
      // E.2 Fallback: Content exists without page lines -> Single item with rawText
      const mockRawContentOnlyFetch: typeof fetch = async () => {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({
            status: 'succeeded',
            analyzeResult: {
              content: 'Raw block of extracted content with no line segmentation',
              pages: [],
            },
          }),
        } as unknown as Response;
      };

      const extractorRawOnly = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockRawContentOnlyFetch,
      });

      const resultRawOnly = await extractorRawOnly.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'raw_only.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultRawOnly.success === true, 'Raw content without lines succeeds');
      assert(resultRawOnly.items.length === 1, 'Returns 1 item containing the rawText');
      assert(
        resultRawOnly.items[0].ocrText ===
          'Raw block of extracted content with no line segmentation',
        'Single item contains exact rawText'
      );
    }

    {
      // E.3 Empty analyze result -> Empty items array deterministically
      const mockEmptyFetch: typeof fetch = async () => {
        return {
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({
            status: 'succeeded',
            analyzeResult: {
              content: '',
              pages: [],
            },
          }),
        } as unknown as Response;
      };

      const extractorEmpty = new AzureDocumentExtractor({
        endpoint: 'https://test-doc-ai.cognitiveservices.azure.com',
        apiKey: 'valid-key',
        fetchImpl: mockEmptyFetch,
      });

      const resultEmpty = await extractorEmpty.extract({
        tenantId,
        documentId,
        documentVersionId,
        fileName: 'blank.pdf',
        mimeType: 'application/pdf',
        content: samplePdfBuffer,
      });

      assert(resultEmpty.success === true, 'Blank document extraction succeeds');
      assert(resultEmpty.items.length === 0, 'Blank document yields empty items array');
      assert(resultEmpty.rawText === '', 'rawText is empty string');
    }

    console.log('\n================================================================');
    console.log(` ALL ${passCount} / ${testCount} AZURE EXTRACTOR TESTS PASSED`);
    console.log('================================================================\n');
  } finally {
    // Restore environment variables
    if (originalEnvEndpoint) process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = originalEnvEndpoint;
    if (originalEnvKey) process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = originalEnvKey;
    if (originalEnvFrEndpoint) process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = originalEnvFrEndpoint;
    if (originalEnvFrKey) process.env.AZURE_FORM_RECOGNIZER_KEY = originalEnvFrKey;
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});
