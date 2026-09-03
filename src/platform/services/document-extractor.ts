import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';
import { AzureDocumentExtractor } from './azure-document-extractor';
import { resolveAzureDocumentExtractorConfig } from './azure-document-extractor-config';
import { GeminiDocumentExtractor, resolveGeminiDocumentExtractorConfig } from './gemini-document-extractor';

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
 * Selection logic (fail-closed), evaluated in strict precedence order:
 * 1. Azure Document Intelligence — when both endpoint and API key are present
 *    (via AZURE_DOCUMENT_INTELLIGENCE_* or legacy AZURE_FORM_RECOGNIZER_*).
 * 2. Gemini AI — when GEMINI_API_KEY is present and Azure is fully unconfigured.
 *    NOTE: Partial Azure configuration (endpoint only or key only) does NOT fall
 *    through to Gemini. It remains fail-closed with UnavailableDocumentExtractor.
 * 3. UnavailableDocumentExtractor — when neither provider is configured, or
 *    when Azure is only partially configured.
 *
 * DeterministicDocumentExtractor is intentionally excluded from this path.
 * It must only be injected explicitly in test or development fixtures.
 */
export function getDocumentExtractor(): IDocumentExtractor {
  // --- Priority 1: Azure Document Intelligence ---
  const azureConfig = resolveAzureDocumentExtractorConfig();

  if (azureConfig.isConfigured && azureConfig.endpoint && azureConfig.apiKey) {
    return new AzureDocumentExtractor({
      endpoint: azureConfig.endpoint,
      apiKey: azureConfig.apiKey,
      apiVersion: azureConfig.apiVersion,
      modelId: azureConfig.modelId,
    });
  }

  // If Azure is partially configured (endpoint or key but not both), fail closed.
  // Do NOT fall through to Gemini for partial Azure configs.
  if (azureConfig.status === 'partially_configured') {
    if (!azureConfig.summary.hasApiKey) {
      return new UnavailableDocumentExtractor(
        'Extraction Engine Unavailable: Azure Document Intelligence is partially configured (missing API key). ' +
          'Provide AZURE_DOCUMENT_INTELLIGENCE_KEY.'
      );
    } else {
      return new UnavailableDocumentExtractor(
        'Extraction Engine Unavailable: Azure Document Intelligence is partially configured (missing endpoint). ' +
          'Provide AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.'
      );
    }
  }

  // --- Priority 2: Gemini AI (only when Azure is fully unconfigured) ---
  const geminiConfig = resolveGeminiDocumentExtractorConfig();

  if (geminiConfig.isConfigured) {
    return new GeminiDocumentExtractor();
  }

  // --- Priority 3: No provider configured — fail closed ---
  return new UnavailableDocumentExtractor(
    'Extraction Engine Unavailable: Azure Document Intelligence is not configured and no other OCR provider is available. ' +
      'Provide AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY ' +
      'for Azure Document Intelligence, or GEMINI_API_KEY for Gemini AI.'
  );
}
