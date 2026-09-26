import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is the recommended IV size for GCM

/**
 * Encrypts text with AES-256-GCM.
 * Returns "iv:authTag:ciphertext" (all hex), the format stored in ai_providers.
 */
export function encrypt(plainText: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(IV_LENGTH); // new random IV every time

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // the tamper-proof seal

  return [iv, authTag, encrypted].map((part) => part.toString('hex')).join(':');
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the data was modified or the key is wrong.
 */
export function decrypt(payload: string, hexKey: string): string {
  const [ivHex, authTagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted payload format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(hexKey, 'hex'),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(), // throws here if the seal is broken
  ]);
  return decrypted.toString('utf8');
}