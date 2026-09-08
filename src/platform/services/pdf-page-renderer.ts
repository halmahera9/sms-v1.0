import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single rasterised page from a PDF document.
 */
export interface PdfPageImage {
  /**
   * 1-based page index (first page = 1).
   */
  pageNumber: number;
  /**
   * Raw PNG image bytes for this page, ready to be passed to ILocalOcrEngine.
   */
  imageBuffer: Buffer;
  /** MIME type of the buffer: always "image/png" for this implementation. */
  mimeType: "image/png";
}

/**
 * Input to the PDF page renderer.
 */
export interface PdfPageRenderRequest {
  /**
   * Raw PDF binary buffer. Must be a valid PDF document.
   */
  pdfBuffer: Buffer;
  /**
   * Target DPI for rasterisation. Higher = better OCR accuracy, more memory.
   * Defaults to 150 (recommended minimum for print-quality Indonesian docs).
   * Clamped to 72-300 to prevent runaway memory usage.
   */
  dpi?: number;
}

/**
 * Result of a PDF page render pass.
 */
export interface PdfPageRenderResult {
  /** True when at least one page was rendered without a fatal error. */
  success: boolean;
  /**
   * Rendered pages in document order (pageNumber 1, 2, 3, ...).
   * Empty when success is false.
   */
  pages: PdfPageImage[];
  /**
   * Total number of pages in the source PDF.
   * May differ from pages.length if a subset was rendered.
   */
  pageCount: number;
  /** Descriptive error when success is false. */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Minimal adapter interface for PDF-to-raster-image conversion.
 *
 * Contract:
 * - Input: a raw PDF binary buffer.
 * - Output: ordered PdfPageImage[] (one entry per PDF page).
 * - Implementations must fail closed: missing renderer dependency ->
 *   success:false with a descriptive errorMessage, never throws.
 * - Implementations must be replaceable; callers must NOT import concrete
 *   types directly.
 */
export interface IPdfPageRenderer {
  /**
   * Rasterises every page of a PDF into PNG image buffers.
   *
   * @param request PDF buffer plus optional DPI override.
   * @returns Ordered array of per-page PNG buffers, or a fail-closed error.
   */
  renderPages(request: PdfPageRenderRequest): Promise<PdfPageRenderResult>;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

/**
 * Non-secret status of the PDF renderer dependency.
 * Safe for logging and diagnostic use.
 */
export interface PdfPageRendererStatus {
  /** True when the underlying rasterisation library is available. */
  isAvailable: boolean;
  /** Human-readable name of the backing library, or "none". */
  backingLibrary: string;
}

/**
 * Returns the availability status of the PDF renderer implementation.
 * Performs a minimal runtime require() probe; never throws.
 */
export function getPdfPageRendererStatus(): PdfPageRendererStatus {
  try {
    // sharp must be required dynamically to keep this module loadable in
    // environments where it is not installed (fail-closed contract).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("sharp");
    return { isAvailable: true, backingLibrary: "sharp" };
  } catch {
    return { isAvailable: false, backingLibrary: "none" };
  }
}

// ---------------------------------------------------------------------------
// Sharp-backed implementation
// ---------------------------------------------------------------------------

/**
 * PDF page renderer backed by the "sharp" image processing library.
 *
 * sharp v0.35+ includes libvips compiled with PDF support (via poppler).
 * PDF rasterisation is available without any additional npm packages.
 *
 * Design invariants:
 * - Fail closed: if sharp is absent or PDF support is compiled out, returns
 *   success:false with a descriptive errorMessage, never throws.
 * - DPI is clamped to 72-300 to prevent memory exhaustion on multi-page PDFs.
 * - Returns pages in document order (pageNumber starts at 1).
 */
export class SharpPdfPageRenderer implements IPdfPageRenderer {
  public async renderPages(request: PdfPageRenderRequest): Promise<PdfPageRenderResult> {
    // 1. Guard: empty buffer
    if (!request?.pdfBuffer || request.pdfBuffer.byteLength === 0) {
      return {
        success: false,
        pages: [],
        pageCount: 0,
        errorMessage: "Validation Error: pdfBuffer cannot be empty.",
      };
    }

    // 2. Dynamic require - fail closed if sharp is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharpModule = (() => { try { return require("sharp"); } catch { return null; } })();
    if (!sharpModule) {
      return {
        success: false,
        pages: [],
        pageCount: 0,
        errorMessage:
          'PDF rendering is unavailable: the "sharp" package is not installed. ' +
          "Run: npm install sharp",
      };
    }
    // sharp is a CJS module; the callable may be on .default in ESM-interop contexts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharpFn: (input: Buffer, options?: Record<string, unknown>) => import("sharp").Sharp =
      (sharpModule as any).default ?? sharpModule;

    // 3. Clamp DPI
    const rawDpi = request.dpi ?? 150;
    const dpi = Math.min(300, Math.max(72, rawDpi));

    try {
      // 4. Probe page count by loading page 0 metadata
      //    sharp uses 0-based page index for PDF.
      let pageCount = 0;

      try {
        const probe = await sharpFn(request.pdfBuffer, {
          density: dpi,
          page: 0,
          pages: -1, // load all pages as a sequence
        })
          .metadata();
        // For multi-page PDFs, sharp sets pages on the metadata object.
        pageCount = (probe as { pages?: number }).pages ?? 1;
      } catch (probeErr: unknown) {
        const detail = probeErr instanceof Error ? probeErr.message : String(probeErr);
        return {
          success: false,
          pages: [],
          pageCount: 0,
          errorMessage: `PDF metadata probe failed: ${detail}`,
        };
      }

      // 5. Render each page individually to a PNG buffer
      const pages: PdfPageImage[] = [];

      for (let i = 0; i < pageCount; i++) {
        const pngBuffer = await sharpFn(request.pdfBuffer, {
          density: dpi,
          page: i,
        })
          .png()
          .toBuffer();

        pages.push({
          pageNumber: i + 1,
          imageBuffer: pngBuffer,
          mimeType: "image/png",
        });
      }

      return { success: true, pages, pageCount };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        pages: [],
        pageCount: 0,
        errorMessage: `PDF page rendering failed: ${message}`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Fail-closed stub (no renderer available)
// ---------------------------------------------------------------------------

/**
 * Fail-closed IPdfPageRenderer used when no suitable rasterisation library
 * is available.  Always returns a descriptive error without throwing.
 */
export class UnavailablePdfPageRenderer implements IPdfPageRenderer {
  constructor(
    private readonly reason: string =
      'PDF rendering is unavailable: no supported rasterisation library is installed.'
  ) {}

  public async renderPages(_request: PdfPageRenderRequest): Promise<PdfPageRenderResult> {
    return {
      success: false,
      pages: [],
      pageCount: 0,
      errorMessage: this.reason,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the best available IPdfPageRenderer for the current environment.
 *
 * Selection:
 * 1. SharpPdfPageRenderer  - when "sharp" is installed (preferred).
 * 2. UnavailablePdfPageRenderer - when no renderer is present (fail-closed).
 *
 * Callers should use this factory rather than importing concrete classes.
 */
export function getPdfPageRenderer(): IPdfPageRenderer {
  const status = getPdfPageRendererStatus();
  if (status.isAvailable) {
    return new SharpPdfPageRenderer();
  }
  return new UnavailablePdfPageRenderer(
    `PDF rendering is unavailable: "${status.backingLibrary}" library not found. ` +
      `Install a supported rasterisation library (e.g. npm install sharp).`
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the given MIME type indicates a PDF document.
 */
export function isPdfMimeType(mimeType: string): boolean {
  return path.extname(mimeType) === "" && mimeType.trim().toLowerCase() === "application/pdf";
}

/**
 * Returns true when the given MIME type indicates a raster image that can
 * be passed directly to ILocalOcrEngine without rasterisation.
 */
export function isRasterImageMimeType(mimeType: string): boolean {
  const t = mimeType.trim().toLowerCase();
  return (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp" ||
    t === "image/tiff"
  );
}
