/**
 * Shared consumer key authentication for /api/sync.
 * Extracts and validates the consumer key from query params or Authorization header.
 */
export function extractConsumerKey(
  url: URL,
  request: Request,
): { key: Buffer } | { error: Response } {
  let keyString = url.searchParams.get("key");
  if (!keyString) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      keyString = authHeader.slice(7);
    }
  }

  if (!keyString) {
    return { error: new Response("Missing authentication key", { status: 401 }) };
  }

  try {
    let key = Buffer.from(keyString, "base64url");
    console.log("key", key, key.length);
    if (key.length !== 32) {
      return { error: new Response("Invalid key format", { status: 401 }) };
    }
    return { key };
  } catch {
    return { error: new Response("Invalid key encoding", { status: 401 }) };
  }
}
