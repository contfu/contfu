import { form, query, command, getRequestEvent } from "$app/server";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import {
  insertSource,
  selectSources,
  selectSourceWithCollectionCount,
  updateSource as updateSourceDb,
  deleteSource as deleteSourceDb,
  type SourceWithCollectionCount,
} from "$lib/server/sources/source-datasource";
import {
  validateSourceData,
  testSourceConnection,
  SourceType,
  type ConnectionTestResult,
} from "$lib/server/sources/source-validator";
import { getProviderAccessToken } from "$lib/server/auth/linked-accounts";

function getUserId(): string {
  const event = getRequestEvent();
  const user = event.locals.user;
  if (!user) {
    throw redirect(302, "/login");
  }
  return user.id;
}

/**
 * Get all sources for the current user.
 */
export const getSources = query(async (): Promise<SourceWithCollectionCount[]> => {
  const userId = getUserId();
  return selectSources(userId);
});

/**
 * Get a single source by ID.
 */
export const getSource = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<SourceWithCollectionCount | null> => {
    const userId = getUserId();
    const source = await selectSourceWithCollectionCount(userId, id);
    return source ?? null;
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
        throw invalid(issue.url(error.message));
      }
      if (error.field === "credentials") {
        throw invalid(issue._credentials(error.message));
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
    const source = await insertSource(userId, {
      name: data.name,
      type: data.type,
      url: data.type === SourceType.STRAPI || data.type === SourceType.WEB ? data.url : null,
      credentials: credentialsBuffer,
    });

    throw redirect(302, `/sources/${source.id}`);
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
  async (data): Promise<{ id: number } | { error: string }> => {
    const userId = getUserId();

    // Get the Notion access token from linked accounts
    const accessToken = await getProviderAccessToken(userId, "notion");
    if (!accessToken) {
      return { error: "No Notion account linked. Please connect Notion first." };
    }

    // Test the connection
    const testResult = await testSourceConnection(SourceType.NOTION, undefined, accessToken);
    if (!testResult.success) {
      return { error: `Notion connection failed: ${testResult.message}` };
    }

    // Insert the source
    const source = await insertSource(userId, {
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

    // Fetch existing source to get the type
    const existing = await selectSourceWithCollectionCount(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Source not found"));
    }

    // Validate type-specific requirements if credentials or url are being updated
    if (data._credentials || data.url) {
      const newCredentials = data._credentials || (existing.credentials?.toString("utf-8") ?? "");
      const newUrl = data.url ?? existing.url;
      const errors = validateSourceData(existing.type, newUrl, newCredentials);
      for (const error of errors) {
        if (error.field === "url") {
          throw invalid(issue.url(error.message));
        }
        if (error.field === "credentials") {
          throw invalid(issue._credentials(error.message));
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

    await updateSourceDb(userId, data.id, updates);
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
    const deleted = await deleteSourceDb(userId, data.id);

    if (!deleted) {
      throw invalid(issue.id("Source not found"));
    }

    throw redirect(302, "/sources");
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
    const source = await selectSourceWithCollectionCount(userId, data.id);

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
