import { getStreamServer } from "$lib/server/startup";
import { ConnectionType } from "@contfu/core";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { decryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { db } from "@contfu/svc-backend/infra/db/db";
import {
  collectionTable,
  connectionTable,
  flowTable,
  webhookLogTable,
} from "@contfu/svc-backend/infra/db/schema";
import type { UserSyncItem } from "@contfu/svc-backend/infra/sync-worker/messages";
import { contentfulRefUrl } from "@contfu/svc-sources";
import { matchesFilters, type Filter } from "@contfu/svc-core";
import { genUid } from "@contfu/svc-sources";
import { and, desc, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

const log = createLogger("webhook-contentful");

const MAX_LOGS_PER_CONNECTION = 50;

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
  connectionId: number,
  event: string,
  contentType: string | null,
  status: "success" | "error" | "unauthorized",
  errorMessage?: string,
  itemsBroadcast?: number,
): Promise<void> {
  try {
    await db.insert(webhookLogTable).values({
      connectionId,
      event,
      model: contentType,
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
    sourceType: ConnectionType.CONTENTFUL,
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
  const ctId = contentTypeId ?? payload.sys.contentType?.sys.id ?? null;

  if (!entryId) {
    log.warn("Missing entry ID in payload");
    return new Response("Missing entry ID", { status: 400 });
  }

  // Find connections by uid with type CONTENTFUL
  const connRows = await db
    .select({
      userId: connectionTable.userId,
      id: connectionTable.id,
      url: connectionTable.url,
      includeRef: connectionTable.includeRef,
      webhookSecret: connectionTable.webhookSecret,
    })
    .from(connectionTable)
    .where(and(eq(connectionTable.uid, uid), eq(connectionTable.type, ConnectionType.CONTENTFUL)));

  if (connRows.length === 0) {
    log.warn({ uid }, "Connection not found");
    return new Response("Connection not found", { status: 404 });
  }

  const streamServer = getStreamServer();
  let _totalItemsBroadcast = 0;

  const fields = (payload as unknown as ContentfulWebhookPayload).fields;
  const props = extractProps(fields);

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
          event,
          ctId,
          "error",
          "Failed to decrypt webhook secret",
        );
        continue;
      }
      if (webhookSecret && !validateSignature(body, request.headers, webhookSecret)) {
        log.warn({ userId: conn.userId, connectionId: conn.id }, "Invalid signature");
        await logWebhookEvent(
          conn.userId,
          conn.id,
          event,
          ctId,
          "unauthorized",
          "Invalid webhook signature",
        );
        continue;
      }
    }

    // Find source collections by connectionId + ref (content type ID)
    const refBuffer = Buffer.from(ctId ?? "", "utf8");

    const sourceCollections = await db
      .select({ id: collectionTable.id })
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
        { contentTypeId: ctId, userId: conn.userId, connectionId: conn.id },
        "No collections found for content type",
      );
      await logWebhookEvent(
        conn.userId,
        conn.id,
        event,
        ctId,
        "success",
        `No collections for content type ${ctId}`,
        0,
      );
      continue;
    }

    const sourceCollectionIds = sourceCollections.map((c) => c.id);

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
      await logWebhookEvent(conn.userId, conn.id, event, ctId, "success", "No flows configured", 0);
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
        event,
        ctId,
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
        event,
        ctId,
        "success",
        "No connected consumers",
        0,
      );
      continue;
    }

    let itemsBroadcast = 0;
    for (const collectionId of new Set(targetCollectionIds)) {
      const item = entryToItem(
        entryId,
        ctId ?? "",
        collectionId,
        conn.userId,
        conn.url ?? "",
        props,
        new Date().toISOString(),
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
    await logWebhookEvent(conn.userId, conn.id, event, ctId, "success", logMessage, itemsBroadcast);

    log.info({ userId: conn.userId, connectionId: conn.id, itemsBroadcast }, "Webhook processed");
  }

  return new Response("OK", { status: 200 });
};
