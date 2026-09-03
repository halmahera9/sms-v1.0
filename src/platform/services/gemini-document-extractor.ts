import crypto from 'crypto';
import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';

/**
 * Configuration boundary for Gemini AI document extraction.
 *
 * Enforces:
 * 1. GEMINI_API_KEY present and non-empty → configured.
 * 2. Missing or empty → unconfigured.
 * 3. Zero secret leakage: status exposes flags only, never key values.
 */
export interface GeminiDocumentExtractorConfigStatus {
  isConfigured: boolean;
  hasApiKey: boolean;
}

/**
 * Resolves the Gemini extraction configuration status from the environment.
 * Safe for logging and diagnostic use — contains no secret values.
 */
export function resolveGeminiDocumentExtractorConfig(
  env: NodeJS.ProcessEnv = process.env
): GeminiDocumentExtractorConfigStatus {
  const hasApiKey =
    typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim().length > 0;
  return { isConfigured: hasApiKey, hasApiKey };
}

/**
 * Options for constructing a GeminiDocumentExtractor.
 */
export interface GeminiDocumentExtractorOptions {
  /**
   * Gemini API key. Falls back to process.env.GEMINI_API_KEY if omitted.
   * Never log or expose this value.
   */
  apiKey?: string;

  /**
   * Gemini model to use for document extraction.
   * Defaults to 'gemini-2.0-flash'.
   */
  model?: string;

  /**
   * Injectable Gemini client factory, used for test isolation.
   * If provided, apiKey is ignored for client construction.
   */
  clientFactory?: (apiKey: string) => GeminiClientAdapter;
}

/**
 * Minimal adapter interface for Gemini generateContent, enabling test mocking
 * without coupling to SDK internals.
 */
export interface GeminiClientAdapter {
  generateContent(params: {
    model: string;
    contents: Array<{
      role: string;
      parts: Array<Record<string, unknown>>;
    }>;
  }): Promise<{
    text?: string;
  }>;
}

/**
 * Production Gemini AI Document Extractor Adapter.
 *
 * Implements IDocumentExtractor using Google Gemini AI to extract
 * structured text items from binary document buffers.
 *
 * Design Invariants:
 * - Fail closed: Missing API key returns a clear extraction failure.
 * - Non-fabrication: Does not hallucinate domain-specific entities.
 * - Binary inline delivery: Document buffer is sent as base64 inline data part.
 * - JSON-structured output: Validates Gemini response before returning success.
 * - Zero secret leakage: API key is never included in error messages or logs.
 * - Test isolated: Supports injectable clientFactory for mocking.
 */
export class GeminiDocumentExtractor implements IDocumentExtractor {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly clientFactory?: (apiKey: string) => GeminiClientAdapter;

  constructor(options: GeminiDocumentExtractorOptions = {}) {
    this.apiKey =
      options.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || undefined;
    this.model = options.model?.trim() || 'gemini-2.0-flash';
    this.clientFactory = options.clientFactory;
  }

  public async extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult> {
    // 1. Guard: empty binary content
    if (!request || !request.content || request.content.byteLength === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Validation Error: Binary content cannot be empty.',
      };
    }

    // 2. Guard: missing API key (fail closed)
    if (!this.apiKey) {
      return {
        success: false,
        items: [],
        errorMessage:
          'Gemini Document Extraction configuration missing: GEMINI_API_KEY is required.',
      };
    }

    try {
      // 3. Build the Gemini client
      const client = this.clientFactory
        ? this.clientFactory(this.apiKey)
        : this.buildProductionClient(this.apiKey);

      // 4. Encode the document binary as base64 inline data
      const buffer = Buffer.isBuffer(request.content)
        ? request.content
        : Buffer.from(request.content);
      const base64Data = buffer.toString('base64');
      const mimeType = request.mimeType || 'application/octet-stream';

      // 5. Build structured extraction prompt
      const systemPrompt = this.buildExtractionPrompt();

      // 6. Call Gemini with inline document data
      const response = await client.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: systemPrompt,
              },
            ],
          },
        ],
      });

      const rawOutput = response.text || '';

      // 7. Parse and validate structured Gemini response
      return this.parseGeminiResponse(rawOutput, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Sanitize: never include the API key in the error message
      const sanitized = this.sanitizeErrorMessage(message);
      return {
        success: false,
        items: [],
        errorMessage: `Gemini document extraction failed: ${sanitized}`,
      };
    }
  }

  /**
   * Constructs the production Gemini client using @google/genai SDK.
   * Isolated here so tests can skip it entirely via clientFactory injection.
   */
  private buildProductionClient(apiKey: string): GeminiClientAdapter {
    // Dynamic require to allow test environments to mock without needing SDK
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenAI } = require('@google/genai') as {
      GoogleGenAI: new (options: { apiKey: string }) => {
        models: {
          generateContent(params: {
            model: string;
            contents: unknown;
          }): Promise<{ text?: string }>;
        };
      };
    };

    const genAI = new GoogleGenAI({ apiKey });

    return {
      generateContent: async (params) => {
        const res = await genAI.models.generateContent({
          model: params.model,
          contents: params.contents,
        });
        return { text: res.text };
      },
    };
  }

  /**
   * Returns the structured extraction prompt instructing Gemini to produce
   * a predictable JSON array of extracted text lines without domain fabrication.
   */
  private buildExtractionPrompt(): string {
    return [
      'You are a document OCR extraction engine.',
      'Extract all readable text lines from the provided document.',
      'Return ONLY valid JSON in the following format, with no additional text, markdown, or explanation:',
      '{"items":[{"ocrText":"<line text>","confidence":<number 0-100>},...]}',
      '',
      'Rules:',
      '- Each item must have "ocrText" (string, required) and optionally "confidence" (integer 0-100).',
      '- Do NOT infer, hallucinate, or add any domain-specific fields (names, IDs, dates, statuses).',
      '- Do NOT wrap output in markdown code fences.',
      '- If the document contains no readable text, return: {"items":[]}',
      '- Extract text exactly as it appears in the document.',
    ].join('\n');
  }

  /**
   * Parses and validates the raw Gemini text response.
   * Returns a structured DocumentExtractionResult on success,
   * or a fail-closed error result for malformed/invalid output.
   */
  private parseGeminiResponse(
    rawOutput: string,
    request: DocumentExtractionRequest
  ): DocumentExtractionResult {
    if (typeof rawOutput !== 'string' || rawOutput.trim().length === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Gemini returned an empty response.',
      };
    }

    // Strip potential markdown code fences if model ignores instructions
    let jsonStr = rawOutput.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return {
        success: false,
        items: [],
        errorMessage: 'Gemini returned malformed JSON response.',
      };
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).items)
    ) {
      return {
        success: false,
        items: [],
        errorMessage: 'Gemini response did not contain a valid items array.',
      };
    }

    const rawItems = (parsed as { items: unknown[] }).items;
    const items: ExtractedDocumentItem[] = [];

    for (const rawItem of rawItems) {
      if (typeof rawItem !== 'object' || rawItem === null) continue;
      const item = rawItem as Record<string, unknown>;
      const ocrText = typeof item.ocrText === 'string' ? item.ocrText.trim() : '';
      if (ocrText.length === 0) continue;

      const extractedItem: ExtractedDocumentItem = {
        id: crypto.randomUUID(),
        ocrText,
      };

      if (
        typeof item.confidence === 'number' &&
        item.confidence >= 0 &&
        item.confidence <= 100
      ) {
        extractedItem.confidence = Math.round(item.confidence);
      }

      items.push(extractedItem);
    }

    const rawText = items.map((it) => it.ocrText).join('\n');

    return {
      success: true,
      rawText,
      pageCount: 1,
      items,
      metadata: {
        provider: 'gemini',
        model: this.model,
        pageCount: 1,
        ...(request.metadata || {}),
      },
    };
  }

  /**
   * Strips any occurrence of the API key from an error message to prevent secret leakage.
   */
  private sanitizeErrorMessage(message: string): string {
    if (!this.apiKey) return message;
    // Replace any occurrence of the actual key with a placeholder
    return message.split(this.apiKey).join('[REDACTED]');
  }
}
