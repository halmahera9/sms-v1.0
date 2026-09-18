import crypto from 'crypto';

import {
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { HybridDocumentExtractor } from '../src/platform/services/hybrid-document-extractor';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;

  if (condition) {
    passCount++;
    console.log('  ✓ Test ' + testCount + ': ' + message);
  } else {
    console.error('  ✗ Test ' + testCount + ' FAILED: ' + message);
    throw new Error('Assertion Failed: ' + message);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.4-B: PRODUCTION EXTRACTOR COMPOSITION FACTORY TESTS');
  console.log('================================================================\n');

  console.log('--- SECTION A: Production Factory Contract ---');

  {
    const extractor = getDocumentExtractor();

    assert(
      extractor instanceof HybridDocumentExtractor,
      'Production factory returns HybridDocumentExtractor'
    );

    assert(
      typeof extractor.extract === 'function',
      'HybridDocumentExtractor implements extract()'
    );
  }

  {
    const e1 = getDocumentExtractor();
    const e2 = getDocumentExtractor();

    assert(
      e1 !== e2,
      'Factory returns a new extractor instance per call'
    );

    assert(
      e1 instanceof HybridDocumentExtractor &&
        e2 instanceof HybridDocumentExtractor,
      'Each production instance is HybridDocumentExtractor'
    );
  }

  {
    const extractor = getDocumentExtractor();

    assert(
      !(extractor instanceof DeterministicDocumentExtractor),
      'Production factory never returns DeterministicDocumentExtractor'
    );

    assert(
      !(extractor instanceof UnavailableDocumentExtractor),
      'Production factory never returns UnavailableDocumentExtractor'
    );
  }

  console.log('\n--- SECTION B: Production Provider Independence ---');

  {
    const originalGemini = process.env.GEMINI_API_KEY;
    const originalTesseract = process.env.TESSERACT_BINARY_PATH;

    try {
      process.env.GEMINI_API_KEY = 'factory-test-gemini-key';
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof HybridDocumentExtractor,
        'Gemini + Tesseract -> HybridDocumentExtractor'
      );
    } finally {
      if (originalGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGemini;
      }

      if (originalTesseract === undefined) {
        delete process.env.TESSERACT_BINARY_PATH;
      } else {
        process.env.TESSERACT_BINARY_PATH = originalTesseract;
      }
    }
  }

  {
    const originalGemini = process.env.GEMINI_API_KEY;
    const originalTesseract = process.env.TESSERACT_BINARY_PATH;

    try {
      delete process.env.GEMINI_API_KEY;
      process.env.TESSERACT_BINARY_PATH = process.execPath;

      const extractor = getDocumentExtractor();

      assert(
        extractor instanceof HybridDocumentExtractor,
        'Tesseract without Gemini -> HybridDocumentExtractor'
      );
    } finally {
      if (originalGemini === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGemini;
      }

      if (originalTesseract === undefined) {
        delete process.env.TESSERACT_BINARY_PATH;
      } else {
        process.env.TESSERACT_BINARY_PATH = originalTesseract;
      }
    }
  }

  console.log('\n--- SECTION C: Explicit Test/Dev Injection ---');

  {
    const deterministic = new DeterministicDocumentExtractor({
      defaultItems: [
        {
          ocrText: 'Test OCR line',
          confidence: 95,
        },
      ],
    });

    assert(
      typeof deterministic.extract === 'function',
      'DeterministicDocumentExtractor remains available for explicit injection'
    );

    const result = await deterministic.extract({
      tenantId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      documentVersionId: crypto.randomUUID(),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('content'),
    });

    assert(
      result.success === true && result.items.length === 1,
      'DeterministicDocumentExtractor produces injected fixture data'
    );
  }

  {
    const unavailable = new UnavailableDocumentExtractor(
      'Custom unavailable reason for this test'
    );

    const result = await unavailable.extract({
      tenantId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      documentVersionId: crypto.randomUUID(),
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('content'),
    });

    assert(
      result.success === false,
      'UnavailableDocumentExtractor remains fail-closed'
    );

    assert(
      result.errorMessage === 'Custom unavailable reason for this test',
      'UnavailableDocumentExtractor preserves explicit failure reason'
    );
  }

  console.log('\n================================================================');
  console.log(
    ' ALL ' + passCount + ' / ' + testCount + ' EXTRACTOR FACTORY TESTS PASSED'
  );
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});
