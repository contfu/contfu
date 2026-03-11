import { getStreamServer } from "$lib/server/startup";
import { ConnectionType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { getSetting } from "@contfu/svc-backend/features/admin/getSetting";
import { upsertSetting } from "@contfu/svc-backend/features/admin/upsertSetting";
import { enqueueSyncJobs } from "@contfu/svc-backend/features/sync-jobs/enqueueSyncJobs";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import { Effect } from "effect";
import {
  decryptCredentials,
  encryptCredentials,
} from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import { notionRefUrlFromRawUuid } from "@contfu/svc-sources";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { cancelPending, markPending } from "@contfu/svc-backend/infra/webhook-queue/pending-kv";
import { enqueueWebhookFetch } from "@contfu/svc-backend/infra/webhook-queue/webhook-fetch-queue";
import { matchesFilters, type Filter } from "@contfu/svc-core";
import { genUid, uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage, notionPropertiesToSchema } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import crypto from "node:crypto";
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
          database_id: v.optional(v.string()),
        }),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const parseResult = v.safeParse(NotionWebhookPayloadSchema, parsed);
  if (!parseResult.success) {
    log.warn("Invalid payload schema");
    return new Response("Invalid payload", { status: 400 });
  }
  const payload = parseResult.output;

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
        await runEffectWithServices(upsertSetting(SETTING_OAUTH_TOKEN, encrypted));
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
    const encryptedToken = await runEffectWithServices(getSetting(SETTING_OAUTH_TOKEN));
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
    return new Response("OK", { status: 200 });
  }

  log.info({ eventType, entityId: payload.entity.id }, "Received webhook event");

  const streamServer = getStreamServer();

  // ---- Page events ----
  if (eventType.startsWith("page.")) {
    const pageId = payload.entity.id;

    if (eventType === "page.locked" || eventType === "page.unlocked") {
      return new Response("OK", { status: 200 });
    }

    // ---- DELETED ----
    if (eventType === "page.deleted") {
      const itemId = genUid(uuidToBuffer(pageId));

      if (conn) {
        if (hasNats()) {
          await cancelPending(conn.userId, conn.id, pageId);
        }

        const parentDbId = payload.data?.parent?.database_id;
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
          await streamServer.broadcastDeleted(
            itemId,
            clients.map((c) => ({
              userId: conn!.userId,
              connectionId: c.connectionId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                Boolean(conn!.includeRef),
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
        const parentDbId = payload.data?.parent?.database_id;
        if (parentDbId) {
          const ref = uuidToBuffer(parentDbId);
          const globalCollections = await getCollectionsByRefGlobal(ref);
          const grouped = new Map<string, { userId: number; connectionId: number }>();
          for (const gc of globalCollections) {
            grouped.set(`${gc.userId}:${gc.connectionId}`, {
              userId: gc.userId,
              connectionId: gc.connectionId,
            });
          }

          if (hasNats()) {
            for (const g of grouped.values()) {
              await cancelPending(g.userId, g.connectionId, pageId);
            }
          }

          for (const gc of globalCollections) {
            const { clients } = await getFlowsAndClients(gc.userId, [gc.id], true);
            if (clients.length > 0) {
              await streamServer.broadcastDeleted(
                itemId,
                clients.map((c) => ({
                  userId: gc.userId,
                  connectionId: c.connectionId,
                  collectionId: c.collectionId,
                  includeRef: Boolean(c.connectionIncludeRef) && Boolean(c.collectionIncludeRef),
                })),
              );
            }
          }
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---- CHANGED (page.created, page.content_updated, etc.) ----
    if (isPageChangeEvent(eventType) && hasNats()) {
      const parentDbId = payload.data?.parent?.database_id;

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
        return new Response("OK", { status: 200 });
      }

      const ref = uuidToBuffer(parentDbId);
      const globalCollections = await getCollectionsByRefGlobal(ref);
      const grouped = new Map<string, { userId: number; connectionId: number }>();
      for (const gc of globalCollections) {
        grouped.set(`${gc.userId}:${gc.connectionId}`, {
          userId: gc.userId,
          connectionId: gc.connectionId,
        });
      }

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
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---- CHANGED (fallback inline mode without NATS) ----
    if (conn) {
      const credentials = conn.credentials
        ? await decryptCredentials(conn.userId, conn.credentials)
        : null;
      const token = credentials?.toString("utf8");
      if (!token) {
        await logWebhookEvent(conn.userId, conn.id, eventType, pageId, "error", "No credentials");
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
        log.error({ err, pageId }, "Failed to fetch page");
        await logWebhookEvent(conn.userId, conn.id, eventType, pageId, "error", String(err));
        return new Response("OK", { status: 200 });
      }

      if (!result || !parentDbId) {
        await logWebhookEvent(
          conn.userId,
          conn.id,
          eventType,
          pageId,
          "success",
          "Page not found or no parent database",
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

      if (flows.length === 0) {
        await logWebhookEvent(conn.userId, conn.id, eventType, pageId, "success", "No flows", 0);
        return new Response("OK", { status: 200 });
      }

      // Apply filters and broadcast
      let itemsBroadcast = 0;
      const targetCollectionIds: number[] = [];
      const collectionRefPolicy = new Map<number, boolean>();
      for (const flow of flows) {
        if (flow.filters) {
          const filters = unpack(flow.filters) as Filter[];
          if (filters.length > 0 && !matchesFilters(result.item.props, filters)) {
            continue;
          }
        }
        targetCollectionIds.push(flow.targetId);
        const previous = collectionRefPolicy.get(flow.targetId) ?? true;
        collectionRefPolicy.set(
          flow.targetId,
          previous && Boolean(conn.includeRef) && Boolean(flow.includeRef),
        );
      }

      if (targetCollectionIds.length > 0 && clients.length > 0) {
        for (const collectionId of new Set(targetCollectionIds)) {
          const item: UserSyncItem = {
            ...result.item,
            ref: notionRefUrlFromRawUuid(result.item.ref),
            sourceType: ConnectionType.NOTION,
            user: conn.userId,
            collection: collectionId,
          };
          const collectionClients = clients
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId: conn!.userId,
              connectionId: c.connectionId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                (collectionRefPolicy.get(c.collectionId) ?? true),
            }));
          if (collectionClients.length > 0) {
            await streamServer.broadcast([item], collectionClients);
            itemsBroadcast += collectionClients.length;
          }
        }
      }

      await logWebhookEvent(
        conn.userId,
        conn.id,
        eventType,
        pageId,
        "success",
        undefined,
        itemsBroadcast,
      );
    } else {
      // OAuth mode inline
      let parentDbId = payload.data?.parent?.database_id;
      if (!parentDbId) return new Response("OK", { status: 200 });

      const ref = uuidToBuffer(parentDbId);
      const globalCollections = await getCollectionsByRefGlobal(ref);

      const groups = new Map<string, typeof globalCollections>();
      for (const gc of globalCollections) {
        const key = `${gc.userId}:${gc.connectionId}`;
        const group = groups.get(key) ?? [];
        if (group.length === 0) groups.set(key, group);
        group.push(gc);
      }

      for (const [, group] of groups) {
        const { userId, connectionId } = group[0];

        const [connRow] = await db
          .select({
            credentials: connectionTable.credentials,
            includeRef: connectionTable.includeRef,
          })
          .from(connectionTable)
          .where(and(eq(connectionTable.userId, userId), eq(connectionTable.id, connectionId)))
          .limit(1);

        if (!connRow?.credentials) continue;
        const credentials = await decryptCredentials(userId, connRow.credentials);
        const token = credentials?.toString("utf8");
        if (!token) continue;

        let result: Awaited<ReturnType<typeof fetchNotionPage>> = null;
        try {
          result = await fetchNotionPage(token, pageId, 0);
        } catch (err) {
          log.error({ err, userId, pageId }, "OAuth: Failed to fetch page");
          continue;
        }
        if (!result) continue;

        const sourceCollectionIds = group.map((c) => c.id);
        const { flows, clients } = await getFlowsAndClients(
          userId,
          sourceCollectionIds,
          connRow.includeRef,
        );

        const targetCollectionIds: number[] = [];
        const collectionRefPolicy = new Map<number, boolean>();
        for (const flow of flows) {
          if (flow.filters) {
            const filters = unpack(flow.filters) as Filter[];
            if (filters.length > 0 && !matchesFilters(result.item.props, filters)) continue;
          }
          targetCollectionIds.push(flow.targetId);
          const previous = collectionRefPolicy.get(flow.targetId) ?? true;
          collectionRefPolicy.set(
            flow.targetId,
            previous && Boolean(connRow.includeRef) && Boolean(flow.includeRef),
          );
        }

        if (targetCollectionIds.length === 0) continue;

        for (const collectionId of new Set(targetCollectionIds)) {
          const item: UserSyncItem = {
            ...result.item,
            ref: notionRefUrlFromRawUuid(result.item.ref),
            sourceType: ConnectionType.NOTION,
            user: userId,
            collection: collectionId,
          };
          const collectionClients = clients
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId,
              connectionId: c.connectionId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                (collectionRefPolicy.get(c.collectionId) ?? true),
            }));
          if (collectionClients.length > 0) {
            await streamServer.broadcast([item], collectionClients);
          }
        }
      }
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
              const schema = notionPropertiesToSchema(dataSource.properties);
              const schemaBuf = Buffer.from(pack(schema));

              const parentDbId =
                "parent" in dataSource && dataSource.parent?.type === "database_id"
                  ? dataSource.parent.database_id
                  : null;

              if (parentDbId) {
                const ref = uuidToBuffer(parentDbId);
                await db
                  .update(collectionTable)
                  .set({ schema: schemaBuf })
                  .where(
                    and(
                      eq(collectionTable.userId, conn.userId),
                      eq(collectionTable.connectionId, conn.id),
                      eq(collectionTable.ref, ref),
                    ),
                  );
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
                await Effect.runPromise(
                  enqueueSyncJobs(
                    db,
                    collections.map((c) => c.id),
                  ),
                );
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
