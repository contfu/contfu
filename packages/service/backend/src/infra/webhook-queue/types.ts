import { ConnectionType } from "@contfu/core";

export interface WebhookFetchJob {
  userId: number;
  connectionId: number;
  pageId: string;
  eventType: string;
  parentDatabaseId?: string;
  enqueuedAt: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const NOTION_RATE_LIMIT: RateLimitConfig = {
  windowMs: 1000,
  maxRequests: 3,
};

/**
 * Strapi does not define a fixed upstream API rate limit by default.
 * Keep throttling disabled unless a source-specific limit is introduced.
 */
export const STRAPI_RATE_LIMIT: RateLimitConfig | null = null;

/**
 * Contentful has generous API rate limits (approx 10 requests/second).
 * Use null to disable throttling.
 */
export const CONTENTFUL_RATE_LIMIT: RateLimitConfig | null = null;
export const WEB_RATE_LIMIT: RateLimitConfig | null = null;

export function getRateLimitForConnectionType(sourceType: ConnectionType): RateLimitConfig | null {
  if (sourceType === ConnectionType.NOTION) return NOTION_RATE_LIMIT;
  if (sourceType === ConnectionType.STRAPI) return STRAPI_RATE_LIMIT;
  if (sourceType === ConnectionType.CONTENTFUL) return CONTENTFUL_RATE_LIMIT;
  if (sourceType === ConnectionType.WEB) return WEB_RATE_LIMIT;
  return null;
}
