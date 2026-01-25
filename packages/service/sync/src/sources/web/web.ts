/** Authentication types for web sources. */
export const WebAuthType = {
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
} as const;

/** Type representing valid WebAuthType values. */
export type WebAuthTypeValue = (typeof WebAuthType)[keyof typeof WebAuthType];

/** Options for fetching content from a web source. */
export type WebFetchOpts = {
  collection: number;
  /** Relative URLs to fetch, stored as newline-separated in Buffer */
  ref: Buffer;
  /** Base URL of the website */
  url: string;
  /** Auth credentials (Bearer token or Base64-encoded Basic auth) */
  credentials?: Buffer;
  /** Authentication type (0=none, 1=bearer, 2=basic) */
  authType?: WebAuthTypeValue;
  /** Fetch items modified since this timestamp (exclusive) */
  since?: number;
};
