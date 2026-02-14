import { command, form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import type { BackendSourceWithCollectionCount } from "@contfu/svc-backend/domain/types";
import { createSource as createSourceFeature } from "@contfu/svc-backend/features/sources/createSource";
import { deleteSource as deleteSourceFeature } from "@contfu/svc-backend/features/sources/deleteSource";
import { getSource as getSourceFeature } from "@contfu/svc-backend/features/sources/getSource";
import { getSourceWithCollectionCount } from "@contfu/svc-backend/features/sources/getSourceWithCollectionCount";
import { getSourceWithCredentials } from "@contfu/svc-backend/features/sources/getSourceWithCredentials";
import { listSources } from "@contfu/svc-backend/features/sources/listSources";
import {
  SourceType,
  testSourceConnection,
  type ConnectionTestResult,
} from "@contfu/svc-backend/features/sources/testSourceConnection";
import { updateSource as updateSourceFeature } from "@contfu/svc-backend/features/sources/updateSource";
import { validateSourceData } from "@contfu/svc-backend/features/sources/validateSourceData";
import { getProviderAccessToken } from "@contfu/svc-backend/infra/auth/linked-accounts";
import {
  iterateDataSources,
  resolveDataSourceId,
  type DataSourceResult,
} from "@contfu/svc-sources/notion";
import { error, invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all sources for the current user.
 */
export const getSources = query(async (): Promise<BackendSourceWithCollectionCount[]> => {
  const userId = getUserId();
  return listSources(userId);
});

/**
 * Get a single source by ID.
 */
export const getSource = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<BackendSourceWithCollectionCount> => {
    const userId = getUserId();
    const source = await getSourceWithCollectionCount(userId, id);
    if (!source) error(404, "Source not found");
    return source;
  },
);

/**
 * Create a new source.
 */
export const createSource = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
    type: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
      v.minValue(0),
      v.maxValue(2),
    ),
    url: v.optional(v.string()),
    authType: v.optional(
      v.pipe(
        v.union([v.string(), v.number()]),
        v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
        v.number(),
        v.minValue(0),
        v.maxValue(2),
      ),
    ),
    _credentials: v.optional(v.string()),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Validate type-specific requirements
    const errors = validateSourceData(data.type, data.url, data._credentials ?? "", data.authType);
    for (const error of errors) {
      if (error.field === "url") {
        invalid(issue.url(error.message));
      }
      if (error.field === "credentials") {
        invalid(issue._credentials(error.message));
      }
    }

    // For Web sources, encode authType as first byte of credentials
    // This allows the sync service to know which auth method to use
    let credentialsBuffer: Buffer | null = null;
    if (data._credentials) {
      if (data.type === SourceType.WEB && data.authType !== undefined) {
        // Prefix credentials with authType byte for Web sources
        const credBytes = Buffer.from(data._credentials, "utf-8");
        credentialsBuffer = Buffer.concat([Buffer.from([data.authType]), credBytes]);
      } else {
        credentialsBuffer = Buffer.from(data._credentials, "utf-8");
      }
    } else if (data.type === SourceType.WEB) {
      // Web sources with no auth still need authType byte
      credentialsBuffer = Buffer.from([data.authType ?? 0]);
    }

    // Insert into database
    const source = await createSourceFeature(userId, {
      name: data.name,
      type: data.type,
      url: data.type === SourceType.STRAPI || data.type === SourceType.WEB ? data.url : null,
      credentials: credentialsBuffer,
    });

    redirect(303, `/sources/${source.id}`);
  },
);

/**
 * Create a Notion source using the linked OAuth account.
 * Uses the access token from the user's linked Notion account.
 */
export const createNotionSourceFromOAuth = command(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data): Promise<{ id: number }> => {
    const userId = getUserId();

    // Get the Notion access token from linked accounts
    const accessToken = await getProviderAccessToken(userId, "notion");
    if (!accessToken) {
      error(400, "No Notion account linked. Please connect Notion first.");
    }

    // Test the connection
    const testResult = await testSourceConnection(SourceType.NOTION, undefined, accessToken);
    if (!testResult.success) {
      error(400, `Notion connection failed: ${testResult.message}`);
    }

    // Insert the source
    const source = await createSourceFeature(userId, {
      name: data.name,
      type: SourceType.NOTION,
      url: null,
      credentials: Buffer.from(accessToken, "utf-8"),
    });

    return { id: source.id };
  },
);

/**
 * Update an existing source.
 */
export const updateSource = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    name: v.optional(v.pipe(v.string(), v.nonEmpty("Name cannot be empty"))),
    url: v.optional(v.string()),
    _credentials: v.optional(v.string()),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Fetch existing source to get the type (with credentials for validation)
    const existing = await getSourceWithCredentials(userId, data.id);
    if (!existing) {
      invalid(issue.id("Source not found"));
    }

    // Validate type-specific requirements if credentials or url are being updated
    if (data._credentials || data.url) {
      const newCredentials = data._credentials || (existing.credentials?.toString("utf-8") ?? "");
      const newUrl = data.url ?? existing.url;
      const errors = validateSourceData(existing.type, newUrl, newCredentials);
      for (const error of errors) {
        if (error.field === "url") {
          invalid(issue.url(error.message));
        }
        if (error.field === "credentials") {
          invalid(issue._credentials(error.message));
        }
      }
    }

    // Build update object
    const updates: { name?: string; url?: string | null; credentials?: Buffer } = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.url !== undefined) {
      updates.url = data.url;
    }
    if (data._credentials !== undefined && data._credentials.length > 0) {
      updates.credentials = Buffer.from(data._credentials, "utf-8");
    }

    await updateSourceFeature(userId, data.id, updates);
    return { success: true };
  },
);

/**
 * Delete a source.
 */
export const deleteSource = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const deleted = await deleteSourceFeature(userId, data.id);

    if (!deleted) {
      invalid(issue.id("Source not found"));
    }

    return { success: true };
  },
);

/**
 * Test connection to a source.
 */
export const testConnection = command(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data): Promise<ConnectionTestResult> => {
    const userId = getUserId();
    // Use getSourceWithCredentials since we need actual credentials for testing
    const source = await getSourceWithCredentials(userId, data.id);

    if (!source) {
      return { success: false, message: "Source not found" };
    }

    const credentials = source.credentials?.toString("utf-8") ?? "";
    return testSourceConnection(source.type, source.url, credentials);
  },
);

/**
 * Test connection with credentials (without saving).
 */
export const testNewConnection = command(
  v.object({
    type: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    url: v.optional(v.string()),
    authType: v.optional(
      v.pipe(
        v.union([v.string(), v.number()]),
        v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
        v.number(),
      ),
    ),
    _credentials: v.optional(v.string()),
  }),
  async (data): Promise<ConnectionTestResult> => {
    // Just verify the user is logged in
    getUserId();
    return testSourceConnection(data.type, data.url, data._credentials ?? "", data.authType);
  },
);

/**
 * Regenerate webhook secret for a Strapi source.
 * Returns the new plaintext secret (only shown once).
 */
export const regenerateWebhookSecret = command(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data): Promise<{ success: boolean; secret?: string; message?: string }> => {
    const userId = getUserId();
    // Don't need credentials here, just checking type
    const source = await getSourceFeature(userId, data.id);

    if (!source) {
      error(404, "Source not found");
    }

    if (source.type !== SourceType.STRAPI) {
      error(400, "Webhook secrets are only available for Strapi sources");
    }

    // Generate new secret
    const { randomBytes } = await import("node:crypto");
    const newSecret = randomBytes(32).toString("hex");

    // Store the new secret (encryption happens in updateSource)
    await updateSourceFeature(userId, data.id, { webhookSecret: Buffer.from(newSecret, "utf8") });

    return { success: true, secret: newSecret };
  },
);

// ============================================================
// Notion Data Source Picker Commands
// ============================================================

export type NotionDataSource = {
  id: string;
  title: string;
  icon: { type: "emoji" | "external" | "file"; value: string } | null;
  url: string;
};

export type NotionDataSourcesResult =
  | { dataSources: NotionDataSource[]; usedIds: string[] }
  | { error: string };

function parseDataSource(ds: DataSourceResult): NotionDataSource {
  // Title is in ds.title array (rich text)
  const title = ds.title?.[0]?.plain_text || "Untitled";

  let icon: NotionDataSource["icon"] = null;
  const dsIcon = ds.icon;

  if (dsIcon?.type === "emoji") {
    icon = { type: "emoji", value: dsIcon.emoji };
  } else if (dsIcon?.type === "external") {
    icon = { type: "external", value: dsIcon.external.url };
  } else if (dsIcon?.type === "file") {
    icon = { type: "file", value: dsIcon.file.url };
  }

  return {
    id: ds.id,
    title,
    icon,
    url: ds.url,
  };
}

/**
 * List available Notion data sources for a source.
 * Also returns IDs of data sources already used by collections.
 */
export const listNotionDataSources = query(
  v.object({
    sourceId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data) => {
    const userId = getUserId();
    // Need credentials to access Notion API
    const source = await getSourceWithCredentials(userId, data.sourceId);

    if (!source) {
      error(404, "Source not found");
    }
    if (source.type !== SourceType.NOTION) {
      error(400, "Not a Notion source");
    }
    const token = source.credentials?.toString("utf-8");
    if (!token) {
      error(400, "No API token configured");
    }

    try {
      // Fetch data sources from Notion and existing collections in parallel
      const { listCollectionSummariesBySource } =
        await import("@contfu/svc-backend/features/source-collections/listCollectionSummariesBySource");

      const [collections, dataSources] = await Promise.all([
        listCollectionSummariesBySource(userId, data.sourceId),
        (async () => {
          const results: NotionDataSource[] = [];
          for await (const ds of iterateDataSources(token)) {
            results.push(parseDataSource(ds));
          }
          return results;
        })(),
      ]);

      // Extract used data source IDs from collection refs (now included in summary)
      const usedIds = collections.map((c) => c.refString).filter((id): id is string => !!id);

      return { dataSources, usedIds };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("401") || message.includes("unauthorized")) {
        error(401, "Invalid or expired Notion token");
      }
      if (message.includes("403") || message.includes("forbidden")) {
        error(403, "No data sources found. Make sure your integration has access.");
      }
      error(500, message);
    }
  },
);

/**
 * Resolve a user-provided ID (database or data source) to a data source ID.
 */
export const resolveNotionId = command(
  v.object({
    sourceId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    id: v.string(),
  }),
  async (
    data,
  ): Promise<{ success: true; dataSourceId: string } | { success: false; error: string }> => {
    const userId = getUserId();
    // Need credentials to access Notion API
    const source = await getSourceWithCredentials(userId, data.sourceId);

    if (!source) {
      error(404, "Source not found");
    }
    if (source.type !== SourceType.NOTION) {
      error(400, "Not a Notion source");
    }

    const token = source.credentials?.toString("utf-8");
    if (!token) {
      error(400, "No API token configured");
    }

    try {
      const dataSourceId = await resolveDataSourceId(token, data.id);
      return { success: true, dataSourceId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("401") || message.includes("unauthorized")) {
        error(401, "Invalid or expired Notion token");
      }
      error(404, "Could not find database or data source with this ID");
    }
  },
);
