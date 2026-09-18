import 'server-only';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  IDocumentExtractor,
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '../types/document-extractor';

const execFileAsync = promisify(execFile);

export class LocalPdfDocumentExtractor implements IDocumentExtractor {
  public async extract(
    request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    if (!request?.content || request.content.byteLength === 0) {
      return {
        success: false,
        items: [],
        errorMessage: 'Validation Error: Binary content cannot be empty.',
      };
    }

    if (request.mimeType !== 'application/pdf') {
      return {
        success: false,
        items: [],
        errorMessage: 'Local PDF extractor hanya menerima file PDF.',
      };
    }

    const inputPath = `/tmp/banyubiru-${request.documentVersionId}.pdf`;

    try {
      const { promises: fs } = await import('fs');

      await fs.writeFile(inputPath, Buffer.from(request.content));

      const { stdout } = await execFileAsync(
        'pdftotext',
        ['-layout', inputPath, '-'],
        {
          maxBuffer: 20 * 1024 * 1024,
        }
      );

      const rawText = stdout.trim();

      if (!rawText) {
        return {
          success: false,
          items: [],
          rawText: '',
          pageCount: 1,
          errorMessage:
            'PDF berhasil dibaca tetapi tidak mengandung teks yang dapat diekstraksi.',
        };
      }

      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const items: ExtractedDocumentItem[] = lines.map((line, index) => ({
        id: `${request.documentId}-item-${index + 1}`,
        ocrText: line,
        name: line,
        confidence: 1,
      }));

      return {
        success: true,
        items,
        rawText,
        pageCount: 1,
        metadata: {
          extractionEngine: 'pdftotext',
          extractionMode: 'local-pdf-text',
          lineCount: lines.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        errorMessage:
          error instanceof Error
            ? `Local PDF extraction failed: ${error.message}`
            : 'Local PDF extraction failed.',
      };
    } finally {
      try {
        const { promises: fs } = await import('fs');
        await fs.unlink(inputPath);
      } catch {
        // Ignore temporary-file cleanup failure.
      }
    }
  }
}
