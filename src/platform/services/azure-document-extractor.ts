import crypto from 'crypto';
import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';
import { resolveAzureDocumentExtractorConfig } from './azure-document-extractor-config';

/**
 * Options for configuring AzureDocumentExtractor.
 */
export interface AzureDocumentExtractorOptions {
  /**
   * Azure AI Document Intelligence endpoint (e.g. https://<resource-name>.cognitiveservices.azure.com/).
   * If omitted, falls back to process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.
   */
  endpoint?: string;

  /**
   * Azure AI Document Intelligence API key / subscription key.
   * If omitted, falls back to process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY.
   */
  apiKey?: string;

  /**
   * Document Intelligence API version (defaults to '2024-11-30').
   */
  apiVersion?: string;

  /**
   * Prebuilt or custom model ID (defaults to 'prebuilt-layout').
   */
  modelId?: string;

  /**
   * Polling interval in milliseconds for asynchronous analysis (defaults to 1000ms).
   */
  pollIntervalMs?: number;

  /**
   * Maximum polling attempts before timeout (defaults to 60).
   */
  maxPollAttempts?: number;

  /**
   * Injected fetch client implementation for test isolation and deterministic mocking.
   */
  fetchImpl?: typeof fetch;

  /** Backwards-compatibility alias for pollIntervalMs */
  pollingIntervalMs?: number;

  /** Backwards-compatibility alias for maxPollAttempts */
  maxPollingAttempts?: number;

  /** Backwards-compatibility alias for fetchImpl */
  fetchClient?: typeof fetch;
}

/**
 * Production Azure AI Document Intelligence Extractor Adapter.
 *
 * Implements IDocumentExtractor to communicate with Azure AI Document Intelligence
 * via REST API.
 *
 * Design Invariants:
 * - Fail closed: Missing endpoint or API key returns a clear extraction failure without fallback.
 * - Non-destructive OCR: Extracts document text and structures without fabricating domain-specific entities.
 * - Generic mapping: Maps raw page lines and tokens to ExtractedDocumentItem[] preserving the contract.
 * - Test Isolation: Supports dependency injection of fetchImpl and credentials.
 */
export class AzureDocumentExtractor implements IDocumentExtractor {
  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly apiVersion: string;
  private readonly modelId: string;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AzureDocumentExtractorOptions = {}) {
    const config = resolveAzureDocumentExtractorConfig(process.env, options);

    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion;
    this.modelId = config.modelId;

    this.pollIntervalMs =
      options.pollIntervalMs ?? options.pollingIntervalMs ?? 1000;

    this.maxPollAttempts =
      options.maxPollAttempts ?? options.maxPollingAttempts ?? 60;

    this.fetchImpl =
      options.fetchImpl ?? options.fetchClient ?? globalThis.fetch;
  }

  /**
   * Extracts text, page count, and granular items from binary document buffer using Azure AI Document Intelligence.
   */
  public async extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    // 1. Guard against empty request or binary payload
    if (!request || !request.content || request.content.byteLength === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Validation Error: Binary content cannot be empty.',
      };
    }

    // 2. Fail closed if Azure credentials / configuration are missing
    if (!this.endpoint || !this.apiKey) {
      return {
        success: false,
        items: [],
        errorMessage:
          'Azure Document Intelligence configuration missing: Endpoint and API key are required.',
      };
    }

    try {
      // 3. Build Analyze URL
      const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
      const analyzeUrl = `${cleanEndpoint}/documentintelligence/documentModels/${encodeURIComponent(
        this.modelId
      )}:analyze?api-version=${encodeURIComponent(this.apiVersion)}`;

      const contentType = request.mimeType || 'application/octet-stream';

      // 4. Send binary payload to Azure
      const response = await this.fetchImpl(analyzeUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': contentType,
        },
        body: request.content as unknown as BodyInit,
      });

      // 5. Handle HTTP Errors
      if (response.status >= 400) {
        let errDetails = `HTTP ${response.status}`;
        try {
          const errBody = (await response.json()) as any;
          if (errBody?.error?.message) {
            errDetails = `${errDetails}: ${errBody.error.message}`;
          } else if (errBody?.message) {
            errDetails = `${errDetails}: ${errBody.message}`;
          }
        } catch {
          // Response body is not JSON
        }

        return {
          success: false,
          items: [],
          errorMessage: `Azure Document Intelligence request failed (${errDetails}).`,
        };
      }

      // 6. Handle Polling (202 Accepted) or Synchronous (200 OK)
      let analyzeResult: any;

      if (response.status === 202) {
        const operationLocation =
          response.headers.get('operation-location') ||
          response.headers.get('Operation-Location');

        if (!operationLocation) {
          return {
            success: false,
            items: [],
            errorMessage:
              'Azure Document Intelligence returned 202 Accepted without Operation-Location header.',
          };
        }

        const pollResult = await this.pollOperation(operationLocation);
        if (!pollResult.success) {
          return {
            success: false,
            items: [],
            errorMessage: pollResult.errorMessage,
          };
        }
        analyzeResult = pollResult.analyzeResult;
      } else if (response.status === 200) {
        try {
          const data = (await response.json()) as any;
          analyzeResult = data.analyzeResult || data;
        } catch {
          return {
            success: false,
            items: [],
            errorMessage: 'Azure Document Intelligence returned malformed JSON response.',
          };
        }
      } else {
        return {
          success: false,
          items: [],
          errorMessage: `Azure Document Intelligence returned unexpected status ${response.status}.`,
        };
      }

      // 7. Map Azure Analyze Result to DocumentExtractionResult
      return this.mapAnalyzeResult(analyzeResult, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        items: [],
        errorMessage: `Azure Document Intelligence extraction failed: ${message}`,
      };
    }
  }

  /**
   * Polls the Azure operation location until completion, error, or timeout.
   */
  private async pollOperation(
    operationLocation: string
  ): Promise<{ success: boolean; analyzeResult?: any; errorMessage?: string }> {
    for (let attempt = 1; attempt <= this.maxPollAttempts; attempt++) {
      if (attempt > 1 && this.pollIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }

      let pollResponse: Response;
      try {
        pollResponse = await this.fetchImpl(operationLocation, {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey!,
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          errorMessage: `Azure polling network error: ${msg}`,
        };
      }

      if (pollResponse.status >= 400) {
        let errDetail = `HTTP ${pollResponse.status}`;
        try {
          const body = (await pollResponse.json()) as any;
          if (body?.error?.message) {
            errDetail = `${errDetail}: ${body.error.message}`;
          } else if (body?.message) {
            errDetail = `${errDetail}: ${body.message}`;
          }
        } catch {
          // non-JSON response
        }
        return {
          success: false,
          errorMessage: `Azure polling failed (${errDetail}).`,
        };
      }

      let pollData: any;
      try {
        pollData = await pollResponse.json();
      } catch {
        return {
          success: false,
          errorMessage: 'Azure polling returned malformed JSON response.',
        };
      }

      const status = pollData?.status;

      if (status === 'succeeded') {
        return {
          success: true,
          analyzeResult: pollData.analyzeResult || pollData,
        };
      }

      if (status === 'failed') {
        const detail = pollData?.error?.message || 'Operation failed in Azure.';
        return {
          success: false,
          errorMessage: `Azure analysis operation failed: ${detail}`,
        };
      }

      if (status === 'canceled') {
        return {
          success: false,
          errorMessage: 'Azure analysis operation was canceled.',
        };
      }

      // Status is 'running', 'notStarted', or intermediate state: continue polling loop
    }

    return {
      success: false,
      errorMessage: `Azure analysis operation timed out after ${this.maxPollAttempts} attempts.`,
    };
  }

  /**
   * Conservatively maps Azure analyzeResult into canonical DocumentExtractionResult.
   *
   * Rules:
   * - Does NOT fabricate student identity, NISN, status, or domain-specific fields.
   * - Extracts raw text from content or page lines.
   * - Preserves generic ExtractedDocumentItem contract.
   * - If no textual units exist in pages but raw content exists, returns one item with rawText.
   */
  private mapAnalyzeResult(
    analyzeResult: any,
    request: DocumentExtractionRequest
  ): DocumentExtractionResult {
    if (!analyzeResult || typeof analyzeResult !== 'object') {
      return {
        success: false,
        items: [],
        errorMessage: 'Invalid or empty analyze result received from Azure Document Intelligence.',
      };
    }

    // Determine rawText
    let rawText = typeof analyzeResult.content === 'string' ? analyzeResult.content : '';

    const pageCount = Array.isArray(analyzeResult.pages)
      ? analyzeResult.pages.length
      : (typeof analyzeResult.pageCount === 'number' ? analyzeResult.pageCount : 1);

    const items: ExtractedDocumentItem[] = [];

    // Extract textual units from pages/lines
    if (Array.isArray(analyzeResult.pages)) {
      for (const page of analyzeResult.pages) {
        if (Array.isArray(page.lines)) {
          for (const line of page.lines) {
            const text = typeof line.content === 'string' ? line.content.trim() : '';
            if (text.length > 0) {
              let confidence: number | undefined;

              if (typeof line.confidence === 'number') {
                confidence = Math.round(
                  line.confidence <= 1 ? line.confidence * 100 : line.confidence
                );
              } else if (Array.isArray(line.words) && line.words.length > 0) {
                const wordConfidences = line.words
                  .map((w: any) => w.confidence)
                  .filter((c: any) => typeof c === 'number');
                if (wordConfidences.length > 0) {
                  const avg =
                    wordConfidences.reduce((a: number, b: number) => a + b, 0) /
                    wordConfidences.length;
                  confidence = Math.round(avg <= 1 ? avg * 100 : avg);
                }
              }

              items.push({
                id: crypto.randomUUID(),
                ocrText: text,
                ...(confidence !== undefined ? { confidence } : {}),
              });
            }
          }
        }
      }
    }

    // Fallback: If rawText was not present in content, reconstruct from line items
    if (!rawText && items.length > 0) {
      rawText = items.map((it) => it.ocrText).join('\n');
    }

    // Fallback: If no textual units exist in pages/lines but raw content exists, return one item containing the rawText
    if (items.length === 0 && rawText.trim().length > 0) {
      items.push({
        id: crypto.randomUUID(),
        ocrText: rawText.trim(),
      });
    }

    return {
      success: true,
      rawText,
      pageCount,
      items,
      metadata: {
        provider: 'azure-document-intelligence',
        modelId: this.modelId,
        apiVersion: this.apiVersion,
        pageCount,
        ...(request.metadata || {}),
      },
    };
  }
}
