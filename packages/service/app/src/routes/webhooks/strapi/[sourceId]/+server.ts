import { decryptCredentials } from "$lib/server/crypto/credentials";
import { collectionTable, connectionTable, db, sourceTable } from "$lib/server/db/db";
import { getSSEServer } from "$lib/server/startup";
import { genUid } from "$lib/server/util/ids/ids";
import { SourceType, type UserSyncItem } from "@contfu/core";
import { and, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import type { RequestHandler } from "./$types";

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
 * Convert Strapi entry to UserSyncItem for SSE broadcast.
 */
function entryToItem(
  entry: StrapiWebhookPayload["entry"],
  collectionId: number,
  userId: number,
): UserSyncItem {
  const documentId = entry.documentId ?? String(entry.id);
  const ref = Buffer.from(documentId, "utf8");
  const id = genUid(ref);

  const createdAt = new Date(entry.createdAt).getTime();
  const changedAt = new Date(entry.updatedAt).getTime();
  const publishedAt = entry.publishedAt ? new Date(entry.publishedAt).getTime() : undefined;

  if (Number.isNaN(createdAt) || Number.isNaN(changedAt)) {
    throw new Error(
      `Invalid timestamp in entry: createdAt=${entry.createdAt}, updatedAt=${entry.updatedAt}`,
    );
  }

  // Extract props (excluding reserved fields)
  const reserved = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt"]);
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!reserved.has(key) && value != null) {
      props[key] = value;
    }
  }

  return {
    user: userId,
    collection: collectionId,
    ref,
    id,
    createdAt,
    changedAt,
    publishedAt,
    props,
  };
}

export const POST: RequestHandler = async ({ request, params }) => {
  const sourceId = parseInt(params.sourceId, 10);
  if (!Number.isFinite(sourceId)) {
    return new Response("Invalid source ID", { status: 400 });
  }

  // Parse the webhook payload
  const body = await request.text();
  let payload: StrapiWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("[Strapi webhook] Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  // Validate required fields
  if (!payload.event || !payload.model || !payload.entry) {
    console.error("[Strapi webhook] Missing required fields:", {
      event: payload.event,
      model: payload.model,
    });
    return new Response("Missing required fields", { status: 400 });
  }

  const eventType = request.headers.get("x-strapi-event") || payload.event;
  console.log(
    `[Strapi webhook] Received ${eventType} for model "${payload.model}", entry ${payload.entry.id}`,
  );

  // Find the source and verify it's a Strapi source
  const sources = await db
    .select({
      userId: sourceTable.userId,
      id: sourceTable.id,
      webhookSecret: sourceTable.webhookSecret,
    })
    .from(sourceTable)
    .where(and(eq(sourceTable.id, sourceId), eq(sourceTable.type, SourceType.STRAPI)));

  if (sources.length === 0) {
    console.error(`[Strapi webhook] Source ${sourceId} not found`);
    return new Response("Source not found", { status: 404 });
  }

  const sseServer = getSSEServer();

  for (const source of sources) {
    // Validate signature if configured
    if (source.webhookSecret) {
      // Decrypt the webhook secret before validation
      let webhookSecret: string | null = null;
      try {
        const decryptedSecret = await decryptCredentials(source.userId, source.webhookSecret);
        webhookSecret = decryptedSecret?.toString("utf8") ?? null;
      } catch (err) {
        console.error(
          `[Strapi webhook] Failed to decrypt webhook secret for source ${source.userId}:${source.id}`,
          err,
        );
        continue; // Skip this source, try others
      }
      if (!validateSignature(body, request.headers, webhookSecret)) {
        console.error(
          `[Strapi webhook] Invalid signature for source ${source.userId}:${source.id}`,
        );
        continue; // Skip this source, try others
      }
    }

    // Find collections matching this content type
    const contentTypeUid = payload.uid || `api::${payload.model}.${payload.model}`;
    const refBuffer = Buffer.from(contentTypeUid, "utf8");

    const collections = await db
      .select({ id: collectionTable.id })
      .from(collectionTable)
      .where(
        and(
          eq(collectionTable.userId, source.userId),
          eq(collectionTable.sourceId, source.id),
          eq(collectionTable.ref, refBuffer),
        ),
      );

    if (collections.length === 0) {
      console.log(
        `[Strapi webhook] No collections found for content type "${contentTypeUid}" in source ${source.userId}:${source.id}`,
      );
      continue;
    }

    const collectionIds = collections.map((c) => c.id);

    // Find connected consumers for these collections
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
          inArray(connectionTable.collectionId, collectionIds),
        ),
      );

    if (connections.length === 0) {
      console.log(`[Strapi webhook] No consumer connections for collections`);
      continue;
    }

    // Convert entry to items (one per collection) and broadcast
    for (const collection of collections) {
      const item = entryToItem(payload.entry, collection.id, source.userId);

      // Build connection info for this collection
      const collectionConnections = connections
        .filter((c) => c.collectionId === collection.id)
        .map((c) => ({
          userId: source.userId,
          consumerId: c.consumerId,
          collectionId: c.collectionId,
          lastItemChanged: c.lastItemChanged,
        }));

      if (collectionConnections.length > 0) {
        console.log(`[Strapi webhook] Broadcasting to ${collectionConnections.length} consumer(s)`);
        sseServer.broadcast([item], collectionConnections);
      }
    }

    console.log(`[Strapi webhook] Processed for source ${source.userId}:${source.id}`);
  }

  return new Response("OK", { status: 200 });
};
