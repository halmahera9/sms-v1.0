import crypto from 'crypto';
import {
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { GeminiDocumentExtractor } from '../src/platform/services/gemini-document-extractor';
import { LocalOcrGeminiDocumentExtractor } from '../src/platform/services/local-ocr-gemini-document-extractor';

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

/**
 * Clears all Azure, Gemini, and Tesseract provider env vars and returns a restore function.
 * Must clear all providers so tests expecting specific precedence outcomes are not
 * inadvertently satisfied by another available provider.
 */
function clearProviderEnv(): () => void {
  const saved: Record<string, string | undefined> = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TESSERACT_BINARY_PATH: process.env.TESSERACT_BINARY_PATH,
  };

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

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.4-B: PRODUCTION EXTRACTOR COMPOSITION FACTORY TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION A: getDocumentExtractor() factory selection
  // -------------------------------------------------------------------------
  console.log('--- SECTION A: getDocumentExtractor() Factory Selection ---');

  {
    // A.1: Gemini + Tesseract -> Local OCR + Gemini extractor
    const restore = clearProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'factory-test-gemini-key';
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof LocalOcrGeminiDocumentExtractor,
        'Returns LocalOcrGeminiDocumentExtractor when Gemini and Tesseract are available'
      );
    } finally { restore(); }
  }

  {
    // A.2: Gemini only -> direct Gemini extractor
    const restore = clearProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'factory-test-gemini-key';
      process.env.TESSERACT_BINARY_PATH =
        'nonexistent_tesseract_binary_path_for_factory_test';

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof GeminiDocumentExtractor,
        'Returns GeminiDocumentExtractor when Gemini is configured and Tesseract is unavailable'
      );
    } finally { restore(); }
  }

  {
    // A.3: No Gemini configuration -> fail closed
    const restore = clearProviderEnv();
    try {
      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Returns UnavailableDocumentExtractor when Gemini is not configured'
      );
    } finally { restore(); }
  }

  {
    // A.4: Tesseract alone is insufficient; Gemini remains the required semantic provider.
    const restore = clearProviderEnv();
    try {
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Returns UnavailableDocumentExtractor when Tesseract exists but Gemini is not configured'
      );
    } finally { restore(); }
  }

  {
    // A.5: Gemini configuration alone is sufficient when Tesseract is unavailable.
    const restore = clearProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.TESSERACT_BINARY_PATH = '/nonexistent/tesseract';

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof GeminiDocumentExtractor,
        'Gemini API key alone selects GeminiDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // A.6: Unavailable extractor produces a descriptive fail-closed result.
    const restore = clearProviderEnv();
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

      assert(
        result.success === false,
        'UnavailableDocumentExtractor returns success: false'
      );

      assert(
        typeof result.errorMessage === 'string' &&
          result.errorMessage.includes('Gemini AI is not configured'),
        'UnavailableDocumentExtractor error message describes missing Gemini configuration'
      );

      assert(
        Array.isArray(result.items) && result.items.length === 0,
        'UnavailableDocumentExtractor returns empty items array'
      );
    } finally { restore(); }
  }

  {
    // A.7: Factory never returns DeterministicDocumentExtractor.
    const restore = clearProviderEnv();
    try {
      const extractorNoConfig = getDocumentExtractor();

      assert(
        !(extractorNoConfig instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor without provider configuration'
      );

      process.env.GEMINI_API_KEY = 'factory-test-gemini-key';
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractorWithProviders = getDocumentExtractor();

      assert(
        !(extractorWithProviders instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor with production providers configured'
      );
    } finally { restore(); }
  }

  // -------------------------------------------------------------------------
  // SECTION A-EXT: Factory precedence
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION A-EXT: Factory Precedence ---');

  {
    // A-EXT.1: Gemini + Tesseract -> Local OCR + Gemini.
    const restore = clearProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'gemini-key-precedence';
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof LocalOcrGeminiDocumentExtractor,
        'Gemini + Tesseract -> LocalOcrGeminiDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // A-EXT.2: Gemini without Tesseract -> direct Gemini.
    const restore = clearProviderEnv();
    try {
      process.env.GEMINI_API_KEY = 'gemini-key-no-tesseract';
      process.env.TESSERACT_BINARY_PATH =
        'nonexistent_tesseract_binary_path_for_factory_test';

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof GeminiDocumentExtractor,
        'Gemini without Tesseract -> GeminiDocumentExtractor'
      );
    } finally { restore(); }
  }

  {
    // A-EXT.3: No Gemini -> unavailable, even if Tesseract exists.
    const restore = clearProviderEnv();
    try {
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Tesseract without Gemini -> UnavailableDocumentExtractor'
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
    const restore = clearProviderEnv();
    try {
      const e1 = getDocumentExtractor();
      const e2 = getDocumentExtractor();

      assert(
        e1 !== e2,
        'getDocumentExtractor() returns a new instance on each call (no singleton)'
      );

      assert(
        e1 instanceof UnavailableDocumentExtractor &&
          e2 instanceof UnavailableDocumentExtractor,
        'Both instances without Gemini configuration are UnavailableDocumentExtractor'
      );

      process.env.GEMINI_API_KEY = 'test-gemini-key-iso';
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const e3 = getDocumentExtractor();
      const e4 = getDocumentExtractor();

      assert(
        e3 !== e4,
        'getDocumentExtractor() returns distinct LocalOcrGeminiDocumentExtractor instances per call'
      );

      assert(
        e3 instanceof LocalOcrGeminiDocumentExtractor &&
          e4 instanceof LocalOcrGeminiDocumentExtractor,
        'Both instances are LocalOcrGeminiDocumentExtractor'
      );

      process.env.TESSERACT_BINARY_PATH = '/nonexistent/tesseract';

      const e5 = getDocumentExtractor();
      const e6 = getDocumentExtractor();

      assert(
        e5 !== e6,
        'getDocumentExtractor() returns distinct GeminiDocumentExtractor instances per call'
      );

      assert(
        e5 instanceof GeminiDocumentExtractor &&
          e6 instanceof GeminiDocumentExtractor,
        'Both instances without Tesseract are GeminiDocumentExtractor'
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
