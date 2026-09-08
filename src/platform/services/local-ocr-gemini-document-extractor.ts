import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
} from '../types/document-extractor';
import {
  IPdfPageRenderer,
  getPdfPageRenderer,
  isPdfMimeType,
  isRasterImageMimeType,
} from './pdf-page-renderer';
import {
  ILocalOcrEngine,
  TesseractLocalOcrEngine,
} from './local-ocr-engine';
import { GeminiDocumentExtractor } from './gemini-document-extractor';

/**
 * Options for configuring LocalOcrGeminiDocumentExtractor.
 * Supports explicit dependency injection for deterministic testing and runtime flexibility.
 */
export interface LocalOcrGeminiDocumentExtractorOptions {
  /** PDF page rasterization engine adapter. Defaults to getPdfPageRenderer(). */
  pdfRenderer?: IPdfPageRenderer;
  /** Local OCR engine adapter. Defaults to TesseractLocalOcrEngine instance. */
  ocrEngine?: ILocalOcrEngine;
  /** Gemini document extractor instance for semantic text structuring. */
  geminiExtractor?: GeminiDocumentExtractor;
  /** Fallback document extractor when local OCR is unavailable, empty, or fails. */
  fallbackExtractor?: IDocumentExtractor;
}

/**
 * Composite Document Extractor (Phase 5E.6).
 *
 * Implements a hybrid extraction pipeline:
 * 1. Rasterises PDFs into page PNG buffers via IPdfPageRenderer (Sharp).
 * 2. Runs local OCR on raster images via ILocalOcrEngine (Tesseract).
 * 3. Concatenates page OCR text deterministically in page order.
 * 4. Passes extracted OCR text to Gemini AI for semantic JSON structuring.
 *
 * Graceful Fallback:
 * If local OCR is unavailable, PDF rendering fails, OCR produces empty text, or OCR throws,
 * the extractor gracefully falls back to GeminiDocumentExtractor's direct multimodal path.
 */
export class LocalOcrGeminiDocumentExtractor implements IDocumentExtractor {
  private readonly pdfRenderer: IPdfPageRenderer;
  private readonly ocrEngine: ILocalOcrEngine;
  private readonly geminiExtractor: GeminiDocumentExtractor;
  private readonly fallbackExtractor: IDocumentExtractor;

  constructor(options: LocalOcrGeminiDocumentExtractorOptions = {}) {
    this.pdfRenderer = options.pdfRenderer || getPdfPageRenderer();
    this.ocrEngine = options.ocrEngine || new TesseractLocalOcrEngine();
    this.geminiExtractor = options.geminiExtractor || new GeminiDocumentExtractor();
    this.fallbackExtractor = options.fallbackExtractor || new GeminiDocumentExtractor();
  }

  /**
   * Extracts structured items from a document request using local OCR preprocessing
   * with Gemini semantic structuring, falling back to direct multimodal Gemini extraction
   * if local OCR cannot produce usable text.
   */
  public async extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    // 1. Guard: empty binary content
    if (!request || !request.content || request.content.byteLength === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Validation Error: Binary content cannot be empty.',
      };
    }

    const mimeType = request.mimeType || 'application/octet-stream';
    let ocrText: string | null = null;

    try {
      if (isPdfMimeType(mimeType)) {
        // --- Path A: PDF Document Rasterization & Multi-Page OCR ---
        const buffer = Buffer.isBuffer(request.content)
          ? request.content
          : Buffer.from(request.content);

        const renderResult = await this.pdfRenderer.renderPages({ pdfBuffer: buffer });

        if (renderResult.success && renderResult.pages.length > 0) {
          const pageTexts: string[] = [];

          for (const page of renderResult.pages) {
            const ocrRes = await this.ocrEngine.recognise({
              imageBuffer: page.imageBuffer,
            });

            if (ocrRes.success && ocrRes.rawText && ocrRes.rawText.trim().length > 0) {
              pageTexts.push(`--- Page ${page.pageNumber} ---\n${ocrRes.rawText.trim()}`);
            }
          }

          if (pageTexts.length > 0) {
            ocrText = pageTexts.join('\n\n');
          }
        }
      } else if (isRasterImageMimeType(mimeType)) {
        // --- Path B: Direct Raster Image Local OCR ---
        const buffer = Buffer.isBuffer(request.content)
          ? request.content
          : Buffer.from(request.content);

        const ocrRes = await this.ocrEngine.recognise({
          imageBuffer: buffer,
        });

        if (ocrRes.success && ocrRes.rawText && ocrRes.rawText.trim().length > 0) {
          ocrText = ocrRes.rawText.trim();
        }
      }
    } catch {
      // Local OCR pipeline failure -> fall through to graceful fallback
      ocrText = null;
    }

    // 2. If local OCR produced usable text, send text to Gemini for semantic structuring
    if (ocrText && ocrText.trim().length > 0) {
      const geminiResult = await this.geminiExtractor.extractFromText(ocrText, request);
      if (geminiResult.success) {
        return geminiResult;
      }
      // If Gemini text extraction fails (e.g. malformed JSON or API error), return Gemini's failure result
      return geminiResult;
    }

    // 3. Fallback: If OCR produced no text, renderer failed, or engine threw, fall back to direct multimodal Gemini
    return await this.fallbackExtractor.extract(request);
  }
}
