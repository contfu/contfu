import crypto from "node:crypto";

/**
 * Validate a webhook signature in the format "algorithm=hex_digest"
 * (e.g. "sha256=abc123...") against a request body and secret.
 */
export function validateWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const eqIdx = signatureHeader.indexOf("=");
  if (eqIdx === -1) return false;
  const algorithm = signatureHeader.slice(0, eqIdx);
  const receivedHex = signatureHeader.slice(eqIdx + 1);

  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(body);
  const expectedHex = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
  } catch {
    return false;
  }
}
