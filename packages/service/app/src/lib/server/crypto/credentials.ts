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
 */
async function getKey(userId: string): Promise<Buffer> {
  const cached = keyCache.get(userId);
  if (cached) return cached;

  const key = await deriveKey(getAppSecret(), userId);
  keyCache.set(userId, key);
  return key;
}

/**
 * Encrypt credentials for storage.
 * Returns null if input is null/undefined.
 */
export async function encryptCredentials(
  userId: string,
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
  userId: string,
  encryptedCredentials: Buffer | null | undefined,
): Promise<Buffer | null> {
  if (!encryptedCredentials || encryptedCredentials.length === 0) return null;
  const key = await getKey(userId);
  return decrypt(encryptedCredentials, key);
}

/**
 * Clear the key cache for a user (e.g., on logout or key rotation).
 */
export function clearKeyCache(userId?: string): void {
  if (userId) {
    keyCache.delete(userId);
  } else {
    keyCache.clear();
  }
}
