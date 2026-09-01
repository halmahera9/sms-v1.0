import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';

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
