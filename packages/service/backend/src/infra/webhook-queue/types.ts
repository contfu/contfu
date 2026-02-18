import { SourceType } from "@contfu/svc-core";

export interface WebhookFetchJob {
  userId: number;
  sourceId: number;
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
export const WEB_RATE_LIMIT: RateLimitConfig | null = null;

export function getRateLimitForSourceType(sourceType: number): RateLimitConfig | null {
  if (sourceType === SourceType.NOTION) return NOTION_RATE_LIMIT;
  if (sourceType === SourceType.STRAPI) return STRAPI_RATE_LIMIT;
  if (sourceType === SourceType.WEB) return WEB_RATE_LIMIT;
  return null;
}
