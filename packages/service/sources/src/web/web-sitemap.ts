import { WebAuthType } from "@contfu/svc-core";
import Sitemapper, { type SitemapperOptions, type SitemapperSiteData } from "sitemapper";
import { buildAuthHeader } from "./web-helpers";

/** Default timeout for sitemap requests in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30000;

/** Parsed sitemap entry with URL and optional metadata. */
export interface SitemapEntry {
  /** The URL of the page. */
  url: string;
  /** Last modification timestamp (Unix milliseconds) if available. */
  lastModified?: number;
  /** Change frequency if available. */
  changeFreq?: string;
  /** Priority if available. */
  priority?: number;
}

/** Result of parsing a sitemap. */
export interface SitemapResult {
  /** Whether the sitemap was successfully parsed. */
  success: boolean;
  /** List of entries found in the sitemap. */
  entries: SitemapEntry[];
  /** Error message if parsing failed. */
  error?: string;
  /** The URL that was fetched. */
  url: string;
}

/** Options for fetching a sitemap. */
export interface FetchSitemapOptions {
  /** Authentication type. */
  authType?: WebAuthType;
  /** Auth credentials (Bearer token or Base64-encoded Basic auth). */
  credentials?: Buffer;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/**
 * Parse lastmod string to Unix timestamp in milliseconds.
 * Handles ISO 8601 date formats commonly used in sitemaps.
 */
function parseLastMod(lastmod: string | undefined): number | undefined {
  if (!lastmod) return undefined;

  try {
    const date = new Date(lastmod);
    const timestamp = date.getTime();
    // Validate the parsed date
    if (Number.isNaN(timestamp)) return undefined;
    return timestamp;
  } catch {
    return undefined;
  }
}

/**
 * Parse priority string to number.
 */
function parsePriority(priority: string | undefined): number | undefined {
  if (!priority) return undefined;

  const parsed = Number.parseFloat(priority);
  if (Number.isNaN(parsed)) return undefined;

  // Priority should be between 0.0 and 1.0
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Fetch and parse a sitemap from the given URL.
 * Uses the sitemapper library which handles:
 * - Standard sitemap.xml files
 * - Sitemap index files (multiple sitemaps)
 * - Gzipped sitemaps
 *
 * @param sitemapUrl - Full URL to the sitemap.xml file
 * @param options - Optional authentication and timeout settings
 * @returns Promise resolving to sitemap parse result
 */
export async function fetchSitemap(
  sitemapUrl: string,
  options: FetchSitemapOptions = {},
): Promise<SitemapResult> {
  const { authType, credentials, timeout = DEFAULT_TIMEOUT_MS } = options;

  // Build sitemapper options
  const sitemapperOpts: SitemapperOptions = {
    timeout,
    url: sitemapUrl,
    debug: false,
    // Request extended field data (lastmod, changefreq, priority)
    fields: {
      loc: true,
      lastmod: true,
      changefreq: true,
      priority: true,
    },
  };

  // Add authentication headers if provided
  const authHeader = buildAuthHeader(authType, credentials);
  if (authHeader) {
    sitemapperOpts.requestHeaders = {
      Authorization: authHeader,
    };
  }

  try {
    const sitemapper = new Sitemapper(sitemapperOpts);
    const response = await sitemapper.fetch(sitemapUrl);

    // Check for errors
    if (response.errors && response.errors.length > 0) {
      const errorMessages = response.errors.map((e) => `${e.type}: ${e.url}`).join(", ");
      return {
        success: false,
        entries: [],
        error: `Sitemap errors: ${errorMessages}`,
        url: sitemapUrl,
      };
    }

    // Convert response to our format
    const entries: SitemapEntry[] = [];

    for (const site of response.sites) {
      // Handle both string[] and SitemapperSiteData[] formats
      if (typeof site === "string") {
        entries.push({ url: site });
      } else {
        const siteData = site as SitemapperSiteData;
        entries.push({
          url: siteData.loc,
          lastModified: parseLastMod(siteData.lastmod),
          changeFreq: siteData.changefreq,
          priority: parsePriority(siteData.priority),
        });
      }
    }

    return {
      success: true,
      entries,
      url: sitemapUrl,
    };
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      // Check for common error patterns
      const message = error.message.toLowerCase();

      if (message.includes("404") || message.includes("not found")) {
        return {
          success: false,
          entries: [],
          error: "Sitemap not found (404)",
          url: sitemapUrl,
        };
      }

      if (message.includes("timeout") || message.includes("etimedout")) {
        return {
          success: false,
          entries: [],
          error: `Sitemap request timed out after ${timeout}ms`,
          url: sitemapUrl,
        };
      }

      if (message.includes("401") || message.includes("unauthorized")) {
        return {
          success: false,
          entries: [],
          error: "Authentication required or credentials invalid",
          url: sitemapUrl,
        };
      }

      if (message.includes("403") || message.includes("forbidden")) {
        return {
          success: false,
          entries: [],
          error: "Access forbidden",
          url: sitemapUrl,
        };
      }

      return {
        success: false,
        entries: [],
        error: `Failed to fetch sitemap: ${error.message}`,
        url: sitemapUrl,
      };
    }

    return {
      success: false,
      entries: [],
      error: "Unknown error fetching sitemap",
      url: sitemapUrl,
    };
  }
}

/**
 * Build the full sitemap URL from a base URL.
 * Appends /sitemap.xml if not already present.
 */
export function buildSitemapUrl(baseUrl: string, sitemapPath?: string): string {
  // Normalize base URL
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  if (sitemapPath) {
    // If a custom path is provided, resolve it against base URL
    if (sitemapPath.startsWith("http://") || sitemapPath.startsWith("https://")) {
      return sitemapPath;
    }
    const path = sitemapPath.startsWith("/") ? sitemapPath : `/${sitemapPath}`;
    return `${normalizedBase}${path}`;
  }

  // Default to /sitemap.xml
  return `${normalizedBase}/sitemap.xml`;
}

/**
 * Extract URLs from sitemap entries, optionally filtering by modification date.
 *
 * @param entries - Sitemap entries to filter
 * @param since - Optional Unix timestamp (milliseconds) to filter entries modified after
 * @returns Array of URLs
 */
export function extractUrlsFromEntries(entries: SitemapEntry[], since?: number): string[] {
  if (!since) {
    return entries.map((e) => e.url);
  }

  return entries
    .filter((e) => {
      // Include entries with no lastModified (we can't know if they've changed)
      // Or entries modified after the since timestamp
      return e.lastModified === undefined || e.lastModified > since;
    })
    .map((e) => e.url);
}
