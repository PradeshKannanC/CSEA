import crypto from 'node:crypto';

const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password using scrypt with a cryptographically secure random salt.
 * Formatted as: `salt:hash`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` using constant-time comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    if (!salt || !originalHash) return false;

    const hashBuffer = Buffer.from(originalHash, 'hex');
    const verifyBuffer = crypto.scryptSync(password, salt, KEY_LENGTH);

    if (hashBuffer.length !== verifyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, verifyBuffer);
  } catch {
    return false;
  }
}
