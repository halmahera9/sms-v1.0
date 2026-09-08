import crypto from 'crypto';
import {
  LocalOcrGeminiDocumentExtractor,
} from '../src/platform/services/local-ocr-gemini-document-extractor';
import { GeminiDocumentExtractor } from '../src/platform/services/gemini-document-extractor';
import type {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
} from '../src/platform/types/document-extractor';
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

function assert(condition: boolean, message: string, detail?: string): void {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  \u2713 Test ${testCount}: ${message}`);
  } else {
    console.error(`  \u2717 Test ${testCount} FAILED: ${message}${detail ? ' - ' + detail : ''}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Test Doubles & Spies
// ---------------------------------------------------------------------------

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
  constructor(
    private readonly handler: (req: LocalOcrRequest) => LocalOcrResult
  ) {}
  async recognise(req: LocalOcrRequest): Promise<LocalOcrResult> {
    this.recogniseCalls.push(req);
    return this.handler(req);
  }
}

class SpyGeminiExtractor extends GeminiDocumentExtractor {
  public extractCalls: DocumentExtractionRequest[] = [];
  public extractFromTextCalls: { ocrText: string; request: DocumentExtractionRequest }[] = [];
  private readonly textResponse: DocumentExtractionResult;
  private readonly binaryResponse: DocumentExtractionResult;

  constructor(options: {
    apiKey?: string;
    textResponse?: DocumentExtractionResult;
    binaryResponse?: DocumentExtractionResult;
  } = {}) {
    super({ apiKey: options.apiKey || 'test-key' });
    this.textResponse = options.textResponse || {
      success: true,
      items: [{ id: '1', ocrText: 'DEFAULT_TEXT_ITEM', confidence: 95 }],
    };
    this.binaryResponse = options.binaryResponse || {
      success: true,
      items: [{ id: '2', ocrText: 'DEFAULT_BINARY_ITEM', confidence: 80 }],
    };
  }

  public override async extract(req: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    this.extractCalls.push(req);
    return this.binaryResponse;
  }

  public override async extractFromText(
    ocrText: string,
    req: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    this.extractFromTextCalls.push({ ocrText, request: req });
    return this.textResponse;
  }
}

class SpyFallbackExtractor implements IDocumentExtractor {
  public extractCalls: DocumentExtractionRequest[] = [];
  constructor(
    private readonly response: DocumentExtractionResult = {
      success: true,
      items: [{ id: 'fb', ocrText: 'FALLBACK_SUCCESS', confidence: 75 }],
    }
  ) {}
  async extract(req: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    this.extractCalls.push(req);
    return this.response;
  }
}

function makeRequest(
  mimeType: string = 'image/png',
  content: Buffer = Buffer.from('RAW_DOCUMENT_BINARY_BYTES')
): DocumentExtractionRequest {
  return {
    tenantId: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentVersionId: crypto.randomUUID(),
    fileName: mimeType === 'application/pdf' ? 'test.pdf' : 'test.png',
    mimeType,
    content,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.6-B: FOCUSED LOCAL OCR + GEMINI HYBRID EXTRACTOR TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Scenario 1, 3, 4: Image -> OCR -> Gemini extractFromText -> structured result
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Image Direct OCR Path ---');
  {
    const spyGemini = new SpyGeminiExtractor({
      textResponse: {
        success: true,
        items: [{ id: 'img-1', ocrText: 'NAMA: AHMAD', confidence: 98 }],
      },
    });
    const spyFallback = new SpyFallbackExtractor();

    const mockOcr = new MockOcrEngine(() => ({
      success: true,
      lines: [{ text: 'NAMA: AHMAD', confidence: 90 }],
      rawText: 'NAMA: AHMAD',
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const imageReq = makeRequest('image/jpeg', Buffer.from('SAMPLE_JPEG_BINARY'));
    const result = await extractor.extract(imageReq);

    assert(result.success === true, 'Scenario 1: Image extraction succeeds');
    assert(result.items.length === 1, 'Returns 1 extracted item');
    assert(result.items[0]?.ocrText === 'NAMA: AHMAD', 'Item text matches structured Gemini output');

    // Method invocation assertions
    assert(
      spyGemini.extractFromTextCalls.length === 1,
      'Scenario 1: Calls extractFromText() on successful OCR path'
    );
    assert(
      spyGemini.extractCalls.length === 0,
      'Scenario 1: Does NOT call extract() on geminiExtractor when OCR succeeds'
    );
    assert(
      spyFallback.extractCalls.length === 0,
      'Scenario 1: Does NOT call fallbackExtractor when OCR succeeds'
    );

    // Scenario 3: Verify OCR text is passed to Gemini
    const textArg = spyGemini.extractFromTextCalls[0]?.ocrText || '';
    assert(
      textArg === 'NAMA: AHMAD',
      'Scenario 3: OCR text is passed accurately to extractFromText()'
    );

    // Scenario 4: Verify original binary/base64 is NOT sent through Gemini text extraction path
    const passedReq = spyGemini.extractFromTextCalls[0]?.request;
    assert(
      !textArg.includes('SAMPLE_JPEG_BINARY') && !textArg.includes('base64'),
      'Scenario 4: Raw binary content is NOT sent through Gemini text prompt'
    );
    assert(passedReq === imageReq, 'Scenario 4: Context request is forwarded cleanly');
  }

  // -------------------------------------------------------------------------
  // Scenario 2, 11: PDF Multi-page Rendering & Deterministic Page Order
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: PDF Multi-Page Deterministic Ordering ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor();

    const mockPdf = new MockPdfRenderer({
      success: true,
      pages: [
        { pageNumber: 1, imageBuffer: Buffer.from('page-1-bytes'), mimeType: 'image/png' },
        { pageNumber: 2, imageBuffer: Buffer.from('page-2-bytes'), mimeType: 'image/png' },
        { pageNumber: 3, imageBuffer: Buffer.from('page-3-bytes'), mimeType: 'image/png' },
      ],
      pageCount: 3,
    });

    const mockOcr = new MockOcrEngine((req) => {
      const str = req.imageBuffer.toString();
      if (str === 'page-1-bytes') {
        return { success: true, lines: [{ text: 'PAGE 1 DATA', confidence: 90 }], rawText: 'PAGE 1 DATA' };
      }
      if (str === 'page-2-bytes') {
        return { success: true, lines: [{ text: 'PAGE 2 DATA', confidence: 85 }], rawText: 'PAGE 2 DATA' };
      }
      return { success: true, lines: [{ text: 'PAGE 3 DATA', confidence: 80 }], rawText: 'PAGE 3 DATA' };
    });

    const extractor = new LocalOcrGeminiDocumentExtractor({
      pdfRenderer: mockPdf,
      ocrEngine: mockOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const pdfReq = makeRequest('application/pdf', Buffer.from('PDF_FILE_BUFFER'));
    const result = await extractor.extract(pdfReq);

    assert(result.success === true, 'Scenario 2: PDF extraction succeeds');
    assert(mockPdf.renderCalls.length === 1, 'PDF renderer was invoked once');
    assert(mockOcr.recogniseCalls.length === 3, 'OCR was invoked for all 3 pages');
    assert(spyGemini.extractFromTextCalls.length === 1, 'Gemini extractFromText called once with combined text');

    // Scenario 11: Multi-page PDF ordering is deterministic
    const combinedText = spyGemini.extractFromTextCalls[0]?.ocrText || '';
    const page1Idx = combinedText.indexOf('--- Page 1 ---\nPAGE 1 DATA');
    const page2Idx = combinedText.indexOf('--- Page 2 ---\nPAGE 2 DATA');
    const page3Idx = combinedText.indexOf('--- Page 3 ---\nPAGE 3 DATA');

    assert(
      page1Idx !== -1 && page2Idx !== -1 && page3Idx !== -1,
      'Scenario 11: All 3 page sections exist in combined OCR text'
    );
    assert(
      page1Idx < page2Idx && page2Idx < page3Idx,
      'Scenario 11: Pages appear in exact ascending page order (1 < 2 < 3)'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Empty OCR result -> fallbackExtractor.extract(request)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Fallback on Empty OCR ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor({
      success: true,
      items: [{ id: 'empty-fb', ocrText: 'FALLBACK_FOR_EMPTY_OCR', confidence: 70 }],
    });

    const mockOcr = new MockOcrEngine(() => ({
      success: true,
      lines: [],
      rawText: '   \n   ', // whitespace only
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const req = makeRequest('image/png');
    const result = await extractor.extract(req);

    assert(result.success === true, 'Scenario 5: Extraction succeeds via fallback');
    assert(result.items[0]?.ocrText === 'FALLBACK_FOR_EMPTY_OCR', 'Returns fallback items');
    assert(
      spyFallback.extractCalls.length === 1,
      'Scenario 5: Calls fallbackExtractor.extract() when OCR is empty'
    );
    assert(
      spyGemini.extractFromTextCalls.length === 0,
      'Scenario 5: Does NOT call extractFromText() when OCR is empty'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 6: OCR failure result -> fallbackExtractor.extract(request)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Fallback on OCR Failure ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor();

    const mockOcr = new MockOcrEngine(() => ({
      success: false,
      lines: [],
      rawText: '',
      errorMessage: 'Local OCR engine exited with error code 1',
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const req = makeRequest('image/png');
    const result = await extractor.extract(req);

    assert(result.success === true, 'Scenario 6: Fallback succeeds on OCR failure');
    assert(
      spyFallback.extractCalls.length === 1,
      'Scenario 6: Calls fallbackExtractor.extract() when OCR reports failure'
    );
    assert(
      spyGemini.extractFromTextCalls.length === 0,
      'Scenario 6: Does NOT call extractFromText() when OCR reports failure'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 7: OCR engine throws -> fallbackExtractor.extract(request)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Fallback on OCR Exception ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor();

    const throwingOcr: ILocalOcrEngine = {
      async recognise() {
        throw new Error('Uncaught child_process execution exception');
      },
    };

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: throwingOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const req = makeRequest('image/png');
    const result = await extractor.extract(req);

    assert(result.success === true, 'Scenario 7: Fallback succeeds when OCR throws');
    assert(
      spyFallback.extractCalls.length === 1,
      'Scenario 7: Calls fallbackExtractor.extract() when OCR engine throws'
    );
    assert(
      spyGemini.extractFromTextCalls.length === 0,
      'Scenario 7: Does NOT call extractFromText() when OCR throws'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 8: PDF renderer failure -> fallbackExtractor.extract(request)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Fallback on PDF Renderer Failure ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor();

    const failingPdf = new MockPdfRenderer({
      success: false,
      pages: [],
      pageCount: 0,
      errorMessage: 'Sharp PDF rasterization failed (corrupt header)',
    });

    const extractor = new LocalOcrGeminiDocumentExtractor({
      pdfRenderer: failingPdf,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const req = makeRequest('application/pdf');
    const result = await extractor.extract(req);

    assert(result.success === true, 'Scenario 8: Fallback succeeds when PDF renderer fails');
    assert(
      spyFallback.extractCalls.length === 1,
      'Scenario 8: Calls fallbackExtractor.extract() when PDF rendering fails'
    );
    assert(
      spyGemini.extractFromTextCalls.length === 0,
      'Scenario 8: Does NOT call extractFromText() when PDF renderer fails'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 9: OCR engine unavailable -> fallbackExtractor.extract(request)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Fallback on OCR Unavailable ---');
  {
    const spyGemini = new SpyGeminiExtractor();
    const spyFallback = new SpyFallbackExtractor();

    const unavailableOcr: ILocalOcrEngine = {
      async recognise() {
        return {
          success: false,
          lines: [],
          rawText: '',
          errorMessage: 'TesseractLocalOcrEngine unavailable: tesseract binary not found on PATH',
        };
      },
    };

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: unavailableOcr,
      geminiExtractor: spyGemini,
      fallbackExtractor: spyFallback,
    });

    const req = makeRequest('image/png');
    const result = await extractor.extract(req);

    assert(result.success === true, 'Scenario 9: Fallback succeeds when OCR is unavailable');
    assert(
      spyFallback.extractCalls.length === 1,
      'Scenario 9: Calls fallbackExtractor.extract() when OCR is unavailable'
    );
    assert(
      spyGemini.extractFromTextCalls.length === 0,
      'Scenario 9: Does NOT call extractFromText() when OCR is unavailable'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Gemini extractFromText failure -> return failure, never fabricate
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Gemini extractFromText Failure Contract ---');
  {
    // 10.1 Malformed JSON from Gemini
    const geminiWithMalformedJson = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: () => ({
        generateContent: async () => ({ text: 'NOT VALID JSON RESPONSE {{{' }),
      }),
    });

    const mockOcr = new MockOcrEngine(() => ({
      success: true,
      lines: [{ text: 'LINE 1', confidence: 95 }],
      rawText: 'LINE 1',
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: geminiWithMalformedJson,
    });

    const res = await extractor.extract(makeRequest('image/png'));
    assert(res.success === false, 'Scenario 10: Malformed Gemini JSON returns success: false');
    assert(res.items.length === 0, 'Scenario 10: Items array is empty (never fabricates items)');
    assert(
      typeof res.errorMessage === 'string' && res.errorMessage.includes('malformed JSON'),
      'Scenario 10: Returns descriptive failure error message'
    );
  }

  {
    // 10.2 Gemini API throws exception
    const geminiWithApiException = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: () => ({
        generateContent: async () => {
          throw new Error('Resource exhausted (HTTP 429)');
        },
      }),
    });

    const mockOcr = new MockOcrEngine(() => ({
      success: true,
      lines: [{ text: 'LINE 1', confidence: 95 }],
      rawText: 'LINE 1',
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: geminiWithApiException,
    });

    const res = await extractor.extract(makeRequest('image/png'));
    assert(res.success === false, 'Scenario 10: Gemini API exception returns success: false');
    assert(res.items.length === 0, 'Scenario 10: Items array is empty on API exception');
    assert(
      typeof res.errorMessage === 'string' && res.errorMessage.includes('Resource exhausted'),
      'Scenario 10: Propagates sanitized failure error message'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 12: Errors do not contain GEMINI_API_KEY or secrets
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Zero Secret Leakage ---');
  {
    const SECRET_KEY = 'super-secret-gemini-key-xyz123';
    const geminiLeakingError = new GeminiDocumentExtractor({
      apiKey: SECRET_KEY,
      clientFactory: () => ({
        generateContent: async () => {
          throw new Error(`Authentication failure for key ${SECRET_KEY} on backend`);
        },
      }),
    });

    const mockOcr = new MockOcrEngine(() => ({
      success: true,
      lines: [{ text: 'ANY TEXT', confidence: 90 }],
      rawText: 'ANY TEXT',
    }));

    const extractor = new LocalOcrGeminiDocumentExtractor({
      ocrEngine: mockOcr,
      geminiExtractor: geminiLeakingError,
    });

    const res = await extractor.extract(makeRequest('image/png'));
    assert(res.success === false, 'Scenario 12: Secret error returns failure');
    assert(
      !res.errorMessage?.includes(SECRET_KEY),
      'Scenario 12: Secret key is redacted from error message'
    );
    assert(
      res.errorMessage?.includes('[REDACTED]') === true,
      'Scenario 12: Placeholder [REDACTED] appears in error message'
    );
  }

  // -------------------------------------------------------------------------
  // Scenario 13: Constructor injection allows running without real Tesseract
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 10: Constructor DI Verification ---');
  {
    const mockPdf = new MockPdfRenderer({ success: true, pages: [], pageCount: 0 });
    const mockOcr = new MockOcrEngine(() => ({ success: true, lines: [], rawText: '' }));
    const mockGemini = new GeminiDocumentExtractor({
      apiKey: 'test-key',
      clientFactory: () => ({
        generateContent: async () => ({ text: JSON.stringify({ items: [] }) }),
      }),
    });
    const mockFallback = new SpyFallbackExtractor();

    const extractor = new LocalOcrGeminiDocumentExtractor({
      pdfRenderer: mockPdf,
      ocrEngine: mockOcr,
      geminiExtractor: mockGemini,
      fallbackExtractor: mockFallback,
    });

    assert(
      typeof extractor.extract === 'function',
      'Scenario 13: Constructed successfully with pure DI without host Tesseract'
    );
    const res = await extractor.extract(makeRequest('image/png'));
    assert(
      res.success === true,
      'Scenario 13: Executes cleanly without any host binaries installed'
    );
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` ALL ${passCount} / ${testCount} PHASE 5E.6-B TESTS PASSED`);
  console.log('================================================================\n');
}

runTests().catch((err: unknown) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});
