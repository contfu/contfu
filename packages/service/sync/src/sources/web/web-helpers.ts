import { type WebAuthTypeValue, WebAuthType } from "./web";

/** Default timeout for web requests in milliseconds. */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Resolve a relative URL against a base URL.
 * Uses the URL API for proper resolution of relative paths.
 */
export function resolveUrl(relativePath: string, baseUrl: string): string {
  // If already absolute, return as-is
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return new URL(relativePath, baseUrl).href;
}

/**
 * Extract the slug from a URL path.
 * Takes the last path segment without extension.
 * Examples:
 *   /blog/my-article.html -> my-article
 *   /docs/getting-started -> getting-started
 *   /api/users/ -> users
 *   / -> index
 */
export function extractSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Remove trailing slash and get last segment
    const segments = path.replace(/\/$/, "").split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "index";

    // Remove file extension if present
    return lastSegment.replace(/\.[^.]+$/, "");
  } catch {
    // Fallback for invalid URLs
    return "unknown";
  }
}

/**
 * Build the Authorization header value based on auth type and credentials.
 * Returns undefined if no auth is required (NONE type or missing credentials).
 */
export function buildAuthHeader(
  authType: WebAuthTypeValue | undefined,
  credentials: Buffer | undefined,
): string | undefined {
  if (!credentials || authType === WebAuthType.NONE || authType === undefined) {
    return undefined;
  }

  const credentialString = credentials.toString("utf8");

  switch (authType) {
    case WebAuthType.BEARER:
      return `Bearer ${credentialString}`;
    case WebAuthType.BASIC:
      // Credentials should already be base64-encoded user:pass
      return `Basic ${credentialString}`;
    default:
      return undefined;
  }
}

/** Options for web fetch requests. */
export interface WebRequestOptions {
  /** Base URL of the website. */
  baseUrl: string;
  /** Authentication type. */
  authType?: WebAuthTypeValue;
  /** Auth credentials (Bearer token or Base64-encoded Basic auth). */
  credentials?: Buffer;
  /** Request timeout in milliseconds. */
  timeout?: number;
}

/** Result of a web fetch request. */
export interface WebFetchResult {
  /** Response body as text. */
  body: string;
  /** Content type from response headers. */
  contentType: string;
  /** Final URL after redirects. */
  finalUrl: string;
  /** HTTP status code. */
  status: number;
  /** Last-Modified header value if present. */
  lastModified?: string;
}

/**
 * Perform an authenticated fetch request to a web URL.
 * Handles auth headers, timeouts, and returns the response with metadata.
 */
export async function webFetch(url: string, options: WebRequestOptions): Promise<WebFetchResult> {
  const resolvedUrl = resolveUrl(url, options.baseUrl);
  const authHeader = buildAuthHeader(options.authType, options.credentials);

  const headers: Record<string, string> = {
    Accept: "text/html, text/markdown, application/json, */*",
  };

  if (authHeader) {
    headers["Authorization"] = authHeader;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(resolvedUrl, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Web fetch error: ${response.status} ${response.statusText}`);
    }

    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "text/html";
    const lastModified = response.headers.get("last-modified") ?? undefined;

    return {
      body,
      contentType,
      finalUrl: response.url,
      status: response.status,
      lastModified,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Content processor type based on content-type header.
 */
export type ContentProcessor = "html" | "markdown" | "json" | null;

/**
 * Determine the content processor based on content-type header.
 * Returns 'html' for HTML, 'markdown' for Markdown, 'json' for JSON, or null for unsupported types.
 */
export function getContentProcessor(contentType: string): ContentProcessor {
  const lowerType = contentType.toLowerCase();

  if (lowerType.includes("text/html")) {
    return "html";
  }
  if (lowerType.includes("text/markdown") || lowerType.includes("text/x-markdown")) {
    return "markdown";
  }
  if (lowerType.includes("application/json")) {
    return "json";
  }

  return null;
}

/**
 * Parse the ref buffer to get the list of URLs.
 * URLs are stored as newline-separated values in the Buffer.
 */
export function parseRefUrls(ref: Buffer): string[] {
  const content = ref.toString("utf8").trim();
  if (!content) {
    return [];
  }
  return content
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * Normalize a base URL by removing trailing slashes.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Test if a URL is accessible with the given credentials.
 * Returns a result object indicating success or failure with details.
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: string;
}

export async function testWebConnection(
  baseUrl: string,
  authType?: WebAuthTypeValue,
  credentials?: Buffer,
): Promise<ConnectionTestResult> {
  try {
    const authHeader = buildAuthHeader(authType, credentials);
    const headers: Record<string, string> = {};

    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(normalizeBaseUrl(baseUrl), {
        method: "HEAD",
        headers,
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          success: true,
          message: "Successfully connected to web source",
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: "Invalid credentials or access denied",
          details: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: false,
        message: `HTTP error: ${response.status} ${response.statusText}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          message: "Connection timed out",
          details: `Timeout after ${DEFAULT_TIMEOUT_MS}ms`,
        };
      }
      return {
        success: false,
        message: "Connection failed",
        details: error.message,
      };
    }
    return {
      success: false,
      message: "Unknown connection error",
    };
  }
}
