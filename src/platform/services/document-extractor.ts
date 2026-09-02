import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';
import { AzureDocumentExtractor } from './azure-document-extractor';

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
 * - When both AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT (or AZURE_FORM_RECOGNIZER_ENDPOINT)
 *   and AZURE_DOCUMENT_INTELLIGENCE_KEY (or AZURE_FORM_RECOGNIZER_KEY) are present
 *   in the environment → returns AzureDocumentExtractor.
 * - Otherwise → returns UnavailableDocumentExtractor.
 *
 * DeterministicDocumentExtractor is intentionally excluded from this path.
 * It must only be injected explicitly in test or development fixtures.
 */
export function getDocumentExtractor(): IDocumentExtractor {
  const endpoint =
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ||
    process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;

  const apiKey =
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ||
    process.env.AZURE_FORM_RECOGNIZER_KEY;

  if (endpoint && apiKey) {
    return new AzureDocumentExtractor();
  }

  return new UnavailableDocumentExtractor(
    'Extraction Engine Unavailable: Azure Document Intelligence is not configured. ' +
    'Provide AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY.'
  );
}
