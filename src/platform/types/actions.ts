/**
 * Canonical Action DTO Contracts
 * Shared response and error specifications for Server Actions across all domains.
 */

export type ActionErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'DOMAIN_ERROR'
  | 'INTERNAL_ERROR';

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  details?: unknown;
}

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: ActionError;
}
