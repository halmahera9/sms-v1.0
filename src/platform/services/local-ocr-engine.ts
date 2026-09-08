import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single text line produced by the local OCR engine, with per-line average
 * confidence (0-100).
 */
export interface OcrLine {
  text: string;
  confidence: number;
}

/**
 * Result of a single-image OCR pass.
 */
export interface LocalOcrResult {
  /** True when OCR completed without a runtime error. */
  success: boolean;
  /** Ordered list of non-empty text lines produced by the engine. */
  lines: OcrLine[];
  /** All lines joined by newline, for convenience. */
  rawText: string;
  /** Descriptive error when success is false. */
  errorMessage?: string;
}

/**
 * Input to the local OCR engine: a raster image buffer (JPEG, PNG, or TIFF)
 * and an optional language hint. PDF buffers must NOT be passed here;
 * callers must rasterise pages via IPdfPageRenderer first.
 */
export interface LocalOcrRequest {
  /** Raw raster image bytes - JPEG, PNG, or TIFF. NOT a PDF. */
  imageBuffer: Buffer;
  /**
   * Tesseract language identifier(s), "+" -separated.
   * Defaults to "ind+eng" for Indonesian government documents.
   */
  lang?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Minimal adapter interface for local raster-image OCR.
 *
 * Contract:
 * - Accepts a single raster image buffer per call.
 * - PDF splitting / rasterisation is NOT this layer"s responsibility.
 * - Implementations must be replaceable; callers must NOT import concrete types directly.
 * - Implementations must fail closed: a missing runtime returns success:false
 *   with a descriptive errorMessage and never throws.
 */
export interface ILocalOcrEngine {
  /**
   * Performs OCR on a single raster image buffer.
   *
   * @param request Image buffer plus optional language hint.
   * @returns Ordered OCR lines with per-line confidence, or a fail-closed error.
   */
  recognise(request: LocalOcrRequest): Promise<LocalOcrResult>;
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

/**
 * Non-secret status of the resolved Tesseract OCR configuration.
 * Safe for logging and diagnostic use; contains no secrets.
 */
export interface TesseractOcrConfigStatus {
  /** True when the resolved binary is reachable and executable. */
  isAvailable: boolean;
  /**
   * The resolved binary path (from TESSERACT_BINARY_PATH, or "tesseract"
   * when the env var is absent).
   */
  resolvedPath: string;
}

/**
 * Resolves the Tesseract configuration status from the environment.
 *
 * Reads: TESSERACT_BINARY_PATH (optional, not a secret).
 * Falls back to "tesseract" (OS PATH lookup) when the env var is absent.
 *
 * @param env Environment map - defaults to process.env.
 */
export function resolveTesseractOcrConfig(
  env: NodeJS.ProcessEnv = process.env
): TesseractOcrConfigStatus {
  const rawPath =
    typeof env.TESSERACT_BINARY_PATH === "string" &&
    env.TESSERACT_BINARY_PATH.trim().length > 0
      ? env.TESSERACT_BINARY_PATH.trim()
      : "tesseract";

  let isAvailable = false;

  if (path.isAbsolute(rawPath)) {
    try {
      fs.accessSync(rawPath, fs.constants.X_OK);
      isAvailable = true;
    } catch {
      isAvailable = false;
    }
  } else {
    const probe = spawnSync(rawPath, ["--version"], {
      timeout: 3000,
      encoding: "utf8",
      windowsHide: true,
    });
    isAvailable = probe.status === 0 && !probe.error;
  }

  return { isAvailable, resolvedPath: rawPath };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TesseractLocalOcrEngineOptions {
  /**
   * Absolute path or command name for the Tesseract executable.
   * Falls back to TESSERACT_BINARY_PATH env var, then "tesseract" (PATH).
   */
  binaryPath?: string;

  /**
   * Injectable function that writes a Buffer to a temp file and returns its
   * absolute path. Used for hermetic test isolation.
   * When omitted the engine manages its own OS temp directory.
   */
  writeTempFile?: (buffer: Buffer, suffix: string) => string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Production Tesseract local OCR engine adapter.
 *
 * Design invariants:
 * - Fail closed: missing or unavailable Tesseract binary -> success:false, never throws.
 * - No secrets: reads only TESSERACT_BINARY_PATH, which is not a secret.
 * - Deterministic temp file cleanup: temp files are always removed in the finally block.
 * - Injectable binaryPath and writeTempFile for hermetic unit testing without
 *   requiring a real Tesseract installation.
 * - Single-image contract: PDF rasterisation is NOT this adapter"s concern.
 */
export class TesseractLocalOcrEngine implements ILocalOcrEngine {
  private readonly binaryPath: string;
  private readonly writeTempFileImpl: (buffer: Buffer, suffix: string) => string;

  constructor(options: TesseractLocalOcrEngineOptions = {}) {
    this.binaryPath =
      options.binaryPath?.trim() ||
      process.env.TESSERACT_BINARY_PATH?.trim() ||
      "tesseract";

    this.writeTempFileImpl =
      options.writeTempFile ?? TesseractLocalOcrEngine.defaultWriteTempFile;
  }

  public async recognise(request: LocalOcrRequest): Promise<LocalOcrResult> {
    // 1. Guard: empty image buffer
    if (!request?.imageBuffer || request.imageBuffer.byteLength === 0) {
      return {
        success: false,
        lines: [],
        rawText: "",
        errorMessage: "Validation Error: imageBuffer cannot be empty.",
      };
    }

    // 2. Guard: verify Tesseract binary is reachable before doing I/O
    const probe = spawnSync(this.binaryPath, ["--version"], {
      timeout: 3000,
      encoding: "utf8",
      windowsHide: true,
    });

    if (probe.status !== 0 || probe.error) {
      const detail = probe.error
        ? probe.error.message
        : `exit code ${probe.status ?? "unknown"}`;
      return {
        success: false,
        lines: [],
        rawText: "",
        errorMessage:
          `Tesseract OCR engine is not available at "${this.binaryPath}": ${detail}. ` +
          `Install Tesseract (https://github.com/tesseract-ocr/tesseract) and set ` +
          `TESSERACT_BINARY_PATH if it is not on PATH.`,
      };
    }

    const lang = request.lang?.trim() || "ind+eng";
    let inputPath: string | null = null;
    let outputBase: string | null = null;

    try {
      // 3. Write image buffer to a temp file
      inputPath = this.writeTempFileImpl(request.imageBuffer, ".png");

      // 4. Unique output base; Tesseract appends ".tsv" automatically
      outputBase = inputPath.replace(/\.png$/, "_out");

      // 5. Invoke Tesseract: <binary> <input> <output-base> -l <lang> --psm 6 tsv
      const result = spawnSync(
        this.binaryPath,
        [inputPath, outputBase, "-l", lang, "--psm", "6", "tsv"],
        { timeout: 30000, encoding: "utf8", windowsHide: true }
      );

      if (result.status !== 0 || result.error) {
        const detail = result.error
          ? result.error.message
          : result.stderr?.trim() || `exit code ${result.status ?? "unknown"}`;
        return {
          success: false,
          lines: [],
          rawText: "",
          errorMessage: `Tesseract OCR execution failed: ${detail}`,
        };
      }

      // 6. Parse TSV output
      const tsvPath = `${outputBase}.tsv`;
      const lines = this.parseTsvOutput(tsvPath);
      const rawText = lines.map((l) => l.text).join("\n");

      return { success: true, lines, rawText };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        lines: [],
        rawText: "",
        errorMessage: `Tesseract OCR engine error: ${message}`,
      };
    } finally {
      // 7. Always clean up temp files
      if (inputPath) {
        try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
      }
      if (outputBase) {
        try { fs.unlinkSync(`${outputBase}.tsv`); } catch { /* ignore */ }
      }
    }
  }

  /**
   * Parses Tesseract TSV output into OcrLine[].
   *
   * TSV columns (0-indexed):
   *   0:level  1:page  2:block  3:par  4:line  5:word
   *   6:left   7:top   8:width  9:height  10:conf  11:text
   *
   * Words are grouped into lines by (page, block, par, line) tuple.
   * Lines are returned in document order.
   */
  private parseTsvOutput(tsvPath: string): OcrLine[] {
    let raw: string;
    try {
      raw = fs.readFileSync(tsvPath, "utf8");
    } catch {
      return [];
    }

    const rows = raw.trim().split("\n").slice(1);
    const lineMap = new Map<string, { words: string[]; confs: number[] }>();

    for (const row of rows) {
      const cols = row.split("\t");
      if (cols.length < 12) continue;

      const level = parseInt(cols[0], 10);
      if (level !== 5) continue;

      const conf = parseFloat(cols[10]);
      if (conf < 0) continue;

      const text = cols[11]?.trim();
      if (!text) continue;

      const key = `${cols[1]}_${cols[2]}_${cols[3]}_${cols[4]}`;
      const existing = lineMap.get(key) ?? { words: [], confs: [] };
      existing.words.push(text);
      existing.confs.push(conf);
      lineMap.set(key, existing);
    }

    const result: OcrLine[] = [];
    for (const { words, confs } of lineMap.values()) {
      const lineText = words.join(" ");
      const avgConf =
        confs.length > 0
          ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
          : 0;
      result.push({ text: lineText, confidence: avgConf });
    }

    return result;
  }

  /**
   * Default temp-file writer: creates a uniquely named PNG in the OS temp dir.
   */
  private static defaultWriteTempFile(buffer: Buffer, suffix: string): string {
    const tmpDir = os.tmpdir();
    const name =
      `banyubiru_ocr_${Date.now()}_${Math.random().toString(36).slice(2)}${suffix}`;
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}
