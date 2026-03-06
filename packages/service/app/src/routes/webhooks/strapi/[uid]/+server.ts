import { getStreamServer } from "$lib/server/startup";
import { SourceType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { listInfluxesBySourceCollections } from "@contfu/svc-backend/features/influxes/listInfluxesBySourceCollections";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import { decryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  consumerCollectionTable,
  consumerTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { strapiRefUrl } from "@contfu/svc-sources";
import { matchesFilters } from "@contfu/svc-core";
import { genUid } from "@contfu/svc-sources";
import { and, desc, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-strapi");

/** Maximum number of webhook logs to keep per source */
const MAX_LOGS_PER_SOURCE = 50;

/** Strapi webhook event types we handle. */
type StrapiEvent =
  | "entry.create"
  | "entry.update"
  | "entry.delete"
  | "entry.publish"
  | "entry.unpublish";

/** Strapi webhook payload structure. */
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

/**
 * Log a webhook event to the database.
 */
async function logWebhookEvent(
  _userId: number,
  sourceId: number,
  event: string,
  model: string | null,
  status: "success" | "error" | "unauthorized",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    // Insert new log
    await db.insert(webhookLogTable).values({
      sourceId,
      event,
      model,
      status,
      errorMessage,
      itemsBroadcast: itemsBroadcast ?? 0,
    });

    // Clean up old logs (keep only the last MAX_LOGS_PER_SOURCE)
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
 * Validates HMAC signature if webhook secret is configured.
 */
function validateSignature(body: string, headers: Headers, secret: string | null): boolean {
  if (!secret) return true; // No secret configured, skip validation

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

/**
 * Extract props from Strapi entry (excluding reserved fields).
 */
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

/**
 * Convert Strapi entry to UserSyncItem for broadcast.
 */
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
  const _publishedAt = entry.publishedAt ? new Date(entry.publishedAt).getTime() : undefined;

  if (Number.isNaN(createdAt) || Number.isNaN(changedAt)) {
    throw new Error(
      `Invalid timestamp in entry: createdAt=${entry.createdAt}, updatedAt=${entry.updatedAt}`,
    );
  }

  return {
    user: userId,
    collection: collectionId,
    sourceType: SourceType.STRAPI,
    ref,
    id,
    changedAt,
    props,
  };
}

export const POST: RequestHandler = async ({ request, params }) => {
  const { uid } = params;

  // Parse the webhook payload
  const body = await request.text();
  let payload: StrapiWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  // Validate required fields
  if (!payload.event || !payload.model || !payload.entry) {
    log.warn({ event: payload.event, model: payload.model }, "Missing required fields");
    return new Response("Missing required fields", { status: 400 });
  }

  const eventType = request.headers.get("x-strapi-event") || payload.event;
  log.info(
    { eventType, model: payload.model, entryId: payload.entry.id },
    "Received webhook event",
  );

  // Find the source by uid and verify it's a Strapi source
  const sources = await db
    .select({
      userId: sourceTable.userId,
      id: sourceTable.id,
      url: sourceTable.url,
      includeRef: sourceTable.includeRef,
      webhookSecret: sourceTable.webhookSecret,
    })
    .from(sourceTable)
    .where(and(eq(sourceTable.uid, uid), eq(sourceTable.type, SourceType.STRAPI)));

  if (sources.length === 0) {
    log.warn({ uid }, "Source not found");
    return new Response("Source not found", { status: 404 });
  }

  const streamServer = getStreamServer();
  let _totalItemsBroadcast = 0;

  // Extract props once for filter evaluation
  const props = extractProps(payload.entry);

  for (const source of sources) {
    // Validate signature if configured
    if (source.webhookSecret) {
      // Decrypt the webhook secret before validation
      let webhookSecret: string | null = null;
      try {
        const decryptedSecret = await decryptCredentials(source.userId, source.webhookSecret);
        webhookSecret = decryptedSecret?.toString("utf8") ?? null;
      } catch (err) {
        log.error(
          { err, userId: source.userId, sourceId: source.id },
          "Failed to decrypt webhook secret",
        );
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          payload.model,
          "error",
          "Failed to decrypt webhook secret",
        );
        continue;
      }
      if (!validateSignature(body, request.headers, webhookSecret)) {
        log.warn({ userId: source.userId, sourceId: source.id }, "Invalid signature");
        await logWebhookEvent(
          source.userId,
          source.id,
          eventType,
          payload.model,
          "unauthorized",
          "Invalid webhook signature",
        );
        continue;
      }
    }

    // Find source collections matching this content type
    const contentTypeUid = payload.uid || `api::${payload.model}.${payload.model}`;
    const refBuffer = Buffer.from(contentTypeUid, "utf8");

    const sourceCollections = await db
      .select({ id: sourceCollectionTable.id })
      .from(sourceCollectionTable)
      .where(
        and(
          eq(sourceCollectionTable.userId, source.userId),
          eq(sourceCollectionTable.sourceId, source.id),
          eq(sourceCollectionTable.ref, refBuffer),
        ),
      );

    if (sourceCollections.length === 0) {
      log.debug(
        { contentTypeUid, userId: source.userId, sourceId: source.id },
        "No source collections found for content type",
      );
      await logWebhookEvent(
        source.userId,
        source.id,
        eventType,
        payload.model,
        "success",
        `No source collections for content type ${contentTypeUid}`,
        0,
      );
      continue;
    }

    const sourceCollectionIds = sourceCollections.map((c) => c.id);

    // Get influxes with unpacked filters for these source collections
    const influxes = await runEffectWithServices(
      listInfluxesBySourceCollections(source.userId, sourceCollectionIds),
    );

    if (influxes.length === 0) {
      log.debug("No influxes for source collections");
      await logWebhookEvent(
        source.userId,
        source.id,
        eventType,
        payload.model,
        "success",
        "No influxes configured",
        0,
      );
      continue;
    }

    // Get unique target collection IDs that pass filters
    const targetCollectionIds: number[] = [];
    const collectionRefPolicy = new Map<number, boolean>();
    let filteredOutCount = 0;

    for (const influx of influxes) {
      if (influx.filters.length > 0) {
        if (!matchesFilters(props, influx.filters)) {
          filteredOutCount++;
          log.debug(
            { collectionId: influx.collectionId, filterCount: influx.filters.length },
            "Entry filtered out",
          );
          continue;
        }
      }

      targetCollectionIds.push(influx.collectionId);
      const previous = collectionRefPolicy.get(influx.collectionId) ?? true;
      // Ref propagation is opt-out only: false at any upstream layer disables it.
      collectionRefPolicy.set(
        influx.collectionId,
        previous && source.includeRef && influx.includeRef,
      );
    }

    if (targetCollectionIds.length === 0) {
      log.debug({ filteredOutCount }, "All items filtered out");
      await logWebhookEvent(
        source.userId,
        source.id,
        eventType,
        payload.model,
        "success",
        `All items filtered out (${filteredOutCount} influxes)`,
        0,
      );
      continue;
    }

    // Find connected consumers for the target collections
    const connections = await db
      .select({
        consumerId: consumerCollectionTable.consumerId,
        collectionId: consumerCollectionTable.collectionId,
        connectionIncludeRef: consumerCollectionTable.includeRef,
        consumerIncludeRef: consumerTable.includeRef,
        collectionIncludeRef: collectionTable.includeRef,
        lastItemChanged: consumerCollectionTable.lastItemChanged,
      })
      .from(consumerCollectionTable)
      .innerJoin(
        collectionTable,
        and(
          eq(consumerCollectionTable.userId, collectionTable.userId),
          eq(consumerCollectionTable.collectionId, collectionTable.id),
        ),
      )
      .innerJoin(
        consumerTable,
        and(
          eq(consumerCollectionTable.userId, consumerTable.userId),
          eq(consumerCollectionTable.consumerId, consumerTable.id),
        ),
      )
      .where(
        and(
          eq(consumerCollectionTable.userId, source.userId),
          inArray(consumerCollectionTable.collectionId, targetCollectionIds),
        ),
      );

    if (connections.length === 0) {
      log.debug("No consumer connections for target collections");
      await logWebhookEvent(
        source.userId,
        source.id,
        eventType,
        payload.model,
        "success",
        "No connected consumers",
        0,
      );
      continue;
    }

    // Convert entry to items (one per target collection) and broadcast
    let itemsBroadcast = 0;
    for (const collectionId of targetCollectionIds) {
      const item = entryToItem(
        payload.entry,
        collectionId,
        source.userId,
        source.url ?? "",
        contentTypeUid,
        props,
      );

      // Build connection info for this collection
      const collectionConnections = connections
        .filter((c) => c.collectionId === collectionId)
        .map((c) => ({
          userId: source.userId,
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
        log.debug(
          { consumerCount: collectionConnections.length, collectionId },
          "Broadcasting to consumers",
        );
        void streamServer.broadcast([item], collectionConnections);
        itemsBroadcast += collectionConnections.length;
      }
    }

    _totalItemsBroadcast += itemsBroadcast;

    // Log successful webhook processing
    const logMessage = filteredOutCount > 0 ? `${filteredOutCount} items filtered out` : undefined;
    await logWebhookEvent(
      source.userId,
      source.id,
      eventType,
      payload.model,
      "success",
      logMessage,
      itemsBroadcast,
    );

    log.info({ userId: source.userId, sourceId: source.id }, "Webhook processed");
  }

  return new Response("OK", { status: 200 });
};
