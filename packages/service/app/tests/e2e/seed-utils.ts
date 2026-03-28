import crypto from "node:crypto";

/**
 * Hash an API key for storage in the credentials column.
 * Mirrors the hashApiKey function in connection-auth.ts.
 * The key is first base64url-encoded (matching how tests send it),
 * then SHA-256 hashed (matching how the server looks it up).
 */
export function hashKeyForStorage(rawKey: Buffer): Buffer {
  const keyString = rawKey.toString("base64url");
  return Buffer.from(crypto.createHash("sha256").update(keyString).digest());
}
