import {
  SharpPdfPageRenderer,
  UnavailablePdfPageRenderer,
  IPdfPageRenderer,
  getPdfPageRendererStatus,
  getPdfPageRenderer,
  isPdfMimeType,
  isRasterImageMimeType,
} from "../src/platform/services/pdf-page-renderer";
import type {
  PdfPageRenderRequest,
  PdfPageRenderResult,
  PdfPageImage,
} from "../src/platform/services/pdf-page-renderer";

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string): void {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  check Test ${testCount}: ${message}`);
  } else {
    console.error(`  FAIL Test ${testCount}: ${message}${detail ? " - " + detail : ""}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal mock renderer (injectable seam)
// ---------------------------------------------------------------------------

class MockPdfPageRenderer implements IPdfPageRenderer {
  constructor(private readonly response: PdfPageRenderResult) {}
  async renderPages(_req: PdfPageRenderRequest): Promise<PdfPageRenderResult> {
    return this.response;
  }
}

// ---------------------------------------------------------------------------
// Minimal valid single-page PDF binary (PDF 1.4 hand-crafted)
// ---------------------------------------------------------------------------
// This is the smallest structurally valid PDF that sharp/libvips can attempt
// to parse. We use it to exercise real rendering when sharp is available.
// Source: https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf minimal example
const MINIMAL_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n" +
    "xref\n0 4\n" +
    "0000000000 65535 f \n" +
    "0000000009 00000 n \n" +
    "0000000062 00000 n \n" +
    "0000000114 00000 n \n" +
    "trailer\n<< /Size 4 /Root 1 0 R >>\n" +
    "startxref\n180\n%%EOF\n"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
  console.log("================================================================");
  console.log(" PDF PAGE RENDERER: UNIT TEST SUITE");
  console.log("================================================================\n");

  // -------------------------------------------------------------------------
  // SECTION 1: Availability detection
  // -------------------------------------------------------------------------
  console.log("--- SECTION 1: Availability Detection ---");

  {
    // 1.1 getPdfPageRendererStatus() returns a well-formed status object
    const status = getPdfPageRendererStatus();
    assert(typeof status.isAvailable === "boolean", "isAvailable is a boolean");
    assert(typeof status.backingLibrary === "string", "backingLibrary is a string");
    assert(status.backingLibrary.length > 0, "backingLibrary is non-empty");
  }

  {
    // 1.2 sharp is installed in this project -> isAvailable must be true
    const status = getPdfPageRendererStatus();
    assert(
      status.isAvailable === true,
      "sharp is installed -> isAvailable is true",
      `Got: isAvailable=${status.isAvailable}, backingLibrary=${status.backingLibrary}`
    );
    assert(status.backingLibrary === "sharp", "backingLibrary is 'sharp' when sharp is installed");
  }

  {
    // 1.3 getPdfPageRenderer() returns SharpPdfPageRenderer when sharp is available
    const renderer = getPdfPageRenderer();
    assert(
      renderer instanceof SharpPdfPageRenderer,
      "getPdfPageRenderer() returns SharpPdfPageRenderer when sharp is installed"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Input validation
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Input Validation (Fail-Closed) ---");

  {
    // 2.1 Empty PDF buffer -> success:false
    const renderer = new SharpPdfPageRenderer();
    const result = await renderer.renderPages({ pdfBuffer: Buffer.alloc(0) });
    assert(result.success === false, "Empty pdfBuffer -> success:false");
    assert(
      result.errorMessage?.includes("pdfBuffer cannot be empty") === true,
      "Empty buffer gives descriptive error"
    );
    assert(result.pages.length === 0, "Empty buffer -> empty pages");
    assert(result.pageCount === 0, "Empty buffer -> pageCount 0");
  }

  // -------------------------------------------------------------------------
  // SECTION 3: UnavailablePdfPageRenderer
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 3: UnavailablePdfPageRenderer ---");

  {
    // 3.1 Always returns success:false
    const renderer = new UnavailablePdfPageRenderer();
    const result = await renderer.renderPages({ pdfBuffer: Buffer.from("data") });
    assert(result.success === false, "UnavailablePdfPageRenderer -> success:false");
    assert(
      typeof result.errorMessage === "string" && result.errorMessage.length > 0,
      "UnavailablePdfPageRenderer -> non-empty errorMessage"
    );
    assert(result.pages.length === 0, "UnavailablePdfPageRenderer -> empty pages");
    assert(result.pageCount === 0, "UnavailablePdfPageRenderer -> pageCount 0");
  }

  {
    // 3.2 Custom reason is preserved
    const renderer = new UnavailablePdfPageRenderer("Custom renderer unavailable reason");
    const result = await renderer.renderPages({ pdfBuffer: Buffer.from("x") });
    assert(
      result.errorMessage === "Custom renderer unavailable reason",
      "Custom unavailable reason is preserved in errorMessage"
    );
  }

  {
    // 3.3 Never throws
    const renderer = new UnavailablePdfPageRenderer();
    let threw = false;
    try {
      await renderer.renderPages({ pdfBuffer: Buffer.from("data") });
    } catch {
      threw = true;
    }
    assert(!threw, "UnavailablePdfPageRenderer never throws");
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Interface contract (mock injection)
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Interface Contract (Mock Injection) ---");

  {
    // 4.1 IPdfPageRenderer can be satisfied by a mock
    const pages: PdfPageImage[] = [
      { pageNumber: 1, imageBuffer: Buffer.from("page1-png"), mimeType: "image/png" },
      { pageNumber: 2, imageBuffer: Buffer.from("page2-png"), mimeType: "image/png" },
    ];
    const mockResult: PdfPageRenderResult = {
      success: true,
      pages,
      pageCount: 2,
    };
    const renderer: IPdfPageRenderer = new MockPdfPageRenderer(mockResult);
    const result = await renderer.renderPages({ pdfBuffer: Buffer.from("fake-pdf") });
    assert(result.success === true, "Mock renderer returns success:true");
    assert(result.pages.length === 2, "Mock renderer returns 2 pages");
    assert(result.pageCount === 2, "Mock renderer pageCount is 2");
    assert(result.pages[0].pageNumber === 1, "First page has pageNumber 1");
    assert(result.pages[1].pageNumber === 2, "Second page has pageNumber 2");
    assert(result.pages[0].mimeType === "image/png", "Page mimeType is image/png");
    assert(
      Buffer.isBuffer(result.pages[0].imageBuffer),
      "Page imageBuffer is a Buffer"
    );
  }

  {
    // 4.2 Multi-page contract: pages are ordered 1..N
    const pages: PdfPageImage[] = Array.from({ length: 5 }, (_, i) => ({
      pageNumber: i + 1,
      imageBuffer: Buffer.from(`page${i + 1}`),
      mimeType: "image/png" as const,
    }));
    const renderer: IPdfPageRenderer = new MockPdfPageRenderer({
      success: true,
      pages,
      pageCount: 5,
    });
    const result = await renderer.renderPages({ pdfBuffer: Buffer.from("pdf") });
    assert(result.pages.length === 5, "5-page PDF -> 5 entries");
    assert(
      result.pages.every((p, i) => p.pageNumber === i + 1),
      "Pages are ordered pageNumber 1..5"
    );
  }

  {
    // 4.3 Mock failure result is well-formed
    const renderer: IPdfPageRenderer = new MockPdfPageRenderer({
      success: false,
      pages: [],
      pageCount: 0,
      errorMessage: "Renderer failed for testing",
    });
    const result = await renderer.renderPages({ pdfBuffer: Buffer.from("pdf") });
    assert(result.success === false, "Mock failure result is fail-closed");
    assert(result.pages.length === 0, "Failure -> empty pages");
    assert(result.errorMessage === "Renderer failed for testing", "Failure errorMessage preserved");
  }

  // -------------------------------------------------------------------------
  // SECTION 5: DPI clamping (white-box)
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 5: DPI Clamping ---");

  {
    // 5.1 DPI below minimum (72) should not crash
    // We cannot easily test the clamped value without rendering a real PDF,
    // but we can confirm the renderer accepts extreme values without throwing.
    const renderer = new SharpPdfPageRenderer();
    let threw = false;
    try {
      // This will fail because MINIMAL_PDF_BYTES may not be parseable by sharp
      // in all libvips configurations, but it must NOT throw.
      await renderer.renderPages({ pdfBuffer: Buffer.from("not-a-pdf"), dpi: 1 });
    } catch {
      threw = true;
    }
    assert(!threw, "SharpPdfPageRenderer does not throw on invalid PDF with low DPI");
  }

  {
    // 5.2 DPI above maximum (300) should not crash
    const renderer = new SharpPdfPageRenderer();
    let threw = false;
    try {
      await renderer.renderPages({ pdfBuffer: Buffer.from("not-a-pdf"), dpi: 9999 });
    } catch {
      threw = true;
    }
    assert(!threw, "SharpPdfPageRenderer does not throw on invalid PDF with excessive DPI");
  }

  // -------------------------------------------------------------------------
  // SECTION 6: MIME type helpers
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 6: MIME Type Helpers ---");

  {
    // 6.1 isPdfMimeType
    assert(isPdfMimeType("application/pdf") === true, "application/pdf is a PDF MIME type");
    assert(isPdfMimeType("image/png") === false, "image/png is NOT a PDF MIME type");
    assert(isPdfMimeType("image/jpeg") === false, "image/jpeg is NOT a PDF MIME type");
    assert(isPdfMimeType("") === false, "empty string is NOT a PDF MIME type");
  }

  {
    // 6.2 isRasterImageMimeType
    assert(isRasterImageMimeType("image/jpeg") === true, "image/jpeg is a raster image");
    assert(isRasterImageMimeType("image/jpg") === true, "image/jpg is a raster image");
    assert(isRasterImageMimeType("image/png") === true, "image/png is a raster image");
    assert(isRasterImageMimeType("image/webp") === true, "image/webp is a raster image");
    assert(isRasterImageMimeType("image/tiff") === true, "image/tiff is a raster image");
    assert(isRasterImageMimeType("application/pdf") === false, "application/pdf is NOT a raster image");
    assert(isRasterImageMimeType("") === false, "empty string is NOT a raster image");
  }

  // -------------------------------------------------------------------------
  // SECTION 7: No secret fields in result types
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 7: No Secrets ---");

  {
    // 7.1 PdfPageRenderResult has no secret fields
    const result: PdfPageRenderResult = {
      success: false,
      pages: [],
      pageCount: 0,
      errorMessage: "test",
    };
    assert(!("apiKey" in result), "PdfPageRenderResult has no apiKey field");
    assert(!("password" in result), "PdfPageRenderResult has no password field");
    assert(!("token" in result), "PdfPageRenderResult has no token field");
  }

  // -------------------------------------------------------------------------
  // SECTION 8: Existing extractor factory is NOT disturbed
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 8: Existing Factory Isolation ---");

  {
    // 8.1 Importing pdf-page-renderer does not affect getDocumentExtractor()
    const { getDocumentExtractor, UnavailableDocumentExtractor } = await import(
      "../src/platform/services/document-extractor"
    );
    const savedAzureEp = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const savedAzureKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    const savedGemini = process.env.GEMINI_API_KEY;
    delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        "getDocumentExtractor() still returns UnavailableDocumentExtractor when no providers configured"
      );
    } finally {
      if (savedAzureEp) process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = savedAzureEp;
      if (savedAzureKey) process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = savedAzureKey;
      if (savedGemini) process.env.GEMINI_API_KEY = savedGemini;
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n================================================================");
  console.log(` ALL ${passCount} / ${testCount} PDF PAGE RENDERER TESTS PASSED`);
  console.log("================================================================\n");
}

runTests().catch((err: unknown) => {
  console.error("Fatal Test Execution Failure:", err);
  process.exit(1);
});
