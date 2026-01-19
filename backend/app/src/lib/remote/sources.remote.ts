import { form, query, getRequestEvent } from "$app/server";
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

function getUserId(): number {
  const event = getRequestEvent();
  const session = event.locals.session;
  if (!session) {
    throw redirect(302, "/login");
  }
  return session.user.id;
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
      v.maxValue(1),
    ),
    url: v.optional(v.string()),
    _credentials: v.pipe(v.string(), v.nonEmpty("API token is required")),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Validate type-specific requirements
    const errors = validateSourceData(data.type, data.url, data._credentials);
    for (const error of errors) {
      if (error.field === "url") {
        throw invalid(issue.url(error.message));
      }
      if (error.field === "credentials") {
        throw invalid(issue._credentials(error.message));
      }
    }

    // Insert into database
    const source = await insertSource(userId, {
      name: data.name,
      type: data.type,
      url: data.type === SourceType.STRAPI ? data.url : null,
      credentials: Buffer.from(data._credentials, "utf-8"),
    });

    throw redirect(302, `/sources/${source.id}`);
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
export const testConnection = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue): Promise<ConnectionTestResult> => {
    const userId = getUserId();
    const source = await selectSourceWithCollectionCount(userId, data.id);

    if (!source) {
      throw invalid(issue.id("Source not found"));
    }

    const credentials = source.credentials?.toString("utf-8") ?? "";
    return testSourceConnection(source.type, source.url, credentials);
  },
);

/**
 * Test connection with credentials (without saving).
 */
export const testNewConnection = form(
  v.object({
    type: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    url: v.optional(v.string()),
    _credentials: v.pipe(v.string(), v.nonEmpty("API token is required")),
  }),
  async (data): Promise<ConnectionTestResult> => {
    // Just verify the user is logged in
    getUserId();
    return testSourceConnection(data.type, data.url, data._credentials);
  },
);
