import 'server-only';

import crypto from 'crypto';

import type {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '@/platform/types/document-extractor';
import { HybridDocumentExtractor } from './hybrid-document-extractor';

/**
 * Deterministic extractor retained for tests/dev fixtures.
 */
export class DeterministicDocumentExtractor implements IDocumentExtractor {
  constructor(
    private readonly options: {
      defaultItems?: Array<{
        ocrText: string;
        confidence?: number;
        matchedStudentName?: string;
        matchedNisn?: string;
        matchedStudentId?: string;
        nisn?: string;
        nis?: string;
        date?: string;
        status?: string;
      }>;
    } = {}
  ) {}

  async extract(
    _request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    const items: ExtractedDocumentItem[] = (
      this.options.defaultItems ?? []
    ).map((item) => ({
      id: crypto.randomUUID(),
      ocrText: item.ocrText,
      name: item.ocrText,
      matchedStudentName: item.matchedStudentName,
      matchedNisn: item.matchedNisn,
      matchedStudentId: item.matchedStudentId,
      nisn: item.nisn ?? item.matchedNisn,
      nis: item.nis,
      date: item.date,
      status: item.status,
      confidence: item.confidence ?? 0,
    }));

    return {
      success: true,
      items,
      rawText: items.map((item) => item.ocrText).join("\n"),
    };
  }
}

/**
 * Explicit unavailable extractor retained for tests/fail-closed scenarios.
 */
export class UnavailableDocumentExtractor implements IDocumentExtractor {
  constructor(
    private readonly reason = 'Document extractor tidak tersedia.'
  ) {}

  async extract(
    _request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    return {
      success: false,
      items: [],
      errorMessage: this.reason,
    };
  }
}

/**
 * Canonical production document extractor.
 *
 * PDF:
 * 1. Try native text layer via pdftotext.
 * 2. Fall back to page rasterisation + Tesseract OCR.
 */
export function getDocumentExtractor(): IDocumentExtractor {
  return new HybridDocumentExtractor();
}
