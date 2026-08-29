import 'server-only';
import { createHash } from 'crypto';

/**
 * Calculates canonical lowercase 64-character hexadecimal SHA-256 digest of binary content.
 *
 * @param content Raw binary Buffer or Uint8Array.
 * @returns Lowercase 64-character hexadecimal SHA-256 checksum string.
 */
export function calculateSha256(content: Buffer | Uint8Array): string {
  if (!content || !(Buffer.isBuffer(content) || content instanceof Uint8Array)) {
    throw new Error('Storage Integrity Error: Content must be a valid Buffer or Uint8Array.');
  }
  return createHash('sha256').update(content).digest('hex').toLowerCase();
}
