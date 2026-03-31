import { getStreamServer } from "$lib/server/startup";
import { ConnectionType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { getSetting } from "@contfu/svc-backend/features/admin/getSetting";
import { upsertSetting } from "@contfu/svc-backend/features/admin/upsertSetting";
import { enqueueSyncJobs } from "@contfu/svc-backend/features/sync-jobs/enqueueSyncJobs";
import { processSchemaChange } from "@contfu/svc-backend/features/schema-sync";
import { run, runWithUser } from "$lib/server/run";
import {
  decryptCredentials,
  encryptCredentials,
} from "@contfu/svc-backend/infra/crypto/credentials";
import { validateWebhookSignature } from "@contfu/svc-backend/infra/crypto/webhook-signature";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import { cancelPending, markPending } from "@contfu/svc-backend/infra/webhook-queue/pending-kv";
import { enqueueWebhookFetch } from "@contfu/svc-backend/infra/webhook-queue/webhook-fetch-queue";
import { genUid, uuidToBuffer } from "@contfu/svc-sources";
import { notionPropertiesToSchemaWithIds } from "@contfu/svc-sources/notion";
import type { SchemaChangeHints } from "@contfu/svc-backend/infra/sync-worker/worker-manager";
import { getSyncWorkerManager } from "$lib/server/startup";
import { and, desc, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import { lru } from "tiny-lru";
import * as v from "valibot";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-notion");

const MAX_LOGS_PER_CONNECTION = 50;

const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;
const SETTING_OAUTH_TOKEN = "notion_oauth_verification_token";

type CachedCollectionRef = {
  id: number;
  ref: Buffer | null;
};

type CachedGlobalCollectionRef = CachedCollectionRef & {
  userId: number;
  connectionId: number;
};

const collectionCache = lru<CachedCollectionRef[]>(500, 5 * 60 * 1000);
const globalCollectionCache = lru<CachedGlobalCollectionRef[]>(500, 5 * 60 * 1000);

const NotionWebhookPayloadSchema = v.looseObject({
  verification_token: v.optional(v.string()),
  type: v.optional(v.string()),
  entity: v.optional(
    v.object({
      id: v.string(),
      type: v.string(),
    }),
  ),
  data: v.optional(
    v.looseObject({
      parent: v.optional(
        v.looseObject({
          type: v.string(),
          id: v.optional(v.string()),
          // Legacy format
          database_id: v.optional(v.string()),
        }),
      ),
      // database.schema_updated: array of {id, name, action} objects
      // page.properties_updated: array of property ID strings
      updated_properties: v.optional(
        v.array(
          v.union([
            v.looseObject({
              id: v.string(),
              name: v.string(),
              action: v.picklist(["created", "updated", "deleted"]),
            }),
            v.string(),
          ]),
        ),
      ),
    }),
  ),
});

type ConnectionInfo = {
  userId: number;
  id: number;
  includeRef: boolean;
  webhookSecret: Buffer | null;
  credentials: Buffer | null;
};

function getParentDatabaseId(
  parent: { type?: string; id?: string; database_id?: string } | undefined,
): string | undefined {
  if (!parent) return undefined;
  // New format: { type: "database", id: "..." }
  // Legacy format: { database_id: "..." }
  return parent.database_id ?? (parent.type === "database" ? parent.id : undefined);
}

function isPageChangeEvent(eventType: string): boolean {
  return eventType.startsWith("page.") && eventType !== "page.deleted";
}

async function logWebhookEvent(
  userId: number,
  connectionId: number,
  event: string,
  model: string | null,
  status: "success" | "error" | "unauthorized",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      connectionId,
      event,
      model,
      status,
      errorMessage,
      itemsBroadcast: itemsBroadcast ?? 0,
    });

    const logs = await db
      .select({ id: webhookLogTable.id })
      .from(webhookLogTable)
      .where(eq(webhookLogTable.connectionId, connectionId))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(1000);

    if (logs.length > MAX_LOGS_PER_CONNECTION) {
      const idsToDelete = logs.slice(MAX_LOGS_PER_CONNECTION).map((l) => l.id);
      await db.delete(webhookLogTable).where(inArray(webhookLogTable.id, idsToDelete));
    }
  } catch (err) {
    log.error({ err }, "Failed to log webhook event");
  }
}

function validateSignature(body: string, headers: Headers, secret: string): boolean {
  return validateWebhookSignature(body, headers.get("x-notion-signature"), secret);
}

/**
 * Find collections by connectionId + ref.
 */
async function getCollectionsByRef(
  userId: number,
  connectionId: number,
  ref: Buffer,
): Promise<{ id: number; ref: Buffer | null }[]> {
  const cacheKey = `${userId}:${connectionId}`;
  const cached = collectionCache.get(cacheKey);
  if (cached) return cached.filter((c) => c.ref && c.ref.equals(ref));

  const all = await db
    .select({ id: collectionTable.id, ref: collectionTable.ref })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.connectionId, connectionId)));

  const result = all.map((c) => ({ id: c.id, ref: c.ref }));
  collectionCache.set(cacheKey, result);
  return result.filter((c) => c.ref && c.ref.equals(ref));
}

/**
 * Find collections across all users by ref (OAuth mode).
 */
async function getCollectionsByRefGlobal(ref: Buffer) {
  const cacheKey = `ref:${ref.toString("hex")}`;
  const cached = globalCollectionCache.get(cacheKey);
  if (cached) return cached;

  const results = await db
    .select({
      id: collectionTable.id,
      ref: collectionTable.ref,
      userId: collectionTable.userId,
      connectionId: collectionTable.connectionId,
    })
    .from(collectionTable)
    .where(eq(collectionTable.ref, ref));

  const mapped = results.map((c) => ({
    id: c.id,
    ref: c.ref,
    userId: c.userId,
    connectionId: c.connectionId!,
  }));
  globalCollectionCache.set(cacheKey, mapped);
  return mapped;
}

/**
 * Get flows from source collections to target collections, and find CLIENT connections
 * that own those target collections (for broadcasting).
 */
async function getFlowsAndClients(
  userId: number,
  sourceCollectionIds: number[],
  _connectionIncludeRef: boolean,
) {
  if (sourceCollectionIds.length === 0) return { flows: [], clients: [] };

  // Get flows from these source collections
  const flows = await db
    .select({
      id: flowTable.id,
      sourceId: flowTable.sourceId,
      targetId: flowTable.targetId,
      includeRef: flowTable.includeRef,
      filters: flowTable.filters,
      mappings: flowTable.mappings,
    })
    .from(flowTable)
    .where(and(eq(flowTable.userId, userId), inArray(flowTable.sourceId, sourceCollectionIds)));

  const targetCollectionIds = [...new Set(flows.map((f) => f.targetId))];
  if (targetCollectionIds.length === 0) return { flows, clients: [] };

  // Find CLIENT connections that own the target collections
  const clients = await db
    .select({
      connectionId: connectionTable.id,
      collectionId: collectionTable.id,
      connectionIncludeRef: connectionTable.includeRef,
      collectionIncludeRef: collectionTable.includeRef,
    })
    .from(collectionTable)
    .innerJoin(
      connectionTable,
      and(
        eq(collectionTable.connectionId, connectionTable.id),
        eq(connectionTable.type, ConnectionType.CLIENT),
      ),
    )
    .where(
      and(eq(collectionTable.userId, userId), inArray(collectionTable.id, targetCollectionIds)),
    );

  return { flows, clients };
}

// ============================================================
// Handler
// ============================================================

export const POST: RequestHandler = async ({ request, params }) => {
  const { uid } = params;

  const body = await request.text();
  log.info({ uid }, "Notion webhook request received");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  log.debug({ payload: parsed }, "Raw webhook payload");

  const parseResult = v.safeParse(NotionWebhookPayloadSchema, parsed);
  if (!parseResult.success) {
    log.warn({ issues: parseResult.issues, payload: parsed }, "Invalid payload schema");
    return new Response("Invalid payload", { status: 400 });
  }
  const payload = parseResult.output;
  log.debug({ payload }, "Parsed webhook payload");

  const isOAuthMode = NOTION_WEBHOOK_SECRET && uid === NOTION_WEBHOOK_SECRET;

  // ---- Verification flow ----
  if (payload.verification_token && !payload.type) {
    log.info("Verification request received");

    if (isOAuthMode) {
      const encrypted = await encryptCredentials(
        0,
        Buffer.from(payload.verification_token, "utf8"),
      );
      if (encrypted) {
        await run(upsertSetting(SETTING_OAUTH_TOKEN, encrypted));
      }
      log.info("OAuth verification token stored in settings");
    } else {
      // Custom integration: find connection by uid
      const [connRow] = await db
        .select({
          userId: connectionTable.userId,
          id: connectionTable.id,
        })
        .from(connectionTable)
        .where(and(eq(connectionTable.uid, uid), eq(connectionTable.type, ConnectionType.NOTION)))
        .limit(1);

      if (connRow) {
        const encrypted = await encryptCredentials(
          connRow.userId,
          Buffer.from(payload.verification_token, "utf8"),
        );
        if (encrypted) {
          await db
            .update(connectionTable)
            .set({ webhookSecret: encrypted })
            .where(
              and(eq(connectionTable.userId, connRow.userId), eq(connectionTable.id, connRow.id)),
            );
        }
        await logWebhookEvent(
          connRow.userId,
          connRow.id,
          "verification",
          payload.verification_token,
          "success",
        );
        log.info(
          { userId: connRow.userId, connectionId: connRow.id },
          "Verification token stored for connection",
        );
      } else {
        log.warn({ uid }, "Connection not found for verification");
        return new Response("Connection not found", { status: 404 });
      }
    }

    return new Response("OK", { status: 200 });
  }

  // ---- Signature validation ----
  if (isOAuthMode) {
    const encryptedToken = await run(getSetting(SETTING_OAUTH_TOKEN));
    if (!encryptedToken) {
      if (!payload.verification_token) {
        log.warn("OAuth token not configured");
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      const decrypted = await decryptCredentials(0, encryptedToken);
      const secret = decrypted?.toString("utf8");
      if (!secret || !validateSignature(body, request.headers, secret)) {
        log.warn("Invalid OAuth signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }
  }

  let conn: ConnectionInfo | null = null;
  if (!isOAuthMode) {
    const [found] = await db
      .select({
        userId: connectionTable.userId,
        id: connectionTable.id,
        includeRef: connectionTable.includeRef,
        webhookSecret: connectionTable.webhookSecret,
        credentials: connectionTable.credentials,
      })
      .from(connectionTable)
      .where(and(eq(connectionTable.uid, uid), eq(connectionTable.type, ConnectionType.NOTION)))
      .limit(1);

    if (!found) {
      log.warn({ uid }, "Connection not found");
      return new Response("Connection not found", { status: 404 });
    }
    conn = found;

    if (conn.webhookSecret) {
      const decrypted = await decryptCredentials(conn.userId, conn.webhookSecret);
      const secret = decrypted?.toString("utf8");
      if (!secret || !validateSignature(body, request.headers, secret)) {
        log.warn({ userId: conn.userId, connectionId: conn.id }, "Invalid signature");
        await logWebhookEvent(
          conn.userId,
          conn.id,
          payload.type ?? "unknown",
          null,
          "unauthorized",
          "Invalid webhook signature",
        );
        return new Response("Unauthorized", { status: 401 });
      }
    } else if (!payload.verification_token) {
      log.warn({ userId: conn.userId, connectionId: conn.id }, "Webhook secret not configured");
      await logWebhookEvent(
        conn.userId,
        conn.id,
        payload.type ?? "unknown",
        null,
        "unauthorized",
        "Webhook secret not configured",
      );
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const eventType = payload.type;
  if (!eventType || !payload.entity) {
    log.debug({ type: payload.type }, "Ignoring payload with no event type or entity");
    return new Response("OK", { status: 200 });
  }

  log.info({ eventType, entityId: payload.entity.id }, "Received webhook event");

  const streamServer = getStreamServer();

  // ---- Page events ----
  if (eventType.startsWith("page.")) {
    const pageId = payload.entity.id;

    if (eventType === "page.locked" || eventType === "page.unlocked") {
      log.debug({ eventType, pageId: payload.entity.id }, "Ignoring page lock/unlock event");
      return new Response("OK", { status: 200 });
    }

    // ---- DELETED ----
    if (eventType === "page.deleted") {
      const itemId = genUid(uuidToBuffer(pageId));

      if (conn) {
        await cancelPending(conn.userId, conn.id, pageId);

        const parentDbId = getParentDatabaseId(payload.data?.parent);
        if (!parentDbId) {
          await logWebhookEvent(
            conn.userId,
            conn.id,
            eventType,
            pageId,
            "success",
            "No parent database ID",
            0,
          );
          return new Response("OK", { status: 200 });
        }

        const ref = uuidToBuffer(parentDbId);
        const sourceCollections = await getCollectionsByRef(conn.userId, conn.id, ref);
        if (sourceCollections.length === 0) {
          await logWebhookEvent(
            conn.userId,
            conn.id,
            eventType,
            pageId,
            "success",
            "No matching collections",
            0,
          );
          return new Response("OK", { status: 200 });
        }

        const sourceCollectionIds = sourceCollections.map((c) => c.id);
        const { flows, clients } = await getFlowsAndClients(
          conn.userId,
          sourceCollectionIds,
          conn.includeRef,
        );

        const targetCollectionIds = [...new Set(flows.map((f) => f.targetId))];
        if (targetCollectionIds.length === 0) {
          await logWebhookEvent(conn.userId, conn.id, eventType, pageId, "success", "No flows", 0);
          return new Response("OK", { status: 200 });
        }

        if (clients.length > 0) {
          streamServer.broadcastDeleted(
            itemId,
            clients.map((c) => ({
              userId: conn.userId,
              connectionId: c.connectionId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                Boolean(conn.includeRef),
            })),
          );
        }

        await logWebhookEvent(
          conn.userId,
          conn.id,
          eventType,
          pageId,
          "success",
          undefined,
          clients.length,
        );
      } else {
        // OAuth mode
        const parentDbId = getParentDatabaseId(payload.data?.parent);
        if (parentDbId) {
          const ref = uuidToBuffer(parentDbId);
          const globalCollections = await getCollectionsByRefGlobal(ref);
          log.debug(
            { pageId, parentDbId, collectionCount: globalCollections.length },
            "OAuth mode: delete across global collections",
          );
          const grouped = new Map<string, { userId: number; connectionId: number }>();
          for (const gc of globalCollections) {
            grouped.set(`${gc.userId}:${gc.connectionId}`, {
              userId: gc.userId,
              connectionId: gc.connectionId,
            });
          }

          for (const g of grouped.values()) {
            await cancelPending(g.userId, g.connectionId, pageId);
          }

          let totalBroadcast = 0;
          for (const gc of globalCollections) {
            const { clients } = await getFlowsAndClients(gc.userId, [gc.id], true);
            if (clients.length > 0) {
              streamServer.broadcastDeleted(
                itemId,
                clients.map((c) => ({
                  userId: gc.userId,
                  connectionId: c.connectionId,
                  collectionId: c.collectionId,
                  includeRef: Boolean(c.connectionIncludeRef) && Boolean(c.collectionIncludeRef),
                })),
              );
              totalBroadcast += clients.length;
            }
          }
          log.info({ pageId, totalBroadcast }, "OAuth mode: delete broadcast complete");
        } else {
          log.debug({ pageId }, "OAuth mode: no parent database ID, skipping delete");
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---- CHANGED (page.created, page.content_updated, etc.) ----
    if (isPageChangeEvent(eventType)) {
      const parentDbId = getParentDatabaseId(payload.data?.parent);

      if (conn) {
        const marked = await markPending(conn.userId, conn.id, pageId);
        if (marked) {
          await enqueueWebhookFetch({
            userId: conn.userId,
            connectionId: conn.id,
            pageId,
            eventType,
            parentDatabaseId: parentDbId,
            enqueuedAt: Date.now(),
          });
          await logWebhookEvent(
            conn.userId,
            conn.id,
            eventType,
            pageId,
            "success",
            "Webhook fetch enqueued",
            0,
          );
        } else {
          await logWebhookEvent(
            conn.userId,
            conn.id,
            eventType,
            pageId,
            "success",
            "Skipped duplicate pending webhook fetch",
            0,
          );
        }

        return new Response("OK", { status: 200 });
      }

      if (!parentDbId) {
        log.info({ pageId, eventType }, "OAuth mode: no parent database ID, skipping");
        return new Response("OK", { status: 200 });
      }

      const ref = uuidToBuffer(parentDbId);
      const globalCollections = await getCollectionsByRefGlobal(ref);
      log.info(
        { pageId, parentDbId, collectionCount: globalCollections.length },
        "OAuth mode: enqueuing fetch across global collections",
      );
      const grouped = new Map<string, { userId: number; connectionId: number }>();
      for (const gc of globalCollections) {
        grouped.set(`${gc.userId}:${gc.connectionId}`, {
          userId: gc.userId,
          connectionId: gc.connectionId,
        });
      }

      let enqueuedCount = 0;
      for (const g of grouped.values()) {
        const marked = await markPending(g.userId, g.connectionId, pageId);
        if (marked) {
          await enqueueWebhookFetch({
            userId: g.userId,
            connectionId: g.connectionId,
            pageId,
            eventType,
            parentDatabaseId: parentDbId,
            enqueuedAt: Date.now(),
          });
          enqueuedCount++;
        }
      }
      log.info({ pageId, eventType, enqueuedCount }, "OAuth mode: fetch jobs enqueued");

      for (const g of grouped.values()) {
        await logWebhookEvent(
          g.userId,
          g.connectionId,
          eventType,
          pageId,
          "success",
          enqueuedCount > 0 ? "Webhook fetch enqueued" : "Skipped duplicate pending",
          0,
        );
      }

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  }

  // ---- Database events ----
  if (eventType === "database.schema_updated") {
    const databaseId = payload.entity.id; // entity.id IS the Notion database UUID
    const updatedProperties = payload.data?.updated_properties;
    log.info({ databaseId, updatedProperties }, "Database schema updated");

    if (conn && updatedProperties) {
      const credentials = conn.credentials
        ? await decryptCredentials(conn.userId, conn.credentials)
        : null;
      const token = credentials?.toString("utf8");

      if (token) {
        try {
          const { notion, isFullDatabase } = await import("@contfu/svc-sources/notion");
          const database = await notion.databases.retrieve({
            auth: token,
            database_id: databaseId,
          });
          if (isFullDatabase(database) && database.data_sources?.[0]?.id) {
            const dataSource = await notion.dataSources.retrieve({
              auth: token,
              data_source_id: database.data_sources[0].id,
            });
            if ("properties" in dataSource && dataSource.properties) {
              const { schema, notionPropertyIds: newIdMap } = notionPropertiesToSchemaWithIds(
                dataSource.properties,
              );

              const ref = uuidToBuffer(databaseId);
              const [collection] = await db
                .select({
                  id: collectionTable.id,
                  notionPropertyIds: collectionTable.notionPropertyIds,
                })
                .from(collectionTable)
                .where(
                  and(
                    eq(collectionTable.userId, conn.userId),
                    eq(collectionTable.connectionId, conn.id),
                    eq(collectionTable.ref, ref),
                  ),
                )
                .limit(1);

              if (collection) {
                // Build precise SchemaChangeHints when stored IDs are available
                let hints: SchemaChangeHints | undefined;
                const storedIds: Record<string, string> | null = collection.notionPropertyIds
                  ? (unpack(collection.notionPropertyIds) as Record<string, string>)
                  : null;

                if (storedIds) {
                  const renames: Record<string, string> = {};
                  const additions: string[] = [];
                  const removals: string[] = [];
                  for (const prop of updatedProperties) {
                    const newInternalName = newIdMap[prop.id];
                    const oldInternalName = storedIds[prop.id];
                    if (prop.action === "created" && newInternalName) {
                      additions.push(newInternalName);
                    } else if (prop.action === "deleted" && oldInternalName) {
                      removals.push(oldInternalName);
                    } else if (
                      prop.action === "updated" &&
                      oldInternalName &&
                      newInternalName &&
                      oldInternalName !== newInternalName
                    ) {
                      renames[oldInternalName] = newInternalName;
                    }
                  }
                  hints = { renames, additions, removals };
                  log.info({ hints }, "Precise schema change hints computed");
                } else {
                  log.info({ databaseId }, "No stored property IDs; falling back to heuristic");
                }

                await runWithUser(
                  conn.userId,
                  processSchemaChange(conn.userId, collection.id, schema, newIdMap),
                );
                await getSyncWorkerManager().broadcastSchema(conn.userId, collection.id, hints);
              }
            }
          }
        } catch (err) {
          log.error({ err }, "Failed to handle database.schema_updated");
        }
      }
      await logWebhookEvent(conn.userId, conn.id, eventType, databaseId, "success");
    }
    return new Response("OK", { status: 200 });
  }

  // ---- Data source events ----
  if (eventType.startsWith("data_source.")) {
    collectionCache.clear();
    globalCollectionCache.clear();

    if (eventType === "data_source.schema_updated") {
      const dataSourceId = payload.entity.id;
      log.info({ dataSourceId }, "Schema updated for data source");

      if (conn) {
        const credentials = conn.credentials
          ? await decryptCredentials(conn.userId, conn.credentials)
          : null;
        const token = credentials?.toString("utf8");
        if (token) {
          try {
            const { notion } = await import("@contfu/svc-sources/notion");
            const dataSource = await notion.dataSources.retrieve({
              auth: token,
              data_source_id: dataSourceId,
            });
            if ("properties" in dataSource && dataSource.properties) {
              const { schema, notionPropertyIds } = notionPropertiesToSchemaWithIds(
                dataSource.properties,
              );

              const parentDbId =
                "parent" in dataSource && dataSource.parent?.type === "database_id"
                  ? dataSource.parent.database_id
                  : null;

              if (parentDbId) {
                const ref = uuidToBuffer(parentDbId);
                const [collection] = await db
                  .select({ id: collectionTable.id })
                  .from(collectionTable)
                  .where(
                    and(
                      eq(collectionTable.userId, conn.userId),
                      eq(collectionTable.connectionId, conn.id),
                      eq(collectionTable.ref, ref),
                    ),
                  )
                  .limit(1);

                if (collection) {
                  await runWithUser(
                    conn.userId,
                    processSchemaChange(conn.userId, collection.id, schema, notionPropertyIds),
                  );
                  // Broadcast updated schema to live consumers (heuristic rename detection)
                  await getSyncWorkerManager().broadcastSchema(conn.userId, collection.id);
                }
              }
            }
          } catch (err) {
            log.error({ err }, "Failed to update schema");
          }
        }
        await logWebhookEvent(conn.userId, conn.id, eventType, dataSourceId, "success");
      }
    }

    if (eventType === "data_source.content_updated") {
      const dataSourceId = payload.entity.id;
      log.info({ dataSourceId }, "Content updated for data source");

      if (conn) {
        const credentials = conn.credentials
          ? await decryptCredentials(conn.userId, conn.credentials)
          : null;
        const token = credentials?.toString("utf8");
        if (token) {
          try {
            const { notion } = await import("@contfu/svc-sources/notion");
            const dataSource = await notion.dataSources.retrieve({
              auth: token,
              data_source_id: dataSourceId,
            });

            const parentDbId =
              "parent" in dataSource && dataSource.parent?.type === "database_id"
                ? dataSource.parent.database_id
                : null;

            if (parentDbId) {
              const ref = uuidToBuffer(parentDbId);
              const collections = await db
                .select({ id: collectionTable.id })
                .from(collectionTable)
                .where(
                  and(
                    eq(collectionTable.userId, conn.userId),
                    eq(collectionTable.connectionId, conn.id),
                    eq(collectionTable.ref, ref),
                  ),
                );

              if (collections.length > 0) {
                await run(enqueueSyncJobs(collections.map((c) => c.id)));
              }
            }
          } catch (err) {
            log.error({ err }, "Failed to retrieve data source");
          }
        }
        await logWebhookEvent(conn.userId, conn.id, eventType, dataSourceId, "success");
      }
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
};
