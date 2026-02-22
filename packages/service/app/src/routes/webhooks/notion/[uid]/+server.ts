import { getStreamServer } from "$lib/server/startup";
import { SourceType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
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
  collectionTable,
  connectionTable,
  consumerTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import { hasNats } from "@contfu/svc-backend/infra/nats/connection";
import { notionRefUrlFromRawUuid } from "@contfu/svc-backend/infra/refs/encode-ref";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { cancelPending, markPending } from "@contfu/svc-backend/infra/webhook-queue/pending-kv";
import { enqueueWebhookFetch } from "@contfu/svc-backend/infra/webhook-queue/webhook-fetch-queue";
import { matchesFilters } from "@contfu/svc-core";
import { genUid, uuidToBuffer } from "@contfu/svc-sources";
import { fetchNotionPage, notionPropertiesToSchema } from "@contfu/svc-sources/notion";
import { and, desc, eq, inArray } from "drizzle-orm";
import { pack } from "msgpackr";
import crypto from "node:crypto";
import { lru } from "tiny-lru";
import * as v from "valibot";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-notion");

/** Maximum webhook logs to keep per source. */
const MAX_LOGS_PER_SOURCE = 50;

/** NOTION_WEBHOOK_SECRET env var for OAuth integration mode. */
const NOTION_WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET;

/** Setting key for the stored OAuth verification token. */
const SETTING_OAUTH_TOKEN = "notion_oauth_verification_token";

type CachedSourceCollectionRef = {
  id: number;
  ref: Buffer | null;
};

type CachedGlobalSourceCollectionRef = CachedSourceCollectionRef & {
  userId: number;
  sourceId: number;
};

/** LRU cache for source collections by ref. */
const sourceCollectionCache = lru<CachedSourceCollectionRef[]>(500, 5 * 60 * 1000);
const globalSourceCollectionCache = lru<CachedGlobalSourceCollectionRef[]>(500, 5 * 60 * 1000);

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
  includeRef: boolean;
  webhookSecret: Buffer | null;
  credentials: Buffer | null;
};

function isPageChangeEvent(eventType: string): boolean {
  return eventType.startsWith("page.") && eventType !== "page.deleted";
}

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
      .where(eq(webhookLogTable.sourceId, sourceId))
      .orderBy(desc(webhookLogTable.timestamp))
      .limit(1000);

    if (logs.length > MAX_LOGS_PER_SOURCE) {
      const idsToDelete = logs.slice(MAX_LOGS_PER_SOURCE).map((l) => l.id);
      await db.delete(webhookLogTable).where(inArray(webhookLogTable.id, idsToDelete));
    }
  } catch (err) {
    log.error({ err }, "Failed to log webhook event");
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
  const cached = globalSourceCollectionCache.get(cacheKey);
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
  globalSourceCollectionCache.set(cacheKey, mapped);
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
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const parseResult = v.safeParse(NotionWebhookPayloadSchema, parsed);
  if (!parseResult.success) {
    log.warn("Invalid payload schema");
    return new Response("Invalid payload", { status: 400 });
  }
  const payload = parseResult.output;

  // Determine mode: custom integration (uid matches a source) or OAuth (uid matches env var)
  const isOAuthMode = NOTION_WEBHOOK_SECRET && uid === NOTION_WEBHOOK_SECRET;

  // ---- Verification flow ----
  if (payload.verification_token && !payload.type) {
    log.info("Verification request received");

    if (isOAuthMode) {
      // OAuth mode: encrypt and store in settingTable
      const encrypted = await encryptCredentials(
        0,
        Buffer.from(payload.verification_token, "utf8"),
      );
      if (encrypted) {
        await upsertSetting(SETTING_OAUTH_TOKEN, encrypted);
      }
      log.info("OAuth verification token stored in settings");
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
        log.info(
          { userId: source.userId, sourceId: source.id },
          "Verification token stored for source",
        );
      } else {
        log.warn({ uid }, "Source not found for verification");
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

  let source: SourceInfo | null = null;
  if (!isOAuthMode) {
    const [found] = await db
      .select({
        userId: sourceTable.userId,
        id: sourceTable.id,
        includeRef: sourceTable.includeRef,
        webhookSecret: sourceTable.webhookSecret,
        credentials: sourceTable.credentials,
      })
      .from(sourceTable)
      .where(and(eq(sourceTable.uid, uid), eq(sourceTable.type, SourceType.NOTION)))
      .limit(1);

    if (!found) {
      log.warn({ uid }, "Source not found");
      return new Response("Source not found", { status: 404 });
    }
    source = found;

    // Validate signature for custom integration
    if (source.webhookSecret) {
      const decrypted = await decryptCredentials(source.userId, source.webhookSecret);
      const secret = decrypted?.toString("utf8");
      if (!secret || !validateSignature(body, request.headers, secret)) {
        log.warn({ userId: source.userId, sourceId: source.id }, "Invalid signature");
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
      log.warn({ userId: source.userId, sourceId: source.id }, "Webhook secret not configured");
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

  log.info({ eventType, entityId: payload.entity.id }, "Received webhook event");

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
        if (hasNats()) {
          await cancelPending(source.userId, source.id, pageId);
        }

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
        const collectionRefPolicy = new Map<number, boolean>();
        for (const influx of influxes) {
          const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
          collectionRefPolicy.set(
            influx.collectionId,
            previous && Boolean(source.includeRef) && Boolean(influx.includeRef),
          );
        }

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
            connectionIncludeRef: connectionTable.includeRef,
            consumerIncludeRef: consumerTable.includeRef,
            collectionIncludeRef: collectionTable.includeRef,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .innerJoin(
            collectionTable,
            and(
              eq(connectionTable.userId, collectionTable.userId),
              eq(connectionTable.collectionId, collectionTable.id),
            ),
          )
          .innerJoin(
            consumerTable,
            and(
              eq(connectionTable.userId, consumerTable.userId),
              eq(connectionTable.consumerId, consumerTable.id),
            ),
          )
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
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.consumerIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                (collectionRefPolicy.get(c.collectionId) ?? true),
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
          const groupedSources = new Map<string, { userId: number; sourceId: number }>();
          for (const sc of globalCollections) {
            groupedSources.set(`${sc.userId}:${sc.sourceId}`, {
              userId: sc.userId,
              sourceId: sc.sourceId,
            });
          }

          if (hasNats()) {
            for (const grouped of groupedSources.values()) {
              await cancelPending(grouped.userId, grouped.sourceId, pageId);
            }
          }

          for (const sc of globalCollections) {
            const influxes = await listInfluxesBySourceCollections(sc.userId, [sc.id]);
            const targetCollectionIds = [...new Set(influxes.map((i) => i.collectionId))];
            if (targetCollectionIds.length === 0) continue;
            const [src] = await db
              .select({ includeRef: sourceTable.includeRef })
              .from(sourceTable)
              .where(and(eq(sourceTable.userId, sc.userId), eq(sourceTable.id, sc.sourceId)))
              .limit(1);
            if (!src) continue;
            const collectionRefPolicy = new Map<number, boolean>();
            for (const influx of influxes) {
              const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
              collectionRefPolicy.set(
                influx.collectionId,
                previous && Boolean(src.includeRef) && Boolean(influx.includeRef),
              );
            }

            const connections = await db
              .select({
                consumerId: connectionTable.consumerId,
                collectionId: connectionTable.collectionId,
                connectionIncludeRef: connectionTable.includeRef,
                consumerIncludeRef: consumerTable.includeRef,
                collectionIncludeRef: collectionTable.includeRef,
                lastItemChanged: connectionTable.lastItemChanged,
              })
              .from(connectionTable)
              .innerJoin(
                collectionTable,
                and(
                  eq(connectionTable.userId, collectionTable.userId),
                  eq(connectionTable.collectionId, collectionTable.id),
                ),
              )
              .innerJoin(
                consumerTable,
                and(
                  eq(connectionTable.userId, consumerTable.userId),
                  eq(connectionTable.consumerId, consumerTable.id),
                ),
              )
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
                  includeRef:
                    Boolean(c.connectionIncludeRef) &&
                    Boolean(c.consumerIncludeRef) &&
                    Boolean(c.collectionIncludeRef) &&
                    (collectionRefPolicy.get(c.collectionId) ?? true),
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
    if (isPageChangeEvent(eventType) && hasNats()) {
      const parentDbId = payload.data?.parent?.database_id;

      if (source) {
        const marked = await markPending(source.userId, source.id, pageId);
        if (marked) {
          await enqueueWebhookFetch({
            userId: source.userId,
            sourceId: source.id,
            pageId,
            eventType,
            parentDatabaseId: parentDbId,
            enqueuedAt: Date.now(),
          });
          await logWebhookEvent(
            source.userId,
            source.id,
            eventType,
            pageId,
            "success",
            "Webhook fetch enqueued",
            0,
          );
        } else {
          await logWebhookEvent(
            source.userId,
            source.id,
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
      const globalCollections = await getSourceCollectionsByRefGlobal(ref);
      const groupedSources = new Map<string, { userId: number; sourceId: number }>();
      for (const sc of globalCollections) {
        groupedSources.set(`${sc.userId}:${sc.sourceId}`, {
          userId: sc.userId,
          sourceId: sc.sourceId,
        });
      }

      for (const grouped of groupedSources.values()) {
        const marked = await markPending(grouped.userId, grouped.sourceId, pageId);
        if (marked) {
          await enqueueWebhookFetch({
            userId: grouped.userId,
            sourceId: grouped.sourceId,
            pageId,
            eventType,
            parentDatabaseId: parentDbId,
            enqueuedAt: Date.now(),
          });
          await logWebhookEvent(
            grouped.userId,
            grouped.sourceId,
            eventType,
            pageId,
            "success",
            "Webhook fetch enqueued",
            0,
          );
        } else {
          await logWebhookEvent(
            grouped.userId,
            grouped.sourceId,
            eventType,
            pageId,
            "success",
            "Skipped duplicate pending webhook fetch",
            0,
          );
        }
      }

      return new Response("OK", { status: 200 });
    }

    // ---- CHANGED (fallback inline mode without NATS) ----
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
        log.error({ err, pageId }, "Failed to fetch page");
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
      const collectionRefPolicy = new Map<number, boolean>();
      for (const influx of influxes) {
        if (influx.filters.length > 0 && !matchesFilters(result.item.props, influx.filters)) {
          continue;
        }
        targetCollectionIds.push(influx.collectionId);
        const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
        collectionRefPolicy.set(
          influx.collectionId,
          previous && Boolean(source.includeRef) && Boolean(influx.includeRef),
        );
      }

      if (targetCollectionIds.length > 0) {
        const connections = await db
          .select({
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            connectionIncludeRef: connectionTable.includeRef,
            consumerIncludeRef: consumerTable.includeRef,
            collectionIncludeRef: collectionTable.includeRef,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .innerJoin(
            collectionTable,
            and(
              eq(connectionTable.userId, collectionTable.userId),
              eq(connectionTable.collectionId, collectionTable.id),
            ),
          )
          .innerJoin(
            consumerTable,
            and(
              eq(connectionTable.userId, consumerTable.userId),
              eq(connectionTable.consumerId, consumerTable.id),
            ),
          )
          .where(
            and(
              eq(connectionTable.userId, source.userId),
              inArray(connectionTable.collectionId, targetCollectionIds),
            ),
          );

        for (const collectionId of targetCollectionIds) {
          const item: UserSyncItem = {
            ...result.item,
            ref: notionRefUrlFromRawUuid(result.item.ref),
            sourceType: SourceType.NOTION,
            user: source.userId,
            collection: collectionId,
          };
          const collectionConnections = connections
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId: source!.userId,
              consumerId: c.consumerId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.consumerIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                (collectionRefPolicy.get(c.collectionId) ?? true),
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
          .select({ credentials: sourceTable.credentials, includeRef: sourceTable.includeRef })
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
          log.error({ err, userId, pageId }, "OAuth: Failed to fetch page");
          continue;
        }
        if (!result) continue;

        const sourceCollectionIds = group.map((c) => c.id);
        const influxes = await listInfluxesBySourceCollections(userId, sourceCollectionIds);

        const targetCollectionIds: number[] = [];
        const collectionRefPolicy = new Map<number, boolean>();
        for (const influx of influxes) {
          if (influx.filters.length > 0 && !matchesFilters(result.item.props, influx.filters)) {
            continue;
          }
          targetCollectionIds.push(influx.collectionId);
          const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
          collectionRefPolicy.set(
            influx.collectionId,
            previous && Boolean(srcRow.includeRef) && Boolean(influx.includeRef),
          );
        }

        if (targetCollectionIds.length === 0) continue;

        const connections = await db
          .select({
            consumerId: connectionTable.consumerId,
            collectionId: connectionTable.collectionId,
            connectionIncludeRef: connectionTable.includeRef,
            consumerIncludeRef: consumerTable.includeRef,
            collectionIncludeRef: collectionTable.includeRef,
            lastItemChanged: connectionTable.lastItemChanged,
          })
          .from(connectionTable)
          .innerJoin(
            collectionTable,
            and(
              eq(connectionTable.userId, collectionTable.userId),
              eq(connectionTable.collectionId, collectionTable.id),
            ),
          )
          .innerJoin(
            consumerTable,
            and(
              eq(connectionTable.userId, consumerTable.userId),
              eq(connectionTable.consumerId, consumerTable.id),
            ),
          )
          .where(
            and(
              eq(connectionTable.userId, userId),
              inArray(connectionTable.collectionId, targetCollectionIds),
            ),
          );

        for (const collectionId of targetCollectionIds) {
          const item: UserSyncItem = {
            ...result.item,
            ref: notionRefUrlFromRawUuid(result.item.ref),
            sourceType: SourceType.NOTION,
            user: userId,
            collection: collectionId,
          };
          const collectionConnections = connections
            .filter((c) => c.collectionId === collectionId)
            .map((c) => ({
              userId,
              consumerId: c.consumerId,
              collectionId: c.collectionId,
              includeRef:
                Boolean(c.connectionIncludeRef) &&
                Boolean(c.consumerIncludeRef) &&
                Boolean(c.collectionIncludeRef) &&
                (collectionRefPolicy.get(c.collectionId) ?? true),
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
    globalSourceCollectionCache.clear();

    if (eventType === "data_source.schema_updated") {
      const dataSourceId = payload.entity.id;
      log.info({ dataSourceId }, "Schema updated for data source");

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
              const schemaBuf = Buffer.from(pack(schema));

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
            log.error({ err }, "Failed to update schema");
          }
        }
        await logWebhookEvent(source.userId, source.id, eventType, dataSourceId, "success");
      }
    }

    if (eventType === "data_source.content_updated") {
      const dataSourceId = payload.entity.id;
      log.info({ dataSourceId }, "Content updated for data source");

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
                  sourceCollections.map((c) => c.id),
                );
              }
            }
          } catch (err) {
            log.error({ err }, "Failed to retrieve data source");
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
