import { DocumentCategory, PublicUploadInvitationStatus } from '@prisma/client';

export interface CreatePublicUploadInvitationDTO {
  recipientEmail: string;
  recipientName?: string;
  documentCategory: DocumentCategory;
  targetEntityType: string;
  targetEntityId: string;
  expiresInHours?: number;
  maxUploadAttempts?: number;
}

export interface RevokePublicUploadInvitationDTO {
  invitationId: string;
  reason?: string;
}

export interface PublicUploadInvitationCreatedDTO {
  id: string;
  tenantId: string;
  /**
   * Raw opaque security token.
   * STRICT SECURITY CONTRACT: Returned exactly ONCE at invitation creation time.
   * Never persisted in the database; only SHA-256(rawToken) is stored.
   */
  rawToken: string;
  recipientEmail: string;
  recipientName?: string | null;
  documentCategory: DocumentCategory;
  targetEntityType: string;
  targetEntityId: string;
  status: PublicUploadInvitationStatus;
  expiresAt: string;
  maxUploadAttempts: number;
  uploadAttempts: number;
  createdAt: string;
}

export interface PublicUploadInvitationDTO {
  id: string;
  tenantId: string;
  recipientEmail: string;
  recipientName?: string | null;
  documentCategory: DocumentCategory;
  targetEntityType: string;
  targetEntityId: string;
  status: PublicUploadInvitationStatus;
  documentId?: string | null;
  createdByUserId: string;
  expiresAt: string;
  consumedAt?: string | null;
  maxUploadAttempts: number;
  uploadAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export type PublicInvitationErrorCode =
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'EXPIRED'
  | 'ALREADY_SUBMITTED'
  | 'MAX_ATTEMPTS_EXCEEDED';

export interface PublicUploadInvitationSummaryDTO {
  id: string;
  recipientName?: string | null;
  documentCategory: DocumentCategory;
  status: PublicUploadInvitationStatus;
  expiresAt: string;
  maxUploadAttempts: number;
  uploadAttempts: number;
}

export interface ValidatePublicUploadInvitationResult {
  isValid: boolean;
  errorCode?: PublicInvitationErrorCode;
  errorMessage?: string;
  invitation?: PublicUploadInvitationSummaryDTO;
}

export interface SubmitPublicDocumentUploadDTO {
  rawToken: string;
  fileName: string;
  fileBuffer?: Buffer | Uint8Array;
  fileBase64?: string;
  mimeType?: string;
}

export interface PublicUploadSubmittedDTO {
  invitationId: string;
  documentId: string;
  documentVersionId: string;
  processingJobId?: string;
  documentCategory: DocumentCategory;
  fileName: string;
  fileSize: number;
  checksumSha256: string;
  status: PublicUploadInvitationStatus;
  consumedAt: string;
}
