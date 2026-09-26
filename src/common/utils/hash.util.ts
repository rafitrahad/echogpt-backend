import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** SHA-256 fingerprint as hex (64 chars). For tokens and cache keys, NOT passwords. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Cryptographically secure random token, URL-safe (for email verification links) */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Compares two strings in constant time (prevents timing attacks) */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}