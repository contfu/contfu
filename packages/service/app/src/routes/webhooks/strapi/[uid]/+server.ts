import { getStreamServer } from "$lib/server/startup";
import { ConnectionType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import { Database } from "@contfu/svc-backend/effect/services/Database";
import { processSchemaChange } from "@contfu/svc-backend/features/schema-sync";
import { Effect } from "effect";
import { decryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { strapiRefUrl } from "@contfu/svc-sources";
import { getCollectionSchema } from "@contfu/svc-sources/strapi";
import { matchesFilters, type CollectionSchema, type Filter } from "@contfu/svc-core";
import { genUid } from "@contfu/svc-sources";
import { and, desc, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-strapi");

const MAX_LOGS_PER_CONNECTION = 50;

/** TTL cache to avoid fetching schema on every webhook (5 min per connection+contentType) */
const schemaCheckCache = new Map<string, number>();
const SCHEMA_CHECK_TTL_MS = 5 * 60 * 1000;

type StrapiEvent =
  | "entry.create"
  | "entry.update"
  | "entry.delete"
  | "entry.publish"
  | "entry.unpublish";

interface StrapiWebhookPayload {
  event: StrapiEvent;
  createdAt: string;
  model: string;
  uid?: string;
  entry: {
    id: number;
    documentId?: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    [key: string]: unknown;
  };
}

async function logWebhookEvent(
  _userId: number,
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

function validateSignature(body: string, headers: Headers, secret: string | null): boolean {
  if (!secret) return true;

  const signature = headers.get("x-strapi-signature") || headers.get("x-webhook-signature");
  const timestamp = headers.get("x-strapi-timestamp") || headers.get("x-webhook-timestamp");

  if (!signature) return false;

  const payload = timestamp ? `${timestamp}.${body}` : body;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest("hex")}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function extractProps(entry: StrapiWebhookPayload["entry"]): Record<string, unknown> {
  const reserved = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!reserved.has(key) && value != null) {
      props[key] = value;
    }
  }
  return props;
}

function entryToItem(
  entry: StrapiWebhookPayload["entry"],
  collectionId: number,
  userId: number,
  sourceUrl: string,
  contentTypeUid: string,
  props: Record<string, unknown>,
): UserSyncItem {
  const documentId = entry.documentId ?? String(entry.id);
  const rawRef = Buffer.from(documentId, "utf8");
  const ref = strapiRefUrl(rawRef, sourceUrl, Buffer.from(contentTypeUid, "utf8"));
  const id = genUid(rawRef);

  const createdAt = new Date(entry.createdAt).getTime();
  const changedAt = new Date(entry.updatedAt).getTime();

  if (Number.isNaN(createdAt) || Number.isNaN(changedAt)) {
    throw new Error(
      `Invalid timestamp in entry: createdAt=${entry.createdAt}, updatedAt=${entry.updatedAt}`,
    );
  }

  return {
    user: userId,
    collection: collectionId,
    sourceType: ConnectionType.STRAPI,
    ref,
    id,
    changedAt,
    props,
  };
}

export const POST: RequestHandler = async ({ request, params }) => {
  const { uid } = params;

  const body = await request.text();
  let payload: StrapiWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  if (!payload.event || !payload.model || !payload.entry) {
    log.warn({ event: payload.event, model: payload.model }, "Missing required fields");
    return new Response("Missing required fields", { status: 400 });
  }

  const eventType = request.headers.get("x-strapi-event") || payload.event;
  log.info(
    { eventType, model: payload.model, entryId: payload.entry.id },
    "Received webhook event",
  );

  // Find connections by uid with type STRAPI
  const connRows = await db
    .select({
      userId: connectionTable.userId,
      id: connectionTable.id,
      url: connectionTable.url,
      credentials: connectionTable.credentials,
      includeRef: connectionTable.includeRef,
      webhookSecret: connectionTable.webhookSecret,
    })
    .from(connectionTable)
    .where(and(eq(connectionTable.uid, uid), eq(connectionTable.type, ConnectionType.STRAPI)));

  if (connRows.length === 0) {
    log.warn({ uid }, "Connection not found");
    return new Response("Connection not found", { status: 404 });
  }

  const streamServer = getStreamServer();
  let _totalItemsBroadcast = 0;

  const props = extractProps(payload.entry);

  for (const conn of connRows) {
    // Validate signature if configured
    if (conn.webhookSecret) {
      let webhookSecret: string | null = null;
      try {
        const decryptedSecret = await decryptCredentials(conn.userId, conn.webhookSecret);
        webhookSecret = decryptedSecret?.toString("utf8") ?? null;
      } catch (err) {
        log.error(
          { err, userId: conn.userId, connectionId: conn.id },
          "Failed to decrypt webhook secret",
        );
        await logWebhookEvent(
          conn.userId,
          conn.id,
          eventType,
          payload.model,
          "error",
          "Failed to decrypt webhook secret",
        );
        continue;
      }
      if (!validateSignature(body, request.headers, webhookSecret)) {
        log.warn({ userId: conn.userId, connectionId: conn.id }, "Invalid signature");
        await logWebhookEvent(
          conn.userId,
          conn.id,
          eventType,
          payload.model,
          "unauthorized",
          "Invalid webhook signature",
        );
        continue;
      }
    }

    // Find source collections by connectionId + ref (content type UID)
    const contentTypeUid = payload.uid || `api::${payload.model}.${payload.model}`;
    const refBuffer = Buffer.from(contentTypeUid, "utf8");

    const sourceCollections = await db
      .select({ id: collectionTable.id, schema: collectionTable.schema })
      .from(collectionTable)
      .where(
        and(
          eq(collectionTable.userId, conn.userId),
          eq(collectionTable.connectionId, conn.id),
          eq(collectionTable.ref, refBuffer),
        ),
      );

    if (sourceCollections.length === 0) {
      log.debug(
        { contentTypeUid, userId: conn.userId, connectionId: conn.id },
        "No collections found for content type",
      );
      await logWebhookEvent(
        conn.userId,
        conn.id,
        eventType,
        payload.model,
        "success",
        `No collections for content type ${contentTypeUid}`,
        0,
      );
      continue;
    }

    const sourceCollectionIds = sourceCollections.map((c) => c.id);

    // Check for schema drift (throttled by TTL cache)
    const cacheKey = `${conn.id}:${contentTypeUid}`;
    const lastCheck = schemaCheckCache.get(cacheKey) ?? 0;
    if (Date.now() - lastCheck > SCHEMA_CHECK_TTL_MS && conn.credentials) {
      schemaCheckCache.set(cacheKey, Date.now());
      try {
        const token = await decryptCredentials(conn.userId, conn.credentials);
        if (token && conn.url) {
          const currentSchema = await getCollectionSchema(conn.url, refBuffer, token);
          for (const col of sourceCollections) {
            const storedSchema: CollectionSchema = col.schema ? unpack(col.schema) : {};
            const keys = new Set([...Object.keys(storedSchema), ...Object.keys(currentSchema)]);
            let changed = false;
            for (const k of keys) {
              if (storedSchema[k] !== currentSchema[k]) {
                changed = true;
                break;
              }
            }
            if (changed) {
              await runEffectWithServices(
                Effect.flatMap(Database, ({ withUserContext }) =>
                  withUserContext(
                    conn.userId,
                    processSchemaChange(conn.userId, col.id, currentSchema),
                  ),
                ),
              );
            }
          }
        }
      } catch (err) {
        log.warn({ err, connectionId: conn.id }, "Failed to check schema drift");
      }
    }

    // Get flows from source collections
    const flows = await db
      .select({
        id: flowTable.id,
        sourceId: flowTable.sourceId,
        targetId: flowTable.targetId,
        includeRef: flowTable.includeRef,
        filters: flowTable.filters,
      })
      .from(flowTable)
      .where(
        and(eq(flowTable.userId, conn.userId), inArray(flowTable.sourceId, sourceCollectionIds)),
      );

    if (flows.length === 0) {
      log.debug("No flows for source collections");
      await logWebhookEvent(
        conn.userId,
        conn.id,
        eventType,
        payload.model,
        "success",
        "No flows configured",
        0,
      );
      continue;
    }

    // Apply filters
    const targetCollectionIds: number[] = [];
    const collectionRefPolicy = new Map<number, boolean>();
    let filteredOutCount = 0;

    for (const flow of flows) {
      if (flow.filters) {
        const filters = unpack(flow.filters) as Filter[];
        if (filters.length > 0 && !matchesFilters(props, filters)) {
          filteredOutCount++;
          continue;
        }
      }
      targetCollectionIds.push(flow.targetId);
      const previous = collectionRefPolicy.get(flow.targetId) ?? true;
      collectionRefPolicy.set(flow.targetId, previous && conn.includeRef && flow.includeRef);
    }

    if (targetCollectionIds.length === 0) {
      log.debug({ filteredOutCount }, "All items filtered out");
      await logWebhookEvent(
        conn.userId,
        conn.id,
        eventType,
        payload.model,
        "success",
        `All items filtered out (${filteredOutCount} flows)`,
        0,
      );
      continue;
    }

    // Find CLIENT connections that own the target collections
    const clients = await db
      .select({
        clientConnectionId: connectionTable.id,
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
        and(
          eq(collectionTable.userId, conn.userId),
          inArray(collectionTable.id, [...new Set(targetCollectionIds)]),
        ),
      );

    if (clients.length === 0) {
      log.debug("No CLIENT connections for target collections");
      await logWebhookEvent(
        conn.userId,
        conn.id,
        eventType,
        payload.model,
        "success",
        "No connected consumers",
        0,
      );
      continue;
    }

    let itemsBroadcast = 0;
    for (const collectionId of new Set(targetCollectionIds)) {
      const item = entryToItem(
        payload.entry,
        collectionId,
        conn.userId,
        conn.url ?? "",
        contentTypeUid,
        props,
      );

      const collectionClients = clients
        .filter((c) => c.collectionId === collectionId)
        .map((c) => ({
          userId: conn.userId,
          connectionId: c.clientConnectionId,
          collectionId: c.collectionId,
          includeRef:
            Boolean(c.connectionIncludeRef) &&
            Boolean(c.collectionIncludeRef) &&
            (collectionRefPolicy.get(c.collectionId) ?? true),
        }));

      if (collectionClients.length > 0) {
        log.debug(
          { consumerCount: collectionClients.length, collectionId },
          "Broadcasting to consumers",
        );
        void streamServer.broadcast([item], collectionClients);
        itemsBroadcast += collectionClients.length;
      }
    }

    _totalItemsBroadcast += itemsBroadcast;

    const logMessage = filteredOutCount > 0 ? `${filteredOutCount} items filtered out` : undefined;
    await logWebhookEvent(
      conn.userId,
      conn.id,
      eventType,
      payload.model,
      "success",
      logMessage,
      itemsBroadcast,
    );

    log.info({ userId: conn.userId, connectionId: conn.id }, "Webhook processed");
  }

  return new Response("OK", { status: 200 });
};
