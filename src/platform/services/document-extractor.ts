import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';
import { GeminiDocumentExtractor, resolveGeminiDocumentExtractorConfig } from './gemini-document-extractor';
import { LocalOcrGeminiDocumentExtractor } from './local-ocr-gemini-document-extractor';
import { resolveTesseractOcrConfig } from './local-ocr-engine';

/**
 * Configuration options for DeterministicDocumentExtractor.
 */
export interface DeterministicExtractorOptions {
  defaultItems?: ExtractedDocumentItem[];
  fixtureProvider?: (
    request: DocumentExtractionRequest
  ) => ExtractedDocumentItem[] | Promise<ExtractedDocumentItem[]>;
}

/**
 * Deterministic Test & Development Document Extractor.
 *
 * Provides deterministic document extraction for test, staging, and development environments.
 * - Extracts items directly from configured fixtures or request metadata
 * - Validates binary buffer presence without attempting pseudo-regex OCR on binary streams
 * - Guarantees 100% predictable output compatible with DocumentIntelligenceOrchestrator
 */
export class DeterministicDocumentExtractor implements IDocumentExtractor {
  constructor(private readonly options: DeterministicExtractorOptions = {}) {}

  public async extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    if (!request || !request.content || request.content.byteLength === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Validation Error: Binary content cannot be empty.',
      };
    }

    if (this.options.fixtureProvider) {
      const items = await this.options.fixtureProvider(request);
      return {
        success: true,
        items,
        pageCount: 1,
      };
    }

    if (Array.isArray(request.metadata?.items)) {
      return {
        success: true,
        items: request.metadata.items as ExtractedDocumentItem[],
        pageCount: 1,
      };
    }

    return {
      success: true,
      items: this.options.defaultItems || [],
      pageCount: 1,
    };
  }
}

/**
 * Null / Unavailable Extractor for strict production deployments without active OCR engine.
 */
export class UnavailableDocumentExtractor implements IDocumentExtractor {
  constructor(
    private readonly reason: string = 'Extraction Engine Unavailable: No OCR provider is currently configured.'
  ) {}

  public async extract(_request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    return {
      success: false,
      items: [],
      errorMessage: this.reason,
    };
  }
}

/**
 * Canonical production factory for IDocumentExtractor.
 *
 * Selection logic (fail-closed):
 * 1. Local Tesseract OCR + Gemini semantic extraction when both
 *    GEMINI_API_KEY and the Tesseract runtime are available.
 * 2. Gemini direct multimodal extraction when Gemini is configured
 *    but Tesseract is unavailable.
 * 3. UnavailableDocumentExtractor when Gemini is not configured.
 *
 * DeterministicDocumentExtractor is intentionally excluded from this path.
 * It must only be injected explicitly in test or development fixtures.
 */
export function getDocumentExtractor(): IDocumentExtractor {
  const geminiConfig = resolveGeminiDocumentExtractorConfig();

  if (!geminiConfig.isConfigured) {
    return new UnavailableDocumentExtractor(
      'Extraction Engine Unavailable: Gemini AI is not configured. ' +
        'Provide GEMINI_API_KEY.'
    );
  }

  const tesseractConfig = resolveTesseractOcrConfig();

  if (tesseractConfig.isAvailable) {
    return new LocalOcrGeminiDocumentExtractor();
  }

  return new GeminiDocumentExtractor();
}
