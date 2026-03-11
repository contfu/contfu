import { createLogger } from "@contfu/svc-backend/infra/logger/index";

const log = createLogger("connection-auth");

/**
 * Hash an API key string for secure storage and lookup.
 * Uses SHA-256 — deterministic, so the hash can be used as a DB lookup key.
 */
export function hashApiKey(keyString: string): Buffer {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(keyString);
  return Buffer.from(hasher.digest());
}

/**
 * Shared connection key authentication for /api/sync.
 * Extracts the key string, validates format, and returns its SHA-256 hash for DB lookup.
 */
export function extractConnectionKey(
  url: URL,
  request: Request,
): { key: Buffer; keyString: string } | { error: Response } {
  let keyString = url.searchParams.get("key");
  if (!keyString) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      keyString = authHeader.slice(7);
    }
  }

  if (!keyString) {
    log.warn("Auth rejected: missing key");
    return { error: new Response("Missing authentication key", { status: 401 }) };
  }

  if (keyString.length < 20) {
    log.warn({ keyLength: keyString.length }, "Auth rejected: key too short");
    return { error: new Response("Invalid key format", { status: 401 }) };
  }

  const key = hashApiKey(keyString);
  log.debug(
    { keyLength: keyString.length, hashPrefix: key.toString("hex").slice(0, 8) },
    "Connection key extracted",
  );
  return { key, keyString };
}
