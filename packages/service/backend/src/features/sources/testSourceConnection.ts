import { SourceType } from "@contfu/core";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  [SourceType.NOTION]: "Notion",
  [SourceType.STRAPI]: "Strapi",
  [SourceType.WEB]: "Web",
};

/**
 * Web authentication type constants
 */
export const WebAuthType = {
  NONE: 0,
  BEARER: 1,
  BASIC: 2,
} as const;

export type WebAuthTypeValue = (typeof WebAuthType)[keyof typeof WebAuthType];

/**
 * Connection test result
 */
export type ConnectionTestResult = {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Test connection to a Notion source.
 */
async function testNotionConnection(credentials: string): Promise<ConnectionTestResult> {
  try {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${credentials}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: "Successfully connected to Notion",
        details: { user: data.name || data.id },
      };
    }

    if (response.status === 401) {
      return { success: false, message: "Invalid API token" };
    }

    return { success: false, message: `Notion API error: ${response.status}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Notion",
    };
  }
}

/**
 * Test connection to a Strapi source.
 */
async function testStrapiConnection(
  url: string,
  credentials: string,
): Promise<ConnectionTestResult> {
  try {
    // Normalize URL
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;

    // Try the content-types endpoint to verify both connectivity and auth
    const response = await fetch(`${baseUrl}/api/content-type-builder/content-types`, {
      headers: {
        Authorization: `Bearer ${credentials}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const contentTypes = data.data?.filter((ct: { uid: string }) => ct.uid.startsWith("api::"));
      return {
        success: true,
        message: "Successfully connected to Strapi",
        details: { contentTypeCount: contentTypes?.length ?? 0 },
      };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: "Invalid or insufficient API token permissions" };
    }

    if (response.status === 404) {
      // Try an alternative endpoint for older Strapi versions
      const altResponse = await fetch(`${baseUrl}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${credentials}`,
        },
      });

      if (altResponse.ok) {
        return {
          success: true,
          message: "Successfully connected to Strapi",
        };
      }

      return { success: false, message: "Could not find Strapi API endpoints" };
    }

    return { success: false, message: `Strapi API error: ${response.status}` };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return { success: false, message: "Could not connect to the server. Check the URL." };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Strapi",
    };
  }
}

/**
 * Build authorization header for web sources.
 */
function buildWebAuthHeader(authType: number | undefined, credentials: string): string | undefined {
  if (!credentials || authType === WebAuthType.NONE || authType === undefined) {
    return undefined;
  }

  switch (authType) {
    case WebAuthType.BEARER:
      return `Bearer ${credentials}`;
    case WebAuthType.BASIC:
      return `Basic ${encodeBase64(credentials)}`;
    default:
      return undefined;
  }
}

/**
 * Test connection to a Web source.
 * Uses GET with Range header to minimize data transfer while testing connectivity.
 */
async function testWebConnection(
  url: string,
  authType?: number,
  credentials?: string,
): Promise<ConnectionTestResult> {
  try {
    // Normalize URL
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;

    const headers: Record<string, string> = {
      // Request only the first byte to minimize data transfer
      Range: "bytes=0-0",
    };
    const authHeader = buildWebAuthHeader(authType, credentials ?? "");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    // Use GET request with Range header for better server compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(baseUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      // 200 OK or 206 Partial Content both indicate success
      if (response.ok || response.status === 206) {
        return {
          success: true,
          message: "Successfully connected to web source",
        };
      }

      if (response.status === 401 || response.status === 403) {
        return { success: false, message: "Invalid credentials or access denied" };
      }

      if (response.status === 404) {
        return { success: false, message: "URL not found (404)" };
      }

      return { success: false, message: `HTTP error: ${response.status}` };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { success: false, message: "Connection timed out" };
      }
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return { success: false, message: "Could not connect to the server. Check the URL." };
      }
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: "Failed to connect to web source",
    };
  }
}

/**
 * Test connection to a source.
 */
export async function testSourceConnection(
  type: number,
  url: string | null | undefined,
  credentials: string,
  authType?: number,
): Promise<ConnectionTestResult> {
  if (type === SourceType.NOTION) {
    return testNotionConnection(credentials);
  }

  if (type === SourceType.STRAPI) {
    if (!url) {
      return { success: false, message: "URL is required for Strapi sources" };
    }
    return testStrapiConnection(url, credentials);
  }

  if (type === SourceType.WEB) {
    if (!url) {
      return { success: false, message: "URL is required for Web sources" };
    }
    return testWebConnection(url, authType, credentials);
  }

  return { success: false, message: `Unknown source type: ${type}` };
}

function encodeBase64(input: string): string {
  return Buffer.from(input, "utf8").toString("base64");
}
