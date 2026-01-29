import { createCipheriv, createDecipheriv, hkdf, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a per-user encryption key from the application secret and user ID.
 * Uses HKDF with SHA-256.
 */
export function deriveKey(appSecret: string, userId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    hkdf(
      "sha256",
      appSecret,
      userId, // salt = userId for per-user isolation
      "contfu-credentials-v1", // info/context
      KEY_LENGTH,
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(Buffer.from(derivedKey));
      },
    );
  });
}

/**
 * Encrypts data using AES-256-GCM.
 * Returns: IV (12 bytes) + ciphertext + authTag (16 bytes)
 */
export function encrypt(data: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: IV + ciphertext + authTag
  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypts data encrypted with encrypt().
 * Expects: IV (12 bytes) + ciphertext + authTag (16 bytes)
 */
export function decrypt(encryptedData: Buffer, key: Buffer): Buffer {
  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(-AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH, -AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypts a string, returning a Buffer.
 */
export function encryptString(data: string, key: Buffer): Buffer {
  return encrypt(Buffer.from(data, "utf8"), key);
}

/**
 * Decrypts to a string.
 */
export function decryptString(encryptedData: Buffer, key: Buffer): string {
  return decrypt(encryptedData, key).toString("utf8");
}
