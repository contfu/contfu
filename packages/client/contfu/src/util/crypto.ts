import { createHash } from "crypto";

export function hashId(str: string): string {
  const digest = createHash("sha1").update(str).digest();
  // Keep 128-bit identifiers, encoded as URL-safe base64.
  return digest.subarray(0, 16).toString("base64url");
}
