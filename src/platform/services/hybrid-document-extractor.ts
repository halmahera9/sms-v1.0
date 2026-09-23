import 'server-only';

import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { IDocumentExtractor } from '@/platform/types/document-extractor';
import type {
  DocumentExtractionRequest,
  DocumentExtractionResult,
  ExtractedDocumentItem,
} from '@/platform/types/document-extractor';
import { TesseractLocalOcrEngine } from './local-ocr-engine';
import { LocalPdfDocumentExtractor } from './local-pdf-document-extractor';

const execFileAsync = promisify(execFile);

export class HybridDocumentExtractor implements IDocumentExtractor {
  private readonly pdfExtractor = new LocalPdfDocumentExtractor();
  private readonly ocrEngine = new TesseractLocalOcrEngine();

  async extract(
    request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    if (!request.content?.length) {
      return {
        success: false,
        items: [],
        errorMessage: 'Konten dokumen kosong.',
      };
    }

    const mimeType = request.mimeType.trim().toLowerCase();

    const supportedImageTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
    ]);

    if (supportedImageTypes.has(mimeType)) {
      return this.extractImageWithTesseract(request);
    }

    if (mimeType !== 'application/pdf') {
      return {
        success: false,
        items: [],
        errorMessage: `Format dokumen tidak didukung: ${request.mimeType}`,
      };
    }

    /*
     * Fast path:
     * PDF dengan text layer → pdftotext.
     */
    const textResult = await this.pdfExtractor.extract(request);

    if (
      textResult.success &&
      textResult.rawText?.trim() &&
      textResult.items.length > 0
    ) {
      return {
        ...textResult,
        metadata: {
          ...(textResult.metadata ?? {}),
          extractionStrategy: 'text-layer',
          fallbackToTesseract: false,
        },
      };
    }

    /*
     * OCR fallback:
     * scanned/image-only PDF → render halaman → Tesseract.
     */
    return this.extractPdfWithTesseract(request);
  }

  private async extractImageWithTesseract(
    request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    try {
      const ocr = await this.ocrEngine.recognise({
        imageBuffer: Buffer.from(request.content),
        lang: 'ind+eng',
      });

      if (!ocr.success || !ocr.rawText?.trim()) {
        return {
          success: false,
          items: [],
          errorMessage:
            ocr.errorMessage ||
            'OCR gambar tidak menghasilkan teks.',
          metadata: {
            extractionStrategy: 'tesseract',
            extractionMode: 'image-ocr',
            mimeType: request.mimeType,
          },
        };
      }

      const items: ExtractedDocumentItem[] = ocr.lines
        .map((line) => line.text.trim())
        .filter(Boolean)
        .map((line) => ({
          id: randomUUID(),
          ocrText: line,
          name: line,
          confidence: ocr.lines.find(
            (item) => item.text.trim() === line
          )?.confidence ?? 0,
        }));

      return {
        success: true,
        items,
        rawText: ocr.rawText.trim(),
        pageCount: 1,
        metadata: {
          extractionEngine: 'tesseract',
          extractionStrategy: 'tesseract',
          extractionMode: 'image-ocr',
          mimeType: request.mimeType,
          language: 'ind+eng',
          itemCount: items.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        errorMessage:
          error instanceof Error
            ? `Tesseract image OCR gagal: ${error.message}`
            : 'Tesseract image OCR gagal.',
        metadata: {
          extractionStrategy: 'tesseract',
          extractionMode: 'image-ocr',
          mimeType: request.mimeType,
        },
      };
    }
  }

  private async extractPdfWithTesseract(
    request: DocumentExtractionRequest
  ): Promise<DocumentExtractionResult> {
    const tempPdf = `/tmp/banyubiru-hybrid-${request.documentVersionId}.pdf`;

    try {
      await writeFile(tempPdf, request.content);

      const { stdout } = await execFileAsync(
        'pdfinfo',
        [tempPdf],
        { maxBuffer: 1024 * 1024 }
      );

      const pageMatch = stdout.match(/^Pages:\s+(\d+)/m);
      const pageCount = pageMatch ? Number(pageMatch[1]) : 1;

      const allItems: ExtractedDocumentItem[] = [];
      const pageTexts: string[] = [];

      for (let page = 1; page <= pageCount; page++) {
        const pagePrefix =
          `/tmp/banyubiru-page-${request.documentVersionId}-${page}`;

        await execFileAsync(
          'pdftoppm',
          [
            '-f',
            String(page),
            '-singlefile',
            '-png',
            '-r',
            '300',
            tempPdf,
            pagePrefix,
          ],
          { maxBuffer: 1024 * 1024 }
        );

        const imagePath = `${pagePrefix}.png`;

        try {
          const image = await import('fs/promises').then((fs) =>
            fs.readFile(imagePath)
          );

          const ocr = await this.ocrEngine.recognise({
            imageBuffer: image,
            lang: 'ind+eng',
          });

          if (ocr.success && ocr.rawText?.trim()) {
            pageTexts.push(ocr.rawText.trim());

            const lines = ocr.lines
              .map((line) => line.text)
              .filter(Boolean)
              .map((line: string) => line.trim());

            for (const line of lines) {
              const ocrLine = ocr.lines.find((item) => item.text.trim() === line);
              allItems.push({
                id: randomUUID(),
                ocrText: line,
                name: line,
                confidence: ocrLine?.confidence ?? 0,
              });
            }
          }
        } finally {
          await unlink(imagePath).catch(() => undefined);
        }
      }

      if (allItems.length === 0) {
        return {
          success: false,
          items: [],
          pageCount,
          errorMessage:
            'PDF tidak memiliki text layer dan Tesseract tidak menghasilkan teks.',
          metadata: {
            extractionStrategy: 'tesseract',
            extractionMode: 'pdf-render-ocr',
          },
        };
      }

      return {
        success: true,
        items: allItems,
        rawText: pageTexts.join('\n'),
        pageCount,
        metadata: {
          extractionEngine: 'tesseract',
          extractionStrategy: 'ocr-fallback',
          extractionMode: 'pdf-render-ocr',
          language: 'ind+eng',
          dpi: 300,
          itemCount: allItems.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        errorMessage:
          error instanceof Error
            ? `Tesseract PDF OCR gagal: ${error.message}`
            : 'Tesseract PDF OCR gagal.',
        metadata: {
          extractionStrategy: 'ocr-fallback',
          extractionMode: 'pdf-render-ocr',
        },
      };
    } finally {
      await unlink(tempPdf).catch(() => undefined);
    }
  }
}
