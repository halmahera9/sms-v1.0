'use server';

import {
  AwardProposal,
  ProposalDocument,
  VerificationStatus,
  ImportAwardProposalsInput,
  ImportAwardProposalsResult,
} from './types';
import { AwardProposalApplicationService } from './service';
import { getAuthenticatedSession, AuthenticationError } from '@/platform/auth/session';
import { assertAuthorizedAction, AuthorizationError } from '@/platform/auth/guards';

export type ActionErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DOMAIN_ERROR'
  | 'INTERNAL_ERROR';

export interface ActionError {
  code: ActionErrorCode;
  message: string;
}

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: ActionError;
}

export interface UploadProposalDocumentDTO {
  proposalId: string;
  requirementCode: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl?: string;
}

export interface VerifyProposalDocumentDTO {
  proposalId: string;
  requirementCode: string;
  status: VerificationStatus;
  notes?: string;
}

export interface ApproveProposalGenerationDTO {
  proposalId: string;
}

export interface BatchMarkGeneratedDTO {
  proposalIds: string[];
}

export interface SignProposalDTO {
  proposalId: string;
}

/**
 * Sanitizes and maps server-side errors to client-safe ActionResponse structures.
 * Internal database errors and raw stack traces are logged server-side and masked from clients.
 */
function handleActionError<T>(err: unknown): ActionResponse<T> {
  if (err instanceof AuthenticationError) {
    return {
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: err.message,
      },
    };
  }

  if (err instanceof AuthorizationError) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message,
      },
    };
  }

  if (err instanceof Error) {
    // Check for validation errors
    if (err.message.startsWith('Validation Error:') || err.message.startsWith('VALIDATION_ERROR:')) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }

    // Check for domain / workflow guard errors / identity collisions
    if (
      err.message.startsWith('Workflow transition failed:') ||
      err.message.startsWith('AwardProposal not found') ||
      err.message.startsWith('IDENTITY_COLLISION:')
    ) {
      return {
        success: false,
        error: {
          code: 'DOMAIN_ERROR',
          message: err.message,
        },
      };
    }

    // Security errors from RLS triggers
    if (err.message.startsWith('SECURITY ERROR:')) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak oleh kebijakan keamanan data.',
        },
      };
    }
  }

  // Sanitize internal database / unhandled errors
  console.error('[Action Internal Error]:', err);
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem.',
    },
  };
}

/**
 * Server Action: Upload Proposal Document
 * Enforces AuthN + AuthZ (UPLOAD_DOCUMENT) ➔ delegates to application service.
 */
export async function uploadProposalDocumentAction(
  dto: UploadProposalDocumentDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy
    assertAuthorizedAction(session, 'UPLOAD_DOCUMENT');

    // 3. Validate Input DTO
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }
    if (!dto.requirementCode || typeof dto.requirementCode !== 'string') {
      throw new Error('Validation Error: requirementCode is required and must be a string.');
    }

    // 4. Construct trusted domain document payload
    const document: ProposalDocument = {
      id: `doc-${Date.now()}-${dto.requirementCode}`,
      proposalId: dto.proposalId,
      requirementCode: dto.requirementCode,
      fileName: dto.fileName || `${dto.requirementCode}.pdf`,
      fileSize: dto.fileSize || 1024 * 100,
      fileType: dto.fileType || 'application/pdf',
      fileUrl: dto.fileUrl || '#',
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'pending',
    };

    // 5. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const updatedProposal = await service.uploadDocumentInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId,
      document
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Verify Proposal Document
 * Enforces AuthN + AuthZ (VERIFY_DOCUMENT) ➔ delegates to application service.
 */
export async function verifyProposalDocumentAction(
  dto: VerifyProposalDocumentDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only SUPER_ADMIN, ADMIN_TENANT, VERIFIKATOR)
    assertAuthorizedAction(session, 'VERIFY_DOCUMENT');

    // 3. Validate Input DTO
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }
    if (!dto.requirementCode || typeof dto.requirementCode !== 'string') {
      throw new Error('Validation Error: requirementCode is required and must be a string.');
    }
    if (!dto.status || (dto.status !== 'verified' && dto.status !== 'rejected' && dto.status !== 'pending')) {
      throw new Error('Validation Error: status must be verified, rejected, or pending.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const updatedProposal = await service.verifyDocumentInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId,
      dto.requirementCode,
      dto.status,
      dto.notes
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Approve Proposal Generation
 * Enforces AuthN + AuthZ (APPROVE_GENERATION) ➔ triggers formal workflow transition with authoritative guard.
 */
export async function approveProposalGenerationAction(
  dto: ApproveProposalGenerationDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only SUPER_ADMIN, ADMIN_TENANT, VERIFIKATOR)
    assertAuthorizedAction(session, 'APPROVE_GENERATION');

    // 3. Validate Input DTO
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const approvedProposal = await service.approveGenerationInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(approvedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Batch Mark Generated
 * Enforces AuthN + AuthZ (MARK_GENERATED) ➔ triggers MARK_GENERATED for each proposal via workflow engine.
 */
export async function batchMarkGeneratedAction(
  dto: BatchMarkGeneratedDTO
): Promise<ActionResponse<AwardProposal[]>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy
    assertAuthorizedAction(session, 'MARK_GENERATED');

    // 3. Validate Input DTO
    if (!dto.proposalIds || !Array.isArray(dto.proposalIds) || dto.proposalIds.length === 0) {
      throw new Error('Validation Error: proposalIds must be a non-empty array of strings.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const updatedProposals = await service.batchMarkGeneratedInContext(
      session.actorId,
      session.tenantId,
      dto.proposalIds
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updatedProposals)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Sign Proposal
 * Enforces AuthN + AuthZ (SIGN_PROPOSAL) ➔ triggers formal workflow transition SIGN (GENERATED -> DITANDATANGANI).
 */
export async function signProposalAction(
  dto: SignProposalDTO
): Promise<ActionResponse<AwardProposal>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only ADMIN, VERIFIKATOR)
    assertAuthorizedAction(session, 'SIGN_PROPOSAL');

    // 3. Validate Input DTO
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!dto.proposalId || typeof dto.proposalId !== 'string') {
      throw new Error('Validation Error: proposalId is required and must be a string.');
    }

    // 4. Execute in authenticated tenant context
    const service = new AwardProposalApplicationService();
    const signedProposal = await service.signProposalInContext(
      session.actorId,
      session.tenantId,
      dto.proposalId
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(signedProposal)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Get Award Proposals
 * Resolves authenticated session server-side and retrieves all award proposals under tenant RLS boundary.
 */
export async function getAwardProposalsAction(): Promise<ActionResponse<AwardProposal[]>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Execute read in authenticated tenant context via application service
    const service = new AwardProposalApplicationService();
    const proposals = await service.getAllInContext(session.actorId, session.tenantId);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(proposals)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}

/**
 * Server Action: Import Award Proposals from Excel Dataset
 * Resolves authenticated session server-side, verifies IMPORT_PROPOSALS RBAC policy,
 * and delegates factual items array to AwardProposalApplicationService.
 */
export async function importAwardProposalsAction(
  input: ImportAwardProposalsInput
): Promise<ActionResponse<ImportAwardProposalsResult>> {
  try {
    // 1. Authenticate Actor Session (Fail-Closed)
    const session = await getAuthenticatedSession();

    // 2. Authorize RBAC Policy (Only ADMIN, VERIFIKATOR, OPERATOR)
    assertAuthorizedAction(session, 'IMPORT_PROPOSALS');

    // 3. Validate Inbound Boundary
    if (!input || typeof input !== 'object') {
      throw new Error('Validation Error: Input must be a valid object.');
    }
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Validation Error: items must be a non-empty array of proposal data.');
    }

    // 4. Execute in authenticated tenant context via application service
    const service = new AwardProposalApplicationService();
    const result = await service.importProposalsInContext(
      session.actorId,
      session.tenantId,
      input.items
    );

    return {
      success: true,
      data: JSON.parse(JSON.stringify(result)),
    };
  } catch (err: unknown) {
    return handleActionError(err);
  }
}
