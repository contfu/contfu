import { getStreamServer } from "$lib/server/startup";
import { SourceType, matchesFilters, type UserSyncItem } from "@contfu/svc-core";
import { getSetting } from "@contfu/svc-backend/features/admin/getSetting";
import { upsertSetting } from "@contfu/svc-backend/features/admin/upsertSetting";
import { listInfluxesBySourceCollections } from "@contfu/svc-backend/features/influxes/listInfluxesBySourceCollections";
import { enqueueSyncJobs } from "@contfu/svc-backend/features/sync-jobs/enqueueSyncJobs";
import {
  decryptCredentials,
  encryptCredentials,
} from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  connectionTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import { genUid, uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage, notionPropertiesToSchema } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray } from "drizzle-orm";
import { pack as msgpack } from "msgpackr";
import crypto from "node:crypto";
import { lru } from "tiny-lru";
import * as v from "valibot";
import type { RequestHandler } from "./$types";

/** Maximum webhook logs to keep per source. */
const MAX_LOGS_PER_SOURCE = 50;

/** NOTION_WEBHOOK_SECRET env var for OAuth integration mode. */
const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;

/** Setting key for the stored OAuth verification token. */
const SETTING_OAUTH_TOKEN = "notion_oauth_verification_token";

/** LRU cache for source collections by ref. */
const sourceCollectionCache = lru<{ id: number; ref: Buffer | null }[]>(500, 5 * 60 * 1000);

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
          database_id: v.optional(v.string()),
        }),
      ),
    }),
  ),
});

type SourceInfo = {
  userId: number;
  id: number;
  webhookSecret: Buffer | null;
  credentials: Buffer | null;
};

async function logWebhookEvent(
  userId: number,
  sourceId: number,
  event: string,
  model: string | null,
  status: "success" | "error" | "unauthorized",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      userId,
      sourceId,
      event,
      model,
      status,
      errorMessage,
      itemsBroadcast: itemsBroadcast ?? 0,
    });

    const logs = await db
      .select({ id: webhookLogTable.id })
      .from(webhookLogTable)
      .where(and(eq(webhookLogTable.userId, userId), eq(webhookLogTable.sourceId, sourceId)))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(1000);

    if (logs.length > MAX_LOGS_PER_SOURCE) {
      const idsToDelete = logs.slice(MAX_LOGS_PER_SOURCE).map((l) => l.id);
      await db.delete(webhookLogTable).where(inArray(webhookLogTable.id, idsToDelete));
    }
  } catch (err) {
    console.error("[Notion webhook] Failed to log webhook event:", err);
  }
}

/**
 * Validates HMAC-SHA256 signature using the X-Notion-Signature header.
 */
function validateSignature(body: string, headers: Headers, secret: string): boolean {
  const signature = headers.get("x-notion-signature");
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/**
 * Get source collections from cache or DB for a given ref.
 */
async function getSourceCollectionsByRef(
  userId: number,
  sourceId: number,
  ref: Buffer,
): Promise<{ id: number; ref: Buffer | null }[]> {
  const cacheKey = `${userId}:${sourceId}`;
  const cached = sourceCollectionCache.get(cacheKey);
  if (cached) return cached.filter((c) => c.ref && c.ref.equals(ref));

  const all = await db
    .select({ id: sourceCollectionTable.id, ref: sourceCollectionTable.ref })
    .from(sourceCollectionTable)
    .where(
      and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.sourceId, sourceId)),
    );

  const result = all.map((c) => ({ id: c.id, ref: c.ref as Buffer | null }));
  sourceCollectionCache.set(cacheKey, result);
  return result.filter((c) => c.ref && c.ref.equals(ref));
}

/**
 * Get source collections across all users by ref (OAuth mode).
 */
async function getSourceCollectionsByRefGlobal(ref: Buffer) {
  const cacheKey = `ref:${ref.toString("hex")}`;
  const cached = sourceCollectionCache.get(cacheKey);
  if (cached) return cached;

  const results = await db
    .select({
      id: sourceCollectionTable.id,
      ref: sourceCollectionTable.ref,
      userId: sourceCollectionTable.userId,
      sourceId: sourceCollectionTable.sourceId,
    })
    .from(sourceCollectionTable)
    .where(eq(sourceCollectionTable.ref, ref));

  const mapped = results.map((c) => ({
    id: c.id,
    ref: c.ref as Buffer | null,
    userId: c.userId,
    sourceId: c.sourceId,
  }));
  sourceCollectionCache.set(cacheKey, mapped);
  return mapped;
}

// ============================================================
// Handler
// ============================================================

export const POST: RequestHandler = async ({ request, params }) => {
  const { uid } = params;

  const body = await request.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error("[Notion webhook] Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const parseResult = v.safeParse(NotionWebhookPayloadSchema, parsed);
  if (!parseResult.success) {
    console.error("[Notion webhook] Invalid payload schema");
    return new Response("Invalid payload", { status: 400 });
  }
  const payload = parseResult.output;

  // Determine mode: custom integration (uid matches a source) or OAuth (uid matches env var)
  const isOAuthMode = NOTION_WEBHOOK_SECRET && uid === NOTION_WEBHOOK_SECRET;

  // ---- Verification flow ----
  if (payload.verification_token && !payload.type) {
    console.log("[Notion webhook] Verification request received");

    if (isOAuthMode) {
      // OAuth mode: encrypt and store in settingTable
      const encrypted = await encryptCredentials(
        0,
        Buffer.from(payload.verification_token, "utf8"),
      );
      if (encrypted) {
        await upsertSetting(SETTING_OAUTH_TOKEN, encrypted);
      }
      console.log("[Notion webhook] OAuth verification token stored in settings");
    } else {
      // Custom integration: find source by uid, store as webhookSecret
      const [source] = await db
        .select({ userId: sourceTable.userId, id: sourceTable.id })
        .from(sourceTable)
        .where(and(eq(sourceTable.uid, uid), eq(sourceTable.type, SourceType.NOTION)))
        .limit(1);

      if (source) {
        const encrypted = await encryptCredentials(
          source.userId,
          Buffer.from(payload.verification_token, "utf8"),
        );
        if (encrypted) {
          await db
            .update(sourceTable)
            .set({ webhookSecret: encrypted })
            .where(and(eq(sourceTable.userId, source.userId), eq(sourceTable.id, source.id)));
        }
        // Log the verification token so user can see it in webhook logs
        await logWebhookEvent(
          source.userId,
          source.id,
          "verification",
          payload.verification_token,
          "success",
        );
        console.log(
          `[Notion webhook] Verification token stored for source ${source.userId}:${source.id}`,
        );
      } else {
        console.error(`[Notion webhook] Source with uid ${uid} not found for verification`);
        return new Response("Source not found", { status: 404 });
      }
    }

    return new Response("OK", { status: 200 });
  }

  // ---- Signature validation ----
  if (isOAuthMode) {
    const encryptedToken = await getSetting(SETTING_OAUTH_TOKEN);
    if (!encryptedToken) {
      if (!payload.verification_token) {
        console.error("[Notion webhook] OAuth token not configured");
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      const decrypted = await decryptCredentials(0, encryptedToken);
      const secret = decrypted?.toString("utf8");
      if (!secret || !validateSignature(body, request.headers, secret)) {
        console.error("[Notion webhook] Invalid OAuth signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }
  }

  let source: SourceInfo | null = null;
  if (!isOAuthMode) {
    const [found] = await db
      .select({
        userId: sourceTable.userId,
        id: sourceTable.id,
        webhookSecret: sourceTable.webhookSecret,
        credentials: sourceTable.credentials,
      })
      .from(sourceTable)
      .where(and(eq(sourceTable.uid, uid), eq(sourceTable.type, SourceType.NOTION)))
      .limit(1);

    if (!found) {
      console.error(`[Notion webhook] Source with uid ${uid} not found`);
      return new Response("Source not found", { status: 404 });
    }
    source = found;

    // Validate signature for custom integration
    if (source.webhookSecret) {
      const decrypted = await decryptCredentials(source.userId, source.webhookSecret);
      const secret = decrypted?.toString("utf8");
      if (!secret || !validateSignature(body, request.headers, secret)) {
        console.error(
          `[Notion webhook] Invalid signature for source ${source.userId}:${source.id}`,
        );
        await logWebhookEvent(
          source.userId,
          source.id,
          payload.type ?? "unknown",
          null,
          "unauthorized",
          "Invalid webhook signature",
        );
        return new Response("Unauthorized", { status: 401 });
      }
    } else if (!payload.verification_token) {
      console.error(
        `[Notion webhook] Webhook secret not configured for source ${source.userId}:${source.id}`,
      );
      await logWebhookEvent(
        source.userId,
        source.id,
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
    return new Response("OK", { status: 200 });
  }

  console.log(`[Notion webhook] Received ${eventType} for entity ${payload.entity.id}`);

  const streamServer = getStreamServer();

  // ---- Page events ----
  if (eventType.startsWith("page.")) {
    const pageId = payload.entity.id;

    // Ignore lock events
    if (eventType === "page.locked" || eventType === "page.unlocked") {
      return new Response("OK", { status: 200 });
    }

    // ---- DELETED ----
    if (eventType === "page.deleted") {
      const itemId = genUid(uuidToBuffer(pageId));

      if (source) {
        // Custom mode: find source collections via parent database
        const parentDbId = payload.data?.parent?.database_id;
        if (!parentDbId) {
          await logWebhookEvent(
            source.userId,
            source.id,
            eventType,
            pageId,
            "success",
            "No parent database ID",
            0,
          );
          return new Response("OK", { status: 200 });
        }

        const ref = uuidToBuffer(parentDbId);
        const sourceCollections = await getSourceCollectionsByRef(source.userId, source.id, ref);
        if (sourceCollections.length === 0) {
          await logWebhookEvent(
            source.userId,
            source.id,
            eventType,
            pageId,
            "success",
            "No matching source collections",
            0,
          );
          return new Response("OK", { status: 200 });
        }

        const sourceCollectionIds = sourceCollections.map((c) => c.id);
        const influxes = await listInfluxesBySourceCollections(source.userId, sourceCollectionIds);
        const targetCollectionIds = [...new Set(influxes.map((i) => i.collectionId))];

        if (targetCollectionIds.length === 0) {
          await logWebhookEvent(
            source.userId,
            source.id,
            eventType,
            pageId,
            "success",
            "No influxes",
            0,
          );
          return new Response("OK", { status: 200 });
        }

        const connections = await db
          .select({
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .where(
            and(
              eq(connectionTable.userId, source.userId),
              inArray(connectionTable.collectionId, targetCollectionIds),
            ),
          );

        if (connections.length > 0) {
          await streamServer.broadcastDeleted(
            itemId,
            connections.map((c) => ({
              userId: source!.userId,
              consumerId: c.consumerId,
              collectionId: c.collectionId,
              lastItemChanged: c.lastItemChanged,
            })),
          );
        }

        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          pageId,
          "success",
          undefined,
          connections.length,
        );
      } else {
        // OAuth mode
        const parentDbId = payload.data?.parent?.database_id;
        if (parentDbId) {
          const ref = uuidToBuffer(parentDbId);
          const globalCollections = await getSourceCollectionsByRefGlobal(ref);
          for (const sc of globalCollections) {
            const influxes = await listInfluxesBySourceCollections(sc.userId, [sc.id]);
            const targetCollectionIds = [...new Set(influxes.map((i) => i.collectionId))];
            if (targetCollectionIds.length === 0) continue;

            const connections = await db
              .select({
                consumerId: connectionTable.consumerId,
                collectionId: connectionTable.collectionId,
                lastItemChanged: connectionTable.lastItemChanged,
              })
              .from(connectionTable)
              .where(
                and(
                  eq(connectionTable.userId, sc.userId),
                  inArray(connectionTable.collectionId, targetCollectionIds),
                ),
              );

            if (connections.length > 0) {
              await streamServer.broadcastDeleted(
                itemId,
                connections.map((c) => ({
                  userId: sc.userId,
                  consumerId: c.consumerId,
                  collectionId: c.collectionId,
                  lastItemChanged: c.lastItemChanged,
                })),
              );
            }
          }
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---- CHANGED (page.created, page.content_updated, page.properties_updated, page.moved, page.undeleted) ----
    if (source) {
      // Custom mode
      const credentials = source.credentials
        ? await decryptCredentials(source.userId, source.credentials)
        : null;
      const token = credentials?.toString("utf8");
      if (!token) {
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          pageId,
          "error",
          "No credentials",
        );
        return new Response("OK", { status: 200 });
      }

      let parentDbId = payload.data?.parent?.database_id;
      let result: Awaited<ReturnType<typeof fetchNotionPage>> = null;

      try {
        result = await fetchNotionPage(token, pageId, 0);
        if (result && !parentDbId) {
          parentDbId = result.parentDatabaseId ?? undefined;
        }
      } catch (err) {
        console.error(`[Notion webhook] Failed to fetch page ${pageId}:`, err);
        await logWebhookEvent(source.userId, source.id, eventType, pageId, "error", String(err));
        return new Response("OK", { status: 200 });
      }

      if (!result || !parentDbId) {
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          pageId,
          "success",
          "Page not found or no parent database",
          0,
        );
        return new Response("OK", { status: 200 });
      }

      const ref = uuidToBuffer(parentDbId);
      const sourceCollections = await getSourceCollectionsByRef(source.userId, source.id, ref);
      if (sourceCollections.length === 0) {
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          pageId,
          "success",
          "No matching source collections",
          0,
        );
        return new Response("OK", { status: 200 });
      }

      const sourceCollectionIds = sourceCollections.map((c) => c.id);
      const influxes = await listInfluxesBySourceCollections(source.userId, sourceCollectionIds);
      if (influxes.length === 0) {
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          pageId,
          "success",
          "No influxes",
          0,
        );
        return new Response("OK", { status: 200 });
      }

      let itemsBroadcast = 0;
      const targetCollectionIds: number[] = [];
      for (const influx of influxes) {
        if (influx.filters.length > 0 && !matchesFilters(result.item.props, influx.filters)) {
          continue;
        }
        targetCollectionIds.push(influx.collectionId);
      }

      if (targetCollectionIds.length > 0) {
        const connections = await db
          .select({
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .where(
            and(
              eq(connectionTable.userId, source.userId),
              inArray(connectionTable.collectionId, targetCollectionIds),
            ),
          );

        for (const collectionId of targetCollectionIds) {
          const item: UserSyncItem = {
            ...result.item,
            user: source.userId,
            collection: collectionId,
          };
          const collectionConnections = connections
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId: source!.userId,
              consumerId: c.consumerId,
              collectionId: c.collectionId,
              lastItemChanged: c.lastItemChanged,
            }));
          if (collectionConnections.length > 0) {
            await streamServer.broadcast([item], collectionConnections);
            itemsBroadcast += collectionConnections.length;
          }
        }
      }

      await logWebhookEvent(
        source.userId,
        source.id,
        eventType,
        pageId,
        "success",
        undefined,
        itemsBroadcast,
      );
    } else {
      // OAuth mode: route to all matching users
      let parentDbId = payload.data?.parent?.database_id;

      if (!parentDbId) {
        // Can't route without parent database
        return new Response("OK", { status: 200 });
      }

      const ref = uuidToBuffer(parentDbId);
      const globalCollections = await getSourceCollectionsByRefGlobal(ref);

      // Group by userId:sourceId
      const groups = new Map<string, typeof globalCollections>();
      for (const sc of globalCollections) {
        const key = `${sc.userId}:${sc.sourceId}`;
        const group = groups.get(key) ?? [];
        if (group.length === 0) groups.set(key, group);
        group.push(sc);
      }

      for (const [, group] of groups) {
        const { userId, sourceId } = group[0];

        // Get source credentials
        const [srcRow] = await db
          .select({ credentials: sourceTable.credentials })
          .from(sourceTable)
          .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, sourceId)))
          .limit(1);

        if (!srcRow?.credentials) continue;
        const credentials = await decryptCredentials(userId, srcRow.credentials);
        const token = credentials?.toString("utf8");
        if (!token) continue;

        let result: Awaited<ReturnType<typeof fetchNotionPage>> = null;
        try {
          result = await fetchNotionPage(token, pageId, 0);
        } catch (err) {
          console.error(`[Notion webhook] OAuth: Failed to fetch page for user ${userId}:`, err);
          continue;
        }
        if (!result) continue;

        const sourceCollectionIds = group.map((c) => c.id);
        const influxes = await listInfluxesBySourceCollections(userId, sourceCollectionIds);

        const targetCollectionIds: number[] = [];
        for (const influx of influxes) {
          if (influx.filters.length > 0 && !matchesFilters(result.item.props, influx.filters)) {
            continue;
          }
          targetCollectionIds.push(influx.collectionId);
        }

        if (targetCollectionIds.length === 0) continue;

        const connections = await db
          .select({
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .where(
            and(
              eq(connectionTable.userId, userId),
              inArray(connectionTable.collectionId, targetCollectionIds),
            ),
          );

        for (const collectionId of targetCollectionIds) {
          const item: UserSyncItem = {
            ...result.item,
            user: userId,
            collection: collectionId,
          };
          const collectionConnections = connections
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId,
              consumerId: c.consumerId,
              collectionId: c.collectionId,
              lastItemChanged: c.lastItemChanged,
            }));
          if (collectionConnections.length > 0) {
            await streamServer.broadcast([item], collectionConnections);
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  }

  // ---- Data source events ----
  if (eventType.startsWith("data_source.")) {
    // Invalidate LRU cache on any data source event
    sourceCollectionCache.clear();

    if (eventType === "data_source.schema_updated") {
      const dataSourceId = payload.entity.id;
      console.log(`[Notion webhook] Schema updated for data source ${dataSourceId}`);

      if (source) {
        const credentials = source.credentials
          ? await decryptCredentials(source.userId, source.credentials)
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
              const schema = notionPropertiesToSchema(dataSource.properties);
              const schemaBuf = Buffer.from(msgpack(schema));

              // Find source collections using this data source's parent database
              const parentDbId =
                "parent" in dataSource && dataSource.parent?.type === "database_id"
                  ? dataSource.parent.database_id
                  : null;

              if (parentDbId) {
                const ref = uuidToBuffer(parentDbId);
                await db
                  .update(sourceCollectionTable)
                  .set({ schema: schemaBuf })
                  .where(
                    and(
                      eq(sourceCollectionTable.userId, source.userId),
                      eq(sourceCollectionTable.sourceId, source.id),
                      eq(sourceCollectionTable.ref, ref),
                    ),
                  );
              }
            }
          } catch (err) {
            console.error(`[Notion webhook] Failed to update schema:`, err);
          }
        }
        await logWebhookEvent(source.userId, source.id, eventType, dataSourceId, "success");
      }
    }

    if (eventType === "data_source.content_updated") {
      const dataSourceId = payload.entity.id;
      console.log(`[Notion webhook] Content updated for data source ${dataSourceId}`);

      if (source) {
        const credentials = source.credentials
          ? await decryptCredentials(source.userId, source.credentials)
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
              const sourceCollections = await db
                .select({ id: sourceCollectionTable.id })
                .from(sourceCollectionTable)
                .where(
                  and(
                    eq(sourceCollectionTable.userId, source.userId),
                    eq(sourceCollectionTable.sourceId, source.id),
                    eq(sourceCollectionTable.ref, ref),
                  ),
                );

              if (sourceCollections.length > 0) {
                await enqueueSyncJobs(
                  db,
                  source.userId,
                  sourceCollections.map((c) => c.id),
                );
              }
            }
          } catch (err) {
            console.error(`[Notion webhook] Failed to retrieve data source:`, err);
          }
        }
        await logWebhookEvent(source.userId, source.id, eventType, dataSourceId, "success");
      }
    }

    return new Response("OK", { status: 200 });
  }

  // Unknown event type - acknowledge anyway
  return new Response("OK", { status: 200 });
};
