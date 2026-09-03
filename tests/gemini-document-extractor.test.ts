import crypto from 'crypto';
import {
  GeminiDocumentExtractor,
  GeminiClientAdapter,
  resolveGeminiDocumentExtractorConfig,
} from '../src/platform/services/gemini-document-extractor';
import {
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { AzureDocumentExtractor } from '../src/platform/services/azure-document-extractor';
import { DocumentExtractionRequest } from '../src/platform/types/document-extractor';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string): void {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${message}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${message}${detail ? ' — ' + detail : ''}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Environment isolation helpers
// ---------------------------------------------------------------------------

function saveAndClearAllProviderEnv(): () => void {
  const saved: Record<string, string | undefined> = {
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    AZURE_DOCUMENT_INTELLIGENCE_KEY: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
    AZURE_FORM_RECOGNIZER_ENDPOINT: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY: process.env.AZURE_FORM_RECOGNIZER_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  delete process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  delete process.env.AZURE_FORM_RECOGNIZER_KEY;
  delete process.env.GEMINI_API_KEY;

  return () => {
    for (const [key, val] of Object.entries(saved)) {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    }
  };
}

// ---------------------------------------------------------------------------
// Minimal mock Gemini client factory builder
// ---------------------------------------------------------------------------

function buildMockClientFactory(responseText: string): (apiKey: string) => GeminiClientAdapter {
  return (_apiKey: string) => ({
    generateContent: async () => ({
      text: responseText,
    }),
  });
}

function buildThrowingClientFactory(errorMessage: string): (apiKey: string) => GeminiClientAdapter {
  return (_apiKey: string) => ({
    generateContent: async () => {
      throw new Error(errorMessage);
    },
  });
}

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------

const tenantId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const samplePdfBuffer = Buffer.from('%PDF-1.4 Mock Binary Content');

function makeRequest(overrides: Partial<DocumentExtractionRequest> = {}): DocumentExtractionRequest {
  return {
    tenantId,
    documentId,
    documentVersionId,
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    content: samplePdfBuffer,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
  console.log('================================================================');
  console.log(' GEMINI DOCUMENT EXTRACTOR: COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  // =========================================================================
  // SECTION 1: Gemini Configuration Resolution
  // =========================================================================
  console.log('--- SECTION 1: Gemini Configuration Resolution ---');

  {
    // 1.1 GEMINI_API_KEY present → configured
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'test-gemini-key-abc';
      const status = resolveGeminiDocumentExtractorConfig(process.env);
      assert(status.isConfigured === true, 'GEMINI_API_KEY present → isConfigured true');
      assert(status.hasApiKey === true, 'GEMINI_API_KEY present → hasApiKey true');
    } finally { restore(); }
  }

  {
    // 1.2 GEMINI_API_KEY absent → unconfigured
    const restore = saveAndClearAllProviderEnv();
    try {
      const status = resolveGeminiDocumentExtractorConfig(process.env);
      assert(status.isConfigured === false, 'GEMINI_API_KEY absent → isConfigured false');
      assert(status.hasApiKey === false, 'GEMINI_API_KEY absent → hasApiKey false');
    } finally { restore(); }
  }

  {
    // 1.3 GEMINI_API_KEY empty string → unconfigured
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = '   ';
      const status = resolveGeminiDocumentExtractorConfig(process.env);
      assert(status.isConfigured === false, 'Whitespace-only GEMINI_API_KEY → unconfigured');
    } finally { restore(); }
  }

  {
    // 1.4 Config status contains NO secret values
    const restore = saveAndClearAllProviderEnv();
    try {
      const secretKey = 'super-secret-gemini-key-do-not-leak';
      process.env.GEMINI_API_KEY = secretKey;
      const status = resolveGeminiDocumentExtractorConfig(process.env);
      const serialized = JSON.stringify(status);
      assert(
        !serialized.includes(secretKey),
        'Config status summary never contains the API key value'
      );
    } finally { restore(); }
  }

  // =========================================================================
  // SECTION 2: Factory Selection — Gemini Provider
  // =========================================================================
  console.log('\n--- SECTION 2: Factory Selection — Gemini Provider ---');

  {
    // 2.1 No providers → UnavailableDocumentExtractor
    const restore = saveAndClearAllProviderEnv();
    try {
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'No providers configured → UnavailableDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // 2.2 Gemini only → GeminiDocumentExtractor
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'test-gemini-key-factory';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof GeminiDocumentExtractor,
        'GEMINI_API_KEY set, Azure absent → GeminiDocumentExtractor selected'
      );
    } finally { restore(); }
  }

  {
    // 2.3 Azure fully configured → Azure wins over Gemini
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'azure-key-xyz';
      process.env.GEMINI_API_KEY = 'test-gemini-key-secondary';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof AzureDocumentExtractor,
        'Azure fully configured → AzureDocumentExtractor wins over Gemini'
      );
    } finally { restore(); }
  }

  {
    // 2.4 Partial Azure (endpoint only) → UnavailableDocumentExtractor, NOT Gemini fallback
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      process.env.GEMINI_API_KEY = 'test-gemini-fallback-key';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Partial Azure (endpoint only) + Gemini key → UnavailableDocumentExtractor (partial Azure fails closed, no Gemini fallback)'
      );
    } finally { restore(); }
  }

  {
    // 2.5 Partial Azure (key only) → UnavailableDocumentExtractor, NOT Gemini fallback
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'azure-partial-key';
      process.env.GEMINI_API_KEY = 'test-gemini-fallback-key';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Partial Azure (key only) + Gemini key → UnavailableDocumentExtractor (no Gemini fallback for partial Azure)'
      );
    } finally { restore(); }
  }

  {
    // 2.6 Factory never returns DeterministicDocumentExtractor (Gemini only)
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'test-key-det-check';
      const extractor = getDocumentExtractor();
      assert(
        !(extractor instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor when Gemini is configured'
      );
    } finally { restore(); }
  }

  {
    // 2.7 Factory returns new instances per call (no singleton)
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'test-key-singleton';
      const e1 = getDocumentExtractor();
      const e2 = getDocumentExtractor();
      assert(e1 !== e2, 'getDocumentExtractor() returns new GeminiDocumentExtractor per call');
      assert(
        e1 instanceof GeminiDocumentExtractor && e2 instanceof GeminiDocumentExtractor,
        'Both instances are GeminiDocumentExtractor'
      );
    } finally { restore(); }
  }

  // =========================================================================
  // SECTION 3: GeminiDocumentExtractor — Input Validation
  // =========================================================================
  console.log('\n--- SECTION 3: Input Validation ---');

  {
    // 3.1 Empty binary content
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory('{"items":[]}'),
    });
    const result = await extractor.extract(makeRequest({ content: Buffer.alloc(0) }));
    assert(result.success === false, 'Empty binary content → success: false');
    assert(
      result.errorMessage?.includes('Binary content cannot be empty') === true,
      'Empty binary returns validation error'
    );
    assert(Array.isArray(result.items) && result.items.length === 0, 'Empty content → empty items');
  }

  {
    // 3.2 Missing API key → fail closed
    const restore = saveAndClearAllProviderEnv();
    try {
      const extractor = new GeminiDocumentExtractor(); // no apiKey, no env
      const result = await extractor.extract(makeRequest());
      assert(result.success === false, 'Missing API key → success: false');
      assert(
        result.errorMessage?.includes('GEMINI_API_KEY is required') === true,
        'Missing API key → clear configuration error'
      );
    } finally { restore(); }
  }

  // =========================================================================
  // SECTION 4: Successful Extraction
  // =========================================================================
  console.log('\n--- SECTION 4: Successful Extraction ---');

  {
    // 4.1 Well-formed Gemini response → successful extraction
    const mockResponse = JSON.stringify({
      items: [
        { ocrText: 'DAFTAR KETIDAKHADIRAN SISWA', confidence: 99 },
        { ocrText: 'Tanggal: 2026-09-01', confidence: 95 },
        { ocrText: '1. Ahmad Pratama - Sakit', confidence: 92 },
      ],
    });

    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory(mockResponse),
    });

    const result = await extractor.extract(makeRequest({ metadata: { batchId: 'B-001' } }));

    assert(result.success === true, 'Well-formed response → success: true');
    assert(Array.isArray(result.items), 'items is an array');
    assert(result.items.length === 3, 'Exactly 3 items extracted');
    assert(result.items[0].ocrText === 'DAFTAR KETIDAKHADIRAN SISWA', 'Item 0 ocrText correct');
    assert(result.items[0].confidence === 99, 'Item 0 confidence is 99');
    assert(result.items[2].ocrText === '1. Ahmad Pratama - Sakit', 'Item 2 ocrText correct');
    assert(result.items[2].confidence === 92, 'Item 2 confidence is 92');
    assert(
      typeof result.items[0].id === 'string' && result.items[0].id.length > 0,
      'Item 0 has a UUID id'
    );
    assert(result.metadata?.provider === 'gemini', 'Metadata provider is "gemini"');
    assert(typeof result.metadata?.model === 'string', 'Metadata model is set');
    assert(result.metadata?.batchId === 'B-001', 'Caller metadata preserved in output');
    assert(
      result.rawText === 'DAFTAR KETIDAKHADIRAN SISWA\nTanggal: 2026-09-01\n1. Ahmad Pratama - Sakit',
      'rawText is joined ocrText lines'
    );
    assert(result.pageCount === 1, 'pageCount is 1');
  }

  {
    // 4.2 Response with markdown code fences (model misbehavior gracefully handled)
    const fencedResponse =
      '```json\n{"items":[{"ocrText":"Line with fence","confidence":88}]}\n```';

    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory(fencedResponse),
    });

    const result = await extractor.extract(makeRequest());
    assert(result.success === true, 'Markdown-fenced JSON response is parsed correctly');
    assert(result.items.length === 1, 'Extracted 1 item from fenced response');
    assert(result.items[0].ocrText === 'Line with fence', 'ocrText from fenced response correct');
  }

  {
    // 4.3 Empty items array (blank document)
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory('{"items":[]}'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === true, 'Empty items → success: true (blank document)');
    assert(result.items.length === 0, 'Empty items → 0 items');
    assert(result.rawText === '', 'Empty items → empty rawText');
  }

  {
    // 4.4 Items with missing confidence field (confidence is optional)
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory('{"items":[{"ocrText":"No confidence here"}]}'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === true, 'Item without confidence field succeeds');
    assert(result.items[0].ocrText === 'No confidence here', 'ocrText correct');
    assert(result.items[0].confidence === undefined, 'confidence is undefined when absent');
  }

  {
    // 4.5 Items with empty ocrText are silently filtered out
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory(
        '{"items":[{"ocrText":""},{"ocrText":"  "},{"ocrText":"Valid line"}]}'
      ),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === true, 'Empty ocrText items filtered → success: true');
    assert(result.items.length === 1, 'Only 1 non-empty item survives filtering');
    assert(result.items[0].ocrText === 'Valid line', 'Non-empty item preserved');
  }

  // =========================================================================
  // SECTION 5: Failure and Error Handling
  // =========================================================================
  console.log('\n--- SECTION 5: Failure and Error Handling ---');

  {
    // 5.1 Gemini client throws → fail-closed error result
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildThrowingClientFactory('Gemini API quota exceeded'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Gemini client exception → success: false');
    assert(
      result.errorMessage?.includes('Gemini document extraction failed') === true,
      'Error message indicates extraction failure'
    );
    assert(
      result.errorMessage?.includes('quota exceeded') === true,
      'Underlying error message is propagated'
    );
    assert(Array.isArray(result.items) && result.items.length === 0, 'Exception → empty items');
  }

  {
    // 5.2 Empty response string → fail-closed
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory(''),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Empty Gemini response → success: false');
    assert(
      result.errorMessage?.includes('empty response') === true,
      'Empty response error message is descriptive'
    );
  }

  {
    // 5.3 Malformed JSON response → fail-closed
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory('this is not json {{{'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Malformed JSON response → success: false');
    assert(
      result.errorMessage?.includes('malformed JSON') === true,
      'Malformed JSON error message is descriptive'
    );
  }

  {
    // 5.4 Structurally invalid JSON (no items array)
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory('{"result":"ok","data":{}}'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Missing items array → success: false');
    assert(
      result.errorMessage?.includes('valid items array') === true,
      'Missing items array error is descriptive'
    );
  }

  // =========================================================================
  // SECTION 6: Secret Non-Leakage
  // =========================================================================
  console.log('\n--- SECTION 6: Secret Non-Leakage ---');

  {
    // 6.1 API key must not appear in extraction failure error messages
    const secretKey = 'super-secret-gemini-key-leak-test-xyz';
    const extractor = new GeminiDocumentExtractor({
      apiKey: secretKey,
      clientFactory: buildThrowingClientFactory('Network connection error'),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Failure result produced');
    assert(
      typeof result.errorMessage === 'string' && !result.errorMessage.includes(secretKey),
      'API key is NOT present in extraction failure error message'
    );
  }

  {
    // 6.2 API key must not appear in config status
    const restore = saveAndClearAllProviderEnv();
    try {
      const secretKey = 'another-secret-key-config-status-leak-test';
      process.env.GEMINI_API_KEY = secretKey;
      const status = resolveGeminiDocumentExtractorConfig(process.env);
      const serialized = JSON.stringify(status);
      assert(!serialized.includes(secretKey), 'API key is NOT present in config status object');
    } finally { restore(); }
  }

  {
    // 6.3 If Gemini error message contains the API key itself, it must be redacted
    const secretKey = 'key-that-appears-in-error';
    const extractor = new GeminiDocumentExtractor({
      apiKey: secretKey,
      clientFactory: buildThrowingClientFactory(`Authentication failed with key ${secretKey}`),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === false, 'Error with embedded key produces failure result');
    assert(
      typeof result.errorMessage === 'string' && !result.errorMessage.includes(secretKey),
      'Key embedded in error message is redacted from extraction result'
    );
    assert(
      result.errorMessage?.includes('[REDACTED]') === true,
      'Redacted key replaced with [REDACTED] placeholder'
    );
  }

  // =========================================================================
  // SECTION 7: Non-Fabrication Contract
  // =========================================================================
  console.log('\n--- SECTION 7: Non-Fabrication Contract ---');

  {
    // 7.1 GeminiDocumentExtractor does NOT add domain-specific fields to items
    const mockResponse = JSON.stringify({
      items: [{ ocrText: 'NISN 1234567890 Ahmad Pratama', confidence: 90 }],
    });
    const extractor = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: buildMockClientFactory(mockResponse),
    });
    const result = await extractor.extract(makeRequest());
    assert(result.success === true, 'Extraction succeeds');
    const item = result.items[0];
    assert(item.ocrText === 'NISN 1234567890 Ahmad Pratama', 'ocrText preserved as-is');
    assert(item.matchedStudentId === undefined, 'matchedStudentId is NOT fabricated');
    assert(item.matchedStudentName === undefined, 'matchedStudentName is NOT fabricated');
    assert(item.matchedNisn === undefined, 'matchedNisn is NOT fabricated');
    assert(item.nisn === undefined, 'nisn is NOT fabricated');
    assert(item.status === undefined, 'status is NOT fabricated');
    assert(item.date === undefined, 'date is NOT fabricated');
  }

  // =========================================================================
  // SECTION 8: Environment-level factory precedence confirmation
  // =========================================================================
  console.log('\n--- SECTION 8: Factory Precedence Confirmation ---');

  {
    // 8.1 Neither provider → UnavailableDocumentExtractor
    const restore = saveAndClearAllProviderEnv();
    try {
      const extractor = getDocumentExtractor();
      const result = await extractor.extract(makeRequest());
      assert(result.success === false, 'No providers → extraction fails');
      assert(
        typeof result.errorMessage === 'string' && result.errorMessage.length > 0,
        'No providers → descriptive error message present'
      );
    } finally { restore(); }
  }

  {
    // 8.2 Only Gemini → GeminiDocumentExtractor selected and produces result shape
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'env-gemini-key-for-factory-test';
      // We can't inject a client factory through the env-based factory path,
      // but we can confirm the selected type is correct.
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof GeminiDocumentExtractor,
        'GEMINI_API_KEY env → factory returns GeminiDocumentExtractor instance'
      );
    } finally { restore(); }
  }

  {
    // 8.3 Azure + Gemini both set → Azure wins
    const restore = saveAndClearAllProviderEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://az.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'azure-key-precedence';
      process.env.GEMINI_API_KEY = 'gemini-key-precedence';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof AzureDocumentExtractor,
        'Azure + Gemini both set → AzureDocumentExtractor wins (Azure is priority 1)'
      );
    } finally { restore(); }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(` ALL ${passCount} / ${testCount} GEMINI DOCUMENT EXTRACTOR TESTS PASSED`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});
