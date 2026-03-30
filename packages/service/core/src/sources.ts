/** Authentication types for web sources. */
export const WebAuthType = {
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
} as const;
/** Type representing valid WebAuthType values. */

export type WebAuthType = (typeof WebAuthType)[keyof typeof WebAuthType];
