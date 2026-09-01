import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { DocumentProcessingWorker } from '@/platform/services/document-processing-worker';
import {
  IDocumentProcessingWorker,
  DocumentProcessingRuntimeResult,
} from '@/platform/types/document-processing';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts and verifies authorization token from request headers.
 * Supports:
 * - Authorization: Bearer <secret>
 * - x-internal-key: <secret>
 * - x-worker-secret: <secret>
 * - x-cron-secret: <secret>
 */
function verifyTriggerAuthorization(request: NextRequest, configuredSecret?: string): boolean {
  const effectiveSecret =
    configuredSecret ||
    process.env.WORKER_SECRET ||
    process.env.CRON_SECRET ||
    process.env.INTERNAL_WORKER_KEY ||
    process.env.AUTH_SECRET;

  if (!effectiveSecret || effectiveSecret.trim().length === 0) {
    // Fail-closed when no authorization secret is configured
    return false;
  }

  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.trim().split(' ');
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
      const bearerToken = parts[1];
      if (bearerToken && timingSafeEqual(bearerToken, effectiveSecret)) {
        return true;
      }
    }
  }

  // 2. Check custom internal headers
  const internalKey =
    request.headers.get('x-internal-key') ||
    request.headers.get('x-worker-secret') ||
    request.headers.get('x-cron-secret');

  if (internalKey && typeof internalKey === 'string') {
    if (timingSafeEqual(internalKey.trim(), effectiveSecret)) {
      return true;
    }
  }

  return false;
}

/**
 * Canonical handler for document processing runtime trigger (Phase 5E.2-E).
 *
 * Provides protected, bounded execution of queued document processing jobs.
 */
export async function handleDocumentProcessingTrigger(
  request: NextRequest,
  options?: {
    worker?: IDocumentProcessingWorker;
    secret?: string;
  }
): Promise<Response> {
  try {
    // 1. Verify Authorization (Fail-Closed)
    const isAuthorized = verifyTriggerAuthorization(request, options?.secret);
    if (!isAuthorized) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Akses ditolak: Kredensial runtime trigger tidak valid atau belum terkonfigurasi.',
          },
        },
        { status: 401 }
      );
    }

    // 2. Extract and validate parameters (from body if JSON or query params)
    let requestedLimit: number | undefined;
    let tenantId: string | undefined;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        if (body && typeof body === 'object') {
          if (body.limit !== undefined) {
            if (typeof body.limit !== 'number' || !Number.isInteger(body.limit) || body.limit < 1) {
              return Response.json(
                {
                  success: false,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Parameter limit harus berupa bilangan bulat positif.',
                  },
                },
                { status: 400 }
              );
            }
            requestedLimit = body.limit;
          }

          if (body.tenantId !== undefined) {
            if (!isValidUuid(body.tenantId)) {
              return Response.json(
                {
                  success: false,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Parameter tenantId bukan merupakan format UUID yang sah.',
                  },
                },
                { status: 400 }
              );
            }
            tenantId = body.tenantId;
          }
        }
      } catch {
        return Response.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Format payload JSON tidak valid.',
            },
          },
          { status: 400 }
        );
      }
    }

    // Also support query parameters (useful for GET or standard cron invocations)
    if (requestedLimit === undefined && request.nextUrl.searchParams.has('limit')) {
      const parsed = parseInt(request.nextUrl.searchParams.get('limit')!, 10);
      if (isNaN(parsed) || parsed < 1) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parameter limit harus berupa bilangan bulat positif.',
            },
          },
          { status: 400 }
        );
      }
      requestedLimit = parsed;
    }

    if (tenantId === undefined && request.nextUrl.searchParams.has('tenantId')) {
      const qTenantId = request.nextUrl.searchParams.get('tenantId')!;
      if (!isValidUuid(qTenantId)) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parameter tenantId bukan merupakan format UUID yang sah.',
            },
          },
          { status: 400 }
        );
      }
      tenantId = qTenantId;
    }

    // 3. Bound limit to canonical range [1, 50] (default 10)
    const effectiveLimit = Math.max(1, Math.min(requestedLimit ?? 10, 50));

    // 4. Invoke Worker
    const worker = options?.worker || new DocumentProcessingWorker();
    const results = await worker.processBatch({
      tenantId,
      limit: effectiveLimit,
    });

    const jobsProcessed = results.length;
    const hasMore = jobsProcessed >= effectiveLimit;

    const runtimeResult: DocumentProcessingRuntimeResult = {
      jobsProcessed,
      hasMore,
      results,
    };

    // 5. Return explicit execution result
    return Response.json(
      {
        success: true,
        data: runtimeResult,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[Document Processing Runtime Trigger Exception]:', error);
    return Response.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan internal pada runtime trigger pemrosesan dokumen.',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  options?: {
    worker?: IDocumentProcessingWorker;
    secret?: string;
  }
) {
  return handleDocumentProcessingTrigger(request, options);
}

export async function GET(
  request: NextRequest,
  options?: {
    worker?: IDocumentProcessingWorker;
    secret?: string;
  }
) {
  return handleDocumentProcessingTrigger(request, options);
}
