import crypto from "node:crypto";
import { describe, expect, it } from "bun:test";
import { validateWebhookSignature } from "./webhook-signature";

function sign(body: string, secret: string, algorithm = "sha256"): string {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(body);
  return `${algorithm}=${hmac.digest("hex")}`;
}

describe("validateWebhookSignature", () => {
  const secret = "secret_test123";
  const body = '{"type":"page.created","entity":{"id":"abc"}}';

  it("should accept a valid sha256 signature", () => {
    const header = sign(body, secret, "sha256");
    expect(validateWebhookSignature(body, header, secret)).toBe(true);
  });

  it("should accept a valid sha512 signature", () => {
    const header = sign(body, secret, "sha512");
    expect(validateWebhookSignature(body, header, secret)).toBe(true);
  });

  it("should reject a signature with wrong secret", () => {
    const header = sign(body, "wrong-secret", "sha256");
    expect(validateWebhookSignature(body, header, secret)).toBe(false);
  });

  it("should reject a signature with tampered body", () => {
    const header = sign(body, secret, "sha256");
    expect(validateWebhookSignature(body + "x", header, secret)).toBe(false);
  });

  it("should reject a null signature header", () => {
    expect(validateWebhookSignature(body, null, secret)).toBe(false);
  });

  it("should reject a signature header without algorithm prefix", () => {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(body);
    const rawHex = hmac.digest("hex");
    expect(validateWebhookSignature(body, rawHex, secret)).toBe(false);
  });

  it("should reject a truncated hex digest", () => {
    const header = sign(body, secret, "sha256");
    expect(validateWebhookSignature(body, header.slice(0, -4), secret)).toBe(false);
  });
});
