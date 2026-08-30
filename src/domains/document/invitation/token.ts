import crypto from 'crypto';

/**
 * Generates a 256-bit cryptographically secure opaque token for public upload invitations.
 * Format: 32 bytes encoded as base64url.
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Authoritative SHA-256 hash generator for public upload invitation tokens.
 * Computes deterministic lowercase 64-character hex digest of the raw token.
 * Only the hash is persisted in PostgreSQL; the raw token is never stored.
 */
export function hashInvitationToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new Error('Validation Error: Token tidak boleh kosong.');
  }
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}
