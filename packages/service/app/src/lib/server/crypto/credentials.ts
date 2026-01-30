import { decrypt, deriveKey, encrypt } from "./encryption";

/**
 * Get the application secret for key derivation.
 * Falls back to a default in development, but requires a real secret in production.
 */
function getAppSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BETTER_AUTH_SECRET is required in production");
    }
    // Development fallback - not secure, but allows local testing
    return "dev-secret-not-for-production";
  }
  return secret;
}

// Cache derived keys to avoid re-deriving on every operation
const keyCache = new Map<string, Buffer>();

/**
 * Get or derive the encryption key for a user.
 * Converts userId to string for backwards compatibility with existing encrypted data.
 */
async function getKey(userId: number): Promise<Buffer> {
  const key = String(userId);
  const cached = keyCache.get(key);
  if (cached) return cached;

  const derivedKey = await deriveKey(getAppSecret(), key);
  keyCache.set(key, derivedKey);
  return derivedKey;
}

/**
 * Encrypt credentials for storage.
 * Returns null if input is null/undefined.
 */
export async function encryptCredentials(
  userId: number,
  credentials: Buffer | null | undefined,
): Promise<Buffer | null> {
  if (!credentials || credentials.length === 0) return null;
  const key = await getKey(userId);
  return encrypt(credentials, key);
}

/**
 * Decrypt credentials from storage.
 * Returns null if input is null/undefined.
 */
export async function decryptCredentials(
  userId: number,
  encryptedCredentials: Buffer | null | undefined,
): Promise<Buffer | null> {
  if (!encryptedCredentials || encryptedCredentials.length === 0) return null;
  const key = await getKey(userId);
  return decrypt(encryptedCredentials, key);
}

/**
 * Clear the key cache for a user (e.g., on logout or key rotation).
 */
export function clearKeyCache(userId?: number): void {
  if (userId !== undefined) {
    keyCache.delete(String(userId));
  } else {
    keyCache.clear();
  }
}
