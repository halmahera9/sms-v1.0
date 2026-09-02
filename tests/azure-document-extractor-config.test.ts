import crypto from 'crypto';
import {
  resolveAzureDocumentExtractorConfig,
  getAzureDocumentExtractorConfigStatus,
  AzureDocumentExtractorConfigSummary,
} from '../src/platform/services/azure-document-extractor-config';
import {
  getDocumentExtractor,
  DeterministicDocumentExtractor,
  UnavailableDocumentExtractor,
} from '../src/platform/services/document-extractor';
import { AzureDocumentExtractor } from '../src/platform/services/azure-document-extractor';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log('  ✓ Test ' + testCount + ': ' + message);
  } else {
    console.error('  ✗ Test ' + testCount + ' FAILED: ' + message);
    throw new Error('Assertion Failed: ' + message);
  }
}

/** Clears all Azure env vars and returns a restore function. */
function clearAzureEnv(): () => void {
  const saved: Record<string, string | undefined> = {
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    AZURE_DOCUMENT_INTELLIGENCE_KEY: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
    AZURE_FORM_RECOGNIZER_ENDPOINT: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
    AZURE_FORM_RECOGNIZER_KEY: process.env.AZURE_FORM_RECOGNIZER_KEY,
    AZURE_DOCUMENT_INTELLIGENCE_API_VERSION: process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION,
    AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID: process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID,
  };

  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  delete process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  delete process.env.AZURE_FORM_RECOGNIZER_KEY;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION;
  delete process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID;

  return () => {
    for (const [key, val] of Object.entries(saved)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  };
}

async function runTests() {
  console.log('================================================================');
  console.log(' PHASE 5E.2-F: AZURE DOCUMENT INTELLIGENCE CONFIG BOUNDARY TESTS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Canonical preference over legacy variables
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Canonical Preference Over Legacy ---');

  {
    const restore = clearAzureEnv();
    try {
      // Set both canonical and legacy with different values
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://canonical.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'canonical-key-123';
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = 'https://legacy.cognitiveservices.azure.com';
      process.env.AZURE_FORM_RECOGNIZER_KEY = 'legacy-key-456';

      const resolved = resolveAzureDocumentExtractorConfig();

      assert(
        resolved.endpoint === 'https://canonical.cognitiveservices.azure.com',
        'Canonical endpoint is preferred over legacy endpoint'
      );
      assert(
        resolved.apiKey === 'canonical-key-123',
        'Canonical API key is preferred over legacy API key'
      );
      assert(resolved.status === 'configured', 'Status is configured');
      assert(resolved.isConfigured === true, 'isConfigured is true');
      assert(resolved.source === 'canonical', 'Source is identified as canonical');
      assert(resolved.summary.source === 'canonical', 'Summary source is canonical');
    } finally {
      restore();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Legacy fallback when canonical is absent
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Legacy Fallback Compatibility ---');

  {
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = 'https://legacy.cognitiveservices.azure.com';
      process.env.AZURE_FORM_RECOGNIZER_KEY = 'legacy-key-789';

      const resolved = resolveAzureDocumentExtractorConfig();

      assert(
        resolved.endpoint === 'https://legacy.cognitiveservices.azure.com',
        'Falls back to legacy endpoint when canonical is absent'
      );
      assert(
        resolved.apiKey === 'legacy-key-789',
        'Falls back to legacy API key when canonical is absent'
      );
      assert(resolved.status === 'configured', 'Legacy pair resolves status as configured');
      assert(resolved.isConfigured === true, 'Legacy pair isConfigured is true');
      assert(resolved.source === 'legacy', 'Source is identified as legacy');
    } finally {
      restore();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Completely missing configuration (unconfigured)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Completely Missing Configuration ---');

  {
    const restore = clearAzureEnv();
    try {
      const resolved = resolveAzureDocumentExtractorConfig();

      assert(resolved.endpoint === undefined, 'Endpoint is undefined when unconfigured');
      assert(resolved.apiKey === undefined, 'API key is undefined when unconfigured');
      assert(resolved.status === 'unconfigured', 'Status is unconfigured');
      assert(resolved.isConfigured === false, 'isConfigured is false');
      assert(resolved.source === 'none', 'Source is none');
      assert(resolved.summary.hasEndpoint === false, 'Summary hasEndpoint is false');
      assert(resolved.summary.hasApiKey === false, 'Summary hasApiKey is false');

      const status = getAzureDocumentExtractorConfigStatus();
      assert(status.status === 'unconfigured', 'getAzureDocumentExtractorConfigStatus() returns unconfigured');
      assert(status.isConfigured === false, 'getAzureDocumentExtractorConfigStatus() isConfigured is false');
    } finally {
      restore();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 4: Partial configuration (endpoint only / key only)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Partial Configuration Fails Closed ---');

  {
    // 4.1 Endpoint only
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://test.cognitiveservices.azure.com';

      const resolved = resolveAzureDocumentExtractorConfig();

      assert(resolved.status === 'partially_configured', 'Endpoint-only config status is partially_configured');
      assert(resolved.isConfigured === false, 'Endpoint-only config isConfigured is false');
      assert(resolved.summary.hasEndpoint === true, 'hasEndpoint is true');
      assert(resolved.summary.hasApiKey === false, 'hasApiKey is false');
      assert(resolved.source === 'partial', 'Source is partial');
    } finally {
      restore();
    }
  }

  {
    // 4.2 Key only
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'secret-key-only';

      const resolved = resolveAzureDocumentExtractorConfig();

      assert(resolved.status === 'partially_configured', 'Key-only config status is partially_configured');
      assert(resolved.isConfigured === false, 'Key-only config isConfigured is false');
      assert(resolved.summary.hasEndpoint === false, 'hasEndpoint is false');
      assert(resolved.summary.hasApiKey === true, 'hasApiKey is true');
      assert(resolved.source === 'partial', 'Source is partial');
    } finally {
      restore();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 5: Zero secret leakage in summary / status / error messages
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Zero Secret Leakage Validation ---');

  {
    const restore = clearAzureEnv();
    try {
      const sensitiveSecret = 'SUPER_SECRET_AZURE_API_KEY_NEVER_LEAK_99999';
      const sensitiveEndpoint = 'https://my-private-instance.cognitiveservices.azure.com';

      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = sensitiveEndpoint;
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = sensitiveSecret;

      const summary = getAzureDocumentExtractorConfigStatus();
      const summaryJson = JSON.stringify(summary);

      assert(
        !summaryJson.includes(sensitiveSecret),
        'Config summary does not contain the secret API key'
      );
      assert(
        !summaryJson.includes(sensitiveEndpoint),
        'Config summary does not contain the endpoint URI'
      );
      assert(summary.isConfigured === true, 'Summary correctly reflects isConfigured boolean');
      assert(summary.hasApiKey === true, 'Summary hasApiKey flag is true');
      assert(summary.hasEndpoint === true, 'Summary hasEndpoint flag is true');
    } finally {
      restore();
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 6: Extractor factory integration with canonical configuration
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Extractor Factory Integration ---');

  {
    // 6.1 Factory returns AzureDocumentExtractor when configured
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://factory-test.cognitiveservices.azure.com';
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = 'factory-key-123';

      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof AzureDocumentExtractor,
        'Factory returns AzureDocumentExtractor when canonical config is complete'
      );
    } finally {
      restore();
    }
  }

  {
    // 6.2 Factory returns UnavailableDocumentExtractor when unconfigured
    const restore = clearAzureEnv();
    try {
      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Factory returns UnavailableDocumentExtractor when unconfigured'
      );

      const result = await extractor.extract({
        tenantId: crypto.randomUUID(),
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('PDF'),
      });

      assert(result.success === false, 'Extraction returns success: false');
      assert(
        result.errorMessage?.includes('Azure Document Intelligence is not configured') === true,
        'Error message explains missing configuration without secret leakage'
      );
    } finally {
      restore();
    }
  }

  {
    // 6.3 Factory returns UnavailableDocumentExtractor when partially configured
    const restore = clearAzureEnv();
    try {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://factory-test.cognitiveservices.azure.com';

      const extractor = getDocumentExtractor();
      assert(
        extractor instanceof UnavailableDocumentExtractor,
        'Factory returns UnavailableDocumentExtractor on partial config (endpoint only)'
      );

      const result = await extractor.extract({
        tenantId: crypto.randomUUID(),
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('PDF'),
      });

      assert(result.success === false, 'Partial config extraction returns success: false');
      assert(
        result.errorMessage?.includes('partially configured (missing API key)') === true,
        'Error message specifies missing API key without leaking endpoint value'
      );
    } finally {
      restore();
    }
  }

  {
    // 6.4 Factory never returns DeterministicDocumentExtractor automatically
    const restore = clearAzureEnv();
    try {
      const extractor = getDocumentExtractor();
      assert(
        !(extractor instanceof DeterministicDocumentExtractor),
        'Factory never returns DeterministicDocumentExtractor'
      );
    } finally {
      restore();
    }
  }

  console.log('\n================================================================');
  console.log(' ALL ' + passCount + ' / ' + testCount + ' CONFIG BOUNDARY TESTS PASSED');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Failure:', err);
  process.exit(1);
});
