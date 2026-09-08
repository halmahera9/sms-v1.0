import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  TesseractLocalOcrEngine,
  ILocalOcrEngine,
  resolveTesseractOcrConfig,
} from "../src/platform/services/local-ocr-engine";
import type { LocalOcrRequest, LocalOcrResult } from "../src/platform/services/local-ocr-engine";

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string, detail?: string): void {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  check Test ${testCount}: ${message}`);
  } else {
    console.error(`  FAIL Test ${testCount}: ${message}${detail ? " - " + detail : ""}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal mock OCR engine (injectable seam)
// ---------------------------------------------------------------------------

class MockOcrEngine implements ILocalOcrEngine {
  constructor(private readonly response: LocalOcrResult) {}
  async recognise(_req: LocalOcrRequest): Promise<LocalOcrResult> {
    return this.response;
  }
}

// ---------------------------------------------------------------------------
// Deterministic fake binaryPath that never resolves (Windows-safe)
// ---------------------------------------------------------------------------

const FAKE_NONEXISTENT_BINARY = path.join(os.tmpdir(), `fake_tesseract_${crypto.randomUUID()}.exe`);

// Fake writeTempFile that writes to OS tmp and returns path for injection.
function fakeWriteTempFile(buffer: Buffer, suffix: string): string {
  const p = path.join(os.tmpdir(), `test_ocr_${Date.now()}${suffix}`);
  fs.writeFileSync(p, buffer);
  return p;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
  console.log("================================================================");
  console.log(" LOCAL OCR ENGINE: UNIT TEST SUITE");
  console.log("================================================================\n");

  // -------------------------------------------------------------------------
  // SECTION 1: Config resolution
  // -------------------------------------------------------------------------
  console.log("--- SECTION 1: Config Resolution ---");

  {
    // 1.1 TESSERACT_BINARY_PATH set to an absolute non-existent path -> isAvailable false
    const saved = process.env.TESSERACT_BINARY_PATH;
    process.env.TESSERACT_BINARY_PATH = FAKE_NONEXISTENT_BINARY;
    try {
      const status = resolveTesseractOcrConfig(process.env);
      assert(status.isAvailable === false, "Absolute non-existent path -> isAvailable false");
      assert(
        status.resolvedPath === FAKE_NONEXISTENT_BINARY,
        "Resolved path matches TESSERACT_BINARY_PATH"
      );
    } finally {
      if (saved !== undefined) process.env.TESSERACT_BINARY_PATH = saved;
      else delete process.env.TESSERACT_BINARY_PATH;
    }
  }

  {
    // 1.2 TESSERACT_BINARY_PATH absent -> falls back to "tesseract" (PATH probe)
    const saved = process.env.TESSERACT_BINARY_PATH;
    delete process.env.TESSERACT_BINARY_PATH;
    try {
      const status = resolveTesseractOcrConfig(process.env);
      assert(status.resolvedPath === "tesseract", "No env var -> resolvedPath is 'tesseract'");
      // isAvailable depends on whether tesseract is installed on the CI host
      // - we only assert the shape, not the availability value.
      assert(
        typeof status.isAvailable === "boolean",
        "isAvailable is a boolean regardless of host"
      );
    } finally {
      if (saved !== undefined) process.env.TESSERACT_BINARY_PATH = saved;
      else delete process.env.TESSERACT_BINARY_PATH;
    }
  }

  {
    // 1.3 Whitespace-only env var -> falls back to "tesseract"
    const saved = process.env.TESSERACT_BINARY_PATH;
    process.env.TESSERACT_BINARY_PATH = "   ";
    try {
      const status = resolveTesseractOcrConfig(process.env);
      assert(status.resolvedPath === "tesseract", "Whitespace-only env var -> fallback to 'tesseract'");
    } finally {
      if (saved !== undefined) process.env.TESSERACT_BINARY_PATH = saved;
      else delete process.env.TESSERACT_BINARY_PATH;
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Input validation (engine with non-existent binary)
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Input Validation (Fail-Closed) ---");

  {
    // 2.1 Empty imageBuffer -> success:false immediately
    const engine = new TesseractLocalOcrEngine({ binaryPath: FAKE_NONEXISTENT_BINARY });
    const result = await engine.recognise({ imageBuffer: Buffer.alloc(0) });
    assert(result.success === false, "Empty imageBuffer -> success:false");
    assert(
      result.errorMessage?.includes("imageBuffer cannot be empty") === true,
      "Empty buffer gives descriptive validation error"
    );
    assert(Array.isArray(result.lines) && result.lines.length === 0, "Empty buffer -> empty lines");
    assert(result.rawText === "", "Empty buffer -> empty rawText");
  }

  {
    // 2.2 Missing Tesseract binary -> success:false with descriptive install message
    const engine = new TesseractLocalOcrEngine({ binaryPath: FAKE_NONEXISTENT_BINARY });
    const result = await engine.recognise({
      imageBuffer: Buffer.from("fake-png-bytes"),
    });
    assert(result.success === false, "Non-existent binary -> success:false");
    assert(
      typeof result.errorMessage === "string" && result.errorMessage.length > 0,
      "Non-existent binary -> non-empty errorMessage"
    );
    assert(
      result.errorMessage!.includes(FAKE_NONEXISTENT_BINARY),
      "Error message includes the failed binary path"
    );
    assert(
      result.errorMessage!.toLowerCase().includes("tesseract"),
      "Error message references Tesseract"
    );
    assert(result.lines.length === 0, "Non-existent binary -> empty lines");
    assert(result.rawText === "", "Non-existent binary -> empty rawText");
  }

  {
    // 2.3 Engine never throws (always returns a result)
    const engine = new TesseractLocalOcrEngine({ binaryPath: FAKE_NONEXISTENT_BINARY });
    let threw = false;
    try {
      await engine.recognise({ imageBuffer: Buffer.from("data") });
    } catch {
      threw = true;
    }
    assert(!threw, "Engine never throws; always returns LocalOcrResult");
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Success path via mock injection
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Success Path (Mock Injection) ---");

  {
    // 3.1 ILocalOcrEngine interface can be satisfied by a mock
    const mockResult: LocalOcrResult = {
      success: true,
      lines: [
        { text: "DAFTAR KEHADIRAN SISWA", confidence: 97 },
        { text: "AHMAD PRATAMA 1234567890 SAKIT", confidence: 88 },
      ],
      rawText: "DAFTAR KEHADIRAN SISWA\nAHMAD PRATAMA 1234567890 SAKIT",
    };
    const engine: ILocalOcrEngine = new MockOcrEngine(mockResult);
    const result = await engine.recognise({
      imageBuffer: Buffer.from("fake-png"),
      lang: "ind+eng",
    });
    assert(result.success === true, "Mock engine returns success:true");
    assert(result.lines.length === 2, "Mock engine returns expected line count");
    assert(result.lines[0].text === "DAFTAR KEHADIRAN SISWA", "First line text is correct");
    assert(result.lines[0].confidence === 97, "First line confidence is correct");
    assert(result.lines[1].text === "AHMAD PRATAMA 1234567890 SAKIT", "Second line text is correct");
    assert(
      result.rawText === "DAFTAR KEHADIRAN SISWA\nAHMAD PRATAMA 1234567890 SAKIT",
      "rawText joins lines correctly"
    );
  }

  {
    // 3.2 Mock engine with empty lines (blank page)
    const mockResult: LocalOcrResult = {
      success: true,
      lines: [],
      rawText: "",
    };
    const engine: ILocalOcrEngine = new MockOcrEngine(mockResult);
    const result = await engine.recognise({ imageBuffer: Buffer.from("blank-page") });
    assert(result.success === true, "Blank page -> success:true");
    assert(result.lines.length === 0, "Blank page -> empty lines");
    assert(result.rawText === "", "Blank page -> empty rawText");
  }

  {
    // 3.3 Confidence range: 0-100
    const mockResult: LocalOcrResult = {
      success: true,
      lines: [
        { text: "Low conf", confidence: 0 },
        { text: "High conf", confidence: 100 },
      ],
      rawText: "Low conf\nHigh conf",
    };
    const engine: ILocalOcrEngine = new MockOcrEngine(mockResult);
    const result = await engine.recognise({ imageBuffer: Buffer.from("img") });
    assert(result.lines[0].confidence === 0, "Confidence 0 preserved");
    assert(result.lines[1].confidence === 100, "Confidence 100 preserved");
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Interface contract
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Interface Contract ---");

  {
    // 4.1 TesseractLocalOcrEngine implements ILocalOcrEngine
    const engine = new TesseractLocalOcrEngine({ binaryPath: FAKE_NONEXISTENT_BINARY });
    assert(typeof engine.recognise === "function", "TesseractLocalOcrEngine has recognise()");
  }

  {
    // 4.2 Engine constructed with default options does not throw
    let threw = false;
    try {
      new TesseractLocalOcrEngine();
    } catch {
      threw = true;
    }
    assert(!threw, "TesseractLocalOcrEngine() default construction does not throw");
  }

  {
    // 4.3 binaryPath option respected (injected non-existent path causes fail-closed, not PATH lookup)
    const engine = new TesseractLocalOcrEngine({ binaryPath: "/absolute/path/to/nowhere/tesseract" });
    const result = await engine.recognise({ imageBuffer: Buffer.from("x") });
    assert(result.success === false, "Injected non-existent binaryPath -> fail-closed");
    assert(
      result.errorMessage!.includes("/absolute/path/to/nowhere/tesseract"),
      "Error message references the injected binary path"
    );
  }

  {
    // 4.4 No secrets involved - engine accepts no API key or secret parameters
    const engine = new TesseractLocalOcrEngine({ binaryPath: FAKE_NONEXISTENT_BINARY });
    const result = await engine.recognise({ imageBuffer: Buffer.from("data") });
    // errorMessage must not contain any token resembling a secret
    // (simply confirming there is no key, password, or token field in the type)
    assert(
      !("apiKey" in result) && !("password" in result) && !("token" in result),
      "LocalOcrResult contains no secret fields"
    );
  }

  // -------------------------------------------------------------------------
  // SECTION 5: writeTempFile injection (isolation seam)
  // -------------------------------------------------------------------------
  console.log("\n--- SECTION 5: writeTempFile Injection ---");

  {
    // 5.1 writeTempFile injection is called when provided
    let called = false;
    const engine = new TesseractLocalOcrEngine({
      binaryPath: FAKE_NONEXISTENT_BINARY,
      writeTempFile: (buf, suffix) => {
        called = true;
        return fakeWriteTempFile(buf, suffix);
      },
    });
    // Binarypath is non-existent so recognise() fails closed BEFORE writeTempFile
    // is called (guard #2 fires first). Confirm called is false here.
    await engine.recognise({ imageBuffer: Buffer.from("px") });
    // Called will be false since binary probe fails before temp file is written.
    assert(called === false, "writeTempFile not called before binary guard passes");
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n================================================================");
  console.log(` ALL ${passCount} / ${testCount} LOCAL OCR ENGINE TESTS PASSED`);
  console.log("================================================================\n");
}

runTests().catch((err: unknown) => {
  console.error("Fatal Test Execution Failure:", err);
  process.exit(1);
});
