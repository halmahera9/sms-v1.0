/**
 * Extracted granular line item or token produced during document extraction / OCR.
 * Directly compatible with DocumentIntelligenceOrchestrator metadata.items contract.
 */
export interface ExtractedDocumentItem {
  id?: string;
  ocrText?: string;
  matchedStudentName?: string;
  name?: string;
  matchedNisn?: string;
  nisn?: string;
  matchedStudentId?: string;
  date?: string;
  status?: string;
  confidence?: number;
}

/**
 * Inbound payload for document extraction requests.
 */
export interface DocumentExtractionRequest {
  tenantId: string;
  documentId: string;
  documentVersionId: string;
  fileName: string;
  mimeType: string;
  content: Buffer | Uint8Array;
  metadata?: Record<string, unknown>;
}

/**
 * Output payload returned by document extraction providers.
 */
export interface DocumentExtractionResult {
  success: boolean;
  items: ExtractedDocumentItem[];
  rawText?: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Canonical Application Service interface for Document and OCR Extraction.
 */
export interface IDocumentExtractor {
  /**
   * Extracts structured line items and text from an uploaded binary buffer.
   *
   * @param request Canonical extraction request containing binary buffer, mimeType, and document context.
   * @returns Structured extraction result with items compatible with DocumentIntelligenceOrchestrator.
   */
  extract(request: DocumentExtractionRequest): Promise<DocumentExtractionResult>;
}
