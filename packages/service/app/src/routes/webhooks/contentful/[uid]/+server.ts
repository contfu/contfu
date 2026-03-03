import { getStreamServer } from "$lib/server/startup";
import { SourceType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { listInfluxesBySourceCollections } from "@contfu/svc-backend/features/influxes/listInfluxesBySourceCollections";
import { runEffectWithServices } from "@contfu/svc-backend/effect/run";
import { decryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  sourceCollectionTable,
  sourceTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { contentfulRefUrl } from "@contfu/svc-sources";
import { matchesFilters } from "@contfu/svc-core";
import { genUid } from "@contfu/svc-sources";
import { and, desc, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-contentful");

const MAX_LOGS_PER_SOURCE = 50;

type ContentfulEvent =
  | "ContentManagement.Entry.publish"
  | "ContentManagement.Entry.unpublish"
  | "ContentManagement.Entry.delete"
  | "ContentManagement.Asset.publish"
  | "ContentManagement.Asset.unpublish"
  | "ContentManagement.Asset.delete";

interface ContentfulWebhookPayload {
  sys: {
    id: string;
    type: string;
    contentType?: {
      sys: {
        id: string;
      };
    };
    createdAt: string;
    updatedAt: string;
  };
  fields?: Record<string, unknown>;
}

interface ContentfulWebhookTopic {
  sys: {
    type: string;
    id: string;
    contentType?: {
      sys: {
        id: string;
      };
    };
  };
}

async function logWebhookEvent(
  _userId: number,
  sourceId: number,
  event: string,
  contentType: string | null,
  status: "success" | "error" | "unauthorized",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      sourceId,
      event,
      model: contentType,
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

function validateSignature(body: string, headers: Headers, secret: string): boolean {
  const signature = headers.get("x-contentful-signature");
  const timestamp = headers.get("x-contentful-timestamp");

  if (!signature || !timestamp) return false;

  const payload = `${timestamp}.${body}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function extractProps(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) {
      props[key] = value;
    }
  }
  return props;
}

function entryToItem(
  entryId: string,
  contentTypeId: string,
  collectionId: number,
  userId: number,
  sourceUrl: string,
  props: Record<string, unknown>,
  updatedAt: string,
): UserSyncItem {
  const rawRef = Buffer.from(entryId, "utf8");
  const contentTypeRef = Buffer.from(contentTypeId, "utf8");
  const ref = contentfulRefUrl(rawRef, sourceUrl, contentTypeRef);
  const id = genUid(rawRef);

  const changedAt = new Date(updatedAt).getTime();

  if (Number.isNaN(changedAt)) {
    throw new Error(`Invalid timestamp in entry: updatedAt=${updatedAt}`);
  }

  return {
    user: userId,
    collection: collectionId,
    sourceType: SourceType.CONTENTFUL,
    ref,
    id,
    changedAt,
    props,
  };
}

function parseTopic(topic: string): { event: ContentfulEvent; contentTypeId: string | null } {
  const parts = topic.split(".");
  const event = parts.slice(0, 3).join(".") as ContentfulEvent;
  const contentTypeId = parts.length >= 4 ? parts[3] : null;
  return { event, contentTypeId };
}

export const POST: RequestHandler = async ({ request, params }) => {
  const { uid } = params;

  const body = await request.text();

  const topicHeader = request.headers.get("x-contentful-topic");
  if (!topicHeader) {
    log.warn("Missing x-contentful-topic header");
    return new Response("Missing topic header", { status: 400 });
  }

  const { event, contentTypeId } = parseTopic(topicHeader);
  log.info({ event, contentTypeId }, "Received Contentful webhook");

  let payload: ContentfulWebhookTopic;
  try {
    payload = JSON.parse(body);
  } catch {
    log.warn("Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const entryId = payload.sys.id;
  const ctId = contentTypeId ?? payload.sys.contentType?.sys.id;

  if (!entryId) {
    log.warn("Missing entry ID in payload");
    return new Response("Missing entry ID", { status: 400 });
  }

  const sources = await db
    .select({
      userId: sourceTable.userId,
      id: sourceTable.id,
      url: sourceTable.url,
      includeRef: sourceTable.includeRef,
      webhookSecret: sourceTable.webhookSecret,
    })
    .from(sourceTable)
    .where(and(eq(sourceTable.uid, uid), eq(sourceTable.type, SourceType.CONTENTFUL)));

  if (sources.length === 0) {
    log.warn({ uid }, "Source not found");
    return new Response("Source not found", { status: 404 });
  }

  const streamServer = getStreamServer();
  let _totalItemsBroadcast = 0;

  const fields = (payload as unknown as ContentfulWebhookPayload).fields;
  const props = extractProps(fields);

  for (const source of sources) {
    if (source.webhookSecret) {
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
          event,
          ctId,
          "error",
          "Failed to decrypt webhook secret",
        );
        continue;
      }
      if (webhookSecret && !validateSignature(body, request.headers, webhookSecret)) {
        log.warn({ userId: source.userId, sourceId: source.id }, "Invalid signature");
        await logWebhookEvent(
          source.userId,
          source.id,
          event,
          ctId,
          "unauthorized",
          "Invalid webhook signature",
        );
        continue;
      }
    }

    const refBuffer = Buffer.from(ctId ?? "", "utf8");

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
        { contentTypeId: ctId, userId: source.userId, sourceId: source.id },
        "No source collections found for content type",
      );
      await logWebhookEvent(
        source.userId,
        source.id,
        event,
        ctId,
        "success",
        `No source collections for content type ${ctId}`,
        0,
      );
      continue;
    }

    const sourceCollectionIds = sourceCollections.map((c) => c.id);

    const influxes = await runEffectWithServices(
      listInfluxesBySourceCollections(source.userId, sourceCollectionIds),
    );

    if (influxes.length === 0) {
      log.debug("No influxes for source collections");
      await logWebhookEvent(
        source.userId,
        source.id,
        event,
        ctId,
        "success",
        "No influxes configured",
        0,
      );
      continue;
    }

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
        event,
        ctId,
        "success",
        `All items filtered out (${filteredOutCount} influxes)`,
        0,
      );
      continue;
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

    if (connections.length === 0) {
      log.debug("No consumer connections for target collections");
      await logWebhookEvent(
        source.userId,
        source.id,
        event,
        ctId,
        "success",
        "No connected consumers",
        0,
      );
      continue;
    }

    let itemsBroadcast = 0;
    for (const collectionId of targetCollectionIds) {
      const item = entryToItem(
        entryId,
        ctId ?? "",
        collectionId,
        source.userId,
        source.url ?? "",
        props,
        new Date().toISOString(),
      );

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

    const logMessage = filteredOutCount > 0 ? `${filteredOutCount} items filtered out` : undefined;
    await logWebhookEvent(
      source.userId,
      source.id,
      event,
      ctId,
      "success",
      logMessage,
      itemsBroadcast,
    );

    log.info({ userId: source.userId, sourceId: source.id }, "Webhook processed");
  }

  return new Response("OK", { status: 200 });
};
