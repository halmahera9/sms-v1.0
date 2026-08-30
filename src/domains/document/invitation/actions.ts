import 'server-only';
import { randomUUID } from 'crypto';
import { PrismaClient, PublicUploadInvitationStatus, DocumentCategory } from '@prisma/client';
import {
  executeInAuthenticatedContext,
  assertAuthorizedAction,
  AuthenticationError,
  AuthorizationError,
} from '@/platform/auth';
import { PostgresAuditEventRepository } from '@/platform/repositories/audit-event';
import { ActionResponse } from '@/platform/types/actions';
import { adminPrisma } from '@/platform/db/prisma';
import { generateInvitationToken, hashInvitationToken } from './token';
import {
  CreatePublicUploadInvitationDTO,
  RevokePublicUploadInvitationDTO,
  PublicUploadInvitationCreatedDTO,
  PublicUploadInvitationDTO,
  ValidatePublicUploadInvitationResult,
} from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUuid(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

const auditRepo = new PostgresAuditEventRepository();

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
    const msg = err.message;
    if (
      msg.startsWith('Validation Error:') ||
      msg.toLowerCase().includes('wajib') ||
      msg.toLowerCase().includes('tidak valid')
    ) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: msg,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'DOMAIN_ERROR',
        message: msg,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada sistem undangan upload.',
    },
  };
}

/**
 * Server Action: Create Public Upload Invitation
 * Authenticated staff issues a token-scoped public document upload invitation.
 * Stores ONLY SHA-256(rawToken); returns rawToken strictly once to caller.
 */
export async function createPublicUploadInvitationAction(
  dto: CreatePublicUploadInvitationDTO
): Promise<ActionResponse<PublicUploadInvitationCreatedDTO>> {
  try {
    if (!dto || typeof dto !== 'object') {
      throw new Error('Validation Error: Payload undangan upload wajib diisi.');
    }

    if (!dto.recipientEmail || !EMAIL_REGEX.test(dto.recipientEmail.trim())) {
      throw new Error('Validation Error: Format email penerima tidak valid.');
    }

    if (!dto.documentCategory || !Object.values(DocumentCategory).includes(dto.documentCategory)) {
      throw new Error('Validation Error: Kategori dokumen tidak valid.');
    }

    if (!dto.targetEntityType || dto.targetEntityType.trim().length === 0) {
      throw new Error('Validation Error: Target entity type wajib diisi.');
    }

    if (!dto.targetEntityId || !isValidUuid(dto.targetEntityId)) {
      throw new Error('Validation Error: Target entity ID bukan UUID yang valid.');
    }

    const expiresInHours = dto.expiresInHours && dto.expiresInHours > 0 ? dto.expiresInHours : 168; // Default 7 days
    const maxUploadAttempts = dto.maxUploadAttempts && dto.maxUploadAttempts > 0 ? dto.maxUploadAttempts : 3;

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // 1. RBAC Check
      assertAuthorizedAction(context, 'PUBLIC_INVITATION_CREATE');

      const invitationId = randomUUID();
      const tenantId = context.tenantId;
      const rawToken = generateInvitationToken();
      const tokenHash = hashInvitationToken(rawToken);
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

      // 2. Persist in database under tenant RLS
      const created = await tx.publicUploadInvitation.create({
        data: {
          id: invitationId,
          tenantId,
          tokenHash,
          recipientEmail: dto.recipientEmail.trim().toLowerCase(),
          recipientName: dto.recipientName ? dto.recipientName.trim() : null,
          documentCategory: dto.documentCategory,
          targetEntityType: dto.targetEntityType.trim(),
          targetEntityId: dto.targetEntityId,
          status: PublicUploadInvitationStatus.PENDING,
          createdByUserId: context.actorId,
          expiresAt,
          maxUploadAttempts,
          uploadAttempts: 0,
        },
      });

      // 3. Record Audit Event
      await auditRepo.recordTx(tx, tenantId, {
        actorUserId: context.actorId,
        action: 'CREATE_PUBLIC_INVITATION',
        entityType: 'PublicUploadInvitation',
        entityId: created.id,
        metadata: {
          recipientEmail: created.recipientEmail,
          documentCategory: created.documentCategory,
          targetEntityType: created.targetEntityType,
          targetEntityId: created.targetEntityId,
          expiresAt: created.expiresAt.toISOString(),
        },
      });

      return {
        id: created.id,
        tenantId: created.tenantId,
        rawToken, // RETURNED STRICTLY ONCE
        recipientEmail: created.recipientEmail,
        recipientName: created.recipientName,
        documentCategory: created.documentCategory,
        targetEntityType: created.targetEntityType,
        targetEntityId: created.targetEntityId,
        status: created.status,
        expiresAt: created.expiresAt.toISOString(),
        maxUploadAttempts: created.maxUploadAttempts,
        uploadAttempts: created.uploadAttempts,
        createdAt: created.createdAt.toISOString(),
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<PublicUploadInvitationCreatedDTO>(err);
  }
}

/**
 * Server Action: Revoke Public Upload Invitation
 * Authenticated staff cancels an existing pending invitation.
 */
export async function revokePublicUploadInvitationAction(
  dto: RevokePublicUploadInvitationDTO
): Promise<ActionResponse<PublicUploadInvitationDTO>> {
  try {
    if (!dto || !dto.invitationId || !isValidUuid(dto.invitationId)) {
      throw new Error('Validation Error: invitationId bukan UUID yang valid.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      // 1. RBAC Check
      assertAuthorizedAction(context, 'PUBLIC_INVITATION_REVOKE');

      const tenantId = context.tenantId;

      const existing = await tx.publicUploadInvitation.findFirst({
        where: {
          id: dto.invitationId,
          tenantId,
        },
      });

      if (!existing) {
        throw new Error(`Validation Error: Undangan upload dengan ID '${dto.invitationId}' tidak ditemukan.`);
      }

      if (existing.status !== PublicUploadInvitationStatus.PENDING) {
        throw new Error(`Validation Error: Undangan dengan status '${existing.status}' tidak dapat dicabut.`);
      }

      const updated = await tx.publicUploadInvitation.update({
        where: { id: existing.id },
        data: {
          status: PublicUploadInvitationStatus.REVOKED,
        },
      });

      // Record Audit Event
      await auditRepo.recordTx(tx, tenantId, {
        actorUserId: context.actorId,
        action: 'REVOKE_PUBLIC_INVITATION',
        entityType: 'PublicUploadInvitation',
        entityId: updated.id,
        metadata: {
          reason: dto.reason || 'Dibatalkan oleh operator',
          previousStatus: existing.status,
        },
      });

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        recipientEmail: updated.recipientEmail,
        recipientName: updated.recipientName,
        documentCategory: updated.documentCategory,
        targetEntityType: updated.targetEntityType,
        targetEntityId: updated.targetEntityId,
        status: updated.status,
        documentId: updated.documentId,
        createdByUserId: updated.createdByUserId,
        expiresAt: updated.expiresAt.toISOString(),
        consumedAt: updated.consumedAt ? updated.consumedAt.toISOString() : null,
        maxUploadAttempts: updated.maxUploadAttempts,
        uploadAttempts: updated.uploadAttempts,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<PublicUploadInvitationDTO>(err);
  }
}

/**
 * Server Action: Get Public Upload Invitation by ID
 * Authenticated read of an invitation record.
 * Raw token and tokenHash are never exposed.
 */
export async function getPublicUploadInvitationAction(
  invitationId: string
): Promise<ActionResponse<PublicUploadInvitationDTO>> {
  try {
    if (!invitationId || !isValidUuid(invitationId)) {
      throw new Error('Validation Error: invitationId bukan UUID yang valid.');
    }

    const result = await executeInAuthenticatedContext(async (context, tx) => {
      assertAuthorizedAction(context, 'PUBLIC_INVITATION_READ');

      const invitation = await tx.publicUploadInvitation.findFirst({
        where: {
          id: invitationId,
          tenantId: context.tenantId,
        },
      });

      if (!invitation) {
        throw new Error(`Validation Error: Undangan upload dengan ID '${invitationId}' tidak ditemukan.`);
      }

      return {
        id: invitation.id,
        tenantId: invitation.tenantId,
        recipientEmail: invitation.recipientEmail,
        recipientName: invitation.recipientName,
        documentCategory: invitation.documentCategory,
        targetEntityType: invitation.targetEntityType,
        targetEntityId: invitation.targetEntityId,
        status: invitation.status,
        documentId: invitation.documentId,
        createdByUserId: invitation.createdByUserId,
        expiresAt: invitation.expiresAt.toISOString(),
        consumedAt: invitation.consumedAt ? invitation.consumedAt.toISOString() : null,
        maxUploadAttempts: invitation.maxUploadAttempts,
        uploadAttempts: invitation.uploadAttempts,
        createdAt: invitation.createdAt.toISOString(),
        updatedAt: invitation.updatedAt.toISOString(),
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleActionError<PublicUploadInvitationDTO>(err);
  }
}

/**
 * Public Token Lookup & Validation Utility
 * Validates a raw public invitation token and enforces all security constraints fail-closed.
 * Can be used by public unauthenticated endpoints (Phase 5B preflight).
 * Strictly uses the dedicated server-only privileged adminPrisma client for single-point token lookup.
 */
export async function validatePublicUploadInvitationToken(
  rawToken: string
): Promise<ValidatePublicUploadInvitationResult> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return {
      isValid: false,
      errorCode: 'NOT_FOUND',
      errorMessage: 'Token undangan upload tidak valid.',
    };
  }

  const tokenHash = hashInvitationToken(rawToken);

  const invitation = await adminPrisma.publicUploadInvitation.findUnique({
    where: { tokenHash },
  });

  if (!invitation) {
    return {
      isValid: false,
      errorCode: 'NOT_FOUND',
      errorMessage: 'Undangan upload tidak ditemukan atau token tidak valid.',
    };
  }

  if (invitation.status === PublicUploadInvitationStatus.REVOKED) {
    return {
      isValid: false,
      errorCode: 'REVOKED',
      errorMessage: 'Undangan upload telah dicabut oleh administrator.',
    };
  }

  if (invitation.status === PublicUploadInvitationStatus.SUBMITTED) {
    return {
      isValid: false,
      errorCode: 'ALREADY_SUBMITTED',
      errorMessage: 'Undangan upload telah digunakan sebelumnya.',
    };
  }

  const now = new Date();
  if (invitation.status === PublicUploadInvitationStatus.EXPIRED || now > invitation.expiresAt) {
    return {
      isValid: false,
      errorCode: 'EXPIRED',
      errorMessage: 'Undangan upload telah kedaluwarsa.',
    };
  }

  if (invitation.uploadAttempts >= invitation.maxUploadAttempts) {
    return {
      isValid: false,
      errorCode: 'MAX_ATTEMPTS_EXCEEDED',
      errorMessage: 'Batas maksimum percobaan upload telah tercapai.',
    };
  }

  return {
    isValid: true,
    invitation: {
      id: invitation.id,
      recipientName: invitation.recipientName,
      documentCategory: invitation.documentCategory,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      maxUploadAttempts: invitation.maxUploadAttempts,
      uploadAttempts: invitation.uploadAttempts,
    },
  };
}
