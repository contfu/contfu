import { WebAuthType } from "@contfu/svc-core";

/**
 * Extract the web auth type from credentials buffer.
 * For web sources, the first byte is the auth type: 0=None, 1=Bearer, 2=Basic
 */
export function extractWebAuthType(credentials: Buffer | null): WebAuthType {
  if (!credentials || credentials.length === 0) return WebAuthType.NONE;
  return credentials[0] as WebAuthType;
}
