interface BaseSourcePullConfig {
  type: string;
  userId: number;
  sourceId: number;
  collectionId: number;
  since?: number;
}

export interface NotionPullConfig extends BaseSourcePullConfig {
  type: "notion";
  apiKey: Buffer;
  dbId: Buffer;
}

export interface StrapiPullConfig extends BaseSourcePullConfig {
  type: "strapi";
  apiToken: Buffer;
  url: string;
  contentType: Buffer;
}

export type PullConfig = NotionPullConfig | StrapiPullConfig;
/** Authentication types for web sources. */
export const WebAuthType = {
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
} as const;
/** Type representing valid WebAuthType values. */

export type WebAuthType = (typeof WebAuthType)[keyof typeof WebAuthType];

/**
 * Extract the web auth type from credentials buffer.
 * For web sources, the first byte is the auth type: 0=None, 1=Bearer, 2=Basic
 */
export function extractWebAuthType(credentials: Buffer | null): WebAuthType {
  if (!credentials || credentials.length === 0) return WebAuthType.NONE;
  return credentials[0] as WebAuthType;
}
