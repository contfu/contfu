/**
 * Source type constants
 */
export const SourceType = {
  NOTION: 0,
  STRAPI: 1,
} as const;

export type SourceTypeValue = (typeof SourceType)[keyof typeof SourceType];

export const SOURCE_TYPE_LABELS: Record<SourceTypeValue, string> = {
  [SourceType.NOTION]: "Notion",
  [SourceType.STRAPI]: "Strapi",
};

/**
 * Validation errors
 */
export type ValidationError = {
  field?: string;
  message: string;
};

/**
 * Connection test result
 */
export type ConnectionTestResult = {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Validate source data based on type.
 */
export function validateSourceData(
  type: number,
  url: string | null | undefined,
  credentials: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (type === SourceType.STRAPI) {
    if (!url) {
      errors.push({ field: "url", message: "URL is required for Strapi sources" });
    } else {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          errors.push({ field: "url", message: "URL must use http or https protocol" });
        }
      } catch {
        errors.push({ field: "url", message: "Invalid URL format" });
      }
    }
  }

  if (!credentials || credentials.trim().length === 0) {
    errors.push({ field: "credentials", message: "API token is required" });
  }

  return errors;
}

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
 * Test connection to a source.
 */
export async function testSourceConnection(
  type: number,
  url: string | null | undefined,
  credentials: string,
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

  return { success: false, message: `Unknown source type: ${type}` };
}
