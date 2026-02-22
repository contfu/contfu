/** Authentication types for web sources. */
export const WebAuthType = {
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
};
/**
 * Extract the web auth type from credentials buffer.
 * For web sources, the first byte is the auth type: 0=None, 1=Bearer, 2=Basic
 */
export function extractWebAuthType(credentials) {
  if (!credentials || credentials.length === 0) return WebAuthType.NONE;
  return credentials[0];
}
