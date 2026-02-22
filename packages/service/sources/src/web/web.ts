import { WebAuthType, type WebAuthType as WebAuthTypeValue } from "@contfu/svc-core";

export { WebAuthType };

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
