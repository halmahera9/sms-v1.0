/**
 * Canonical configuration boundary for Azure AI Document Intelligence.
 *
 * Enforces:
 * 1. Prefer canonical AZURE_DOCUMENT_INTELLIGENCE_* variables over legacy AZURE_FORM_RECOGNIZER_*.
 * 2. Complete credential pair validation (endpoint + apiKey both required).
 * 3. Partial configuration (endpoint only, or apiKey only) is marked invalid and fails closed.
 * 4. Zero secret leakage: summary status exposes flags and sources without secret values.
 * 5. Deterministic resolution with support for environment overrides and dependency injection.
 */

export type AzureDocumentExtractorConfigStatus =
  | 'configured'
  | 'unconfigured'
  | 'partially_configured';

export type AzureDocumentExtractorConfigSource =
  | 'canonical'
  | 'legacy'
  | 'override'
  | 'mixed'
  | 'none'
  | 'partial';

/**
 * Safe, non-secret summary of the resolved Azure Document Intelligence configuration status.
 * Contains no secrets or credentials.
 */
export interface AzureDocumentExtractorConfigSummary {
  status: AzureDocumentExtractorConfigStatus;
  isConfigured: boolean;
  hasEndpoint: boolean;
  hasApiKey: boolean;
  source: AzureDocumentExtractorConfigSource;
  apiVersion: string;
  modelId: string;
}

export interface AzureDocumentExtractorConfigOptions {
  endpoint?: string;
  apiKey?: string;
  apiVersion?: string;
  modelId?: string;
}

export interface ResolvedAzureDocumentExtractorConfig {
  endpoint?: string;
  apiKey?: string;
  apiVersion: string;
  modelId: string;
  status: AzureDocumentExtractorConfigStatus;
  isConfigured: boolean;
  source: AzureDocumentExtractorConfigSource;
  summary: AzureDocumentExtractorConfigSummary;
}

/**
 * Resolves Azure Document Intelligence configuration from environment and explicit overrides.
 *
 * @param env Environment map (defaults to process.env)
 * @param overrides Explicit options taking precedence over environment variables
 * @returns Fully resolved configuration object and non-secret summary
 */
export function resolveAzureDocumentExtractorConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: AzureDocumentExtractorConfigOptions = {}
): ResolvedAzureDocumentExtractorConfig {
  // 1. Resolve endpoint
  let endpoint: string | undefined;
  let endpointSource: 'override' | 'canonical' | 'legacy' | 'none' = 'none';

  if (typeof overrides.endpoint === 'string' && overrides.endpoint.trim().length > 0) {
    endpoint = overrides.endpoint.trim();
    endpointSource = 'override';
  } else if (
    typeof env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT === 'string' &&
    env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.trim().length > 0
  ) {
    endpoint = env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT.trim();
    endpointSource = 'canonical';
  } else if (
    typeof env.AZURE_FORM_RECOGNIZER_ENDPOINT === 'string' &&
    env.AZURE_FORM_RECOGNIZER_ENDPOINT.trim().length > 0
  ) {
    endpoint = env.AZURE_FORM_RECOGNIZER_ENDPOINT.trim();
    endpointSource = 'legacy';
  }

  // 2. Resolve apiKey
  let apiKey: string | undefined;
  let keySource: 'override' | 'canonical' | 'legacy' | 'none' = 'none';

  if (typeof overrides.apiKey === 'string' && overrides.apiKey.trim().length > 0) {
    apiKey = overrides.apiKey.trim();
    keySource = 'override';
  } else if (
    typeof env.AZURE_DOCUMENT_INTELLIGENCE_KEY === 'string' &&
    env.AZURE_DOCUMENT_INTELLIGENCE_KEY.trim().length > 0
  ) {
    apiKey = env.AZURE_DOCUMENT_INTELLIGENCE_KEY.trim();
    keySource = 'canonical';
  } else if (
    typeof env.AZURE_FORM_RECOGNIZER_KEY === 'string' &&
    env.AZURE_FORM_RECOGNIZER_KEY.trim().length > 0
  ) {
    apiKey = env.AZURE_FORM_RECOGNIZER_KEY.trim();
    keySource = 'legacy';
  }

  // 3. Resolve apiVersion & modelId
  const apiVersion =
    overrides.apiVersion?.trim() ||
    env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION?.trim() ||
    '2024-11-30';

  const modelId =
    overrides.modelId?.trim() ||
    env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID?.trim() ||
    'prebuilt-layout';

  // 4. Determine status and composite source
  const hasEndpoint = !!endpoint;
  const hasApiKey = !!apiKey;

  let status: AzureDocumentExtractorConfigStatus;
  let source: AzureDocumentExtractorConfigSource;

  if (hasEndpoint && hasApiKey) {
    status = 'configured';
    if (endpointSource === 'override' || keySource === 'override') {
      source = 'override';
    } else if (endpointSource === 'canonical' && keySource === 'canonical') {
      source = 'canonical';
    } else if (endpointSource === 'legacy' && keySource === 'legacy') {
      source = 'legacy';
    } else {
      source = 'mixed';
    }
  } else if (!hasEndpoint && !hasApiKey) {
    status = 'unconfigured';
    source = 'none';
  } else {
    status = 'partially_configured';
    source = 'partial';
  }

  const isConfigured = status === 'configured';

  const summary: AzureDocumentExtractorConfigSummary = {
    status,
    isConfigured,
    hasEndpoint,
    hasApiKey,
    source,
    apiVersion,
    modelId,
  };

  return {
    endpoint,
    apiKey,
    apiVersion,
    modelId,
    status,
    isConfigured,
    source,
    summary,
  };
}

/**
 * Returns a safe, non-secret summary of the active Azure Document Intelligence configuration status.
 * Safe for logging, telemetry, or diagnostic checks.
 *
 * @param env Environment map (defaults to process.env)
 * @returns Non-secret configuration summary
 */
export function getAzureDocumentExtractorConfigStatus(
  env: NodeJS.ProcessEnv = process.env
): AzureDocumentExtractorConfigSummary {
  return resolveAzureDocumentExtractorConfig(env).summary;
}
