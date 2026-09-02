import crypto from 'crypto';
import {
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { AzureDocumentExtractor } from '../src/platform/services/azure-document-extractor';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log('  \u2713 Test ' + testCount + ': ' + message);
  } else {
    console.error('  \u2717 Test ' + testCount + ' FAILED: ' + message);
    throw new Error('Assertion Failed: ' + message);
  }
}

/** Clears all Azure env vars and returns a restore function. */
function clearAzureEnv(): () => void {
  const saved: Record<string, string | undefined> = {
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    AZURE_DOCUMENT_INTELLIGENCE_KEY: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
    AZURE_FORM_RECOGNIZER_ENDPOINT: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY: process.env.AZURE_FORM_RECOGNIZER_KEY,
  };
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  delete process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  delete process.env.AZURE_FORM_RECOGNIZER_KEY;
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

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.4-B: PRODUCTION EXTRACTOR COMPOSITION FACTORY TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION A: getDocumentExtractor() factory selection
  // -------------------------------------------------------------------------
  console.log('--- SECTION A: getDocumentExtractor() Factory Selection ---');

  {
    // A.1: Full primary Azure config -> AzureDocumentExtractor
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-api-key-001';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof AzureDocumentExtractor,
        'Returns AzureDocumentExtractor when primary endpoint and key are set'
      );
    } finally { restore(); }
  }

  {
    // A.2: Form Recognizer fallback vars -> AzureDocumentExtractor
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = 'https://fr.cognitiveservices.azure.com';
      process.env.AZURE_FORM_RECOGNIZER_KEY = 'fr-api-key-002';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof AzureDocumentExtractor,
        'Returns AzureDocumentExtractor when Form Recognizer env vars are set'
      );
    } finally { restore(); }
  }

  {
    // A.3: No Azure vars -> UnavailableDocumentExtractor
    const restore = clearAzureEnv();
    try {
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Returns UnavailableDocumentExtractor when no Azure configuration exists'
      );
    } finally { restore(); }
  }

  {
    // A.4: Endpoint only (no key) -> UnavailableDocumentExtractor
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Partial config (endpoint only, no key) returns UnavailableDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // A.5: Key only (no endpoint) -> UnavailableDocumentExtractor
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-api-key-003';
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Partial config (key only, no endpoint) returns UnavailableDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // A.6: Unavailable extractor produces a descriptive fail-closed result
    const restore = clearAzureEnv();
    try {
      const extractor = getDocumentExtractor();
      const result = await extractor.extract({
        tenantId: crypto.randomUUID(),
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('PDF Content'),
      });
      assert(result.success === false, 'UnavailableDocumentExtractor returns success: false');
      assert(
        typeof result.errorMessage === 'string' &&
          result.errorMessage.includes('Azure Document Intelligence is not configured'),
        'UnavailableDocumentExtractor error message describes the missing Azure configuration'
      );
      assert(
        Array.isArray(result.items) && result.items.length === 0,
        'UnavailableDocumentExtractor returns empty items array'
      );
    } finally { restore(); }
  }

  {
    // A.7: Factory never returns DeterministicDocumentExtractor under any env state
    const restore = clearAzureEnv();
    try {
      const extractorNoConfig = getDocumentExtractor();
      assert(
        !(extractorNoConfig instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor (no Azure config)'
      );
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'key-xyz';
      const extractorWithConfig = getDocumentExtractor();
      assert(
        !(extractorWithConfig instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor (with Azure config)'
      );
    } finally { restore(); }
  }

  // -------------------------------------------------------------------------
  // SECTION B: Explicit injection still works for test/dev usage
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION B: Explicit Test Injection Isolation ---');

  {
    // B.1: DeterministicDocumentExtractor is still constructible for explicit injection
    const det = new DeterministicDocumentExtractor({
      defaultItems: [{ ocrText: 'Test OCR line', confidence: 95 }],
    });
    assert(
      typeof det.extract === 'function',
      'DeterministicDocumentExtractor implements extract() (usable for explicit injection)'
    );
  }

  {
    // B.2: UnavailableDocumentExtractor accepts custom reason when explicitly constructed
    const unavail = new UnavailableDocumentExtractor('Custom unavailable reason for this test');
    assert(typeof unavail.extract === 'function', 'UnavailableDocumentExtractor implements extract()');
    const result = await unavail.extract({
      tenantId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      documentVersionId: crypto.randomUUID(),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('content'),
    });
    assert(result.success === false, 'Explicit UnavailableDocumentExtractor injection returns failure');
    assert(
      result.errorMessage === 'Custom unavailable reason for this test',
      'Explicit UnavailableDocumentExtractor carries custom reason'
    );
  }

  // -------------------------------------------------------------------------
  // SECTION C: Factory returns new instances (no singleton / mutable state)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION C: Factory Returns New Instance Per Call ---');

  {
    const restore = clearAzureEnv();
    try {
      const e1 = getDocumentExtractor();
      const e2 = getDocumentExtractor();
      assert(e1 !== e2, 'getDocumentExtractor() returns a new instance on each call (no singleton)');
      assert(
        e1 instanceof UnavailableDocumentExtractor && e2 instanceof UnavailableDocumentExtractor,
        'Both instances without config are UnavailableDocumentExtractor'
      );

      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'test-key-abc';
      const e3 = getDocumentExtractor();
      const e4 = getDocumentExtractor();
      assert(
        e3 !== e4,
        'getDocumentExtractor() returns distinct AzureDocumentExtractor instances per call'
      );
      assert(
        e3 instanceof AzureDocumentExtractor && e4 instanceof AzureDocumentExtractor,
        'Both instances with full config are AzureDocumentExtractor'
      );
    } finally { restore(); }
  }

  console.log('\n================================================================');
  console.log(' ALL ' + passCount + ' / ' + testCount + ' EXTRACTOR COMPOSITION TESTS PASSED');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});